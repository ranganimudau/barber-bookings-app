import React, { useCallback, useEffect, useRef, useState } from "react";
import { Alert, Image, ScrollView, StyleSheet, Text, TouchableOpacity, useWindowDimensions, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useLightStatusBar } from "../../hooks/useLightStatusBar";
import { colors, shadows } from "../../theme/barberTheme";

const HERO_IMAGES = [
  require("../../../assets/images/welcome/Salon-Fresh.jpg"),
  require("../../../assets/images/welcome/nails.jpg"),
  require("../../../assets/images/welcome/hero-nails.webp"),
  require("../../../assets/images/welcome/barber.jpg"),
];
const HERO_HEIGHT = 200;
const AUTO_ADVANCE_MS = 3500;

function HeroCarousel() {
  const { width: windowWidth } = useWindowDimensions();
  const imageWidth = windowWidth - 24 * 2; // matches screen's paddingHorizontal
  const scrollRef = useRef(null);
  const [activeIndex, setActiveIndex] = useState(0);

  useEffect(() => {
    const timer = setInterval(() => {
      setActiveIndex((prev) => {
        const next = (prev + 1) % HERO_IMAGES.length;
        scrollRef.current?.scrollTo({ x: next * imageWidth, animated: true });
        return next;
      });
    }, AUTO_ADVANCE_MS);
    return () => clearInterval(timer);
  }, [imageWidth]);

  const handleMomentumScrollEnd = useCallback(
    (e) => {
      const idx = Math.round(e.nativeEvent.contentOffset.x / imageWidth);
      setActiveIndex(Math.min(Math.max(idx, 0), HERO_IMAGES.length - 1));
    },
    [imageWidth]
  );

  return (
    <View style={styles.heroWrap}>
      <ScrollView
        ref={scrollRef}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onMomentumScrollEnd={handleMomentumScrollEnd}
        style={{ borderRadius: 18 }}
      >
        {HERO_IMAGES.map((src, idx) => (
          <Image key={idx} source={src} style={{ width: imageWidth, height: HERO_HEIGHT }} resizeMode="cover" />
        ))}
      </ScrollView>
      <View style={styles.dotsRow}>
        {HERO_IMAGES.map((_, idx) => (
          <View key={idx} style={[styles.dot, idx === activeIndex && styles.dotActive]} />
        ))}
      </View>
    </View>
  );
}

export default function Welcome({ navigation }) {
  useLightStatusBar(colors.background);
  const insets = useSafeAreaInsets();

  return (
    <View
      style={[
        styles.screen,
        { paddingTop: Math.max(insets.top, 24) + 24, paddingBottom: Math.max(insets.bottom, 20) + 14 },
      ]}
    >
      <View style={styles.content}>
        <View style={styles.logoBadge}>
          <Text style={styles.logoBadgeText}>SB</Text>
        </View>

        <Text style={styles.title}>SkoonBook</Text>
        <Text style={styles.subtitle}>Hair, nails and beauty, near you.</Text>

        <HeroCarousel />
      </View>

      <View style={styles.actions}>
        <TouchableOpacity style={styles.primaryBtn} onPress={() => navigation.navigate("Signup")} activeOpacity={0.9}>
          <Text style={styles.primaryBtnText}>Create account</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.secondaryBtn} onPress={() => navigation.navigate("Login")} activeOpacity={0.9}>
          <Text style={styles.secondaryBtnText}>Log in</Text>
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
    paddingHorizontal: 24,
  },
  content: { alignItems: "center" },
  logoBadge: {
    width: 56,
    height: 56,
    borderRadius: 16,
    backgroundColor: colors.accent,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 20,
    ...shadows.button,
  },
  logoBadgeText: { fontSize: 20, fontWeight: "900", color: colors.accentText, letterSpacing: 0.5 },
  title: { fontSize: 28, fontWeight: "800", color: colors.text, marginBottom: 8 },
  subtitle: { fontSize: 15, color: colors.textMuted, textAlign: "center" },
  heroWrap: { width: "100%", marginTop: 32 },
  dotsRow: { flexDirection: "row", justifyContent: "center", gap: 6, marginTop: 10 },
  dot: { width: 6, height: 6, borderRadius: 3, backgroundColor: colors.border },
  dotActive: { backgroundColor: colors.accent, width: 16 },

  actions: { width: "100%", marginTop: 32 },
  primaryBtn: {
    backgroundColor: colors.accent,
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 12,
    ...shadows.button,
  },
  primaryBtnText: { color: colors.accentText, fontWeight: "800", fontSize: 16 },
  secondaryBtn: {
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.border,
    paddingVertical: 15,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.surface,
    marginBottom: 12,
  },
  secondaryBtnText: { color: colors.accent, fontWeight: "800", fontSize: 15 },
  ghostBtn: { alignItems: "center", paddingVertical: 10 },
  ghostBtnText: { color: colors.textMuted, fontSize: 13, fontWeight: "700", textDecorationLine: "underline" },
});
