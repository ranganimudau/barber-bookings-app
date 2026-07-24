import React from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useLightStatusBar } from '../../hooks/useLightStatusBar';
import { supabase } from "../../supabase/supabaseClient";
import { colors, shadows } from '../../theme/barberTheme';

export default function BarberSettings({ navigation }) {
  useLightStatusBar(colors.background);
  const insets = useSafeAreaInsets();

  const menuItems = [
    { title: "Edit Shop Profile", icon: "business-outline", screen: "EditProfile" },
    { title: "Manage Services & Prices", icon: "pricetag-outline", screen: "Services" },
    { title: "Subscription / Plan", icon: "card-outline", screen: "SubscriptionSettings" },
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
      <View style={styles.headerCard}>
        <Text style={styles.headerTitle}>Business Settings</Text>
        <Text style={styles.headerSubtitle}>
          Manage your profile, services, and work hours from one place.
        </Text>
      </View>

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
              <View style={styles.menuIconWrap}>
                <Ionicons name={item.icon} size={20} color={colors.accent} />
              </View>
              <Text style={styles.menuText}>{item.title}</Text>
            </View>
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
  headerCard: {
    backgroundColor: colors.surface,
    borderRadius: 18,
    padding: 16,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: 18,
    ...shadows.card,
  },
  headerTitle: { fontSize: 20, fontWeight: '800', color: colors.text },
  headerSubtitle: { marginTop: 6, fontSize: 13, color: colors.textMuted, lineHeight: 18 },
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
});
