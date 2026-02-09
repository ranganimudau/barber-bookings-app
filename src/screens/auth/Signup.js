import React, { useState } from "react";
import {
  ActivityIndicator,
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import Icon from "react-native-vector-icons/Ionicons";
import { supabase } from "../../supabase/supabaseClient";

export default function Signup({ navigation }) {
  const [firstName, setFirstName] = useState("");
  const [surname, setSurname] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [role, setRole] = useState("client");
  const [loading, setLoading] = useState(false);

  const handleSignup = async () => {
    if (!firstName || !surname || !email || !password) {
      Alert.alert("Error", "Please fill in all fields, including your name.");
      return;
    }
    setLoading(true);

    // 1. Create user in Supabase Auth
    const { data: authData, error: authError } = await supabase.auth.signUp({
      email,
      password,
    });

    if (authError) {
      Alert.alert("Signup Error", authError.message);
      setLoading(false);
      return;
    }

    // 2. Add full name and role to 'profiles' table
    if (authData.user) {
      const { error: profileError } = await supabase.from("profiles").insert([
        {
          id: authData.user.id,
          email: email,
          role: role,
          full_name: `${firstName} ${surname}`,
        },
      ]);

      if (profileError) {
        // Log the error for debugging but don't stop the user from logging in later
        console.error("Profile Insertion Error:", profileError.message);
        Alert.alert(
          "Partial Success",
          "Account created, but profile failed. Please try logging in.",
        );
      } else {
        Alert.alert(
          "Success",
          "Account created! Please check your email for a verification link.",
        );
        navigation.navigate("Login");
      }
    }
    setLoading(false);
  };

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.title}>Create Account</Text>

      <View style={styles.roleContainer}>
        <TouchableOpacity
          style={[styles.roleBtn, role === "client" && styles.activeRole]}
          onPress={() => setRole("client")}
        >
          <Text style={role === "client" ? styles.whiteText : styles.roleText}>
            Client
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.roleBtn, role === "barber" && styles.activeRole]}
          onPress={() => setRole("barber")}
        >
          <Text style={role === "barber" ? styles.whiteText : styles.roleText}>
            Barber
          </Text>
        </TouchableOpacity>
      </View>

      <TextInput
        placeholder="First Name"
        placeholderTextColor="#999"
        style={styles.input}
        value={firstName}
        onChangeText={setFirstName}
      />

      <TextInput
        placeholder="Surname"
        placeholderTextColor="#999"
        style={styles.input}
        value={surname}
        onChangeText={setSurname}
      />

      <TextInput
        placeholder="Email Address"
        placeholderTextColor="#999"
        style={styles.input}
        value={email}
        onChangeText={setEmail}
        autoCapitalize="none"
        keyboardType="email-address"
      />

      <View style={styles.passwordContainer}>
        <TextInput
          placeholder="Password"
          placeholderTextColor="#999"
          style={styles.passwordInput}
          value={password}
          onChangeText={setPassword}
          secureTextEntry={!showPassword}
        />
        <TouchableOpacity
          onPress={() => setShowPassword(!showPassword)}
          style={styles.eyeIcon}
        >
          <Icon
            name={showPassword ? "eye-off-outline" : "eye-outline"}
            size={22}
            color="#666"
          />
        </TouchableOpacity>
      </View>

      <TouchableOpacity
        style={styles.button}
        onPress={handleSignup}
        disabled={loading}
      >
        {loading ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text style={styles.buttonText}>Sign Up</Text>
        )}
      </TouchableOpacity>

      <TouchableOpacity
        onPress={() => navigation.navigate("Login")}
        style={styles.link}
      >
        <Text style={styles.linkText}>Already have an account? Login</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flexGrow: 1,
    justifyContent: "center",
    padding: 25,
    backgroundColor: "#fff",
  },
  title: {
    fontSize: 28,
    fontWeight: "bold",
    marginBottom: 30,
    textAlign: "center",
  },
  roleContainer: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 25,
  },
  roleBtn: {
    flex: 1,
    padding: 15,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#eee",
    marginHorizontal: 5,
    borderRadius: 12,
  },
  activeRole: { backgroundColor: "#000", borderColor: "#000" },
  roleText: { color: "#666", fontWeight: "600" },
  whiteText: { color: "#fff", fontWeight: "600" },
  input: {
    borderWidth: 1,
    borderColor: "#eee",
    padding: 15,
    borderRadius: 12,
    marginBottom: 15,
    backgroundColor: "#f9f9f9",
    fontSize: 16,
  },
  passwordContainer: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#eee",
    borderRadius: 12,
    marginBottom: 15,
    backgroundColor: "#f9f9f9",
  },
  passwordInput: { flex: 1, padding: 15, fontSize: 16 },
  eyeIcon: { padding: 10 },
  button: {
    backgroundColor: "#000",
    padding: 18,
    borderRadius: 12,
    alignItems: "center",
    marginTop: 10,
  },
  buttonText: { color: "#fff", fontWeight: "bold", fontSize: 16 },
  link: { marginTop: 20, marginBottom: 20, alignItems: "center" },
  linkText: { color: "#666" },
});
