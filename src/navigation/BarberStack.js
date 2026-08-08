import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createStackNavigator } from '@react-navigation/stack';
import React from 'react';
import Ionicons from 'react-native-vector-icons/Ionicons';

// Import all your barber screens
import Appointments from '../screens/barber/Appointments';
import Availability from '../screens/barber/Availability';
import BarberDashboard from '../screens/barber/BarberDashboard';
import BarberEarnings from '../screens/barber/BarberEarnings';
import BarberSettings from '../screens/barber/BarberSettings';
import EditProfile from '../screens/barber/EditProfile';
import Services from '../screens/barber/Services';
import SubscriptionSettings from '../screens/barber/SubscriptionSettings';
import SupportInfo from '../screens/common/SupportInfo';
import { colors as barberColors } from '../theme/barberTheme';

const Tab = createBottomTabNavigator();
const Stack = createStackNavigator();

// This stack lives inside the "Settings" Tab
function SettingsStack() {
  return (
    <Stack.Navigator
      screenOptions={{
        headerStyle: {
          backgroundColor: barberColors.surface,
          elevation: 0,
          shadowOpacity: 0,
          borderBottomWidth: 1,
          borderBottomColor: barberColors.border,
        },
        headerTintColor: barberColors.text,
        headerTitleStyle: { color: barberColors.text, fontWeight: '700' },
        headerShadowVisible: false,
      }}
    >
      {/* Root of the stack has its own in-screen title — hide the duplicate stack header. */}
      <Stack.Screen name="BarberSettings" component={BarberSettings} options={{ title: "Settings", headerShown: false }} />
      <Stack.Screen name="EditProfile" component={EditProfile} options={{ title: "Edit Business Info" }} />
      <Stack.Screen name="Services" component={Services} options={{ title: "Manage Services" }} />
      <Stack.Screen name="SubscriptionSettings" component={SubscriptionSettings} options={{ title: "Subscription" }} />
      <Stack.Screen
        name="SupportInfo"
        component={SupportInfo}
        options={({ route }) => ({ title: route.params?.title || "Info" })}
      />
    </Stack.Navigator>
  );
}

export default function BarberStack() {
  return (
    <Tab.Navigator
      initialRouteName="Dashboard"
      screenOptions={({ route }) => ({
        tabBarIcon: ({ focused, color, size }) => {
          let iconName;
          if (route.name === 'Dashboard') {
            iconName = focused ? 'home' : 'home-outline';
          } else if (route.name === 'Bookings') {
            iconName = focused ? 'calendar' : 'calendar-outline';
          } else if (route.name === 'Earnings') {
            iconName = focused ? 'cash' : 'cash-outline';
          } else if (route.name === 'Availability') {
            iconName = focused ? 'time' : 'time-outline';
          } else if (route.name === 'SettingsGroup') {
            iconName = focused ? 'settings' : 'settings-outline';
          }
          return <Ionicons name={iconName} size={size} color={color} />;
        },
        // Every tab hides its own outer header (each screen has its own
        // in-content title) — no header style needed at this level.
        tabBarStyle: {
          backgroundColor: barberColors.surface,
          borderTopWidth: 1,
          borderTopColor: barberColors.border,
          elevation: 0,
          shadowOpacity: 0,
        },
        tabBarActiveTintColor: barberColors.accent,
        tabBarInactiveTintColor: barberColors.textMuted,
      })}
    >
      <Tab.Screen name="Dashboard" component={BarberDashboard} options={{ headerShown: false }} />
      <Tab.Screen name="Bookings" component={Appointments} options={{ headerShown: false }} />
      <Tab.Screen name="Earnings" component={BarberEarnings} options={{ headerShown: false }} />
      <Tab.Screen
        name="Availability"
        component={Availability}
        options={{ title: "Availability", headerShown: false }}
      />
      <Tab.Screen 
        name="SettingsGroup" 
        component={SettingsStack} 
        options={{ title: "Settings", headerShown: false }} 
      />
    </Tab.Navigator>
  );
}