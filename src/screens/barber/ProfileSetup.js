import React, { useState } from "react";
import {
  ActivityIndicator,
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { supabase } from "../../supabase/supabaseClient"; //

export default function ProfileSetup({ navigation }) {
  const [shopName, setShopName] = useState("");
  const [address, setAddress] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSaveProfile = async () => {
    if (!shopName || !address) {
      Alert.alert("Error", "Please fill in all shop details.");
      return;
    }

    setLoading(true);

    try {
      // 1. Get the current user's ID
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) throw new Error("User not found.");

      // 2. Insert or Update the barbers table
      // Note: latitude/longitude are hardcoded for now;
      // in a real app, you'd use a Geocoding API.
      const { error } = await supabase.from("barbers").upsert({
        id: user.id,
        shop_name: shopName,
        address: address,
        latitude: -26.2485, // Default Soweto area
        longitude: 27.854,
        is_profile_complete: true,
      });

      if (error) throw error;

      Alert.alert("Success", "Shop profile completed!");
      navigation.replace("BarberStack"); //
    } catch (error) {
      Alert.alert("Setup Error", error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.header}>Shop Setup</Text>
      <Text style={styles.subHeader}>
        Complete your profile to start receiving bookings.
      </Text>

      <View style={styles.inputGroup}>
        <Text style={styles.label}>Shop Name</Text>
        <TextInput
          placeholder="e.g. Soweto Fade Masters"
          placeholderTextColor="#999"
          style={styles.input}
          value={shopName}
          onChangeText={setShopName}
        />
      </View>

      <View style={styles.inputGroup}>
        <Text style={styles.label}>Shop Address</Text>
        <TextInput
          placeholder="Enter full street address"
          placeholderTextColor="#999"
          style={[styles.input, styles.textArea]}
          value={address}
          onChangeText={setAddress}
          multiline
          numberOfLines={3}
        />
      </View>

      <TouchableOpacity
        style={styles.button}
        onPress={handleSaveProfile}
        disabled={loading}
      >
        {loading ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text style={styles.buttonText}>Finish Setup</Text>
        )}
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flexGrow: 1,
    padding: 25,
    backgroundColor: "#fff",
    justifyContent: "center",
  },
  header: { fontSize: 26, fontWeight: "bold", color: "#000", marginBottom: 10 },
  subHeader: { fontSize: 14, color: "#666", marginBottom: 30 },
  inputGroup: { marginBottom: 20 },
  label: { fontSize: 14, fontWeight: "600", marginBottom: 8, color: "#333" },
  input: {
    borderWidth: 1,
    borderColor: "#eee",
    padding: 15,
    borderRadius: 12,
    backgroundColor: "#f9f9f9",
    fontSize: 16,
  },
  textArea: { height: 100, textAlignVertical: "top" },
  button: {
    backgroundColor: "#000",
    padding: 18,
    borderRadius: 12,
    alignItems: "center",
    marginTop: 10,
  },
  buttonText: { color: "#fff", fontWeight: "bold", fontSize: 16 },
});
