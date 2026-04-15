import React, { useEffect, useState } from "react";
import {
    ActivityIndicator, Alert, FlatList, Image, Linking,
    StyleSheet, Text, TouchableOpacity, View
} from "react-native";
import Icon from "react-native-vector-icons/Ionicons";
import { supabase } from "../../supabase/supabaseClient";
import { colors } from "../../theme/clientTheme";

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

      // Fetch appointments then load client profiles separately (more robust across schemas)
      const { data: appts, error: apptErr } = await supabase
        .from('appointments')
        .select('*')
        .eq('barber_id', user.id)
        .order('appointment_date', { ascending: true });
      if (apptErr) throw apptErr;
      console.log('BookingRequests - appts:', appts);

      const clientIds = Array.from(new Set((appts || []).map(a => a.client_id).filter(Boolean)));
      let profilesMap = {};
      if (clientIds.length) {
        const { data: profiles, error: profErr } = await supabase
          .from('profiles')
          .select('id, full_name, phone_number, avatar_url')
          .in('id', clientIds);
        if (profErr) throw profErr;
        console.log('BookingRequests - profiles:', profiles);
        profilesMap = (profiles || []).reduce((m, p) => ({ ...m, [p.id]: p }), {});
      }

      const merged = (appts || []).map(a => ({
        ...a,
        client_full_name: profilesMap[a.client_id]?.full_name || `New Client (${a.client_id || 'no-id'})`,
        client_phone: profilesMap[a.client_id]?.phone_number || null,
        client_avatar_url: profilesMap[a.client_id]?.avatar_url || null,
      }));
      console.log('BookingRequests - merged:', merged);
      setRequests(merged);
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
    // Use merged client fields (from profiles) if available
    const clientName = item.client_full_name || "Unknown Client";
    const clientPhone = item.client_phone || null;
    const clientAvatar = item.client_avatar_url || null;

    return (
      <View style={styles.card}>
        <View style={styles.header}>
          <View style={styles.clientHead}>
            {clientAvatar ? (
              <Image source={{ uri: clientAvatar }} style={styles.avatar} />
            ) : (
              <View style={styles.avatarFallback}>
                <Icon name="person" size={18} color={colors.textMuted} />
              </View>
            )}
            <View>
              <Text style={styles.clientLabel}>Client</Text>
              <Text style={styles.clientName}>{clientName}</Text>
            </View>
          </View>
          <Text style={[styles.status, { color: item.status === 'confirmed' ? '#22C55E' : colors.accent }]}>
            {item.status.toUpperCase()}
          </Text>
        </View>

        <View style={styles.detailRow}>
          <Icon name="cut-outline" size={16} color={colors.textMuted} />
          <Text style={styles.detailText}>{item.service_name} — R{item.price}</Text>
        </View>

        <View style={styles.detailRow}>
          <Icon name="calendar-outline" size={16} color={colors.textMuted} />
          <Text style={styles.detailText}>
            {item.appointment_date} at {item.appointment_time?.substring(0, 5)}
          </Text>
        </View>

        {/* NEW: Contact Section */}
        <View style={styles.contactSection}>
          {clientPhone ? (
            <TouchableOpacity 
              style={styles.contactBtn} 
              onPress={() => Linking.openURL(`tel:${clientPhone}`)}
            >
              <Icon name="call" size={18} color="#28a745" />
              <Text style={styles.contactText}>Call Client: {clientPhone}</Text>
            </TouchableOpacity>
          ) : (
            <Text style={{ color: colors.textMuted }}>No phone provided</Text>
          )}
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

  if (loading) return <ActivityIndicator style={styles.loader} size="large" color={colors.accent} />;

  return (
    <View style={styles.container}>
      <Text style={styles.pageTitle}>Booking Requests</Text>
      <FlatList
        data={requests}
        keyExtractor={(item) => item.id?.toString()}
        renderItem={renderItem}
        onRefresh={fetchRequests}
        refreshing={loading}
        ListEmptyComponent={<Text style={styles.empty}>No booking requests yet.</Text>}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background, padding: 15 },
  pageTitle: { fontSize: 22, fontWeight: '800', marginBottom: 20, marginTop: 40, color: colors.accent },
  loader: { flex: 1, justifyContent: 'center' },
  card: { backgroundColor: "rgba(255,255,255,0.03)", padding: 20, borderRadius: 15, marginBottom: 15, elevation: 1, borderWidth: 1, borderColor: 'rgba(197,160,112,0.25)' },
  header: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 15 },
  clientHead: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  avatar: { width: 42, height: 42, borderRadius: 21, backgroundColor: 'rgba(255,255,255,0.06)' },
  avatarFallback: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: 'rgba(255,255,255,0.04)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  clientLabel: { fontSize: 10, color: colors.textMuted, textTransform: 'uppercase' },
  clientName: { fontSize: 18, fontWeight: '800', color: '#F5F5F0' },
  status: { fontWeight: 'bold', fontSize: 12 },
  detailRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 5 },
  detailText: { fontSize: 15, color: '#F5F5F0' },
  contactSection: { marginTop: 15, paddingTop: 10, borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.08)' },
  contactBtn: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  contactText: { color: '#28a745', fontWeight: 'bold' },
  actionRow: { flexDirection: 'row', marginTop: 20, gap: 10 },
  acceptBtn: { flex: 1, backgroundColor: '#22C55E', padding: 12, borderRadius: 10, alignItems: 'center' },
  declineBtn: { flex: 1, backgroundColor: 'rgba(255,255,255,0.03)', borderWidth: 1, borderColor: '#ff3b30', padding: 12, borderRadius: 10, alignItems: 'center' },
  btnText: { color: '#fff', fontWeight: 'bold' },
  declineText: { color: '#ff3b30', fontWeight: 'bold' },
  empty: { textAlign: 'center', marginTop: 50, color: colors.textMuted }
});