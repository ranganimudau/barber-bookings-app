import React, { useState } from "react";
import {
  ActivityIndicator, Alert, ScrollView, StyleSheet,
  Text, TextInput, TouchableOpacity, View
} from "react-native";
import { supabase } from "../../supabase/supabaseClient";

const INITIAL_SERVICES = [
  { name: "Chiskop", price: "20" },
  { name: "Beard", price: "20" },
  { name: "Chiskop and Beard", price: "50" },
  { name: "Cut", price: "50" },
  { name: "Cut and Dye", price: "100" },
  { name: "Cut and Beard", price: "70" },
];

export default function ProfileSetup({ navigation }) {
  const [shopName, setShopName] = useState("");
  const [address, setAddress] = useState("");
  const [services, setServices] = useState(INITIAL_SERVICES);
  const [loading, setLoading] = useState(false);

  // Function to update price for a specific service
  const updateServicePrice = (index, newPrice) => {
    const updated = [...services];
    updated[index].price = newPrice;
    setServices(updated);
  };

  const handleSaveProfile = async () => {
    if (!shopName || !address) {
      Alert.alert("Error", "Please fill in all shop details.");
      return;
    }
    setLoading(true);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("User session not found.");

      // 1. Save Shop Details
      const { error: barberError } = await supabase.from("barbers").upsert({
        id: user.id,
        shop_name: shopName,
        address: address,
        is_profile_complete: true,
      });
      if (barberError) throw barberError;

      // 2. Save Services
      const servicesToInsert = services.map(s => ({
        barber_id: user.id,
        service_name: s.name,
        price: parseFloat(s.price)
      }));

      const { error: serviceError } = await supabase
        .from("barber_services")
        .insert(servicesToInsert);

      if (serviceError) throw serviceError;

      Alert.alert("Success", "Profile and Services saved!", [
        { text: "Go to Dashboard", onPress: () => navigation.replace("BarberStack") }
      ]);
      
    } catch (error) {
      Alert.alert("Setup Error", error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.header}>Shop Setup</Text>
      
      {/* Shop Info Section */}
      <View style={styles.section}>
        <TextInput
          placeholder="Shop Name"
          style={styles.input}
          value={shopName}
          onChangeText={setShopName}
        />
        <TextInput
          placeholder="Address"
          style={[styles.input, styles.textArea]}
          value={address}
          onChangeText={setAddress}
          multiline
        />
      </View>

      <Text style={styles.label}>Set Your Prices (R)</Text>
      {services.map((service, index) => (
        <View key={index} style={styles.serviceRow}>
          <Text style={styles.serviceName}>{service.name}</Text>
          <TextInput
            keyboardType="numeric"
            style={styles.priceInput}
            value={service.price}
            onChangeText={(text) => updateServicePrice(index, text)}
          />
        </View>
      ))}

      <TouchableOpacity style={styles.button} onPress={handleSaveProfile} disabled={loading}>
        {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>Finish Setup</Text>}
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { padding: 25, backgroundColor: "#fff" },
  header: { fontSize: 26, fontWeight: "bold", marginBottom: 20, marginTop: 40 },
  section: { marginBottom: 20 },
  label: { fontSize: 18, fontWeight: "bold", marginBottom: 15 },
  input: { borderWidth: 1, borderColor: "#eee", padding: 15, borderRadius: 12, backgroundColor: "#f9f9f9", marginBottom: 10 },
  textArea: { height: 80 },
  serviceRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 10, padding: 10, backgroundColor: "#f9f9f9", borderRadius: 8 },
  serviceName: { fontSize: 16, color: "#333", flex: 1 },
  priceInput: { borderWidth: 1, borderColor: "#ddd", padding: 8, borderRadius: 5, width: 60, textAlign: "center", backgroundColor: "#fff" },
  button: { backgroundColor: "#000", padding: 18, borderRadius: 12, alignItems: "center", marginTop: 20 },
  buttonText: { color: "#fff", fontWeight: "bold", fontSize: 16 },
});