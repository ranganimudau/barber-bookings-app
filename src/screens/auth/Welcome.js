import React, { useEffect, useState } from "react";
import { Alert, ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import Icon from "react-native-vector-icons/Ionicons";
import { colors } from "../../theme/clientTheme";

const FEATURES = [
  {
    icon: "calendar-outline",
    title: "Smart Bookings",
    text: "Let clients discover your profile, pick services, and book available slots instantly.",
  },
  {
    icon: "notifications-outline",
    title: "Live Alerts",
    text: "Get instant booking updates, reminders, and status changes with push notifications.",
  },
  {
    icon: "cash-outline",
    title: "Grow Earnings",
    text: "Track bookings and performance with premium dashboards built for busy professionals.",
  },
];

const TESTIMONIALS = [
  { quote: "I fill more slots every week now.", by: "Lindiwe · Barber" },
  { quote: "My nail bookings became consistent.", by: "Zama · Nail Artist" },
  { quote: "Clients love fast booking and reminders.", by: "Neo · Stylist" },
];

export default function Welcome({ navigation }) {
  const [activeTestimonial, setActiveTestimonial] = useState(0);

  useEffect(() => {
    const id = setInterval(() => {
      setActiveTestimonial((prev) => (prev + 1) % TESTIMONIALS.length);
    }, 2800);
    return () => clearInterval(id);
  }, []);

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
      <View style={styles.heroBadge}>
        <Icon name="sparkles-outline" size={15} color={colors.accent} />
        <Text style={styles.heroBadgeText}>Welcome to BarberApp Pro</Text>
      </View>

      <Text style={styles.title}>Run your beauty business from one powerful app</Text>
      <Text style={styles.subtitle}>
        From barbers to braiders, nail artists, and stylists - manage services, bookings, availability, and growth in one place.
      </Text>

      <View style={styles.previewCard}>
        <Text style={styles.previewTitle}>Built for professionals who want to scale</Text>
        <Text style={styles.previewSub}>
          Beautiful profiles, smooth booking flow, smart reminders, and subscription-ready business tools.
        </Text>
      </View>

      <View style={styles.previewGrid}>
        <View style={[styles.miniCard, styles.miniCardLarge]}>
          <Text style={styles.miniLabel}>Today</Text>
          <Text style={styles.miniValue}>8 bookings</Text>
          <Text style={styles.miniHint}>3 pending · 5 confirmed</Text>
        </View>
        <View style={styles.miniCol}>
          <View style={styles.miniCard}>
            <Text style={styles.miniLabel}>Revenue</Text>
            <Text style={styles.miniValueSmall}>R1 420</Text>
          </View>
          <View style={styles.miniCard}>
            <Text style={styles.miniLabel}>Trial</Text>
            <Text style={styles.miniValueSmall}>5 free jobs</Text>
          </View>
        </View>
      </View>

      <View style={styles.featuresWrap}>
        {FEATURES.map((item) => (
          <View key={item.title} style={styles.featureItem}>
            <View style={styles.featureIcon}>
              <Icon name={item.icon} size={18} color={colors.accent} />
            </View>
            <View style={styles.featureTextWrap}>
              <Text style={styles.featureTitle}>{item.title}</Text>
              <Text style={styles.featureText}>{item.text}</Text>
            </View>
          </View>
        ))}
      </View>

      <View style={styles.testimonialCard}>
        <View style={styles.testimonialHead}>
          <Icon name="chatbubble-ellipses-outline" size={14} color={colors.accent} />
          <Text style={styles.testimonialTitle}>Loved by local pros</Text>
        </View>
        <Text style={styles.testimonialQuote}>\"{TESTIMONIALS[activeTestimonial].quote}\"</Text>
        <Text style={styles.testimonialBy}>{TESTIMONIALS[activeTestimonial].by}</Text>
        <View style={styles.dots}>
          {TESTIMONIALS.map((_, i) => (
            <View key={i} style={[styles.dot, i === activeTestimonial && styles.dotActive]} />
          ))}
        </View>
      </View>

      <TouchableOpacity style={styles.primaryBtn} onPress={() => navigation.navigate("Signup")} activeOpacity={0.9}>
        <Text style={styles.primaryBtnText}>Create Account</Text>
        <Icon name="arrow-forward" size={18} color="#0A0A0A" />
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
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  content: { paddingHorizontal: 20, paddingTop: 74, paddingBottom: 34 },
  heroBadge: {
    alignSelf: "flex-start",
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "rgba(197,160,112,0.12)",
    borderColor: "rgba(197,160,112,0.32)",
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    marginBottom: 18,
  },
  heroBadgeText: { color: colors.accent, fontWeight: "800", fontSize: 12, letterSpacing: 0.5 },
  title: { fontSize: 30, lineHeight: 38, color: "#F5F5F0", fontWeight: "900", marginBottom: 12 },
  subtitle: { color: colors.textMuted, fontSize: 15, lineHeight: 22, marginBottom: 20 },
  previewCard: {
    backgroundColor: "rgba(255,255,255,0.03)",
    borderWidth: 1,
    borderColor: "rgba(197,160,112,0.24)",
    borderRadius: 18,
    padding: 16,
    marginBottom: 20,
  },
  previewTitle: { color: "#F5F5F0", fontWeight: "800", fontSize: 16, marginBottom: 6 },
  previewSub: { color: colors.textMuted, lineHeight: 20, fontSize: 13 },
  previewGrid: { flexDirection: "row", gap: 10, marginBottom: 18 },
  miniCol: { flex: 1, gap: 10 },
  miniCard: {
    backgroundColor: "rgba(255,255,255,0.03)",
    borderWidth: 1,
    borderColor: "rgba(197,160,112,0.18)",
    borderRadius: 14,
    padding: 12,
  },
  miniCardLarge: { flex: 1, minHeight: 126, justifyContent: "center" },
  miniLabel: { color: colors.textMuted, fontSize: 11, fontWeight: "700", marginBottom: 4, letterSpacing: 0.4 },
  miniValue: { color: "#F5F5F0", fontSize: 24, fontWeight: "900", marginBottom: 4 },
  miniValueSmall: { color: "#F5F5F0", fontSize: 16, fontWeight: "800" },
  miniHint: { color: colors.textMuted, fontSize: 12, lineHeight: 18 },
  featuresWrap: {
    backgroundColor: "rgba(255,255,255,0.03)",
    borderWidth: 1,
    borderColor: "rgba(197,160,112,0.2)",
    borderRadius: 18,
    padding: 12,
    marginBottom: 24,
  },
  featureItem: {
    flexDirection: "row",
    alignItems: "flex-start",
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "rgba(255,255,255,0.08)",
  },
  featureIcon: {
    width: 34,
    height: 34,
    borderRadius: 10,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "rgba(197,160,112,0.12)",
    borderWidth: 1,
    borderColor: "rgba(197,160,112,0.3)",
    marginRight: 10,
  },
  featureTextWrap: { flex: 1 },
  featureTitle: { color: "#F5F5F0", fontWeight: "800", marginBottom: 2, fontSize: 14 },
  featureText: { color: colors.textMuted, fontSize: 12, lineHeight: 18 },
  testimonialCard: {
    marginTop: -6,
    marginBottom: 16,
    backgroundColor: "rgba(255,255,255,0.02)",
    borderWidth: 1,
    borderColor: "rgba(197,160,112,0.2)",
    borderRadius: 16,
    padding: 14,
  },
  testimonialHead: { flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 8 },
  testimonialTitle: { color: colors.accent, fontSize: 12, fontWeight: "800", letterSpacing: 0.4 },
  testimonialQuote: { color: "#F5F5F0", fontSize: 14, lineHeight: 20, fontWeight: "700", marginBottom: 6 },
  testimonialBy: { color: colors.textMuted, fontSize: 12, fontWeight: "600" },
  dots: { flexDirection: "row", alignItems: "center", marginTop: 10, gap: 6 },
  dot: { width: 6, height: 6, borderRadius: 3, backgroundColor: "rgba(255,255,255,0.22)" },
  dotActive: { width: 18, backgroundColor: colors.accent },
  primaryBtn: {
    backgroundColor: colors.accent,
    borderRadius: 14,
    paddingVertical: 16,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
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
  },
  secondaryBtnText: { color: "#F5F5F0", fontWeight: "700", fontSize: 15 },
  ghostBtn: { alignItems: "center", paddingVertical: 14 },
  ghostBtnText: { color: colors.textMuted, fontSize: 13, fontWeight: "700", textDecorationLine: "underline" },
});
