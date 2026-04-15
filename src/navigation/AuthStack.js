import AsyncStorage from "@react-native-async-storage/async-storage";
import { createStackNavigator } from "@react-navigation/stack";
import React, { useEffect } from "react";

// Correct paths based on your folder structure
import { AUTH_OPEN_LOGIN_AFTER_RESET_KEY } from "../screens/auth/ResetPassword";
import Welcome from "../screens/auth/Welcome";
import Login from "../screens/auth/Login";
import Signup from "../screens/auth/Signup";

const Stack = createStackNavigator();

export default function AuthStack({ navigation: parentNav }) {
  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const v = await AsyncStorage.getItem(AUTH_OPEN_LOGIN_AFTER_RESET_KEY);
        if (v && alive) {
          await AsyncStorage.removeItem(AUTH_OPEN_LOGIN_AFTER_RESET_KEY);
          parentNav.navigate("AuthStack", { screen: "Login" });
        }
      } catch {
        /* ignore */
      }
    })();
    return () => {
      alive = false;
    };
  }, [parentNav]);

  return (
    <Stack.Navigator initialRouteName="Welcome" screenOptions={{ headerShown: false }}>
      <Stack.Screen name="Welcome" component={Welcome} />
      <Stack.Screen name="Login" component={Login} />
      <Stack.Screen name="Signup" component={Signup} />
    </Stack.Navigator>
  );
}
