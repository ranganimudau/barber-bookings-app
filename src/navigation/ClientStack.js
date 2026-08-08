import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createStackNavigator } from '@react-navigation/stack';
import React from 'react';
import { Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { useGuestMode } from '../context/GuestModeContext';
import BarberProfile from '../screens/client/BarberProfile';
import ClientHome from '../screens/client/ClientHome';
import AboutLegal from '../screens/common/AboutLegal';
import SupportInfo from '../screens/common/SupportInfo';
import EditProfile from '../screens/client/EditProfile';
import GuestPrompt from '../screens/client/GuestPrompt';
import MyBookings from '../screens/client/MyBookings';
import Settings from '../screens/client/Settings';
import { colors } from '../theme/barberTheme';

const Tab = createBottomTabNavigator();
const Stack = createStackNavigator();

const stackHeaderOptions = {
  headerStyle: {
    backgroundColor: colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    shadowColor: 'transparent',
    elevation: 0,
  },
  headerTintColor: colors.text,
  headerTitleStyle: { fontWeight: '800', fontSize: 17, color: colors.text },
  headerBackTitleVisible: false,
};

/** Settings needs a stack of its own so it can push the legal/help pages. */
function SettingsStack() {
  return (
    <Stack.Navigator screenOptions={stackHeaderOptions}>
      <Stack.Screen name="SettingsHome" component={Settings} options={{ title: 'Settings' }} />
      <Stack.Screen name="EditProfile" component={EditProfile} options={{ title: 'Edit profile' }} />
      <Stack.Screen name="AboutLegal" component={AboutLegal} options={{ title: 'About & legal' }} />
      <Stack.Screen
        name="SupportInfo"
        component={SupportInfo}
        options={({ route }) => ({ title: route.params?.title || 'Information' })}
      />
    </Stack.Navigator>
  );
}

/**
 * HomeStack handles navigation between the main map/list
 * and the specific barber profile booking page.
 */
function HomeStack() {
  return (
    <Stack.Navigator screenOptions={stackHeaderOptions}>
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
        tabBarActiveTintColor: colors.accent,
        tabBarInactiveTintColor: colors.textMuted,
        tabBarStyle: {
          backgroundColor: colors.surface,
          borderTopColor: colors.border,
          borderTopWidth: 1,
          paddingTop: 8,
          height: TAB_BAR_BASE_HEIGHT + bottomPadding,
          paddingBottom: bottomPadding,
          shadowColor: 'transparent',
          elevation: 0,
        },
        tabBarLabelStyle: { fontSize: 12, fontWeight: '700', marginTop: 1 },
        headerStyle: {
          backgroundColor: colors.surface,
          borderBottomColor: colors.border,
          borderBottomWidth: 1,
          shadowColor: 'transparent',
          elevation: 0,
        },
        headerTintColor: colors.text,
        headerTitleStyle: { fontWeight: '800', fontSize: 17, color: colors.text },
        headerShown: true,
      })}
    >
      {/* Header off: the map fills the screen and draws its own floating
          search bar over it, so a solid nav header would both duplicate the
          title and eat the map. Pushed screens (BarberProfile) still get
          their header from HomeStack. */}
      <Tab.Screen
        name="Find"
        component={HomeStack}
        options={{ title: 'Find a pro', headerShown: false }}
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
        component={isGuest ? GuestPrompt : SettingsStack}
        // SettingsStack brings its own header; the guest prompt still needs
        // the tab's one.
        options={{ title: 'Settings', headerShown: isGuest }}
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