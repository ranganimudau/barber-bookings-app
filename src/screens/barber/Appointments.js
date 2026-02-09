import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import Icon from "react-native-vector-icons/Ionicons";
import { supabase } from "../../supabase/supabaseClient";

export default function Appointments() {
  const [bookings, setBookings] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let subscription;

    const setupRealtime = async () => {
      // 1. Get current logged-in user
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;

      // 2. Fetch initial data
      fetchBarberBookings(user.id);

      // 3. Listen for NEW bookings in real-time
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
            Alert.alert("New Booking!", "A client has just booked a slot.");
            fetchBarberBookings(user.id); // Refresh list
          },
        )
        .subscribe();
    };

    setupRealtime();

    // Cleanup subscription on unmount
    return () => {
      if (subscription) supabase.removeChannel(subscription);
    };
  }, []);

  const fetchBarberBookings = async (userId) => {
    try {
      setLoading(true);
      // Fetch appointments and join with client profiles
      const { data, error } = await supabase
        .from("appointments")
        .select(
          `
          id,
          date,
          time,
          status,
          client_id,
          profiles!appointments_client_id_fkey (full_name, email)
        `,
        )
        .eq("barber_id", userId)
        .order("date", { ascending: true });

      if (error) throw error;
      setBookings(data || []);
    } catch (error) {
      console.error("Error:", error.message);
    } finally {
      setLoading(false);
    }
  };

  const updateStatus = async (appointmentId, newStatus) => {
    const { error } = await supabase
      .from("appointments")
      .update({ status: newStatus })
      .eq("id", appointmentId);

    if (error) {
      Alert.alert("Error", "Could not update status.");
    } else {
      // Refresh list locally
      const {
        data: { user },
      } = await supabase.auth.getUser();
      fetchBarberBookings(user.id);
    }
  };

  const renderItem = ({ item }) => (
    <View style={styles.card}>
      <View style={styles.info}>
        <Text style={styles.clientName}>
          {item.profiles?.full_name || "New Client"}
        </Text>
        <Text style={styles.dateTime}>
          {item.date} at {item.time}
        </Text>
        <Text
          style={[
            styles.status,
            { color: item.status === "confirmed" ? "green" : "orange" },
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
            <Icon name="checkmark-circle" size={30} color="green" />
          </TouchableOpacity>
          <TouchableOpacity onPress={() => updateStatus(item.id, "cancelled")}>
            <Icon name="close-circle" size={30} color="#FF3B30" />
          </TouchableOpacity>
        </View>
      )}
    </View>
  );

  if (loading && bookings.length === 0) {
    return <ActivityIndicator size="large" color="#000" style={{ flex: 1 }} />;
  }

  return (
    <View style={styles.container}>
      <Text style={styles.header}>Upcoming Appointments</Text>
      <FlatList
        data={bookings}
        keyExtractor={(item) => item.id}
        renderItem={renderItem}
        onRefresh={async () => {
          const {
            data: { user },
          } = await supabase.auth.getUser();
          fetchBarberBookings(user.id);
        }}
        refreshing={loading}
        ListEmptyComponent={
          <Text style={styles.empty}>No appointments found.</Text>
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 20, backgroundColor: "#f9f9f9" },
  header: { fontSize: 22, fontWeight: "bold", marginBottom: 20, marginTop: 40 },
  card: {
    backgroundColor: "#fff",
    padding: 15,
    borderRadius: 12,
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 15,
    elevation: 2,
  },
  clientName: { fontSize: 18, fontWeight: "bold" },
  dateTime: { color: "#666", marginVertical: 4 },
  status: { fontWeight: "bold", fontSize: 12 },
  actions: { flexDirection: "row", alignItems: "center" },
  confirmBtn: { marginRight: 15 },
  empty: { textAlign: "center", marginTop: 50, color: "#999" },
});
