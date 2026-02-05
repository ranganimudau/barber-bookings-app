import { doc, updateDoc } from 'firebase/firestore';
import React, { useState } from 'react';
import { Alert, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { auth, db } from '../../firebase/firebaseConfig';

export default function ProfileSetup({ navigation }) {
  const [shopName, setShopName] = useState('');
  const [address, setAddress] = useState(''); // "123 Street Name, Suburb"
  const [serviceName, setServiceName] = useState('');
  const [servicePrice, setServicePrice] = useState('');
  const [services, setServices] = useState([]); // List: Chiskop, Cut & Dye, etc.

  // Adds a service to the local list before saving to Firestore
  const addService = () => {
    if (serviceName && servicePrice) {
      setServices([...services, { name: serviceName, price: servicePrice }]);
      setServiceName('');
      setServicePrice('');
    } else {
      Alert.alert("Error", "Please enter both service name and price");
    }
  };

  const handleSaveProfile = async () => {
    if (!shopName || !address || services.length === 0) {
      Alert.alert("Error", "Please complete all fields and add at least one service.");
      return;
    }

    try {
      const barberRef = doc(db, "barbers", auth.currentUser.uid);
      await updateDoc(barberRef, {
        shopName: shopName,
        address: address,
        services: services, // Array of service objects
        isProfileComplete: true, // Profile becomes visible on client map 
      });
      Alert.alert("Success", "Profile updated! You are now visible to clients.");
      navigation.navigate('Dashboard');
    } catch (error) {
      Alert.alert("Update Error", error.message);
    }
  };

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.header}>Shop Profile Setup</Text>
      
      <TextInput style={styles.input} placeholder="Shop Name" onChangeText={setShopName} />
      <TextInput style={styles.input} placeholder="Street Address & Number" onChangeText={setAddress} />

      <View style={styles.serviceBox}>
        <Text style={styles.subHeader}>Add Your Services</Text>
        <TextInput 
          style={styles.input} 
          placeholder="Service (e.g. Chiskop)" 
          value={serviceName} 
          onChangeText={setServiceName} 
        />
        <TextInput 
          style={styles.input} 
          placeholder="Price (R)" 
          value={servicePrice} 
          keyboardType="numeric" 
          onChangeText={setServicePrice} 
        />
        <TouchableOpacity style={styles.addButton} onPress={addService}>
          <Text style={styles.buttonText}>+ Add Service to Menu</Text>
        </TouchableOpacity>
      </View>

      {/* List of services currently added */}
      {services.map((item, index) => (
        <View key={index} style={styles.serviceItem}>
          <Text>{item.name}</Text>
          <Text style={{fontWeight: 'bold'}}>R{item.price}</Text>
        </View>
      ))}

      <TouchableOpacity style={styles.saveButton} onPress={handleSaveProfile}>
        <Text style={styles.buttonText}>Complete Registration</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { padding: 20, backgroundColor: '#fff' },
  header: { fontSize: 24, fontWeight: 'bold', marginBottom: 20 },
  subHeader: { fontSize: 18, marginBottom: 10, color: '#333' },
  input: { borderBottomWidth: 1, borderColor: '#ccc', marginBottom: 20, padding: 10 },
  serviceBox: { backgroundColor: '#f0f0f0', padding: 15, borderRadius: 10, marginBottom: 20 },
  addButton: { backgroundColor: '#555', padding: 12, borderRadius: 5, alignItems: 'center' },
  saveButton: { backgroundColor: '#000', padding: 18, borderRadius: 10, alignItems: 'center', marginTop: 20 },
  buttonText: { color: '#fff', fontWeight: 'bold' },
  serviceItem: { flexDirection: 'row', justifyContent: 'space-between', padding: 10, borderBottomWidth: 0.5, borderColor: '#eee' }
});