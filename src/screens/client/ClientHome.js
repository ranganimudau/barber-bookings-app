import React, { useEffect, useState } from "react";
import {
    ActivityIndicator,
    FlatList,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from "react-native";
import { supabase } from "../../supabase/supabaseClient";

export default function ClientHome({ navigation }) {
  const [barbers, setBarbers] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchBarbers();
  }, []);

  const fetchBarbers = async () => {
    try {
      // Fetch barbers who have completed their shop setup
      const { data, error } = await supabase
        .from("barbers")
        .select("*")
        .eq("is_profile_complete", true);

      if (error) throw error;
      setBarbers(data || []);
    } catch (error) {
      console.error("Error fetching barbers:", error.message);
    } finally {
      setLoading(false);
    }
  };

  const renderBarber = ({ item }) => (
    <TouchableOpacity
      style={styles.card}
      onPress={() => navigation.navigate("BarberProfile", { barberId: item.id })}
    >
      <View>
        <Text style={styles.shopName}>{item.shop_name}</Text>
        <Text style={styles.address}>{item.address}</Text>
      </View>
      <Text style={styles.arrow}>→</Text>
    </TouchableOpacity>
  );

  if (loading) return <ActivityIndicator style={{ flex: 1 }} size="large" />;

  return (
    <View style={styles.container}>
      <Text style={styles.header}>Find a Barber</Text>
      <FlatList
        data={barbers}
        keyExtractor={(item) => item.id}
        renderItem={renderBarber}
        contentContainerStyle={{ paddingBottom: 20 }}
        ListEmptyComponent={<Text style={styles.empty}>No barbers found.</Text>}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#fff", padding: 20 },
  header: { fontSize: 24, fontWeight: "bold", marginBottom: 20, marginTop: 40 },
  card: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: 20,
    backgroundColor: "#f9f9f9",
    borderRadius: 15,
    marginBottom: 15,
    borderWidth: 1,
    borderColor: "#eee",
  },
  shopName: { fontSize: 18, fontWeight: "bold", color: "#000" },
  address: { fontSize: 14, color: "#666", marginTop: 4 },
  arrow: { fontSize: 20, color: "#999" },
  empty: { textAlign: "center", marginTop: 50, color: "#999" },
});