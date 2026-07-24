import React, { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  AppState,
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
import { useLightStatusBar } from "../../hooks/useLightStatusBar";
import { supabase } from "../../supabase/supabaseClient";
import { createPayfastCheckout } from "../../utils/createPayfastCheckout";
import { openPaymentCheckoutUrl } from "../../utils/openPaymentCheckoutUrl";
import { colors, shadows } from "../../theme/barberTheme";
import {
  ensureBarberSubscriptionState,
  getSubscriptionLabel,
  getTrialDaysRemaining,
  isSubscriptionEligible,
} from "../../utils/subscriptionState";

const TRIAL_BENEFITS = ["Unlimited accepted bookings for 20 days", "Then R70/month, billed automatically", "Unlock all barber features"];

const LOAD_TIMEOUT_MS = 10000;

/** Mobile Supabase clients can hang refreshing the auth token right after
 * the app resumes from background (exactly what happens returning from a
 * payment browser) — never let that leave the screen stuck loading. */
const withTimeout = (promise, ms) =>
  Promise.race([promise, new Promise((resolve) => setTimeout(() => resolve(null), ms))]);

export default function SubscriptionPaywall({ navigation, route }) {
  useLightStatusBar(colors.background);
  const insets = useSafeAreaInsets();
  const [subState, setSubState] = useState(null);
  const [loading, setLoading] = useState(true);
  const [checkoutLoading, setCheckoutLoading] = useState(false);
  const [verifyingPayment, setVerifyingPayment] = useState(false);
  const [checkoutUrl, setCheckoutUrl] = useState(null);
  const [checkoutReference, setCheckoutReference] = useState(null);

  const eligible = useMemo(() => isSubscriptionEligible(subState), [subState]);
  const trialDaysRemaining = useMemo(() => getTrialDaysRemaining(subState), [subState]);
  const statusLabel = subState ? getSubscriptionLabel(subState) : "Checking…";
  const hasUsedTrial = !!subState?.trial_start;
  const trialActive = subState?.shop_status === "active" && subState?.subscription_status === "none";
  // R70/month is always a valid direct path — to skip the trial entirely, to
  // replace it once it's over, or to recover from a lapsed/grace subscription.
  const canPaySubscriptionOnly = useMemo(() => subState?.subscription_status !== "active", [subState]);

  const load = async () => {
    setLoading(true);
    try {
      const result = await withTimeout(supabase.auth.getUser(), LOAD_TIMEOUT_MS);
      const user = result?.data?.user;
      if (!user) return;

      const state = await withTimeout(ensureBarberSubscriptionState(user.id), LOAD_TIMEOUT_MS);
      if (state) setSubState(state);
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

  // PayFast's ITN webhook updates the DB server-to-server, so there's no
  // client-callable "verify payment" step — just re-fetch state when the
  // app comes back to the foreground after checkout.
  const verifyAndRefreshState = async ({ silent = true } = {}) => {
    if (verifyingPayment) return;
    setVerifyingPayment(true);
    try {
      await load();
    } catch (e) {
      if (!silent) {
        Alert.alert("Could not refresh", e?.message || "Could not refresh your subscription status. Try again.");
      }
    } finally {
      setVerifyingPayment(false);
    }
  };

  useEffect(() => {
    const sub = AppState.addEventListener("change", (state) => {
      if (state === "active") {
        verifyAndRefreshState({ silent: true });
      }
    });
    return () => sub.remove();
  }, [checkoutReference, verifyingPayment]);

  const beginCheckout = async (plan) => {
    let payUrl = null;
    try {
      setCheckoutLoading(true);
      setCheckoutUrl(null);
      setCheckoutReference(null);
      const data = await createPayfastCheckout({ plan });
      payUrl = data.payment_url || null;
      setCheckoutUrl(payUrl);
      setCheckoutReference(data.reference || data.payment_ref || null);
      if (!payUrl) {
        throw new Error("Payment link not available");
      }
    } catch (e) {
      Alert.alert("Payment error", e?.message || "Could not start checkout.");
    } finally {
      setCheckoutLoading(false);
    }
    if (payUrl) {
      openPaymentCheckoutUrl(payUrl);
    }
  };

  const handleChooseTrialPath = () => beginCheckout("trial");
  const handlePaySubscriptionOnly = () => beginCheckout("subscription");

  const handleSkip = () => {
    if (eligible) {
      navigation.reset({ index: 0, routes: [{ name: "BarberDashboard" }] });
      return;
    }
    Alert.alert(
      "Payment required",
      "Pay the one-time R50 trial fee, or subscribe for R70/month, to unlock bookings.",
      [
        { text: "Cancel", style: "cancel" },
        { text: "Pay R50 now", onPress: () => beginCheckout("trial") },
      ]
    );
  };

  const trialSummaryText = trialActive
    ? `${trialDaysRemaining} day${trialDaysRemaining === 1 ? "" : "s"} left`
    : "Pay R50 for a 20-day unlimited-booking trial";

  const contentPad = {
    paddingTop: Math.max(insets.top, 24) + 44,
    paddingBottom: Math.max(insets.bottom, 20) + 32,
  };

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={[styles.content, contentPad]}
      keyboardShouldPersistTaps="handled"
      showsVerticalScrollIndicator={false}
      bounces={false}
      overScrollMode="never"
    >
      <View style={styles.headerBlock}>
        <View style={styles.titleRow}>
          <Ionicons name="card-outline" size={18} color={colors.accent} />
          <Text style={styles.kicker}>Payment setup</Text>
        </View>
        <Text style={styles.heroTitle}>Choose 1 option to continue</Text>
        <Text style={styles.heroSub}>Both options unlock barber bookings. Pick what fits you now.</Text>
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

      <View style={styles.quickGuide}>
        <Text style={styles.quickGuideTitle}>Quick guide</Text>
        <Text style={styles.quickGuideText}>1) Choose a payment option below.</Text>
        <Text style={styles.quickGuideText}>2) Complete payment in browser.</Text>
        <Text style={styles.quickGuideText}>3) Return to app. We unlock automatically.</Text>
      </View>

      {!hasUsedTrial ? (
        <View style={styles.optionCard}>
          <View style={styles.optionHeader}>
            <View style={styles.optionTitleWrap}>
              <Text style={styles.optionLabel}>Step 1</Text>
              <Text style={styles.optionTitle}>Pay R50 once-off</Text>
              <Text style={styles.optionSubtitle}>Unlock unlimited bookings for 20 days</Text>
            </View>
            <Text style={styles.optionAmount}>R50</Text>
          </View>
          {TRIAL_BENEFITS.map((line) => (
            <View key={line} style={styles.benefitRow}>
              <Ionicons name="checkmark-circle" size={16} color={colors.success} />
              <Text style={styles.benefitText}>{line}</Text>
            </View>
          ))}
          <TouchableOpacity
            style={[styles.primaryCta, (loading || checkoutLoading) && styles.ctaDisabled]}
            onPress={handleChooseTrialPath}
            disabled={loading || checkoutLoading}
            activeOpacity={0.9}
          >
            {checkoutLoading ? (
              <>
                <ActivityIndicator size="small" color={colors.accentText} />
                <Text style={styles.primaryCtaText}>Opening checkout...</Text>
              </>
            ) : (
              <>
                <Text style={styles.primaryCtaText}>Pay R50 now</Text>
                <Ionicons name="arrow-forward" size={18} color={colors.accentText} />
              </>
            )}
          </TouchableOpacity>
        </View>
      ) : null}

      {hasUsedTrial ? (
        <View style={[styles.optionCard, trialActive && styles.optionCardActive]}>
          <View style={styles.optionHeader}>
            <View style={styles.optionTitleWrap}>
              <Text style={styles.optionLabel}>Trial status</Text>
              <Text style={styles.optionTitle}>20-day trial</Text>
              <Text style={styles.optionSubtitle}>{trialSummaryText}</Text>
            </View>
            <Text style={styles.optionAmount}>{trialActive ? trialDaysRemaining : 0}</Text>
          </View>
        </View>
      ) : null}

      {checkoutUrl ? (
        <TouchableOpacity
          style={styles.manualOpenCta}
          onPress={() => Linking.openURL(checkoutUrl)}
          activeOpacity={0.9}
        >
          <Ionicons name="open-outline" size={18} color={colors.accent} />
          <Text style={styles.manualOpenText}>Open checkout page</Text>
        </TouchableOpacity>
      ) : null}

      {canPaySubscriptionOnly ? (
        <TouchableOpacity
          style={[styles.subscriptionOnlyCta, (loading || checkoutLoading) && styles.ctaDisabled]}
          onPress={handlePaySubscriptionOnly}
          disabled={loading || checkoutLoading}
          activeOpacity={0.9}
        >
          <Text style={styles.subscriptionOnlyText}>Pay R70/month subscription</Text>
          <Ionicons name="card-outline" size={18} color={colors.accent} />
        </TouchableOpacity>
      ) : null}

      {verifyingPayment ? (
        <View style={styles.verifyingWrap}>
          <ActivityIndicator size="small" color={colors.accent} />
          <Text style={styles.verifyingText}>Checking payment...</Text>
        </View>
      ) : null}

      {eligible ? (
        <TouchableOpacity style={styles.textLink} onPress={handleSkip} disabled={loading} activeOpacity={0.85}>
          <Text style={styles.textLinkLabel}>Continue to dashboard</Text>
          <Text style={styles.textLinkHint}>Your subscription or trial is active.</Text>
        </TouchableOpacity>
      ) : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  content: { paddingHorizontal: 20 },
  headerBlock: { marginBottom: 16 },
  titleRow: { flexDirection: "row", alignItems: "center", marginBottom: 8, gap: 8 },
  kicker: {
    color: colors.accent,
    fontSize: 12,
    fontWeight: "800",
    letterSpacing: 1,
    textTransform: "uppercase",
  },
  heroTitle: {
    color: colors.text,
    fontSize: 24,
    fontWeight: "800",
    lineHeight: 30,
    marginBottom: 8,
  },
  heroSub: {
    color: colors.textMuted,
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 12,
  },
  statusPill: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "flex-start",
    backgroundColor: colors.surfaceMuted,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.border,
    maxWidth: "100%",
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.textMuted,
    marginRight: 8,
  },
  statusDotOk: { backgroundColor: colors.success },
  statusPillText: {
    color: colors.text,
    fontSize: 12,
    fontWeight: "700",
    flexShrink: 1,
  },
  loadingBox: { paddingVertical: 12, marginBottom: 8, alignItems: "center" },
  quickGuide: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 14,
    backgroundColor: colors.surfaceMuted,
    padding: 14,
    marginBottom: 14,
  },
  quickGuideTitle: { color: colors.text, fontSize: 14, fontWeight: "800", marginBottom: 8 },
  quickGuideText: { color: colors.textMuted, fontSize: 13, lineHeight: 18 },
  optionCard: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    ...shadows.card,
  },
  optionCardActive: {
    borderColor: colors.accent,
    backgroundColor: colors.accentSoft,
  },
  optionHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 12 },
  optionTitleWrap: { flexShrink: 1, paddingRight: 12 },
  optionLabel: { color: colors.accent, fontSize: 11, fontWeight: "800", textTransform: "uppercase", marginBottom: 2 },
  optionTitle: { color: colors.text, fontSize: 20, fontWeight: "900", marginBottom: 2 },
  optionSubtitle: { color: colors.textMuted, fontSize: 13, lineHeight: 18 },
  optionAmount: { color: colors.text, fontSize: 24, fontWeight: "900" },
  benefitRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 5,
  },
  benefitText: { color: colors.textSecondary, fontSize: 14, fontWeight: "600", marginLeft: 10, flex: 1 },
  secondaryCta: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 14,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.accent,
    backgroundColor: colors.surface,
    marginTop: 10,
  },
  secondaryCtaText: { color: colors.text, fontSize: 15, fontWeight: "800" },
  primaryCta: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    backgroundColor: colors.accent,
    borderRadius: 16,
    paddingVertical: 17,
    paddingHorizontal: 20,
    marginTop: 12,
    ...shadows.button,
  },
  ctaDisabled: { opacity: 0.55 },
  primaryCtaText: { color: colors.accentText, fontSize: 16, fontWeight: "900" },
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
  verifyingWrap: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    gap: 8,
    marginBottom: 8,
  },
  verifyingText: { color: colors.textMuted, fontSize: 13, fontWeight: "700" },
  subscriptionOnlyCta: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    paddingVertical: 14,
    marginBottom: 10,
  },
  subscriptionOnlyText: { color: colors.text, fontSize: 15, fontWeight: "800" },
  manualOpenCta: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    paddingVertical: 12,
    marginBottom: 10,
  },
  manualOpenText: { color: colors.accent, fontSize: 14, fontWeight: "800" },
});
