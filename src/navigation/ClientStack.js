import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createStackNavigator } from '@react-navigation/stack';
import React from 'react';
import { Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { useGuestMode } from '../context/GuestModeContext';
import BarberProfile from '../screens/client/BarberProfile';
import ClientHome from '../screens/client/ClientHome';
import GuestPrompt from '../screens/client/GuestPrompt';
import MyBookings from '../screens/client/MyBookings';
import Settings from '../screens/client/Settings';
import { useClientThemeMode } from '../theme/ClientThemeMode';

const Tab = createBottomTabNavigator();
const Stack = createStackNavigator();

/**
 * HomeStack handles navigation between the main map/list 
 * and the specific barber profile booking page.
 */
function HomeStack() {
  return (
    <Stack.Navigator
      screenOptions={{
        headerStyle: {
          backgroundColor: '#0A0A0A',
          borderBottomWidth: 1,
          borderBottomColor: 'rgba(197,160,112,0.20)',
          shadowColor: 'transparent',
          elevation: 0,
        },
        headerTintColor: '#F5F5F0',
        headerTitleStyle: { fontWeight: '800', fontSize: 17, color: '#F5F5F0' },
        headerBackTitleVisible: false,
      }}
    >
      <Stack.Screen 
        name="Explore" 
        component={ClientHome} 
        options={{ headerShown: false }} 
      />
      <Stack.Screen
        name="BarberProfile"
        component={BarberProfile}
        options={{ title: 'Book service' }}
      />
    </Stack.Navigator>
  );
}

const TAB_BAR_BASE_HEIGHT = Platform.OS === 'ios' ? 88 : 64;
const ANDROID_NAV_PADDING = 24;

export default function ClientStack() {
  const insets = useSafeAreaInsets();
  const { colors: themeColors, isDark } = useClientThemeMode();
  const { isGuest } = useGuestMode();
  const bottomPadding = Platform.OS === 'android'
    ? Math.max(insets.bottom, ANDROID_NAV_PADDING)
    : insets.bottom;

  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        tabBarIcon: ({ focused, color, size }) => {
          let iconName;
          if (route.name === 'Find') {
            iconName = focused ? 'map' : 'map-outline';
          } else if (route.name === 'My Bookings') {
            iconName = focused ? 'calendar' : 'calendar-outline';
          } else if (route.name === 'Settings') {
            iconName = focused ? 'settings' : 'settings-outline';
          }
          return <Ionicons name={iconName} size={size} color={color} />;
        },
        tabBarActiveTintColor: themeColors.accent,
        tabBarInactiveTintColor: isDark ? '#8A8D96' : '#7D6F60',
        tabBarStyle: {
          backgroundColor: themeColors.surfaceAlt,
          borderTopColor: themeColors.border,
          borderTopWidth: 1,
          paddingTop: 8,
          height: TAB_BAR_BASE_HEIGHT + bottomPadding,
          paddingBottom: bottomPadding,
          shadowColor: 'transparent',
          elevation: 0,
        },
        tabBarLabelStyle: { fontSize: 12, fontWeight: '700', marginTop: 1 },
        headerStyle: {
          backgroundColor: themeColors.surfaceAlt,
          borderBottomColor: themeColors.border,
          borderBottomWidth: 1,
          shadowColor: 'transparent',
          elevation: 0,
        },
        headerTintColor: themeColors.text,
        headerTitleStyle: { fontWeight: '800', fontSize: 17, color: themeColors.text },
        headerShown: true,
      })}
    >
      <Tab.Screen
        name="Find"
        component={HomeStack}
        options={{ title: 'Find a pro' }}
      />
      {/* Both of these read the signed-in user's own rows, so guests get a
          sign-up prompt in their place rather than an empty or broken tab. */}
      <Tab.Screen
        name="My Bookings"
        component={isGuest ? GuestPrompt : MyBookings}
        options={{ title: 'My bookings' }}
        initialParams={
          isGuest
            ? {
                icon: 'calendar-outline',
                title: 'Your bookings live here',
                body: 'Create an account to book appointments and keep track of them in one place.',
              }
            : undefined
        }
      />
      <Tab.Screen
        name="Settings"
        component={isGuest ? GuestPrompt : Settings}
        options={{ title: 'Settings' }}
        initialParams={
          isGuest
            ? {
                icon: 'person-circle-outline',
                title: 'No account yet',
                body: "You're browsing as a guest. Create an account to save your details and manage your bookings.",
              }
            : undefined
        }
      />
    </Tab.Navigator>
  );
}