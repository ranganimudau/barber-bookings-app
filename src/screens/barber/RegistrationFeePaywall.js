import React, { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Linking,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Ionicons from "react-native-vector-icons/Ionicons";
import { supabase } from "../../supabase/supabaseClient";
import { createPayfastCheckout } from "../../utils/createPayfastCheckout";
import { colors } from "../../theme/clientTheme";
import {
  ensureBarberSubscriptionState,
  getSubscriptionLabel,
  getTrialRemaining,
  isSubscriptionEligible,
} from "../../utils/subscriptionState";

const REG_AMOUNT = "70";

export default function RegistrationFeePaywall({ navigation }) {
  const insets = useSafeAreaInsets();
  const [subState, setSubState] = useState(null);
  const [loading, setLoading] = useState(true);
  const [checkoutLoading, setCheckoutLoading] = useState(false);

  const eligible = useMemo(() => isSubscriptionEligible(subState), [subState]);
  const trialRemaining = useMemo(() => getTrialRemaining(subState), [subState]);
  const statusLabel = subState ? getSubscriptionLabel(subState) : "Checking…";
  const registrationPaid = !!subState?.registration_fee_paid;
  const trialActive = subState?.status === "trial" && trialRemaining > 0;

  const load = async () => {
    setLoading(true);
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;
      const state = await ensureBarberSubscriptionState(user.id);
      setSubState(state);
    } catch (e) {
      Alert.alert("Error", e?.message || "Could not load subscription state");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  useEffect(() => {
    if (!loading && subState?.status === "active") {
      navigation.reset({ index: 0, routes: [{ name: "BarberDashboard" }] });
    }
  }, [loading, subState, navigation]);

  const beginRegistrationCheckout = async () => {
    try {
      setCheckoutLoading(true);
      const data = await createPayfastCheckout({ plan: "trial_then_sub" });
      const ok = await Linking.openURL(data.payment_url);
      if (!ok) throw new Error("Could not open PayFast checkout");
    } catch (e) {
      Alert.alert("Payment error", e?.message || "Could not start checkout.");
    } finally {
      setCheckoutLoading(false);
    }
  };

  const handleContinueToApp = () => {
    if (trialActive) {
      navigation.reset({ index: 0, routes: [{ name: "BarberDashboard" }] });
      return;
    }
    if (subState?.status === "active") {
      navigation.reset({ index: 0, routes: [{ name: "BarberDashboard" }] });
      return;
    }
    Alert.alert("Payment required", "Pay the R70 registration fee to unlock your 5 free client bookings.");
  };

  const contentPad = {
    paddingTop: Math.max(insets.top, 16) + 8,
    paddingBottom: Math.max(insets.bottom, 20) + 32,
  };

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={[styles.content, contentPad]}
      keyboardShouldPersistTaps="handled"
      showsVerticalScrollIndicator={false}
    >
      <TouchableOpacity style={styles.backRow} onPress={() => navigation.goBack()} activeOpacity={0.85}>
        <Ionicons name="chevron-back" size={22} color={colors.accent} />
        <Text style={styles.backText}>Subscription options</Text>
      </TouchableOpacity>

      <View style={styles.headerBlock}>
        <View style={styles.kickerRow}>
          <View style={styles.kickerIcon}>
            <Ionicons name="document-outline" size={16} color={colors.accent} />
          </View>
          <Text style={styles.kicker}>Registration fee</Text>
        </View>
        <Text style={styles.heroTitle}>Pay R{REG_AMOUNT} to start your 5 free clients</Text>
        <Text style={styles.heroSub}>
          This one-time registration unlocks your trial: accept up to five bookings with no monthly fee yet.
          After those five, you will need the R100 subscription to keep receiving new requests.
        </Text>
        <View style={styles.statusPill}>
          <View style={[styles.statusDot, eligible && styles.statusDotOk]} />
          <Text style={styles.statusPillText} numberOfLines={2}>
            {loading ? "Loading status…" : statusLabel}
          </Text>
        </View>
      </View>

      {loading ? (
        <View style={styles.loadingBox}>
          <ActivityIndicator size="large" color={colors.accent} />
        </View>
      ) : null}

      <View style={styles.feeCard}>
        <View style={styles.feeRow}>
          <Text style={styles.feeLabel}>Registration (once)</Text>
          <Text style={styles.feeValue}>R{REG_AMOUNT}</Text>
        </View>
        <Text style={styles.feeHint}>Paid securely via PayFast. You will return to the app after checkout.</Text>
      </View>

      <TouchableOpacity
        style={[styles.primaryCta, (loading || checkoutLoading || trialActive) && styles.ctaDisabled]}
        onPress={beginRegistrationCheckout}
        disabled={loading || checkoutLoading || trialActive}
        activeOpacity={0.9}
      >
        <Text style={styles.primaryCtaText}>
          {trialActive ? "Registration paid — trial active" : `Pay R${REG_AMOUNT} with PayFast`}
        </Text>
        {!trialActive ? <Ionicons name="card-outline" size={20} color="#0A0A0A" /> : null}
      </TouchableOpacity>

      <TouchableOpacity
        style={styles.ghostRefresh}
        onPress={load}
        disabled={loading || checkoutLoading}
        activeOpacity={0.85}
      >
        {loading ? (
          <ActivityIndicator color={colors.accent} />
        ) : (
          <Text style={styles.ghostRefreshText}>I have completed payment</Text>
        )}
      </TouchableOpacity>

      {(registrationPaid || trialActive) && (
        <TouchableOpacity style={styles.secondaryCta} onPress={handleContinueToApp} activeOpacity={0.88}>
          <Text style={styles.secondaryCtaText}>Continue to dashboard</Text>
          <Ionicons name="arrow-forward" size={18} color={colors.accent} />
        </TouchableOpacity>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  content: { paddingHorizontal: 20 },
  backRow: { flexDirection: "row", alignItems: "center", marginBottom: 18, gap: 4 },
  backText: { color: colors.accent, fontSize: 15, fontWeight: "800" },
  headerBlock: { marginBottom: 22 },
  kickerRow: { flexDirection: "row", alignItems: "center", marginBottom: 12 },
  kickerIcon: {
    width: 32,
    height: 32,
    borderRadius: 10,
    backgroundColor: "rgba(197,160,112,0.12)",
    borderWidth: 1,
    borderColor: "rgba(197,160,112,0.28)",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 10,
  },
  kicker: {
    color: colors.accent,
    fontSize: 12,
    fontWeight: "800",
    letterSpacing: 1.2,
    textTransform: "uppercase",
  },
  heroTitle: {
    color: "#F5F5F0",
    fontSize: 24,
    fontWeight: "800",
    lineHeight: 30,
    marginBottom: 10,
    letterSpacing: -0.3,
  },
  heroSub: {
    color: colors.textMuted,
    fontSize: 14,
    lineHeight: 21,
    marginBottom: 14,
  },
  statusPill: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "flex-start",
    backgroundColor: "rgba(255,255,255,0.04)",
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "rgba(197,160,112,0.2)",
    maxWidth: "100%",
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.textMuted,
    marginRight: 8,
  },
  statusDotOk: { backgroundColor: "#34D399" },
  statusPillText: {
    color: "#E8E6E1",
    fontSize: 13,
    fontWeight: "700",
    flexShrink: 1,
  },
  loadingBox: { paddingVertical: 8, marginBottom: 8, alignItems: "center" },
  feeCard: {
    backgroundColor: "rgba(255,255,255,0.03)",
    borderWidth: 1,
    borderColor: "rgba(197,160,112,0.22)",
    borderRadius: 20,
    padding: 18,
    marginBottom: 20,
  },
  feeRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  feeLabel: { color: "#F5F5F0", fontSize: 16, fontWeight: "800" },
  feeValue: { color: colors.accent, fontSize: 22, fontWeight: "900" },
  feeHint: { color: colors.textMuted, fontSize: 12, fontWeight: "600", marginTop: 12, lineHeight: 17 },
  primaryCta: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    backgroundColor: colors.accent,
    borderRadius: 16,
    paddingVertical: 17,
    paddingHorizontal: 20,
    marginBottom: 12,
  },
  ctaDisabled: { opacity: 0.55 },
  primaryCtaText: { color: "#0A0A0A", fontSize: 16, fontWeight: "900" },
  ghostRefresh: {
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "rgba(197,160,112,0.35)",
    paddingVertical: 12,
    alignItems: "center",
    marginBottom: 12,
  },
  ghostRefreshText: { color: colors.accent, fontWeight: "800" },
  secondaryCta: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 14,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "rgba(197,160,112,0.45)",
    backgroundColor: "#0A0A0A",
  },
  secondaryCtaText: { color: "#F5F5F0", fontSize: 15, fontWeight: "800" },
});
