import { addDoc, collection, onSnapshot, query, where } from 'firebase/firestore';
import React, { useEffect, useState } from 'react';
import { Alert, FlatList, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { auth, db } from '../../firebase/firebaseConfig';

export default function MyBookings() {
  const [bookings, setBookings] = useState([]);

  useEffect(() => {
    const q = query(collection(db, "bookings"), where("clientId", "==", auth.currentUser.uid));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      setBookings(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });
    return () => unsubscribe();
  }, []);

  const handleRateBarber = (barberId) => {
    Alert.prompt("Rate Barbershop", "Enter rating (1-5):", (rating) => {
      if (rating >= 1 && rating <= 5) {
        addDoc(collection(db, "ratings"), {
          barberId,
          clientId: auth.currentUser.uid,
          rating: Number(rating),
          createdAt: new Date()
        });
        Alert.alert("Success", "Rating submitted!");
      }
    });
  };

  return (
    <View style={styles.container}>
      <Text style={styles.header}>My Appointments</Text>
      <FlatList
        data={bookings}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <View style={styles.card}>
            <Text style={styles.shopName}>{item.serviceName}</Text>
            <Text>Status: {item.status}</Text>
            {item.status === 'completed' && (
              <TouchableOpacity 
                style={styles.rateBtn} 
                onPress={() => handleRateBarber(item.barberId)}
              >
                <Text style={styles.rateText}>Rate Barber</Text>
              </TouchableOpacity>
            )}
          </View>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 20, backgroundColor: '#fff' },
  header: { fontSize: 22, fontWeight: 'bold', marginBottom: 20 },
  card: { padding: 15, borderBottomWidth: 1, borderColor: '#eee', marginBottom: 10 },
  shopName: { fontSize: 18, fontWeight: 'bold' },
  rateBtn: { marginTop: 10, backgroundColor: '#f0ad4e', padding: 8, borderRadius: 5, width: 100 },
  rateText: { color: '#fff', textAlign: 'center' }
});