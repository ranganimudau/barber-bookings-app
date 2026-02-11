import React, { useEffect, useState } from "react";
import {
  Alert,
  FlatList,
  StyleSheet,
  Text,
  TouchableOpacity,
  View
} from "react-native";
import Icon from "react-native-vector-icons/Ionicons";
import { supabase } from "../../supabase/supabaseClient";

export default function Appointments() {
  const [bookings, setBookings] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let subscription;

    const setupRealtime = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      fetchBarberBookings(user.id);

      // Listen for NEW bookings targeting this specific barber
      subscription = supabase
        .channel("barber-bookings")
        .on(
          "postgres_changes",
          {
            event: "INSERT",
            schema: "public",
            table: "appointments",
            filter: `barber_id=eq.${user.id}`,
          },
          (payload) => {
            Alert.alert("New Booking!", "A client has just requested a slot.");
            fetchBarberBookings(user.id);
          }
        )
        .subscribe();
    };

    setupRealtime();

    return () => {
      if (subscription) supabase.removeChannel(subscription);
    };
  }, []);

  const fetchBarberBookings = async (userId) => {
    try {
      setLoading(true);
      // Fixed: Updated to match new column names (appointment_date, appointment_time)
      const { data, error } = await supabase
        .from("appointments")
        .select(`
          id,
          appointment_date,
          appointment_time,
          status,
          service_name,
          price,
          profiles!appointments_client_id_fkey (full_name, email)
        `)
        .eq("barber_id", userId)
        .order("appointment_date", { ascending: true });

      if (error) throw error;
      setBookings(data || []);
    } catch (error) {
      console.error("Fetch Error:", error.message);
    } finally {
      setLoading(false);
    }
  };

  const updateStatus = async (appointmentId, newStatus) => {
    try {
      const { error } = await supabase
        .from("appointments")
        .update({ status: newStatus })
        .eq("id", appointmentId);

      if (error) throw error;

      // Optimistically update local state for better speed
      setBookings(prev => 
        prev.map(b => b.id === appointmentId ? { ...b, status: newStatus } : b)
      );
      
      Alert.alert("Success", `Appointment ${newStatus}`);
    } catch (error) {
      Alert.alert("Error", "Could not update status.");
    }
  };

  const renderItem = ({ item }) => (
    <View style={styles.card}>
      <View style={styles.info}>
        <Text style={styles.clientName}>
          {item.profiles?.full_name || "New Client"}
        </Text>
        {/* Display the selected service name */}
        <Text style={styles.serviceText}>
          {item.service_name} — R{item.price}
        </Text>
        <Text style={styles.dateTime}>
          {item.appointment_date} at {item.appointment_time.substring(0, 5)}
        </Text>
        <Text
          style={[
            styles.status,
            { color: item.status === "confirmed" ? "green" : item.status === "cancelled" ? "red" : "orange" },
          ]}
        >
          {item.status.toUpperCase()}
        </Text>
      </View>

      {item.status === "pending" && (
        <View style={styles.actions}>
          <TouchableOpacity
            onPress={() => updateStatus(item.id, "confirmed")}
            style={styles.confirmBtn}
          >
            <Icon name="checkmark-circle" size={35} color="green" />
          </TouchableOpacity>
          <TouchableOpacity onPress={() => updateStatus(item.id, "cancelled")}>
            <Icon name="close-circle" size={35} color="#FF3B30" />
          </TouchableOpacity>
        </View>
      )}
    </View>
  );

  return (
    <View style={styles.container}>
      <Text style={styles.header}>Booking Requests</Text>
      <FlatList
        data={bookings}
        keyExtractor={(item) => item.id}
        renderItem={renderItem}
        onRefresh={async () => {
          const { data: { user } } = await supabase.auth.getUser();
          fetchBarberBookings(user.id);
        }}
        refreshing={loading}
        ListEmptyComponent={
          <Text style={styles.empty}>No appointments scheduled.</Text>
        }
        contentContainerStyle={{ paddingBottom: 40 }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 20, backgroundColor: "#f8f8f8" },
  header: { fontSize: 22, fontWeight: "bold", marginBottom: 20, marginTop: 10, color: "#333" },
  card: {
    backgroundColor: "#fff",
    padding: 18,
    borderRadius: 15,
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 15,
    elevation: 3,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  info: { flex: 1 },
  clientName: { fontSize: 18, fontWeight: "bold", color: "#000" },
  serviceText: { fontSize: 15, color: "#555", marginTop: 2 },
  dateTime: { color: "#888", marginVertical: 4, fontSize: 14 },
  status: { fontWeight: "bold", fontSize: 12, marginTop: 4 },
  actions: { flexDirection: "row", alignItems: "center" },
  confirmBtn: { marginRight: 15 },
  empty: { textAlign: "center", marginTop: 50, color: "#999", fontSize: 16 },
});