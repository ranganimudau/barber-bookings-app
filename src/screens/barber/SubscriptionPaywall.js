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

const BENEFITS = [
  "Unlimited booking requests",
  "Full availability & scheduling",
  "Earnings & insights unlocked",
];

export default function SubscriptionPaywall({ navigation, route }) {
  const insets = useSafeAreaInsets();
  const [subState, setSubState] = useState(null);
  const [loading, setLoading] = useState(true);
  const [checkoutLoading, setCheckoutLoading] = useState(false);

  const eligible = useMemo(() => isSubscriptionEligible(subState), [subState]);
  const trialRemaining = useMemo(() => getTrialRemaining(subState), [subState]);
  const statusLabel = subState ? getSubscriptionLabel(subState) : "Checking…";
  const canPaySubscriptionOnly = useMemo(() => {
    if (!subState) return false;
    if (subState.status === "active") return false;
    const registrationPaid = !!subState.registration_fee_paid;
    const trialExhausted = subState.status === "trial" && getTrialRemaining(subState) <= 0;
    const inactiveAfterRegistration = subState.status === "inactive" && registrationPaid;
    return trialExhausted || inactiveAfterRegistration;
  }, [subState]);

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

  const openedFromSettings = !!route?.params?.fromSettings;

  useEffect(() => {
    if (!openedFromSettings && !loading && subState?.status === "active") {
      navigation.reset({ index: 0, routes: [{ name: "BarberDashboard" }] });
    }
  }, [openedFromSettings, loading, subState, navigation]);

  const beginCheckout = async (plan) => {
    try {
      setCheckoutLoading(true);
      const data = await createPayfastCheckout({ plan });

      const ok = await Linking.openURL(data.payment_url);
      if (!ok) throw new Error("Could not open PayFast checkout");
    } catch (e) {
      Alert.alert("Payment error", e?.message || "Could not start checkout.");
    } finally {
      setCheckoutLoading(false);
    }
  };

  const handleChooseTrialPath = () => navigation.navigate("RegistrationFeePaywall");
  const handlePayNowPath = () => beginCheckout("subscribe_now");
  const handlePaySubscriptionOnly = () => beginCheckout("subscription_only");

  const handleSkip = () => {
    if (eligible) {
      navigation.reset({ index: 0, routes: [{ name: "BarberDashboard" }] });
      return;
    }
    Alert.alert(
      "Registration fee required",
      "To use the 5 free clients plan, continue and pay the R70 registration fee.",
      [
        { text: "Cancel", style: "cancel" },
        { text: "Pay registration", onPress: () => navigation.navigate("RegistrationFeePaywall") },
      ]
    );
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
      {/* Header — cleared from status bar */}
      <View style={styles.headerBlock}>
        <View style={styles.kickerRow}>
          <View style={styles.kickerIcon}>
            <Ionicons name="rocket-outline" size={16} color={colors.accent} />
          </View>
          <Text style={styles.kicker}>Go live on Bookings</Text>
        </View>
        <Text style={styles.heroTitle}>Choose how you want to get paid bookings</Text>
        <Text style={styles.heroSub}>
          Pay registration first, then choose trial or full subscription activation with PayFast.
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

      {/* Plan card */}
      <View style={styles.sectionLabelWrap}>
        <Text style={styles.sectionLabel}>Monthly plan</Text>
      </View>
      <View style={styles.planCard}>
        <View style={styles.planTop}>
          <View>
            <Text style={styles.planName}>Pay now, go fully live</Text>
            <Text style={styles.planTagline}>Registration + subscription in one payment</Text>
          </View>
          <View style={styles.priceBlock}>
            <Text style={styles.currency}>R</Text>
            <Text style={styles.priceAmount}>130</Text>
          </View>
        </View>
        <Text style={styles.perMonth}>R30 registration + R100 subscription now</Text>
        <View style={styles.divider} />
        {BENEFITS.map((line) => (
          <View key={line} style={styles.benefitRow}>
            <Ionicons name="checkmark-circle" size={18} color="#34D399" />
            <Text style={styles.benefitText}>{line}</Text>
          </View>
        ))}
      </View>

      {/* Trial card with registration fee */}
      <View style={styles.sectionLabelWrap}>
        <Text style={styles.sectionLabel}>Or pay registration only first</Text>
      </View>
      <View style={[styles.trialCard, subState?.status === "trial" && trialRemaining > 0 && styles.trialCardActive]}>
        <View style={styles.trialHeaderRow}>
          <Ionicons name="gift-outline" size={22} color={colors.accent} />
          <Text style={styles.trialTitle}>R70 + 5 free accepted bookings</Text>
        </View>
        <Text style={styles.trialBody}>
          {subState?.status === "trial" && trialRemaining >= 0
            ? trialRemaining > 0
              ? `${trialRemaining} free acceptance${trialRemaining === 1 ? "" : "s"} left — tap Accept on jobs to use them.`
              : "Trial uses done — pay R100 subscription to keep receiving requests."
            : "Pay R70 registration fee to unlock the first 5 accepted bookings. After 5, subscription is R100."}
        </Text>
        <TouchableOpacity
          style={[
            styles.secondaryCta,
            subState?.status === "trial" && trialRemaining > 0 && styles.secondaryCtaMuted,
          ]}
          onPress={handleChooseTrialPath}
          disabled={loading || (subState?.status === "trial" && trialRemaining > 0)}
          activeOpacity={0.88}
        >
          <Ionicons name="sparkles-outline" size={18} color={colors.accent} />
          <Text style={styles.secondaryCtaText}>
            {subState?.status === "trial" && trialRemaining > 0
              ? "Free trial active"
              : "Continue with 5 free clients"}
          </Text>
        </TouchableOpacity>
      </View>

      {/* Full payment CTA */}
      <TouchableOpacity
        style={[styles.primaryCta, (loading || checkoutLoading) && styles.ctaDisabled]}
        onPress={handlePayNowPath}
        disabled={loading || checkoutLoading}
        activeOpacity={0.9}
      >
        <Text style={styles.primaryCtaText}>Pay R130 now (R30 + R100)</Text>
        <Ionicons name="arrow-forward" size={20} color="#0A0A0A" />
      </TouchableOpacity>

      {canPaySubscriptionOnly ? (
        <TouchableOpacity
          style={[styles.subscriptionOnlyCta, (loading || checkoutLoading) && styles.ctaDisabled]}
          onPress={handlePaySubscriptionOnly}
          disabled={loading || checkoutLoading}
          activeOpacity={0.9}
        >
          <Text style={styles.subscriptionOnlyText}>Pay R100 subscription only</Text>
          <Ionicons name="card-outline" size={18} color={colors.accent} />
        </TouchableOpacity>
      ) : null}

      <TouchableOpacity
        style={styles.ghostRefresh}
        onPress={load}
        disabled={loading || checkoutLoading}
        activeOpacity={0.85}
      >
        {loading ? <ActivityIndicator color={colors.accent} /> : <Text style={styles.ghostRefreshText}>I have completed payment</Text>}
      </TouchableOpacity>

      {eligible ? (
        <TouchableOpacity style={styles.textLink} onPress={handleSkip} disabled={loading} activeOpacity={0.85}>
          <Text style={styles.textLinkLabel}>Continue to dashboard</Text>
          <Text style={styles.textLinkHint}>Your subscription or trial is active.</Text>
        </TouchableOpacity>
      ) : (
        <TouchableOpacity style={styles.textLink} onPress={handleSkip} disabled={loading} activeOpacity={0.85}>
          <Text style={styles.textLinkLabel}>Skip for now</Text>
          <Text style={styles.textLinkHint}>You will need payment before accepting bookings.</Text>
        </TouchableOpacity>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  content: { paddingHorizontal: 20 },
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
    fontSize: 26,
    fontWeight: "800",
    lineHeight: 32,
    marginBottom: 10,
    letterSpacing: -0.3,
  },
  heroSub: {
    color: colors.textMuted,
    fontSize: 15,
    lineHeight: 22,
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
  sectionLabelWrap: { marginBottom: 8, marginTop: 4 },
  sectionLabel: {
    color: colors.textMuted,
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 1,
    textTransform: "uppercase",
  },
  planCard: {
    backgroundColor: "rgba(255,255,255,0.03)",
    borderWidth: 1,
    borderColor: "rgba(197,160,112,0.22)",
    borderRadius: 20,
    padding: 18,
    marginBottom: 20,
  },
  planTop: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" },
  planName: { color: "#F5F5F0", fontSize: 18, fontWeight: "800", marginBottom: 4 },
  planTagline: { color: colors.textMuted, fontSize: 13, maxWidth: 200 },
  priceBlock: { flexDirection: "row", alignItems: "flex-start" },
  currency: { color: colors.accent, fontSize: 18, fontWeight: "800", marginTop: 4, marginRight: 2 },
  priceAmount: { color: "#F5F5F0", fontSize: 40, fontWeight: "900", letterSpacing: -1 },
  perMonth: { color: colors.textMuted, fontSize: 12, fontWeight: "600", marginTop: 4, marginBottom: 14 },
  divider: {
    height: 1,
    backgroundColor: "rgba(197,160,112,0.15)",
    marginBottom: 14,
  },
  benefitRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "rgba(255,255,255,0.06)",
  },
  benefitText: { color: "#F5F5F0", fontSize: 15, fontWeight: "600", marginLeft: 12, flex: 1 },
  trialCard: {
    backgroundColor: "rgba(255,255,255,0.02)",
    borderWidth: 1,
    borderColor: "rgba(197,160,112,0.18)",
    borderRadius: 20,
    padding: 18,
    marginBottom: 22,
  },
  trialCardActive: {
    borderColor: "rgba(197,160,112,0.45)",
    backgroundColor: "rgba(197,160,112,0.06)",
  },
  trialHeaderRow: { flexDirection: "row", alignItems: "center", marginBottom: 10, gap: 10 },
  trialTitle: { color: colors.accent, fontSize: 17, fontWeight: "800" },
  trialBody: { color: colors.textMuted, fontSize: 14, lineHeight: 21, marginBottom: 14 },
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
  secondaryCtaMuted: { opacity: 0.55 },
  secondaryCtaText: { color: "#F5F5F0", fontSize: 15, fontWeight: "800" },
  primaryCta: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    backgroundColor: colors.accent,
    borderRadius: 16,
    paddingVertical: 17,
    paddingHorizontal: 20,
    marginBottom: 16,
  },
  ctaDisabled: { opacity: 0.55 },
  primaryCtaText: { color: "#0A0A0A", fontSize: 16, fontWeight: "900" },
  textLink: { alignItems: "center", paddingVertical: 8 },
  textLinkLabel: { color: colors.textMuted, fontSize: 15, fontWeight: "800" },
  textLinkHint: {
    color: colors.textMuted,
    fontSize: 12,
    marginTop: 6,
    textAlign: "center",
    lineHeight: 17,
    opacity: 0.85,
  },
  ghostRefresh: {
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "rgba(197,160,112,0.35)",
    paddingVertical: 12,
    alignItems: "center",
    marginBottom: 8,
  },
  ghostRefreshText: { color: colors.accent, fontWeight: "800" },
  subscriptionOnlyCta: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "rgba(197,160,112,0.38)",
    backgroundColor: "rgba(255,255,255,0.03)",
    paddingVertical: 14,
    marginBottom: 10,
  },
  subscriptionOnlyText: { color: "#F5F5F0", fontSize: 15, fontWeight: "800" },
});
