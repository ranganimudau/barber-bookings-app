import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import MapView, { Callout, Marker } from "react-native-maps";
import Icon from "react-native-vector-icons/Ionicons";
import { supabase } from "../../supabase/supabaseClient"; //

export default function MapScreen({ navigation }) {
  const [barbers, setBarbers] = useState([]);
  const [loading, setLoading] = useState(true);

  // Initial region (Adjust to Soweto coordinates for your local testing)
  const [region] = useState({
    latitude: -26.2485,
    longitude: 27.854,
    latitudeDelta: 0.05,
    longitudeDelta: 0.05,
  });

  useEffect(() => {
    fetchBarbers();
  }, []);

  const fetchBarbers = async () => {
    try {
      setLoading(true);
      // Fetch all barbers who have completed their profile setup
      const { data, error } = await supabase.from("barbers").select(`
          id,
          shop_name,
          address,
          latitude,
          longitude,
          profiles (full_name)
        `);

      if (error) throw error;
      setBarbers(data || []);
    } catch (error) {
      console.error("Error fetching barbers:", error.message);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#000" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <MapView style={styles.map} initialRegion={region}>
        {barbers.map((barber) => (
          <Marker
            key={barber.id}
            coordinate={{
              latitude: barber.latitude,
              longitude: barber.longitude,
            }}
          >
            <View style={styles.markerContainer}>
              <Icon name="cut" size={20} color="#fff" />
            </View>
            <Callout
              onPress={() =>
                navigation.navigate("BarberProfile", { barberId: barber.id })
              }
            >
              <View style={styles.callout}>
                <Text style={styles.shopName}>{barber.shop_name}</Text>
                <Text style={styles.address}>{barber.address}</Text>
                <Text style={styles.link}>View Profile</Text>
              </View>
            </Callout>
          </Marker>
        ))}
      </MapView>

      {/* Floating Refresh Button */}
      <TouchableOpacity style={styles.refreshButton} onPress={fetchBarbers}>
        <Icon name="refresh" size={24} color="#000" />
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  map: { width: "100%", height: "100%" },
  center: { flex: 1, justifyContent: "center", alignItems: "center" },
  markerContainer: {
    backgroundColor: "#000",
    padding: 8,
    borderRadius: 20,
    borderWidth: 2,
    borderColor: "#fff",
  },
  callout: { padding: 10, width: 150 },
  shopName: { fontWeight: "bold", fontSize: 14 },
  address: { fontSize: 12, color: "#666", marginVertical: 4 },
  link: { color: "#007AFF", fontSize: 12, fontWeight: "bold" },
  refreshButton: {
    position: "absolute",
    top: 50,
    right: 20,
    backgroundColor: "#fff",
    padding: 10,
    borderRadius: 30,
    elevation: 5,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
  },
});
