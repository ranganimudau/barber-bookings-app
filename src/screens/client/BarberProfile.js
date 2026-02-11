import React, { useEffect, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, View } from 'react-native';
import { supabase } from '../../supabase/supabaseClient';

export default function BarberProfile({ route }) {
  const { barberId } = route.params; // The ID from your error logs
  const [services, setServices] = useState([]);
  const [shop, setShop] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchBarberData();
  }, []);

  const fetchBarberData = async () => {
    // 1. Fetch Shop Info & Global Hours
    const { data: barber } = await supabase
      .from('barbers')
      .select('*')
      .eq('id', barberId)
      .single();

    // 2. Fetch Services & Prices
    const { data: svc } = await supabase
      .from('barber_services')
      .select('*')
      .eq('barber_id', barberId);

    setShop(barber);
    setServices(svc || []);
    setLoading(false);
  };

  if (loading) return <ActivityIndicator style={{ flex: 1 }} />;

  return (
    <ScrollView style={styles.container}>
      <Text style={styles.shopName}>{shop?.shop_name}</Text>
      <Text style={styles.address}>{shop?.address}</Text>
      
      <Text style={styles.sectionHeader}>Our Services</Text>
      {services.map(item => (
        <View key={item.id} style={styles.serviceRow}>
          <Text>{item.service_name}</Text>
          <Text style={styles.price}>R{item.price}</Text>
        </View>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 20, backgroundColor: '#fff' },
  shopName: { fontSize: 24, fontWeight: 'bold' },
  address: { color: '#666', marginBottom: 20 },
  sectionHeader: { fontSize: 18, fontWeight: 'bold', marginTop: 20, marginBottom: 10 },
  serviceRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: '#eee' },
  price: { fontWeight: 'bold' }
});