import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createStackNavigator } from '@react-navigation/stack';
import React from 'react';
import Ionicons from 'react-native-vector-icons/Ionicons';

// Screen Imports
import BarberProfile from '../screens/client/BarberProfile';
import ClientHome from '../screens/client/ClientHome';
import MyBookings from '../screens/client/MyBookings';
import Settings from '../screens/client/Settings'; // New Settings Screen

const Tab = createBottomTabNavigator();
const Stack = createStackNavigator();

/**
 * HomeStack handles navigation between the main map/list 
 * and the specific barber profile booking page.
 */
function HomeStack() {
  return (
    <Stack.Navigator>
      <Stack.Screen 
        name="Explore" 
        component={ClientHome} 
        options={{ headerShown: false }} 
      />
      <Stack.Screen 
        name="BarberProfile" 
        component={BarberProfile} 
        options={{ title: "Book Service" }} 
      />
    </Stack.Navigator>
  );
}

export default function ClientStack() {
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        tabBarIcon: ({ focused, color, size }) => {
          let iconName;

          // Define icons for each tab
          if (route.name === 'Find') {
            iconName = focused ? 'map' : 'map-outline';
          } else if (route.name === 'My Bookings') {
            iconName = focused ? 'calendar' : 'calendar-outline';
          } else if (route.name === 'Settings') {
            iconName = focused ? 'settings' : 'settings-outline';
          }

          return <Ionicons name={iconName} size={size} color={color} />;
        },
        tabBarActiveTintColor: '#000',
        tabBarInactiveTintColor: 'gray',
        headerShown: true,
      })}
    >
      <Tab.Screen 
        name="Find" 
        component={HomeStack} 
        options={{ title: "Find a Barber" }} 
      />
      <Tab.Screen 
        name="My Bookings" 
        component={MyBookings} 
      />
      <Tab.Screen 
        name="Settings" 
        component={Settings} 
        options={{ title: "Settings" }}
      />
    </Tab.Navigator>
  );
}