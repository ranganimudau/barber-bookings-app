import DateTimePicker from '@react-native-community/datetimepicker';
import React, { useEffect, useState } from "react";
import {
  ActivityIndicator, Alert, KeyboardAvoidingView, Platform,
  ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View
} from "react-native";
import Icon from "react-native-vector-icons/Ionicons";
import { supabase } from "../../supabase/supabaseClient";

export default function EditProfile() {
  const [shopName, setShopName] = useState("");
  const [address, setAddress] = useState("");
  const [services, setServices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Global Hours State
  const [openingTime, setOpeningTime] = useState(new Date(new Date().setHours(8, 0, 0, 0)));
  const [closingTime, setClosingTime] = useState(new Date(new Date().setHours(17, 0, 0, 0)));
  const [showPicker, setShowPicker] = useState(null); // 'opening' or 'closing'

  const [newServiceName, setNewServiceName] = useState("");
  const [newServicePrice, setNewServicePrice] = useState("");

  useEffect(() => {
    loadBarberData();
  }, []);

  const loadBarberData = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      const { data: barberData } = await supabase.from("barbers").select("*").eq("id", user.id).single();
      
      if (barberData) {
        setShopName(barberData.shop_name);
        setAddress(barberData.address);
        
        // Load global hours if they exist in DB
        if (barberData.default_opening) setOpeningTime(parseTime(barberData.default_opening));
        if (barberData.default_closing) setClosingTime(parseTime(barberData.default_closing));
      }
      
      const { data: serviceData } = await supabase.from("barber_services")
        .select("*")
        .eq("barber_id", user.id)
        .order("service_name", { ascending: true });
      setServices(serviceData || []);
    } catch (error) {
      console.error("Error loading profile:", error.message);
    } finally {
      setLoading(false);
    }
  };

  const parseTime = (timeStr) => {
    const [h, m] = timeStr.split(':');
    const d = new Date();
    d.setHours(parseInt(h), parseInt(m), 0, 0);
    return d;
  };

  const formatTime = (date) => {
    return `${date.getHours().toString().padStart(2, '0')}:${date.getMinutes().toString().padStart(2, '0')}`;
  };

  const updateServicePrice = (index, newPrice) => {
    const updatedServices = [...services];
    updatedServices[index] = { ...updatedServices[index], price: newPrice };
    setServices(updatedServices);
  };

  const handleAddService = async () => {
    if (!newServiceName || !newServicePrice) {
      Alert.alert("Error", "Enter both service name and price.");
      return;
    }
    try {
      const { data: { user } } = await supabase.auth.getUser();
      const { data, error } = await supabase
        .from("barber_services")
        .insert([{ barber_id: user.id, service_name: newServiceName, price: parseFloat(newServicePrice) }])
        .select();
      if (error) throw error;
      setServices([...services, ...data]);
      setNewServiceName("");
      setNewServicePrice("");
      Alert.alert("Success", "Service added!");
    } catch (error) {
      Alert.alert("Error", error.message);
    }
  };

  const handleSaveAll = async () => {
    setSaving(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      
      // Update Shop Info & Global Hours
      await supabase.from("barbers").upsert({ 
        id: user.id, 
        shop_name: shopName, 
        address: address,
        default_opening: formatTime(openingTime),
        default_closing: formatTime(closingTime)
      });
      
      const updatePromises = services.map((s) =>
        supabase.from("barber_services").update({ price: parseFloat(s.price) || 0 }).eq("id", s.id)
      );
      await Promise.all(updatePromises);
      Alert.alert("Success", "Shop profile and global hours updated!");
    } catch (error) {
      Alert.alert("Update Error", error.message);
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <ActivityIndicator style={{ flex: 1 }} size="large" color="#000" />;

  return (
    <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={{ flex: 1 }}>
      <ScrollView style={styles.container} contentContainerStyle={{ paddingBottom: 40 }}>
        
        <Text style={styles.sectionHeader}>General Information</Text>
        <View style={styles.card}>
          <Text style={styles.label}>Shop Name</Text>
          <TextInput style={styles.input} value={shopName} onChangeText={setShopName} />
          
          <Text style={styles.label}>Shop Address</Text>
          <TextInput style={[styles.input, styles.textArea]} value={address} onChangeText={setAddress} multiline />

          {/* Global Hours Selection */}
          <Text style={styles.label}>Standard Operating Hours</Text>
          <View style={styles.row}>
            <TouchableOpacity style={styles.timeBtn} onPress={() => setShowPicker('opening')}>
              <Text style={styles.timeBtnText}>Opens: {formatTime(openingTime)}</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.timeBtn} onPress={() => setShowPicker('closing')}>
              <Text style={styles.timeBtnText}>Closes: {formatTime(closingTime)}</Text>
            </TouchableOpacity>
          </View>
        </View>

        {showPicker && (
          <DateTimePicker
            value={showPicker === 'opening' ? openingTime : closingTime}
            mode="time"
            is24Hour={true}
            display={Platform.OS === 'ios' ? 'spinner' : 'default'}
            onChange={(event, date) => {
              setShowPicker(null);
              if (date) {
                if (showPicker === 'opening') setOpeningTime(date);
                else setClosingTime(date);
              }
            }}
          />
        )}

        <Text style={styles.sectionHeader}>Prices & Services (R)</Text>
        <View style={styles.card}>
          {services.map((item, index) => (
            <View key={item.id} style={styles.serviceRow}>
              <Text style={styles.serviceName}>{item.service_name}</Text>
              <View style={styles.priceInputWrapper}>
                <Text style={styles.currencySymbol}>R</Text>
                <TextInput
                  style={styles.priceInput}
                  keyboardType="numeric"
                  value={item.price.toString()}
                  onChangeText={(text) => updateServicePrice(index, text)}
                />
              </View>
            </View>
          ))}

          <View style={styles.addServiceContainer}>
            <TextInput 
              placeholder="New Service" 
              style={[styles.input, { flex: 2, marginBottom: 0, marginRight: 10 }]} 
              value={newServiceName} 
              onChangeText={setNewServiceName} 
            />
            <TextInput 
              placeholder="Price" 
              keyboardType="numeric" 
              style={[styles.input, { flex: 1, marginBottom: 0, marginRight: 10 }]} 
              value={newServicePrice} 
              onChangeText={setNewServicePrice} 
            />
            <TouchableOpacity onPress={handleAddService} style={styles.addButton}>
              <Icon name="add-circle" size={35} color="#000" />
            </TouchableOpacity>
          </View>
        </View>

        <TouchableOpacity style={styles.saveButton} onPress={handleSaveAll} disabled={saving}>
          {saving ? <ActivityIndicator color="#fff" /> : <Text style={styles.saveButtonText}>Save All Changes</Text>}
        </TouchableOpacity>

      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#f8f8f8", padding: 20 },
  sectionHeader: { fontSize: 18, fontWeight: "bold", color: "#333", marginBottom: 12 },
  card: { backgroundColor: "#fff", borderRadius: 12, padding: 15, marginBottom: 20 },
  label: { fontSize: 13, fontWeight: "600", color: "#666", marginBottom: 8 },
  input: { borderWidth: 1, borderColor: "#eee", padding: 12, borderRadius: 8, marginBottom: 15, backgroundColor: "#fafafa", color: "#000" },
  textArea: { height: 60, textAlignVertical: "top" },
  row: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 5 },
  timeBtn: { backgroundColor: '#f0f0f0', padding: 12, borderRadius: 8, flex: 0.48, alignItems: 'center' },
  timeBtnText: { fontWeight: 'bold', color: '#333' },
  serviceRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: "#f1f1f1" },
  serviceName: { fontSize: 15, color: "#333", flex: 1 },
  priceInputWrapper: { flexDirection: "row", alignItems: "center", borderWidth: 1, borderColor: "#ddd", borderRadius: 6, paddingHorizontal: 8 },
  priceInput: { paddingVertical: 5, width: 50, textAlign: "center", fontWeight: "bold", color: "#000" },
  currencySymbol: { color: "#888" },
  addServiceContainer: { flexDirection: "row", alignItems: "center", marginTop: 15, borderTopWidth: 1, borderTopColor: "#eee", paddingTop: 15 },
  addButton: { justifyContent: "center", alignItems: "center" },
  saveButton: { backgroundColor: "#000", padding: 18, borderRadius: 12, alignItems: "center", marginTop: 10 },
  saveButtonText: { color: "#fff", fontWeight: "bold", fontSize: 16 }
});