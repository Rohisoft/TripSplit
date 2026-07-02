import React, { useState, useMemo, useEffect } from 'react';
import {
  View, Text, TextInput, ScrollView, TouchableOpacity,
  StyleSheet, SafeAreaView, StatusBar, Alert, KeyboardAvoidingView, Platform,
} from 'react-native';
import { COLORS, CATEGORIES, currencySymbol } from '../data/constants';
import { useStore } from '../store/useStore';
import { calculateSplits } from '../utils/splitCalculator';

const SPLIT_TYPES = [
  { id: 'equal',      label: 'Equal' },
  { id: 'exact',      label: 'Exact' },
  { id: 'percentage', label: '%' },
  { id: 'shares',     label: 'Shares' },
];

export default function AddEditExpenseScreen({ route, navigation }) {
  const { tripId, expenseId } = route.params;
  const { state, dispatch } = useStore();

  const trip = state.trips.find(t => t.id === tripId);
  const members = useMemo(() => state.tripMembers.filter(m => m.tripId === tripId), [state.tripMembers, tripId]);
  const symbol = currencySymbol(trip?.currency || 'USD');

  const existing = expenseId ? state.expenses.find(e => e.id === expenseId) : null;
  const existingSplits = expenseId ? state.expenseSplits.filter(s => s.expenseId === expenseId) : [];

  const [description, setDescription] = useState(existing?.description || '');
  const [amount, setAmount]           = useState(existing ? String(existing.amount) : '');
  const [category, setCategory]       = useState(existing?.category || 'general');
  const [paidBy, setPaidBy]           = useState(existing?.paidBy || members[0]?.id || '');
  const [splitType, setSplitType]     = useState(existing?.splitType || 'equal');
  const [date, setDate]               = useState(existing?.expenseDate || new Date().toISOString().slice(0, 10));
  const [notes, setNotes]             = useState(existing?.notes || '');
  const [error, setError]             = useState('');

  const [selected, setSelected] = useState(() => {
    if (existingSplits.length) return new Set(existingSplits.map(s => s.tripMemberId));
    return new Set(members.map(m => m.id));
  });
  const [values, setValues] = useState(() => {
    const v = {};
    existingSplits.forEach(s => { v[s.tripMemberId] = s.shareValue != null ? String(s.shareValue) : ''; });
    return v;
  });

  useEffect(() => {
    if (!paidBy && members.length) setPaidBy(members[0].id);
  }, [members]);

  const toggleMember = (id) => {
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const runningTotal = useMemo(() => {
    if (splitType === 'exact') {
      return [...selected].reduce((s, id) => s + (Number(values[id]) || 0), 0);
    }
    if (splitType === 'percentage') {
      return [...selected].reduce((s, id) => s + (Number(values[id]) || 0), 0);
    }
    return null;
  }, [splitType, selected, values]);

  const handleSave = () => {
    const amt = parseFloat(amount);
    if (!description.trim()) return setError('Enter a description');
    if (!amt || amt <= 0)     return setError('Enter a valid amount');
    if (!paidBy)              return setError('Select who paid');
    if (selected.size === 0)  return setError('Select at least one member to split with');

    setError('');
    try {
      const memberInputs = [...selected].map(id => ({ tripMemberId: id, value: values[id] }));
      const resolvedSplits = calculateSplits(amt, splitType, memberInputs);

      const expenseIdFinal = expenseId || crypto.randomUUID();
      const expense = {
        id: expenseIdFinal, tripId, description: description.trim(), amount: amt,
        category, paidBy, splitType, expenseDate: date, notes: notes.trim(),
      };
      const splits = resolvedSplits.map(s => ({
        id: crypto.randomUUID(), expenseId: expenseIdFinal, tripId, ...s,
      }));

      dispatch({ type: expenseId ? 'UPDATE_EXPENSE' : 'ADD_EXPENSE', expense, splits });
      navigation.goBack();
    } catch (e) {
      setError(e.message);
    }
  };

  const handleDelete = () => {
    const doDelete = () => { dispatch({ type: 'DELETE_EXPENSE', expenseId }); navigation.goBack(); };
    if (typeof window !== 'undefined') {
      if (window.confirm('Delete this expense?')) doDelete();
    } else {
      Alert.alert('Delete Expense', 'Are you sure?', [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Delete', style: 'destructive', onPress: doDelete },
      ]);
    }
  };

  return (
    <SafeAreaView style={s.safe}>
      <StatusBar backgroundColor={COLORS.primary} barStyle="light-content" />
      <View style={s.topbar}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Text style={s.backBtn}>✕</Text>
        </TouchableOpacity>
        <Text style={s.title}>{expenseId ? 'Edit Expense' : 'Add Expense'}</Text>
        <View style={{ width: 24 }} />
      </View>

      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
        <ScrollView style={s.scroll} contentContainerStyle={{ padding: 16, paddingBottom: 40 }} showsVerticalScrollIndicator={false}>

          <Text style={s.label}>Description</Text>
          <TextInput
            style={s.input} value={description} onChangeText={setDescription}
            placeholder="e.g. Dinner at the beach shack" placeholderTextColor={COLORS.textMuted}
          />

          <Text style={s.label}>Amount</Text>
          <View style={s.amountRow}>
            <Text style={s.amountSymbol}>{symbol}</Text>
            <TextInput
              style={s.amountInput} value={amount} onChangeText={setAmount}
              placeholder="0.00" placeholderTextColor={COLORS.textMuted} keyboardType="decimal-pad"
            />
          </View>

          <Text style={s.label}>Category</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
            {CATEGORIES.map(c => (
              <TouchableOpacity
                key={c.id} style={[s.catChip, category === c.id && s.catChipActive]}
                onPress={() => setCategory(c.id)}
              >
                <Text style={{ fontSize: 14 }}>{c.icon}</Text>
                <Text style={[s.catChipText, category === c.id && { color: '#fff' }]}>{c.label}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>

          <Text style={s.label}>Paid by</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
            {members.map(m => (
              <TouchableOpacity
                key={m.id} style={[s.memberChip, paidBy === m.id && s.memberChipActive]}
                onPress={() => setPaidBy(m.id)}
              >
                <Text style={[s.memberChipText, paidBy === m.id && { color: '#fff' }]}>{m.avatarEmoji} {m.displayName}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>

          <Text style={s.label}>Split</Text>
          <View style={s.segmentRow}>
            {SPLIT_TYPES.map(t => (
              <TouchableOpacity
                key={t.id} style={[s.segment, splitType === t.id && s.segmentActive]}
                onPress={() => setSplitType(t.id)}
              >
                <Text style={[s.segmentText, splitType === t.id && s.segmentTextActive]}>{t.label}</Text>
              </TouchableOpacity>
            ))}
          </View>

          <Text style={s.label}>Split with</Text>
          <View style={s.card}>
            {members.map((m, i) => (
              <View key={m.id} style={[s.memberRow, i > 0 && s.memberRowBorder]}>
                <TouchableOpacity style={s.checkRow} onPress={() => toggleMember(m.id)}>
                  <View style={[s.checkbox, selected.has(m.id) && s.checkboxActive]}>
                    {selected.has(m.id) && <Text style={{ color: '#fff', fontSize: 11 }}>✓</Text>}
                  </View>
                  <Text style={s.memberName}>{m.avatarEmoji} {m.displayName}</Text>
                </TouchableOpacity>
                {selected.has(m.id) && splitType !== 'equal' && (
                  <TextInput
                    style={s.shareInput}
                    value={values[m.id] || ''}
                    onChangeText={t => setValues(v => ({ ...v, [m.id]: t }))}
                    keyboardType="decimal-pad"
                    placeholder={splitType === 'shares' ? '1' : '0'}
                    placeholderTextColor={COLORS.textMuted}
                  />
                )}
              </View>
            ))}
          </View>
          {runningTotal != null && (
            <Text style={s.runningTotal}>
              {splitType === 'exact'
                ? `Total: ${symbol}${runningTotal.toFixed(2)} of ${symbol}${(parseFloat(amount) || 0).toFixed(2)}`
                : `Total: ${runningTotal.toFixed(1)}% of 100%`}
            </Text>
          )}

          <Text style={s.label}>Date</Text>
          <TextInput style={s.input} value={date} onChangeText={setDate} placeholder="YYYY-MM-DD" placeholderTextColor={COLORS.textMuted} />

          <Text style={s.label}>Notes</Text>
          <TextInput style={s.input} value={notes} onChangeText={setNotes} placeholder="Optional" placeholderTextColor={COLORS.textMuted} multiline />

          {!!error && <Text style={s.error}>{error}</Text>}

          <TouchableOpacity style={s.saveBtn} onPress={handleSave}>
            <Text style={s.saveBtnText}>{expenseId ? 'Save Changes' : 'Add Expense'}</Text>
          </TouchableOpacity>

          {expenseId && (
            <TouchableOpacity style={s.deleteBtn} onPress={handleDelete}>
              <Text style={s.deleteBtnText}>Delete Expense</Text>
            </TouchableOpacity>
          )}
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
  input:        { borderWidth: 1.5, borderColor: COLORS.border, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10, fontSize: 15, color: COLORS.text, backgroundColor: COLORS.white },
  amountRow:    { flexDirection: 'row', alignItems: 'center', borderWidth: 1.5, borderColor: COLORS.primary, borderRadius: 10, paddingHorizontal: 12, backgroundColor: COLORS.white },
  amountSymbol: { fontSize: 20, color: COLORS.primary, fontWeight: '700', marginRight: 6 },
  amountInput:  { flex: 1, fontSize: 22, fontWeight: '700', color: COLORS.text, paddingVertical: 10 },
  catChip:      { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 20, borderWidth: 0.5, borderColor: COLORS.border, backgroundColor: COLORS.white },
  catChipActive:{ backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  catChipText:  { fontSize: 12, color: COLORS.textMuted, fontWeight: '500' },
  memberChip:   { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 20, borderWidth: 0.5, borderColor: COLORS.border, backgroundColor: COLORS.white },
  memberChipActive: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  memberChipText: { fontSize: 12, color: COLORS.textMuted, fontWeight: '500' },
  segmentRow:   { flexDirection: 'row', backgroundColor: COLORS.white, borderRadius: 10, padding: 3, borderWidth: 0.5, borderColor: COLORS.border },
  segment:      { flex: 1, paddingVertical: 8, borderRadius: 8, alignItems: 'center' },
  segmentActive:{ backgroundColor: COLORS.primary },
  segmentText:  { fontSize: 12, fontWeight: '600', color: COLORS.textMuted },
  segmentTextActive: { color: '#fff' },
  card:         { backgroundColor: COLORS.white, borderRadius: 12, borderWidth: 0.5, borderColor: COLORS.border, overflow: 'hidden' },
  memberRow:    { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 12, paddingVertical: 10 },
  memberRowBorder: { borderTopWidth: 0.5, borderTopColor: COLORS.border },
  checkRow:     { flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1 },
  checkbox:     { width: 20, height: 20, borderRadius: 5, borderWidth: 1.5, borderColor: COLORS.border, alignItems: 'center', justifyContent: 'center' },
  checkboxActive: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  memberName:   { fontSize: 13, color: COLORS.text },
  shareInput:   { width: 64, borderWidth: 1, borderColor: COLORS.border, borderRadius: 8, paddingHorizontal: 8, paddingVertical: 6, fontSize: 13, color: COLORS.text, textAlign: 'right', backgroundColor: COLORS.bg },
  runningTotal: { fontSize: 12, color: COLORS.textMuted, marginTop: 6, textAlign: 'right' },
  error:        { color: COLORS.danger, fontSize: 13, marginTop: 16, textAlign: 'center' },
  saveBtn:      { backgroundColor: COLORS.primary, borderRadius: 12, padding: 15, alignItems: 'center', marginTop: 20 },
  saveBtnText:  { color: '#fff', fontWeight: '700', fontSize: 15 },
  deleteBtn:    { marginTop: 12, padding: 13, alignItems: 'center' },
  deleteBtnText:{ color: COLORS.danger, fontWeight: '600', fontSize: 13 },
});
