import React, { useState, useMemo } from 'react';
import {
  View, Text, TextInput, ScrollView, TouchableOpacity,
  StyleSheet, SafeAreaView, StatusBar, Modal, Alert,
} from 'react-native';
import { COLORS, TRIP_EMOJIS, CURRENCIES, currencySymbol } from '../data/constants';
import { useStore } from '../store/useStore';
import { useAuth } from '../auth/AuthContext';
import { computeBalances } from '../utils/settleUp';
import { supabase } from '../lib/supabase';

export default function TripsListScreen({ navigation }) {
  const { state, dispatch, reload } = useStore();
  const { user } = useAuth();

  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState({ name: '', emoji: TRIP_EMOJIS[0], currency: 'USD' });

  const [showJoin, setShowJoin] = useState(false);
  const [joinCode, setJoinCode] = useState('');
  const [joinError, setJoinError] = useState('');
  const [joining, setJoining] = useState(false);

  const myBalanceByTrip = useMemo(() => {
    const map = {};
    state.trips.forEach(trip => {
      const members = state.tripMembers.filter(m => m.tripId === trip.id);
      const myMember = members.find(m => m.userId === user?.id);
      if (!myMember) { map[trip.id] = null; return; }
      const expenses = state.expenses.filter(e => e.tripId === trip.id);
      const splits = state.expenseSplits.filter(s => s.tripId === trip.id);
      const settlements = state.settlements.filter(s => s.tripId === trip.id);
      const balances = computeBalances(members, expenses, splits, settlements);
      map[trip.id] = balances[myMember.id] || 0;
    });
    return map;
  }, [state.trips, state.tripMembers, state.expenses, state.expenseSplits, state.settlements, user?.id]);

  const memberCount = (tripId) => state.tripMembers.filter(m => m.tripId === tripId).length;

  const handleCreate = () => {
    if (!form.name.trim()) {
      Alert.alert('Missing name', 'Give your trip a name.');
      return;
    }
    dispatch({
      type: 'CREATE_TRIP',
      trip: {
        id: crypto.randomUUID(),
        name: form.name.trim(),
        emoji: form.emoji,
        currency: form.currency,
        createdBy: user?.id,
        inviteCode: null,
        archived: false,
        createdAt: new Date().toISOString(),
      },
    });
    setForm({ name: '', emoji: TRIP_EMOJIS[0], currency: 'USD' });
    setShowAdd(false);
  };

  const handleJoin = async () => {
    const code = joinCode.trim();
    if (!code) return setJoinError('Enter an invite code');
    setJoinError(''); setJoining(true);
    try {
      const { error } = await supabase.rpc('join_trip', { code, uid: user?.id });
      if (error) throw error;
      reload();
      setJoinCode('');
      setShowJoin(false);
    } catch (err) {
      setJoinError(err.message || 'Invalid or expired invite code');
    } finally {
      setJoining(false);
    }
  };

  return (
    <SafeAreaView style={s.safe}>
      <StatusBar backgroundColor={COLORS.primary} barStyle="light-content" />

      <View style={s.topbar}>
        <Text style={s.title}>🧳 My Trips</Text>
        <View style={{ flexDirection: 'row', gap: 18, alignItems: 'center' }}>
          <TouchableOpacity onPress={() => setShowJoin(true)}>
            <Text style={s.joinBtn}>Join</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => setShowAdd(true)}>
            <Text style={{ color: '#fff', fontSize: 24, fontWeight: '300' }}>＋</Text>
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView style={s.list} showsVerticalScrollIndicator={false} contentContainerStyle={{ padding: 12 }}>
        {state.trips.length === 0 ? (
          <View style={s.emptyWrap}>
            <Text style={{ fontSize: 44 }}>🧳</Text>
            <Text style={s.emptyTitle}>No trips yet</Text>
            <Text style={s.emptySub}>Create a trip to start splitting expenses with friends</Text>
          </View>
        ) : state.trips.map(trip => {
          const bal = myBalanceByTrip[trip.id];
          const symbol = currencySymbol(trip.currency);
          return (
            <TouchableOpacity
              key={trip.id}
              style={s.card}
              onPress={() => navigation.navigate('TripDetail', { tripId: trip.id })}
            >
              <View style={s.cardIcon}><Text style={{ fontSize: 22 }}>{trip.emoji}</Text></View>
              <View style={s.cardInfo}>
                <Text style={s.cardName}>{trip.name}</Text>
                <Text style={s.cardSub}>{memberCount(trip.id)} member{memberCount(trip.id) !== 1 ? 's' : ''}</Text>
              </View>
              <View style={s.cardRight}>
                {bal == null || Math.abs(bal) < 0.01 ? (
                  <Text style={s.settledText}>settled</Text>
                ) : bal > 0 ? (
                  <>
                    <Text style={s.owedLabel}>you're owed</Text>
                    <Text style={[s.balAmt, { color: COLORS.primary }]}>{symbol}{bal.toFixed(2)}</Text>
                  </>
                ) : (
                  <>
                    <Text style={s.owedLabel}>you owe</Text>
                    <Text style={[s.balAmt, { color: COLORS.danger }]}>{symbol}{Math.abs(bal).toFixed(2)}</Text>
                  </>
                )}
              </View>
            </TouchableOpacity>
          );
        })}
        <View style={{ height: 20 }} />
      </ScrollView>

      {/* Create Trip modal */}
      <Modal visible={showAdd} transparent animationType="slide" onRequestClose={() => setShowAdd(false)}>
        <View style={m.overlay}>
          <View style={m.sheet}>
            <Text style={m.title}>New Trip</Text>

            <Text style={m.label}>Trip Name</Text>
            <TextInput
              style={m.input} value={form.name} onChangeText={t => setForm(f => ({ ...f, name: t }))}
              placeholder="e.g. Goa Weekend" placeholderTextColor={COLORS.textMuted}
            />

            <Text style={m.label}>Icon</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
              {TRIP_EMOJIS.map(e => (
                <TouchableOpacity
                  key={e}
                  style={[m.emojiChip, form.emoji === e && m.emojiChipActive]}
                  onPress={() => setForm(f => ({ ...f, emoji: e }))}
                >
                  <Text style={{ fontSize: 20 }}>{e}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>

            <Text style={m.label}>Currency</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
              {CURRENCIES.map(c => (
                <TouchableOpacity
                  key={c.code}
                  style={[m.currChip, form.currency === c.code && m.currChipActive]}
                  onPress={() => setForm(f => ({ ...f, currency: c.code }))}
                >
                  <Text style={[m.currChipText, form.currency === c.code && { color: '#fff' }]}>{c.symbol} {c.code}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>

            <View style={{ flexDirection: 'row', gap: 10, marginTop: 16 }}>
              <TouchableOpacity style={m.cancelBtn} onPress={() => setShowAdd(false)}>
                <Text style={{ color: COLORS.textMuted }}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={m.saveBtn} onPress={handleCreate}>
                <Text style={{ color: '#fff', fontWeight: '700' }}>Create Trip</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Join Trip modal */}
      <Modal visible={showJoin} transparent animationType="slide" onRequestClose={() => setShowJoin(false)}>
        <View style={m.overlay}>
          <View style={m.sheet}>
            <Text style={m.title}>Join a Trip</Text>
            <Text style={m.label}>Invite Code</Text>
            <TextInput
              style={m.input} value={joinCode} onChangeText={setJoinCode}
              placeholder="e.g. a1b2c3d4" placeholderTextColor={COLORS.textMuted}
              autoCapitalize="none" autoCorrect={false}
            />
            {!!joinError && <Text style={{ color: COLORS.danger, fontSize: 13, marginTop: 8 }}>{joinError}</Text>}
            <View style={{ flexDirection: 'row', gap: 10, marginTop: 16 }}>
              <TouchableOpacity style={m.cancelBtn} onPress={() => { setShowJoin(false); setJoinError(''); setJoinCode(''); }}>
                <Text style={{ color: COLORS.textMuted }}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={m.saveBtn} onPress={handleJoin} disabled={joining}>
                <Text style={{ color: '#fff', fontWeight: '700' }}>{joining ? 'Joining…' : 'Join Trip'}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe:         { flex: 1, backgroundColor: COLORS.primary },
  topbar:       { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 14 },
  title:        { color: '#fff', fontSize: 18, fontWeight: '700' },
  joinBtn:      { color: '#fff', fontSize: 13, fontWeight: '600' },
  list:         { flex: 1, backgroundColor: COLORS.bg },
  emptyWrap:    { alignItems: 'center', paddingTop: 60, gap: 8 },
  emptyTitle:   { fontSize: 16, fontWeight: '600', color: COLORS.text },
  emptySub:     { fontSize: 13, color: COLORS.textMuted, textAlign: 'center', paddingHorizontal: 40 },
  card:         { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: COLORS.white, borderRadius: 14, padding: 14, marginBottom: 10, borderWidth: 0.5, borderColor: COLORS.border },
  cardIcon:     { width: 46, height: 46, borderRadius: 12, backgroundColor: COLORS.primaryLight, alignItems: 'center', justifyContent: 'center' },
  cardInfo:     { flex: 1 },
  cardName:     { fontSize: 15, fontWeight: '600', color: COLORS.text },
  cardSub:      { fontSize: 12, color: COLORS.textMuted, marginTop: 2 },
  cardRight:    { alignItems: 'flex-end' },
  owedLabel:    { fontSize: 10, color: COLORS.textMuted },
  balAmt:       { fontSize: 15, fontWeight: '700', marginTop: 1 },
  settledText:  { fontSize: 12, color: COLORS.textMuted, fontStyle: 'italic' },
});

const m = StyleSheet.create({
  overlay:        { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  sheet:          { backgroundColor: COLORS.white, borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 20, paddingBottom: 36 },
  title:          { fontSize: 17, fontWeight: '700', color: COLORS.text, marginBottom: 16 },
  label:          { fontSize: 11, fontWeight: '600', color: COLORS.textMuted, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 6, marginTop: 12 },
  input:          { borderWidth: 1.5, borderColor: COLORS.border, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10, fontSize: 15, color: COLORS.text, backgroundColor: COLORS.bg },
  emojiChip:      { width: 42, height: 42, borderRadius: 10, borderWidth: 0.5, borderColor: COLORS.border, alignItems: 'center', justifyContent: 'center' },
  emojiChipActive:{ backgroundColor: COLORS.primaryLight, borderColor: COLORS.primary },
  currChip:       { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 10, borderWidth: 0.5, borderColor: COLORS.border },
  currChipActive: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  currChipText:   { fontSize: 12, color: COLORS.textMuted, fontWeight: '600' },
  cancelBtn:      { flex: 1, borderWidth: 0.5, borderColor: COLORS.border, borderRadius: 10, padding: 13, alignItems: 'center' },
  saveBtn:        { flex: 2, backgroundColor: COLORS.primary, borderRadius: 10, padding: 13, alignItems: 'center' },
});
