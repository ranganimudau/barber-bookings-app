import { collection, getDocs, query, where } from 'firebase/firestore';
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import MapView, { Callout, Marker } from 'react-native-maps';
import { db } from '../../firebase/firebaseConfig';

export default function MapScreen({ navigation }) {
  const [barbers, setBarbers] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchBarbers = async () => {
      try {
        // Only fetch barbers who have completed their profiles 
        const q = query(
          collection(db, "barbers"), 
          where("isProfileComplete", "==", true)
        );
        
        const querySnapshot = await getDocs(q);
        const barberList = querySnapshot.docs.map(doc => ({ 
          id: doc.id, 
          ...doc.data() 
        }));

        // Filter out any entries missing coordinates to prevent crashes 
        const validBarbers = barberList.filter(b => b.location && b.location.latitude);
        setBarbers(validBarbers);
      } catch (error) {
        console.error("Error fetching barbers: ", error);
      } finally {
        setLoading(false);
      }
    };

    fetchBarbers();
  }, []);

  if (loading) return <ActivityIndicator size="large" color="#000" style={{ flex: 1 }} />;

  return (
    <View style={styles.container}>
      <MapView 
        style={styles.map}
        initialRegion={{
          latitude: -25.7479, // Centered on Pretoria/Gauteng region
          longitude: 28.2293,
          latitudeDelta: 0.1,
          longitudeDelta: 0.1,
        }}
      >
        {barbers.map((barber) => (
          barber.location && barber.location.latitude && barber.location.longitude ? (
            <Marker 
              key={barber.id}
              coordinate={{
                latitude: barber.location.latitude,
                longitude: barber.location.longitude,
              }}
            >
              {/* Tapping marker shows shop name and details  */}
              <Callout onPress={() => navigation.navigate('BarberProfile', { barberId: barber.id })}>
                <View style={styles.callout}>
                  <Text style={styles.shopName}>{barber.shopName}</Text>
                  <Text style={styles.ratingText}>
                    ⭐ {barber.averageRating ? barber.averageRating.toFixed(1) : "New"}
                  </Text>
                  <Text style={styles.linkText}>Tap to Book</Text>
                </View>
              </Callout>
            </Marker>
          ) : null
        ))}
      </MapView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  map: { width: '100%', height: '100%' },
  callout: { padding: 10, width: 160, alignItems: 'center' },
  shopName: { fontWeight: 'bold', fontSize: 14, marginBottom: 2 },
  ratingText: { fontSize: 12, color: '#f0ad4e', marginBottom: 4 },
  linkText: { color: '#0066cc', fontSize: 12, fontWeight: 'bold' }
});