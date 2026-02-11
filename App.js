import { NavigationContainer } from "@react-navigation/native";
import { createStackNavigator } from "@react-navigation/stack";
import React, { useEffect, useState } from "react";
import { ActivityIndicator, View } from "react-native";
import AuthStack from "./src/navigation/AuthStack";
import BarberStack from "./src/navigation/BarberStack";
import ClientStack from "./src/navigation/ClientStack";
import ProfileSetup from "./src/screens/barber/ProfileSetup";
import { supabase } from "./src/supabase/supabaseClient";

const Stack = createStackNavigator();

export default function App() {
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState(null);
  const [role, setRole] = useState(null);
  const [isSetupComplete, setIsSetupComplete] = useState(false);

  useEffect(() => {
    initializeAuth();
    const { data: authListener } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (session) {
        setUser(session.user);
        await fetchUserData(session.user.id);
      } else {
        setUser(null);
        setRole(null);
        setIsSetupComplete(false);
      }
      setLoading(false);
    });
    return () => authListener.subscription.unsubscribe();
  }, []);

  const initializeAuth = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (session) {
      setUser(session.user);
      await fetchUserData(session.user.id);
    }
    setLoading(false);
  };

  const fetchUserData = async (userId) => {
    try {
      const { data: profile } = await supabase.from("profiles").select("role").eq("id", userId).single();
      if (profile) {
        setRole(profile.role);
        if (profile.role === "barber") {
          const { data: barber } = await supabase.from("barbers").select("is_profile_complete").eq("id", userId).single();
          setIsSetupComplete(barber?.is_profile_complete || false);
        }
      }
    } catch (error) {
      console.error("Error fetching user data:", error.message);
    }
  };

  if (loading) return (
    <View style={{ flex: 1, justifyContent: "center", backgroundColor: "#fff" }}>
      <ActivityIndicator size="large" color="#000" />
    </View>
  );

  return (
    <NavigationContainer>
      <Stack.Navigator screenOptions={{ headerShown: false }}>
        {user && role ? (
          role === "barber" ? (
            <>
              {/* Unique names for each screen in the stack */}
              {!isSetupComplete ? (
                <Stack.Screen name="ProfileSetup" component={ProfileSetup} />
              ) : (
                <Stack.Screen name="BarberStack" component={BarberStack} />
              )}
              {/* Fallback with a UNIQUE name to prevent the duplicate error */}
              <Stack.Screen name="BarberDashboard" component={BarberStack} />
            </>
          ) : (
            <Stack.Screen name="ClientStack" component={ClientStack} />
          )
        ) : (
          <Stack.Screen name="AuthStack" component={AuthStack} />
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
}