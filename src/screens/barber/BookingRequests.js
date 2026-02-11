import React, { useEffect, useState } from "react";
import {
    ActivityIndicator, Alert, FlatList, Linking,
    StyleSheet, Text, TouchableOpacity, View
} from "react-native";
import Icon from "react-native-vector-icons/Ionicons";
import { supabase } from "../../supabase/supabaseClient";

export default function BookingRequests() {
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchRequests();
  }, []);

  const fetchRequests = async () => {
    try {
      setLoading(true);
      const { data: { user } } = await supabase.auth.getUser();

      // UPDATED FETCH: Joining with profiles to get client name and phone
      const { data, error } = await supabase
        .from("appointments")
        .select(`
          *,
          profiles!appointments_client_id_fkey (
            full_name,
            phone_number
          )
        `)
        .eq("barber_id", user.id)
        .order("appointment_date", { ascending: true });

      if (error) throw error;
      setRequests(data || []);
    } catch (error) {
      Alert.alert("Error", error.message);
    } finally {
      setLoading(false);
    }
  };

  const updateStatus = async (id, newStatus) => {
    try {
      const { error } = await supabase
        .from("appointments")
        .update({ status: newStatus })
        .eq("id", id);

      if (error) throw error;
      Alert.alert("Success", `Appointment ${newStatus}`);
      fetchRequests();
    } catch (error) {
      Alert.alert("Error", error.message);
    }
  };

  const renderItem = ({ item }) => {
    // Extracting client info from the joined profile
    const clientName = item.profiles?.full_name || "Unknown Client";
    const clientPhone = item.profiles?.phone_number || "No Phone Provided";

    return (
      <View style={styles.card}>
        <View style={styles.header}>
          <View>
            <Text style={styles.clientLabel}>Client</Text>
            <Text style={styles.clientName}>{clientName}</Text>
          </View>
          <Text style={[styles.status, { color: item.status === 'confirmed' ? 'green' : 'orange' }]}>
            {item.status.toUpperCase()}
          </Text>
        </View>

        <View style={styles.detailRow}>
          <Icon name="cut-outline" size={16} color="#666" />
          <Text style={styles.detailText}>{item.service_name} — R{item.price}</Text>
        </View>

        <View style={styles.detailRow}>
          <Icon name="calendar-outline" size={16} color="#666" />
          <Text style={styles.detailText}>
            {item.appointment_date} at {item.appointment_time?.substring(0, 5)}
          </Text>
        </View>

        {/* NEW: Contact Section */}
        <View style={styles.contactSection}>
          <TouchableOpacity 
            style={styles.contactBtn} 
            onPress={() => Linking.openURL(`tel:${clientPhone}`)}
          >
            <Icon name="call" size={18} color="#28a745" />
            <Text style={styles.contactText}>Call Client: {clientPhone}</Text>
          </TouchableOpacity>
        </View>

        {item.status === 'pending' && (
          <View style={styles.actionRow}>
            <TouchableOpacity style={styles.acceptBtn} onPress={() => updateStatus(item.id, 'confirmed')}>
              <Text style={styles.btnText}>Accept</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.declineBtn} onPress={() => updateStatus(item.id, 'declined')}>
              <Text style={styles.declineText}>Decline</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>
    );
  };

  if (loading) return <ActivityIndicator style={styles.loader} size="large" color="#000" />;

  return (
    <View style={styles.container}>
      <Text style={styles.pageTitle}>Booking Requests</Text>
      <FlatList
        data={requests}
        keyExtractor={(item) => item.id}
        renderItem={renderItem}
        onRefresh={fetchRequests}
        refreshing={loading}
        ListEmptyComponent={<Text style={styles.empty}>No booking requests yet.</Text>}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#f8f8f8", padding: 15 },
  pageTitle: { fontSize: 22, fontWeight: 'bold', marginBottom: 20, marginTop: 40 },
  loader: { flex: 1, justifyContent: 'center' },
  card: { backgroundColor: "#fff", padding: 20, borderRadius: 15, marginBottom: 15, elevation: 3 },
  header: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 15 },
  clientLabel: { fontSize: 10, color: '#aaa', textTransform: 'uppercase' },
  clientName: { fontSize: 18, fontWeight: 'bold' },
  status: { fontWeight: 'bold', fontSize: 12 },
  detailRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 5 },
  detailText: { fontSize: 15, color: '#444' },
  contactSection: { marginTop: 15, paddingTop: 10, borderTopWidth: 1, borderTopColor: '#eee' },
  contactBtn: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  contactText: { color: '#28a745', fontWeight: 'bold' },
  actionRow: { flexDirection: 'row', marginTop: 20, gap: 10 },
  acceptBtn: { flex: 1, backgroundColor: '#000', padding: 12, borderRadius: 10, alignItems: 'center' },
  declineBtn: { flex: 1, backgroundColor: '#fff', borderWidth: 1, borderColor: '#ff3b30', padding: 12, borderRadius: 10, alignItems: 'center' },
  btnText: { color: '#fff', fontWeight: 'bold' },
  declineText: { color: '#ff3b30', fontWeight: 'bold' },
  empty: { textAlign: 'center', marginTop: 50, color: '#999' }
});