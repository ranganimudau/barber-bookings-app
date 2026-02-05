import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { doc, getDoc } from 'firebase/firestore';
import React, { useEffect, useState } from 'react';
import { ActivityIndicator } from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';
import { auth, db } from '../firebase/firebaseConfig';

import Appointments from '../screens/barber/Appointments';
import Availability from '../screens/barber/Availability';
import ProfileSetup from '../screens/barber/ProfileSetup';

const Tab = createBottomTabNavigator();

export default function BarberStack() {
  const [isComplete, setIsComplete] = useState(null);

  useEffect(() => {
    const checkProfile = async () => {
      try {
        if (!auth.currentUser) return;
        const docSnap = await getDoc(doc(db, "barbers", auth.currentUser.uid));
        if (docSnap.exists()) {
          setIsComplete(docSnap.data().isProfileComplete);
        } else {
          setIsComplete(false);
        }
      } catch (e) {
        console.warn('Error checking barber profile', e);
        setIsComplete(false);
      }
    };
    checkProfile();
  }, []);

  if (isComplete === null) return <ActivityIndicator size="large" style={{flex:1}} />;

  return (
    <Tab.Navigator
      // Directs to setup if incomplete, otherwise Appointments
      initialRouteName={isComplete ? "Appointments" : "ProfileSetup"} 
      screenOptions={({ route }) => ({
        tabBarIcon: ({ color, size }) => {
          let iconName;
          if (route.name === 'Appointments') iconName = 'calendar';
          else if (route.name === 'ProfileSetup') iconName = 'person-circle';
          else if (route.name === 'Availability') iconName = 'time';
          return <Icon name={iconName} size={size} color={color} />;
        },
        tabBarActiveTintColor: 'black',
        tabBarInactiveTintColor: 'gray',
      })}
    >
      <Tab.Screen name="Appointments" component={Appointments} />
      <Tab.Screen name="ProfileSetup" component={ProfileSetup} options={{ title: 'Shop Setup' }} />
      <Tab.Screen name="Availability" component={Availability} />
    </Tab.Navigator>
  );
}