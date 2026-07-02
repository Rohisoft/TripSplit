import React, { useMemo } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet, SafeAreaView, StatusBar,
} from 'react-native';
import { COLORS } from '../data/constants';
import { useStore } from '../store/useStore';
import { useAuth } from '../auth/AuthContext';

export default function TripMembersScreen({ route, navigation }) {
  const { tripId } = route.params;
  const { state } = useStore();
  const { user } = useAuth();

  const trip = state.trips.find(t => t.id === tripId);
  const members = useMemo(() => state.tripMembers.filter(m => m.tripId === tripId), [state.tripMembers, tripId]);

  const inviteLink = typeof window !== 'undefined' && trip
    ? `${window.location.origin}${window.location.pathname}?code=${trip.inviteCode}`
    : '';

  const copyLink = () => {
    if (typeof navigator !== 'undefined' && navigator.clipboard) {
      navigator.clipboard.writeText(inviteLink);
    }
  };

  return (
    <SafeAreaView style={s.safe}>
      <StatusBar backgroundColor={COLORS.primary} barStyle="light-content" />
      <View style={s.topbar}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Text style={s.backBtn}>← Back</Text>
        </TouchableOpacity>
        <Text style={s.title}>Members</Text>
        <View style={{ width: 44 }} />
      </View>

      <ScrollView style={s.scroll} contentContainerStyle={{ padding: 16 }} showsVerticalScrollIndicator={false}>
        <View style={s.card}>
          {members.map((m, i) => (
            <View key={m.id} style={[s.row, i > 0 && s.rowBorder]}>
              <Text style={{ fontSize: 20, marginRight: 10 }}>{m.avatarEmoji}</Text>
              <Text style={s.name}>{m.displayName}{m.userId === user?.id ? ' (you)' : ''}</Text>
              {m.role === 'owner' && (
                <View style={s.ownerBadge}><Text style={s.ownerBadgeText}>owner</Text></View>
              )}
            </View>
          ))}
        </View>

        <Text style={s.sectionTitle}>Invite someone</Text>
        <View style={s.inviteCard}>
          <Text style={s.label}>Invite Code</Text>
          <View style={s.codeBox}><Text style={s.codeText}>{trip?.inviteCode}</Text></View>
          <TouchableOpacity style={s.copyBtn} onPress={copyLink}>
            <Text style={s.copyBtnText}>📋 Copy Invite Link</Text>
          </TouchableOpacity>
          <Text style={s.hint}>They'll need a TripSplit account and this link/code to join.</Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe:         { flex: 1, backgroundColor: COLORS.primary },
  topbar:       { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 14 },
  backBtn:      { color: '#fff', fontSize: 13, width: 44 },
  title:        { color: '#fff', fontSize: 16, fontWeight: '700' },
  scroll:       { flex: 1, backgroundColor: COLORS.bg, borderTopLeftRadius: 20, borderTopRightRadius: 20 },
  card:         { backgroundColor: COLORS.white, borderRadius: 14, borderWidth: 0.5, borderColor: COLORS.border, overflow: 'hidden', marginBottom: 20 },
  row:          { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, paddingVertical: 12 },
  rowBorder:    { borderTopWidth: 0.5, borderTopColor: COLORS.border },
  name:         { fontSize: 14, color: COLORS.text, flex: 1 },
  ownerBadge:   { backgroundColor: COLORS.primaryLight, borderRadius: 8, paddingHorizontal: 8, paddingVertical: 3 },
  ownerBadgeText: { fontSize: 10, fontWeight: '700', color: COLORS.primary },
  sectionTitle: { fontSize: 13, fontWeight: '700', color: COLORS.textMuted, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 8 },
  inviteCard:   { backgroundColor: COLORS.white, borderRadius: 14, borderWidth: 0.5, borderColor: COLORS.border, padding: 16 },
  label:        { fontSize: 11, fontWeight: '600', color: COLORS.textMuted, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 8 },
  codeBox:      { backgroundColor: COLORS.bg, borderRadius: 10, borderWidth: 1, borderColor: COLORS.border, padding: 16, alignItems: 'center', marginBottom: 14 },
  codeText:     { fontSize: 24, fontWeight: '800', letterSpacing: 3, color: COLORS.primary },
  copyBtn:      { backgroundColor: COLORS.primary, borderRadius: 10, padding: 13, alignItems: 'center' },
  copyBtnText:  { color: '#fff', fontWeight: '700', fontSize: 14 },
  hint:         { fontSize: 12, color: COLORS.textMuted, textAlign: 'center', marginTop: 10 },
});
