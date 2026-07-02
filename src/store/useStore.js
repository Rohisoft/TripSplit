import React, { createContext, useContext, useReducer, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../auth/AuthContext';

const Ctx = createContext(null);

function reducer(state, action) {
  switch (action.type) {

    case 'HYDRATE':
      return { ...state, ...action.payload, loaded: true };

    case 'CREATE_TRIP':
      return { ...state, trips: [action.trip, ...state.trips] };

    case 'MERGE_TRIP_DATA':
      return {
        ...state,
        trips: state.trips.some(t => t.id === action.trip.id) ? state.trips : [action.trip, ...state.trips],
        tripMembers: [...state.tripMembers.filter(m => m.id !== action.member.id), action.member],
      };

    case 'ADD_EXPENSE':
      return {
        ...state,
        expenses: [action.expense, ...state.expenses],
        expenseSplits: [...state.expenseSplits, ...action.splits],
      };

    case 'UPDATE_EXPENSE':
      return {
        ...state,
        expenses: state.expenses.map(e => e.id === action.expense.id ? action.expense : e),
        expenseSplits: [
          ...state.expenseSplits.filter(s => s.expenseId !== action.expense.id),
          ...action.splits,
        ],
      };

    case 'DELETE_EXPENSE':
      return {
        ...state,
        expenses: state.expenses.filter(e => e.id !== action.expenseId),
        expenseSplits: state.expenseSplits.filter(s => s.expenseId !== action.expenseId),
      };

    case 'ADD_SETTLEMENT':
      return { ...state, settlements: [action.settlement, ...state.settlements] };

    case 'DELETE_SETTLEMENT':
      return { ...state, settlements: state.settlements.filter(s => s.id !== action.settlementId) };

    default:
      return state;
  }
}

const INITIAL = {
  loaded: false,
  trips: [],
  tripMembers: [],
  expenses: [],
  expenseSplits: [],
  settlements: [],
};

// ─── Supabase data loader ────────────────────────────────────
async function loadAllData(userId, dispatch) {
  try {
    const { data: myMemberships, error: memErr } = await supabase
      .from('trip_members').select('trip_id').eq('user_id', userId);
    if (memErr) throw memErr;

    const tripIds = (myMemberships || []).map(m => m.trip_id);
    if (tripIds.length === 0) {
      dispatch({ type: 'HYDRATE', payload: { trips: [], tripMembers: [], expenses: [], expenseSplits: [], settlements: [] } });
      return;
    }

    const [trips, members, expenses, splits, settlements] = await Promise.all([
      supabase.from('trips').select('*').in('id', tripIds).order('created_at', { ascending: false }),
      supabase.from('trip_members').select('*, profile:user_profiles(display_name, avatar_emoji)').in('trip_id', tripIds),
      supabase.from('expenses').select('*').in('trip_id', tripIds).order('expense_date', { ascending: false }),
      supabase.from('expense_splits').select('*').in('trip_id', tripIds),
      supabase.from('settlements').select('*').in('trip_id', tripIds).order('settled_at', { ascending: false }),
    ]);

    dispatch({
      type: 'HYDRATE',
      payload: {
        trips: (trips.data || []).map(transformTrip),
        tripMembers: (members.data || []).map(transformTripMember),
        expenses: (expenses.data || []).map(transformExpense),
        expenseSplits: (splits.data || []).map(transformExpenseSplit),
        settlements: (settlements.data || []).map(transformSettlement),
      },
    });
  } catch (e) {
    console.error('loadAllData:', e.message);
    dispatch({ type: 'HYDRATE', payload: {} });
  }
}

// ─── Row transformers (snake_case → camelCase) ───────────────
const transformTrip = t => ({
  id: t.id, name: t.name, emoji: t.emoji, currency: t.currency,
  createdBy: t.created_by, inviteCode: t.invite_code, archived: t.archived, createdAt: t.created_at,
});
const transformTripMember = m => ({
  id: m.id, tripId: m.trip_id, userId: m.user_id, role: m.role,
  displayName: m.profile?.display_name || 'Member', avatarEmoji: m.profile?.avatar_emoji || '🙂',
});
const transformExpense = e => ({
  id: e.id, tripId: e.trip_id, description: e.description, amount: Number(e.amount),
  category: e.category, paidBy: e.paid_by, splitType: e.split_type,
  expenseDate: e.expense_date, notes: e.notes, createdBy: e.created_by,
});
const transformExpenseSplit = s => ({
  id: s.id, expenseId: s.expense_id, tripId: s.trip_id, tripMemberId: s.trip_member_id,
  shareAmount: Number(s.share_amount), shareValue: s.share_value == null ? null : Number(s.share_value),
});
const transformSettlement = st => ({
  id: st.id, tripId: st.trip_id, fromMember: st.from_member, toMember: st.to_member,
  amount: Number(st.amount), note: st.note, settledAt: st.settled_at,
});

// ─── Supabase write sync ─────────────────────────────────────
// Returns a value for actions whose optimistic state needs a follow-up merge
// (e.g. CREATE_TRIP — the owner trip_member row is created server-side by a
// trigger, so we fetch it back and merge rather than guessing its id).
async function syncAction(action, userId) {
  switch (action.type) {

    case 'CREATE_TRIP': {
      const t = action.trip;
      const { error } = await supabase.from('trips').insert({
        id: t.id, name: t.name, emoji: t.emoji, currency: t.currency, created_by: userId,
      });
      if (error) throw error;

      const { data: memberRow, error: memErr } = await supabase
        .from('trip_members').select('*, profile:user_profiles(display_name, avatar_emoji)')
        .eq('trip_id', t.id).eq('user_id', userId).single();
      if (memErr) throw memErr;

      return { member: transformTripMember(memberRow) };
    }

    case 'ADD_EXPENSE': {
      const e = action.expense;
      const { error } = await supabase.from('expenses').insert({
        id: e.id, trip_id: e.tripId, description: e.description, amount: e.amount,
        category: e.category, paid_by: e.paidBy, split_type: e.splitType,
        expense_date: e.expenseDate, notes: e.notes || '', created_by: userId,
      });
      if (error) throw error;

      const { error: splitErr } = await supabase.from('expense_splits').insert(
        action.splits.map(s => ({
          id: s.id, expense_id: e.id, trip_id: e.tripId,
          trip_member_id: s.tripMemberId, share_amount: s.shareAmount, share_value: s.shareValue,
        }))
      );
      if (splitErr) throw splitErr;
      break;
    }

    case 'UPDATE_EXPENSE': {
      const e = action.expense;
      const { error } = await supabase.from('expenses').update({
        description: e.description, amount: e.amount, category: e.category,
        paid_by: e.paidBy, split_type: e.splitType, expense_date: e.expenseDate,
        notes: e.notes || '', updated_at: new Date().toISOString(),
      }).eq('id', e.id);
      if (error) throw error;

      await supabase.from('expense_splits').delete().eq('expense_id', e.id);
      const { error: splitErr } = await supabase.from('expense_splits').insert(
        action.splits.map(s => ({
          id: s.id, expense_id: e.id, trip_id: e.tripId,
          trip_member_id: s.tripMemberId, share_amount: s.shareAmount, share_value: s.shareValue,
        }))
      );
      if (splitErr) throw splitErr;
      break;
    }

    case 'DELETE_EXPENSE':
      await supabase.from('expenses').delete().eq('id', action.expenseId);
      break;

    case 'ADD_SETTLEMENT': {
      const s = action.settlement;
      await supabase.from('settlements').insert({
        id: s.id, trip_id: s.tripId, from_member: s.fromMember, to_member: s.toMember,
        amount: s.amount, note: s.note || '', settled_at: s.settledAt, created_by: userId,
      });
      break;
    }

    case 'DELETE_SETTLEMENT':
      await supabase.from('settlements').delete().eq('id', action.settlementId);
      break;

    // HYDRATE / MERGE_TRIP_DATA don't need cloud sync
  }
}

// ─── Provider ────────────────────────────────────────────────
export function StoreProvider({ children }) {
  const [state, dispatch] = useReducer(reducer, INITIAL);
  const { user, isAuthenticated } = useAuth();

  useEffect(() => {
    if (!isAuthenticated || !user?.id) {
      dispatch({ type: 'HYDRATE', payload: {} });
      return;
    }
    loadAllData(user.id, dispatch);
  }, [isAuthenticated, user?.id]);

  const dispatchWithSync = useCallback(async (action) => {
    dispatch(action); // optimistic local update
    if (!user?.id) return;
    try {
      const result = await syncAction(action, user.id);
      if (action.type === 'CREATE_TRIP' && result?.member) {
        dispatch({ type: 'MERGE_TRIP_DATA', trip: action.trip, member: result.member });
      }
    } catch (e) {
      console.error('syncAction:', e.message);
    }
  }, [user?.id]);

  // Re-fetches state after operations the store can't merge optimistically
  // (e.g. joining a trip via invite code, handled outside dispatchWithSync).
  const reload = useCallback(() => {
    if (user?.id) loadAllData(user.id, dispatch);
  }, [user?.id]);

  return <Ctx.Provider value={{ state, dispatch: dispatchWithSync, reload }}>{children}</Ctx.Provider>;
}

export function useStore() {
  return useContext(Ctx);
}
