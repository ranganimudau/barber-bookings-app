import { createUserWithEmailAndPassword } from 'firebase/auth';
import { doc, setDoc } from 'firebase/firestore';
import React, { useState } from 'react';
import { Alert, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { auth, db } from '../../firebase/firebaseConfig';

const Register = ({ navigation }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [role, setRole] = useState('client'); // Default role per MVP 

  const handleRegister = async () => {
    if (!email || !password || !fullName) {
      Alert.alert("Error", "Please fill in all fields");
      return;
    }

    try {
      // 1. Create user in Firebase Auth [cite: 5]
      const userCredential = await createUserWithEmailAndPassword(auth, email, password);
      const uid = userCredential.user.uid;

      // 2. Store profile and role in Firestore [cite: 8]
      await setDoc(doc(db, "users", uid), {
        uid: uid,
        fullName: fullName,
        email: email,
        role: role,
        createdAt: new Date(),
      });

      // 3. If Barber, initialize shop profile [cite: 9, 11]
      if (role === 'barber') {
        await setDoc(doc(db, "barbers", uid), {
          uid: uid,
          isProfileComplete: false,
          shopName: '',
          location: null, 
        });
      }

      Alert.alert("Success", "Account created successfully!");
    } catch (error) {
      Alert.alert("Registration Error", error.message);
    }
  };

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.title}>Create Account</Text>
      
      {/* Input for Full Name */}
      <TextInput 
        style={styles.input} 
        placeholder="Enter your full name" 
        placeholderTextColor="#888"
        value={fullName}
        onChangeText={setFullName} 
      />

      {/* Input for Email */}
      <TextInput 
        style={styles.input} 
        placeholder="Enter your email address" 
        placeholderTextColor="#888"
        keyboardType="email-address" 
        autoCapitalize="none"
        value={email}
        onChangeText={setEmail} 
      />

      {/* Input for Password */}
      <TextInput 
        style={styles.input} 
        placeholder="Create a password" 
        placeholderTextColor="#888"
        secureTextEntry 
        value={password}
        onChangeText={setPassword} 
      />

      <Text style={styles.label}>Sign up as a:</Text>
      
      {/* Role Selection  */}
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

      <TouchableOpacity style={styles.submitButton} onPress={handleRegister}>
        <Text style={styles.buttonText}>Sign Up</Text>
      </TouchableOpacity>

      {/* Link back to Login */}
      <TouchableOpacity 
        style={styles.loginLink} 
        onPress={() => navigation.navigate('Login')}
      >
        <Text style={styles.loginLinkText}>Already have an account? Login here</Text>
      </TouchableOpacity>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: { flexGrow: 1, padding: 20, justifyContent: 'center', backgroundColor: '#fff' },
  title: { fontSize: 26, fontWeight: 'bold', marginBottom: 30, textAlign: 'center' },
  label: { fontSize: 16, marginBottom: 10, textAlign: 'center', color: '#666' },
  input: { borderBottomWidth: 1, borderBottomColor: '#ccc', marginBottom: 20, padding: 10, fontSize: 16 },
  roleContainer: { flexDirection: 'row', justifyContent: 'space-around', marginBottom: 30 },
  roleButton: { padding: 12, borderWidth: 1, borderColor: '#000', borderRadius: 8, width: '45%', alignItems: 'center' },
  activeRole: { backgroundColor: '#000' },
  activeText: { color: '#fff', fontWeight: 'bold' },
  inactiveText: { color: '#000' },
  submitButton: { backgroundColor: '#000', padding: 16, borderRadius: 8, alignItems: 'center' },
  buttonText: { color: '#fff', fontWeight: 'bold', fontSize: 18 },
  loginLink: { marginTop: 25, alignItems: 'center' },
  loginLinkText: { color: '#0066cc', fontSize: 15 }
});

export default Register;