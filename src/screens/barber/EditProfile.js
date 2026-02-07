import * as Location from 'expo-location';
import { doc, getDoc, updateDoc } from 'firebase/firestore';
import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  ScrollView,
  StyleSheet,
  Text, TextInput,
  TouchableOpacity,
  View
} from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';
import { auth, db } from '../../firebase/firebaseConfig';

export default function EditProfile({ navigation }) {
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(false);
  const [shopName, setShopName] = useState('');
  const [address, setAddress] = useState('');
  const [services, setServices] = useState([]);
  const [serviceName, setServiceName] = useState('');
  const [servicePrice, setServicePrice] = useState('');

  useEffect(() => {
    const fetchProfile = async () => {
      const docSnap = await getDoc(doc(db, "barbers", auth.currentUser.uid));
      if (docSnap.exists()) {
        const data = docSnap.data();
        setShopName(data.shopName);
        setAddress(data.address);
        setServices(data.services || []);
      }
      setLoading(false);
    };
    fetchProfile();
  }, []);

  const addService = () => {
    if (serviceName && servicePrice) {
      setServices([...services, { name: serviceName, price: parseFloat(servicePrice) }]);
      setServiceName('');
      setServicePrice('');
    }
  };

  const removeService = (index) => {
    setServices(services.filter((_, i) => i !== index));
  };

  const handleUpdate = async () => {
    setUpdating(true);
    try {
      // Re-geocode in case the address changed
      const geocoded = await Location.geocodeAsync(address);
      const coords = geocoded.length > 0 
        ? { latitude: geocoded[0].latitude, longitude: geocoded[0].longitude }
        : null;

      const barberRef = doc(db, "barbers", auth.currentUser.uid);
      await updateDoc(barberRef, {
        shopName,
        address,
        services,
        ...(coords && { coords }) // Only update coords if geocoding was successful
      });

      Alert.alert("Success", "Profile updated successfully!");
      navigation.goBack();
    } catch (_error) {
      Alert.alert("Error", "Could not update profile.");
    } finally {
      setUpdating(false);
    }
  };

  if (loading) return <ActivityIndicator size="large" style={{ flex: 1 }} />;

  return (
    <ScrollView style={styles.container}>
      <Text style={styles.label}>Shop Name</Text>
      <TextInput style={styles.input} value={shopName} onChangeText={setShopName} />

      <Text style={styles.label}>Address</Text>
      <TextInput style={styles.input} value={address} onChangeText={setAddress} multiline />

      <Text style={styles.label}>Edit Services & Pricing</Text>
      <View style={styles.addServiceBox}>
        <TextInput 
          placeholder="Service Name" 
          style={styles.smallInput} 
          value={serviceName} 
          onChangeText={setServiceName} 
        />
        <TextInput 
          placeholder="Price" 
          keyboardType="numeric" 
          style={styles.smallInput} 
          value={servicePrice} 
          onChangeText={setServicePrice} 
        />
        <TouchableOpacity style={styles.addButton} onPress={addService}>
          <Icon name="add" size={24} color="#fff" />
        </TouchableOpacity>
      </View>

      {services.map((s, i) => (
        <View key={i} style={styles.serviceItem}>
          <Text>{s.name} - R{s.price}</Text>
          <TouchableOpacity onPress={() => removeService(i)}>
            <Icon name="trash-outline" size={20} color="red" />
          </TouchableOpacity>
        </View>
      ))}

      <TouchableOpacity 
        style={styles.saveButton} 
        onPress={handleUpdate} 
        disabled={updating}
      >
        {updating ? <ActivityIndicator color="#fff" /> : <Text style={styles.saveText}>Save Changes</Text>}
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 20, backgroundColor: '#fff' },
  label: { fontWeight: 'bold', marginTop: 15, marginBottom: 5 },
  input: { borderWidth: 1, borderColor: '#ddd', padding: 12, borderRadius: 8 },
  addServiceBox: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 10 },
  smallInput: { borderWidth: 1, borderColor: '#ddd', padding: 10, borderRadius: 8, width: '40%' },
  addButton: { backgroundColor: '#000', padding: 10, borderRadius: 8, justifyContent: 'center' },
  serviceItem: { 
    flexDirection: 'row', justifyContent: 'space-between', 
    padding: 15, borderBottomWidth: 1, borderBottomColor: '#eee' 
  },
  saveButton: { backgroundColor: '#000', padding: 18, borderRadius: 10, marginTop: 30, alignItems: 'center' },
  saveText: { color: '#fff', fontWeight: 'bold', fontSize: 16 }
});