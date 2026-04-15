import * as Notifications from "expo-notifications";
import { useFocusEffect } from "@react-navigation/native";
import React, { useCallback, useEffect, useMemo, useState } from "react";
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
import { LinearGradient } from "expo-linear-gradient";
import { colors } from "../../theme/clientTheme";
import { supabase } from "../../supabase/supabaseClient";
import { resolveStorageImageUrl } from "../../utils/storageImageUrl";
import { ensureBarberSubscriptionState, getTrialRemaining, isSubscriptionEligible } from "../../utils/subscriptionState";

export default function Appointments({ navigation }) {
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
  const trialFinished =
    subscriptionState?.status === "trial" &&
    getTrialRemaining(subscriptionState) <= 0;

  const sendLocalNotification = async (title, body) => {
    try {
      await Notifications.scheduleNotificationAsync({
        content: { title, body, sound: "default" },
        trigger: null,
      });
    } catch (error) {
      console.log("Notification schedule error:", error?.message);
    }
  };

  const loadSubscription = useCallback(async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      setBarberId(user.id);
      const state = await ensureBarberSubscriptionState(user.id);
      setSubscriptionState(state);
    } catch (e) {
      console.warn("Subscription state load failed:", e?.message);
      setSubscriptionState(null);
    } finally {
      setSubscriptionLoading(false);
    }
  }, []);

  useEffect(() => {
    loadSubscription();
  }, [loadSubscription]);

  useFocusEffect(
    useCallback(() => {
      loadSubscription();
    }, [loadSubscription])
  );


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
      const isAcceptAction =
        (newLower === "confirmed" || newLower === "accepted" || newLower === "approved") &&
        (prevLower === "pending" || prevLower === "requested");

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

      // Trial credit: RPC only increments when DB status is 'trial'. Refetch fixes stale React state after PayFast/ITN.
      if (isAcceptAction && barberId) {
        const { error: rpcErr } = await supabase.rpc("increment_trial_booking_used", {
          p_barber_id: barberId,
        });
        if (rpcErr) console.warn("increment_trial_booking_used:", rpcErr.message);
        const { data: fresh } = await supabase
          .from("barber_subscription_state")
          .select("*")
          .eq("barber_id", barberId)
          .maybeSingle();
        if (fresh) setSubscriptionState(fresh);
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
  const weekEnd = new Date();
  weekEnd.setDate(weekEnd.getDate() + 7);
  weekEnd.setHours(23, 59, 59, 999);

  const upcomingWeek = categorized.futureConfirmed.filter((b) => {
    const ts = getBookingTimestamp(b);
    return ts > Date.now() && ts <= weekEnd.getTime();
  });
  const nextAppointment = upcomingWeek[0] || null;

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

  const greeting = useMemo(() => {
    const hour = new Date().getHours();
    if (hour < 12) return "Good Morning";
    if (hour < 18) return "Good Afternoon";
    return "Good Evening";
  }, []);

  const renderActionCard = (item) => (
    <View key={item.id} style={styles.requestCard}>
      <View style={styles.requestMain}>
        {getClientAvatarUri(item) ? (
          <Image source={{ uri: getClientAvatarUri(item) }} style={styles.requestAvatar} />
        ) : (
          <View style={styles.requestAvatarFallback}>
            <Icon name="person" size={18} color="#7c8598" />
          </View>
        )}

        <View style={styles.requestInfo}>
          <Text style={styles.requestName}>{item.profiles?.full_name || "New Client"}</Text>
          <Text style={styles.requestService}>
            {item.service_name || "Service"} - {formatCurrency(item.price)}
          </Text>
          <Text style={styles.requestTime}>
            <Icon name="time-outline" size={13} color="#6b7280" /> {item.appointment_date} at {formatTime(item.appointment_time)}
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
              <Icon name="person" size={16} color="#7c8598" />
            </View>
          )}
          <View>
            <Text style={styles.historyName}>{item.profiles?.full_name || "Client"}</Text>
            <Text style={styles.historySub}>{item.service_name || "Service"} - {formatCurrency(item.price)}</Text>
          </View>
        </View>
        <View style={styles.historyRight}>
          <Text style={styles.historyTime}>{item.appointment_date}</Text>
          <Text style={[styles.historyStatus, { color: isDone ? "#16a34a" : "#dc2626" }]}>
            {isDone ? "Completed" : "Cancelled"}
          </Text>
        </View>
      </View>
    );
  };

  const renderNeedsCompletionCard = (item) => (
    <View key={item.id} style={styles.completionCard}>
      <View style={styles.completionLeft}>
        {getClientAvatarUri(item) ? (
          <Image source={{ uri: getClientAvatarUri(item) }} style={styles.historyAvatar} />
        ) : (
          <View style={styles.historyAvatarFallback}>
            <Icon name="person" size={16} color="#7c8598" />
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
        <ActivityIndicator size="large" color="#111827" />
      </View>
    );
  }

  return (
    <View style={styles.screen}>
      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl
            refreshing={loading}
            onRefresh={async () => {
              const { data: { user } } = await supabase.auth.getUser();
              if (user) {
                await loadSubscription();
                await fetchBarberBookings(user.id);
              }
            }}
          />
        }
      >
        <Text style={styles.greeting}>{`${greeting}, ${shopName} 💈`}</Text>

        {trialRemainingCount !== null && trialRemainingCount > 0 ? (
          <View style={styles.trialBanner}>
            <Icon name="gift-outline" size={16} color={colors.accent} />
            <Text style={styles.trialBannerText}>
              Free trial: {trialRemainingCount} accepted booking{trialRemainingCount === 1 ? "" : "s"} left (of 5)
            </Text>
          </View>
        ) : null}

        <LinearGradient colors={["#0A0A0A", "#2a1f15"]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.summaryCard}>
          <Text style={styles.summaryTitle}>Daily Overview</Text>
          <View style={styles.summaryGrid}>
            <View style={styles.summaryItem}>
              <Icon name="calendar-outline" size={16} color={colors.accent} />
              <Text style={styles.summaryLabel}>Today's Bookings</Text>
              <Text style={styles.summaryValue}>{todaysBookings.length}</Text>
            </View>
            <View style={styles.summaryItem}>
              <Icon name="alert-circle-outline" size={16} color={colors.accent} />
              <Text style={styles.summaryLabel}>Pending Requests</Text>
              <Text style={styles.summaryValue}>{todaysPending.length}</Text>
            </View>
          </View>
        </LinearGradient>

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
          <>
            <Text style={styles.sectionTitle}>Needs Action</Text>
            {subscriptionLoading ? (
              <View style={styles.emptyCard}>
                <Text style={styles.emptyText}>Checking subscription...</Text>
              </View>
            ) : subscriptionKnown ? (
              subscriptionEligible ? (
                categorized.pending.length > 0 ? (
                  categorized.pending.map(renderActionCard)
                ) : (
                  <View style={styles.emptyCard}>
                    <Text style={styles.emptyText}>No pending booking requests right now.</Text>
                  </View>
                )
              ) : (
                <View style={styles.lockedBanner}>
                  <View style={styles.lockedBannerRow}>
                    <Icon name="lock-closed-outline" size={18} color={colors.accent} />
                    <Text style={styles.lockedBannerText}>
                      {trialFinished
                        ? "Trial finished. Pay R100 subscription to continue receiving booking requests."
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
              )
            ) : categorized.pending.length > 0 ? (
              categorized.pending.map(renderActionCard)
            ) : (
              <View style={styles.emptyCard}>
                <Text style={styles.emptyText}>No pending booking requests right now.</Text>
              </View>
            )}

            <Text style={styles.sectionTitle}>Next Appointment</Text>
            {nextAppointment ? (
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
            ) : (
              <View style={styles.emptyCard}>
                <Text style={styles.emptyText}>No upcoming appointments this week.</Text>
              </View>
            )}

            <Text style={styles.sectionTitle}>Needs Completion</Text>
            {categorized.needsCompletion.length > 0 ? (
              categorized.needsCompletion.map(renderNeedsCompletionCard)
            ) : (
              <View style={styles.emptyCard}>
                <Text style={styles.emptyText}>No completed confirmations to wrap up.</Text>
              </View>
            )}
          </>
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
  greeting: { fontSize: 28, fontWeight: "800", color: "#C5A070", marginBottom: 14 },
  trialBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    backgroundColor: "rgba(197,160,112,0.1)",
    borderWidth: 1,
    borderColor: "rgba(197,160,112,0.35)",
    borderRadius: 14,
    paddingVertical: 10,
    paddingHorizontal: 12,
    marginBottom: 12,
  },
  trialBannerText: { color: "#F5F5F0", fontSize: 13, fontWeight: "800", flex: 1 },
  summaryCard: {
    borderRadius: 22,
    padding: 16,
    marginBottom: 14,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.2,
    shadowRadius: 12,
    elevation: 4,
  },
  summaryTitle: { color: "#C5A070", fontSize: 13, fontWeight: "700", marginBottom: 10 },
  summaryGrid: { gap: 10 },
  summaryItem: {
    backgroundColor: "rgba(255,255,255,0.03)",
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "rgba(197,160,112,0.25)",
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  summaryLabel: { color: "#F5F5F0", fontSize: 12, fontWeight: "600", marginTop: 4 },
  summaryValue: { color: "#F5F5F0", fontSize: 22, fontWeight: "800", marginTop: 2 },
  segmentWrap: {
    flexDirection: "row",
    backgroundColor: "rgba(255,255,255,0.03)",
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "rgba(117,117,117,0.35)",
    padding: 4,
    marginBottom: 18,
  },
  segmentBtn: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 10,
    borderRadius: 11,
  },
  segmentBtnActive: { backgroundColor: "#0A0A0A", borderWidth: 1, borderColor: "rgba(197,160,112,0.6)" },
  segmentText: { fontSize: 13, fontWeight: "700", color: "#757575" },
  segmentTextActive: { color: "#C5A070" },
  sectionTitle: { fontSize: 18, fontWeight: "800", color: colors.accent, marginBottom: 10 },
  requestCard: {
    backgroundColor: "rgba(255,255,255,0.03)",
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "rgba(197,160,112,0.25)",
    padding: 14,
    marginBottom: 12,
    flexDirection: "row",
    justifyContent: "space-between",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.07,
    shadowRadius: 10,
    elevation: 2,
  },
  requestMain: { flexDirection: "row", flex: 1, marginRight: 12 },
  requestAvatar: { width: 48, height: 48, borderRadius: 24, backgroundColor: "#1f2937" },
  requestAvatarFallback: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: "#0b0b10",
    alignItems: "center",
    justifyContent: "center",
  },
  requestInfo: { flex: 1, marginLeft: 10 },
  requestName: { fontSize: 17, fontWeight: "800", color: "#F5F5F0" },
  requestService: { marginTop: 3, fontSize: 14, color: "#F5F5F0", fontWeight: "600" },
  requestTime: { marginTop: 4, fontSize: 14, color: "#F5F5F0", fontWeight: "700" },
  pendingPill: {
    alignSelf: "flex-start",
    marginTop: 8,
    backgroundColor: "rgba(197,160,112,0.12)",
    borderWidth: 1,
    borderColor: "#C5A070",
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  pendingPillText: { color: "#C5A070", fontSize: 11, fontWeight: "800" },
  fabColumn: { justifyContent: "center", gap: 10 },
  fabBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#111827",
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.15,
    shadowRadius: 6,
    elevation: 2,
  },
  acceptFab: { backgroundColor: "#22C55E" },
  declineFab: { backgroundColor: "#FF3B30" },
  nextCard: {
    backgroundColor: "rgba(255,255,255,0.03)",
    borderWidth: 1,
    borderColor: "rgba(197,160,112,0.25)",
    borderRadius: 18,
    padding: 14,
    marginBottom: 10,
  },
  nextTopRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  nextClient: { fontSize: 18, fontWeight: "800", color: "#F5F5F0" },
  nextPrice: { fontSize: 17, fontWeight: "900", color: "#C5A070" },
  nextService: { marginTop: 4, fontSize: 14, color: "#F5F5F0", fontWeight: "600" },
  nextMeta: { marginTop: 4, fontSize: 14, color: "#F5F5F0", fontWeight: "700" },
  timelineWrap: { marginTop: 10 },
  timelineLine: { height: 2, borderRadius: 999, backgroundColor: "#22c55e", marginBottom: 6 },
  timelineText: { fontSize: 12, color: "#C5A070", fontWeight: "700" },
  historyCard: {
    backgroundColor: "rgba(255,255,255,0.03)",
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "rgba(117,117,117,0.35)",
    padding: 12,
    marginBottom: 10,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  historyLeft: { flexDirection: "row", alignItems: "center", flex: 1 },
  historyAvatar: { width: 40, height: 40, borderRadius: 20, backgroundColor: "#1f2937", marginRight: 10 },
  historyAvatarFallback: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "#0b0b10",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 10,
  },
  historyName: { fontSize: 15, fontWeight: "800", color: "#F5F5F0" },
  historySub: { fontSize: 13, color: "#F5F5F0", marginTop: 2 },
  historyRight: { alignItems: "flex-end", marginLeft: 10 },
  historyTime: { fontSize: 13, color: "#F5F5F0", fontWeight: "700", marginBottom: 4 },
  historyStatus: { fontSize: 12, fontWeight: "800" },
  completionCard: {
    backgroundColor: "rgba(255,255,255,0.03)",
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "rgba(117,117,117,0.35)",
    padding: 12,
    marginBottom: 10,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  completionLeft: { flexDirection: "row", alignItems: "center", flex: 1, marginRight: 10 },
  completionMeta: { fontSize: 13, color: "#F5F5F0", fontWeight: "700", marginTop: 3 },
  completeBtn: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#0f172a",
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 999,
  },
  completeBtnText: { marginLeft: 4, color: "#fff", fontSize: 12, fontWeight: "800" },
  emptyCard: {
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: "rgba(117,117,117,0.35)",
    backgroundColor: "rgba(255,255,255,0.03)",
    marginBottom: 10,
  },
  emptyText: { color: "#F5F5F0", fontSize: 14, fontWeight: "600" },
  lockedBanner: {
    backgroundColor: "rgba(255,255,255,0.03)",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "rgba(197,160,112,0.3)",
    padding: 14,
    marginBottom: 12,
  },
  lockedBannerRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  lockedBannerText: { color: "#F5F5F0", fontWeight: "800", flex: 1 },
  lockedBannerBtn: {
    marginTop: 12,
    backgroundColor: colors.accent,
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.12)",
  },
  lockedBannerBtnText: { color: "#0A0A0A", fontWeight: "900" },
});