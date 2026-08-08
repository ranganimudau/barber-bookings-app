import React from "react";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import Icon from "react-native-vector-icons/Ionicons";
import { useGuestMode } from "../../context/GuestModeContext";
import { useLightStatusBar } from "../../hooks/useLightStatusBar";
import { colors } from "../../theme/barberTheme";

/**
 * Stands in for the account-only client tabs while browsing as a guest.
 * Those screens all read from the signed-in user's own rows, so without a
 * session they'd render empty or throw — better to say plainly why it's
 * empty and offer the way out.
 */
export default function GuestPrompt({ route, navigation }) {
  useLightStatusBar(colors.background);
  const { exitGuestMode } = useGuestMode();
  const { icon, title, body } = route.params || {};

  return (
    <View style={styles.screen}>
      <View style={styles.iconWrap}>
        <Icon name={icon || "person-circle-outline"} size={34} color={colors.accent} />
      </View>

      <Text style={styles.title}>{title || "Account needed"}</Text>
      <Text style={styles.body}>{body}</Text>

      <TouchableOpacity
        style={styles.primaryBtn}
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
        <Text style={styles.ghostBtnText}>Keep browsing</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, alignItems: "center", justifyContent: "center", paddingHorizontal: 32, backgroundColor: colors.background },
  iconWrap: {
    width: 72,
    height: 72,
    borderRadius: 24,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.accentSoft,
    marginBottom: 20,
  },
  title: { fontSize: 20, fontWeight: "800", marginBottom: 10, textAlign: "center", color: colors.text },
  body: { fontSize: 14, lineHeight: 21, textAlign: "center", marginBottom: 26, color: colors.textMuted },
  primaryBtn: {
    alignSelf: "stretch",
    borderRadius: 14,
    paddingVertical: 15,
    alignItems: "center",
    marginBottom: 10,
    backgroundColor: colors.accent,
  },
  primaryBtnText: { color: colors.accentText, fontWeight: "800", fontSize: 15 },
  ghostBtn: { paddingVertical: 10 },
  ghostBtnText: { fontWeight: "700", fontSize: 14, color: colors.accent },
});
