import { useFocusEffect } from '@react-navigation/native';
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
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Icon from 'react-native-vector-icons/Ionicons';
import Svg, { Circle, Defs, LinearGradient, Path, Stop } from 'react-native-svg';
import { useLightStatusBar } from '../../hooks/useLightStatusBar';
import { supabase } from '../../supabase/supabaseClient';
import { colors, shadows } from '../../theme/barberTheme';
import {
    ensureBarberSubscriptionState,
    getSubscriptionLabel,
    isSubscriptionEligible,
} from '../../utils/subscriptionState';

const greetingForNow = () => {
  const hour = new Date().getHours();
  if (hour < 12) return 'Good morning';
  if (hour < 18) return 'Good afternoon';
  return 'Good evening';
};

const ACTIVE_STATUSES = ['confirmed', 'accepted', 'approved', 'completed', 'done'];
const PENDING_STATUSES = ['pending', 'requested'];
const DAY_LABELS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

const todayKey = () => new Date().toISOString().slice(0, 10);
const formatRand = (amount) => `R${Number(amount || 0).toFixed(2)}`;
const formatTime = (time) => (time || '').toString().substring(0, 5);

const getWeekStart = (date) => {
  const d = new Date(date);
  const day = (d.getDay() + 6) % 7; // Monday = 0
  d.setDate(d.getDate() - day);
  d.setHours(0, 0, 0, 0);
  return d;
};

const CHART_HEIGHT = 120;
const CHART_V_PAD = 16; // keeps the curve's peak/trough off the top/bottom edge

/** Smooth curve through points via a chained cubic bezier (midpoint control
 * points) — a standard lightweight sparkline-smoothing technique. */
const buildSmoothPath = (points) => {
  if (points.length === 0) return '';
  if (points.length === 1) return `M ${points[0].x} ${points[0].y}`;
  let d = `M ${points[0].x} ${points[0].y}`;
  for (let i = 0; i < points.length - 1; i++) {
    const p0 = points[i];
    const p1 = points[i + 1];
    const midX = (p0.x + p1.x) / 2;
    d += ` C ${midX} ${p0.y}, ${midX} ${p1.y}, ${p1.x} ${p1.y}`;
  }
  return d;
};

