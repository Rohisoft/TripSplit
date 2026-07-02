import React, { useState, useMemo } from 'react';
import {
  View, Text, TextInput, ScrollView, TouchableOpacity,
  StyleSheet, SafeAreaView, StatusBar, KeyboardAvoidingView, Platform,
} from 'react-native';
import { COLORS, currencySymbol } from '../data/constants';
import { useStore } from '../store/useStore';

export default function SettleUpScreen({ route, navigation }) {
  const { tripId, fromMemberId, toMemberId, amount: prefillAmount } = route.params;
  const { state, dispatch } = useStore();

  const trip = state.trips.find(t => t.id === tripId);
  const members = useMemo(() => state.tripMembers.filter(m => m.tripId === tripId), [state.tripMembers, tripId]);
  const symbol = currencySymbol(trip?.currency || 'USD');

  const [fromMember, setFromMember] = useState(fromMemberId || members[0]?.id || '');
  const [toMember, setToMember]     = useState(toMemberId || members[1]?.id || members[0]?.id || '');
  const [amount, setAmount]         = useState(prefillAmount ? String(prefillAmount) : '');
  const [date, setDate]             = useState(new Date().toISOString().slice(0, 10));
  const [note, setNote]             = useState('');
  const [error, setError]           = useState('');

  const handleSave = () => {
    const amt = parseFloat(amount);
    if (!fromMember || !toMember) return setError('Select who paid and who received');
    if (fromMember === toMember)  return setError('From and to must be different people');
    if (!amt || amt <= 0)         return setError('Enter a valid amount');

    dispatch({
      type: 'ADD_SETTLEMENT',
      settlement: {
        id: crypto.randomUUID(), tripId, fromMember, toMember,
        amount: amt, note: note.trim(), settledAt: new Date(date).toISOString(),
      },
    });
    navigation.goBack();
  };

  return (
    <SafeAreaView style={s.safe}>
      <StatusBar backgroundColor={COLORS.primary} barStyle="light-content" />
      <View style={s.topbar}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Text style={s.backBtn}>✕</Text>
        </TouchableOpacity>
        <Text style={s.title}>Record Payment</Text>
        <View style={{ width: 24 }} />
      </View>

      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
        <ScrollView style={s.scroll} contentContainerStyle={{ padding: 16, paddingBottom: 40 }} showsVerticalScrollIndicator={false}>

          <Text style={s.label}>Who paid</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
            {members.map(m => (
              <TouchableOpacity
                key={m.id} style={[s.chip, fromMember === m.id && s.chipActive]}
                onPress={() => setFromMember(m.id)}
              >
                <Text style={[s.chipText, fromMember === m.id && { color: '#fff' }]}>{m.avatarEmoji} {m.displayName}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>

          <Text style={s.label}>Who received</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
            {members.map(m => (
              <TouchableOpacity
                key={m.id} style={[s.chip, toMember === m.id && s.chipActive]}
                onPress={() => setToMember(m.id)}
              >
                <Text style={[s.chipText, toMember === m.id && { color: '#fff' }]}>{m.avatarEmoji} {m.displayName}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>

          <Text style={s.label}>Amount</Text>
          <View style={s.amountRow}>
            <Text style={s.amountSymbol}>{symbol}</Text>
            <TextInput
              style={s.amountInput} value={amount} onChangeText={setAmount}
              placeholder="0.00" placeholderTextColor={COLORS.textMuted} keyboardType="decimal-pad"
            />
          </View>

          <Text style={s.label}>Date</Text>
          <TextInput style={s.input} value={date} onChangeText={setDate} placeholder="YYYY-MM-DD" placeholderTextColor={COLORS.textMuted} />

          <Text style={s.label}>Note</Text>
          <TextInput style={s.input} value={note} onChangeText={setNote} placeholder="Optional" placeholderTextColor={COLORS.textMuted} />

          {!!error && <Text style={s.error}>{error}</Text>}

          <TouchableOpacity style={s.saveBtn} onPress={handleSave}>
            <Text style={s.saveBtnText}>✓ Record Payment</Text>
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe:         { flex: 1, backgroundColor: COLORS.primary },
  topbar:       { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 14 },
  backBtn:      { color: '#fff', fontSize: 18 },
  title:        { color: '#fff', fontSize: 16, fontWeight: '700' },
  scroll:       { flex: 1, backgroundColor: COLORS.bg, borderTopLeftRadius: 20, borderTopRightRadius: 20 },
  label:        { fontSize: 11, fontWeight: '600', color: COLORS.textMuted, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 6, marginTop: 16 },
  chip:         { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 20, borderWidth: 0.5, borderColor: COLORS.border, backgroundColor: COLORS.white },
  chipActive:   { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  chipText:     { fontSize: 12, color: COLORS.textMuted, fontWeight: '500' },
  amountRow:    { flexDirection: 'row', alignItems: 'center', borderWidth: 1.5, borderColor: COLORS.primary, borderRadius: 10, paddingHorizontal: 12, backgroundColor: COLORS.white },
  amountSymbol: { fontSize: 20, color: COLORS.primary, fontWeight: '700', marginRight: 6 },
  amountInput:  { flex: 1, fontSize: 22, fontWeight: '700', color: COLORS.text, paddingVertical: 10 },
  input:        { borderWidth: 1.5, borderColor: COLORS.border, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10, fontSize: 15, color: COLORS.text, backgroundColor: COLORS.white },
  error:        { color: COLORS.danger, fontSize: 13, marginTop: 16, textAlign: 'center' },
  saveBtn:      { backgroundColor: COLORS.primary, borderRadius: 12, padding: 15, alignItems: 'center', marginTop: 24 },
  saveBtnText:  { color: '#fff', fontWeight: '700', fontSize: 15 },
});
