import { createStackNavigator } from '@react-navigation/stack';
import React from 'react';
import BarberProfile from '../screens/client/BarberProfile';
import BookingScreen from '../screens/client/BookingScreen';
import MapScreen from '../screens/client/MapScreen'; // Check this path!
import MyBookings from '../screens/client/MyBookings';

const Stack = createStackNavigator();

export default function ClientStack() {
  return (
    <Stack.Navigator>
      {/* Ensure component={MapScreen} is NOT undefined */}
      <Stack.Screen name="Home" component={MapScreen} /> 
      <Stack.Screen name="BarberProfile" component={BarberProfile} />
      <Stack.Screen name="Booking" component={BookingScreen} />
      <Stack.Screen name="MyBookings" component={MyBookings} />
    </Stack.Navigator>
  );
}