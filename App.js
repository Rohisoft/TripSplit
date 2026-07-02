import React, { useState, useEffect, useRef } from 'react';
import { View, ActivityIndicator } from 'react-native';
import { NavigationContainer, createNavigationContainerRef } from '@react-navigation/native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { AuthProvider, useAuth } from './src/auth/AuthContext';
import { StoreProvider, useStore } from './src/store/useStore';
import AppNavigator from './src/navigation/AppNavigator';
import LoginScreen from './src/screens/LoginScreen';
import RegisterScreen from './src/screens/RegisterScreen';
import { COLORS } from './src/data/constants';
import { supabase } from './src/lib/supabase';

const navigationRef = createNavigationContainerRef();

function getInviteCode() {
  if (typeof window === 'undefined') return null;
  return new URLSearchParams(window.location.search).get('code');
}

function clearInviteCodeFromUrl() {
  if (typeof window === 'undefined') return;
  const url = new URL(window.location.href);
  url.searchParams.delete('code');
  window.history.replaceState({}, '', url.toString());
}

// Handles a `?code=` invite link once the user is authenticated: joins the
// trip via the join_trip RPC, refreshes the store, then navigates in.
function InviteHandler() {
  const { user } = useAuth();
  const { reload } = useStore();
  const handledRef = useRef(false);

  useEffect(() => {
    const code = getInviteCode();
    if (!code || !user?.id || handledRef.current) return;
    handledRef.current = true;

    supabase.rpc('join_trip', { code, uid: user.id })
      .then(({ data: tripMemberId, error }) => {
        clearInviteCodeFromUrl();
        if (error) { console.error('join_trip:', error.message); return; }
        reload();
        // trip_members row doesn't carry trip_id back from the RPC return value,
        // so look it up once the reload lands.
        supabase.from('trip_members').select('trip_id').eq('id', tripMemberId).single()
          .then(({ data }) => {
            if (data?.trip_id && navigationRef.isReady()) {
              navigationRef.navigate('Trips', { screen: 'TripDetail', params: { tripId: data.trip_id } });
            }
          });
      });
  }, [user?.id]);

  return null;
}

function RootNavigator() {
  const { loading, isAuthenticated } = useAuth();
  const [authMode, setAuthMode] = useState('login'); // 'login' | 'register'

  if (loading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: COLORS.primary }}>
        <ActivityIndicator color="#fff" size="large" />
      </View>
    );
  }

  if (!isAuthenticated) {
    return authMode === 'login'
      ? <LoginScreen onSwitchToRegister={() => setAuthMode('register')} />
      : <RegisterScreen onSwitchToLogin={() => setAuthMode('login')} />;
  }

  return (
    <NavigationContainer ref={navigationRef}>
      <InviteHandler />
      <AppNavigator />
    </NavigationContainer>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <SafeAreaProvider>
        <StoreProvider>
          <RootNavigator />
        </StoreProvider>
      </SafeAreaProvider>
    </AuthProvider>
  );
}
