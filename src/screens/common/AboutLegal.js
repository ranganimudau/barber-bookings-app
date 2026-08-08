import Constants from "expo-constants";
import React from "react";
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import Ionicons from "react-native-vector-icons/Ionicons";
import { useLightStatusBar } from "../../hooks/useLightStatusBar";
import { borderRadius, colors, shadows } from "../../theme/barberTheme";

const APP_VERSION = Constants.expoConfig?.version || "1.0.0";

const LEGAL_ITEMS = [
  {
    title: "Terms of Service",
    params: {
      title: "Terms of Service",
      draft: true,
      body: "These Terms of Service are a placeholder and haven't been finalised yet. Official terms will be published here before public launch. By using this app during testing, you agree it's for evaluation purposes only.",
    },
  },
  {
    title: "Privacy Policy",
    params: {
      title: "Privacy Policy",
      draft: true,
      body: "This Privacy Policy is a placeholder. The app collects only what it needs to run bookings — your name, email, phone number, profile photo, approximate location, and your booking history. Your details are shared with a business only when you book with them. A full privacy policy will be published here before public launch.",
    },
  },
];

/**
 * Groups the legal documents and build info behind a single Settings row —
 * three separate rows for Terms, Privacy and a version number took up more
 * of the settings page than they earn.
 */
export default function AboutLegal({ navigation }) {
  useLightStatusBar(colors.background);

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <Text style={styles.intro}>
        SkoonBook connects clients with barbers, nail techs, braiders, salons and other beauty
        professionals for easy booking. The app is currently in testing.
      </Text>

      <View style={styles.group}>
        {LEGAL_ITEMS.map((item) => (
          <TouchableOpacity
            key={item.title}
            style={styles.row}
            onPress={() => navigation.navigate("SupportInfo", item.params)}
            activeOpacity={0.8}
          >
            <Text style={styles.rowTitle}>{item.title}</Text>
            <Ionicons name="chevron-forward" size={20} color={colors.textMuted} />
          </TouchableOpacity>
        ))}
        <View style={[styles.row, styles.rowLast]}>
          <Text style={styles.rowTitle}>App version</Text>
          <Text style={styles.versionText}>{APP_VERSION}</Text>
        </View>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  content: { padding: 20 },
  intro: {
    fontSize: 14,
    color: colors.textSecondary,
    lineHeight: 21,
    marginBottom: 20,
    fontWeight: "500",
  },
  group: {
    backgroundColor: colors.surface,
    borderRadius: borderRadius.xl,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: "hidden",
    ...shadows.card,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 15,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  rowLast: { borderBottomWidth: 0 },
  rowTitle: { fontSize: 15, fontWeight: "700", color: colors.text, flex: 1 },
  versionText: { fontSize: 14, fontWeight: "600", color: colors.textMuted },
});
