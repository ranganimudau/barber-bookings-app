import { addDoc, collection, deleteDoc, doc, getDoc, getDocs, query, Timestamp, where } from 'firebase/firestore';
import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Alert, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { auth, db } from '../../firebase/firebaseConfig';

export default function Availability() {
  // barber state removed (was unused)
  const [slots, setSlots] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchBarberAndSlots();
  }, [fetchBarberAndSlots]);

  const generateDailySlots = useCallback(async (barberData) => {
    const tempSlots = [];
    const duration = barberData.appointmentDuration || 30;
    
    // Calculate slots for today
    let start = new Date();
    const [openH, openM] = barberData.openingTime.split(':');
    start.setHours(parseInt(openH), parseInt(openM), 0, 0);

    let end = new Date();
    const [closeH, closeM] = barberData.closingTime.split(':');
    end.setHours(parseInt(closeH), parseInt(closeM), 0, 0);

    while (start < end) {
      tempSlots.push(new Date(start));
      start.setMinutes(start.getMinutes() + duration);
    }

    // Check Firestore for already blocked/booked slots
    const todayStart = new Date();
    todayStart.setHours(0,0,0,0);
    const todayEnd = new Date();
    todayEnd.setHours(23,59,59,999);

    const q = query(
      collection(db, "bookings"),
      where("barberId", "==", auth.currentUser.uid),
      where("appointmentDate", ">=", Timestamp.fromDate(todayStart)),
      where("appointmentDate", "<=", Timestamp.fromDate(todayEnd))
    );

    const snapshot = await getDocs(q);
    const occupiedTimes = snapshot.docs.map(doc => ({
      id: doc.id,
      time: doc.data().appointmentDate.toDate().getTime(),
      type: doc.data().status // 'pending', 'confirmed', or 'blocked'
    }));

    const finalSlots = tempSlots.map(s => {
      const match = occupiedTimes.find(ot => ot.time === s.getTime());
      return {
        time: s,
        status: match ? match.type : 'available',
        bookingId: match ? match.id : null
      };
    });

    setSlots(finalSlots);
    setLoading(false);
  }, []);

  const fetchBarberAndSlots = useCallback(async () => {
    setLoading(true);
    const barberSnap = await getDoc(doc(db, "barbers", auth.currentUser.uid));
    if (barberSnap.exists()) {
      const data = barberSnap.data();
      await generateDailySlots(data);
    } else {
      setLoading(false);
    }
  }, [generateDailySlots]);

  const toggleBlockSlot = async (slot) => {
    try {
      if (slot.status === 'available') {
        // Block the slot
        await addDoc(collection(db, "bookings"), {
          barberId: auth.currentUser.uid,
          clientId: "admin_blocked",
          clientName: "BLOCKED",
          serviceName: "Personal Time",
          servicePrice: 0,
          appointmentDate: Timestamp.fromDate(slot.time),
          status: 'blocked',
          createdAt: Timestamp.now(),
        });
        Alert.alert("Blocked", "This slot is now hidden from clients.");
      } else if (slot.status === 'blocked') {
        // Unblock the slot
        await deleteDoc(doc(db, "bookings", slot.bookingId));
        Alert.alert("Unblocked", "Slot is available again.");
      } else {
        Alert.alert("Action Denied", "This is a client booking. Manage it in the Appointments tab.");
      }
      fetchBarberAndSlots(); // Refresh
    } catch (e) {
      Alert.alert("Error", e.message);
    }
  };

  if (loading) return <ActivityIndicator size="large" color="#000" style={{flex: 1}} />;

  return (
    <ScrollView style={styles.container}>
      <Text style={styles.header}>Daily Availability</Text>
      <Text style={styles.subText}>Tap an available slot to block it out.</Text>

      <View style={styles.grid}>
        {slots.map((s, i) => (
          <TouchableOpacity 
            key={i} 
            style={[
              styles.slot, 
              s.status === 'blocked' && styles.blockedSlot,
              s.status !== 'available' && s.status !== 'blocked' && styles.bookedSlot
            ]}
            onPress={() => toggleBlockSlot(s)}
          >
            <Text style={[styles.timeText, s.status !== 'available' && {color: '#fff'}]}>
              {s.time.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </Text>
            <Text style={styles.statusLabel}>{s.status}</Text>
          </TouchableOpacity>
        ))}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 20, backgroundColor: '#fff' },
  header: { fontSize: 22, fontWeight: 'bold' },
  subText: { color: '#666', marginBottom: 20 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between' },
  slot: { width: '30%', padding: 10, borderWidth: 1, borderColor: '#eee', borderRadius: 8, marginBottom: 15, alignItems: 'center' },
  blockedSlot: { backgroundColor: '#FF3B30', borderColor: '#FF3B30' },
  bookedSlot: { backgroundColor: '#007AFF', borderColor: '#007AFF' },
  timeText: { fontSize: 14, fontWeight: 'bold' },
  statusLabel: { fontSize: 10, color: '#888', marginTop: 4, textTransform: 'uppercase' }
});