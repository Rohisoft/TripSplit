import React, { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  SafeAreaView, ActivityIndicator, KeyboardAvoidingView, Platform, StatusBar,
} from 'react-native';
import { useAuth } from '../auth/AuthContext';
import { COLORS } from '../data/constants';

export default function RegisterScreen({ onSwitchToLogin }) {
  const { signup } = useAuth();
  const [name,     setName]     = useState('');
  const [email,    setEmail]    = useState('');
  const [password, setPassword] = useState('');
  const [confirm,  setConfirm]  = useState('');
  const [error,    setError]    = useState('');
  const [busy,     setBusy]     = useState(false);

  const handleRegister = async () => {
    if (!name.trim())        return setError('Enter your name');
    if (!email.trim())       return setError('Enter your email');
    if (password.length < 6) return setError('Password must be at least 6 characters');
    if (password !== confirm) return setError('Passwords do not match');

    setError(''); setBusy(true);
    try {
      await signup(email.trim().toLowerCase(), password, name.trim());
      // AuthContext's onAuthStateChange listener picks up the new session
      // and loads the profile row created by the handle_new_user trigger.
    } catch (err) {
      setError(err.message || 'Registration failed. Try again.');
      setBusy(false);
    }
  };

  return (
    <SafeAreaView style={s.safe}>
      <StatusBar backgroundColor={COLORS.primary} barStyle="light-content" />
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
        <View style={s.wrap}>
          <View style={s.hero}>
            <Text style={s.heroIcon}>🧳</Text>
            <Text style={s.heroTitle}>Create your account</Text>
            <Text style={s.heroSub}>Start splitting trip expenses</Text>
          </View>

          <View style={s.card}>
            <Text style={s.label}>Name</Text>
            <TextInput
              style={s.input} placeholder="Your name"
              placeholderTextColor={COLORS.textMuted}
              value={name} onChangeText={setName}
            />

            <Text style={s.label}>Email</Text>
            <TextInput
              style={s.input} placeholder="you@email.com"
              placeholderTextColor={COLORS.textMuted}
              value={email} onChangeText={setEmail}
              keyboardType="email-address" autoCapitalize="none" autoCorrect={false}
            />

            <Text style={s.label}>Password</Text>
            <TextInput
              style={s.input} placeholder="At least 6 characters"
              placeholderTextColor={COLORS.textMuted}
              value={password} onChangeText={setPassword} secureTextEntry
            />

            <Text style={s.label}>Confirm Password</Text>
            <TextInput
              style={s.input} placeholder="Re-enter password"
              placeholderTextColor={COLORS.textMuted}
              value={confirm} onChangeText={setConfirm} secureTextEntry
              onSubmitEditing={handleRegister}
            />

            {!!error && <Text style={s.error}>{error}</Text>}

            <TouchableOpacity style={s.btn} onPress={handleRegister} disabled={busy}>
              {busy
                ? <ActivityIndicator color="#fff" />
                : <Text style={s.btnText}>Create Account  →</Text>}
            </TouchableOpacity>

            <TouchableOpacity style={s.switchBtn} onPress={onSwitchToLogin}>
              <Text style={s.switchText}>Already have an account? <Text style={s.switchLink}>Sign in</Text></Text>
            </TouchableOpacity>
          </View>

          <Text style={s.footer}>Powered by VRNDAI · vrndai.com</Text>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe:       { flex: 1, backgroundColor: COLORS.primary },
  wrap:       { flex: 1, justifyContent: 'center', padding: 24 },
  hero:       { alignItems: 'center', marginBottom: 24 },
  heroIcon:   { fontSize: 48, marginBottom: 8 },
  heroTitle:  { fontSize: 24, fontWeight: '700', color: '#fff', textAlign: 'center' },
  heroSub:    { fontSize: 13, color: 'rgba(255,255,255,0.7)', marginTop: 4 },
  card:       { backgroundColor: '#fff', borderRadius: 18, padding: 24,
                shadowColor: '#000', shadowOpacity: 0.12, shadowRadius: 24, elevation: 6 },
  label:      { fontSize: 11, fontWeight: '600', color: COLORS.textMuted,
                textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 6 },
  input:      { borderWidth: 1.5, borderColor: COLORS.border, borderRadius: 10,
                padding: 12, fontSize: 15, marginBottom: 14, color: COLORS.text,
                backgroundColor: COLORS.bg },
  error:      { color: COLORS.danger, fontSize: 13, marginBottom: 12, textAlign: 'center' },
  btn:        { backgroundColor: COLORS.primary, borderRadius: 10, padding: 14,
                alignItems: 'center', marginTop: 4 },
  btnText:    { color: '#fff', fontSize: 15, fontWeight: '700' },
  switchBtn:  { marginTop: 16, alignItems: 'center' },
  switchText: { fontSize: 13, color: COLORS.textMuted },
  switchLink: { color: COLORS.primary, fontWeight: '700' },
  footer:     { textAlign: 'center', marginTop: 24, color: 'rgba(255,255,255,0.4)', fontSize: 11 },
});
