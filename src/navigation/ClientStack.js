import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import React from "react";
import { Alert, TouchableOpacity } from "react-native";
import Icon from "react-native-vector-icons/Ionicons";
import { supabase } from "../supabase/supabaseClient"; //

// Import Client Screens
import MapScreen from "../screens/client/MapScreen";
import MyBookings from "../screens/client/MyBookings";
import ProfileScreen from "../screens/client/ProfileScreen";

const Tab = createBottomTabNavigator();

export default function ClientStack() {
  const handleLogout = async () => {
    const { error } = await supabase.auth.signOut(); //
    if (error) Alert.alert("Error", "Logout failed.");
  };

  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        tabBarIcon: ({ color, size }) => {
          let iconName;
          if (route.name === "Explore") iconName = "map-outline";
          else if (route.name === "Bookings") iconName = "book-outline";
          else if (route.name === "Profile") iconName = "person-outline";
          return <Icon name={iconName} size={size} color={color} />;
        },
        tabBarActiveTintColor: "#000",
      })}
    >
      <Tab.Screen name="Explore" component={MapScreen} />
      <Tab.Screen name="Bookings" component={MyBookings} />
      <Tab.Screen
        name="Profile"
        component={ProfileScreen}
        options={{
          headerRight: () => (
            <TouchableOpacity
              onPress={handleLogout}
              style={{ marginRight: 15 }}
            >
              <Icon name="log-out-outline" size={24} color="#FF3B30" />
            </TouchableOpacity>
          ),
        }}
      />
    </Tab.Navigator>
  );
}
