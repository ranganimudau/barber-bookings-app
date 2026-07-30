import React, { useCallback, useEffect, useRef, useState } from "react";
import { Image, ScrollView, StyleSheet, Text, TouchableOpacity, useWindowDimensions, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useLightStatusBar } from "../../hooks/useLightStatusBar";
import { colors, shadows } from "../../theme/barberTheme";

const HERO_IMAGES = [
  require("../../../assets/images/welcome/barber.jpg"),
  require("../../../assets/images/welcome/Salon-Fresh.jpg"),
  require("../../../assets/images/welcome/nails.jpg"),
  require("../../../assets/images/welcome/hero-nails.webp"),
];
const HERO_HEIGHT = 300;
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
        {/* Brand lockup stays small — the headline below carries the weight.
            Matches the badge + wordmark row on Signup/Login. */}
        <View style={styles.brandRow}>
          <View style={styles.logoBadge}>
            <Text style={styles.logoBadgeText}>SB</Text>
          </View>
          <Text style={styles.wordmark}>SkoonBook</Text>
        </View>

        <Text style={styles.headline}>Book any chair,{"\n"}any style</Text>
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
  content: { alignItems: "flex-start" },
  brandRow: { flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 24 },
  logoBadge: {
    width: 36,
    height: 36,
    borderRadius: 11,
    backgroundColor: colors.accent,
    alignItems: "center",
    justifyContent: "center",
  },
  logoBadgeText: { fontSize: 14, fontWeight: "900", color: colors.accentText, letterSpacing: 0.3 },
  wordmark: { fontSize: 16, fontWeight: "800", color: colors.text },
  headline: { fontSize: 32, fontWeight: "800", color: colors.text, lineHeight: 39, marginBottom: 10 },
  subtitle: { fontSize: 15, color: colors.textMuted, lineHeight: 21 },
  heroWrap: { width: "100%", marginTop: 26 },
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
});
