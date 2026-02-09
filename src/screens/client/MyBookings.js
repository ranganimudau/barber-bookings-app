import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  StyleSheet,
  Text,
  View
} from "react-native";
import Icon from "react-native-vector-icons/Ionicons";
import { supabase } from "../../supabase/supabaseClient"; //

export default function MyBookings() {
  const [bookings, setBookings] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchMyBookings();
  }, []);

  const fetchMyBookings = async () => {
    try {
      setLoading(true);
      // 1. Get the current logged-in user
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) return;

      // 2. Fetch bookings and join with barber details
      const { data, error } = await supabase
        .from("appointments")
        .select(
          `
          id,
          date,
          time,
          status,
          barber_id,
          barbers (shop_name, address)
        `,
        )
        .eq("client_id", user.id)
        .order("date", { ascending: true });

      if (error) throw error;
      setBookings(data || []);
    } catch (error) {
      console.error("Error fetching bookings:", error.message);
      Alert.alert("Error", "Could not load your bookings.");
    } finally {
      setLoading(false);
    }
  };

  const renderBookingItem = ({ item }) => (
    <View style={styles.card}>
      <View style={styles.cardHeader}>
        <Text style={styles.shopName}>
          {item.barbers?.shop_name || "Barber Shop"}
        </Text>
        <View
          style={[
            styles.statusBadge,
            {
              backgroundColor:
                item.status === "confirmed" ? "#4CAF50" : "#FF9800",
            },
          ]}
        >
          <Text style={styles.statusText}>{item.status.toUpperCase()}</Text>
        </View>
      </View>

      <View style={styles.detailsRow}>
        <Icon name="calendar-outline" size={16} color="#666" />
        <Text style={styles.detailText}>{item.date}</Text>
        <Icon
          name="time-outline"
          size={16}
          color="#666"
          style={{ marginLeft: 15 }}
        />
        <Text style={styles.detailText}>{item.time}</Text>
      </View>

      <Text style={styles.addressText}>{item.barbers?.address}</Text>
    </View>
  );

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#000" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>My Appointments</Text>
      <FlatList
        data={bookings}
        keyExtractor={(item) => item.id}
        renderItem={renderBookingItem}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyText}>No upcoming bookings found.</Text>
          </View>
        }
        onRefresh={fetchMyBookings}
        refreshing={loading}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#f8f9fa", padding: 20 },
  center: { flex: 1, justifyContent: "center", alignItems: "center" },
  title: { fontSize: 24, fontWeight: "bold", marginBottom: 20, marginTop: 40 },
  card: {
    backgroundColor: "#fff",
    borderRadius: 15,
    padding: 15,
    marginBottom: 15,
    elevation: 3,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
  },
  cardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 10,
  },
  shopName: { fontSize: 18, fontWeight: "bold" },
  statusBadge: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 5 },
  statusText: { color: "#fff", fontSize: 10, fontWeight: "bold" },
  detailsRow: { flexDirection: "row", alignItems: "center", marginBottom: 8 },
  detailText: { marginLeft: 5, color: "#444", fontSize: 14 },
  addressText: { color: "#888", fontSize: 12 },
  emptyContainer: { alignItems: "center", marginTop: 50 },
  emptyText: { color: "#999", fontSize: 16 },
});
