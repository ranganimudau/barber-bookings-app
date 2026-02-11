import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, StyleSheet, Text, View } from 'react-native';
import { supabase } from "../../supabase/supabaseClient";

export default function BarberEarnings() {
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    calculateEarnings();
  }, []);

  const calculateEarnings = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      
      // Fetch only confirmed appointments to calculate revenue
      const { data, error } = await supabase
        .from('appointments')
        .select('price')
        .eq('barber_id', user.id)
        .eq('status', 'confirmed');

      if (error) throw error;

      const sum = data.reduce((acc, curr) => acc + (curr.price || 0), 0);
      setTotal(sum);
    } catch (error) {
      Alert.alert("Error", error.message);
    } finally {
      setLoading(false);
    }
  };

  if (loading) return <ActivityIndicator style={styles.loader} size="large" />;

  return (
    <View style={styles.container}>
      <Text style={styles.label}>Total Confirmed Earnings</Text>
      <Text style={styles.amount}>R{total.toFixed(2)}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#f8f8f8' },
  loader: { flex: 1, justifyContent: 'center' },
  label: { fontSize: 18, color: '#666' },
  amount: { fontSize: 48, fontWeight: 'bold', color: '#000', marginTop: 10 }
});