import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createStackNavigator } from '@react-navigation/stack';
import React from 'react';
import Ionicons from 'react-native-vector-icons/Ionicons';

// Import all your barber screens
import Appointments from '../screens/barber/Appointments';
import Availability from '../screens/barber/Availability';
import BarberEarnings from '../screens/barber/BarberEarnings';
import BarberSettings from '../screens/barber/BarberSettings';
import EditProfile from '../screens/barber/EditProfile';
import Services from '../screens/barber/Services';

const Tab = createBottomTabNavigator();
const Stack = createStackNavigator();

// This stack lives inside the "Settings" Tab
function SettingsStack() {
  return (
    <Stack.Navigator>
      <Stack.Screen name="BarberSettings" component={BarberSettings} options={{ title: "Settings" }} />
      <Stack.Screen name="EditProfile" component={EditProfile} options={{ title: "Edit Shop Info" }} />
      <Stack.Screen name="Services" component={Services} options={{ title: "Manage Services" }} />
      <Stack.Screen name="Availability" component={Availability} options={{ title: "Set Availability" }} />
    </Stack.Navigator>
  );
}

export default function BarberStack() {
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        tabBarIcon: ({ focused, color, size }) => {
          let iconName;
          if (route.name === 'Bookings') {
            iconName = focused ? 'calendar' : 'calendar-outline';
          } else if (route.name === 'Earnings') {
            iconName = focused ? 'cash' : 'cash-outline';
          } else if (route.name === 'SettingsGroup') {
            iconName = focused ? 'settings' : 'settings-outline';
          }
          return <Ionicons name={iconName} size={size} color={color} />;
        },
        tabBarActiveTintColor: '#000',
        tabBarInactiveTintColor: 'gray',
      })}
    >
      <Tab.Screen name="Bookings" component={Appointments} />
      <Tab.Screen name="Earnings" component={BarberEarnings} />
      <Tab.Screen 
        name="SettingsGroup" 
        component={SettingsStack} 
        options={{ title: "Settings", headerShown: false }} 
      />
    </Tab.Navigator>
  );
}