import React, { useState } from "react";
import { ActivityIndicator, Alert, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import Icon from "react-native-vector-icons/Ionicons";
import { useAuthProviders } from "../../hooks/useAuthProviders";
import { colors, shadows } from "../../theme/barberTheme";
import { signInWithGoogle } from "../../utils/signInWithGoogle";

/**
 * Renders nothing until the project reports Google as enabled, so this can
 * ship before the OAuth credentials exist without leaving a button that
 * fails when tapped.
 *
 * Signing in this way always creates a client account — the trigger
 * defaults role to 'client'. Businesses have a much longer onboarding
 * (shop details, services, location, subscription) and pick their role on
 * the email signup form, so Google is deliberately the client path.
 */
export default function GoogleSignInButton({ label = "Continue with Google" }) {
  const { providers } = useAuthProviders();
  const [busy, setBusy] = useState(false);

  if (!providers.google) return null;

  const handlePress = async () => {
    setBusy(true);
    try {
      const result = await signInWithGoogle();
      // Success needs no navigation — App.js's onAuthStateChange listener
      // sees the new session and swaps the navigator over.
      if (!result.ok && !result.cancelled) {
        Alert.alert("Google sign-in", "Could not complete sign-in. Please try again.");
      }
    } catch (e) {
      Alert.alert("Google sign-in failed", e?.message || "Please try again.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <View style={styles.dividerRow}>
        <View style={styles.dividerLine} />
        <Text style={styles.dividerText}>or</Text>
        <View style={styles.dividerLine} />
      </View>

      <TouchableOpacity
        style={[styles.button, busy && styles.buttonBusy]}
        onPress={handlePress}
        disabled={busy}
        activeOpacity={0.85}
      >
        {busy ? (
          <ActivityIndicator size="small" color={colors.text} />
        ) : (
          <>
            <Icon name="logo-google" size={18} color={colors.text} />
            <Text style={styles.buttonText}>{label}</Text>
          </>
        )}
      </TouchableOpacity>
    </>
  );
}

const styles = StyleSheet.create({
  dividerRow: { flexDirection: "row", alignItems: "center", gap: 12, marginTop: 18, marginBottom: 14 },
  dividerLine: { flex: 1, height: StyleSheet.hairlineWidth, backgroundColor: colors.borderStrong },
  dividerText: { color: colors.textMuted, fontSize: 12, fontWeight: "700" },
  button: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    borderRadius: 14,
    paddingVertical: 15,
    ...shadows.card,
  },
  buttonBusy: { opacity: 0.7 },
  buttonText: { color: colors.text, fontWeight: "800", fontSize: 15 },
});
