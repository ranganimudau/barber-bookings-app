import BottomSheet, { BottomSheetFlatList } from "@gorhom/bottom-sheet";
import * as Location from 'expo-location'; //
import React, { useEffect, useMemo, useRef, useState } from "react";
import {
    ActivityIndicator,
    Keyboard,
    StyleSheet,
    Text, TextInput, TouchableOpacity,
    View
} from "react-native";
import MapView, { Callout, Marker } from "react-native-maps"; //
import Icon from "react-native-vector-icons/Ionicons";
import { supabase } from "../../supabase/supabaseClient";

export default function ClientHome({ navigation }) {
  const [barbers, setBarbers] = useState([]);
  const [filteredBarbers, setFilteredBarbers] = useState([]);
  const [userLocation, setUserLocation] = useState(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [loading, setLoading] = useState(true);
  
  const mapRef = useRef(null); // Ref for map animation
  const bottomSheetRef = useRef(null);
  const snapPoints = useMemo(() => ["12%", "50%", "90%"], []);

  useEffect(() => {
    getUserLocationAndBarbers();
  }, []);

  const getUserLocationAndBarbers = async () => {
    try {
      // 1. Request Permission and get user location
      let { status } = await Location.requestForegroundPermissionsAsync();
      let coords = null;
      
      if (status === 'granted') {
        const location = await Location.getCurrentPositionAsync({});
        coords = location.coords;
        setUserLocation(coords);
      }

      // 2. Fetch Barbers from database
      const { data, error } = await supabase
        .from("barbers")
        .select("*")
        .eq("is_profile_complete", true);

      if (error) throw error;

      // 3. Process data with distance calculation and sorting
      const processedData = data.map(barber => {
        const distance = (coords && barber.latitude && barber.longitude) 
          ? calculateDistance(coords.latitude, coords.longitude, barber.latitude, barber.longitude)
          : null;
        return { ...barber, distance };
      }).sort((a, b) => (a.distance || 999) - (b.distance || 999));

      setBarbers(processedData);
      setFilteredBarbers(processedData);
    } catch (error) {
      console.error(error.message);
    } finally {
      setLoading(false);
    }
  };

  const calculateDistance = (lat1, lon1, lat2, lon2) => {
    const R = 6371; // Earth's radius in km
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
              Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLon/2) * Math.sin(dLon/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return (R * c).toFixed(1);
  };

  // Center Map on the User's location
  const centerOnUser = () => {
    if (userLocation) {
      mapRef.current?.animateToRegion({
        latitude: userLocation.latitude,
        longitude: userLocation.longitude,
        latitudeDelta: 0.01,
        longitudeDelta: 0.01,
      }, 1000);
    }
  };

  // ZOOM LOGIC: Centers map on a specific shop and collapses the sheet
  const focusOnBarber = (barber) => {
    if (barber.latitude && barber.longitude) {
      mapRef.current?.animateToRegion({
        latitude: barber.latitude,
        longitude: barber.longitude,
        latitudeDelta: 0.005, // Closer zoom
        longitudeDelta: 0.005,
      }, 1000);
      
      bottomSheetRef.current?.snapToIndex(0); // Show full map
      Keyboard.dismiss();
    }
  };

  const renderBarberItem = ({ item }) => (
    <TouchableOpacity
      style={styles.card}
      onPress={() => focusOnBarber(item)}
    >
      <View style={styles.cardInfo}>
        <View style={styles.nameRow}>
          <Text style={styles.shopName}>{item.shop_name}</Text>
          {item.distance && (
            <View style={styles.distanceBadge}>
              <Text style={styles.distanceText}>{item.distance} km</Text>
            </View>
          )}
        </View>
        <Text style={styles.address}>{item.address}</Text>
      </View>
      <Icon name="navigate-circle-outline" size={28} color="#000" />
    </TouchableOpacity>
  );

  if (loading) return <ActivityIndicator style={{ flex: 1 }} size="large" color="#000" />;

  return (
    <View style={styles.container}>
      <MapView
        ref={mapRef}
        style={styles.map}
        showsUserLocation={true}
        initialRegion={userLocation ? {
          latitude: userLocation.latitude,
          longitude: userLocation.longitude,
          latitudeDelta: 0.05,
          longitudeDelta: 0.05,
        } : undefined}
      >
        {filteredBarbers.map((barber) => (
          <Marker
            key={barber.id}
            coordinate={{ latitude: parseFloat(barber.latitude), longitude: parseFloat(barber.longitude) }}
            pinColor="#000"
          >
            <Callout 
              onPress={() => navigation.navigate("BarberProfile", { barberId: barber.id })}
              style={styles.callout}
            >
              <View>
                <Text style={styles.calloutTitle}>{barber.shop_name}</Text>
                <Text style={styles.calloutBtn}>View Profile & Book →</Text>
              </View>
            </Callout>
          </Marker>
        ))}
      </MapView>

      {/* FLOATING "CENTER ON ME" BUTTON */}
      <TouchableOpacity style={styles.centerBtn} onPress={centerOnUser}>
        <Icon name="locate" size={26} color="#000" />
      </TouchableOpacity>

      <BottomSheet ref={bottomSheetRef} index={1} snapPoints={snapPoints}>
        <View style={styles.contentContainer}>
          <Text style={styles.sheetTitle}>Nearby Barbers</Text>
          <View style={styles.searchSection}>
            <Icon name="search" size={20} color="#999" />
            <TextInput
              style={styles.input}
              placeholder="Search by shop name..."
              value={searchQuery}
              onChangeText={(t) => {
                setSearchQuery(t);
                setFilteredBarbers(barbers.filter(b => b.shop_name.toLowerCase().includes(t.toLowerCase())));
              }}
            />
          </View>

          <BottomSheetFlatList
            data={filteredBarbers}
            keyExtractor={(item) => item.id}
            renderItem={renderBarberItem}
            contentContainerStyle={styles.listPadding}
          />
        </View>
      </BottomSheet>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  map: { ...StyleSheet.absoluteFillObject },
  centerBtn: {
    position: 'absolute',
    top: 50,
    right: 20,
    backgroundColor: '#fff',
    padding: 12,
    borderRadius: 30,
    elevation: 5,
    shadowColor: '#000',
    shadowOpacity: 0.2,
    shadowRadius: 5,
    zIndex: 10,
  },
  contentContainer: { flex: 1, paddingHorizontal: 20 },
  sheetTitle: { fontSize: 20, fontWeight: "bold", marginBottom: 15 },
  searchSection: { flexDirection: "row", alignItems: "center", backgroundColor: "#f0f0f0", borderRadius: 12, paddingHorizontal: 15, marginBottom: 20, height: 50 },
  input: { flex: 1, marginLeft: 10, fontSize: 16 },
  card: { flexDirection: "row", alignItems: "center", backgroundColor: "#fff", padding: 15, borderRadius: 12, marginBottom: 12, borderWidth: 1, borderColor: "#f0f0f0" },
  cardInfo: { flex: 1 },
  nameRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  shopName: { fontSize: 16, fontWeight: "bold" },
  distanceBadge: { backgroundColor: '#e8f5e9', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 6 },
  distanceText: { color: '#2e7d32', fontSize: 12, fontWeight: 'bold' },
  address: { fontSize: 13, color: "#666", marginTop: 2 },
  listPadding: { paddingBottom: 50 },
  callout: { width: 160, padding: 5, alignItems: 'center' },
  calloutTitle: { fontWeight: 'bold', fontSize: 14, textAlign: 'center' },
  calloutBtn: { color: '#007AFF', textAlign: 'center', marginTop: 5, fontSize: 12, fontWeight: '600' }
});