import React, { useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Keyboard,
  KeyboardAvoidingView,
  StyleSheet,
  Platform,
  ScrollView,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import * as Linking from "expo-linking";
import Icon from "react-native-vector-icons/Ionicons";
import KeyboardDoneBar from "../../components/common/KeyboardDoneBar";
import { useKeyboardInset } from "../../hooks/useKeyboardInset";
import { supabase } from "../../supabase/supabaseClient";
import { colors } from "../../theme/clientTheme";

export default function Login({ navigation }) {
  const keyboardInset = useKeyboardInset();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [resetSending, setResetSending] = useState(false);
  const [statusMessage, setStatusMessage] = useState("");

  const handleForgotPassword = async () => {
    const trimmed = email.trim();
    if (!trimmed) {
      Alert.alert(
        "Email required",
        "Enter the email you used to sign up above, then tap Forgot password again."
      );
      return;
    }

    setResetSending(true);
    setStatusMessage("Sending reset link...");
    try {
      const redirectTo = Linking.createURL("auth/reset-password");
      const { error } = await supabase.auth.resetPasswordForEmail(trimmed, {
        redirectTo,
      });
      if (error) {
        Alert.alert("Could not send reset email", error.message);
        return;
      }
      Alert.alert(
        "Check your email",
        "If an account exists for that address, you will receive a link to reset your password. Open the link on this device to set a new password."
      );
    } catch (e) {
      Alert.alert(
        "Could not send reset email",
        e?.message || "Something went wrong. Try again."
      );
    } finally {
      setResetSending(false);
      setStatusMessage("");
    }
  };

  const handleLogin = async () => {
    if (!email || !password) {
      Alert.alert("Error", "Please enter both email and password.");
      return;
    }
    setStatusMessage("Signing you in...");
    setLoading(true);

    const { data: authData, error: authError } =
      await supabase.auth.signInWithPassword({
        email,
        password,
      });

    if (authError) {
      Alert.alert("Login Error", authError.message);
      setLoading(false);
      setStatusMessage("");
      return;
    }

    try {
      // 1. Fetch user role
      const { data: profileData, error: profileError } = await supabase
        .from("profiles")
        .select("role")
        .eq("id", authData.user.id)
        .single();

      if (profileError || !profileData)
        throw new Error("Could not find profile.");

      const role = profileData.role;

      // 2. If Barber, check if setup is complete
      if (role === "barber") {
        const { data: barberData } = await supabase
          .from("barbers")
          .select("is_profile_complete")
          .eq("id", authData.user.id)
          .single();

        if (barberData?.is_profile_complete) {
          navigation.replace("BarberStack");
        } else {
          navigation.replace("ProfileSetup"); // Redirect to setup
        }
      } else {
        navigation.replace("ClientStack");
      }
    } catch (error) {
      Alert.alert("Profile Error", error.message);
    } finally {
      setLoading(false);
      setStatusMessage("");
    }
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
          <Text style={styles.heroBadgeText}>SkoonBook</Text>
        </View>

        <Text style={styles.title}>Welcome back</Text>
        <Text style={styles.subtitle}>
          Sign in to manage bookings, services, and earnings in one premium app.
        </Text>

        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Sign in</Text>

          <View style={styles.inputWrap}>
            <Text style={styles.inputLabel}>Email</Text>
            <TextInput
              placeholder="Enter your email"
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

          <View style={styles.inputWrap}>
            <Text style={styles.inputLabel}>Password</Text>
            <View style={styles.passwordContainer}>
              <TextInput
                placeholder="Enter your password"
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

          <View style={styles.forgotRow}>
            <TouchableOpacity
              onPress={handleForgotPassword}
              disabled={loading || resetSending}
              activeOpacity={0.85}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              {resetSending ? (
                <ActivityIndicator size="small" color={colors.accent} />
              ) : (
                <Text style={styles.forgotText}>Forgot password?</Text>
              )}
            </TouchableOpacity>
          </View>

          <TouchableOpacity
            style={[
              styles.button,
              (loading || resetSending) && styles.buttonDisabled,
            ]}
            onPress={handleLogin}
            disabled={loading || resetSending}
            activeOpacity={0.9}
          >
            {loading ? (
              <ActivityIndicator color="#0A0A0A" />
            ) : (
              <View style={styles.buttonRow}>
                <Text style={styles.buttonText}>Sign In</Text>
                <Icon name="arrow-forward" size={18} color="#0A0A0A" />
              </View>
            )}
          </TouchableOpacity>

          {statusMessage ? <Text style={styles.statusText}>{statusMessage}</Text> : null}

          <TouchableOpacity
            onPress={() => navigation.navigate("Signup")}
            style={styles.link}
            activeOpacity={0.9}
          >
            <Text style={styles.linkText}>Don&apos;t have an account? Sign Up</Text>
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
    backgroundColor: "rgba(197,160,112,0.12)",
    borderColor: "rgba(197,160,112,0.32)",
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    marginTop: 18,
    alignSelf: "flex-start",
    marginBottom: 14,
  },
  heroBadgeText: { color: colors.accent, fontWeight: "900", fontSize: 12 },
  title: {
    fontSize: 30,
    fontWeight: "900",
    color: "#F5F5F0",
    marginTop: 6,
    marginBottom: 10,
  },
  subtitle: { color: colors.textMuted, fontSize: 14, lineHeight: 20, marginBottom: 18, fontWeight: "700" },
  card: {
    backgroundColor: "rgba(255,255,255,0.03)",
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "rgba(197,160,112,0.22)",
    padding: 16,
    marginBottom: 18,
  },
  sectionTitle: { color: colors.textMuted, fontSize: 12, fontWeight: "900", letterSpacing: 1, textTransform: "uppercase", marginBottom: 12 },
  inputWrap: { marginBottom: 14 },
  inputLabel: { color: colors.textMuted, fontSize: 12, fontWeight: "900", marginBottom: 8 },
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
  forgotRow: {
    alignItems: "flex-end",
    marginTop: -6,
    marginBottom: 10,
    minHeight: 22,
    justifyContent: "center",
  },
  forgotText: {
    color: colors.accent,
    fontWeight: "800",
    fontSize: 13,
    textDecorationLine: "underline",
  },
  button: {
    backgroundColor: colors.accent,
    paddingVertical: 16,
    borderRadius: 16,
    alignItems: "center",
    marginTop: 4,
  },
  buttonRow: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8 },
  buttonText: { color: "#0A0A0A", fontWeight: "900", fontSize: 16 },
  link: { marginTop: 14, alignItems: "center", paddingBottom: 6 },
  linkText: { color: colors.textMuted, fontWeight: "800", textDecorationLine: "underline" },
  buttonDisabled: { opacity: 0.7 },
  statusText: {
    color: colors.textMuted,
    fontWeight: "700",
    fontSize: 13,
    lineHeight: 18,
    marginTop: 10,
    textAlign: "center",
  },
});
