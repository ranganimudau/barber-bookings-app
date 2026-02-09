import React, { useEffect, useState } from "react";
import {
  Alert,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  View,
} from "react-native";
import { supabase } from "../../supabase/supabaseClient"; //

const DAYS = [
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
  "Sunday",
];

export default function Availability() {
  const [schedule, setSchedule] = useState({});

  useEffect(() => {
    fetchAvailability();
  }, []);

  const fetchAvailability = async () => {
    const {
      data: { user },
    } = await supabase.auth.getUser(); //
    const { data, error } = await supabase
      .from("barber_availability")
      .select("*")
      .eq("barber_id", user.id); //

    if (!error && data.length > 0) {
      const formatted = {};
      data.forEach((item) => (formatted[item.day] = item.is_open));
      setSchedule(formatted);
    }
  };

  const toggleDay = async (day) => {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    const newValue = !schedule[day];

    setSchedule({ ...schedule, [day]: newValue });

    const { error } = await supabase
      .from("barber_availability")
      .upsert(
        { barber_id: user.id, day: day, is_open: newValue },
        { onConflict: "barber_id,day" },
      ); //

    if (error) Alert.alert("Error", "Could not save changes.");
  };

  return (
    <ScrollView style={styles.container}>
      <Text style={styles.title}>Set Your Working Days</Text>
      {DAYS.map((day) => (
        <View key={day} style={styles.row}>
          <Text style={styles.dayText}>{day}</Text>
          <Switch
            value={schedule[day] || false}
            onValueChange={() => toggleDay(day)}
            trackColor={{ true: "#000" }}
          />
        </View>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#fff", padding: 20 },
  title: { fontSize: 22, fontWeight: "bold", marginBottom: 20, marginTop: 40 },
  row: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 15,
    borderBottomWidth: 1,
    borderBottomColor: "#eee",
  },
  dayText: { fontSize: 16 },
});
