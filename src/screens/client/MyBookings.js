import { useFocusEffect } from '@react-navigation/native';
import React, { useCallback, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  StyleSheet,
  Text,
  TouchableOpacity,
  View
} from "react-native";
import { supabase } from "../../supabase/supabaseClient";

export default function MyBookings({ navigation }) {
  const [bookings, setBookings] = useState([]);
  const [loading, setLoading] = useState(true);

  // Auto-refresh data when user focuses on this tab
  useFocusEffect(
    useCallback(() => {
      fetchMyBookings();
    }, [])
  );

  const fetchMyBookings = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      
      // Fix: Specifically joining with 'barbers' to get shop_name and address
      const { data, error } = await supabase
        .from("appointments")
        .select(`
          *,
          barbers!appointments_barber_id_fkey (shop_name, address)
        `)
        .eq("client_id", user.id)
        .order("appointment_date", { ascending: true });

      if (error) throw error;
      setBookings(data || []);
    } catch (error) {
      // This will no longer throw the "column profiles_1.shop_name does not exist" error
      Alert.alert("Error", error.message);
    } finally {
      setLoading(false);
    }
  };

  // Logic to restrict editing within 48 hours of the appointment
  const canModify = (appointmentDate) => {
    const today = new Date();
    today.setHours(0, 0, 0, 0); 
    const targetDate = new Date(appointmentDate);
    const diffInTime = targetDate.getTime() - today.getTime();
    const diffInDays = diffInTime / (1000 * 3600 * 24);
    return diffInDays >= 2; 
  };

  const cancelBooking = async (id) => {
    Alert.alert("Cancel Appointment", "Are you sure you want to cancel?", [
      { text: "No" },
      {
        text: "Yes, Cancel",
        onPress: async () => {
          const { error } = await supabase
            .from("appointments")
            .update({ status: 'cancelled' })
            .eq("id", id);

          if (!error) {
            Alert.alert("Cancelled", "Your appointment has been removed.");
            fetchMyBookings();
          }
        }
      }
    ]);
  };

  const renderItem = ({ item }) => {
    const modifiable = canModify(item.appointment_date);

    return (
      <View style={styles.card}>
        <View style={styles.header}>
          {/* Accessing shop_name via the barbers join */}
          <Text style={styles.shopName}>{item.barbers?.shop_name || "Barber Shop"}</Text>
          <Text style={[
            styles.status, 
            { color: item.status === 'confirmed' ? 'green' : item.status === 'cancelled' ? 'red' : 'orange' }
          ]}>
            {item.status?.toUpperCase()}
          </Text>
        </View>
        
        <Text style={styles.detail}>{item.service_name} — R{item.price}</Text>
        <Text style={styles.time}>{item.appointment_date} at {item.appointment_time?.substring(0, 5)}</Text>

        {modifiable && item.status !== 'cancelled' ? (
          <View style={styles.actionRow}>
            <TouchableOpacity 
              style={styles.editBtn} 
              onPress={() => {
                // Nested Navigation: Navigate to the Find tab, then the BarberProfile screen
                navigation.navigate("Find", { 
                  screen: "BarberProfile", 
                  params: { 
                    barberId: item.barber_id, 
                    editMode: true, 
                    appointmentId: item.id 
                  }
                });
              }}
            >
              <Text style={styles.btnText}>Edit Time</Text>
            </TouchableOpacity>
            
            <TouchableOpacity style={styles.cancelBtn} onPress={() => cancelBooking(item.id)}>
              <Text style={styles.btnText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        ) : item.status !== 'cancelled' ? (
          <Text style={styles.lockText}>Rescheduling locked (within 48h)</Text>
        ) : null}
      </View>
    );
  };

  if (loading) return <ActivityIndicator style={styles.loader} size="large" color="#000" />;

  return (
    <View style={styles.container}>
      <FlatList
        data={bookings}
        keyExtractor={(item) => item.id}
        renderItem={renderItem}
        onRefresh={fetchMyBookings}
        refreshing={loading}
        contentContainerStyle={{ paddingBottom: 20 }}
        ListEmptyComponent={<Text style={styles.empty}>No upcoming appointments found.</Text>}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#f8f8f8", padding: 15 },
  loader: { flex: 1, justifyContent: 'center' },
  card: { 
    backgroundColor: "#fff", 
    padding: 20, 
    borderRadius: 15, 
    marginBottom: 15, 
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4
  },
  header: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 10 },
  shopName: { fontSize: 18, fontWeight: 'bold', color: '#000' },
  status: { fontWeight: 'bold', fontSize: 12 },
  detail: { fontSize: 16, color: '#444' },
  time: { fontSize: 14, color: '#888', marginTop: 5 },
  actionRow: { flexDirection: 'row', marginTop: 15, gap: 10 },
  editBtn: { backgroundColor: '#000', padding: 12, borderRadius: 10, flex: 1, alignItems: 'center' },
  cancelBtn: { backgroundColor: '#ff3b30', padding: 12, borderRadius: 10, flex: 1, alignItems: 'center' },
  btnText: { color: '#fff', fontWeight: 'bold' },
  lockText: { marginTop: 15, fontSize: 12, color: '#999', fontStyle: 'italic', textAlign: 'center' },
  empty: { textAlign: 'center', marginTop: 100, color: '#999', fontSize: 16 }
});