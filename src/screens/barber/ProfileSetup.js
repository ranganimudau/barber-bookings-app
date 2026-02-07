import DateTimePicker from '@react-native-community/datetimepicker';
import * as Location from 'expo-location';
import { doc, updateDoc } from 'firebase/firestore';
import React, { useState } from 'react';
import {
  ActivityIndicator,
  Alert, ScrollView, StyleSheet, Text, TextInput,
  TouchableOpacity, View
} from 'react-native';
import { auth, db } from '../../firebase/firebaseConfig';

export default function ProfileSetup({ navigation }) {
  const [shopName, setShopName] = useState('');
  const [address, setAddress] = useState('');
  const [services, setServices] = useState([]);
  const [serviceName, setServiceName] = useState('');
  const [servicePrice, setServicePrice] = useState('');
  
  // New States for Hours and Duration
  const [openingTime, setOpeningTime] = useState(new Date().setHours(8, 0, 0));
  const [closingTime, setClosingTime] = useState(new Date().setHours(17, 0, 0));
  const [duration, setDuration] = useState('30');
  const [showPicker, setShowPicker] = useState(null); // 'open' or 'close'
  const [isSaving, setIsSaving] = useState(false);

  const formatTime = (time) => {
    const d = new Date(time);
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false });
  };

  const addService = () => {
    if (serviceName && servicePrice) {
      setServices([...services, { name: serviceName, price: parseFloat(servicePrice) }]);
      setServiceName('');
      setServicePrice('');
    }
  };

  const handleSaveProfile = async () => {
    if (!shopName || !address || services.length === 0) {
      Alert.alert("Error", "Please complete all fields.");
      return;
    }

    setIsSaving(true);
    try {
      const geocoded = await Location.geocodeAsync(address);
      const coords = geocoded.length > 0 
        ? { latitude: geocoded[0].latitude, longitude: geocoded[0].longitude } 
        : null;

      const barberRef = doc(db, "barbers", auth.currentUser.uid);
      await updateDoc(barberRef, {
        shopName,
        address,
        coords,
        openingTime: formatTime(openingTime),
        closingTime: formatTime(closingTime),
        appointmentDuration: parseInt(duration),
        services,
        isProfileComplete: true,
      });

      Alert.alert("Success", "Profile and hours updated!");
      navigation.navigate('Appointments');
    } catch (_error) {
      Alert.alert("Error", "Failed to save profile.");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.header}>Shop Profile Setup</Text>
      
      <TextInput style={styles.input} placeholder="Shop Name" onChangeText={setShopName} />
      <TextInput style={styles.input} placeholder="Street Address, City" onChangeText={setAddress} />

      <Text style={styles.subHeader}>Operating Hours & Duration</Text>
      <View style={styles.row}>
        <TouchableOpacity style={styles.timeBtn} onPress={() => setShowPicker('open')}>
          <Text style={styles.label}>Opens: {formatTime(openingTime)}</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.timeBtn} onPress={() => setShowPicker('close')}>
          <Text style={styles.label}>Closes: {formatTime(closingTime)}</Text>
        </TouchableOpacity>
      </View>

      <TextInput 
        style={styles.input} 
        placeholder="Avg. Haircut Duration (mins)" 
        keyboardType="numeric"
        value={duration}
        onChangeText={setDuration}
      />

      {showPicker && (
        <DateTimePicker
          value={showPicker === 'open' ? new Date(openingTime) : new Date(closingTime)}
          mode="time"
          is24Hour={true}
          display="spinner"
          onChange={(e, time) => {
            setShowPicker(null);
            if (time) {
              if (showPicker === 'open') {
                setOpeningTime(time);
              } else {
                setClosingTime(time);
              }
            }
          }}
        />
      )}

      <View style={styles.serviceBox}>
        <Text style={styles.subHeader}>Services</Text>
        <TextInput style={styles.input} placeholder="Service Name" value={serviceName} onChangeText={setServiceName} />
        <TextInput style={styles.input} placeholder="Price (R)" keyboardType="numeric" value={servicePrice} onChangeText={setServicePrice} />
        <TouchableOpacity style={styles.addButton} onPress={addService}>
          <Text style={styles.buttonText}>+ Add Service</Text>
        </TouchableOpacity>
      </View>

      <TouchableOpacity style={styles.saveButton} onPress={handleSaveProfile} disabled={isSaving}>
        {isSaving ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>Complete Registration</Text>}
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { padding: 20, backgroundColor: '#fff' },
  header: { fontSize: 24, fontWeight: 'bold', marginBottom: 20 },
  subHeader: { fontSize: 18, fontWeight: '600', marginVertical: 15 },
  input: { borderBottomWidth: 1, borderColor: '#ccc', marginBottom: 15, padding: 10 },
  row: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 10 },
  timeBtn: { padding: 15, backgroundColor: '#f0f0f0', borderRadius: 8, width: '48%', alignItems: 'center' },
  label: { fontWeight: '500' },
  serviceBox: { backgroundColor: '#f9f9f9', padding: 15, borderRadius: 10, marginTop: 10 },
  addButton: { backgroundColor: '#555', padding: 12, borderRadius: 8, alignItems: 'center' },
  saveButton: { backgroundColor: '#000', padding: 18, borderRadius: 10, alignItems: 'center', marginTop: 30, marginBottom: 50 },
  buttonText: { color: '#fff', fontWeight: 'bold' }
});