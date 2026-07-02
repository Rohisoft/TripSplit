import React, { useState, useMemo } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity,
  StyleSheet, SafeAreaView, StatusBar, Modal,
} from 'react-native';
import { COLORS, currencySymbol, categoryIcon } from '../data/constants';
import { useStore } from '../store/useStore';
import { useAuth } from '../auth/AuthContext';
import { computeBalances, simplifyDebts } from '../utils/settleUp';

function groupByDate(expenses) {
  const groups = {};
  expenses.forEach(e => {
    const key = e.expenseDate;
    if (!groups[key]) groups[key] = [];
    groups[key].push(e);
  });
  return Object.entries(groups).sort((a, b) => (a[0] < b[0] ? 1 : -1));
}

function formatDate(iso) {
  return new Date(iso).toLocaleDateString('en-US', { weekday: 'short', day: 'numeric', month: 'short' });
}

export default function TripDetailScreen({ route, navigation }) {
  const { tripId } = route.params;
  const { state } = useStore();
  const { user } = useAuth();
  const [view, setView] = useState('expenses'); // 'expenses' | 'balances'
  const [showShare, setShowShare] = useState(false);

  const trip = state.trips.find(t => t.id === tripId);
  const members = useMemo(() => state.tripMembers.filter(m => m.tripId === tripId), [state.tripMembers, tripId]);
  const expenses = useMemo(() =>
    state.expenses.filter(e => e.tripId === tripId).sort((a, b) => (a.expenseDate < b.expenseDate ? 1 : -1)),
    [state.expenses, tripId]);
  const splits = useMemo(() => state.expenseSplits.filter(s => s.tripId === tripId), [state.expenseSplits, tripId]);
  const settlements = useMemo(() => state.settlements.filter(s => s.tripId === tripId), [state.settlements, tripId]);

  const memberById = useMemo(() => Object.fromEntries(members.map(m => [m.id, m])), [members]);
  const symbol = currencySymbol(trip?.currency || 'USD');

  const balances = useMemo(() => computeBalances(members, expenses, splits, settlements), [members, expenses, splits, settlements]);
  const suggestions = useMemo(() => simplifyDebts(balances), [balances]);

  const total = expenses.reduce((s, e) => s + e.amount, 0);
  const dateGroups = groupByDate(expenses);

  const inviteLink = typeof window !== 'undefined' && trip
    ? `${window.location.origin}${window.location.pathname}?code=${trip.inviteCode}`
    : '';

  const copyLink = () => {
    if (typeof navigator !== 'undefined' && navigator.clipboard) {
      navigator.clipboard.writeText(inviteLink);
    }
  };

  if (!trip) {
    return (
      <SafeAreaView style={s.safe}>
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <Text style={{ color: COLORS.textMuted }}>Trip not found</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={s.safe}>
      <StatusBar backgroundColor={COLORS.primary} barStyle="light-content" />

      <View style={s.topbar}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Text style={s.backBtn}>← Back</Text>
        </TouchableOpacity>
        <Text style={s.title} numberOfLines={1}>{trip.emoji} {trip.name}</Text>
        <TouchableOpacity onPress={() => setShowShare(true)}>
          <Text style={s.shareBtn}>Invite</Text>
        </TouchableOpacity>
      </View>

      <View style={s.summaryBar}>
        <Text style={s.summaryText}>Total spent: {symbol}{total.toFixed(2)} · {members.length} member{members.length !== 1 ? 's' : ''}</Text>
        <TouchableOpacity onPress={() => navigation.navigate('TripMembers', { tripId })}>
          <Text style={s.membersLink}>Members ›</Text>
        </TouchableOpacity>
      </View>

      <View style={s.segmentRow}>
        <TouchableOpacity style={[s.segment, view === 'expenses' && s.segmentActive]} onPress={() => setView('expenses')}>
          <Text style={[s.segmentText, view === 'expenses' && s.segmentTextActive]}>Expenses</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[s.segment, view === 'balances' && s.segmentActive]} onPress={() => setView('balances')}>
          <Text style={[s.segmentText, view === 'balances' && s.segmentTextActive]}>Balances</Text>
        </TouchableOpacity>
      </View>

      {view === 'expenses' ? (
        <ScrollView style={s.list} showsVerticalScrollIndicator={false} contentContainerStyle={{ padding: 12, paddingBottom: 90 }}>
          {expenses.length === 0 ? (
            <View style={s.emptyWrap}>
              <Text style={{ fontSize: 40 }}>🧾</Text>
              <Text style={s.emptyTitle}>No expenses yet</Text>
              <Text style={s.emptySub}>Tap + to add the first one</Text>
            </View>
          ) : dateGroups.map(([date, items]) => (
            <View key={date} style={{ marginBottom: 14 }}>
              <Text style={s.dateHeader}>{formatDate(date)}</Text>
              {items.map(e => {
                const payer = memberById[e.paidBy];
                return (
                  <TouchableOpacity
                    key={e.id}
                    style={s.expenseRow}
                    onPress={() => navigation.navigate('AddEditExpense', { tripId, expenseId: e.id })}
                  >
                    <Text style={s.expenseIcon}>{categoryIcon(e.category)}</Text>
                    <View style={{ flex: 1 }}>
                      <Text style={s.expenseDesc}>{e.description}</Text>
                      <Text style={s.expenseSub}>{payer?.displayName || 'Someone'} paid</Text>
                    </View>
                    <Text style={s.expenseAmt}>{symbol}{e.amount.toFixed(2)}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          ))}
        </ScrollView>
      ) : (
        <ScrollView style={s.list} showsVerticalScrollIndicator={false} contentContainerStyle={{ padding: 12, paddingBottom: 90 }}>
          <Text style={s.sectionTitle}>Net balances</Text>
          <View style={s.card}>
            {members.map((m, i) => {
              const bal = balances[m.id] || 0;
              return (
                <View key={m.id} style={[s.balRow, i > 0 && s.balRowBorder]}>
                  <Text style={s.balName}>{m.displayName}{m.userId === user?.id ? ' (you)' : ''}</Text>
                  {Math.abs(bal) < 0.01 ? (
                    <Text style={s.balSettled}>settled</Text>
                  ) : (
                    <Text style={[s.balAmt, { color: bal > 0 ? COLORS.primary : COLORS.danger }]}>
                      {bal > 0 ? '+' : '−'}{symbol}{Math.abs(bal).toFixed(2)}
                    </Text>
                  )}
                </View>
              );
            })}
          </View>

          <Text style={s.sectionTitle}>Suggested settlements</Text>
          {suggestions.length === 0 ? (
            <Text style={s.emptySub}>Everyone is settled up 🎉</Text>
          ) : (
            <View style={s.card}>
              {suggestions.map((tx, i) => (
                <TouchableOpacity
                  key={i}
                  style={[s.suggestRow, i > 0 && s.balRowBorder]}
                  onPress={() => navigation.navigate('SettleUp', {
                    tripId, fromMemberId: tx.from, toMemberId: tx.to, amount: tx.amount,
                  })}
                >
                  <Text style={s.suggestText}>
                    {memberById[tx.from]?.displayName} → {memberById[tx.to]?.displayName}
                  </Text>
                  <Text style={s.suggestAmt}>{symbol}{tx.amount.toFixed(2)}</Text>
                </TouchableOpacity>
              ))}
            </View>
          )}

          <TouchableOpacity style={s.settleBtn} onPress={() => navigation.navigate('SettleUp', { tripId })}>
            <Text style={s.settleBtnText}>💸 Record a Payment</Text>
          </TouchableOpacity>
        </ScrollView>
      )}

      {view === 'expenses' && (
        <TouchableOpacity style={s.fab} onPress={() => navigation.navigate('AddEditExpense', { tripId })}>
          <Text style={s.fabText}>＋</Text>
        </TouchableOpacity>
      )}

      {/* Share/invite modal */}
      <Modal visible={showShare} transparent animationType="slide" onRequestClose={() => setShowShare(false)}>
        <View style={m.overlay}>
          <View style={m.sheet}>
            <Text style={m.title}>Invite to {trip.name}</Text>
            <Text style={m.label}>Invite Code</Text>
            <View style={m.codeBox}><Text style={m.codeText}>{trip.inviteCode}</Text></View>
            <TouchableOpacity style={m.copyBtn} onPress={copyLink}>
              <Text style={m.copyBtnText}>📋 Copy Invite Link</Text>
            </TouchableOpacity>
            <Text style={m.hint}>Anyone with this link can join the trip after signing in.</Text>
            <TouchableOpacity style={m.closeBtn} onPress={() => setShowShare(false)}>
              <Text style={{ color: COLORS.textMuted }}>Close</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe:            { flex: 1, backgroundColor: COLORS.primary },
  topbar:          { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 12 },
  backBtn:         { color: '#fff', fontSize: 13 },
  title:           { color: '#fff', fontSize: 16, fontWeight: '700', flex: 1, textAlign: 'center', marginHorizontal: 8 },
  shareBtn:        { color: '#fff', fontSize: 13, fontWeight: '600' },
  summaryBar:      { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 16, paddingBottom: 10 },
  summaryText:     { color: 'rgba(255,255,255,0.85)', fontSize: 12 },
  membersLink:     { color: '#fff', fontSize: 12, fontWeight: '600' },
  segmentRow:      { flexDirection: 'row', backgroundColor: COLORS.white, marginHorizontal: 16, borderRadius: 10, padding: 3, marginBottom: 8 },
  segment:         { flex: 1, paddingVertical: 8, borderRadius: 8, alignItems: 'center' },
  segmentActive:   { backgroundColor: COLORS.primary },
  segmentText:     { fontSize: 13, fontWeight: '600', color: COLORS.textMuted },
  segmentTextActive: { color: '#fff' },
  list:            { flex: 1, backgroundColor: COLORS.bg, borderTopLeftRadius: 20, borderTopRightRadius: 20 },
  emptyWrap:       { alignItems: 'center', paddingTop: 60, gap: 8 },
  emptyTitle:      { fontSize: 15, fontWeight: '600', color: COLORS.text },
  emptySub:        { fontSize: 13, color: COLORS.textMuted, textAlign: 'center' },
  dateHeader:      { fontSize: 11, fontWeight: '700', color: COLORS.textMuted, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 6, marginLeft: 2 },
  expenseRow:      { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: COLORS.white, borderRadius: 12, padding: 12, marginBottom: 6, borderWidth: 0.5, borderColor: COLORS.border },
  expenseIcon:     { fontSize: 20 },
  expenseDesc:     { fontSize: 14, fontWeight: '500', color: COLORS.text },
  expenseSub:      { fontSize: 11, color: COLORS.textMuted, marginTop: 1 },
  expenseAmt:      { fontSize: 14, fontWeight: '700', color: COLORS.text },
  sectionTitle:    { fontSize: 13, fontWeight: '700', color: COLORS.textMuted, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 8, marginTop: 4 },
  card:            { backgroundColor: COLORS.white, borderRadius: 14, borderWidth: 0.5, borderColor: COLORS.border, overflow: 'hidden', marginBottom: 16 },
  balRow:          { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 14, paddingVertical: 12 },
  balRowBorder:    { borderTopWidth: 0.5, borderTopColor: COLORS.border },
  balName:         { fontSize: 14, color: COLORS.text },
  balAmt:          { fontSize: 14, fontWeight: '700' },
  balSettled:      { fontSize: 12, color: COLORS.textMuted, fontStyle: 'italic' },
  suggestRow:      { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 14, paddingVertical: 12 },
  suggestText:     { fontSize: 13, color: COLORS.text },
  suggestAmt:      { fontSize: 13, fontWeight: '700', color: COLORS.primary },
  settleBtn:       { backgroundColor: COLORS.primary, borderRadius: 12, padding: 15, alignItems: 'center' },
  settleBtnText:   { color: '#fff', fontWeight: '700', fontSize: 15 },
  fab:             { position: 'absolute', right: 20, bottom: 24, width: 54, height: 54, borderRadius: 27, backgroundColor: COLORS.primary, alignItems: 'center', justifyContent: 'center', shadowColor: '#000', shadowOpacity: 0.25, shadowRadius: 8, elevation: 6 },
  fabText:         { color: '#fff', fontSize: 26, fontWeight: '300', lineHeight: 28 },
});

const m = StyleSheet.create({
  overlay:    { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  sheet:      { backgroundColor: COLORS.white, borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 20, paddingBottom: 36 },
  title:      { fontSize: 17, fontWeight: '700', color: COLORS.text, marginBottom: 16 },
  label:      { fontSize: 11, fontWeight: '600', color: COLORS.textMuted, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 6 },
  codeBox:    { backgroundColor: COLORS.bg, borderRadius: 10, borderWidth: 1, borderColor: COLORS.border, padding: 16, alignItems: 'center', marginBottom: 14 },
  codeText:   { fontSize: 24, fontWeight: '800', letterSpacing: 3, color: COLORS.primary },
  copyBtn:    { backgroundColor: COLORS.primary, borderRadius: 10, padding: 13, alignItems: 'center' },
  copyBtnText:{ color: '#fff', fontWeight: '700', fontSize: 14 },
  hint:       { fontSize: 12, color: COLORS.textMuted, textAlign: 'center', marginTop: 10 },
  closeBtn:   { marginTop: 16, padding: 12, alignItems: 'center' },
});
