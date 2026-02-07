import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createStackNavigator } from '@react-navigation/stack';
import { signOut } from 'firebase/auth';
import React from 'react';
import { Alert, TouchableOpacity } from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';
import { auth } from '../firebase/firebaseConfig';

// Import Screens
import Appointments from '../screens/barber/Appointments';
import Availability from '../screens/barber/Availability';
import EditProfile from '../screens/barber/EditProfile'; // Using Edit directly now

const Tab = createBottomTabNavigator();
const Stack = createStackNavigator();

// This stack now focuses only on management/updating
function ShopManagementStack() {
  return (
    <Stack.Navigator>
      <Stack.Screen 
        name="UpdateShop" 
        component={EditProfile} 
        options={{ 
          headerShown: false,
          title: 'Update Shop Details' 
        }} 
      />
    </Stack.Navigator>
  );
}

export default function BarberStack() {
  const handleLogout = () => {
    Alert.alert("Logout", "Are you sure?", [
      { text: "Cancel", style: "cancel" },
      { text: "Logout", style: "destructive", onPress: () => signOut(auth) }
    ]);
  };

  return (
    <Tab.Navigator
      initialRouteName="Appointments"
      screenOptions={({ route }) => ({
        headerRight: () => (
          <TouchableOpacity onPress={handleLogout} style={{ marginRight: 15 }}>
            <Icon name="log-out-outline" size={24} color="#FF3B30" />
          </TouchableOpacity>
        ),
        tabBarIcon: ({ color, size }) => {
          let iconName;
          if (route.name === 'Appointments') iconName = 'calendar';
          else if (route.name === 'ShopDetails') iconName = 'storefront-outline';
          else if (route.name === 'Availability') iconName = 'time';
          return <Icon name={iconName} size={size} color={color} />;
        },
        tabBarActiveTintColor: 'black',
        tabBarInactiveTintColor: 'gray',
      })}
    >
      <Tab.Screen name="Appointments" component={Appointments} />
      
      {/* Renamed and updated to focus on editing */}
      <Tab.Screen 
        name="ShopDetails" 
        component={ShopManagementStack} 
        options={{ title: 'Shop Details' }} 
      />
      
      <Tab.Screen name="Availability" component={Availability} />
    </Tab.Navigator>
  );
}