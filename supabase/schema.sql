-- ============================================================
-- TripSplit schema
-- ============================================================

-- ─── user_profiles ─────────────────────────────────────────
CREATE TABLE user_profiles (
  id                UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name      TEXT NOT NULL DEFAULT '',
  avatar_emoji      TEXT NOT NULL DEFAULT '🙂',
  default_currency  TEXT NOT NULL DEFAULT 'USD',
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Auto-create a blank profile row whenever a new auth user signs up.
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  INSERT INTO user_profiles (id, display_name)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'display_name', split_part(NEW.email, '@', 1)));
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- ─── trips ──────────────────────────────────────────────────
CREATE TABLE trips (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name         TEXT NOT NULL,
  emoji        TEXT NOT NULL DEFAULT '✈️',
  currency     TEXT NOT NULL DEFAULT 'USD',
  created_by   UUID NOT NULL REFERENCES auth.users(id),
  invite_code  TEXT UNIQUE NOT NULL DEFAULT substr(replace(gen_random_uuid()::text, '-', ''), 1, 8),
  archived     BOOLEAN NOT NULL DEFAULT FALSE,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─── trip_members (registered users only, no placeholder members) ──
CREATE TABLE trip_members (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  trip_id      UUID NOT NULL REFERENCES trips(id) ON DELETE CASCADE,
  user_id      UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role         TEXT NOT NULL DEFAULT 'member' CHECK (role IN ('owner', 'member')),
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (trip_id, user_id)
);

-- Auto-add the creator as 'owner' whenever a trip is created.
CREATE OR REPLACE FUNCTION handle_new_trip()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  INSERT INTO trip_members (trip_id, user_id, role) VALUES (NEW.id, NEW.created_by, 'owner');
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_trip_created
  AFTER INSERT ON trips
  FOR EACH ROW EXECUTE FUNCTION handle_new_trip();

-- ─── expenses ───────────────────────────────────────────────
CREATE TABLE expenses (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  trip_id      UUID NOT NULL REFERENCES trips(id) ON DELETE CASCADE,
  description  TEXT NOT NULL,
  amount       NUMERIC(10, 2) NOT NULL CHECK (amount > 0),
  category     TEXT NOT NULL DEFAULT 'general'
               CHECK (category IN ('general', 'food', 'transport', 'lodging', 'activities', 'shopping', 'other')),
  paid_by      UUID NOT NULL REFERENCES trip_members(id) ON DELETE RESTRICT,
  split_type   TEXT NOT NULL DEFAULT 'equal' CHECK (split_type IN ('equal', 'exact', 'percentage', 'shares')),
  expense_date DATE NOT NULL DEFAULT CURRENT_DATE,
  notes        TEXT NOT NULL DEFAULT '',
  created_by   UUID NOT NULL REFERENCES auth.users(id),
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─── expense_splits ─────────────────────────────────────────
CREATE TABLE expense_splits (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  expense_id     UUID NOT NULL REFERENCES expenses(id) ON DELETE CASCADE,
  trip_id        UUID NOT NULL REFERENCES trips(id) ON DELETE CASCADE,
  trip_member_id UUID NOT NULL REFERENCES trip_members(id) ON DELETE RESTRICT,
  share_amount   NUMERIC(10, 2) NOT NULL,
  share_value    NUMERIC(10, 2),
  UNIQUE (expense_id, trip_member_id)
);

-- ─── settlements ────────────────────────────────────────────
CREATE TABLE settlements (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  trip_id     UUID NOT NULL REFERENCES trips(id) ON DELETE CASCADE,
  from_member UUID NOT NULL REFERENCES trip_members(id) ON DELETE RESTRICT,
  to_member   UUID NOT NULL REFERENCES trip_members(id) ON DELETE RESTRICT,
  amount      NUMERIC(10, 2) NOT NULL CHECK (amount > 0),
  note        TEXT NOT NULL DEFAULT '',
  settled_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by  UUID NOT NULL REFERENCES auth.users(id),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (from_member <> to_member)
);

-- ─── Indexes ────────────────────────────────────────────────
CREATE INDEX ON trip_members(trip_id);
CREATE INDEX ON trip_members(user_id);
CREATE INDEX ON expenses(trip_id, expense_date DESC);
CREATE INDEX ON expense_splits(expense_id);
CREATE INDEX ON expense_splits(trip_id);
CREATE INDEX ON expense_splits(trip_member_id);
CREATE INDEX ON settlements(trip_id);

-- ============================================================
-- Row Level Security
-- ============================================================

ALTER TABLE user_profiles  ENABLE ROW LEVEL SECURITY;
ALTER TABLE trips          ENABLE ROW LEVEL SECURITY;
ALTER TABLE trip_members   ENABLE ROW LEVEL SECURITY;
ALTER TABLE expenses       ENABLE ROW LEVEL SECURITY;
ALTER TABLE expense_splits ENABLE ROW LEVEL SECURITY;
ALTER TABLE settlements    ENABLE ROW LEVEL SECURITY;

-- Helper functions (SECURITY DEFINER + STABLE avoids recursive RLS lookups,
-- same pattern as MediPlus's my_tenant_id()/my_role()).
CREATE OR REPLACE FUNCTION my_trip_ids()
RETURNS SETOF UUID LANGUAGE sql STABLE SECURITY DEFINER AS $$
  SELECT trip_id FROM trip_members WHERE user_id = auth.uid();
$$;

CREATE OR REPLACE FUNCTION is_trip_owner(t_id UUID)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER AS $$
  SELECT EXISTS (
    SELECT 1 FROM trip_members WHERE trip_id = t_id AND user_id = auth.uid() AND role = 'owner'
  );
$$;

-- user_profiles: only your own row
CREATE POLICY "profiles_select_own" ON user_profiles FOR SELECT USING (id = auth.uid());
CREATE POLICY "profiles_update_own" ON user_profiles FOR UPDATE USING (id = auth.uid());

-- trips: only trips you belong to
CREATE POLICY "trips_select" ON trips FOR SELECT USING (id IN (SELECT my_trip_ids()));
CREATE POLICY "trips_insert" ON trips FOR INSERT WITH CHECK (created_by = auth.uid());
CREATE POLICY "trips_update" ON trips FOR UPDATE USING (is_trip_owner(id));

-- trip_members: readable by fellow members; no direct client insert path
-- (membership rows are only created by the on_trip_created trigger and the
-- join_trip() RPC below, both SECURITY DEFINER and therefore bypass RLS).
CREATE POLICY "trip_members_select" ON trip_members FOR SELECT USING (trip_id IN (SELECT my_trip_ids()));

-- expenses / expense_splits / settlements: full access scoped to your trips
CREATE POLICY "expenses_all" ON expenses FOR ALL USING (trip_id IN (SELECT my_trip_ids()));
CREATE POLICY "expense_splits_all" ON expense_splits FOR ALL USING (trip_id IN (SELECT my_trip_ids()));
CREATE POLICY "settlements_all" ON settlements FOR ALL USING (trip_id IN (SELECT my_trip_ids()));

-- ============================================================
-- Invite RPCs
-- ============================================================

-- Pre-membership lookup: lets someone preview a trip from an invite link
-- before they've joined (bypasses RLS deliberately, read-only, minimal fields).
CREATE OR REPLACE FUNCTION get_trip_by_invite(code TEXT)
RETURNS TABLE(id UUID, name TEXT, emoji TEXT, currency TEXT, member_count BIGINT)
LANGUAGE sql SECURITY DEFINER AS $$
  SELECT t.id, t.name, t.emoji, t.currency, COUNT(m.id)
  FROM trips t
  LEFT JOIN trip_members m ON m.trip_id = t.id
  WHERE t.invite_code = code
  GROUP BY t.id;
$$;

-- Idempotent join: safe to call again if already a member (returns existing row).
CREATE OR REPLACE FUNCTION join_trip(code TEXT, uid UUID)
RETURNS UUID LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_trip_id UUID;
  v_member_id UUID;
BEGIN
  SELECT id INTO v_trip_id FROM trips WHERE invite_code = code;
  IF v_trip_id IS NULL THEN
    RAISE EXCEPTION 'Invalid invite code';
  END IF;

  SELECT id INTO v_member_id FROM trip_members WHERE trip_id = v_trip_id AND user_id = uid;
  IF v_member_id IS NOT NULL THEN
    RETURN v_member_id;
  END IF;

  INSERT INTO trip_members (trip_id, user_id, role) VALUES (v_trip_id, uid, 'member')
  RETURNING id INTO v_member_id;

  RETURN v_member_id;
END;
$$;
