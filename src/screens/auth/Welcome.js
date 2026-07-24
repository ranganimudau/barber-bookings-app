import React from "react";
import { Alert, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useLightStatusBar } from "../../hooks/useLightStatusBar";
import { colors, shadows } from "../../theme/barberTheme";

export default function Welcome({ navigation }) {
  useLightStatusBar(colors.background);
  const insets = useSafeAreaInsets();

  return (
    <View
      style={[
        styles.screen,
        { paddingTop: Math.max(insets.top, 24) + 24, paddingBottom: Math.max(insets.bottom, 20) + 14 },
      ]}
    >
      <View style={styles.content}>
        <View style={styles.logoBadge}>
          <Text style={styles.logoBadgeText}>SB</Text>
        </View>

        <Text style={styles.title}>SkoonBook</Text>
        <Text style={styles.subtitle}>Hair, nails and beauty, near you.</Text>

        <View style={styles.imagePlaceholder} />
      </View>

      <View style={styles.actions}>
        <TouchableOpacity style={styles.primaryBtn} onPress={() => navigation.navigate("Signup")} activeOpacity={0.9}>
          <Text style={styles.primaryBtnText}>Create account</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.secondaryBtn} onPress={() => navigation.navigate("Login")} activeOpacity={0.9}>
          <Text style={styles.secondaryBtnText}>Log in</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.ghostBtn}
          onPress={() =>
            Alert.alert(
              "Guest preview",
              "Quick guest preview mode is coming soon. For now, create an account or sign in to continue."
            )
          }
          activeOpacity={0.85}
        >
          <Text style={styles.ghostBtnText}>Explore as guest (preview)</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.background,
    paddingHorizontal: 24,
    justifyContent: "center",
  },
  content: { alignItems: "center" },
  logoBadge: {
    width: 56,
    height: 56,
    borderRadius: 16,
    backgroundColor: colors.accent,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 20,
    ...shadows.button,
  },
  logoBadgeText: { fontSize: 20, fontWeight: "900", color: colors.accentText, letterSpacing: 0.5 },
  title: { fontSize: 28, fontWeight: "800", color: colors.text, marginBottom: 8 },
  subtitle: { fontSize: 15, color: colors.textMuted, textAlign: "center" },
  imagePlaceholder: {
    width: "100%",
    height: 160,
    borderRadius: 18,
    backgroundColor: colors.accentSoft,
    marginTop: 32,
  },

  actions: { width: "100%", marginTop: 32 },
  primaryBtn: {
    backgroundColor: colors.accent,
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 12,
    ...shadows.button,
  },
  primaryBtnText: { color: colors.accentText, fontWeight: "800", fontSize: 16 },
  secondaryBtn: {
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.border,
    paddingVertical: 15,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.surface,
    marginBottom: 12,
  },
  secondaryBtnText: { color: colors.accent, fontWeight: "800", fontSize: 15 },
  ghostBtn: { alignItems: "center", paddingVertical: 10 },
  ghostBtnText: { color: colors.textMuted, fontSize: 13, fontWeight: "700", textDecorationLine: "underline" },
});
