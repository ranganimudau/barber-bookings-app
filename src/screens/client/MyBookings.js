import { collection, deleteDoc, doc, getDocs, onSnapshot, query, where } from 'firebase/firestore';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  Alert,
  Animated,
  FlatList,
  RefreshControl,
  StyleSheet, Text, TouchableOpacity, View
} from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';
import { auth, db } from '../../firebase/firebaseConfig';

const BookingSkeleton = () => {
  const opacity = useRef(new Animated.Value(0.3)).current;

  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, { toValue: 0.7, duration: 800, useNativeDriver: true }),
        Animated.timing(opacity, { toValue: 0.3, duration: 800, useNativeDriver: true }),
      ])
    ).start();
  }, [opacity]);

  return (
    <Animated.View style={[styles.card, { opacity }]}>
      <View style={styles.info}>
        <View style={styles.skeletonTitle} />
        <View style={styles.skeletonSubtitle} />
        <View style={styles.skeletonDate} />
      </View>
      <View style={styles.skeletonBadge} />
    </Animated.View>
  );
};

export default function MyBookings({ navigation }) {
  const [bookings, setBookings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false); // State for Pull-to-Refresh

  // Centralized fetching logic
  const fetchBookings = useCallback(async () => {
    const q = query(
      collection(db, "bookings"), 
      where("clientId", "==", auth.currentUser.uid)
    );
    
    const snapshot = await getDocs(q);
    const list = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    list.sort((a, b) => (b.appointmentDate?.seconds || 0) - (a.appointmentDate?.seconds || 0));
    setBookings(list);
  }, []);

  // Real-time listener
  useEffect(() => {
    const q = query(
      collection(db, "bookings"), 
      where("clientId", "==", auth.currentUser.uid)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const list = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      list.sort((a, b) => (b.appointmentDate?.seconds || 0) - (a.appointmentDate?.seconds || 0));
      setBookings(list);
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  // Handle manual refresh
  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchBookings();
    setRefreshing(false);
  }, [fetchBookings]);

  const handleEditPress = (item) => {
    if (!item.appointmentDate) return;
    const now = new Date().getTime();
    const appointmentTime = item.appointmentDate.toDate().getTime();
    const fortyEightHoursInMs = 2 * 24 * 60 * 60 * 1000;

    if (appointmentTime - now < fortyEightHoursInMs) {
      Alert.alert("Editing Restricted", "You can only edit appointments at least 2 days in advance.");
    } else {
      navigation.navigate('Booking', { 
        barberId: item.barberId, 
        editMode: true, 
        bookingId: item.id 
      });
    }
  };

  const handleCancelPress = (item) => {
    if (!item.appointmentDate) return;
    const now = new Date().getTime();
    const appointmentTime = item.appointmentDate.toDate().getTime();
    const fortyEightHoursInMs = 2 * 24 * 60 * 60 * 1000;

    if (appointmentTime - now < fortyEightHoursInMs) {
      Alert.alert("Cancellation Restricted", "You can only cancel at least 2 days in advance.");
      return;
    }

    Alert.alert("Cancel Appointment", "Are you sure?", [
      { text: "No", style: "cancel" },
      { 
        text: "Yes, Cancel", 
        style: "destructive", 
        onPress: async () => {
          try {
            await deleteDoc(doc(db, 'bookings', item.id));
          } catch (_e) { Alert.alert("Error", "Could not delete."); }
        }
      }
    ]);
  };

  const renderBooking = ({ item }) => {
    const displayDate = item.appointmentDate 
      ? item.appointmentDate.toDate().toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' })
      : "Pending...";

    return (
      <View style={styles.card}>
        <View style={styles.info}>
          <Text style={styles.shopName}>{item.shopName || "Barber Shop"}</Text>
          <Text style={styles.serviceText}>{item.serviceName} • R{item.servicePrice}</Text>
          <Text style={styles.dateText}>{displayDate}</Text>
        </View>
        <View style={styles.actions}>
          <View style={[styles.statusBadge, item.status === 'completed' ? styles.bgSuccess : styles.bgPending]}>
            <Text style={styles.statusText}>{item.status}</Text>
          </View>
          {item.status === 'pending' && (
            <View style={styles.buttonRow}>
              <TouchableOpacity style={styles.iconBtn} onPress={() => handleEditPress(item)}>
                <Icon name="create-outline" size={22} color="#007AFF" />
              </TouchableOpacity>
              <TouchableOpacity style={styles.iconBtn} onPress={() => handleCancelPress(item)}>
                <Icon name="trash-outline" size={22} color="#FF3B30" />
              </TouchableOpacity>
            </View>
          )}
        </View>
      </View>
    );
  };

  return (
    <View style={styles.container}>
      <Text style={styles.header}>My Bookings</Text>
      {loading ? (
        <View>
          <BookingSkeleton />
          <BookingSkeleton />
          <BookingSkeleton />
        </View>
      ) : (
        <FlatList
          data={bookings}
          keyExtractor={(item) => item.id}
          renderItem={renderBooking}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={['#000']} />
          }
          ListEmptyComponent={<Text style={styles.empty}>No bookings found.</Text>}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff', padding: 20 },
  header: { fontSize: 24, fontWeight: 'bold', marginBottom: 20, color: '#000' },
  card: { 
    flexDirection: 'row', 
    justifyContent: 'space-between', 
    padding: 18, 
    borderRadius: 15, 
    backgroundColor: '#f9f9f9', 
    marginBottom: 15,
    borderWidth: 1,
    borderColor: '#eee'
  },
  info: { flex: 1 },
  shopName: { fontSize: 18, fontWeight: 'bold', color: '#333' },
  serviceText: { color: '#666', marginVertical: 5, fontSize: 14 },
  dateText: { fontSize: 12, color: '#999', fontWeight: '500' },
  actions: { alignItems: 'flex-end', justifyContent: 'space-between' },
  statusBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8 },
  statusText: { fontSize: 10, fontWeight: 'bold', color: '#fff', textTransform: 'uppercase' },
  bgSuccess: { backgroundColor: '#28a745' },
  bgPending: { backgroundColor: '#ffc107' },
  buttonRow: { flexDirection: 'row', marginTop: 15 },
  iconBtn: { marginLeft: 20 },
  empty: { textAlign: 'center', marginTop: 50, color: '#999', fontSize: 16 },
  skeletonTitle: { width: '60%', height: 18, backgroundColor: '#e1e1e1', borderRadius: 4, marginBottom: 8 },
  skeletonSubtitle: { width: '40%', height: 14, backgroundColor: '#e1e1e1', borderRadius: 4, marginBottom: 8 },
  skeletonDate: { width: '30%', height: 12, backgroundColor: '#e1e1e1', borderRadius: 4 },
  skeletonBadge: { width: 60, height: 20, backgroundColor: '#e1e1e1', borderRadius: 8 }
});