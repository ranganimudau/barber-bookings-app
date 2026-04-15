import { LinearGradient } from 'expo-linear-gradient';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Alert, Image, ScrollView, StyleSheet, Text, TouchableOpacity, View, useWindowDimensions } from 'react-native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { supabase } from "../../supabase/supabaseClient";
import { colors } from '../../theme/clientTheme';
import { ensureBarberSubscriptionState, isSubscriptionEligible } from '../../utils/subscriptionState';

export default function BarberEarnings({ navigation }) {
  const [confirmed, setConfirmed] = useState([]);
  const [pending, setPending] = useState([]);
  const [loading, setLoading] = useState(true);

  const [showAllRecent, setShowAllRecent] = useState(false);

  const [subscriptionState, setSubscriptionState] = useState(null);
  const [subscriptionLoading, setSubscriptionLoading] = useState(true);

  const pagerRef = useRef(null);
  const { width: windowWidth } = useWindowDimensions();

  // Offsets in ascending "age" so we can invert swipe direction.
  // We want: swipe right -> show past weeks.
  // So we start on the LAST page (current week) and older weeks are to the left.
  const weekOffsets = useMemo(() => [-5, -4, -3, -2, -1, 0], []);
  const [activeWeekIndex, setActiveWeekIndex] = useState(weekOffsets.length - 1);
  const [selectedDayIndex, setSelectedDayIndex] = useState(null);

  useEffect(() => {
    loadEarningsData();
  }, []);

  useEffect(() => {
    const loadSubscription = async () => {
      try {
        const {
          data: { user },
        } = await supabase.auth.getUser();
        if (!user) return;
        const state = await ensureBarberSubscriptionState(user.id);
        setSubscriptionState(state);
      } catch (e) {
        console.warn("Subscription state load failed:", e?.message);
        setSubscriptionState(null);
      } finally {
        setSubscriptionLoading(false);
      }
    };
    loadSubscription();
  }, []);

  const subscriptionEligible = isSubscriptionEligible(subscriptionState);
  const subscriptionLocked = !subscriptionLoading && subscriptionState && !subscriptionEligible;

  const loadEarningsData = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();

      const { data, error } = await supabase
        .from('appointments')
        .select(`
          id,
          appointment_date,
          appointment_time,
          status,
          service_name,
          price,
          client_id,
          profiles!appointments_client_id_fkey (full_name, avatar_url)
        `)
        .eq('barber_id', user.id)
        .order('appointment_date', { ascending: false });

      if (error) throw error;

      const rows = data || [];
      const confirmedRows = rows.filter((r) => {
        const s = (r.status || '').toLowerCase();
        return s === 'confirmed' || s === 'completed' || s === 'done';
      });
      const pendingRows = rows.filter((r) => {
        const s = (r.status || '').toLowerCase();
        return s === 'pending' || s === 'requested' || s === 'approved' || s === 'accepted';
      });

      setConfirmed(confirmedRows);
      setPending(pendingRows);
    } catch (error) {
      Alert.alert("Error", error.message);
    } finally {
      setLoading(false);
    }
  };

  const parseDateTime = (item) => {
    const date = item?.appointment_date;
    const time = (item?.appointment_time || '00:00').substring(0, 5);
    const parsed = new Date(`${date}T${time}:00`);
    return Number.isNaN(parsed.getTime()) ? new Date(0) : parsed;
  };

  const isSameDay = (a, b) =>
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate();

  const getWeekStart = (date) => {
    const d = new Date(date);
    const day = (d.getDay() + 6) % 7; // monday = 0
    d.setDate(d.getDate() - day);
    d.setHours(0, 0, 0, 0);
    return d;
  };

  const getWeekDays = (monday) => [...Array(7)].map((_, i) => {
    const d = new Date(monday);
    d.setDate(monday.getDate() + i);
    return d;
  });

  const toAmount = (n) => Number((n || 0));

  const stats = useMemo(() => {
    const now = new Date();
    const todayStart = new Date(now); todayStart.setHours(0, 0, 0, 0);
    const tomorrowStart = new Date(todayStart); tomorrowStart.setDate(todayStart.getDate() + 1);

    const weekStart = getWeekStart(now);
    const nextWeekStart = new Date(weekStart); nextWeekStart.setDate(weekStart.getDate() + 7);
    const prevWeekStart = new Date(weekStart); prevWeekStart.setDate(weekStart.getDate() - 7);

    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const nextMonthStart = new Date(now.getFullYear(), now.getMonth() + 1, 1);

    const total = confirmed.reduce((sum, r) => sum + toAmount(r.price), 0);
    const today = confirmed
      .filter((r) => {
        const dt = parseDateTime(r);
        return dt >= todayStart && dt < tomorrowStart;
      })
      .reduce((sum, r) => sum + toAmount(r.price), 0);

    const week = confirmed
      .filter((r) => {
        const dt = parseDateTime(r);
        return dt >= weekStart && dt < nextWeekStart;
      })
      .reduce((sum, r) => sum + toAmount(r.price), 0);

    const prevWeek = confirmed
      .filter((r) => {
        const dt = parseDateTime(r);
        return dt >= prevWeekStart && dt < weekStart;
      })
      .reduce((sum, r) => sum + toAmount(r.price), 0);

    const month = confirmed
      .filter((r) => {
        const dt = parseDateTime(r);
        return dt >= monthStart && dt < nextMonthStart;
      })
      .reduce((sum, r) => sum + toAmount(r.price), 0);

    const pendingAmount = pending.reduce((sum, r) => sum + toAmount(r.price), 0);

    const growth = prevWeek > 0 ? ((week - prevWeek) / prevWeek) * 100 : (week > 0 ? 100 : 0);

    return { total, today, week, month, pendingAmount, growth };
  }, [confirmed, pending]);

  const formatRand = (amount) => `R${amount.toFixed(2)}`;

  const weekCharts = useMemo(() => {
    const now = new Date();
    const dayLabels = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

    return weekOffsets.map((weekOffset) => {
      const baseWeekStart = getWeekStart(now);
      const weekStartForOffset = new Date(baseWeekStart);
      weekStartForOffset.setDate(baseWeekStart.getDate() + weekOffset * 7);

      const weekDays = getWeekDays(weekStartForOffset);

      const chartPoints = weekDays.map((day, i) => {
        const rowsForDay = confirmed.filter((r) => isSameDay(parseDateTime(r), day));
        const value = rowsForDay.reduce((sum, r) => sum + toAmount(r.price), 0);
        return { label: dayLabels[i], value, count: rowsForDay.length, date: day };
      });

      const max = Math.max(...chartPoints.map((p) => p.value), 1);
      const bars = chartPoints.map((p) => ({ ...p, ratio: p.value / max }));

      const weekEnd = new Date(weekStartForOffset);
      weekEnd.setDate(weekEnd.getDate() + 6);
      const fmt = (d) => d.toLocaleDateString('en-ZA', { day: '2-digit', month: 'short' });
      const rangeLabel = `${fmt(weekStartForOffset)} - ${fmt(weekEnd)}`;

      return { weekStartForOffset, rangeLabel, chartPoints, bars };
    });
  }, [confirmed, weekOffsets]);

  const activeWeek = weekCharts[Math.min(Math.max(activeWeekIndex, 0), weekCharts.length - 1)];

  const pageWidth = Math.max(280, windowWidth - 32);

  const handleWeekScrollEnd = (e) => {
    const idx = Math.round(e.nativeEvent.contentOffset.x / pageWidth);
    const clamped = Math.min(Math.max(idx, 0), weekOffsets.length - 1);
    setActiveWeekIndex(clamped);
    setSelectedDayIndex(null);
  };

  const selectedDay = selectedDayIndex != null ? activeWeek?.chartPoints?.[selectedDayIndex] : null;

  useEffect(() => {
    // On initial load, auto-select today's day within the current week.
    if (!weekCharts?.length) return;
    if (weekOffsets[activeWeekIndex] !== 0) return;

    const today = new Date();
    const baseWeekStart = getWeekStart(today);
    const weekDays = getWeekDays(baseWeekStart);
    const todayIdx = weekDays.findIndex((d) => isSameDay(d, today));
    if (todayIdx >= 0) setSelectedDayIndex(todayIdx);
  }, [activeWeekIndex, weekCharts, weekOffsets]);

  useEffect(() => {
    // Ensure the ScrollView starts on the "current week" page.
    // Without this, content offset starts at page 0 (oldest).
    if (!pagerRef.current) return;
    const targetIndex = weekOffsets.length - 1;
    const x = targetIndex * pageWidth;
    requestAnimationFrame(() => {
      try {
        pagerRef.current.scrollTo({ x, animated: false });
      } catch (e) {
        // No-op: scrollTo may fail on first render in some RN versions.
      }
    });
  }, [pageWidth, weekOffsets.length]);

  if (loading) return <ActivityIndicator style={styles.loader} size="large" />;

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <LinearGradient colors={['#0A0A0A', '#2A1F15']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.mainCard}>
        <Text style={styles.mainLabel}>Total Earnings</Text>
        <Text style={styles.mainAmount}>{formatRand(stats.total)}</Text>
        <View style={styles.growthRow}>
          <Ionicons name="trending-up" size={14} color="#22c55e" />
          <Text style={styles.growthText}>{`${stats.growth >= 0 ? '+' : ''}${stats.growth.toFixed(0)}% this week`}</Text>
        </View>
      </LinearGradient>

      <View style={styles.statsRow}>
        <View style={styles.statCard}>
          <Ionicons name="today-outline" size={16} color={colors.textMuted} />
          <Text style={styles.statLabel}>Today</Text>
          <Text style={styles.statValue}>{formatRand(stats.today)}</Text>
        </View>
        <View style={styles.statCard}>
          <Ionicons name="calendar-outline" size={16} color={colors.textMuted} />
          <Text style={styles.statLabel}>This Week</Text>
          <Text style={styles.statValue}>{formatRand(stats.week)}</Text>
        </View>
        <View style={styles.statCard}>
          <Ionicons name="stats-chart-outline" size={16} color={colors.textMuted} />
          <Text style={styles.statLabel}>This Month</Text>
          <Text style={styles.statValue}>{formatRand(stats.month)}</Text>
        </View>
      </View>

      <View style={styles.chartCard}>
        <Text style={styles.sectionTitle}>Weekly Performance</Text>

        {subscriptionLocked ? (
          <View style={styles.lockedBanner}>
            <Text style={styles.lockedBannerText}>Renew subscription to unlock earning stats.</Text>
            <TouchableOpacity
              style={styles.lockedBannerBtn}
              onPress={() => navigation.navigate("SubscriptionPaywall")}
              activeOpacity={0.85}
            >
              <Text style={styles.lockedBannerBtnText}>Upgrade</Text>
            </TouchableOpacity>
          </View>
        ) : null}

        <View style={[styles.weekMetaRow, subscriptionLocked && { opacity: 0.35 }]}>
          <Ionicons name="calendar-outline" size={16} color={colors.textMuted} />
          <Text style={styles.weekMetaText}>{activeWeek?.rangeLabel || ''}</Text>
        </View>

        <ScrollView
          ref={pagerRef}
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          decelerationRate="fast"
          nestedScrollEnabled
          onMomentumScrollEnd={handleWeekScrollEnd}
          scrollEnabled={!subscriptionLocked}
        >
          {weekCharts.map((week, pageIdx) => (
            <View key={week.rangeLabel} style={{ width: pageWidth, opacity: subscriptionLocked ? 0.35 : 1 }}>
              <View style={styles.chartGrid}>
                {[0, 1, 2, 3].map((i) => (
                  <View key={i} style={[styles.chartGridLine, { top: i * (140 / 3) }]} />
                ))}

                <View style={styles.chartBarsRow}>
                  {week.bars.map((bar, idx) => (
                    <TouchableOpacity
                      key={`${bar.label}-${pageIdx}`}
                      activeOpacity={0.85}
                      onPress={() => setSelectedDayIndex(idx)}
                      style={styles.chartBarColTouchable}
                    >
                      <View style={styles.chartBarTrack}>
                        <View
                          style={[
                            styles.chartBarFill,
                            { height: `${Math.max(bar.ratio * 100, 6)}%` },
                            selectedDayIndex === idx && pageIdx === activeWeekIndex
                              ? styles.chartBarFillSelected
                              : null,
                          ]}
                        />
                      </View>
                      <View style={styles.chartLabelSpacer} />
                    </TouchableOpacity>
                  ))}
                </View>
              </View>

              <View style={styles.chartLabelsRow}>
                {week.chartPoints.map((p, idx) => (
                  <TouchableOpacity
                    key={p.label}
                    activeOpacity={0.85}
                    onPress={() => !subscriptionLocked && setSelectedDayIndex(idx)}
                  >
                    <Text
                      style={[
                        styles.chartLabel,
                        selectedDayIndex === idx && pageIdx === activeWeekIndex ? styles.chartLabelSelected : null,
                      ]}
                    >
                      {p.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          ))}
        </ScrollView>

        <View style={[styles.dayDetailCard, subscriptionLocked && { opacity: 0.35 }]}>
          {selectedDay ? (
            <>
              <Text style={styles.dayDetailTitle}>
                {selectedDay.label} • {selectedDay.date.toLocaleDateString('en-ZA', { day: '2-digit', month: 'short' })}
              </Text>
              <Text style={styles.dayDetailAmount}>{formatRand(selectedDay.value)}</Text>
              <Text style={styles.dayDetailMeta}>{selectedDay.count} confirmed appointment(s)</Text>
            </>
          ) : (
            <Text style={styles.dayDetailHint}>Tap a day on the graph to view stats.</Text>
          )}
        </View>
      </View>

      <View style={styles.recentWrap}>
        <Text style={styles.sectionTitle}>Recent Earnings</Text>
        {(showAllRecent ? confirmed : confirmed.slice(0, 4)).map((item) => (
          <View key={item.id} style={styles.txnRow}>
            {item.profiles?.avatar_url ? (
              <Image source={{ uri: item.profiles.avatar_url }} style={styles.avatar} />
            ) : (
              <View style={styles.avatarFallback}>
                <Ionicons name="person" size={14} color={colors.textMuted} />
              </View>
            )}
            <View style={styles.txnInfo}>
              <Text style={styles.txnName}>{item.profiles?.full_name || 'Client'}</Text>
              <Text style={styles.txnService}>{item.service_name || 'Service'}</Text>
            </View>
            <View style={styles.txnAmountWrap}>
              <Text style={styles.txnAmount}>{formatRand(toAmount(item.price))}</Text>
              <Ionicons name="checkmark-circle" size={16} color="#22c55e" />
            </View>
          </View>
        ))}

        {confirmed.length > 4 && (
          <TouchableOpacity
            style={styles.recentToggleBtn}
            activeOpacity={0.85}
            onPress={() => setShowAllRecent((v) => !v)}
          >
            <Ionicons name={showAllRecent ? 'chevron-up' : 'chevron-down'} size={18} color={colors.accent} />
            <Text style={styles.recentToggleText}>{showAllRecent ? 'Show less' : 'See more'}</Text>
          </TouchableOpacity>
        )}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  content: { padding: 16, paddingBottom: 30 },
  loader: { flex: 1, justifyContent: 'center' },
  mainCard: { borderRadius: 22, padding: 18, marginBottom: 14 },
  mainLabel: { color: colors.accent, fontSize: 14, fontWeight: '700' },
  mainAmount: { color: '#F5F5F0', fontSize: 36, fontWeight: '800', marginTop: 8 },
  growthRow: { marginTop: 8, flexDirection: 'row', alignItems: 'center' },
  growthText: { color: '#22c55e', marginLeft: 6, fontSize: 13, fontWeight: '700' },
  statsRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 14 },
  statCard: {
    width: '31.5%',
    backgroundColor: 'rgba(255,255,255,0.03)',
    borderRadius: 14,
    padding: 10,
    borderWidth: 1,
    borderColor: 'rgba(197,160,112,0.25)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 1,
  },
  statLabel: { marginTop: 6, fontSize: 11, color: colors.textMuted, fontWeight: '700' },
  statValue: { marginTop: 4, fontSize: 14, color: '#F5F5F0', fontWeight: '800' },
  chartCard: { backgroundColor: 'rgba(255,255,255,0.03)', borderRadius: 16, padding: 14, borderWidth: 1, borderColor: 'rgba(197,160,112,0.25)', marginBottom: 14 },
  sectionTitle: { fontSize: 16, fontWeight: '800', color: colors.accent, marginBottom: 10 },
  lockedBanner: {
    backgroundColor: "rgba(255,255,255,0.03)",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "rgba(197,160,112,0.3)",
    padding: 14,
    marginBottom: 12,
  },
  lockedBannerText: { color: "#F5F5F0", fontWeight: "800", marginBottom: 12 },
  lockedBannerBtn: {
    backgroundColor: colors.accent,
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.12)",
  },
  lockedBannerBtnText: { color: "#0A0A0A", fontWeight: "900" },
  weekMetaRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 10 },
  weekMetaText: { color: colors.textMuted, fontWeight: '700', fontSize: 12 },
  chartGrid: {
    height: 140,
    borderRadius: 12,
    overflow: 'hidden',
    backgroundColor: 'rgba(255,255,255,0.02)',
    justifyContent: 'space-between',
  },
  chartGridLine: {
    position: 'absolute',
    left: 0,
    right: 0,
    height: 1,
    backgroundColor: 'rgba(197,160,112,0.22)',
  },
  chartBarsRow: {
    flexDirection: 'row',
    height: '100%',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    paddingHorizontal: 10,
    paddingVertical: 10,
  },
  chartBarCol: {
    width: '12.5%',
    alignItems: 'center',
    justifyContent: 'flex-end',
    height: '100%',
  },
  chartBarColTouchable: {
    width: '12.5%',
    alignItems: 'center',
    justifyContent: 'flex-end',
    height: '100%',
  },
  chartBarTrack: {
    width: 18,
    height: '100%',
    borderRadius: 9,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(197,160,112,0.15)',
    overflow: 'hidden',
  },
  chartBarFillSelected: {
    // Slightly brighter bronze when selected
    backgroundColor: '#F0D48A',
  },
  chartBarFill: {
    width: '100%',
    backgroundColor: colors.accent,
    borderRadius: 9,
    minHeight: 4,
  },
  chartLabelsRow: { flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 10, marginTop: 8 },
  chartLabel: { fontSize: 11, color: colors.textMuted, fontWeight: '700' },
  chartLabelSelected: { color: '#F0D48A', fontWeight: '900' },
  chartLabelSpacer: { height: 0 },
  dayDetailCard: {
    marginTop: 12,
    borderRadius: 16,
    padding: 14,
    backgroundColor: 'rgba(255,255,255,0.03)',
    borderWidth: 1,
    borderColor: 'rgba(197,160,112,0.25)',
  },
  dayDetailTitle: { color: colors.accent, fontWeight: '900', fontSize: 15, marginBottom: 6 },
  dayDetailAmount: { color: '#F5F5F0', fontWeight: '900', fontSize: 26, marginBottom: 2 },
  dayDetailMeta: { color: colors.textMuted, fontWeight: '700', fontSize: 12 },
  dayDetailHint: { color: colors.textMuted, fontWeight: '700', fontSize: 13 },
  pendingCard: { backgroundColor: 'rgba(255,255,255,0.03)', borderRadius: 16, padding: 14, borderWidth: 1, borderColor: 'rgba(197,160,112,0.25)', marginBottom: 14 },
  pendingBadge: {
    backgroundColor: 'rgba(197,160,112,0.12)',
    borderColor: 'rgba(197,160,112,0.35)',
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    flexDirection: 'row',
    alignItems: 'center',
  },
  pendingText: { marginLeft: 8, color: colors.accent, fontWeight: '800', fontSize: 13 },
  recentWrap: { backgroundColor: 'rgba(255,255,255,0.03)', borderRadius: 16, padding: 14, borderWidth: 1, borderColor: 'rgba(197,160,112,0.25)' },
  recentToggleBtn: {
    marginTop: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(197,160,112,0.25)',
    backgroundColor: 'rgba(255,255,255,0.02)',
  },
  recentToggleText: { color: colors.accent, fontWeight: '900', fontSize: 13 },
  txnRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: 'rgba(197,160,112,0.18)' },
  avatar: { width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(197,160,112,0.12)' },
  avatarFallback: { width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.04)', alignItems: 'center', justifyContent: 'center' },
  txnInfo: { flex: 1, marginLeft: 10 },
  txnName: { fontSize: 14, color: '#F5F5F0', fontWeight: '800' },
  txnService: { fontSize: 12, color: colors.textMuted, marginTop: 2 },
  txnAmountWrap: { alignItems: 'flex-end' },
  txnAmount: { fontSize: 14, fontWeight: '900', color: '#F5F5F0', marginBottom: 2 },
});