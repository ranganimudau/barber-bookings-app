import { createStackNavigator } from "@react-navigation/stack";
import React from "react";

// Correct paths based on your folder structure
import Login from "../screens/auth/Login";
import Signup from "../screens/auth/Signup";

const Stack = createStackNavigator();

export default function AuthStack() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="Login" component={Login} />
      <Stack.Screen name="Signup" component={Signup} />
    </Stack.Navigator>
  );
}
