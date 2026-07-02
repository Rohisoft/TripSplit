import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { Text } from 'react-native';

import TripsListScreen      from '../screens/TripsListScreen';
import TripDetailScreen     from '../screens/TripDetailScreen';
import AddEditExpenseScreen from '../screens/AddEditExpenseScreen';
import TripMembersScreen    from '../screens/TripMembersScreen';
import SettleUpScreen       from '../screens/SettleUpScreen';
import ProfileScreen        from '../screens/ProfileScreen';
import { COLORS } from '../data/constants';

const Tab   = createBottomTabNavigator();
const Stack = createNativeStackNavigator();

function TripsStack() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="TripsList"    component={TripsListScreen} />
      <Stack.Screen name="TripDetail"   component={TripDetailScreen} />
      <Stack.Screen name="AddEditExpense" component={AddEditExpenseScreen} />
      <Stack.Screen name="TripMembers"  component={TripMembersScreen} />
      <Stack.Screen name="SettleUp"     component={SettleUpScreen} />
    </Stack.Navigator>
  );
}

const ICONS  = { Trips: '🧳', Profile: '👤' };
const LABELS = { Trips: 'Trips', Profile: 'Me' };

export default function AppNavigator() {
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarIcon: () => (
          <Text style={{ fontSize: 18 }}>{ICONS[route.name] ?? '•'}</Text>
        ),
        tabBarActiveTintColor: COLORS.primary,
        tabBarInactiveTintColor: COLORS.textMuted,
        tabBarStyle: {
          borderTopWidth: 0.5,
          borderTopColor: COLORS.border,
          height: 56,
          paddingBottom: 4,
          paddingTop: 4,
        },
        tabBarLabelStyle: { fontSize: 10, marginTop: 1 },
      })}
    >
      <Tab.Screen name="Trips"   component={TripsStack}   options={{ tabBarLabel: LABELS.Trips }} />
      <Tab.Screen name="Profile" component={ProfileScreen} options={{ tabBarLabel: LABELS.Profile }} />
    </Tab.Navigator>
  );
}
