import React, { useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useGuestMode } from "../../context/GuestModeContext";
import { supabase } from "../../supabase/supabaseClient"; //

// Available time slots (You can later make these dynamic based on barber availability)
const TIME_SLOTS = [
  "09:00",
  "10:00",
  "11:00",
  "12:00",
  "14:00",
  "15:00",
  "16:00",
];

export default function BookingScreen({ route, navigation }) {
  const { barberId, shopName } = route.params; // Passed from MapScreen
  const { requireAccount } = useGuestMode();
  const [selectedDate] = useState("2026-02-10"); // Example date
  const [selectedTime, setSelectedTime] = useState(null);
  const [loading, setLoading] = useState(false);

  const handleConfirmBooking = async () => {
    if (requireAccount("book an appointment")) return;

    if (!selectedTime) {
      Alert.alert("Error", "Please select a time slot.");
      return;
    }

    setLoading(true);

    try {
      // 1. Get current logged-in user
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) throw new Error("Please log in to book.");

      // 2. Insert appointment into Supabase
      const { error } = await supabase.from("appointments").insert([
        {
          client_id: user.id,
          barber_id: barberId,
          date: selectedDate,
          time: selectedTime,
          status: "pending", // Default status
        },
      ]);

      if (error) throw error;

      Alert.alert("Success", "Booking request sent to " + shopName);
      navigation.navigate("Bookings"); // Redirect to MyBookings
    } catch (error) {
      Alert.alert("Booking Error", error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.header}>Book with {shopName}</Text>
      <Text style={styles.label}>Select a Time for Feb 10, 2026:</Text>

      <FlatList
        data={TIME_SLOTS}
        numColumns={3}
        keyExtractor={(item) => item}
        renderItem={({ item }) => (
          <TouchableOpacity
            style={[
              styles.timeBtn,
              selectedTime === item && styles.selectedBtn,
            ]}
            onPress={() => setSelectedTime(item)}
          >
            <Text
              style={[
                styles.timeText,
                selectedTime === item && styles.whiteText,
              ]}
            >
              {item}
            </Text>
          </TouchableOpacity>
        )}
      />

      <TouchableOpacity
        style={styles.confirmButton}
        onPress={handleConfirmBooking}
        disabled={loading}
      >
        {loading ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text style={styles.buttonText}>Confirm Booking</Text>
        )}
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 25, backgroundColor: "#fff" },
  header: { fontSize: 24, fontWeight: "bold", marginBottom: 10, marginTop: 40 },
  label: { fontSize: 16, color: "#666", marginBottom: 20 },
  timeBtn: {
    flex: 1,
    margin: 5,
    padding: 15,
    borderWidth: 1,
    borderColor: "#eee",
    borderRadius: 10,
    alignItems: "center",
  },
  selectedBtn: { backgroundColor: "#000", borderColor: "#000" },
  timeText: { fontSize: 16, fontWeight: "600" },
  whiteText: { color: "#fff" },
  confirmButton: {
    backgroundColor: "#000",
    padding: 18,
    borderRadius: 12,
    alignItems: "center",
    marginTop: 20,
  },
  buttonText: { color: "#fff", fontWeight: "bold", fontSize: 16 },
});
