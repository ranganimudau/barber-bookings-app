import React from "react";
import { Alert, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import Icon from "react-native-vector-icons/Ionicons";
import { colors } from "../../theme/clientTheme";

export default function Welcome({ navigation }) {
  return (
    <View style={styles.screen}>
      <View style={styles.content}>
        <View style={styles.logoBadge}>
          <Icon name="cut-outline" size={28} color={colors.accent} />
        </View>

        <Text style={styles.title}>Welcome to BarberApp Pro</Text>
        <Text style={styles.subtitle}>Book, manage, and grow your beauty business.</Text>
      </View>

      <View style={styles.actions}>
        <TouchableOpacity style={styles.primaryBtn} onPress={() => navigation.navigate("Signup")} activeOpacity={0.9}>
          <Text style={styles.primaryBtnText}>Create Account</Text>
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
    backgroundColor: colors.background,
    justifyContent: "space-between",
    paddingHorizontal: 24,
    paddingTop: 100,
    paddingBottom: 34,
  },
  content: { alignItems: "center" },
  logoBadge: {
    width: 64,
    height: 64,
    borderRadius: 20,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "rgba(197,160,112,0.12)",
    borderWidth: 1,
    borderColor: "rgba(197,160,112,0.32)",
    marginBottom: 24,
  },
  title: { fontSize: 26, color: "#F5F5F0", fontWeight: "900", textAlign: "center", marginBottom: 10 },
  subtitle: { color: colors.textMuted, fontSize: 15, lineHeight: 22, textAlign: "center" },
  actions: { width: "100%" },
  primaryBtn: {
    backgroundColor: colors.accent,
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 12,
  },
  primaryBtnText: { color: "#0A0A0A", fontWeight: "900", fontSize: 16 },
  secondaryBtn: {
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "rgba(197,160,112,0.35)",
    paddingVertical: 15,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.02)",
    marginBottom: 12,
  },
  secondaryBtnText: { color: "#F5F5F0", fontWeight: "700", fontSize: 15 },
  ghostBtn: { alignItems: "center", paddingVertical: 10 },
  ghostBtnText: { color: colors.textMuted, fontSize: 13, fontWeight: "700", textDecorationLine: "underline" },
});
