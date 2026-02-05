import { doc, updateDoc } from 'firebase/firestore';
import React, { useState } from 'react';
import { Alert, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { auth, db } from '../../firebase/firebaseConfig';

export default function Availability({ navigation }) {
  const [openingTime, setOpeningTime] = useState('09:00');
  const [closingTime, setClosingTime] = useState('17:00');
  const [duration, setDuration] = useState(30); // Default 30 mins [cite: 13]

  const handleSaveAvailability = async () => {
    try {
      const barberRef = doc(db, "barbers", auth.currentUser.uid);
      await updateDoc(barberRef, {
        openingTime, // [cite: 12]
        closingTime, // [cite: 12]
        appointmentDuration: duration, // [cite: 13]
      });
      Alert.alert("Success", "Operating hours and duration updated.");
      navigation.goBack();
    } catch (error) {
      Alert.alert("Error", error.message);
    }
  };

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.header}>Set Working Hours</Text>
      
      <View style={styles.section}>
        <Text style={styles.label}>Opening Time: {openingTime}</Text>
        {/* In a real app, use a TimePicker here. For MVP, we use simple buttons */}
        <View style={styles.row}>
          <TouchableOpacity onPress={() => setOpeningTime('08:00')} style={styles.timeBtn}><Text>08:00</Text></TouchableOpacity>
          <TouchableOpacity onPress={() => setOpeningTime('09:00')} style={styles.timeBtn}><Text>09:00</Text></TouchableOpacity>
          <TouchableOpacity onPress={() => setOpeningTime('10:00')} style={styles.timeBtn}><Text>10:00</Text></TouchableOpacity>
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.label}>Closing Time: {closingTime}</Text>
        <View style={styles.row}>
          <TouchableOpacity onPress={() => setClosingTime('17:00')} style={styles.timeBtn}><Text>17:00</Text></TouchableOpacity>
          <TouchableOpacity onPress={() => setClosingTime('18:00')} style={styles.timeBtn}><Text>18:00</Text></TouchableOpacity>
          <TouchableOpacity onPress={() => setClosingTime('19:00')} style={styles.timeBtn}><Text>19:00</Text></TouchableOpacity>
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.label}>Appointment Duration (Minutes): {duration}</Text>
        <View style={styles.row}>
          {[15, 30, 45, 60].map((mins) => (
            <TouchableOpacity 
              key={mins} 
              onPress={() => setDuration(mins)} 
              style={[styles.timeBtn, duration === mins && styles.activeBtn]}
            >
              <Text style={duration === mins && styles.activeText}>{mins}</Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      <TouchableOpacity style={styles.saveButton} onPress={handleSaveAvailability}>
        <Text style={styles.buttonText}>Save Availability</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { padding: 20, backgroundColor: '#fff' },
  header: { fontSize: 22, fontWeight: 'bold', marginBottom: 20 },
  section: { marginBottom: 30 },
  label: { fontSize: 16, marginBottom: 10, fontWeight: '600' },
  row: { flexDirection: 'row', justifyContent: 'space-between' },
  timeBtn: { padding: 10, borderWidth: 1, borderColor: '#ccc', borderRadius: 5, width: '30%', alignItems: 'center' },
  activeBtn: { backgroundColor: '#000' },
  activeText: { color: '#fff' },
  saveButton: { backgroundColor: '#000', padding: 15, borderRadius: 8, alignItems: 'center' },
  buttonText: { color: '#fff', fontWeight: 'bold' }
});