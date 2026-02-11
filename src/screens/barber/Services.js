import React, { useEffect, useState } from "react";
import {
    ActivityIndicator, Alert, FlatList, StyleSheet,
    Text, TextInput, TouchableOpacity, View
} from "react-native";
import Icon from "react-native-vector-icons/Ionicons";
import { supabase } from "../../supabase/supabaseClient";

export default function Services() {
  const [services, setServices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState(null);
  const [newPrice, setNewPrice] = useState("");

  useEffect(() => {
    fetchServices();
  }, []);

  const fetchServices = async () => {
    try {
      setLoading(true);
      const { data: { user } } = await supabase.auth.getUser();
      
      const { data, error } = await supabase
        .from("barber_services")
        .select("*")
        .eq("barber_id", user.id)
        .order("service_name", { ascending: true });

      if (error) throw error;
      setServices(data || []);
    } catch (error) {
      Alert.alert("Error", "Could not load services.");
    } finally {
      setLoading(false);
    }
  };

  const handleUpdatePrice = async (serviceId) => {
    if (!newPrice || isNaN(newPrice)) {
      Alert.alert("Error", "Please enter a valid price.");
      return;
    }

    try {
      const { error } = await supabase
        .from("barber_services")
        .update({ price: parseFloat(newPrice) })
        .eq("id", serviceId);

      if (error) throw error;

      Alert.alert("Success", "Price updated!");
      setEditingId(null);
      fetchServices(); // Refresh list
    } catch (error) {
      Alert.alert("Update Failed", error.message);
    }
  };

  const renderItem = ({ item }) => (
    <View style={styles.card}>
      <View style={styles.info}>
        <Text style={styles.serviceName}>{item.service_name}</Text>
        {editingId === item.id ? (
          <TextInput
            style={styles.inlineInput}
            keyboardType="numeric"
            value={newPrice}
            onChangeText={setNewPrice}
            placeholder={`R${item.price}`}
            autoFocus
          />
        ) : (
          <Text style={styles.priceText}>R{item.price}</Text>
        )}
      </View>

      <View style={styles.actions}>
        {editingId === item.id ? (
          <>
            <TouchableOpacity onPress={() => handleUpdatePrice(item.id)} style={styles.iconBtn}>
              <Icon name="checkmark-circle" size={28} color="green" />
            </TouchableOpacity>
            <TouchableOpacity onPress={() => setEditingId(null)}>
              <Icon name="close-circle" size={28} color="red" />
            </TouchableOpacity>
          </>
        ) : (
          <TouchableOpacity onPress={() => { setEditingId(item.id); setNewPrice(item.price.toString()); }}>
            <Icon name="create-outline" size={24} color="#666" />
          </TouchableOpacity>
        )}
      </View>
    </View>
  );

  return (
    <View style={styles.container}>
      <Text style={styles.header}>Manage Services</Text>
      {loading ? (
        <ActivityIndicator size="large" color="#000" />
      ) : (
        <FlatList
          data={services}
          keyExtractor={(item) => item.id}
          renderItem={renderItem}
          ListEmptyComponent={<Text style={styles.empty}>No services set up yet.</Text>}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 20, backgroundColor: "#fff" },
  header: { fontSize: 24, fontWeight: "bold", marginBottom: 20, marginTop: 40 },
  card: { 
    flexDirection: "row", 
    justifyContent: "space-between", 
    padding: 15, 
    borderWidth: 1, 
    borderColor: "#eee", 
    borderRadius: 12, 
    marginBottom: 10,
    alignItems: "center"
  },
  serviceName: { fontSize: 16, fontWeight: "600" },
  priceText: { fontSize: 16, color: "#666", marginTop: 4 },
  inlineInput: { borderBottomWidth: 1, borderColor: "#000", fontSize: 16, width: 60, padding: 0 },
  actions: { flexDirection: "row", alignItems: "center" },
  iconBtn: { marginRight: 10 },
  empty: { textAlign: "center", color: "#999", marginTop: 50 }
});