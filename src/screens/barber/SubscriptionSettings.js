import React, { useEffect, useMemo, useState } from "react";
import { Alert, ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import Ionicons from "react-native-vector-icons/Ionicons";
import { supabase } from "../../supabase/supabaseClient";
import { colors, shadows } from "../../theme/barberTheme";
import { ensureBarberSubscriptionState, getSubscriptionLabel, getTrialDaysRemaining, isSubscriptionEligible } from "../../utils/subscriptionState";

export default function SubscriptionSettings({ navigation }) {
  const [subState, setSubState] = useState(null);
  const [loading, setLoading] = useState(true);

  const eligible = useMemo(() => isSubscriptionEligible(subState), [subState]);
  const trialDaysRemaining = useMemo(() => getTrialDaysRemaining(subState), [subState]);

  const load = async () => {
    setLoading(true);
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;
      setSubState(await ensureBarberSubscriptionState(user.id));
    } catch (e) {
      Alert.alert("Error", e?.message || "Could not load subscription state");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const handleOpenCheckout = () =>
    navigation.navigate("SubscriptionPaywall", { fromSettings: true });

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={styles.content}
      bounces={false}
      overScrollMode="never"
    >
      <Text style={styles.title}>Subscription</Text>
      <Text style={styles.subtitle}>{getSubscriptionLabel(subState)}</Text>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Status</Text>
        <View style={styles.row}>
          <Ionicons
            name={eligible ? "checkmark-circle" : "lock-closed-outline"}
            size={18}
            color={eligible ? colors.success : colors.accent}
          />
          <Text style={styles.rowText}>{eligible ? "Active / Eligible" : "Locked — payment required"}</Text>
        </View>
        <Text style={styles.hint}>
          {subState?.subscription_status === "active"
            ? "Subscription is active."
            : subState?.subscription_status === "grace"
            ? "Renewal failed — pay now to avoid your shop locking."
            : eligible
            ? `Trial remaining: ${trialDaysRemaining} day(s)`
            : "Registration/subscription payment required."}
        </Text>
      </View>

      <TouchableOpacity style={styles.accentBtn} onPress={handleOpenCheckout} disabled={loading} activeOpacity={0.9}>
        <Text style={styles.accentBtnText}>Manage payment</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  content: { padding: 18, paddingTop: 24, paddingBottom: 34 },
  title: { color: colors.text, fontSize: 22, fontWeight: "900", marginBottom: 6 },
  subtitle: { color: colors.textMuted, fontWeight: "800", marginBottom: 18 },
  card: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 18,
    padding: 14,
    marginBottom: 14,
    ...shadows.card,
  },
  cardTitle: { color: colors.text, fontWeight: "900", marginBottom: 10 },
  row: { flexDirection: "row", alignItems: "center", gap: 10 },
  rowText: { color: colors.text, fontWeight: "800" },
  hint: { color: colors.textMuted, fontWeight: "700", marginTop: 10 },
  accentBtn: {
    backgroundColor: colors.accent,
    borderRadius: 14,
    padding: 16,
    alignItems: "center",
    marginBottom: 12,
  },
  accentBtnText: { color: colors.accentText, fontWeight: "900", fontSize: 16 },
  ghostBtn: {
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 14,
    alignItems: "center",
  },
  ghostBtnText: { color: colors.accent, fontWeight: "900" },
});
