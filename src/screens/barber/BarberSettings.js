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
    <ScrollView
      style={styles.container}
      contentContainerStyle={[styles.content, { paddingTop: Math.max(insets.top, 24) + 44 }]}
      bounces={false}
      overScrollMode="never"
    >
      <Text style={styles.screenTitle}>Settings</Text>

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

      <Text style={styles.sectionTitle}>Danger zone</Text>
      <View style={styles.dangerCard}>
        <Text style={styles.dangerBody}>
          Permanently delete your barber account and all associated data. You will need to sign up again to use the app as a professional.
        </Text>
        <TouchableOpacity
          style={[styles.deleteAccountBtn, deletingAccount && styles.deleteAccountBtnDisabled]}
          onPress={handleDeleteAccountPermanently}
          disabled={deletingAccount}
          activeOpacity={0.85}
        >
          {deletingAccount ? (
            <ActivityIndicator color="#fff" size="small" />
          ) : (
            <>
              <Ionicons name="trash-outline" size={20} color="#fff" />
              <Text style={styles.deleteAccountBtnText}>Delete my account permanently</Text>
            </>
          )}
        </TouchableOpacity>
      </View>

      <TouchableOpacity style={styles.logoutBtn} onPress={() => supabase.auth.signOut()} activeOpacity={0.85}>
        <Ionicons name="log-out-outline" size={22} color={colors.error} />
        <Text style={styles.logoutText}>Logout</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  content: { padding: 16, paddingTop: 20, paddingBottom: 28 },
  screenTitle: { fontSize: 24, fontWeight: '800', color: colors.text, marginBottom: 14 },
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
  dangerCard: {
    backgroundColor: colors.errorBg,
    borderRadius: 18,
    padding: 16,
    borderWidth: 1,
    borderColor: colors.error,
    marginBottom: 8,
  },
  dangerBody: { fontSize: 13, color: colors.textSecondary, lineHeight: 19, marginBottom: 14 },
  deleteAccountBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    backgroundColor: colors.error,
    paddingVertical: 14,
    borderRadius: 14,
  },
  deleteAccountBtnDisabled: { opacity: 0.7 },
  deleteAccountBtnText: { color: '#fff', fontWeight: '800', fontSize: 15 },
  logoutBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 20,
    paddingVertical: 14,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.error,
    borderRadius: 14,
  },
  logoutText: { color: colors.error, fontWeight: '700', marginLeft: 8, fontSize: 16 }
});
