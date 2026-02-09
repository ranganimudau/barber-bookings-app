import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { supabase } from "../../supabase/supabaseClient"; //

export default function EditProfile() {
  const [shopName, setShopName] = useState("");
  const [address, setAddress] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    loadBarberData();
  }, []);

  const loadBarberData = async () => {
    const {
      data: { user },
    } = await supabase.auth.getUser(); //
    const { data } = await supabase
      .from("barbers")
      .select("*")
      .eq("id", user.id)
      .single(); //

    if (data) {
      setShopName(data.shop_name);
      setAddress(data.address);
    }
  };

  const handleSave = async () => {
    setLoading(true);
    const {
      data: { user },
    } = await supabase.auth.getUser();

    const { error } = await supabase.from("barbers").upsert({
      id: user.id,
      shop_name: shopName,
      address: address,
    }); //

    setLoading(false);
    if (error) Alert.alert("Error", error.message);
    else Alert.alert("Success", "Shop profile updated!");
  };

  return (
    <View style={styles.container}>
      <Text style={styles.label}>Shop Name</Text>
      <TextInput
        style={styles.input}
        value={shopName}
        onChangeText={setShopName}
      />

      <Text style={styles.label}>Shop Address</Text>
      <TextInput
        style={styles.input}
        value={address}
        onChangeText={setAddress}
        multiline
      />

      <TouchableOpacity
        style={styles.button}
        onPress={handleSave}
        disabled={loading}
      >
        {loading ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text style={styles.buttonText}>Save Shop Details</Text>
        )}
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 25, backgroundColor: "#fff" },
  label: { fontSize: 14, fontWeight: "bold", marginBottom: 8, color: "#333" },
  input: {
    borderWidth: 1,
    borderColor: "#eee",
    padding: 15,
    borderRadius: 10,
    marginBottom: 20,
    backgroundColor: "#f9f9f9",
  },
  button: {
    backgroundColor: "#000",
    padding: 18,
    borderRadius: 10,
    alignItems: "center",
  },
  buttonText: { color: "#fff", fontWeight: "bold" },
});
