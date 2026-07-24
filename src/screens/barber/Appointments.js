import React, { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Image,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View
} from "react-native";
import Icon from "react-native-vector-icons/Ionicons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useLightStatusBar } from "../../hooks/useLightStatusBar";
import { colors, shadows } from "../../theme/barberTheme";
import { supabase } from "../../supabase/supabaseClient";
import { resolveStorageImageUrl } from "../../utils/storageImageUrl";
import { ensureBarberSubscriptionState, isSubscriptionEligible } from "../../utils/subscriptionState";
import { scheduleLocalNotificationSafe } from "../../utils/safeLocalNotification";

export default function Appointments({ navigation }) {
  useLightStatusBar(colors.background);
  const insets = useSafeAreaInsets();

  const [bookings, setBookings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("active");
  const [shopName, setShopName] = useState("Barber Shop");

  const [barberId, setBarberId] = useState(null);
  const [subscriptionState, setSubscriptionState] = useState(null);
  const [subscriptionLoading, setSubscriptionLoading] = useState(true);

  const subscriptionEligible = isSubscriptionEligible(subscriptionState);
  const subscriptionKnown = !!subscriptionState;
  const subscriptionLocked = subscriptionKnown && !subscriptionEligible && !subscriptionLoading;
  const trialFinished = !!subscriptionState?.trial_start && subscriptionLocked;

  const sendLocalNotification = async (title, body) => {
    try {
      await scheduleLocalNotificationSafe({ title, body, sound: "default" });
    } catch (error) {
      console.log("Notification schedule error:", error?.message);
    }
  };

  useEffect(() => {
    const loadSubscription = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;
        setBarberId(user.id);
        const state = await ensureBarberSubscriptionState(user.id);
        setSubscriptionState(state);
      } catch (e) {
        // If subscription table doesn't exist yet, keep everything enabled for dev.
        console.warn("Subscription state load failed:", e?.message);
        setSubscriptionState(null);
      } finally {
        setSubscriptionLoading(false);
      }
    };

    loadSubscription();
  }, []);


  useEffect(() => {
    let subscription;

    const setupRealtime = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: barberData } = await supabase
        .from("barbers")
        .select("shop_name")
        .eq("id", user.id)
        .maybeSingle();
      if (barberData?.shop_name) setShopName(barberData.shop_name);

      fetchBarberBookings(user.id);

      // Listen for NEW bookings targeting this specific barber
      subscription = supabase
        .channel("barber-bookings")
        .on(
          "postgres_changes",
          {
            event: "INSERT",
            schema: "public",
            table: "appointments",
            filter: `barber_id=eq.${user.id}`,
          },
          (payload) => {
            if (subscriptionEligible) {
              Alert.alert("New Booking!", "A client has just requested a slot.");
              sendLocalNotification(
                "New Booking Request",
                `${payload?.new?.service_name || "A new service"} has been requested.`
              );
            }
            fetchBarberBookings(user.id);
          }
        )
        .subscribe();
    };

    setupRealtime();

    return () => {
      if (subscription) supabase.removeChannel(subscription);
    };
  }, []);

  const fetchBarberBookings = async (userId) => {
    try {
      setLoading(true);
      let { data, error } = await supabase
        .from("appointments")
        .select(`
          id,
          appointment_date,
          appointment_time,
          status,
          service_name,
          price,
          profiles!appointments_client_id_fkey (full_name, email, avatar_url)
        `)
        .eq("barber_id", userId)
        .order("appointment_date", { ascending: true });

      // Fallback query if join syntax fails in current DB relation setup
      if (error) {
        const fallback = await supabase
          .from("appointments")
          .select("id, appointment_date, appointment_time, status, service_name, price, client_id")
          .eq("barber_id", userId)
          .order("appointment_date", { ascending: true });
        if (fallback.error) throw fallback.error;

        const clientIds = [...new Set((fallback.data || []).map((b) => b.client_id).filter(Boolean))];
        let profileMap = {};
        if (clientIds.length > 0) {
          const { data: profilesData } = await supabase
            .from("profiles")
            .select("id, full_name, email, avatar_url")
            .in("id", clientIds);
          profileMap = Object.fromEntries((profilesData || []).map((p) => [p.id, p]));
        }

        data = (fallback.data || []).map((booking) => ({
          ...booking,
          profiles: profileMap[booking.client_id] || null,
        }));
      }
      const rows = data || [];
      setBookings(rows);
    } catch (error) {
      console.error("Fetch Error:", error.message);
      Alert.alert("Load Error", "Could not load bookings right now.");
    } finally {
      setLoading(false);
    }
  };

  const updateStatus = async (appointmentId, newStatus, prevStatus) => {
    try {
      const newLower = String(newStatus || "").toLowerCase();
      const prevLower = String(prevStatus || "").toLowerCase();
      const acceptedStatuses = ["confirmed", "accepted", "approved"];
      const terminalStatuses = ["cancelled", "declined", "rejected", "completed", "done"];
      const isAcceptAction =
        acceptedStatuses.includes(newLower) &&
        !acceptedStatuses.includes(prevLower) &&
        !terminalStatuses.includes(prevLower);

      if (isAcceptAction && subscriptionLocked) {
        Alert.alert("Subscription required", "Activate subscription to continue receiving booking requests.");
        return;
      }

      const { error } = await supabase
        .from("appointments")
        .update({ status: newStatus })
        .eq("id", appointmentId);

      if (error) throw error;

      // Optimistically update local state for better speed
      setBookings(prev =>
        prev.map(b => b.id === appointmentId ? { ...b, status: newStatus } : b)
      );

      Alert.alert("Success", `Appointment ${newStatus}`);

      // Strict counting is now done in DB trigger on appointment acceptance.
      if (isAcceptAction && barberId) {
        const fullState = await ensureBarberSubscriptionState(barberId);
        if (fullState) setSubscriptionState(fullState);
      }
    } catch (error) {
      Alert.alert("Error", "Could not update status.");
    }
  };

  const getBookingTimestamp = (item) => {
    const date = item?.appointment_date;
    const time = (item?.appointment_time || "00:00").substring(0, 5);
    const parsed = new Date(`${date}T${time}:00`);
    return Number.isNaN(parsed.getTime()) ? 0 : parsed.getTime();
  };

  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);

  const categorized = useMemo(() => {
    const pending = [];
    const futureConfirmed = [];
    const needsCompletion = [];
    const completed = [];
    const cancelled = [];
    const now = Date.now();

    bookings.forEach((booking) => {
      const status = booking.status?.toLowerCase();
      const ts = getBookingTimestamp(booking);

      if (status === "pending" || status === "requested") {
        pending.push(booking);
      } else if (status === "confirmed" || status === "accepted" || status === "approved") {
        if (ts > now) {
          futureConfirmed.push(booking);
        } else {
          needsCompletion.push(booking);
        }
      } else if (status === "cancelled" || status === "declined" || status === "rejected") {
        cancelled.push(booking);
      } else if (status === "completed" || status === "done") {
        completed.push(booking);
      } else {
        futureConfirmed.push(booking);
      }
    });

    const ascByTime = (a, b) => getBookingTimestamp(a) - getBookingTimestamp(b);
    const descByTime = (a, b) => getBookingTimestamp(b) - getBookingTimestamp(a);

    pending.sort(ascByTime);
    futureConfirmed.sort(ascByTime);
    needsCompletion.sort(ascByTime);
    completed.sort(descByTime);
    cancelled.sort(descByTime);

    return { pending, futureConfirmed, needsCompletion, completed, cancelled };
  }, [bookings]);

  const activeSections = [
    { title: "New Booking Requests", data: subscriptionLocked ? [] : categorized.pending },
    { title: "Upcoming Confirmed", data: categorized.futureConfirmed },
  ].filter((section) => section.data.length > 0);

  const historySections = [
    { title: "Completed", data: categorized.completed },
    { title: "Cancelled / Declined", data: categorized.cancelled },
  ].filter((section) => section.data.length > 0);

  const sectionsToRender = activeTab === "active" ? activeSections : historySections;
  const todayKey = new Date().toISOString().slice(0, 10);

  const todaysBookings = bookings.filter((b) => b.appointment_date === todayKey);
  const todaysPending = todaysBookings.filter((b) => {
    const s = (b.status || "").toLowerCase();
    return s === "pending" || s === "requested";
  });
  // All upcoming confirmed appointments (not just today, not just the very
  // next one) — soonest first, since barbers need to see what's coming this
  // week/later, not only what's happening today.
  const upcomingAppointments = categorized.futureConfirmed;
  const nextAppointment = upcomingAppointments[0] || null;
  const laterAppointments = upcomingAppointments.slice(1);

  // Only render a section when it actually has something to show — avoids
  // stacking three separate empty-state cards when the barber's caught up.
  const hasPendingToShow = !subscriptionLocked && categorized.pending.length > 0;
  const hasNextAppointment = !!nextAppointment;
  const hasNeedsCompletion = categorized.needsCompletion.length > 0;
  const activeTabAllClear =
    !subscriptionLoading && !subscriptionLocked && !hasPendingToShow && !hasNextAppointment && !hasNeedsCompletion;

  const getMinutesUntil = (item) => {
    if (!item) return null;
    const ts = getBookingTimestamp(item);
    if (!ts) return null;
    const diff = Math.round((ts - Date.now()) / 60000);
    return diff >= 0 ? diff : null;
  };

  const minutesUntilNext = getMinutesUntil(nextAppointment);

  const formatTimeUntil = (minutes) => {
    if (minutes === null || minutes === undefined) return "upcoming";
    if (minutes < 60) return `in ${minutes} min`;

    const days = Math.floor(minutes / (60 * 24));
    const hours = Math.floor((minutes % (60 * 24)) / 60);
    const mins = minutes % 60;

    if (days > 0) {
      if (mins === 0) return `in ${days}d ${hours}h`;
      return `in ${days}d ${hours}h ${mins}m`;
    }

    if (mins === 0) return `in ${hours}h`;
    return `in ${hours}h ${mins}m`;
  };

  const formatTime = (timeString) => (timeString || "00:00").substring(0, 5);

  const formatCurrency = (amount) => `R${Number(amount || 0).toFixed(2)}`;
  const getClientAvatarUri = (item) => resolveStorageImageUrl(item?.profiles?.avatar_url);

  const renderActionCard = (item) => (
    <View key={item.id} style={styles.requestCard}>
      <View style={styles.requestMain}>
        {getClientAvatarUri(item) ? (
          <Image source={{ uri: getClientAvatarUri(item) }} style={styles.requestAvatar} />
        ) : (
          <View style={styles.requestAvatarFallback}>
            <Icon name="person" size={18} color={colors.textMuted} />
          </View>
        )}

        <View style={styles.requestInfo}>
          <Text style={styles.requestName}>{item.profiles?.full_name || "New Client"}</Text>
          <Text style={styles.requestService}>
            {item.service_name || "Service"} - {formatCurrency(item.price)}
          </Text>
          <Text style={styles.requestTime}>
            <Icon name="time-outline" size={13} color={colors.textMuted} /> {item.appointment_date} at {formatTime(item.appointment_time)}
          </Text>
          <View style={styles.pendingPill}>
            <Text style={styles.pendingPillText}>Pending</Text>
          </View>
        </View>
      </View>

      <View style={styles.fabColumn}>
        <TouchableOpacity style={[styles.fabBtn, styles.acceptFab]} onPress={() => updateStatus(item.id, "confirmed", item.status)}>
          <Icon name="checkmark" size={22} color="#fff" />
        </TouchableOpacity>
        <TouchableOpacity style={[styles.fabBtn, styles.declineFab]} onPress={() => updateStatus(item.id, "cancelled", item.status)}>
          <Icon name="close" size={22} color="#fff" />
        </TouchableOpacity>
      </View>
    </View>
  );

  const renderHistoryCard = (item) => {
    const status = (item.status || "").toLowerCase();
    const isDone = status === "completed" || status === "confirmed" || status === "done";
    return (
      <View key={item.id} style={styles.historyCard}>
        <View style={styles.historyLeft}>
          {getClientAvatarUri(item) ? (
            <Image source={{ uri: getClientAvatarUri(item) }} style={styles.historyAvatar} />
          ) : (
            <View style={styles.historyAvatarFallback}>
              <Icon name="person" size={16} color={colors.textMuted} />
            </View>
          )}
          <View>
            <Text style={styles.historyName}>{item.profiles?.full_name || "Client"}</Text>
            <Text style={styles.historySub}>{item.service_name || "Service"} - {formatCurrency(item.price)}</Text>
          </View>
        </View>
        <View style={styles.historyRight}>
          <Text style={styles.historyTime}>{item.appointment_date}</Text>
          <Text style={[styles.historyStatus, { color: isDone ? colors.success : colors.error }]}>
            {isDone ? "Completed" : "Cancelled"}
          </Text>
        </View>
      </View>
    );
  };

  const renderUpcomingCard = (item) => (
    <View key={item.id} style={styles.historyCard}>
      <View style={styles.historyLeft}>
        {getClientAvatarUri(item) ? (
          <Image source={{ uri: getClientAvatarUri(item) }} style={styles.historyAvatar} />
        ) : (
          <View style={styles.historyAvatarFallback}>
            <Icon name="person" size={16} color={colors.textMuted} />
          </View>
        )}
        <View>
          <Text style={styles.historyName}>{item.profiles?.full_name || "Client"}</Text>
          <Text style={styles.historySub}>{item.service_name || "Service"} - {formatCurrency(item.price)}</Text>
        </View>
      </View>
      <View style={styles.historyRight}>
        <Text style={styles.historyTime}>{item.appointment_date}</Text>
        <Text style={[styles.historyStatus, { color: colors.accent }]}>{formatTime(item.appointment_time)}</Text>
      </View>
    </View>
  );

  const renderNeedsCompletionCard = (item) => (
    <View key={item.id} style={styles.completionCard}>
      <View style={styles.completionLeft}>
        {getClientAvatarUri(item) ? (
          <Image source={{ uri: getClientAvatarUri(item) }} style={styles.historyAvatar} />
        ) : (
          <View style={styles.historyAvatarFallback}>
            <Icon name="person" size={16} color={colors.textMuted} />
          </View>
        )}
        <View>
          <Text style={styles.historyName}>{item.profiles?.full_name || "Client"}</Text>
          <Text style={styles.historySub}>
            {item.service_name || "Service"} - {formatCurrency(item.price)}
          </Text>
          <Text style={styles.completionMeta}>
            {item.appointment_date} at {formatTime(item.appointment_time)}
          </Text>
        </View>
      </View>
      <TouchableOpacity style={styles.completeBtn} onPress={() => updateStatus(item.id, "completed", item.status)}>
        <Icon name="checkmark-done" size={16} color="#fff" />
        <Text style={styles.completeBtnText}>Complete</Text>
      </TouchableOpacity>
    </View>
  );

  if (loading && bookings.length === 0) {
    return (
      <View style={styles.loadingWrap}>
        <ActivityIndicator size="large" color={colors.accent} />
      </View>
    );
  }

  return (
    <View style={styles.screen}>
      <ScrollView
        style={styles.container}
        contentContainerStyle={[styles.content, { paddingTop: Math.max(insets.top, 24) + 44 }]}
        bounces={false}
        overScrollMode="never"
        refreshControl={
          <RefreshControl
            refreshing={loading}
            tintColor={colors.accent}
            colors={[colors.accent]}
            onRefresh={async () => {
              const { data: { user } } = await supabase.auth.getUser();
              if (user) fetchBarberBookings(user.id);
            }}
          />
        }
      >
        <Text style={styles.screenTitle}>Bookings</Text>

        <View style={styles.summaryCard}>
          <View style={styles.summaryItem}>
            <View style={styles.summaryIconBadge}>
              <Icon name="calendar-outline" size={16} color={colors.accent} />
            </View>
            <Text style={styles.summaryValue}>{todaysBookings.length}</Text>
            <Text style={styles.summaryLabel}>Today's Bookings</Text>
          </View>
          <View style={styles.summaryItem}>
            <View style={styles.summaryIconBadge}>
              <Icon name="alert-circle-outline" size={16} color={colors.accent} />
            </View>
            <Text style={styles.summaryValue}>{todaysPending.length}</Text>
            <Text style={styles.summaryLabel}>Pending Requests</Text>
          </View>
        </View>

        <View style={styles.segmentWrap}>
          <TouchableOpacity
            style={[styles.segmentBtn, activeTab === "active" && styles.segmentBtnActive]}
            onPress={() => setActiveTab("active")}
          >
            <Text style={[styles.segmentText, activeTab === "active" && styles.segmentTextActive]}>
              Active Bookings
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.segmentBtn, activeTab === "history" && styles.segmentBtnActive]}
            onPress={() => setActiveTab("history")}
          >
            <Text style={[styles.segmentText, activeTab === "history" && styles.segmentTextActive]}>
              Booking History
            </Text>
          </TouchableOpacity>
        </View>

        {activeTab === "active" ? (
          subscriptionLoading ? (
            <View style={styles.emptyCard}>
              <Text style={styles.emptyText}>Checking subscription...</Text>
            </View>
          ) : activeTabAllClear ? (
            <View style={styles.emptyCard}>
              <Icon name="checkmark-done-circle-outline" size={22} color={colors.textMuted} />
              <Text style={[styles.emptyText, { marginTop: 8 }]}>
                You're all caught up — no pending requests or upcoming work.
              </Text>
            </View>
          ) : (
            <>
              {subscriptionLocked ? (
                <>
                  <Text style={styles.sectionTitle}>Needs Action</Text>
                  <View style={styles.lockedBanner}>
                    <View style={styles.lockedBannerRow}>
                      <Icon name="lock-closed-outline" size={18} color={colors.accent} />
                      <Text style={styles.lockedBannerText}>
                        {trialFinished
                          ? "Trial finished. Pay R70/month subscription to continue receiving booking requests."
                          : "Activate subscription to receive new booking requests."}
                      </Text>
                    </View>
                    <TouchableOpacity
                      style={styles.lockedBannerBtn}
                      onPress={() => navigation.navigate("SubscriptionPaywall")}
                      activeOpacity={0.85}
                    >
                      <Text style={styles.lockedBannerBtnText}>Upgrade</Text>
                    </TouchableOpacity>
                  </View>
                </>
              ) : hasPendingToShow ? (
                <>
                  <Text style={styles.sectionTitle}>Needs Action</Text>
                  {categorized.pending.map(renderActionCard)}
                </>
              ) : null}

              {hasNextAppointment ? (
                <>
                  <Text style={styles.sectionTitle}>Upcoming Appointments</Text>
                  <View style={styles.nextCard}>
                    <View style={styles.nextTopRow}>
                      <Text style={styles.nextClient}>{nextAppointment.profiles?.full_name || "Client"}</Text>
                      <Text style={styles.nextPrice}>{formatCurrency(nextAppointment.price)}</Text>
                    </View>
                    <Text style={styles.nextService}>{nextAppointment.service_name || "Service"}</Text>
                    <Text style={styles.nextMeta}>
                      {nextAppointment.appointment_date} at {formatTime(nextAppointment.appointment_time)}
                    </Text>
                    <View style={styles.timelineWrap}>
                      <View style={styles.timelineLine} />
                      <Text style={styles.timelineText}>
                        {minutesUntilNext !== null
                          ? formatTimeUntil(minutesUntilNext)
                          : "upcoming today"}
                      </Text>
                    </View>
                  </View>
                  {laterAppointments.map(renderUpcomingCard)}
                </>
              ) : null}

              {hasNeedsCompletion ? (
                <>
                  <Text style={styles.sectionTitle}>Needs Completion</Text>
                  {categorized.needsCompletion.map(renderNeedsCompletionCard)}
                </>
              ) : null}
            </>
          )
        ) : (
          <>
            <Text style={styles.sectionTitle}>Booking History</Text>
            {sectionsToRender.length > 0 ? (
              sectionsToRender.flatMap((section) => section.data).map(renderHistoryCard)
            ) : (
              <View style={styles.emptyCard}>
                <Text style={styles.emptyText}>No booking history yet.</Text>
              </View>
            )}
          </>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  container: { flex: 1, backgroundColor: colors.background },
  content: { padding: 16, paddingBottom: 34 },
  loadingWrap: { flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: colors.background },
  screenTitle: { fontSize: 24, fontWeight: "800", color: colors.text, marginBottom: 14 },
  summaryCard: {
    flexDirection: "row",
    gap: 10,
    marginBottom: 14,
  },
  summaryItem: {
    flex: 1,
    backgroundColor: colors.surface,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 12,
    paddingVertical: 12,
    ...shadows.card,
  },
  summaryIconBadge: {
    width: 30, height: 30, borderRadius: 15, backgroundColor: colors.accentSoft,
    alignItems: "center", justifyContent: "center", marginBottom: 8,
  },
  summaryLabel: { color: colors.textSecondary, fontSize: 12, fontWeight: "700", marginTop: 2 },
  summaryValue: { color: colors.text, fontSize: 20, fontWeight: "900" },
  segmentWrap: {
    flexDirection: "row",
    backgroundColor: colors.surfaceMuted,
    borderRadius: 999,
    padding: 4,
    marginBottom: 18,
  },
  segmentBtn: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 10,
    borderRadius: 999,
  },
  segmentBtnActive: { backgroundColor: colors.accent },
  segmentText: { fontSize: 13, fontWeight: "700", color: colors.textSecondary },
  segmentTextActive: { color: colors.accentText },
  sectionTitle: { fontSize: 16, fontWeight: "800", color: colors.text, marginBottom: 10 },
  requestCard: {
    backgroundColor: colors.surface,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 14,
    marginBottom: 12,
    flexDirection: "row",
    justifyContent: "space-between",
    ...shadows.card,
  },
  requestMain: { flexDirection: "row", flex: 1, marginRight: 12 },
  requestAvatar: { width: 48, height: 48, borderRadius: 24, backgroundColor: colors.surfaceMuted },
  requestAvatarFallback: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: colors.surfaceMuted,
    alignItems: "center",
    justifyContent: "center",
  },
  requestInfo: { flex: 1, marginLeft: 10 },
  requestName: { fontSize: 16, fontWeight: "800", color: colors.text },
  requestService: { marginTop: 3, fontSize: 13, color: colors.textSecondary, fontWeight: "600" },
  requestTime: { marginTop: 4, fontSize: 13, color: colors.textMuted, fontWeight: "700" },
  pendingPill: {
    alignSelf: "flex-start",
    marginTop: 8,
    backgroundColor: colors.pendingBg,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  pendingPillText: { color: colors.pending, fontSize: 11, fontWeight: "800" },
  fabColumn: { justifyContent: "center", gap: 10 },
  fabBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
    ...shadows.button,
  },
  acceptFab: { backgroundColor: colors.success },
  declineFab: { backgroundColor: colors.error },
  nextCard: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 16,
    padding: 14,
    marginBottom: 10,
    ...shadows.card,
  },
  nextTopRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  nextClient: { fontSize: 17, fontWeight: "800", color: colors.text },
  nextPrice: { fontSize: 16, fontWeight: "900", color: colors.accent },
  nextService: { marginTop: 4, fontSize: 13, color: colors.textSecondary, fontWeight: "600" },
  nextMeta: { marginTop: 4, fontSize: 13, color: colors.textMuted, fontWeight: "700" },
  timelineWrap: { marginTop: 10 },
  timelineLine: { height: 2, borderRadius: 999, backgroundColor: colors.success, marginBottom: 6 },
  timelineText: { fontSize: 12, color: colors.accent, fontWeight: "700" },
  historyCard: {
    backgroundColor: colors.surface,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 12,
    marginBottom: 10,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  historyLeft: { flexDirection: "row", alignItems: "center", flex: 1 },
  historyAvatar: { width: 40, height: 40, borderRadius: 20, backgroundColor: colors.surfaceMuted, marginRight: 10 },
  historyAvatarFallback: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.surfaceMuted,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 10,
  },
  historyName: { fontSize: 15, fontWeight: "800", color: colors.text },
  historySub: { fontSize: 13, color: colors.textSecondary, marginTop: 2 },
  historyRight: { alignItems: "flex-end", marginLeft: 10 },
  historyTime: { fontSize: 13, color: colors.textMuted, fontWeight: "700", marginBottom: 4 },
  historyStatus: { fontSize: 12, fontWeight: "800" },
  completionCard: {
    backgroundColor: colors.surface,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 12,
    marginBottom: 10,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  completionLeft: { flexDirection: "row", alignItems: "center", flex: 1, marginRight: 10 },
  completionMeta: { fontSize: 13, color: colors.textMuted, fontWeight: "700", marginTop: 3 },
  completeBtn: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.accent,
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 999,
  },
  completeBtnText: { marginLeft: 4, color: colors.accentText, fontSize: 12, fontWeight: "800" },
  emptyCard: {
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    marginBottom: 10,
  },
  emptyText: { color: colors.textMuted, fontSize: 14, fontWeight: "600" },
  lockedBanner: {
    backgroundColor: colors.accentSoft,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 14,
    marginBottom: 12,
  },
  lockedBannerRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  lockedBannerText: { color: colors.text, fontWeight: "800", flex: 1 },
  lockedBannerBtn: {
    marginTop: 12,
    backgroundColor: colors.accent,
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: "center",
  },
  lockedBannerBtnText: { color: colors.accentText, fontWeight: "900" },
});
