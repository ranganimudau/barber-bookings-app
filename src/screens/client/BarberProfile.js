import { doc, getDoc } from 'firebase/firestore';
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, FlatList, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { db } from '../../firebase/firebaseConfig';

export default function BarberProfile({ route, navigation }) {
  const { barberId } = route.params; // ID passed from the Map marker 
  const [barber, setBarber] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchBarberData = async () => {
      try {
        const docRef = doc(db, "barbers", barberId);
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
          setBarber(docSnap.data());
        }
      } catch (error) {
        console.error("Error fetching barber profile:", error);
      } finally {
        setLoading(false);
      }
    };
    fetchBarberData();
  }, [barberId]);

  if (loading) return <ActivityIndicator size="large" color="#000" style={{ flex: 1 }} />;

  return (
    <View style={styles.container}>
      <Text style={styles.title}>{barber?.shopName || 'Barbershop'}</Text>
      <Text style={styles.address}>📍 {barber?.address}</Text>
      
      <Text style={styles.sectionTitle}>Services & Pricing</Text>
      {/* Displaying the custom services like Chiskop, Cut & Dye [cite: 13] */}
      <FlatList
        data={barber?.services || []}
        keyExtractor={(item, index) => index.toString()}
        renderItem={({ item }) => (
          <View style={styles.serviceRow}>
            <Text style={styles.serviceName}>{item.name}</Text>
            <Text style={styles.servicePrice}>R{item.price}</Text>
          </View>
        )}
      />

      <View style={styles.footer}>
        <Text style={styles.info}>Duration: {barber?.appointmentDuration} mins</Text>
        <TouchableOpacity 
          style={styles.bookButton}
          onPress={() => navigation.navigate('Booking', { barberId: barberId })}
        >
          <Text style={styles.buttonText}>Select Date & Time</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 20, backgroundColor: '#fff' },
  title: { fontSize: 26, fontWeight: 'bold', marginBottom: 5 },
  address: { fontSize: 14, color: '#666', marginBottom: 20 },
  sectionTitle: { fontSize: 18, fontWeight: 'bold', marginVertical: 10, borderBottomWidth: 1, borderColor: '#eee', paddingBottom: 5 },
  serviceRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 12, borderBottomWidth: 0.5, borderColor: '#f0f0f0' },
  serviceName: { fontSize: 16 },
  servicePrice: { fontSize: 16, fontWeight: 'bold' },
  footer: { marginTop: 20, borderTopWidth: 1, borderColor: '#eee', paddingTop: 20 },
  info: { fontSize: 14, color: '#888', marginBottom: 15, textAlign: 'center' },
  bookButton: { backgroundColor: '#000', padding: 16, borderRadius: 10, alignItems: 'center' },
  buttonText: { color: '#fff', fontSize: 16, fontWeight: 'bold' }
});