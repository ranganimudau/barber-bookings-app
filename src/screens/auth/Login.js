import { signInWithEmailAndPassword } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import React, { useState } from 'react';
import { Alert, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { auth, db } from '../../firebase/firebaseConfig';

const Login = ({ navigation }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState('client'); //  Toggle role selection

  const handleLogin = async () => {
    if (email === '' || password === '') {
      Alert.alert("Error", "Please fill in all fields");
      return;
    }

    try {
      // 1. Authenticate user [cite: 32]
      const userCredential = await signInWithEmailAndPassword(auth, email, password);
      const uid = userCredential.user.uid;

      // 2. Fetch user role from Firestore to verify 
      const userDoc = await getDoc(doc(db, "users", uid));
      
      if (userDoc.exists()) {
        const userData = userDoc.data();
        
        // Check if the role they selected matches their account 
        if (userData.role !== role) {
          Alert.alert("Access Denied", `This account is registered as a ${userData.role}. Please select the correct role.`);
          return;
        }
      }
      // Success: App.js will now automatically navigate to the correct stack [cite: 37]
    } catch (error) {
      Alert.alert("Login Error", "Invalid email or password.");
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Barber Booking App</Text>

      {/* Role Selection Toggle  */}
      <View style={styles.roleContainer}>
        <TouchableOpacity 
          style={[styles.roleButton, role === 'client' && styles.activeRole]}
          onPress={() => setRole('client')}
        >
          <Text style={role === 'client' ? styles.activeText : styles.inactiveText}>Client</Text>
        </TouchableOpacity>
        <TouchableOpacity 
          style={[styles.roleButton, role === 'barber' && styles.activeRole]}
          onPress={() => setRole('barber')}
        >
          <Text style={role === 'barber' ? styles.activeText : styles.inactiveText}>Barber</Text>
        </TouchableOpacity>
      </View>
      
      <TextInput 
        style={styles.input} 
        placeholder="Enter your email" 
        placeholderTextColor="#888"
        keyboardType="email-address"
        autoCapitalize="none"
        onChangeText={setEmail} 
      />

      <TextInput 
        style={styles.input} 
        placeholder="Enter your password" 
        placeholderTextColor="#888"
        secureTextEntry 
        onChangeText={setPassword} 
      />

      <TouchableOpacity style={styles.button} onPress={handleLogin}>
        <Text style={styles.buttonText}>Login</Text>
      </TouchableOpacity>

      <TouchableOpacity 
        style={styles.link} 
        onPress={() => navigation.navigate('Register')}
      >
        <Text style={styles.linkText}>Don't have an account? Register here </Text>
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, padding: 20, justifyContent: 'center', backgroundColor: '#fff' },
  title: { fontSize: 28, fontWeight: 'bold', marginBottom: 20, textAlign: 'center' },
  roleContainer: { flexDirection: 'row', justifyContent: 'space-around', marginBottom: 30 },
  roleButton: { padding: 12, borderWidth: 1, borderColor: '#000', borderRadius: 8, width: '45%', alignItems: 'center' },
  activeRole: { backgroundColor: '#000' },
  activeText: { color: '#fff', fontWeight: 'bold' },
  inactiveText: { color: '#000' },
  input: { borderBottomWidth: 1, borderBottomColor: '#ccc', marginBottom: 20, padding: 10, fontSize: 16 },
  button: { backgroundColor: '#000', padding: 15, borderRadius: 8, alignItems: 'center', marginTop: 10 },
  buttonText: { color: '#fff', fontWeight: 'bold', fontSize: 16 },
  link: { marginTop: 20, alignItems: 'center' },
  linkText: { color: '#0066cc' }
});

export default Login;