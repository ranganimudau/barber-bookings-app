import { collection, doc, onSnapshot, query, updateDoc, where } from 'firebase/firestore';
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, FlatList, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { auth, db } from '../../firebase/firebaseConfig';

export default function Appointments() {
  const [bookings, setBookings] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // 1. Query bookings for this specific barber [cite: 30, 50]
    const q = query(
      collection(db, "bookings"), 
      where("barberId", "==", auth.currentUser.uid)
    );

    // 2. Real-time listener so the list updates automatically [cite: 5, 27]
    const unsubscribe = onSnapshot(q, (querySnapshot) => {
      const appointments = [];
      querySnapshot.forEach((doc) => {
        appointments.push({ id: doc.id, ...doc.data() });
      });
      // Sort by date (upcoming first)
      appointments.sort((a, b) => a.bookingDate - b.bookingDate);
      setBookings(appointments);
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const handleStatusUpdate = async (id, newStatus) => {
    try {
      const bookingRef = doc(db, "bookings", id);
      await updateDoc(bookingRef, { status: newStatus }); // [cite: 27]
      Alert.alert("Status Updated", `Appointment marked as ${newStatus}`);
    } catch (error) {
      Alert.alert("Error", error.message);
    }
  };

  const renderItem = ({ item }) => (
    <View style={styles.card}>
      <View style={styles.info}>
        <Text style={styles.clientName}>{item.clientName || "Client"}</Text>
        <Text style={styles.service}>{item.serviceName} - R{item.servicePrice}</Text>
        <Text style={styles.time}>
          {item.bookingDate.toDate().toLocaleString()} 
        </Text>
        <Text style={[styles.status, { color: item.status === 'confirmed' ? 'green' : 'orange' }]}>
          Status: {item.status}
        </Text>
      </View>
      
      <View style={styles.actions}>
        {item.status !== 'completed' && (
          <TouchableOpacity 
            style={styles.doneBtn} 
            onPress={() => handleStatusUpdate(item.id, 'completed')}
          >
            <Text style={styles.btnText}>Done</Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );

  if (loading) return <ActivityIndicator size="large" color="#000" style={{ flex: 1 }} />;

  return (
    <View style={styles.container}>
      <Text style={styles.header}>Upcoming Appointments</Text>
      {bookings.length === 0 ? (
        <Text style={styles.emptyText}>No appointments scheduled yet.</Text>
      ) : (
        <FlatList
          data={bookings}
          keyExtractor={(item) => item.id}
          renderItem={renderItem}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 20, backgroundColor: '#f5f5f5' },
  header: { fontSize: 22, fontWeight: 'bold', marginBottom: 20 },
  card: { backgroundColor: '#fff', padding: 15, borderRadius: 10, marginBottom: 15, flexDirection: 'row', justifyContent: 'space-between', elevation: 2 },
  clientName: { fontSize: 18, fontWeight: 'bold' },
  service: { color: '#666', marginVertical: 4 },
  time: { color: '#333', fontWeight: '500' },
  status: { fontSize: 12, marginTop: 5, fontWeight: 'bold', textTransform: 'capitalize' },
  doneBtn: { backgroundColor: '#000', padding: 10, borderRadius: 5, justifyContent: 'center' },
  btnText: { color: '#fff', fontWeight: 'bold' },
  emptyText: { textAlign: 'center', marginTop: 50, color: '#999' }
});