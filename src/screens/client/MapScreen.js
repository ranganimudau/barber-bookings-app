import * as Location from 'expo-location';
import { collection, onSnapshot, query, where } from 'firebase/firestore';
import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  StyleSheet,
  Text,
  TouchableOpacity,
  View
} from 'react-native';
import MapView, { Callout, Marker } from 'react-native-maps';
import Icon from 'react-native-vector-icons/Ionicons';
import { db } from '../../firebase/firebaseConfig';

export default function MapScreen({ navigation }) {
  const [barbers, setBarbers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState('map'); 
  const [mapRegion, setMapRegion] = useState(null);

  useEffect(() => {
    (async () => {
      // 1. Request Permission and get Live Location
      let { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert("Permission Denied", "We need location access to show you nearby barbers.");
        setLoading(false);
        return;
      }

      let location = await Location.getCurrentPositionAsync({});
      const initialRegion = {
        latitude: location.coords.latitude,
        longitude: location.coords.longitude,
        latitudeDelta: 0.05,
        longitudeDelta: 0.05,
      };
      setMapRegion(initialRegion);
      // 2. Real-time listener for discovery
      const q = query(collection(db, "barbers"), where("isProfileComplete", "==", true));
      
      const unsubscribe = onSnapshot(q, (snapshot) => {
        const barberList = snapshot.docs.map(doc => ({ 
          id: doc.id, 
          ...doc.data() 
        }));
        setBarbers(barberList);
        setLoading(false);
      }, (error) => {
        console.error("Discovery Fetch Error: ", error);
        setLoading(false);
      });

      return () => unsubscribe();
    })();
  }, []);

  // Function to snap map back to user's current position
  const goToMyLocation = async () => {
    let location = await Location.getCurrentPositionAsync({});
    setMapRegion({
      latitude: location.coords.latitude,
      longitude: location.coords.longitude,
      latitudeDelta: 0.05,
      longitudeDelta: 0.05,
    });
  };

  if (loading) return (
    <View style={styles.loadingContainer}>
      <ActivityIndicator size="large" color="#000" />
      <Text style={styles.loadingText}>Finding nearby barbers...</Text>
    </View>
  );

  return (
    <View style={styles.container}>
      {/* Discovery Top Bar */}
      <View style={styles.topBar}>
        <View>
          <Text style={styles.brandText}>BarberLink</Text>
          <Text style={styles.subTitle}>Discover & Book</Text>
        </View>
        <TouchableOpacity 
          style={styles.toggleBtn} 
          onPress={() => setViewMode(viewMode === 'map' ? 'list' : 'map')}
        >
          <Icon name={viewMode === 'map' ? 'list' : 'map'} size={24} color="#000" />
        </TouchableOpacity>
      </View>

      {viewMode === 'map' ? (
        <View style={{ flex: 1 }}>
          <MapView 
            style={styles.map}
            region={mapRegion}
            onRegionChangeComplete={(region) => setMapRegion(region)}
            showsUserLocation={true} // The "Blue Dot"
            showsMyLocationButton={false} // Customizing our own button below
          >
            {barbers.map((barber) => (
              <Marker 
                key={barber.id}
                // Important: Use coords field if geocoded, fallback to location
                coordinate={{
                  latitude: barber.coords?.latitude || barber.location?.latitude || -26.2041,
                  longitude: barber.coords?.longitude || barber.location?.longitude || 28.0473,
                }}
                pinColor="#000"
              >
                <Callout 
                  onPress={() => navigation.navigate('BarberProfile', { barberId: barber.id })}
                  tooltip={false}
                >
                  <View style={styles.callout}>
                    <Text style={styles.calloutName}>{barber.shopName}</Text>
                    <View style={styles.ratingRow}>
                      <Icon name="star" size={12} color="#FFD700" />
                      <Text style={styles.ratingText}>
                         {barber.averageRating ? barber.averageRating.toFixed(1) : "New"}
                      </Text>
                    </View>
                    <Text style={styles.servicesLink}>Tap to view menu</Text>
                  </View>
                </Callout>
              </Marker>
            ))}
          </MapView>
          
          {/* Floating 'Locate Me' Button */}
          <TouchableOpacity style={styles.locateButton} onPress={goToMyLocation}>
            <Icon name="locate" size={24} color="#000" />
          </TouchableOpacity>
        </View>
      ) : (
        <FlatList
          data={barbers}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContainer}
          renderItem={({ item }) => (
            <TouchableOpacity 
              style={styles.listCard}
              onPress={() => navigation.navigate('BarberProfile', { barberId: item.id })}
            >
              <View style={styles.listInfo}>
                <Text style={styles.listShopName}>{item.shopName}</Text>
                <Text style={styles.listAddress} numberOfLines={1}>{item.address}</Text>
                <View style={styles.ratingRow}>
                  <Icon name="star" size={14} color="#FFD700" />
                  <Text style={styles.listRating}>
                    {item.averageRating ? item.averageRating.toFixed(1) : "No ratings yet"}
                  </Text>
                </View>
              </View>
              <Icon name="chevron-forward" size={20} color="#ccc" />
            </TouchableOpacity>
          )}
          ListEmptyComponent={
            <Text style={styles.emptyText}>No barbers found in this area.</Text>
          }
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  loadingText: { marginTop: 10, color: '#666' },
  topBar: {
    paddingTop: 50,
    paddingHorizontal: 20,
    paddingBottom: 15,
    backgroundColor: '#fff',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  brandText: { fontSize: 22, fontWeight: 'bold', color: '#000', letterSpacing: -0.5 },
  subTitle: { fontSize: 12, color: '#888', marginTop: -2 },
  toggleBtn: { 
    width: 44, 
    height: 44, 
    borderRadius: 22, 
    backgroundColor: '#f5f5f5', 
    justifyContent: 'center', 
    alignItems: 'center' 
  },
  map: { width: '100%', height: '100%' },
  locateButton: {
    position: 'absolute',
    bottom: 20,
    right: 20,
    backgroundColor: '#fff',
    padding: 12,
    borderRadius: 30,
    elevation: 5,
    shadowColor: '#000',
    shadowOpacity: 0.3,
    shadowRadius: 3,
    shadowOffset: { width: 0, height: 2 }
  },
  callout: { padding: 10, width: 140, alignItems: 'center' },
  calloutName: { fontWeight: 'bold', fontSize: 14, textAlign: 'center' },
  ratingRow: { flexDirection: 'row', alignItems: 'center', marginVertical: 4 },
  ratingText: { fontSize: 12, fontWeight: '600', marginLeft: 4 },
  servicesLink: { fontSize: 11, color: '#0066cc', fontWeight: 'bold' },
  listContainer: { padding: 15 },
  listCard: { 
    flexDirection: 'row', 
    justifyContent: 'space-between', 
    alignItems: 'center', 
    padding: 15, 
    backgroundColor: '#fff',
    borderRadius: 12,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#f0f0f0',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  listInfo: { flex: 1 },
  listShopName: { fontSize: 17, fontWeight: 'bold', color: '#333' },
  listAddress: { fontSize: 13, color: '#777', marginTop: 2 },
  listRating: { fontSize: 13, color: '#444', marginLeft: 5 },
  emptyText: { textAlign: 'center', marginTop: 50, color: '#999' }
});