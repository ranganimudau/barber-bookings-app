import * as Location from 'expo-location';
import React, { useState } from "react";
import {
  ActivityIndicator, Alert, Modal, ScrollView, StyleSheet,
  Text, TextInput, TouchableOpacity, View
} from "react-native";
import MapView, { Marker } from 'react-native-maps';
import Icon from "react-native-vector-icons/Ionicons";
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
  const [phone, setPhone] = useState(""); 
  const [services, setServices] = useState(INITIAL_SERVICES);
  const [loading, setLoading] = useState(false);

  // Map preview state
  const [showPreview, setShowPreview] = useState(false);
  const [previewCoords, setPreviewCoords] = useState(null);

  const updateServicePrice = (index, newPrice) => {
    const updated = [...services];
    updated[index].price = newPrice;
    setServices(updated);
  };

  // Trigger real-time location preview
  const handlePreviewLocation = async () => {
    try {
      let { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert("Permission Denied", "We need location access to show the preview.");
        return;
      }
      let location = await Location.getCurrentPositionAsync({});
      setPreviewCoords(location.coords);
      setShowPreview(true);
    } catch (error) {
      Alert.alert("Error", "Could not get your current location.");
    }
  };

  const handleSaveProfile = async () => {
    if (!shopName || !address || !phone) {
      Alert.alert("Error", "Please fill in all shop details, including phone number.");
      return;
    }
    setLoading(true);

    try {
      let { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') throw new Error('Location permission required.');

      let location = await Location.getCurrentPositionAsync({});
      const { latitude, longitude } = location.coords;

      const { data: { user } } = await supabase.auth.getUser();
      
      // 1. Save Shop Details (using phone_number column)
      const { error: barberError } = await supabase.from("barbers").upsert({
        id: user.id,
        shop_name: shopName,
        address: address,
        phone_number: phone, 
        latitude: latitude,
        longitude: longitude,
        is_profile_complete: true,
      });
      if (barberError) throw barberError;

      // 2. Clean up old services if they exist
      await supabase.from("barber_services").delete().eq("barber_id", user.id);

      // 3. Insert fresh services
      const servicesToInsert = services.map(s => ({
        barber_id: user.id,
        service_name: s.name,
        price: parseFloat(s.price)
      }));

      const { error: serviceError } = await supabase.from("barber_services").insert(servicesToInsert);
      if (serviceError) throw serviceError;

      Alert.alert("Success", "Your shop is now live!", [
        { 
          text: "Go to Dashboard", 
          onPress: () => {
            // FIX: Point to 'BarberDashboard' to avoid the duplicate name error in App.js
            navigation.reset({
              index: 0,
              routes: [{ name: 'BarberDashboard' }],
            });
          } 
        }
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
      
      <View style={styles.section}>
        <TextInput
          placeholder="Shop Name"
          style={styles.input}
          value={shopName}
          onChangeText={setShopName}
        />
        <TextInput
          placeholder="Business Phone Number"
          style={styles.input}
          value={phone}
          onChangeText={setPhone}
          keyboardType="phone-pad"
        />
        <TextInput
          placeholder="Physical Address"
          style={[styles.input, styles.textArea]}
          value={address}
          onChangeText={setAddress}
          multiline
        />
        
        <TouchableOpacity style={styles.previewBtn} onPress={handlePreviewLocation}>
          <Icon name="map-outline" size={20} color="#000" />
          <Text style={styles.previewBtnText}>Preview Pin Location on Map</Text>
        </TouchableOpacity>
        
        <Text style={styles.helperText}>Clients will see your shop at your current GPS location.</Text>
      </View>

      <Modal visible={showPreview} animationType="slide">
        <View style={{ flex: 1 }}>
          {previewCoords && (
            <MapView
              style={{ flex: 1 }}
              initialRegion={{
                latitude: previewCoords.latitude,
                longitude: previewCoords.longitude,
                latitudeDelta: 0.01,
                longitudeDelta: 0.01,
              }}
            >
              <Marker coordinate={previewCoords} title="My Shop Location" />
            </MapView>
          )}
          <TouchableOpacity style={styles.closeModal} onPress={() => setShowPreview(false)}>
            <Text style={styles.closeModalText}>Close Preview</Text>
          </TouchableOpacity>
        </View>
      </Modal>

      <Text style={styles.label}>Set Your Prices (R)</Text>
      {services.map((service, index) => (
        <View key={index} style={styles.serviceRow}>
          <Text style={styles.serviceName}>{service.name}</Text>
          <View style={styles.priceInputWrapper}>
             <Text style={styles.currency}>R</Text>
             <TextInput
               keyboardType="numeric"
               style={styles.priceInput}
               value={service.price}
               onChangeText={(text) => updateServicePrice(index, text)}
             />
          </View>
        </View>
      ))}

      <TouchableOpacity style={styles.button} onPress={handleSaveProfile} disabled={loading}>
        {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>Finish & Go Live</Text>}
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { padding: 25, backgroundColor: "#fff" },
  header: { fontSize: 26, fontWeight: "bold", marginBottom: 20, marginTop: 40 },
  section: { marginBottom: 20 },
  label: { fontSize: 18, fontWeight: "bold", marginBottom: 15 },
  helperText: { fontSize: 12, color: '#666', fontStyle: 'italic', marginTop: 10 },
  input: { borderWidth: 1, borderColor: "#eee", padding: 15, borderRadius: 12, backgroundColor: "#f9f9f9", marginBottom: 10 },
  textArea: { height: 80 },
  previewBtn: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#f0f0f0', padding: 12, borderRadius: 10, marginTop: 5 },
  previewBtnText: { marginLeft: 10, fontWeight: '600' },
  closeModal: { position: 'absolute', bottom: 40, left: 20, right: 20, backgroundColor: '#000', padding: 15, borderRadius: 12, alignItems: 'center' },
  closeModalText: { color: '#fff', fontWeight: 'bold' },
  serviceRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 10, padding: 10, backgroundColor: "#f9f9f9", borderRadius: 8 },
  serviceName: { fontSize: 16, color: "#333", flex: 1 },
  priceInputWrapper: { flexDirection: 'row', alignItems: 'center', borderBottomWidth: 1, borderColor: '#ccc' },
  currency: { marginRight: 4, fontWeight: 'bold' },
  priceInput: { width: 50, textAlign: "center", fontWeight: 'bold' },
  button: { backgroundColor: "#000", padding: 18, borderRadius: 12, alignItems: "center", marginTop: 20 },
  buttonText: { color: "#fff", fontWeight: "bold", fontSize: 16 },
});