import React, { useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Alert, ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import Ionicons from "react-native-vector-icons/Ionicons";
import { useLightStatusBar } from "../../hooks/useLightStatusBar";
import { supabase } from "../../supabase/supabaseClient";
import { colors, shadows } from "../../theme/barberTheme";
import { cancelPayfastSubscription } from "../../utils/cancelPayfastSubscription";
import {
  ensureBarberSubscriptionState,
  formatSubscriptionDate,
  getSubscriptionLabel,
  getTrialDaysRemaining,
  isPendingCancellation,
  isSubscriptionEligible,
} from "../../utils/subscriptionState";

export default function SubscriptionSettings({ navigation }) {
  useLightStatusBar(colors.background);
  const [subState, setSubState] = useState(null);
  const [loading, setLoading] = useState(true);
  const [cancelling, setCancelling] = useState(false);

  const eligible = useMemo(() => isSubscriptionEligible(subState), [subState]);
  const trialDaysRemaining = useMemo(() => getTrialDaysRemaining(subState), [subState]);
  const pendingCancellation = useMemo(() => isPendingCancellation(subState), [subState]);
  const activeNotCancelled = subState?.subscription_status === "active" && !pendingCancellation;

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

  const runCancel = async () => {
    setCancelling(true);
    try {
      await cancelPayfastSubscription();
      await load();
      Alert.alert("Subscription cancelled", "You'll keep full access until your current period ends.");
    } catch (e) {
      Alert.alert("Could not cancel", e?.message || "Something went wrong. Try again.");
    } finally {
      setCancelling(false);
    }
  };

  const handleCancelSubscription = () => {
    const untilDate = formatSubscriptionDate(subState?.subscription_renews_at) || "your renewal date";
    Alert.alert(
      "Cancel subscription?",
      `You'll keep full access until ${untilDate}. After that, your shop will be locked until you subscribe again.`,
      [
        { text: "Keep subscription", style: "cancel" },
        { text: "Cancel subscription", style: "destructive", onPress: runCancel },
      ]
    );
  };

  const statusIcon = pendingCancellation
    ? "time-outline"
    : eligible
    ? "checkmark-circle"
    : "lock-closed-outline";
  const statusIconColor = pendingCancellation ? colors.pending : eligible ? colors.success : colors.accent;

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
          <Ionicons name={statusIcon} size={18} color={statusIconColor} />
          <Text style={styles.rowText}>
            {pendingCancellation ? "Cancelled — access continues until period end" : eligible ? "Active / Eligible" : "Locked — payment required"}
          </Text>
        </View>
        <Text style={styles.hint}>
          {subState?.subscription_status === "grace"
            ? "Renewal failed — pay now to avoid your shop locking."
            : pendingCancellation
            ? "Your subscription won't renew. Bookings, earnings, and visibility stay fully working until then."
            : activeNotCancelled
            ? "Your R70/month subscription is active and will renew automatically."
            : eligible
            ? `Trial remaining: ${trialDaysRemaining} day(s)`
            : "Registration/subscription payment required."}
        </Text>
      </View>

      {activeNotCancelled ? (
        <TouchableOpacity
          style={[styles.dangerBtn, cancelling && styles.btnDisabled]}
          onPress={handleCancelSubscription}
          disabled={cancelling}
          activeOpacity={0.85}
        >
          {cancelling ? (
            <ActivityIndicator color={colors.error} size="small" />
          ) : (
            <Text style={styles.dangerBtnText}>Cancel subscription</Text>
          )}
        </TouchableOpacity>
      ) : !eligible || pendingCancellation ? (
        <TouchableOpacity style={styles.accentBtn} onPress={handleOpenCheckout} disabled={loading} activeOpacity={0.9}>
          <Text style={styles.accentBtnText}>Resubscribe</Text>
        </TouchableOpacity>
      ) : (
        <TouchableOpacity style={styles.accentBtn} onPress={handleOpenCheckout} disabled={loading} activeOpacity={0.9}>
          <Text style={styles.accentBtnText}>Manage payment</Text>
        </TouchableOpacity>
      )}
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
  rowText: { color: colors.text, fontWeight: "800", flexShrink: 1 },
  hint: { color: colors.textMuted, fontWeight: "700", marginTop: 10, lineHeight: 18 },
  accentBtn: {
    backgroundColor: colors.accent,
    borderRadius: 14,
    padding: 16,
    alignItems: "center",
    marginBottom: 12,
    ...shadows.button,
  },
  accentBtnText: { color: colors.accentText, fontWeight: "900", fontSize: 16 },
  dangerBtn: {
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.error,
    padding: 16,
    alignItems: "center",
    marginBottom: 12,
  },
  btnDisabled: { opacity: 0.6 },
  dangerBtnText: { color: colors.error, fontWeight: "900", fontSize: 16 },
});
