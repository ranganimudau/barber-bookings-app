// App.js
import { NavigationContainer } from '@react-navigation/native';
import { onAuthStateChanged } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { auth, db } from './src/firebase/firebaseConfig';

import AuthStack from './src/navigation/AuthStack';
import BarberStack from './src/navigation/BarberStack';
import ClientStack from './src/navigation/ClientStack';

export default function App() {
  const [user, setUser] = useState(null);
  const [role, setRole] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user) {
        console.log("User logged in:", user.uid);
        // Get role from Firestore 
        const userDoc = await getDoc(doc(db, "users", user.uid));
        if (userDoc.exists()) {
          console.log("Role found:", userDoc.data().role);
          setRole(userDoc.data().role);
        } else {
          console.error("No user profile found in Firestore!");
          setRole(null); 
        }
        setUser(user);
      } else {
        setUser(null);
        setRole(null);
      }
      setLoading(false);
    });
    return unsubscribe;
  }, []);

  if (loading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center' }}>
        <ActivityIndicator size="large" color="#000" />
      </View>
    );
  }

  return (
    <NavigationContainer>
      {!user ? (
        <AuthStack /> 
      ) : role === 'barber' ? (
        <BarberStack /> // [cite: 47]
      ) : (
        <ClientStack /> // [cite: 40]
      )}
    </NavigationContainer>
  );
}