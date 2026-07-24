import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Alert, Image, ScrollView, StyleSheet, Text, TouchableOpacity, View, useWindowDimensions } from 'react-native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useLightStatusBar } from '../../hooks/useLightStatusBar';
import { supabase } from "../../supabase/supabaseClient";
import { colors, shadows } from '../../theme/barberTheme';
import { ensureBarberSubscriptionState, isSubscriptionEligible } from '../../utils/subscriptionState';

export default function BarberEarnings({ navigation }) {
  useLightStatusBar(colors.background);
  const insets = useSafeAreaInsets();

  const [confirmed, setConfirmed] = useState([]);
  const [pending, setPending] = useState([]);
  const [loading, setLoading] = useState(true);

  const [showAllRecent, setShowAllRecent] = useState(false);

  const [subscriptionState, setSubscriptionState] = useState(null);
  const [subscriptionLoading, setSubscriptionLoading] = useState(true);

  const pagerRef = useRef(null);
  const { width: windowWidth } = useWindowDimensions();

  // Ascending offsets, past to future, laid out left-to-right in that
  // order — current week sits in the middle so both directions have
  // somewhere to go: swiping right (finger moves right) naturally reveals
  // earlier pages (past weeks), swiping left reveals later pages (upcoming
  // weeks, using already-confirmed future bookings).
  const weekOffsets = useMemo(() => [-4, -3, -2, -1, 0, 1, 2, 3, 4], []);
  const currentWeekPageIndex = weekOffsets.indexOf(0);
  const [activeWeekIndex, setActiveWeekIndex] = useState(currentWeekPageIndex);
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


  if (loading) return <ActivityIndicator style={styles.loader} size="large" color={colors.accent} />;

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={[styles.content, { paddingTop: Math.max(insets.top, 24) + 44 }]}
      bounces={false}
      overScrollMode="never"
    >
      <Text style={styles.screenTitle}>Earnings</Text>

      <View style={styles.mainCard}>
        <Text style={styles.mainLabel}>Total Earnings</Text>
        <Text style={styles.mainAmount}>{formatRand(stats.total)}</Text>
        <View style={styles.growthRow}>
          <Ionicons name="trending-up" size={14} color={colors.success} />
          <Text style={styles.growthText}>{`${stats.growth >= 0 ? '+' : ''}${stats.growth.toFixed(0)}% this week`}</Text>
        </View>
      </View>

      <View style={styles.statsRow}>
        <View style={styles.statCard}>
          <View style={styles.statIconBadge}>
            <Ionicons name="today-outline" size={16} color={colors.accent} />
          </View>
          <Text style={styles.statValue}>{formatRand(stats.today)}</Text>
          <Text style={styles.statLabel}>Today</Text>
        </View>
        <View style={styles.statCard}>
          <View style={styles.statIconBadge}>
            <Ionicons name="calendar-outline" size={16} color={colors.accent} />
          </View>
          <Text style={styles.statValue}>{formatRand(stats.week)}</Text>
          <Text style={styles.statLabel}>This Week</Text>
        </View>
        <View style={styles.statCard}>
          <View style={styles.statIconBadge}>
            <Ionicons name="stats-chart-outline" size={16} color={colors.accent} />
          </View>
          <Text style={styles.statValue}>{formatRand(stats.month)}</Text>
          <Text style={styles.statLabel}>This Month</Text>
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
          // Declarative initial scroll position — reliable on first mount,
          // unlike an imperative scrollTo() in an effect (which raced with
          // native layout and left the real scroll position at page 0 while
          // state said otherwise, until the next scroll event "corrected" it).
          contentOffset={{ x: currentWeekPageIndex * pageWidth, y: 0 }}
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
                      onPress={() => {
                        setActiveWeekIndex(pageIdx);
                        setSelectedDayIndex(idx);
                      }}
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
                    style={styles.chartLabelCol}
                    onPress={() => {
                      if (subscriptionLocked) return;
                      setActiveWeekIndex(pageIdx);
                      setSelectedDayIndex(idx);
                    }}
                  >
                    <Text
                      style={[
                        styles.chartLabel,
                        selectedDayIndex === idx && pageIdx === activeWeekIndex ? styles.chartLabelSelected : null,
                      ]}
                    >
                      {p.label}
                    </Text>
                    <Text
                      style={[
                        styles.chartLabelDate,
                        selectedDayIndex === idx && pageIdx === activeWeekIndex ? styles.chartLabelSelected : null,
                      ]}
                    >
                      {p.date.getDate()}
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
              <Ionicons name="checkmark-circle" size={16} color={colors.success} />
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
  screenTitle: { fontSize: 24, fontWeight: '800', color: colors.text, marginBottom: 14 },
  mainCard: {
    backgroundColor: colors.surface, borderRadius: 20, padding: 18, marginBottom: 14,
    borderWidth: 1, borderColor: colors.border, ...shadows.card,
  },
  mainLabel: { color: colors.textSecondary, fontSize: 14, fontWeight: '700' },
  mainAmount: { color: colors.text, fontSize: 36, fontWeight: '800', marginTop: 8 },
  growthRow: { marginTop: 8, flexDirection: 'row', alignItems: 'center' },
  growthText: { color: colors.success, marginLeft: 6, fontSize: 13, fontWeight: '700' },
  statsRow: { flexDirection: 'row', justifyContent: 'space-between', gap: 10, marginBottom: 14 },
  statCard: {
    flex: 1,
    backgroundColor: colors.surface,
    borderRadius: 16,
    padding: 12,
    borderWidth: 1,
    borderColor: colors.border,
    ...shadows.card,
  },
  statIconBadge: {
    width: 30, height: 30, borderRadius: 15, backgroundColor: colors.accentSoft,
    alignItems: 'center', justifyContent: 'center', marginBottom: 8,
  },
  statLabel: { marginTop: 2, fontSize: 12, color: colors.textSecondary, fontWeight: '700' },
  statValue: { fontSize: 16, color: colors.text, fontWeight: '900' },
  chartCard: {
    backgroundColor: colors.surface, borderRadius: 20, padding: 16,
    borderWidth: 1, borderColor: colors.border, marginBottom: 14, ...shadows.card,
  },
  sectionTitle: { fontSize: 16, fontWeight: '800', color: colors.text, marginBottom: 10 },
  lockedBanner: {
    backgroundColor: colors.accentSoft,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 14,
    marginBottom: 12,
  },
  lockedBannerText: { color: colors.text, fontWeight: "800", marginBottom: 12 },
  lockedBannerBtn: {
    backgroundColor: colors.accent,
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: "center",
  },
  lockedBannerBtnText: { color: colors.accentText, fontWeight: "900" },
  weekMetaRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 10 },
  weekMetaText: { color: colors.textMuted, fontWeight: '700', fontSize: 12 },
  chartGrid: {
    height: 140,
    borderRadius: 12,
    overflow: 'hidden',
    backgroundColor: colors.surfaceMuted,
    justifyContent: 'space-between',
  },
  chartGridLine: {
    position: 'absolute',
    left: 0,
    right: 0,
    height: 1,
    backgroundColor: colors.border,
  },
  chartBarsRow: {
    flexDirection: 'row',
    height: '100%',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    paddingHorizontal: 10,
    paddingVertical: 10,
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
    backgroundColor: colors.surface,
    overflow: 'hidden',
  },
  chartBarFillSelected: {
    backgroundColor: colors.accentDark,
  },
  chartBarFill: {
    width: '100%',
    backgroundColor: colors.accent,
    borderRadius: 9,
    minHeight: 4,
  },
  chartLabelsRow: { flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 10, marginTop: 8 },
  chartLabelCol: { flex: 1, alignItems: 'center' },
  chartLabel: { fontSize: 11, color: colors.textMuted, fontWeight: '700', textAlign: 'center' },
  chartLabelDate: { fontSize: 13, color: colors.text, fontWeight: '800', textAlign: 'center', marginTop: 2 },
  chartLabelSelected: { color: colors.accent, fontWeight: '900' },
  chartLabelSpacer: { height: 0 },
  dayDetailCard: {
    marginTop: 12,
    borderRadius: 16,
    padding: 14,
    backgroundColor: colors.surfaceMuted,
    borderWidth: 1,
    borderColor: colors.border,
  },
  dayDetailTitle: { color: colors.accent, fontWeight: '900', fontSize: 15, marginBottom: 6 },
  dayDetailAmount: { color: colors.text, fontWeight: '900', fontSize: 26, marginBottom: 2 },
  dayDetailMeta: { color: colors.textMuted, fontWeight: '700', fontSize: 12 },
  dayDetailHint: { color: colors.textMuted, fontWeight: '700', fontSize: 13 },
  recentWrap: {
    backgroundColor: colors.surface, borderRadius: 20, padding: 16,
    borderWidth: 1, borderColor: colors.border, ...shadows.card,
  },
  recentToggleBtn: {
    marginTop: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceMuted,
  },
  recentToggleText: { color: colors.accent, fontWeight: '900', fontSize: 13 },
  txnRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: colors.border },
  avatar: { width: 40, height: 40, borderRadius: 20, backgroundColor: colors.surfaceMuted },
  avatarFallback: { width: 40, height: 40, borderRadius: 20, backgroundColor: colors.surfaceMuted, alignItems: 'center', justifyContent: 'center' },
  txnInfo: { flex: 1, marginLeft: 10 },
  txnName: { fontSize: 14, color: colors.text, fontWeight: '800' },
  txnService: { fontSize: 12, color: colors.textMuted, marginTop: 2 },
  txnAmountWrap: { alignItems: 'flex-end' },
  txnAmount: { fontSize: 14, fontWeight: '900', color: colors.text, marginBottom: 2 },
});
