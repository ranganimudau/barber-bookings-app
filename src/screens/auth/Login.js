import { signInWithEmailAndPassword } from 'firebase/auth';
import React, { useState } from 'react';
import { Alert, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { auth } from '../../firebase/firebaseConfig'; // Ensure this path is correct

const Login = ({ navigation }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const handleLogin = async () => {
    if (email === '' || password === '') {
      Alert.alert("Error", "Please fill in all fields");
      return;
    }

    try {
      // Authenticates the user based on roles defined in registration 
      await signInWithEmailAndPassword(auth, email, password);
    } catch (error) {
      Alert.alert("Login Error", "Invalid email or password. Please try again.");
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Barber Booking App</Text>
      
      {/* Email Input with Placeholder */}
      <TextInput 
        style={styles.input} 
        placeholder="Enter your email" // Placeholder as requested
        placeholderTextColor="#888"
        keyboardType="email-address"
        autoCapitalize="none"
        value={email}
        onChangeText={setEmail} 
      />

      {/* Password Input with Placeholder */}
      <TextInput 
        style={styles.input} 
        placeholder="Enter your password" // Placeholder as requested
        placeholderTextColor="#888"
        secureTextEntry 
        value={password}
        onChangeText={setPassword} 
      />

      <TouchableOpacity style={styles.button} onPress={handleLogin}>
        <Text style={styles.buttonText}>Login</Text>
      </TouchableOpacity>

      <TouchableOpacity 
        style={styles.link} 
        onPress={() => navigation.navigate('Register')}
      >
        <Text style={styles.linkText}>Don't have an account? Register here</Text>
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { 
    flex: 1, 
    padding: 20, 
    justifyContent: 'center', 
    backgroundColor: '#fff' 
  },
  title: { 
    fontSize: 28, 
    fontWeight: 'bold', 
    marginBottom: 40, 
    textAlign: 'center' 
  },
  input: { 
    borderBottomWidth: 1, 
    borderBottomColor: '#ccc', 
    marginBottom: 20, 
    padding: 10, 
    fontSize: 16 
  },
  button: { 
    backgroundColor: '#000', 
    padding: 15, 
    borderRadius: 8, 
    alignItems: 'center', 
    marginTop: 10 
  },
  buttonText: { 
    color: '#fff', 
    fontWeight: 'bold', 
    fontSize: 16 
  },
  link: { 
    marginTop: 20, 
    alignItems: 'center' 
  },
  linkText: { 
    color: '#0066cc' 
  }
});

export default Login;