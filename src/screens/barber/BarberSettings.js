import { useFocusEffect } from '@react-navigation/native';
import React, { useCallback, useState } from 'react';
import { Image, Linking, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useLightStatusBar } from '../../hooks/useLightStatusBar';
import { supabase } from "../../supabase/supabaseClient";
import { colors, shadows } from '../../theme/barberTheme';
import { resolveStorageImageUrl } from '../../utils/storageImageUrl';

const SUPPORT_EMAIL = "ranganimudau55@gmail.com";

const menuItems = [
  { title: "Manage Services & Prices", icon: "pricetag-outline", screen: "Services", iconBg: colors.pendingBg, iconFg: colors.pending },
  { title: "Subscription / Plan", icon: "card-outline", screen: "SubscriptionSettings", iconBg: colors.successBg, iconFg: colors.success },
];

export default function BarberSettings({ navigation }) {
  useLightStatusBar(colors.background);
  const insets = useSafeAreaInsets();
  const [shopName, setShopName] = useState("Your Shop");
  const [avatarUrl, setAvatarUrl] = useState(null);

  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      (async () => {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;
        const { data } = await supabase
          .from("barbers")
          .select("shop_name, avatar_url")
          .eq("id", user.id)
          .maybeSingle();
        if (cancelled || !data) return;
        setShopName(data.shop_name || "Your Shop");
        setAvatarUrl(data.avatar_url ? resolveStorageImageUrl(data.avatar_url) : null);
      })();
      return () => { cancelled = true; };
    }, [])
  );

  const supportItems = [
    {
      title: "Terms of Service",
      params: {
        title: "Terms of Service",
        draft: true,
        body: "These Terms of Service are a placeholder and haven't been finalized yet. Official terms will be published here before public launch. By using this app during testing, you agree it's for evaluation purposes only.",
      },
    },
    {
      title: "Data Policy",
      params: {
        title: "Data Policy",
        draft: true,
        body: "This Data Policy is a placeholder. The app collects the information needed to operate bookings, payments, and your shop profile — name, contact details, location, and booking history. A full data/privacy policy will be published here before public launch.",
      },
    },
    {
      title: "About",
      params: {
        title: "About",
        body: "This app connects barbers, salons, and beauty professionals with clients for easy booking and payment. It's currently in testing.",
      },
    },
    {
      title: "Help / FAQ",
      params: {
        title: "Help / FAQ",
        body: "Frequently asked questions are coming soon. In the meantime, reach out via Contact us below and we'll help directly.",
      },
    },
    { title: "Contact us", action: () => Linking.openURL(`mailto:${SUPPORT_EMAIL}`) },
  ];

  return (
    <View style={styles.screen}>
      <View style={[styles.header, { paddingTop: Math.max(insets.top, 24) + 8 }]}>
        <Text style={styles.screenTitle}>Settings</Text>
      </View>
      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.content}
        bounces={false}
        overScrollMode="never"
      >
      <TouchableOpacity
        style={styles.profileCard}
        onPress={() => navigation.navigate("EditProfile")}
        activeOpacity={0.85}
      >
        {avatarUrl ? (
          <Image source={{ uri: avatarUrl }} style={styles.profileAvatar} />
        ) : (
          <View style={styles.profileAvatarFallback}>
            <Ionicons name="storefront-outline" size={22} color={colors.accent} />
          </View>
        )}
        <View style={styles.profileTextWrap}>
          <Text style={styles.profileName} numberOfLines={1}>{shopName}</Text>
          <Text style={styles.profileHint}>Edit your shop profile</Text>
        </View>
        <Ionicons name="chevron-forward" size={20} color={colors.textMuted} />
      </TouchableOpacity>

      <Text style={styles.sectionTitle}>Manage Shop</Text>
      <View style={styles.menuGroup}>
        {menuItems.map((item, index) => (
          <TouchableOpacity
            key={index}
            style={[styles.menuItem, index === menuItems.length - 1 && styles.menuItemLast]}
            onPress={() => navigation.navigate(item.screen)}
            activeOpacity={0.8}
          >
            <View style={styles.menuLabel}>
              <View style={[styles.menuIconWrap, { backgroundColor: item.iconBg }]}>
                <Ionicons name={item.icon} size={20} color={item.iconFg} />
              </View>
              <Text style={styles.menuText}>{item.title}</Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color={colors.textMuted} />
          </TouchableOpacity>
        ))}
      </View>

      <Text style={styles.sectionTitle}>Support</Text>
      <View style={styles.menuGroup}>
        {supportItems.map((item, index) => (
          <TouchableOpacity
            key={index}
            style={[styles.menuItem, index === supportItems.length - 1 && styles.menuItemLast]}
            onPress={() => (item.action ? item.action() : navigation.navigate("SupportInfo", item.params))}
            activeOpacity={0.8}
          >
            <Text style={styles.menuTextPlain}>{item.title}</Text>
            <Ionicons name="chevron-forward" size={20} color={colors.textMuted} />
          </TouchableOpacity>
        ))}
      </View>

      <Text style={styles.sectionTitle}>Account</Text>
      <View style={styles.menuGroup}>
        <TouchableOpacity style={[styles.menuItem, styles.menuItemLast]} onPress={() => supabase.auth.signOut()} activeOpacity={0.8}>
          <View style={styles.menuLabel}>
            <View style={styles.menuIconWrap}>
              <Ionicons name="log-out-outline" size={20} color={colors.accent} />
            </View>
            <Text style={styles.menuText}>Logout</Text>
          </View>
        </TouchableOpacity>
      </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  header: { paddingHorizontal: 16, paddingBottom: 12, backgroundColor: colors.background },
  container: { flex: 1, backgroundColor: colors.background },
  content: { padding: 16, paddingTop: 2, paddingBottom: 28 },
  screenTitle: { fontSize: 24, fontWeight: '800', color: colors.text },
  profileCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: 18,
    padding: 14,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: 18,
    ...shadows.card,
  },
  profileAvatar: { width: 52, height: 52, borderRadius: 26, backgroundColor: colors.surfaceMuted },
  profileAvatarFallback: {
    width: 52, height: 52, borderRadius: 26, backgroundColor: colors.accentSoft,
    alignItems: 'center', justifyContent: 'center',
  },
  profileTextWrap: { flex: 1, marginLeft: 12, marginRight: 8 },
  profileName: { fontSize: 17, fontWeight: '800', color: colors.text },
  profileHint: { marginTop: 2, fontSize: 12, color: colors.textMuted, fontWeight: '600' },
  sectionTitle: { fontSize: 12, fontWeight: '700', color: colors.textMuted, marginBottom: 8, marginLeft: 4, letterSpacing: 0.5, textTransform: 'uppercase' },
  menuGroup: {
    backgroundColor: colors.surface,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: 'hidden',
    marginBottom: 18,
    ...shadows.card,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 14,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  menuItemLast: { borderBottomWidth: 0 },
  menuLabel: { flexDirection: 'row', alignItems: 'center' },
  menuIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: colors.accentSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  menuText: { fontSize: 16, marginLeft: 12, color: colors.text, fontWeight: '700' },
  menuTextPlain: { fontSize: 16, color: colors.text, fontWeight: '700' },
});
