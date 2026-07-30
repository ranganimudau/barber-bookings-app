import React from "react";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import Icon from "react-native-vector-icons/Ionicons";
import { useGuestMode } from "../../context/GuestModeContext";
import { useClientThemeMode } from "../../theme/ClientThemeMode";

/**
 * Stands in for the account-only client tabs while browsing as a guest.
 * Those screens all read from the signed-in user's own rows, so without a
 * session they'd render empty or throw — better to say plainly why it's
 * empty and offer the way out.
 */
export default function GuestPrompt({ route, navigation }) {
  const { colors: themeColors } = useClientThemeMode();
  const { exitGuestMode } = useGuestMode();
  const { icon, title, body } = route.params || {};

  return (
    <View style={[styles.screen, { backgroundColor: themeColors.background }]}>
      <View style={[styles.iconWrap, { backgroundColor: themeColors.surfaceAlt }]}>
        <Icon name={icon || "person-circle-outline"} size={34} color={themeColors.accent} />
      </View>

      <Text style={[styles.title, { color: themeColors.text }]}>{title || "Account needed"}</Text>
      <Text style={[styles.body, { color: themeColors.textMuted }]}>{body}</Text>

      <TouchableOpacity
        style={[styles.primaryBtn, { backgroundColor: themeColors.accent }]}
        onPress={exitGuestMode}
        activeOpacity={0.9}
      >
        <Text style={styles.primaryBtnText}>Create account</Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={styles.ghostBtn}
        onPress={() => navigation.navigate("Find")}
        activeOpacity={0.85}
      >
        <Text style={[styles.ghostBtnText, { color: themeColors.accent }]}>Keep browsing</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, alignItems: "center", justifyContent: "center", paddingHorizontal: 32 },
  iconWrap: {
    width: 72,
    height: 72,
    borderRadius: 24,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 20,
  },
  title: { fontSize: 20, fontWeight: "800", marginBottom: 10, textAlign: "center" },
  body: { fontSize: 14, lineHeight: 21, textAlign: "center", marginBottom: 26 },
  primaryBtn: {
    alignSelf: "stretch",
    borderRadius: 14,
    paddingVertical: 15,
    alignItems: "center",
    marginBottom: 10,
  },
  primaryBtnText: { color: "#fff", fontWeight: "800", fontSize: 15 },
  ghostBtn: { paddingVertical: 10 },
  ghostBtnText: { fontWeight: "700", fontSize: 14 },
});
