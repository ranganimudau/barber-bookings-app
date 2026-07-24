import React from "react";
import { Alert, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Icon from "react-native-vector-icons/Ionicons";

// Local to this screen only — deliberately not clientTheme.js, since this
// redesign is scoped to the Welcome screen and shouldn't re-theme the rest
// of the client-facing app.
const palette = {
  background: "#17140f",
  text: "#f2ede4",
  textMuted: "#a89f8e",
  accent: "#d4a45f",
  accentText: "#2c1f0d",
  badgeBg: "#2a241a",
  cellA: "#2c2620",
  cellB: "#33291f",
  cellIcon: "#6b6154",
  chipBg: "#221d15",
  chipBorder: "#3a3226",
  chipText: "#cfc7b8",
  secondaryBorder: "#4a4131",
};

export default function Welcome({ navigation }) {
  const insets = useSafeAreaInsets();

  return (
    <View
      style={[
        styles.screen,
        { paddingTop: Math.max(insets.top, 24) + 16, paddingBottom: Math.max(insets.bottom, 20) + 14 },
      ]}
    >
      <View style={styles.headerRow}>
        <View style={styles.logoBadge}>
          <Icon name="sparkles-outline" size={15} color={palette.accent} />
        </View>
        <Text style={styles.wordmark}>SkoonBook</Text>
      </View>

      <View style={styles.heroGrid}>
        <View style={[styles.heroCell, styles.heroCellLarge, { backgroundColor: palette.cellA }]}>
          <Icon name="cut-outline" size={30} color={palette.cellIcon} />
        </View>
        <View style={styles.heroCellStack}>
          <View style={[styles.heroCell, styles.heroCellSmall, { backgroundColor: palette.cellB }]}>
            <Icon name="color-palette-outline" size={24} color={palette.cellIcon} />
          </View>
          <View style={[styles.heroCell, styles.heroCellSmall, { backgroundColor: palette.cellA }]}>
            <Icon name="sparkles-outline" size={24} color={palette.cellIcon} />
          </View>
        </View>
      </View>

      <Text style={styles.heading}>Book any chair, any style</Text>
      <Text style={styles.subheading}>Hair, nails, and beauty pros near you — book in a tap.</Text>

      <View style={styles.chipRow}>
        <View style={styles.chip}>
          <Icon name="cut-outline" size={18} color={palette.accent} />
          <Text style={styles.chipLabel}>Hair</Text>
        </View>
        <View style={styles.chip}>
          <Icon name="hand-left-outline" size={18} color={palette.accent} />
          <Text style={styles.chipLabel}>Nails</Text>
        </View>
        <View style={styles.chip}>
          <Icon name="sparkles-outline" size={18} color={palette.accent} />
          <Text style={styles.chipLabel}>Salon</Text>
        </View>
      </View>

      <View style={styles.actions}>
        <TouchableOpacity style={styles.primaryBtn} onPress={() => navigation.navigate("Signup")} activeOpacity={0.9}>
          <Text style={styles.primaryBtnText}>Create account</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.secondaryBtn} onPress={() => navigation.navigate("Login")} activeOpacity={0.9}>
          <Text style={styles.secondaryBtnText}>I already have an account</Text>
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
    backgroundColor: palette.background,
    paddingHorizontal: 20,
  },
  headerRow: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 28 },
  logoBadge: {
    width: 28,
    height: 28,
    borderRadius: 8,
    backgroundColor: palette.badgeBg,
    alignItems: "center",
    justifyContent: "center",
  },
  wordmark: { fontSize: 13, fontWeight: "600", letterSpacing: 0.3, color: palette.text },

  heroGrid: { flexDirection: "row", gap: 3, height: 190, marginBottom: 20, borderRadius: 14, overflow: "hidden" },
  heroCell: { alignItems: "center", justifyContent: "center" },
  heroCellLarge: { flex: 1 },
  heroCellStack: { flex: 1, gap: 3 },
  heroCellSmall: { flex: 1 },

  heading: { fontSize: 22, fontWeight: "700", color: palette.text, marginBottom: 8 },
  subheading: { fontSize: 14, color: palette.textMuted, lineHeight: 20 },

  chipRow: { flexDirection: "row", gap: 8, marginTop: 24, marginBottom: "auto" },
  chip: {
    flex: 1,
    backgroundColor: palette.chipBg,
    borderWidth: 0.5,
    borderColor: palette.chipBorder,
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 8,
    alignItems: "center",
  },
  chipLabel: { fontSize: 11, marginTop: 6, color: palette.chipText },

  actions: { width: "100%", marginTop: 24 },
  primaryBtn: {
    backgroundColor: palette.accent,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 10,
  },
  primaryBtnText: { color: palette.accentText, fontWeight: "600", fontSize: 15 },
  secondaryBtn: {
    borderRadius: 12,
    borderWidth: 0.5,
    borderColor: palette.secondaryBorder,
    paddingVertical: 14,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 10,
  },
  secondaryBtnText: { color: palette.text, fontWeight: "600", fontSize: 15 },
  ghostBtn: { alignItems: "center", paddingVertical: 8 },
  ghostBtnText: { color: palette.textMuted, fontSize: 13, textDecorationLine: "underline" },
});
