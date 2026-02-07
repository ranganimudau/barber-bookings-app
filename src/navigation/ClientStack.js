import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createStackNavigator } from '@react-navigation/stack';
import React from 'react';
import Icon from 'react-native-vector-icons/Ionicons';

// Import all Client Screens
import BarberProfile from '../screens/client/BarberProfile';
import BookingScreen from '../screens/client/BookingScreen';
import MapScreen from '../screens/client/MapScreen';
import MyBookings from '../screens/client/MyBookings';
import ProfileScreen from '../screens/client/ProfileScreen';

const Tab = createBottomTabNavigator();
const Stack = createStackNavigator();

// 1. Define the Bottom Tab Navigation
function ClientTabs() {
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        tabBarIcon: ({ focused, color, size }) => {
          let iconName;
          if (route.name === 'Discovery') {
            iconName = focused ? 'map' : 'map-outline';
          } else if (route.name === 'MyBookings') {
            iconName = focused ? 'calendar' : 'calendar-outline';
          } else if (route.name === 'Profile') {
            iconName = focused ? 'person' : 'person-outline';
          }
          return <Icon name={iconName} size={size} color={color} />;
        },
        tabBarActiveTintColor: '#000',
        tabBarInactiveTintColor: 'gray',
        headerShown: false, 
      })}
    >
      <Tab.Screen 
        name="Discovery" 
        component={MapScreen} 
        options={{ title: 'Find Barbers' }} 
      />
      <Tab.Screen 
        name="MyBookings" 
        component={MyBookings} 
        options={{ title: 'My Bookings' }} 
      />
      <Tab.Screen 
        name="Profile" 
        component={ProfileScreen} 
        options={{ title: 'My Profile' }} 
      />
    </Tab.Navigator>
  );
}

// 2. Define the main ClientStack that holds the Tabs + Sub-screens
export default function ClientStack() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      {/* The main app entry (Tabs) */}
      <Stack.Screen name="MainTabs" component={ClientTabs} />
      
      {/* Sub-screens that slide over the tabs */}
      <Stack.Screen 
        name="BarberProfile" 
        component={BarberProfile} 
        options={{ headerShown: true, title: 'Barbershop' }} 
      />
      <Stack.Screen 
        name="Booking" 
        component={BookingScreen} 
        options={{ headerShown: true, title: 'Book Appointment' }} 
      />
    </Stack.Navigator>
  );
}