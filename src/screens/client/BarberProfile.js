import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Calendar } from 'react-native-calendars';
import { supabase } from '../../supabase/supabaseClient';

export default function BarberProfile({ route, navigation }) {
  // Destructure editMode and appointmentId from params
  const { barberId, editMode, appointmentId } = route.params; 
  const [services, setServices] = useState([]);
  const [shop, setShop] = useState(null);
  const [selectedService, setSelectedService] = useState(null);
  const [selectedDate, setSelectedDate] = useState('');
  const [selectedTime, setSelectedTime] = useState(null);
  const [availableSlots, setAvailableSlots] = useState([]);
  const [loading, setLoading] = useState(true);
  const [booking, setBooking] = useState(false);

  const today = new Date().toISOString().split('T')[0];

  useEffect(() => {
    fetchBarberData();
  }, []);

  useEffect(() => {
    if (selectedDate && shop) {
      generateTimeSlots();
    }
  }, [selectedDate, shop]);

  const fetchBarberData = async () => {
    try {
      const { data: barber } = await supabase.from('barbers').select('*').eq('id', barberId).single();
      const { data: svc } = await supabase.from('barber_services').select('*').eq('barber_id', barberId);
      setShop(barber);
      setServices(svc || []);
    } catch (error) {
      Alert.alert("Error", "Could not load profile.");
    } finally {
      setLoading(false);
    }
  };

  const generateTimeSlots = async () => {
    try {
      const { data: booked } = await supabase
        .from('appointments')
        .select('appointment_time')
        .eq('barber_id', barberId)
        .eq('appointment_date', selectedDate)
        .neq('status', 'cancelled');

      const takenTimes = booked?.map(b => b.appointment_time.substring(0, 5)) || [];
      const startStr = shop?.default_opening || "08:00";
      const endStr = shop?.default_closing || "17:00";

      const slots = [];
      let current = new Date(`2026-01-01T${startStr.substring(0,5)}:00`);
      const end = new Date(`2026-01-01T${endStr.substring(0,5)}:00`);

      while (current < end) {
        const timeLabel = current.toTimeString().substring(0, 5);
        if (!takenTimes.includes(timeLabel)) {
          slots.push(timeLabel);
        }
        current.setMinutes(current.getMinutes() + 30);
      }
      setAvailableSlots(slots);
    } catch (error) {
      console.error("Slot error:", error);
    }
  };

  const handleBooking = async () => {
    if (!selectedService || !selectedDate || !selectedTime) {
      Alert.alert("Error", "Select service, date, and time.");
      return;
    }
    setBooking(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      
      const appointmentData = {
        appointment_date: selectedDate,
        appointment_time: selectedTime,
        service_name: selectedService.service_name,
        price: selectedService.price,
        status: 'pending' // Rescheduling sets status back to pending for approval
      };

      if (editMode && appointmentId) {
        // UPDATE: Change the existing record
        const { error } = await supabase
          .from('appointments')
          .update(appointmentData)
          .eq('id', appointmentId);

        if (error) throw error;
        Alert.alert("Success!", "Appointment rescheduled.");
      } else {
        // INSERT: Create a brand new record
        const { error } = await supabase.from('appointments').insert([{
          ...appointmentData,
          barber_id: barberId,
          client_id: user.id,
        }]);

        if (error) throw error;
        Alert.alert("Success!", "Appointment requested.");
      }

      // Navigate back to the bookings tab to see the change
      navigation.navigate("My Bookings"); 
    } catch (error) {
      Alert.alert("Booking Failed", error.message);
    } finally {
      setBooking(false);
    }
  };

  if (loading) return <ActivityIndicator style={{flex:1}} size="large" color="#000" />;

  return (
    <ScrollView style={styles.container}>
      <View style={styles.headerCard}>
        <Text style={styles.shopName}>{shop?.shop_name}</Text>
        <Text style={styles.address}>{shop?.address}</Text>
        {editMode && (
          <View style={styles.editBadge}>
            <Text style={styles.editBadgeText}>Rescheduling Appointment</Text>
          </View>
        )}
      </View>

      <Text style={styles.sectionHeader}>1. Select Service</Text>
      <View style={styles.card}>
        {services.map(item => (
          <TouchableOpacity 
            key={item.id} 
            style={[styles.serviceRow, selectedService?.id === item.id && styles.selectedRow]}
            onPress={() => setSelectedService(item)}
          >
            <Text style={styles.serviceText}>{item.service_name}</Text>
            <Text style={styles.price}>R{item.price}</Text>
          </TouchableOpacity>
        ))}
      </View>

      <Text style={styles.sectionHeader}>2. Choose Date</Text>
      <Calendar
        minDate={today}
        onDayPress={(day) => setSelectedDate(day.dateString)}
        markedDates={{ [selectedDate]: { selected: true, selectedColor: '#000' } }}
        theme={{ todayTextColor: '#000', selectedDayBackgroundColor: '#000' }}
      />

      {selectedDate && (
        <>
          <Text style={styles.sectionHeader}>3. Available Times</Text>
          <View style={styles.slotsContainer}>
            {availableSlots.map(time => (
              <TouchableOpacity 
                key={time} 
                style={[styles.slot, selectedTime === time && styles.selectedSlot]}
                onPress={() => setSelectedTime(time)}
              >
                <Text style={{color: selectedTime === time ? '#fff' : '#000'}}>{time}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </>
      )}

      <TouchableOpacity 
        style={[styles.bookBtn, (!selectedTime) && {backgroundColor: '#ccc'}]} 
        onPress={handleBooking}
        disabled={booking || !selectedTime}
      >
        {booking ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text style={styles.bookBtnText}>
            {editMode ? "Confirm Reschedule" : "Confirm Booking"}
          </Text>
        )}
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 20, backgroundColor: '#f8f8f8' },
  headerCard: { backgroundColor: '#fff', padding: 20, borderRadius: 15, marginBottom: 20 },
  shopName: { fontSize: 24, fontWeight: 'bold' },
  address: { color: '#666' },
  editBadge: { backgroundColor: '#fff3cd', padding: 8, borderRadius: 8, marginTop: 10, borderWidth: 1, borderColor: '#ffeeba' },
  editBadgeText: { color: '#856404', fontWeight: 'bold', textAlign: 'center', fontSize: 12 },
  sectionHeader: { fontSize: 18, fontWeight: 'bold', marginVertical: 15 },
  card: { backgroundColor: '#fff', borderRadius: 15, padding: 10 },
  serviceRow: { flexDirection: 'row', justifyContent: 'space-between', padding: 15, borderRadius: 10 },
  selectedRow: { backgroundColor: '#f0f0f0', borderWidth: 1, borderColor: '#000' },
  serviceText: { fontSize: 16 },
  price: { fontWeight: 'bold' },
  slotsContainer: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between' },
  slot: { width: '23%', padding: 12, backgroundColor: '#fff', borderRadius: 8, marginBottom: 10, alignItems: 'center', borderWidth: 1, borderColor: '#eee' },
  selectedSlot: { backgroundColor: '#000' },
  bookBtn: { backgroundColor: '#000', padding: 20, borderRadius: 15, alignItems: 'center', marginVertical: 30 },
  bookBtnText: { color: '#fff', fontWeight: 'bold' }
});