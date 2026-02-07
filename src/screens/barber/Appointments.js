import { collection, doc, onSnapshot, orderBy, query, updateDoc, where } from 'firebase/firestore';
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, FlatList, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { auth, db } from '../../firebase/firebaseConfig';

export default function Appointments() {
  const [bookings, setBookings] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Query: Get bookings for this barber, ordered by the upcoming appointment date
    const q = query(
      collection(db, "bookings"), 
      where("barberId", "==", auth.currentUser.uid),
      orderBy("appointmentDate", "asc") // Closest appointment appears first
    );

    const unsubscribe = onSnapshot(q, (querySnapshot) => {
      const appointments = [];
      querySnapshot.forEach((doc) => {
        appointments.push({ id: doc.id, ...doc.data() });
      });
      setBookings(appointments);
      setLoading(false);
    }, (error) => {
      console.error("Firestore Error:", error);
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const handleComplete = async (id) => {
    try {
      const bookingRef = doc(db, "bookings", id);
      await updateDoc(bookingRef, { status: 'completed' });
      Alert.alert("Success", "Appointment marked as completed.");
    } catch (_error) {
      Alert.alert("Error", "Could not update status.");
    }
  };

  const formatDateTime = (timestamp) => {
    if (!timestamp) return "No time set";
    const date = timestamp.toDate();
    return date.toLocaleDateString() + " at " + date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  const renderItem = ({ item }) => (
    <View style={styles.card}>
      <View style={styles.infoSection}>
        <Text style={styles.timeText}>{formatDateTime(item.appointmentDate)}</Text>
        <Text style={styles.clientName}>{item.clientName}</Text>
        <Text style={styles.serviceDetail}>{item.serviceName} — R{item.servicePrice}</Text>
      </View>

      <View style={styles.statusSection}>
        <View style={[styles.badge, item.status === 'completed' ? styles.bgSuccess : styles.bgPending]}>
          <Text style={styles.badgeText}>{item.status}</Text>
        </View>
        
        {item.status === 'pending' && (
          <TouchableOpacity style={styles.doneBtn} onPress={() => handleComplete(item.id)}>
            <Text style={styles.doneBtnText}>Mark Done</Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );

  if (loading) return <ActivityIndicator size="large" color="#000" style={{ flex: 1 }} />;

  return (
    <View style={styles.container}>
      <Text style={styles.header}>Upcoming Schedule</Text>
      <FlatList
        data={bookings}
        keyExtractor={(item) => item.id}
        renderItem={renderItem}
        ListEmptyComponent={<Text style={styles.empty}>No appointments found.</Text>}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 20, backgroundColor: '#f8f9fa' },
  header: { fontSize: 24, fontWeight: 'bold', marginBottom: 20, color: '#000' },
  card: { backgroundColor: '#fff', borderRadius: 12, padding: 15, marginBottom: 15, flexDirection: 'row', justifyContent: 'space-between', elevation: 3 },
  infoSection: { flex: 2 },
  timeText: { fontSize: 13, fontWeight: 'bold', color: '#0066cc', marginBottom: 5 },
  clientName: { fontSize: 18, fontWeight: 'bold', color: '#333' },
  serviceDetail: { fontSize: 14, color: '#666', marginTop: 3 },
  statusSection: { flex: 1, alignItems: 'flex-end', justifyContent: 'space-between' },
  badge: { paddingVertical: 4, paddingHorizontal: 8, borderRadius: 6 },
  badgeText: { fontSize: 10, fontWeight: 'bold', textTransform: 'uppercase', color: '#fff' },
  bgSuccess: { backgroundColor: '#28a745' },
  bgPending: { backgroundColor: '#ffc107' },
  doneBtn: { marginTop: 10, backgroundColor: '#000', paddingVertical: 6, paddingHorizontal: 12, borderRadius: 6 },
  doneBtnText: { color: '#fff', fontSize: 12, fontWeight: 'bold' },
  empty: { textAlign: 'center', marginTop: 40, color: '#999' }
});