import React, { useState } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity,
  StyleSheet, SafeAreaView, StatusBar, TextInput, Alert, Modal,
} from 'react-native';
import { COLORS, AVATAR_EMOJIS, CURRENCIES } from '../data/constants';
import { useAuth } from '../auth/AuthContext';
import { supabase } from '../lib/supabase';

export default function ProfileScreen() {
  const { user, profile, logout, refreshProfile } = useAuth();

  const [showEdit, setShowEdit] = useState(false);
  const [saving,   setSaving]   = useState(false);
  const [form, setForm] = useState({
    displayName: profile?.display_name || '',
    avatarEmoji: profile?.avatar_emoji || '🙂',
    defaultCurrency: profile?.default_currency || 'USD',
  });

  const openEdit = () => {
    setForm({
      displayName: profile?.display_name || '',
      avatarEmoji: profile?.avatar_emoji || '🙂',
      defaultCurrency: profile?.default_currency || 'USD',
    });
    setShowEdit(true);
  };

  const handleSave = async () => {
    if (!form.displayName.trim()) {
      Alert.alert('Required', 'Name cannot be empty.');
      return;
    }
    setSaving(true);
    try {
      await supabase.from('user_profiles').update({
        display_name: form.displayName.trim(),
        avatar_emoji: form.avatarEmoji,
        default_currency: form.defaultCurrency,
      }).eq('id', user.id);
      await refreshProfile();
      setShowEdit(false);
    } catch (e) {
      Alert.alert('Error', 'Could not save. Try again.');
    } finally {
      setSaving(false);
    }
  };

  const handleLogout = () => {
    if (typeof window !== 'undefined') {
      if (window.confirm('Are you sure you want to sign out?')) logout();
    } else {
      Alert.alert('Sign Out', 'Are you sure you want to sign out?', [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Sign Out', style: 'destructive', onPress: logout },
      ]);
    }
  };

  return (
    <SafeAreaView style={s.safe}>
      <StatusBar backgroundColor={COLORS.primary} barStyle="light-content" />

      <View style={s.topbar}>
        <Text style={s.title}>👤 My Profile</Text>
      </View>

      <ScrollView style={s.scroll} showsVerticalScrollIndicator={false}>

        <View style={s.avatarWrap}>
          <View style={s.avatarCircle}><Text style={{ fontSize: 40 }}>{profile?.avatar_emoji || '🙂'}</Text></View>
          <Text style={s.avatarName}>{profile?.display_name || '—'}</Text>
        </View>

        <View style={s.section}>
          <View style={s.sectionHeader}>
            <Text style={s.sectionTitle}>Account</Text>
            <TouchableOpacity style={s.editBtn} onPress={openEdit}>
              <Text style={s.editBtnText}>✏️ Edit</Text>
            </TouchableOpacity>
          </View>
          <View style={s.card}>
            <InfoRow label="Name" value={profile?.display_name || '—'} />
            <InfoRow label="Email" value={user?.email || '—'} />
            <InfoRow label="Default Currency" value={profile?.default_currency || 'USD'} last />
          </View>
        </View>

        <View style={s.section}>
          <TouchableOpacity style={s.logoutBtn} onPress={handleLogout}>
            <Text style={s.logoutText}>⏻  Sign Out</Text>
          </TouchableOpacity>
        </View>

        <View style={{ alignItems: 'center', paddingBottom: 24 }}>
          <Text style={{ fontSize: 10, color: COLORS.border, letterSpacing: 0.3 }}>Powered by VRNDAI · vrndai.com</Text>
        </View>
      </ScrollView>

      <Modal visible={showEdit} transparent animationType="slide" onRequestClose={() => setShowEdit(false)}>
        <View style={m.overlay}>
          <ScrollView>
            <View style={m.sheet}>
              <View style={m.sheetHeader}>
                <Text style={m.sheetTitle}>Edit Profile</Text>
                <TouchableOpacity onPress={() => setShowEdit(false)}>
                  <Text style={{ color: COLORS.textMuted, fontSize: 22 }}>✕</Text>
                </TouchableOpacity>
              </View>

              <Text style={m.label}>Name</Text>
              <TextInput style={m.input} value={form.displayName} onChangeText={t => setForm(f => ({ ...f, displayName: t }))} placeholder="Your name" placeholderTextColor={COLORS.textMuted} />

              <Text style={m.label}>Avatar</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
                {AVATAR_EMOJIS.map(e => (
                  <TouchableOpacity
                    key={e} style={[m.emojiChip, form.avatarEmoji === e && m.emojiChipActive]}
                    onPress={() => setForm(f => ({ ...f, avatarEmoji: e }))}
                  >
                    <Text style={{ fontSize: 20 }}>{e}</Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>

              <Text style={m.label}>Default Currency</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
                {CURRENCIES.map(c => (
                  <TouchableOpacity
                    key={c.code} style={[m.currChip, form.defaultCurrency === c.code && m.currChipActive]}
                    onPress={() => setForm(f => ({ ...f, defaultCurrency: c.code }))}
                  >
                    <Text style={[m.currChipText, form.defaultCurrency === c.code && { color: '#fff' }]}>{c.symbol} {c.code}</Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>

              <View style={{ flexDirection: 'row', gap: 10, marginTop: 20 }}>
                <TouchableOpacity style={m.cancelBtn} onPress={() => setShowEdit(false)}>
                  <Text style={{ color: COLORS.textMuted, fontWeight: '500' }}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[m.saveBtn, saving && { opacity: 0.6 }]} onPress={handleSave} disabled={saving}>
                  <Text style={{ color: '#fff', fontWeight: '700' }}>{saving ? 'Saving…' : 'Save Changes'}</Text>
                </TouchableOpacity>
              </View>
            </View>
          </ScrollView>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

function InfoRow({ label, value, last }) {
  return (
    <View style={[r.row, last && r.rowLast]}>
      <Text style={r.label}>{label}</Text>
      <Text style={r.value} numberOfLines={2}>{value}</Text>
    </View>
  );
}

const s = StyleSheet.create({
  safe:         { flex: 1, backgroundColor: COLORS.primary },
  topbar:       { backgroundColor: COLORS.primary, paddingHorizontal: 16, paddingVertical: 14 },
  title:        { color: '#fff', fontSize: 18, fontWeight: '700' },
  scroll:       { flex: 1, backgroundColor: COLORS.bg },
  avatarWrap:   { alignItems: 'center', paddingTop: 24, paddingBottom: 8 },
  avatarCircle: { width: 84, height: 84, borderRadius: 42, backgroundColor: COLORS.primaryLight, alignItems: 'center', justifyContent: 'center', marginBottom: 10 },
  avatarName:   { fontSize: 17, fontWeight: '700', color: COLORS.text },
  section:      { paddingHorizontal: 16, paddingTop: 20 },
  sectionHeader:{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  sectionTitle: { fontSize: 13, fontWeight: '700', color: COLORS.textMuted, textTransform: 'uppercase', letterSpacing: 0.5 },
  card:         { backgroundColor: COLORS.white, borderRadius: 14, borderWidth: 0.5, borderColor: COLORS.border, overflow: 'hidden' },
  editBtn:      { backgroundColor: COLORS.primary, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 5 },
  editBtnText:  { color: '#fff', fontSize: 12, fontWeight: '600' },
  logoutBtn:    { backgroundColor: '#fff', borderRadius: 14, borderWidth: 1.5, borderColor: COLORS.danger, padding: 15, alignItems: 'center' },
  logoutText:   { color: COLORS.danger, fontWeight: '700', fontSize: 15 },
});

const r = StyleSheet.create({
  row:     { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', paddingHorizontal: 14, paddingVertical: 12, borderBottomWidth: 0.5, borderBottomColor: COLORS.border },
  rowLast: { borderBottomWidth: 0 },
  label:   { fontSize: 13, color: COLORS.textMuted, flex: 1 },
  value:   { fontSize: 13, fontWeight: '500', color: COLORS.text, flex: 2, textAlign: 'right' },
});

const m = StyleSheet.create({
  overlay:        { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'flex-end' },
  sheet:          { backgroundColor: COLORS.white, borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 20, paddingBottom: 40 },
  sheetHeader:    { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  sheetTitle:     { fontSize: 17, fontWeight: '700', color: COLORS.text },
  label:          { fontSize: 11, fontWeight: '600', color: COLORS.textMuted, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 6, marginTop: 12 },
  input:          { borderWidth: 1.5, borderColor: COLORS.border, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10, fontSize: 14, color: COLORS.text, backgroundColor: COLORS.bg },
  emojiChip:      { width: 42, height: 42, borderRadius: 10, borderWidth: 0.5, borderColor: COLORS.border, alignItems: 'center', justifyContent: 'center' },
  emojiChipActive:{ backgroundColor: COLORS.primaryLight, borderColor: COLORS.primary },
  currChip:       { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 10, borderWidth: 0.5, borderColor: COLORS.border },
  currChipActive: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  currChipText:   { fontSize: 12, color: COLORS.textMuted, fontWeight: '600' },
  cancelBtn:      { flex: 1, borderWidth: 0.5, borderColor: COLORS.border, borderRadius: 10, padding: 13, alignItems: 'center' },
  saveBtn:        { flex: 2, backgroundColor: COLORS.primary, borderRadius: 10, padding: 13, alignItems: 'center' },
});
