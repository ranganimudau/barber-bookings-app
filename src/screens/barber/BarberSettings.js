import React, { useState } from 'react';
import { ActivityIndicator, Alert, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useLightStatusBar } from '../../hooks/useLightStatusBar';
import { supabase } from "../../supabase/supabaseClient";
import { colors, shadows } from '../../theme/barberTheme';
import { invokeDeleteBarberAccount } from "../../utils/invokeDeleteBarberAccount";

export default function BarberSettings({ navigation }) {
  useLightStatusBar(colors.background);
  const insets = useSafeAreaInsets();

  const [deletingAccount, setDeletingAccount] = useState(false);

  const handleDeleteAccountPermanently = () => {
    Alert.alert(
      "Delete account permanently?",
      "This removes your shop listing, services, availability, bookings, subscription state, and your login. Clients will no longer see your business. This cannot be undone.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete forever",
          style: "destructive",
          onPress: () => {
            Alert.alert(
              "Are you sure?",
              "Your barber account and data will be permanently deleted.",
              [
                { text: "Cancel", style: "cancel" },
                {
                  text: "Yes, delete my account",
                  style: "destructive",
                  onPress: () => {
                    setDeletingAccount(true);
                    // Defer until alerts finish dismissing (Android can stall async inside Alert.onPress).
                    setTimeout(async () => {
                      try {
                        const result = await invokeDeleteBarberAccount();
                        if (!result.ok) {
                          Alert.alert("Delete failed", result.message);
                          return;
                        }
                        const { error: signOutErr } = await supabase.auth.signOut();
                        if (signOutErr) {
                          Alert.alert("Account removed", "You were signed out. " + signOutErr.message);
                        }
                      } catch (e) {
                        Alert.alert(
                          "Delete failed",
                          e?.message ||
                            "Network error. Check your connection and try again."
                        );
                      } finally {
                        setDeletingAccount(false);
                      }
                    }, 320);
                  },
                },
              ]
            );
          },
        },
      ]
    );
  };

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

      <Text style={[styles.sectionTitle, styles.dangerSectionTitle]}>Danger zone</Text>
      <View style={styles.dangerCard}>
        <Text style={styles.dangerTitle}>Delete account</Text>
        <Text style={styles.dangerBody}>
          Permanently removes your shop listing, services, availability, and bookings. This cannot be undone.
        </Text>
        <TouchableOpacity
          style={[styles.deleteAccountBtn, deletingAccount && styles.deleteAccountBtnDisabled]}
          onPress={handleDeleteAccountPermanently}
          disabled={deletingAccount}
          activeOpacity={0.7}
        >
          {deletingAccount ? (
            <ActivityIndicator color={colors.error} size="small" />
          ) : (
            <>
              <Ionicons name="trash-outline" size={15} color={colors.error} />
              <Text style={styles.deleteAccountBtnText}>Delete my account</Text>
            </>
          )}
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
  dangerSectionTitle: { color: colors.error, opacity: 0.85 },
  dangerCard: {
    backgroundColor: colors.surface,
    borderRadius: 18,
    padding: 16,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: 8,
  },
  dangerTitle: { fontSize: 14, fontWeight: '800', color: colors.text, marginBottom: 4 },
  dangerBody: { fontSize: 13, color: colors.textMuted, lineHeight: 18, marginBottom: 14 },
  deleteAccountBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.error,
  },
  deleteAccountBtnDisabled: { opacity: 0.6 },
  deleteAccountBtnText: { color: colors.error, fontWeight: '700', fontSize: 13 },
});
