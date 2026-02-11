import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, FlatList, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { supabase } from "../../supabase/supabaseClient";

export default function BarberDashboard() {
  const [appointments, setAppointments] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchAppointments();
  }, []);

  const fetchAppointments = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      const { data, error } = await supabase
        .from('appointments')
        .select(`
          *,
          profiles!appointments_client_id_fkey (full_name, phone_number, avatar_url)
        `)
        .eq('barber_id', user.id)
        .order('appointment_date', { ascending: true });

      if (error) throw error;
      setAppointments(data || []);
    } catch (error) {
      Alert.alert("Error", error.message);
    } finally {
      setLoading(false);
    }
  };

  const updateStatus = async (id, newStatus) => {
    const { error } = await supabase
      .from('appointments')
      .update({ status: newStatus })
      .eq('id', id);

    if (!error) {
      Alert.alert("Success", `Appointment ${newStatus}`);
      fetchAppointments();
    }
  };

  const renderItem = ({ item }) => (
    <View style={styles.card}>
      <Text style={styles.clientName}>{item.profiles?.full_name}</Text>
      <Text style={styles.service}>{item.service_name} — R{item.price}</Text>
      <Text style={styles.dateTime}>{item.appointment_date} at {item.appointment_time.substring(0,5)}</Text>
      
      {item.status === 'pending' && (
        <View style={styles.btnRow}>
          <TouchableOpacity style={styles.confirmBtn} onPress={() => updateStatus(item.id, 'confirmed')}>
            <Text style={styles.btnText}>Confirm</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.declineBtn} onPress={() => updateStatus(item.id, 'declined')}>
            <Text style={styles.btnText}>Decline</Text>
          </TouchableOpacity>
        </View>
      )}
      {item.status !== 'pending' && (
        <Text style={[styles.statusText, { color: item.status === 'confirmed' ? 'green' : 'red' }]}>
          {item.status.toUpperCase()}
        </Text>
      )}
    </View>
  );

  if (loading) return <ActivityIndicator style={{ flex: 1 }} size="large" />;

  return (
    <View style={styles.container}>
      <FlatList
        data={appointments}
        keyExtractor={(item) => item.id}
        renderItem={renderItem}
        onRefresh={fetchAppointments}
        refreshing={loading}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f4f4f4', padding: 15 },
  card: { backgroundColor: '#fff', padding: 20, borderRadius: 12, marginBottom: 15, elevation: 2 },
  clientName: { fontSize: 18, fontWeight: 'bold' },
  service: { fontSize: 16, marginVertical: 5 },
  dateTime: { color: '#666', marginBottom: 10 },
  btnRow: { flexDirection: 'row', gap: 10, marginTop: 10 },
  confirmBtn: { flex: 1, backgroundColor: '#000', padding: 12, borderRadius: 8, alignItems: 'center' },
  declineBtn: { flex: 1, backgroundColor: '#ff3b30', padding: 12, borderRadius: 8, alignItems: 'center' },
  btnText: { color: '#fff', fontWeight: 'bold' },
  statusText: { fontWeight: 'bold', marginTop: 10, textAlign: 'right' }
});