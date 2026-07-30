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
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Icon from "react-native-vector-icons/Ionicons";
import GoogleSignInButton from "../../components/common/GoogleSignInButton";
import KeyboardDoneBar from "../../components/common/KeyboardDoneBar";
import StatusBarBackdrop from "../../components/common/StatusBarBackdrop";
import { useKeyboardInset } from "../../hooks/useKeyboardInset";
import { useLightStatusBar } from "../../hooks/useLightStatusBar";
import { supabase } from "../../supabase/supabaseClient";
import { colors, shadows } from "../../theme/barberTheme";

// Deliberately permissive — just catches obvious typos like a missing "@"
// or domain. Real deliverability is proven by the confirmation email.
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const MIN_PASSWORD_LENGTH = 8;
// Loose on purpose: accepts local (0821234567) and international
// (+27821234567) South African formats without forcing a strict shape —
// there's no OTP step yet to prove the number is real, so this is just a
// sanity check against typos, not a claim of verification.
const PHONE_DIGITS_PATTERN = /^\+?[0-9]{9,13}$/;

export default function Signup({ navigation }) {
  useLightStatusBar(colors.background);
  const insets = useSafeAreaInsets();
  const keyboardInset = useKeyboardInset();
  const [firstName, setFirstName] = useState("");
  const [surname, setSurname] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [role, setRole] = useState("client");
  const [loading, setLoading] = useState(false);
  const [statusMessage, setStatusMessage] = useState("");

  const handleSignup = async () => {
    const cleanFirstName = firstName.trim();
    const cleanSurname = surname.trim();
    // Addresses are case-insensitive in practice; normalising stops
    // "Sam@Gmail.com" and "sam@gmail.com" reading as two different people.
    const cleanEmail = email.trim().toLowerCase();
    const cleanPhone = phone.trim();
    // Strip spaces/dashes for validation only — store what they typed.
    const phoneDigitsOnly = cleanPhone.replace(/[\s-]/g, "");

    if (!cleanFirstName || !cleanSurname || !cleanEmail || !cleanPhone || !password || !confirmPassword) {
      Alert.alert("Missing details", "Please fill in all fields, including your name and phone number.");
      return;
    }
    if (!EMAIL_PATTERN.test(cleanEmail)) {
      Alert.alert("Check your email", "That email address doesn't look right. Please check it and try again.");
      return;
    }
    if (!PHONE_DIGITS_PATTERN.test(phoneDigitsOnly)) {
      Alert.alert("Check your phone number", "Enter a valid phone number, e.g. 082 123 4567.");
      return;
    }
    if (password.length < MIN_PASSWORD_LENGTH) {
      Alert.alert(
        "Password too short",
        `Use at least ${MIN_PASSWORD_LENGTH} characters, with a mix of letters and numbers.`
      );
      return;
    }
    if (!/[A-Za-z]/.test(password) || !/[0-9]/.test(password)) {
      Alert.alert("Password too weak", "Include at least one letter and one number.");
      return;
    }
    if (password !== confirmPassword) {
      Alert.alert("Passwords don't match", "Password and confirmation do not match.");
      return;
    }

    setStatusMessage("Creating your account...");
    setLoading(true);

    try {
      // full_name/role travel as user metadata so the handle_new_user trigger
      // can create the profiles row in the same transaction as the auth user.
      // Doing it server-side removes the old failure mode where the auth
      // account existed but its profile didn't, permanently locking the
      // person out (couldn't log in, couldn't re-register).
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email: cleanEmail,
        password,
        options: {
          data: { full_name: `${cleanFirstName} ${cleanSurname}`, role, phone_number: cleanPhone },
        },
      });

      if (authError) {
        Alert.alert("Signup Error", authError.message);
        return;
      }

      // No session back means the project requires email confirmation, so
      // don't tell people to check their inbox unless one was actually sent.
      const needsEmailConfirmation = !authData?.session;

      if (needsEmailConfirmation) {
        Alert.alert(
          "Confirm your email",
          `We sent a confirmation link to ${cleanEmail}. Open it to activate your account, then log in.`
        );
      } else {
        Alert.alert("Welcome to SkoonBook", "Your account is ready — log in to get started.");
      }
      navigation.navigate("Login");
    } catch (e) {
      Alert.alert("Signup Error", e?.message || "Could not create your account. Please try again.");
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
      <StatusBarBackdrop />
      <ScrollView
        contentContainerStyle={[
          styles.content,
          { paddingTop: Math.max(insets.top, 24) + 20, paddingBottom: 34 + keyboardInset + 20 },
        ]}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode={Platform.OS === "ios" ? "interactive" : "on-drag"}
        showsVerticalScrollIndicator={false}
        bounces={false}
        overScrollMode="never"
      >
        <View style={styles.heroBadge}>
          <View style={styles.logoBadge}>
            <Text style={styles.logoBadgeText}>SB</Text>
          </View>
          <Text style={styles.heroBadgeText}>SkoonBook</Text>
        </View>

        <Text style={styles.title}>Create your account</Text>
        <Text style={styles.subtitle}>
          Book smarter, get live updates, and unlock earnings — all in one app.
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
                color={role === "client" ? colors.accentText : colors.textMuted}
              />
              <Text style={role === "client" ? styles.activeRoleText : styles.roleText}>
                Client
              </Text>
            </TouchableOpacity>
            {/* Display label only — the stored profiles.role value stays
                "barber", which App.js/Login.js and the RLS policies key off. */}
            <TouchableOpacity
              style={[styles.roleBtn, role === "barber" && styles.activeRole]}
              onPress={() => setRole("barber")}
              activeOpacity={0.9}
            >
              <Icon
                name="storefront-outline"
                size={18}
                color={role === "barber" ? colors.accentText : colors.textMuted}
              />
              <Text style={role === "barber" ? styles.activeRoleText : styles.roleText}>
                Business
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

          <View style={[styles.inputWrap, styles.fieldBlock]}>
            <Text style={styles.inputLabel}>Phone number</Text>
            <TextInput
              placeholder="082 123 4567"
              placeholderTextColor={colors.textMuted}
              style={styles.input}
              value={phone}
              onChangeText={setPhone}
              keyboardType="phone-pad"
              returnKeyType="done"
              onSubmitEditing={Keyboard.dismiss}
            />
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
                  color={colors.textMuted}
                />
              </TouchableOpacity>
            </View>
            <Text style={styles.inputHint}>
              At least {MIN_PASSWORD_LENGTH} characters, including a letter and a number.
            </Text>
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
                  color={colors.textMuted}
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
              <ActivityIndicator color={colors.accentText} />
            ) : (
              <View style={styles.buttonRow}>
                <Text style={styles.buttonText}>Sign Up</Text>
                <Icon name="arrow-forward" size={18} color={colors.accentText} />
              </View>
            )}
          </TouchableOpacity>

          {statusMessage ? <Text style={styles.statusText}>{statusMessage}</Text> : null}

          {/* Client-only: Google gives us no role, so the trigger defaults
              these accounts to 'client'. Businesses pick their role here and
              have a longer onboarding anyway, so they use the email form. */}
          {role === "client" ? <GoogleSignInButton label="Sign up with Google" /> : null}

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
  screen: { flex: 1, backgroundColor: colors.background },
  content: { padding: 20 },
  heroBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    alignSelf: "flex-start",
    marginBottom: 20,
  },
  logoBadge: {
    width: 34,
    height: 34,
    borderRadius: 10,
    backgroundColor: colors.accent,
    alignItems: "center",
    justifyContent: "center",
  },
  logoBadgeText: { fontSize: 13, fontWeight: "900", color: colors.accentText, letterSpacing: 0.3 },
  heroBadgeText: { color: colors.text, fontWeight: "800", fontSize: 15 },
  title: {
    fontSize: 28,
    fontWeight: "800",
    textAlign: "left",
    color: colors.text,
    marginBottom: 8,
  },
  subtitle: {
    color: colors.textMuted,
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 20,
    fontWeight: "600",
  },
  card: {
    backgroundColor: colors.surface,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 16,
    ...shadows.card,
  },
  sectionTitle: {
    color: colors.textMuted,
    fontWeight: "700",
    fontSize: 12,
    letterSpacing: 0.5,
    textTransform: "uppercase",
    marginBottom: 10,
  },
  roleContainer: { flexDirection: "row", gap: 12, marginBottom: 16 },
  roleBtn: {
    flex: 1,
    borderRadius: 14,
    paddingVertical: 14,
    paddingHorizontal: 12,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: "center",
    gap: 8,
    flexDirection: "row",
    justifyContent: "center",
  },
  activeRole: { backgroundColor: colors.accent, borderColor: colors.accent },
  roleText: { color: colors.textSecondary, fontWeight: "700" },
  activeRoleText: { color: colors.accentText, fontWeight: "800" },
  twoColRow: { flexDirection: "row", gap: 12, marginBottom: 14 },
  inputWrap: { flex: 1 },
  fieldBlock: { flexGrow: 0, marginBottom: 14 },
  inputLabel: { color: colors.textSecondary, fontSize: 12, fontWeight: "700", marginBottom: 8 },
  inputHint: { color: colors.textMuted, fontSize: 11, marginTop: 6, lineHeight: 15 },
  input: {
    borderWidth: 1,
    borderColor: colors.border,
    padding: 14,
    borderRadius: 14,
    backgroundColor: colors.surface,
    fontSize: 15,
    color: colors.text,
  },
  passwordContainer: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 14,
    backgroundColor: colors.surface,
  },
  passwordInput: { flex: 1, paddingVertical: 14, paddingHorizontal: 14, fontSize: 15, color: colors.text },
  eyeIcon: { padding: 12 },
  button: {
    backgroundColor: colors.accent,
    paddingVertical: 16,
    borderRadius: 14,
    alignItems: "center",
    marginTop: 14,
    ...shadows.button,
  },
  buttonRow: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8 },
  buttonText: { color: colors.accentText, fontWeight: "800", fontSize: 16 },
  buttonDisabled: { opacity: 0.7 },
  link: { marginTop: 16, alignItems: "center", paddingBottom: 6 },
  linkText: { color: colors.accent, fontWeight: "700" },
  statusText: {
    color: colors.textMuted,
    fontWeight: "600",
    fontSize: 13,
    lineHeight: 18,
    marginTop: 10,
    textAlign: "center",
  },
});
