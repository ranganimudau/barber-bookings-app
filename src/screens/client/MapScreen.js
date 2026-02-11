import * as Location from 'expo-location';
import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Dimensions,
  FlatList,
  Linking,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  TouchableOpacity, View
} from "react-native";
import MapView, { Callout, Marker } from "react-native-maps";
import Icon from "react-native-vector-icons/Ionicons";
import { supabase } from "../../supabase/supabaseClient";

const { height } = Dimensions.get('window');

export default function MapScreen({ navigation }) {
  const [barbers, setBarbers] = useState([]); 
  const [filteredBarbers, setFilteredBarbers] = useState([]); 
  const [searchQuery, setSearchQuery] = useState("");
  const [showOnlyOpen, setShowOnlyOpen] = useState(false); // NEW: Toggle state
  const [userLocation, setUserLocation] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    initMap();
  }, []);

  const initMap = async () => {
    try {
      setLoading(true);
      let { status } = await Location.requestForegroundPermissionsAsync();
      let coords = null;
      if (status === 'granted') {
        let location = await Location.getCurrentPositionAsync({});
        coords = location.coords;
        setUserLocation(coords);
      }
      await fetchBarbers(coords);
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const calculateDistance = (lat1, lon1, lat2, lon2) => {
    const R = 6371; 
    const dLat = (lat2 - lat1) * (Math.PI / 180);
    const dLon = (lon2 - lon1) * (Math.PI / 180);
    const a = 
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(lat1 * (Math.PI / 180)) * Math.cos(lat2 * (Math.PI / 180)) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c; 
  };

  // NEW: Logic to check if shop is currently within operating hours
  const isShopOpen = (opening, closing) => {
    if (!opening || !closing) return true; // Fallback if hours aren't set
    const now = new Date();
    const currentTime = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;
    return currentTime >= opening && currentTime <= closing;
  };

  const fetchBarbers = async (currentCoords) => {
    // FIX: Include operating hours in selection
    const { data, error } = await supabase
      .from("barbers")
      .select(`id, shop_name, address, latitude, longitude, phone_number, default_opening, default_closing`) 
      .eq('is_profile_complete', true)
      .not('latitude', 'is', null);

    if (!error) {
      let list = data || [];
      if (currentCoords) {
        list = list.map(b => ({
          ...b,
          dist: calculateDistance(currentCoords.latitude, currentCoords.longitude, b.latitude, b.longitude)
        })).sort((a, b) => a.dist - b.dist);
      }
      setBarbers(list);
      setFilteredBarbers(list);
    }
  };

  // NEW: Combined filter for Search and "Open Now"
  const applyFilters = (query, onlyOpen) => {
    let filtered = barbers.filter(b => 
      b.shop_name.toLowerCase().includes(query.toLowerCase())
    );
    
    if (onlyOpen) {
      filtered = filtered.filter(b => isShopOpen(b.default_opening, b.default_closing));
    }
    
    setFilteredBarbers(filtered);
  };

  const handleSearch = (text) => {
    setSearchQuery(text);
    applyFilters(text, showOnlyOpen);
  };

  const toggleOpenFilter = (value) => {
    setShowOnlyOpen(value);
    applyFilters(searchQuery, value);
  };

  const makeCall = (num) => {
    if (num) {
      Linking.openURL(`tel:${num}`);
    } else {
      Alert.alert("No Number", "This barber hasn't provided a contact number.");
    }
  };

  const renderBarberItem = ({ item }) => {
    const open = isShopOpen(item.default_opening, item.default_closing);
    return (
      <View style={styles.listItem}>
        <TouchableOpacity 
          style={styles.listInfo} 
          onPress={() => navigation.navigate("BarberProfile", { barberId: item.id })}
        >
          <Text style={styles.listShopName}>{item.shop_name}</Text>
          <Text style={[styles.openStatus, { color: open ? 'green' : 'red' }]}>
            {open ? '● Open Now' : '○ Closed'}
          </Text>
          <Text style={styles.listAddress} numberOfLines={1}>{item.address}</Text>
          <Text style={styles.distText}>{item.dist ? `${item.dist.toFixed(1)} km away` : ''}</Text>
        </TouchableOpacity>
        
        <TouchableOpacity 
          style={styles.callCircle} 
          onPress={() => makeCall(item.phone_number)}
        >
          <Icon name="call" size={20} color="#fff" />
        </TouchableOpacity>
      </View>
    );
  };

  if (loading) return <ActivityIndicator style={styles.center} size="large" color="#000" />;

  return (
    <View style={styles.container}>
      <View style={styles.searchContainer}>
        <View style={styles.searchBar}>
          <Icon name="search" size={20} color="#888" />
          <TextInput
            placeholder="Search barber shops..."
            style={styles.searchInput}
            value={searchQuery}
            onChangeText={handleSearch}
          />
          {searchQuery ? (
            <TouchableOpacity onPress={() => handleSearch("")}>
              <Icon name="close-circle" size={20} color="#888" />
            </TouchableOpacity>
          ) : null}
        </View>
        
        {/* NEW: Open Now Filter Toggle */}
        <View style={styles.filterRow}>
          <Text style={styles.filterLabel}>Show Open Only</Text>
          <Switch
            value={showOnlyOpen}
            onValueChange={toggleOpenFilter}
            trackColor={{ false: "#ddd", true: "#000" }}
            thumbColor="#fff"
          />
        </View>
      </View>

      <MapView 
        style={styles.map} 
        initialRegion={{
          latitude: userLocation?.latitude || -26.2485,
          longitude: userLocation?.longitude || 27.854,
          latitudeDelta: 0.05,
          longitudeDelta: 0.05,
        }}
        showsUserLocation={true}
      >
        {filteredBarbers.map((barber) => (
          <Marker
            key={barber.id}
            coordinate={{ latitude: barber.latitude, longitude: barber.longitude }}
          >
            <View style={styles.markerContainer}><Icon name="cut" size={18} color="#fff" /></View>
            <Callout onPress={() => navigation.navigate("BarberProfile", { barberId: barber.id })}>
              <View style={styles.callout}>
                <Text style={{fontWeight: 'bold'}}>{barber.shop_name}</Text>
                <Text style={{fontSize: 10, color: 'green'}}>{barber.dist?.toFixed(1)} km away</Text>
              </View>
            </Callout>
          </Marker>
        ))}
      </MapView>

      <View style={styles.listOverlay}>
        <View style={styles.handle} />
        <Text style={styles.listTitle}>Nearby Barbers ({filteredBarbers.length})</Text>
        <FlatList
          data={filteredBarbers}
          keyExtractor={(item) => item.id}
          renderItem={renderBarberItem}
          contentContainerStyle={{ paddingBottom: 20 }}
          ListEmptyComponent={<Text style={styles.emptyText}>No results found.</Text>}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  center: { flex: 1, justifyContent: "center", alignItems: "center" },
  searchContainer: { position: 'absolute', top: 50, width: '100%', paddingHorizontal: 15, zIndex: 10 },
  searchBar: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff',
    paddingHorizontal: 15, paddingVertical: 10, borderRadius: 25, elevation: 5
  },
  searchInput: { flex: 1, marginLeft: 10, fontSize: 16 },
  filterRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', marginTop: 10, paddingRight: 5 },
  filterLabel: { fontSize: 12, fontWeight: 'bold', color: '#fff', textShadowColor: 'rgba(0, 0, 0, 0.75)', textShadowOffset: {width: -1, height: 1}, textShadowRadius: 10, marginRight: 8 },
  map: { width: "100%", height: "50%" },
  markerContainer: { backgroundColor: "#000", padding: 6, borderRadius: 20, borderWidth: 2, borderColor: "#fff" },
  callout: { padding: 5, width: 120 },
  listOverlay: { 
    height: "50%", backgroundColor: "#fff", 
    borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 15, elevation: 15 
  },
  handle: { width: 40, height: 5, backgroundColor: '#eee', borderRadius: 10, alignSelf: 'center', marginBottom: 10 },
  listTitle: { fontSize: 18, fontWeight: 'bold', marginBottom: 15 },
  listItem: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#f0f0f0' },
  listInfo: { flex: 1 },
  listShopName: { fontWeight: 'bold', fontSize: 16 },
  openStatus: { fontSize: 11, fontWeight: 'bold', marginVertical: 2 },
  listAddress: { color: '#666', fontSize: 12 },
  distText: { fontWeight: 'bold', color: 'green', fontSize: 13, marginTop: 4 },
  callCircle: { 
    backgroundColor: '#28a745', width: 45, height: 45, 
    borderRadius: 22.5, justifyContent: 'center', alignItems: 'center' 
  },
  emptyText: { textAlign: 'center', color: '#999', marginTop: 20 }
});