import { addDoc, collection, doc, getDoc, serverTimestamp } from 'firebase/firestore';
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { auth, db } from '../../firebase/firebaseConfig';

export default function BookingScreen({ route, navigation }) {
  const { barberId } = route.params; // Passed from Map/Profile
  const [barber, setBarber] = useState(null);
  const [selectedService, setSelectedService] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchBarberData = async () => {
      const docSnap = await getDoc(doc(db, "barbers", barberId));
      if (docSnap.exists()) {
        setBarber(docSnap.data());
      }
      setLoading(false);
    };
    fetchBarberData();
  }, [barberId]);

  const handleConfirmBooking = async () => {
    if (!selectedService) {
      Alert.alert("Selection Required", "Please select a service before booking.");
      return;
    }

    try {
      await addDoc(collection(db, "bookings"), {
        barberId: barberId,
        clientId: auth.currentUser.uid,
        clientName: auth.currentUser.displayName || "Client",
        shopName: barber.shopName,
        serviceName: selectedService.name,
        servicePrice: selectedService.price,
        status: 'pending',
        createdAt: serverTimestamp(),
        // For MVP, we use a simple placeholder for date/time
        appointmentTime: "Scheduled for tomorrow at 10:00 AM" 
      });

      Alert.alert("Success", "Your booking has been sent to the barber!", [
        { text: "OK", onPress: () => navigation.navigate('Home') }
      ]);
    } catch (error) {
      Alert.alert("Error", error.message);
    }
  };

  if (loading) return <ActivityIndicator size="large" style={{ flex: 1 }} />;

  return (
    <ScrollView style={styles.container}>
      <Text style={styles.header}>Book an Appointment</Text>
      <Text style={styles.subHeader}>Select a service from {barber?.shopName}:</Text>

      {barber?.services?.map((item, index) => (
        <TouchableOpacity 
          key={index} 
          style={[
            styles.serviceCard, 
            selectedService?.name === item.name && styles.selectedCard
          ]}
          onPress={() => setSelectedService(item)}
        >
          <View>
            <Text style={styles.serviceName}>{item.name}</Text>
            <Text style={styles.servicePrice}>R{item.price}</Text>
          </View>
          {selectedService?.name === item.name && (
            <Text style={styles.checkMark}>✓</Text>
          )}
        </TouchableOpacity>
      ))}

      <TouchableOpacity style={styles.confirmButton} onPress={handleConfirmBooking}>
        <Text style={styles.buttonText}>Confirm Booking</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff', padding: 20 },
  header: { fontSize: 24, fontWeight: 'bold', marginBottom: 10 },
  subHeader: { fontSize: 16, color: '#666', marginBottom: 20 },
  serviceCard: { 
    flexDirection: 'row', 
    justifyContent: 'space-between', 
    alignItems: 'center',
    padding: 20, 
    borderWidth: 1, 
    borderColor: '#eee', 
    borderRadius: 12, 
    marginBottom: 15 
  },
  selectedCard: { borderColor: '#000', backgroundColor: '#f9f9f9', borderWidth: 2 },
  serviceName: { fontSize: 18, fontWeight: '600' },
  servicePrice: { fontSize: 16, color: '#444', marginTop: 4 },
  checkMark: { fontSize: 20, fontWeight: 'bold' },
  confirmButton: { 
    backgroundColor: '#000', 
    padding: 18, 
    borderRadius: 10, 
    alignItems: 'center', 
    marginTop: 20,
    marginBottom: 40 
  },
  buttonText: { color: '#fff', fontSize: 18, fontWeight: 'bold' }
});