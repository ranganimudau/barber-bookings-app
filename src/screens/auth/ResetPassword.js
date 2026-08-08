import AsyncStorage from "@react-native-async-storage/async-storage";
import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Icon from "react-native-vector-icons/Ionicons";
import KeyboardDoneBar from "../../components/common/KeyboardDoneBar";
import StatusBarBackdrop from "../../components/common/StatusBarBackdrop";
import { useKeyboardInset } from "../../hooks/useKeyboardInset";
import { useLightStatusBar } from "../../hooks/useLightStatusBar";
import { useScrollToFocusedInput } from "../../hooks/useScrollToFocusedInput";
import { supabase } from "../../supabase/supabaseClient";
import { colors, shadows } from "../../theme/barberTheme";

const OPEN_LOGIN_KEY = "auth_open_login_after_reset";

export default function ResetPassword() {
  useLightStatusBar(colors.background);
  const insets = useSafeAreaInsets();
  const keyboardInset = useKeyboardInset();
  const { scrollRef, handleFocus } = useScrollToFocusedInput();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [loading, setLoading] = useState(false);
  const [statusMessage, setStatusMessage] = useState("");
  const [sessionGate, setSessionGate] = useState("loading");

  useEffect(() => {
    let cancelled = false;
    let timeoutId;
    let subscription;

    const ready = () => {
      if (!cancelled) setSessionGate("ready");
    };
    const fail = () => {
      if (!cancelled) setSessionGate("error");
    };

    (async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (cancelled) return;
      if (session?.user) {
        ready();
        return;
      }

      timeoutId = setTimeout(fail, 12000);
      const {
        data: { subscription: sub },
      } = supabase.auth.onAuthStateChange((_event, nextSession) => {
        if (nextSession?.user) {
          if (timeoutId) clearTimeout(timeoutId);
          ready();
        }
      });
      subscription = sub;
    })();

    return () => {
      cancelled = true;
      if (timeoutId) clearTimeout(timeoutId);
      subscription?.unsubscribe();
    };
  }, []);

  const handleSubmit = async () => {
    const p = password.trim();
    const c = confirm.trim();
    if (p.length < 6) {
      Alert.alert(
        "Password too short",
        "Use at least 6 characters for your new password."
      );
      return;
    }
    if (p !== c) {
      Alert.alert("Mismatch", "New password and confirmation must match.");
      return;
    }

    setStatusMessage("Updating your password...");
    setLoading(true);
    try {
      const { error } = await supabase.auth.updateUser({ password: p });
      if (error) {
        Alert.alert("Could not update password", error.message);
        return;
      }
      await AsyncStorage.setItem(OPEN_LOGIN_KEY, "1");
      const { error: signOutError } = await supabase.auth.signOut();
      if (signOutError) {
        Alert.alert(
          "Password updated",
          "Your password was changed but sign-out had an issue: " +
            signOutError.message
        );
        return;
      }
      Alert.alert(
        "Password updated",
        "You can sign in with your new password."
      );
    } catch (e) {
      Alert.alert(
        "Something went wrong",
        e?.message || "Please try again."
      );
    } finally {
      setLoading(false);
      setStatusMessage("");
    }
  };

  const handleBackToLogin = () => {
    Alert.alert(
      "Return to sign in?",
      "If you leave now, use the link in your email again to set a new password.",
      [
        { text: "Stay", style: "cancel" },
        {
          text: "Sign in",
          style: "destructive",
          onPress: async () => {
            await AsyncStorage.setItem(OPEN_LOGIN_KEY, "1");
            await supabase.auth.signOut();
          },
        },
      ]
    );
  };

  if (sessionGate === "loading") {
    return (
      <View style={[styles.screen, styles.sessionGate]}>
        <StatusBarBackdrop />
        <ActivityIndicator size="large" color={colors.accent} />
        <Text style={styles.sessionGateText}>Opening secure reset…</Text>
      </View>
    );
  }

  if (sessionGate === "error") {
    return (
      <View style={[styles.screen, styles.sessionGate]}>
        <StatusBarBackdrop />
        <Icon name="alert-circle-outline" size={40} color={colors.accent} />
        <Text style={styles.sessionGateTitle}>Link not ready</Text>
        <Text style={styles.sessionGateText}>
          Request a new reset email from Sign in → Forgot password, and open
          the link on this device.
        </Text>
        <TouchableOpacity
          style={styles.sessionGateBtn}
          onPress={async () => {
            await AsyncStorage.setItem(OPEN_LOGIN_KEY, "1");
            await supabase.auth.signOut();
          }}
          activeOpacity={0.9}
        >
          <Text style={styles.sessionGateBtnText}>Back to sign in</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={styles.screen}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <StatusBarBackdrop />
      <ScrollView
        ref={scrollRef}
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
          <Icon name="key-outline" size={14} color={colors.accent} />
          <Text style={styles.heroBadgeText}>Secure reset</Text>
        </View>

        <Text style={styles.title}>Choose a new password</Text>
        <Text style={styles.subtitle}>
          Enter and confirm your new password. You will sign in again after
          saving.
        </Text>

        <View style={styles.card}>
          <Text style={styles.sectionTitle}>New password</Text>

          <View style={styles.inputWrap}>
            <Text style={styles.inputLabel}>New password</Text>
            <View style={styles.passwordContainer}>
              <TextInput
                placeholder="At least 6 characters"
                placeholderTextColor={colors.textMuted}
                style={styles.passwordInput}
                value={password}
                onChangeText={setPassword}
                secureTextEntry={!showPassword}
                autoCapitalize="none"
                returnKeyType="done"
                onSubmitEditing={Keyboard.dismiss}
                onFocus={handleFocus}
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
          </View>

          <View style={styles.inputWrap}>
            <Text style={styles.inputLabel}>Confirm password</Text>
            <View style={styles.passwordContainer}>
              <TextInput
                placeholder="Repeat new password"
                placeholderTextColor={colors.textMuted}
                style={styles.passwordInput}
                value={confirm}
                onChangeText={setConfirm}
                secureTextEntry={!showConfirm}
                autoCapitalize="none"
                returnKeyType="done"
                onSubmitEditing={Keyboard.dismiss}
                onFocus={handleFocus}
              />
              <TouchableOpacity
                onPress={() => setShowConfirm(!showConfirm)}
                style={styles.eyeIcon}
                activeOpacity={0.85}
              >
                <Icon
                  name={showConfirm ? "eye-off-outline" : "eye-outline"}
                  size={22}
                  color={colors.textMuted}
                />
              </TouchableOpacity>
            </View>
          </View>

          <TouchableOpacity
            style={[styles.button, loading && styles.buttonDisabled]}
            onPress={handleSubmit}
            disabled={loading}
            activeOpacity={0.9}
          >
            {loading ? (
              <ActivityIndicator color={colors.accentText} />
            ) : (
              <View style={styles.buttonRow}>
                <Text style={styles.buttonText}>Save new password</Text>
                <Icon name="checkmark-circle-outline" size={20} color={colors.accentText} />
              </View>
            )}
          </TouchableOpacity>

          {statusMessage ? (
            <Text style={styles.statusText}>{statusMessage}</Text>
          ) : null}

          <TouchableOpacity
            style={styles.link}
            onPress={handleBackToLogin}
            disabled={loading}
            activeOpacity={0.9}
          >
            <Text style={styles.linkText}>Back to sign in</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
      <KeyboardDoneBar inset={keyboardInset} />
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  sessionGate: {
    justifyContent: "center",
    alignItems: "center",
    padding: 28,
    gap: 14,
  },
  sessionGateTitle: {
    color: colors.text,
    fontSize: 20,
    fontWeight: "900",
    textAlign: "center",
    marginTop: 8,
  },
  sessionGateText: {
    color: colors.textMuted,
    fontSize: 14,
    fontWeight: "700",
    textAlign: "center",
    lineHeight: 20,
    maxWidth: 320,
  },
  sessionGateBtn: {
    marginTop: 16,
    backgroundColor: colors.accent,
    paddingVertical: 14,
    paddingHorizontal: 22,
    borderRadius: 14,
  },
  sessionGateBtnText: {
    color: colors.accentText,
    fontWeight: "900",
    fontSize: 15,
  },
  content: { padding: 20 },
  heroBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: colors.accentSoft,
    borderColor: colors.border,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    alignSelf: "flex-start",
    marginBottom: 20,
  },
  heroBadgeText: { color: colors.accent, fontWeight: "900", fontSize: 12 },
  title: {
    fontSize: 28,
    fontWeight: "800",
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
  inputWrap: { marginBottom: 14 },
  inputLabel: { color: colors.textSecondary, fontSize: 12, fontWeight: "700", marginBottom: 8 },
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
    marginTop: 4,
    ...shadows.button,
  },
  buttonRow: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8 },
  buttonText: { color: colors.accentText, fontWeight: "800", fontSize: 16 },
  link: { marginTop: 14, alignItems: "center", paddingBottom: 6 },
  linkText: {
    color: colors.textMuted,
    fontWeight: "700",
    textDecorationLine: "underline",
  },
  buttonDisabled: { opacity: 0.7 },
  statusText: {
    color: colors.textMuted,
    fontWeight: "600",
    fontSize: 13,
    lineHeight: 18,
    marginTop: 10,
    textAlign: "center",
  },
});

export const AUTH_OPEN_LOGIN_AFTER_RESET_KEY = OPEN_LOGIN_KEY;
