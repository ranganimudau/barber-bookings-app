import { useFocusEffect } from '@react-navigation/native';
import { LinearGradient } from 'expo-linear-gradient';
import React, { useCallback, useMemo, useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    Image,
    RefreshControl,
    ScrollView,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';
import { supabase } from '../../supabase/supabaseClient';
import { colors, shadows } from '../../theme/barberTheme';

const greetingForNow = () => {
  const hour = new Date().getHours();
  if (hour < 12) return 'Good morning';
  if (hour < 18) return 'Good afternoon';
  return 'Good evening';
};
import {
    ensureBarberSubscriptionState,
    getSubscriptionLabel,
    isSubscriptionEligible,
} from '../../utils/subscriptionState';

const ACTIVE_STATUSES = ['confirmed', 'accepted', 'approved', 'completed', 'done'];
const PENDING_STATUSES = ['pending', 'requested'];

const todayKey = () => new Date().toISOString().slice(0, 10);
const formatRand = (amount) => `R${Number(amount || 0).toFixed(2)}`;
const formatTime = (time) => (time || '').toString().substring(0, 5);

export default function BarberDashboard({ navigation }) {
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [barberName, setBarberName] = useState('');
  const [barberAvatar, setBarberAvatar] = useState(null);
  const [subscriptionState, setSubscriptionState] = useState(null);
  const [appointments, setAppointments] = useState([]);

  const load = useCallback(async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('No user logged in');

      try {
        const state = await ensureBarberSubscriptionState(user.id);
        setSubscriptionState(state);
      } catch (e) {
        console.warn('Subscription state load failed:', e?.message);
      }

      const { data: barberProfile } = await supabase
        .from('barbers')
        .select('shop_name, avatar_url')
        .eq('id', user.id)
        .maybeSingle();

      if (barberProfile) {
        setBarberName(barberProfile.shop_name || '');
        const avatar = barberProfile.avatar_url;
        setBarberAvatar(
          avatar
            ? avatar.startsWith('data:image/')
              ? avatar
              : `${avatar}${avatar.includes('?') ? '&' : '?'}t=${Date.now()}`
            : null
        );
      }

      const { data, error } = await supabase
        .from('appointments')
        .select(`
          id,
          appointment_date,
          appointment_time,
          status,
          service_name,
          price,
          profiles!appointments_client_id_fkey (full_name, avatar_url)
        `)
        .eq('barber_id', user.id)
        .order('appointment_time', { ascending: true });

      if (error) throw error;
      setAppointments(data || []);
    } catch (error) {
      Alert.alert('Error fetching dashboard', error.message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  const onRefresh = () => {
    setRefreshing(true);
    load();
  };

  const stats = useMemo(() => {
    const key = todayKey();
    const todays = appointments.filter((a) => a.appointment_date === key);
    const todaysConfirmed = todays.filter((a) => ACTIVE_STATUSES.includes((a.status || '').toLowerCase()));
    const todaysPending = todays.filter((a) => PENDING_STATUSES.includes((a.status || '').toLowerCase()));
    const allPending = appointments.filter((a) => PENDING_STATUSES.includes((a.status || '').toLowerCase()));
    const todaysRevenue = todaysConfirmed.reduce((sum, a) => sum + Number(a.price || 0), 0);

    return {
      todayCount: todays.length,
      todayConfirmedCount: todaysConfirmed.length,
      todayPendingCount: todaysPending.length,
      todayRevenue: todaysRevenue,
      pendingCount: allPending.length,
      todaysSchedule: todays,
    };
  }, [appointments]);

  const subscriptionEligible = isSubscriptionEligible(subscriptionState);
  const showSubscriptionBanner = !!subscriptionState && !subscriptionEligible;
  const statusLabel = subscriptionState ? getSubscriptionLabel(subscriptionState) : null;

  const statusBadgeStyle = (status) => {
    const s = (status || '').toLowerCase();
    if (ACTIVE_STATUSES.includes(s)) return [styles.badge, styles.badgeSuccess];
    if (PENDING_STATUSES.includes(s)) return [styles.badge, styles.badgePending];
    return [styles.badge, styles.badgeMuted];
  };

  if (loading) {
    return (
      <View style={[styles.centered, { backgroundColor: colors.background }]}>
        <ActivityIndicator size="large" color={colors.accent} />
      </View>
    );
  }

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.accent} colors={[colors.accent]} />}
    >
      <LinearGradient
        colors={[colors.accent, colors.accentDark]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.hero}
      >
        <Icon name="sparkles" size={130} color="rgba(255,255,255,0.14)" style={styles.heroWatermark} />
        <View style={styles.heroRow}>
          {barberAvatar ? (
            <Image source={{ uri: barberAvatar }} style={styles.heroAvatar} />
          ) : (
            <View style={styles.heroAvatarFallback}>
              <Icon name="storefront-outline" size={24} color={colors.accentText} />
            </View>
          )}
          <View style={styles.heroTextWrap}>
            <Text style={styles.heroGreeting}>{greetingForNow()}</Text>
            <Text style={styles.heroShopName} numberOfLines={1}>{barberName || 'Your Shop'}</Text>
          </View>
        </View>
      </LinearGradient>

      {showSubscriptionBanner ? (
        <View style={styles.subBanner}>
          <View style={styles.subBannerLeft}>
            <Icon name="lock-closed-outline" size={16} color={colors.accent} />
            <Text style={styles.subBannerText}>{statusLabel || 'Locked. Pay R70/month to continue receiving bookings.'}</Text>
          </View>
          <TouchableOpacity
            style={styles.subBannerBtn}
            onPress={() => navigation.navigate('SubscriptionPaywall')}
            activeOpacity={0.88}
          >
            <Text style={styles.subBannerBtnText}>Pay now</Text>
          </TouchableOpacity>
        </View>
      ) : null}

      <View style={styles.statsRow}>
        <View style={styles.statCard}>
          <View style={styles.statIconBadge}>
            <Icon name="calendar-outline" size={16} color={colors.accent} />
          </View>
          <Text style={styles.statValue}>{stats.todayCount}</Text>
          <Text style={styles.statLabel}>Today</Text>
          <Text style={styles.statHint}>{stats.todayPendingCount} pending · {stats.todayConfirmedCount} confirmed</Text>
        </View>
        <View style={styles.statCard}>
          <View style={styles.statIconBadge}>
            <Icon name="cash-outline" size={16} color={colors.accent} />
          </View>
          <Text style={styles.statValue}>{formatRand(stats.todayRevenue)}</Text>
          <Text style={styles.statLabel}>Revenue</Text>
          <Text style={styles.statHint}>from today's confirmed jobs</Text>
        </View>
        <View style={styles.statCard}>
          <View style={styles.statIconBadge}>
            <Icon name="notifications-outline" size={16} color={colors.accent} />
          </View>
          <Text style={styles.statValue}>{stats.pendingCount}</Text>
          <Text style={styles.statLabel}>Requests</Text>
          <Text style={styles.statHint}>awaiting your response</Text>
        </View>
      </View>

      <View style={styles.quickActionsRow}>
        <TouchableOpacity style={styles.quickAction} onPress={() => navigation.navigate('Bookings')} activeOpacity={0.85}>
          <View style={styles.quickActionIconBadge}>
            <Icon name="list-outline" size={18} color={colors.accent} />
          </View>
          <Text style={styles.quickActionText}>Bookings</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.quickAction} onPress={() => navigation.navigate('Availability')} activeOpacity={0.85}>
          <View style={styles.quickActionIconBadge}>
            <Icon name="time-outline" size={18} color={colors.accent} />
          </View>
          <Text style={styles.quickActionText}>Availability</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.quickAction} onPress={() => navigation.navigate('Earnings')} activeOpacity={0.85}>
          <View style={styles.quickActionIconBadge}>
            <Icon name="stats-chart-outline" size={18} color={colors.accent} />
          </View>
          <Text style={styles.quickActionText}>Earnings</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.quickAction} onPress={() => navigation.navigate('SettingsGroup')} activeOpacity={0.85}>
          <View style={styles.quickActionIconBadge}>
            <Icon name="settings-outline" size={18} color={colors.accent} />
          </View>
          <Text style={styles.quickActionText}>Settings</Text>
        </TouchableOpacity>
      </View>

      <Text style={styles.sectionTitle}>Today's Schedule</Text>
      {stats.todaysSchedule.length === 0 ? (
        <View style={styles.emptyCard}>
          <Icon name="cafe-outline" size={22} color={colors.textMuted} />
          <Text style={styles.emptyText}>No bookings today. Enjoy the downtime.</Text>
        </View>
      ) : (
        stats.todaysSchedule.map((item) => (
          <View key={item.id} style={styles.scheduleCard}>
            {item.profiles?.avatar_url ? (
              <Image source={{ uri: item.profiles.avatar_url }} style={styles.scheduleAvatar} />
            ) : (
              <View style={styles.scheduleAvatarFallback}>
                <Icon name="person" size={16} color={colors.textMuted} />
              </View>
            )}
            <View style={styles.scheduleInfo}>
              <Text style={styles.scheduleName} numberOfLines={1}>{item.profiles?.full_name || 'Client'}</Text>
              <Text style={styles.scheduleService} numberOfLines={1}>
                {item.service_name || 'Service'} · {formatTime(item.appointment_time)}
              </Text>
            </View>
            <View style={styles.scheduleRight}>
              <Text style={styles.schedulePrice}>{formatRand(item.price)}</Text>
              <View style={statusBadgeStyle(item.status)}>
                <Text style={styles.badgeText}>{item.status || 'pending'}</Text>
              </View>
            </View>
          </View>
        ))
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  content: { padding: 18, paddingTop: 56, paddingBottom: 40 },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },

  hero: {
    borderRadius: 22, padding: 20, marginBottom: 18, overflow: 'hidden',
    ...shadows.floating,
  },
  heroWatermark: { position: 'absolute', top: -30, right: -20, transform: [{ rotate: '18deg' }] },
  heroRow: { flexDirection: 'row', alignItems: 'center' },
  heroAvatar: { width: 56, height: 56, borderRadius: 28, marginRight: 14, borderWidth: 2, borderColor: 'rgba(255,255,255,0.6)' },
  heroAvatarFallback: {
    width: 56, height: 56, borderRadius: 28, marginRight: 14,
    backgroundColor: 'rgba(255,255,255,0.18)', alignItems: 'center', justifyContent: 'center',
    borderWidth: 2, borderColor: 'rgba(255,255,255,0.6)',
  },
  heroTextWrap: { flex: 1 },
  heroGreeting: { fontSize: 13, color: 'rgba(255,255,255,0.85)', fontWeight: '700' },
  heroShopName: { fontSize: 23, color: colors.accentText, fontWeight: '800', marginTop: 2 },

  subBanner: {
    marginBottom: 16, borderRadius: 14, borderWidth: 1, borderColor: colors.border,
    backgroundColor: colors.accentSoft, padding: 12, flexDirection: 'row', alignItems: 'center',
  },
  subBannerLeft: { flex: 1, flexDirection: 'row', alignItems: 'center', marginRight: 8 },
  subBannerText: { color: colors.text, fontSize: 12, fontWeight: '700', lineHeight: 16, marginLeft: 8, flex: 1 },
  subBannerBtn: { borderRadius: 10, backgroundColor: colors.accent, paddingVertical: 8, paddingHorizontal: 12 },
  subBannerBtnText: { color: colors.accentText, fontSize: 12, fontWeight: '900' },

  statsRow: { flexDirection: 'row', gap: 10, marginBottom: 18 },
  statCard: {
    flex: 1, backgroundColor: colors.surface, borderRadius: 16, padding: 12,
    borderWidth: 1, borderColor: colors.border, ...shadows.card,
  },
  statIconBadge: {
    width: 30, height: 30, borderRadius: 15, backgroundColor: colors.accentSoft,
    alignItems: 'center', justifyContent: 'center',
  },
  statValue: { fontSize: 18, fontWeight: '900', color: colors.text, marginTop: 8 },
  statLabel: { fontSize: 12, fontWeight: '700', color: colors.textSecondary, marginTop: 2 },
  statHint: { fontSize: 10, color: colors.textMuted, marginTop: 4, lineHeight: 13 },

  quickActionsRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 22 },
  quickAction: {
    alignItems: 'center', justifyContent: 'center', width: '23%',
    backgroundColor: colors.surface, borderRadius: 14, paddingVertical: 12,
    borderWidth: 1, borderColor: colors.border, ...shadows.card,
  },
  quickActionIconBadge: {
    width: 34, height: 34, borderRadius: 17, backgroundColor: colors.accentSoft,
    alignItems: 'center', justifyContent: 'center',
  },
  quickActionText: { marginTop: 6, fontSize: 11, fontWeight: '700', color: colors.textSecondary },

  sectionTitle: { fontSize: 16, fontWeight: '800', color: colors.text, marginBottom: 10 },
  emptyCard: {
    backgroundColor: colors.surface, borderRadius: 16, padding: 24, alignItems: 'center',
    borderWidth: 1, borderColor: colors.border,
  },
  emptyText: { color: colors.textMuted, marginTop: 8, fontSize: 13, fontWeight: '600' },

  scheduleCard: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: colors.surface,
    borderRadius: 14, padding: 12, marginBottom: 10, borderWidth: 1, borderColor: colors.border,
  },
  scheduleAvatar: { width: 40, height: 40, borderRadius: 20, marginRight: 12 },
  scheduleAvatarFallback: {
    width: 40, height: 40, borderRadius: 20, marginRight: 12,
    backgroundColor: colors.surfaceMuted, alignItems: 'center', justifyContent: 'center',
  },
  scheduleInfo: { flex: 1, marginRight: 8 },
  scheduleName: { fontSize: 14, fontWeight: '800', color: colors.text },
  scheduleService: { fontSize: 12, color: colors.textMuted, marginTop: 2 },
  scheduleRight: { alignItems: 'flex-end' },
  schedulePrice: { fontSize: 14, fontWeight: '900', color: colors.text, marginBottom: 4 },

  badge: { borderRadius: 999, paddingHorizontal: 8, paddingVertical: 3 },
  badgeSuccess: { backgroundColor: colors.successBg },
  badgePending: { backgroundColor: colors.pendingBg },
  badgeMuted: { backgroundColor: colors.surfaceMuted },
  badgeText: { fontSize: 10, fontWeight: '800', color: colors.textSecondary, textTransform: 'capitalize' },
});
