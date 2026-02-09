import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import React from "react";
import { Alert, TouchableOpacity } from "react-native";
import Icon from "react-native-vector-icons/Ionicons";
import { supabase } from "../supabase/supabaseClient"; //

// Import Barber Screens
import Appointments from "../screens/barber/Appointments";
import Availability from "../screens/barber/Availability";
import EditProfile from "../screens/barber/EditProfile";

const Tab = createBottomTabNavigator();

export default function BarberStack() {
  const handleLogout = async () => {
    Alert.alert("Logout", "Are you sure you want to log out?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Logout",
        style: "destructive",
        onPress: async () => {
          const { error } = await supabase.auth.signOut(); //
          if (error) Alert.alert("Error", error.message);
        },
      },
    ]);
  };

  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerRight: () => (
          <TouchableOpacity onPress={handleLogout} style={{ marginRight: 15 }}>
            <Icon name="log-out-outline" size={24} color="#FF3B30" />
          </TouchableOpacity>
        ),
        tabBarIcon: ({ color, size }) => {
          let iconName;
          if (route.name === "Appointments") iconName = "calendar";
          else if (route.name === "ShopDetails")
            iconName = "storefront-outline";
          else if (route.name === "Availability") iconName = "time";
          return <Icon name={iconName} size={size} color={color} />;
        },
        tabBarActiveTintColor: "#000",
      })}
    >
      <Tab.Screen name="Appointments" component={Appointments} />
      <Tab.Screen
        name="ShopDetails"
        component={EditProfile}
        options={{ title: "Shop Details" }}
      />
      <Tab.Screen name="Availability" component={Availability} />
    </Tab.Navigator>
  );
}
