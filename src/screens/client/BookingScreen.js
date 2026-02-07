import DateTimePicker from '@react-native-community/datetimepicker';
import { addDoc, collection, doc, getDoc, getDocs, query, Timestamp, updateDoc, where } from 'firebase/firestore';
import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Platform, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';
import { auth, db } from '../../firebase/firebaseConfig';

export default function BookingScreen({ route, navigation }) {
  // Destructure edit params passed from MyBookings
  const { barberId, editMode, bookingId } = route.params;
  
  const [barber, setBarber] = useState(null);
  const [selectedService, setSelectedService] = useState(null);
  const [date, setDate] = useState(new Date());
  const [showCalendar, setShowCalendar] = useState(false);
  const [availableSlots, setAvailableSlots] = useState([]);
  const [selectedSlot, setSelectedSlot] = useState(null);
  const [loadingSlots, setLoadingSlots] = useState(false);

  const fetchBarberData = useCallback(async () => {
    try {
      const docSnap = await getDoc(doc(db, 'barbers', barberId));
      if (docSnap.exists()) setBarber(docSnap.data());
    } catch (e) {
      console.warn(e);
    }
  }, [barberId]);

  const generateSlots = useCallback(async () => {
    if (!barber) return;
    setLoadingSlots(true);
    try {
      const duration = Number(barber.appointmentDuration) || 30;
      const opening = barber.openingTime || '09:00';
      const closing = barber.closingTime || '17:00';
      const [openH, openM] = opening.split(':').map(n => parseInt(n, 10));
      const [closeH, closeM] = closing.split(':').map(n => parseInt(n, 10));

      const start = new Date(date);
      start.setHours(openH, openM, 0, 0);
      const end = new Date(date);
      end.setHours(closeH, closeM, 0, 0);

      const slots = [];
      const cursor = new Date(start);
      while (cursor < end) {
        slots.push(new Date(cursor));
        cursor.setMinutes(cursor.getMinutes() + duration);
      }

      const startOfDay = new Date(date);
      startOfDay.setHours(0, 0, 0, 0);
      const endOfDay = new Date(date);
      endOfDay.setHours(23, 59, 59, 999);

      const q = query(
        collection(db, 'bookings'),
        where('barberId', '==', barberId),
        where('appointmentDate', '>=', Timestamp.fromDate(startOfDay)),
        where('appointmentDate', '<=', Timestamp.fromDate(endOfDay))
      );

      const snapshot = await getDocs(q);
      const bookedTimes = snapshot.docs.map(d => d.data().appointmentDate.toDate().getTime());
      
      const now = new Date().getTime();
      const freeSlots = slots.filter(s => !bookedTimes.includes(s.getTime()) && s.getTime() > now);
      
      setAvailableSlots(freeSlots);
    } catch (e) {
      console.warn(e);
      Alert.alert('Error', 'Could not load available slots.');
    } finally {
      setLoadingSlots(false);
    }
  }, [barber, date, barberId]);

  useEffect(() => {
    if (barberId) fetchBarberData();
  }, [barberId, fetchBarberData]);

  useEffect(() => {
    generateSlots();
  }, [generateSlots, barber]);

  const handleConfirm = async () => {
    if (!selectedService || !selectedSlot) {
      Alert.alert('Required', 'Please select a service and time slot.');
      return;
    }

    try {
      const bookingPayload = {
        serviceName: selectedService.name,
        servicePrice: selectedService.price,
        appointmentDate: Timestamp.fromDate(selectedSlot),
        status: 'pending', // Reset status if edited to alert barber
        updatedAt: Timestamp.now(),
      };

      if (editMode && bookingId) {
        // UPDATE EXISTING BOOKING
        await updateDoc(doc(db, 'bookings', bookingId), bookingPayload);
        Alert.alert('Success', 'Appointment updated successfully!');
      } else {
        // CREATE NEW BOOKING
        await addDoc(collection(db, 'bookings'), {
          ...bookingPayload,
          barberId,
          shopName: barber?.shopName || 'Barber Shop',
          clientId: auth.currentUser?.uid,
          clientName: auth.currentUser?.displayName || 'Client',
          createdAt: Timestamp.now(),
        });
        Alert.alert('Success', 'Booking confirmed!');
      }
      
      navigation.navigate('MainTabs', { screen: 'MyBookings' });
    } catch (e) {
      Alert.alert('Error', e.message || String(e));
    }
  };

  return (
    <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
      <Text style={styles.header}>
        {editMode ? 'Update Appointment' : (barber?.shopName || 'Book Appointment')}
      </Text>

      <View style={styles.section}>
        <Text style={styles.label}>1. Select a Service</Text>
        <View style={styles.serviceGrid}>
          {barber?.services?.map((s, i) => (
            <TouchableOpacity
              key={i}
              style={[styles.serviceItem, selectedService?.name === s.name && styles.activeItem]}
              onPress={() => setSelectedService(s)}
            >
              <Text style={[styles.serviceText, selectedService?.name === s.name && styles.whiteText]}>{s.name}</Text>
              <Text style={[styles.priceText, selectedService?.name === s.name && styles.whiteText]}>R{s.price}</Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.label}>2. Select Date</Text>
        <TouchableOpacity style={styles.datePickerBtn} onPress={() => setShowCalendar(true)}>
          <Icon name="calendar-outline" size={20} color="#fff" />
          <Text style={styles.dateText}> {date.toDateString()}</Text>
        </TouchableOpacity>
      </View>

      {showCalendar && (
        <View style={styles.calendarWrapper}>
            <View style={styles.calendarHeader}>
                <Text style={styles.calendarHeaderText}>Select Date</Text>
                <TouchableOpacity onPress={() => setShowCalendar(false)}>
                    <Text style={styles.doneText}>Done</Text>
                </TouchableOpacity>
            </View>
            <DateTimePicker
                value={date}
                mode="date"
                display={Platform.OS === 'ios' ? 'inline' : 'calendar'}
                minimumDate={new Date()}
                themeVariant="light"
                onChange={(e, d) => {
                  if (Platform.OS === 'android') setShowCalendar(false);
                  if (d) {
                    setDate(d);
                    setSelectedSlot(null);
                  }
                }}
            />
        </View>
      )}

      <View style={styles.section}>
        <Text style={styles.label}>3. Available Times</Text>
        {loadingSlots ? (
          <ActivityIndicator color="#000" style={{ marginVertical: 20 }} />
        ) : availableSlots.length > 0 ? (
          <View style={styles.slotsGrid}>
            {availableSlots.map((slot, i) => {
              const isSelected = selectedSlot && selectedSlot.getTime() === slot.getTime();
              return (
                <TouchableOpacity
                  key={i}
                  style={[styles.slot, isSelected && styles.activeSlot]}
                  onPress={() => setSelectedSlot(slot)}
                >
                  <Text style={[styles.slotText, isSelected && styles.whiteText]}>
                    {slot.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false })}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        ) : (
          <View style={styles.emptyState}>
             <Icon name="time-outline" size={40} color="#ccc" />
             <Text style={styles.emptyText}>No slots available for this date.</Text>
          </View>
        )}
      </View>

      <TouchableOpacity style={styles.confirmBtn} onPress={handleConfirm}>
        <Text style={styles.confirmText}>{editMode ? 'Save Changes' : 'Confirm Booking'}</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 20, backgroundColor: '#fff' },
  header: { fontSize: 26, fontWeight: 'bold', marginBottom: 25, color: '#000' },
  section: { marginBottom: 25 },
  label: { fontSize: 16, fontWeight: '700', marginBottom: 15, color: '#333' },
  serviceGrid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between' },
  serviceItem: { width: '48%', padding: 15, borderWidth: 1, borderColor: '#eee', borderRadius: 12, marginBottom: 10, backgroundColor: '#f9f9f9' },
  activeItem: { backgroundColor: '#000', borderColor: '#000' },
  serviceText: { fontSize: 14, fontWeight: '600' },
  priceText: { fontSize: 13, color: '#666', marginTop: 4 },
  datePickerBtn: { flexDirection: 'row', padding: 16, backgroundColor: '#000', borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  dateText: { color: '#fff', fontWeight: 'bold', fontSize: 16 },
  calendarWrapper: { backgroundColor: '#ffffff', borderRadius: 15, padding: 10, marginVertical: 15, shadowColor: "#000", shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 4.65, elevation: 8 },
  calendarHeader: { flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 10, paddingBottom: 10, borderBottomWidth: 1, borderBottomColor: '#eee', marginBottom: 5 },
  calendarHeaderText: { fontWeight: 'bold', color: '#333' },
  doneText: { color: '#007AFF', fontWeight: '600' },
  slotsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  slot: { width: '30%', paddingVertical: 12, borderWidth: 1, borderColor: '#eee', borderRadius: 10, alignItems: 'center', backgroundColor: '#f9f9f9' },
  activeSlot: { backgroundColor: '#000', borderColor: '#000' },
  slotText: { fontSize: 14, fontWeight: '500', color: '#333' },
  whiteText: { color: '#fff' },
  emptyState: { alignItems: 'center', marginTop: 10 },
  emptyText: { color: '#999', marginTop: 8 },
  confirmBtn: { backgroundColor: '#28a745', padding: 18, borderRadius: 15, alignItems: 'center', marginTop: 10, marginBottom: 60, elevation: 2 },
  confirmText: { color: '#fff', fontWeight: 'bold', fontSize: 18 }
});