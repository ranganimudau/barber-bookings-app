import React, { useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Keyboard,
  KeyboardAvoidingView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  Platform,
  TouchableOpacity,
  View,
} from "react-native";
import Icon from "react-native-vector-icons/Ionicons";
import KeyboardDoneBar from "../../components/common/KeyboardDoneBar";
import { useKeyboardInset } from "../../hooks/useKeyboardInset";
import { supabase } from "../../supabase/supabaseClient";
import { colors } from "../../theme/clientTheme";

export default function Signup({ navigation }) {
  const keyboardInset = useKeyboardInset();
  const [firstName, setFirstName] = useState("");
  const [surname, setSurname] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [role, setRole] = useState("client");
  const [loading, setLoading] = useState(false);
  const [statusMessage, setStatusMessage] = useState("");

  const handleSignup = async () => {
    if (!firstName || !surname || !email || !password || !confirmPassword) {
      Alert.alert("Error", "Please fill in all fields, including your name.");
      return;
    }
    if (password !== confirmPassword) {
      Alert.alert("Error", "Password and confirmation do not match.");
      return;
    }
    setStatusMessage("Creating your account...");
    setLoading(true);

    // 1. Create user in Supabase Auth
    const { data: authData, error: authError } = await supabase.auth.signUp({
      email,
      password,
    });

    if (authError) {
      Alert.alert("Signup Error", authError.message);
      setLoading(false);
      setStatusMessage("");
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
    setStatusMessage("");
  };

  return (
    <KeyboardAvoidingView
      style={styles.screen}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <ScrollView
        contentContainerStyle={[styles.content, { paddingBottom: 34 + keyboardInset + 20 }]}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode={Platform.OS === "ios" ? "interactive" : "on-drag"}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.heroBadge}>
          <Icon name="sparkles-outline" size={14} color={colors.accent} />
          <Text style={styles.heroBadgeText}>BarberApp Pro</Text>
        </View>

        <Text style={styles.title}>Create your account</Text>
        <Text style={styles.subtitle}>
          Book smarter, get live updates, and unlock earnings — all in one premium app.
        </Text>

        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Choose your role</Text>

          <View style={styles.roleContainer}>
            <TouchableOpacity
              style={[styles.roleBtn, role === "client" && styles.activeRole]}
              onPress={() => setRole("client")}
              activeOpacity={0.9}
            >
              <Icon
                name="person-outline"
                size={18}
                color={role === "client" ? "#0A0A0A" : colors.textMuted}
              />
              <Text style={role === "client" ? styles.whiteText : styles.roleText}>
                Client
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.roleBtn, role === "barber" && styles.activeRole]}
              onPress={() => setRole("barber")}
              activeOpacity={0.9}
            >
              <Icon
                name="cut-outline"
                size={18}
                color={role === "barber" ? "#0A0A0A" : colors.textMuted}
              />
              <Text style={role === "barber" ? styles.whiteText : styles.roleText}>
                Barber / Pro
              </Text>
            </TouchableOpacity>
          </View>

          <View style={styles.twoColRow}>
            <View style={styles.inputWrap}>
              <Text style={styles.inputLabel}>First name</Text>
              <TextInput
                placeholder="First Name"
                placeholderTextColor={colors.textMuted}
                style={styles.input}
                value={firstName}
                onChangeText={setFirstName}
                autoCapitalize="words"
                returnKeyType="done"
                onSubmitEditing={Keyboard.dismiss}
              />
            </View>
            <View style={styles.inputWrap}>
              <Text style={styles.inputLabel}>Surname</Text>
              <TextInput
                placeholder="Surname"
                placeholderTextColor={colors.textMuted}
                style={styles.input}
                value={surname}
                onChangeText={setSurname}
                autoCapitalize="words"
                returnKeyType="done"
                onSubmitEditing={Keyboard.dismiss}
              />
            </View>
          </View>

          <View style={styles.inputWrap}>
            <Text style={styles.inputLabel}>Email</Text>
            <TextInput
              placeholder="Email Address"
              placeholderTextColor={colors.textMuted}
              style={styles.input}
              value={email}
              onChangeText={setEmail}
              autoCapitalize="none"
              keyboardType="email-address"
              returnKeyType="done"
              onSubmitEditing={Keyboard.dismiss}
            />
          </View>

          <View style={[styles.inputWrap, styles.fieldBlock]}>
            <Text style={styles.inputLabel}>Password</Text>
            <View style={styles.passwordContainer}>
              <TextInput
                placeholder="Password"
                placeholderTextColor={colors.textMuted}
                style={styles.passwordInput}
                value={password}
                onChangeText={setPassword}
                secureTextEntry={!showPassword}
                returnKeyType="done"
                onSubmitEditing={Keyboard.dismiss}
              />
              <TouchableOpacity
                onPress={() => setShowPassword(!showPassword)}
                style={styles.eyeIcon}
                activeOpacity={0.85}
              >
                <Icon
                  name={showPassword ? "eye-off-outline" : "eye-outline"}
                  size={22}
                  color={colors.textSecondary}
                />
              </TouchableOpacity>
            </View>
          </View>

          <View style={[styles.inputWrap, styles.fieldBlock]}>
            <Text style={styles.inputLabel}>Confirm password</Text>
            <View style={styles.passwordContainer}>
              <TextInput
                placeholder="Confirm password"
                placeholderTextColor={colors.textMuted}
                style={styles.passwordInput}
                value={confirmPassword}
                onChangeText={setConfirmPassword}
                secureTextEntry={!showConfirmPassword}
                autoCapitalize="none"
                returnKeyType="done"
                onSubmitEditing={Keyboard.dismiss}
              />
              <TouchableOpacity
                onPress={() => setShowConfirmPassword(!showConfirmPassword)}
                style={styles.eyeIcon}
                activeOpacity={0.85}
              >
                <Icon
                  name={showConfirmPassword ? "eye-off-outline" : "eye-outline"}
                  size={22}
                  color={colors.textSecondary}
                />
              </TouchableOpacity>
            </View>
          </View>

          <TouchableOpacity
            style={[styles.button, loading && styles.buttonDisabled]}
            onPress={handleSignup}
            disabled={loading}
            activeOpacity={0.9}
          >
            {loading ? (
              <ActivityIndicator color="#0A0A0A" />
            ) : (
              <View style={styles.buttonRow}>
                <Text style={styles.buttonText}>Sign Up</Text>
                <Icon name="arrow-forward" size={18} color="#0A0A0A" />
              </View>
            )}
          </TouchableOpacity>

          {statusMessage ? <Text style={styles.statusText}>{statusMessage}</Text> : null}

          <TouchableOpacity
            onPress={() => navigation.navigate("Login")}
            style={styles.link}
            activeOpacity={0.9}
          >
            <Text style={styles.linkText}>Already have an account? Login</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
      <KeyboardDoneBar inset={keyboardInset} />
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.backgroundWarm },
  content: { padding: 20, paddingBottom: 34 },
  heroBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    alignSelf: "flex-start",
    backgroundColor: "rgba(197,160,112,0.12)",
    borderColor: "rgba(197,160,112,0.32)",
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    marginBottom: 14,
  },
  heroBadgeText: { color: colors.accent, fontWeight: "900", fontSize: 12 },
  title: {
    fontSize: 28,
    fontWeight: "900",
    textAlign: "left",
    color: "#F5F5F0",
    marginTop: 12,
    marginBottom: 10,
  },
  subtitle: {
    color: colors.textMuted,
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 18,
    fontWeight: "700",
  },
  card: {
    backgroundColor: "rgba(255,255,255,0.03)",
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "rgba(197,160,112,0.22)",
    padding: 16,
  },
  sectionTitle: { color: colors.textMuted, fontWeight: "900", fontSize: 12, letterSpacing: 1, textTransform: "uppercase", marginBottom: 10 },
  roleContainer: { flexDirection: "row", gap: 12, marginBottom: 16 },
  roleBtn: {
    flex: 1,
    borderRadius: 16,
    paddingVertical: 14,
    paddingHorizontal: 12,
    backgroundColor: "rgba(255,255,255,0.02)",
    borderWidth: 1,
    borderColor: "rgba(197,160,112,0.25)",
    alignItems: "center",
    gap: 8,
    flexDirection: "row",
    justifyContent: "center",
  },
  activeRole: { backgroundColor: "#0A0A0A", borderColor: "rgba(197,160,112,0.55)" },
  roleText: { color: colors.textMuted, fontWeight: "800" },
  whiteText: { color: "#F5F5F0", fontWeight: "900" },
  twoColRow: { flexDirection: "row", gap: 12, marginBottom: 14 },
  inputWrap: { flex: 1 },
  fieldBlock: { flexGrow: 0, marginBottom: 14 },
  inputLabel: { color: colors.textMuted, fontSize: 12, fontWeight: "800", marginBottom: 8 },
  input: {
    borderWidth: 1,
    borderColor: "rgba(197,160,112,0.25)",
    padding: 14,
    borderRadius: 14,
    backgroundColor: "rgba(255,255,255,0.03)",
    fontSize: 15,
    color: colors.text,
  },
  passwordContainer: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderColor: "rgba(197,160,112,0.25)",
    borderRadius: 14,
    backgroundColor: "rgba(255,255,255,0.03)",
  },
  passwordInput: { flex: 1, paddingVertical: 14, paddingHorizontal: 14, fontSize: 15, color: colors.text },
  eyeIcon: { padding: 12 },
  button: {
    backgroundColor: colors.accent,
    paddingVertical: 16,
    borderRadius: 16,
    alignItems: "center",
    marginTop: 14,
  },
  buttonRow: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8 },
  buttonText: { color: "#0A0A0A", fontWeight: "900", fontSize: 16 },
  buttonDisabled: { opacity: 0.7 },
  link: { marginTop: 16, alignItems: "center", paddingBottom: 6 },
  linkText: { color: colors.textMuted, fontWeight: "800", textDecorationLine: "underline" },
  statusText: {
    color: colors.textMuted,
    fontWeight: "700",
    fontSize: 13,
    lineHeight: 18,
    marginTop: 10,
    textAlign: "center",
  },
});