export default function BarberDashboard({ navigation }) {
  const insets = useSafeAreaInsets();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [barberName, setBarberName] = useState('');
  const [barberAvatar, setBarberAvatar] = useState(null);
  const [subscriptionState, setSubscriptionState] = useState(null);
  const [appointments, setAppointments] = useState([]);
  const [selectedDayIndex, setSelectedDayIndex] = useState(null);
  const [metric, setMetric] = useState('revenue');
  const [chartWidth, setChartWidth] = useState(0);

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

  useLightStatusBar(colors.background);

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

  // Single-series magnitude-over-time chart: this week's confirmed jobs,
  // either by revenue or by count (toggle). One hue (accent), no legend
  // needed (one series — the toggle pill already names it).
  const week = useMemo(() => {
    const now = new Date();
    const weekStart = getWeekStart(now);
    const confirmed = appointments.filter((a) => ACTIVE_STATUSES.includes((a.status || '').toLowerCase()));

    const days = DAY_LABELS.map((label, i) => {
      const d = new Date(weekStart);
      d.setDate(weekStart.getDate() + i);
      const key = d.toISOString().slice(0, 10);
      const rows = confirmed.filter((a) => a.appointment_date === key);
      const revenue = rows.reduce((sum, a) => sum + Number(a.price || 0), 0);
      return { label, date: d, key, revenue, count: rows.length };
    });

    const totalRevenue = days.reduce((sum, d) => sum + d.revenue, 0);
    const totalCount = days.reduce((sum, d) => sum + d.count, 0);
    return { days, totalRevenue, totalCount };
  }, [appointments]);

  const todayIndex = useMemo(() => {
    const key = todayKey();
    return week.days.findIndex((d) => d.key === key);
  }, [week]);

  const activeDayIndex = selectedDayIndex ?? todayIndex;
  const activeDay = activeDayIndex >= 0 ? week.days[activeDayIndex] : null;
  const metricValue = (day) => (metric === 'revenue' ? day.revenue : day.count);

  const chartGeometry = useMemo(() => {
    if (!chartWidth) return null;
    const values = week.days.map(metricValue);
    const max = Math.max(...values, 1);
    const min = 0;
    const usableH = CHART_HEIGHT - CHART_V_PAD * 2;
    const stepX = chartWidth / (week.days.length - 1 || 1);

    const points = week.days.map((day, i) => {
      const v = metricValue(day);
      const ratio = max === min ? 0 : (v - min) / (max - min);
      return {
        x: i * stepX,
        y: CHART_V_PAD + (usableH - ratio * usableH),
        day,
      };
    });

    const linePath = buildSmoothPath(points);
    const areaPath = points.length
      ? `${linePath} L ${points[points.length - 1].x} ${CHART_HEIGHT} L ${points[0].x} ${CHART_HEIGHT} Z`
      : '';

    return { points, linePath, areaPath };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chartWidth, week, metric]);

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
      contentContainerStyle={[styles.content, { paddingTop: Math.max(insets.top, 24) + 44 }]}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.accent} colors={[colors.accent]} />}
      bounces={false}
      overScrollMode="never"
    >
      <View style={styles.header}>
        <View style={styles.headerTopRow}>
          {barberAvatar ? (
            <Image source={{ uri: barberAvatar }} style={styles.headerAvatar} />
          ) : (
            <View style={styles.headerAvatarFallback}>
              <Icon name="storefront-outline" size={22} color={colors.accent} />
            </View>
          )}
          <View style={styles.headerTextWrap}>
            <Text style={styles.headerGreeting}>{greetingForNow()}</Text>
            <Text style={styles.headerShopName} numberOfLines={1}>{barberName || 'Your Shop'}</Text>
          </View>
        </View>

        <View style={styles.headerMetaRow}>
          <Text style={styles.headerDate}>
            {new Date().toLocaleDateString('en-ZA', { weekday: 'long', day: 'numeric', month: 'long' })}
          </Text>
          <View style={[styles.statusPill, subscriptionEligible ? styles.statusPillLive : styles.statusPillLocked]}>
            <View style={[styles.statusDot, subscriptionEligible ? styles.statusDotLive : styles.statusDotLocked]} />
            <Text style={[styles.statusPillText, subscriptionEligible ? styles.statusPillTextLive : styles.statusPillTextLocked]}>
              {subscriptionEligible ? 'Shop live' : 'Shop locked'}
            </Text>
          </View>
        </View>
      </View>

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

      <View style={styles.chartCard}>
        <View style={styles.chartHeaderRow}>
          <Text style={styles.sectionTitle}>This Week</Text>
          <View style={styles.pillGroup}>
            <TouchableOpacity
              style={[styles.pill, metric === 'revenue' && styles.pillActive]}
              onPress={() => setMetric('revenue')}
              activeOpacity={0.85}
            >
              <Text style={[styles.pillText, metric === 'revenue' && styles.pillTextActive]}>Revenue</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.pill, metric === 'count' && styles.pillActive]}
              onPress={() => setMetric('count')}
              activeOpacity={0.85}
            >
              <Text style={[styles.pillText, metric === 'count' && styles.pillTextActive]}>Jobs</Text>
            </TouchableOpacity>
          </View>
        </View>

        <View
          style={styles.chartArea}
          onLayout={(e) => setChartWidth(e.nativeEvent.layout.width)}
        >
          {activeDay && chartGeometry ? (
            <View
              style={[
                styles.chartTooltip,
                {
                  left: Math.min(
                    Math.max(chartGeometry.points[activeDayIndex]?.x - 40, 0),
                    Math.max(chartWidth - 80, 0)
                  ),
                },
              ]}
            >
              <Text style={styles.chartTooltipLabel}>
                {metric === 'revenue' ? formatRand(activeDay.revenue) : `${activeDay.count} job${activeDay.count === 1 ? '' : 's'}`}
              </Text>
            </View>
          ) : null}

          {chartWidth > 0 && chartGeometry ? (
            <Svg width={chartWidth} height={CHART_HEIGHT}>
              <Defs>
                <LinearGradient id="areaFade" x1="0" y1="0" x2="0" y2="1">
                  <Stop offset="0" stopColor={colors.accent} stopOpacity={0.22} />
                  <Stop offset="1" stopColor={colors.accent} stopOpacity={0} />
                </LinearGradient>
              </Defs>
              <Path d={chartGeometry.areaPath} fill="url(#areaFade)" />
              <Path d={chartGeometry.linePath} stroke={colors.accent} strokeWidth={2.5} fill="none" strokeLinecap="round" />
              {chartGeometry.points.map((p, idx) => (
                <Circle
                  key={p.day.key}
                  cx={p.x}
                  cy={p.y}
                  r={idx === activeDayIndex ? 5 : 3}
                  fill={idx === activeDayIndex ? colors.accent : colors.surface}
                  stroke={colors.accent}
                  strokeWidth={idx === activeDayIndex ? 2 : 1.5}
                />
              ))}
            </Svg>
          ) : null}

          <View style={StyleSheet.absoluteFill} pointerEvents="box-none">
            <View style={styles.chartHitRow}>
              {week.days.map((day, idx) => (
                <TouchableOpacity
                  key={day.key}
                  style={styles.chartHitCol}
                  activeOpacity={0.6}
                  onPress={() => setSelectedDayIndex(idx)}
                />
              ))}
            </View>
          </View>
        </View>

        <View style={styles.chartLabelsRow}>
          {week.days.map((day, idx) => (
            <Text key={day.key} style={[styles.chartBarLabel, idx === activeDayIndex && styles.chartBarLabelActive]}>
              {day.label}
            </Text>
          ))}
        </View>
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
  content: { padding: 18, paddingBottom: 40 },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },

  header: {
    marginBottom: 20, paddingBottom: 16,
    borderBottomWidth: 2, borderBottomColor: colors.borderStrong,
  },
  headerTopRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 16 },
  headerAvatar: { width: 48, height: 48, borderRadius: 24, marginRight: 14 },
  headerAvatarFallback: {
    width: 48, height: 48, borderRadius: 24, marginRight: 14,
    backgroundColor: colors.accentSoft, alignItems: 'center', justifyContent: 'center',
  },
  headerTextWrap: { flex: 1 },
  headerGreeting: { fontSize: 16, color: colors.textSecondary, fontWeight: '700' },
  headerShopName: { fontSize: 20, color: colors.text, fontWeight: '800', marginTop: 2 },

  headerMetaRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  headerDate: { fontSize: 13, color: colors.textSecondary, fontWeight: '700' },
  statusPill: {
    flexDirection: 'row', alignItems: 'center', borderRadius: 999,
    paddingVertical: 5, paddingHorizontal: 10,
  },
  statusPillLive: { backgroundColor: colors.successBg },
  statusPillLocked: { backgroundColor: colors.errorBg },
  statusDot: { width: 6, height: 6, borderRadius: 3, marginRight: 6 },
  statusDotLive: { backgroundColor: colors.success },
  statusDotLocked: { backgroundColor: colors.error },
  statusPillText: { fontSize: 11, fontWeight: '800' },
  statusPillTextLive: { color: colors.success },
  statusPillTextLocked: { color: colors.error },

  subBanner: {
    marginBottom: 16, borderRadius: 14, borderWidth: 1, borderColor: colors.border,
    backgroundColor: colors.accentSoft, padding: 12, flexDirection: 'row', alignItems: 'center',
  },
  subBannerLeft: { flex: 1, flexDirection: 'row', alignItems: 'center', marginRight: 8 },
  subBannerText: { color: colors.text, fontSize: 12, fontWeight: '700', lineHeight: 16, marginLeft: 8, flex: 1 },
  subBannerBtn: { borderRadius: 10, backgroundColor: colors.accent, paddingVertical: 8, paddingHorizontal: 12 },
  subBannerBtnText: { color: colors.accentText, fontSize: 12, fontWeight: '900' },

  statsRow: { flexDirection: 'row', gap: 10, marginBottom: 14 },
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

  chartCard: {
    backgroundColor: colors.surface, borderRadius: 20, padding: 16, marginBottom: 20,
    borderWidth: 1, borderColor: colors.border, ...shadows.card,
  },
  chartHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18 },
  pillGroup: {
    flexDirection: 'row', backgroundColor: colors.surfaceMuted, borderRadius: 999, padding: 3,
  },
  pill: { paddingVertical: 6, paddingHorizontal: 12, borderRadius: 999 },
  pillActive: { backgroundColor: colors.accent },
  pillText: { fontSize: 11, fontWeight: '800', color: colors.textSecondary },
  pillTextActive: { color: colors.accentText },

  chartArea: { height: CHART_HEIGHT, justifyContent: 'center' },
  chartTooltip: {
    position: 'absolute', top: -4, width: 80, alignItems: 'center', zIndex: 2,
  },
  chartTooltipLabel: {
    backgroundColor: colors.text, color: colors.white, fontSize: 11, fontWeight: '800',
    paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8, overflow: 'hidden',
  },
  chartHitRow: { flex: 1, flexDirection: 'row' },
  chartHitCol: { flex: 1 },
  chartLabelsRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 6 },
  chartBarLabel: { flex: 1, textAlign: 'center', fontSize: 10, color: colors.textMuted, fontWeight: '700' },
  chartBarLabelActive: { color: colors.accent, fontWeight: '900' },

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
