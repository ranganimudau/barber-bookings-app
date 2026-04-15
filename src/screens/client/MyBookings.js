import { useFocusEffect } from '@react-navigation/native';
import React, { useCallback, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Platform,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import Icon from "react-native-vector-icons/Ionicons";
import RateBarberModal from "../../components/client/RateBarberModal";
import { supabase } from "../../supabase/supabaseClient";
import { colors, borderRadius, shadows, typography } from "../../theme/clientTheme";
import { useClientThemeMode } from "../../theme/ClientThemeMode";

export default function MyBookings({ navigation }) {
  const { colors: themeColors } = useClientThemeMode();
  const [bookings, setBookings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [rateModalVisible, setRateModalVisible] = useState(false);
  const [ratingAppointment, setRatingAppointment] = useState(null);
  const [activeFilter, setActiveFilter] = useState("upcoming"); // upcoming | completed | cancelled | all

  const getAppointmentTimestamp = (item) => {
    const dateStr = item?.appointment_date;
    // Supabase may return `HH:MM:SS` or `HH:MM` depending on storage
    const rawTime = item?.appointment_time ? String(item.appointment_time) : "00:00";
    const time = rawTime.substring(0, 5); // HH:MM
    const parsed = new Date(`${dateStr}T${time}:00`);
    const ts = parsed.getTime();
    return Number.isFinite(ts) ? ts : 0;
  };

  const canRescheduleWithin48h = (item) => {
    const ts = getAppointmentTimestamp(item);
    if (!ts) return false;
    const now = Date.now();
    // Allow edit if appointment is at least 48h away
    return ts - now >= 48 * 60 * 60 * 1000;
  };

  useFocusEffect(
    useCallback(() => {
      fetchMyBookings();
    }, [])
  );

  const fetchMyBookings = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();

      const { data: appointmentsData, error: apptError } = await supabase
        .from("appointments")
        .select(`
          *,
          barbers!appointments_barber_id_fkey (shop_name, address)
        `)
        .eq("client_id", user.id)
        .order("appointment_date", { ascending: true });

      if (apptError) throw apptError;

      const { data: ratingsData } = await supabase
        .from("barber_ratings")
        .select("appointment_id, rating, comment")
        .eq("client_id", user.id);

      const ratingsByAppointment = {};
      (ratingsData || []).forEach((r) => {
        ratingsByAppointment[r.appointment_id] = { rating: r.rating, comment: r.comment };
      });

      const merged = (appointmentsData || []).map((a) => ({
        ...a,
        rating: ratingsByAppointment[a.id],
      }));
      const sorted = merged.sort((x, y) => getAppointmentTimestamp(x) - getAppointmentTimestamp(y));
      setBookings(sorted);
    } catch (error) {
      Alert.alert("Error", error.message);
    } finally {
      setLoading(false);
    }
  };

  const isAppointmentPast = (item) => {
    const ts = getAppointmentTimestamp(item);
    if (!ts) return false;
    const BUFFER_MINUTES = 45; // keep the same buffer you used before
    return Date.now() >= ts + BUFFER_MINUTES * 60 * 1000;
  };

  const handleSubmitRating = async ({ rating, comment }) => {
    if (!ratingAppointment) return;
    const { data: { user } } = await supabase.auth.getUser();
    const { error } = await supabase.from("barber_ratings").insert({
      appointment_id: ratingAppointment.id,
      barber_id: ratingAppointment.barber_id,
      client_id: user.id,
      rating,
      comment: comment || null,
    });
    if (error) throw error;
    await fetchMyBookings();
  };

  const cancelBooking = async (id) => {
    Alert.alert("Cancel Appointment", "Are you sure you want to cancel?", [
      { text: "No" },
      {
        text: "Yes, Cancel",
        onPress: async () => {
          const { error } = await supabase
            .from("appointments")
            .update({ status: 'cancelled' })
            .eq("id", id);

          if (!error) {
            Alert.alert("Cancelled", "Your appointment has been removed.");
            fetchMyBookings();
          }
        }
      }
    ]);
  };

  const deriveDisplayStatus = (item) => {
    // Treat "confirmed/pending + past" as completed for UI clarity.
    if (item.status === "cancelled") return "cancelled";
    if (item.status === "completed") return "completed";
    if ((item.status === "confirmed" || item.status === "pending") && isAppointmentPast(item)) {
      return "completed";
    }
    return item.status || "pending";
  };

  const getStatusStyle = (status) => {
    if (status === "confirmed") return [styles.statusBadge, styles.statusConfirmed];
    if (status === "completed") return [styles.statusBadge, styles.statusCompleted];
    if (status === "cancelled") return [styles.statusBadge, styles.statusCancelled];
    // pending / approved (default)
    return [styles.statusBadge, styles.statusPending];
  };
  const getStatusTextColor = (status) => {
    if (status === "confirmed") return colors.success;
    if (status === "completed") return colors.pending;
    if (status === "cancelled") return colors.error;
    return colors.pending;
  };

  const renderItem = ({ item }) => {
    const derivedStatus = deriveDisplayStatus(item);
    const canReschedule =
      ["confirmed", "pending"].includes(derivedStatus) && canRescheduleWithin48h(item);
    const isRescheduleLocked =
      ["confirmed", "pending"].includes(derivedStatus) && !canReschedule;

    const canRate = derivedStatus === "completed" && isAppointmentPast(item);
    const hasRated = item.rating != null;

    return (
      <View style={[styles.card, { backgroundColor: themeColors.surface, borderColor: themeColors.border }]}>
        <View style={styles.header}>
          <View style={styles.shopRow}>
            <View style={[styles.shopIconWrap, { backgroundColor: themeColors.accentSoft, borderColor: themeColors.border }]}>
              <Icon name="cut" size={20} color={colors.accent} />
            </View>
            <Text style={[styles.shopName, { color: themeColors.text }]}>{item.barbers?.shop_name || "Barber Shop"}</Text>
          </View>
          <View style={getStatusStyle(derivedStatus)}>
            <Text style={[styles.statusText, { color: getStatusTextColor(derivedStatus) }]}>{derivedStatus}</Text>
          </View>
        </View>

        <View style={styles.detailRow}>
          <Icon name="pricetag-outline" size={16} color={colors.textSecondary} />
          <Text style={[styles.detail, { color: themeColors.text }]}>{item.service_name} — R{item.price}</Text>
        </View>
        <View style={styles.detailRow}>
          <Icon name="calendar-outline" size={16} color={colors.textSecondary} />
          <Text style={[styles.time, { color: themeColors.textSecondary }]}>
            {item.appointment_date} at {item.appointment_time?.substring(0, 5)}
          </Text>
        </View>

        {canRate && (
          <View style={styles.ratingRow}>
            {hasRated ? (
              <View style={styles.ratedBadge}>
                <Icon name="star" size={16} color={colors.accent} />
                <Text style={styles.ratedText}>You rated {item.rating.rating} / 5</Text>
              </View>
            ) : (
              <TouchableOpacity
                style={styles.rateBtn}
                onPress={() => {
                  setRatingAppointment(item);
                  setRateModalVisible(true);
                }}
                activeOpacity={0.8}
              >
                <Icon name="star-outline" size={18} color={colors.accent} />
                <Text style={styles.rateBtnText}>Rate this visit</Text>
              </TouchableOpacity>
            )}
          </View>
        )}

        {canReschedule ? (
          <View style={styles.actionRow}>
            <TouchableOpacity
              style={styles.editBtn}
              onPress={() => {
                navigation.navigate("Find", {
                  screen: "BarberProfile",
                  params: {
                    barberId: item.barber_id,
                    editMode: true,
                    appointmentId: item.id,
                  },
                });
              }}
              activeOpacity={0.8}
            >
              <Icon name="time-outline" size={18} color={colors.white} />
              <Text style={styles.btnText}>Reschedule</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.cancelBtn}
              onPress={() => cancelBooking(item.id)}
              activeOpacity={0.8}
            >
              <Icon name="close-circle-outline" size={18} color={colors.white} />
              <Text style={styles.btnText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        ) : isRescheduleLocked ? (
          <View style={[styles.lockRow, { borderTopColor: themeColors.border }]}>
            <Icon name="lock-closed" size={14} color={colors.textMuted} />
            <Text style={[styles.lockText, { color: themeColors.textMuted }]}>Rescheduling locked within 48h of appointment</Text>
          </View>
        ) : null}
      </View>
    );
  };

  const filteredBookings = bookings.filter((b) => {
    const status = deriveDisplayStatus(b);
    if (activeFilter === "all") return true;
    if (activeFilter === "upcoming") {
      return status !== "cancelled" && status !== "completed";
    }
    if (activeFilter === "completed") return status === "completed";
    if (activeFilter === "cancelled") return status === "cancelled";
    return true;
  });

  const FilterHeader = () => (
    <View style={[styles.filterWrap, { backgroundColor: themeColors.background }]}>
      <View style={styles.filterRow}>
        {[
          { id: "upcoming", label: "Upcoming" },
          { id: "completed", label: "Completed" },
          { id: "cancelled", label: "Cancelled" },
          { id: "all", label: "All" },
        ].map((t) => {
          const active = activeFilter === t.id;
          return (
            <TouchableOpacity
              key={t.id}
              style={[
                styles.filterChip,
                {
                  backgroundColor: active ? themeColors.accentSoft : themeColors.surfaceAlt,
                  borderColor: active ? themeColors.border : themeColors.border,
                },
              ]}
              onPress={() => setActiveFilter(t.id)}
              activeOpacity={0.85}
            >
              <Text
                style={[
                  styles.filterChipText,
                  { color: active ? themeColors.text : themeColors.textSecondary },
                ]}
              >
                {t.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );

  const EmptyComponent = () => (
    <View style={styles.emptyWrap}>
      <View style={styles.emptyIconWrap}>
        <Icon name="calendar-outline" size={48} color={colors.textMuted} />
      </View>
      <Text style={styles.emptyTitle}>No appointments yet</Text>
      <Text style={styles.emptySubtitle}>Book a cut from the Find tab to see your appointments here.</Text>
    </View>
  );

  if (loading) {
    return (
      <View style={styles.loaderWrap}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={[styles.loadingText, { color: themeColors.textSecondary }]}>Loading your bookings...</Text>
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: themeColors.background }]}>
      <FlatList
        data={filteredBookings}
        keyExtractor={(item) => item.id}
        renderItem={renderItem}
        onRefresh={fetchMyBookings}
        refreshing={loading}
        contentContainerStyle={styles.listContent}
        ListEmptyComponent={EmptyComponent}
        showsVerticalScrollIndicator={false}
        ListHeaderComponent={FilterHeader}
      />
      <RateBarberModal
        visible={rateModalVisible}
        onClose={() => { setRateModalVisible(false); setRatingAppointment(null); }}
        appointment={ratingAppointment}
        onSubmit={handleSubmitRating}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  listContent: { paddingHorizontal: 16, paddingTop: 6, paddingBottom: 44 },
  loaderWrap: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.background,
  },
  loadingText: { marginTop: 12, fontSize: 15, color: "#D3D7E0", fontWeight: "700" },
  card: {
    backgroundColor: '#121216',
    padding: 16,
    borderRadius: borderRadius.xl,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: "rgba(197,160,112,0.26)",
    ...shadows.card,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  shopRow: { flexDirection: 'row', alignItems: 'center', flex: 1, minWidth: 0 },
  shopIconWrap: {
    width: 40,
    height: 40,
    borderRadius: borderRadius.sm,
    backgroundColor: "rgba(197,160,112,0.16)",
    borderWidth: 1,
    borderColor: "rgba(197,160,112,0.30)",
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  shopName: { ...typography.sectionHeader, color: "#F8F5F0", flex: 1, fontWeight: "800" },
  statusBadge: {
    paddingHorizontal: 11,
    paddingVertical: 6,
    borderRadius: borderRadius.full,
    borderWidth: 1,
  },
  statusConfirmed: { backgroundColor: "rgba(45,106,79,0.18)", borderColor: "rgba(45,106,79,0.45)" },
  statusCompleted: { backgroundColor: "rgba(212,175,55,0.14)", borderColor: "rgba(212,175,55,0.40)" },
  statusPending: { backgroundColor: "rgba(212,175,55,0.14)", borderColor: "rgba(212,175,55,0.40)" },
  statusCancelled: { backgroundColor: "rgba(193,18,31,0.13)", borderColor: "rgba(193,18,31,0.36)" },
  statusText: {
    fontSize: 12,
    fontWeight: '800',
    textTransform: 'capitalize',
  },
  detailRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 7 },
  detail: { fontSize: 14, color: "#F1F5F9", fontWeight: "700", flex: 1 },
  time: { fontSize: 13, color: "#D1C8BB", fontWeight: "600", flex: 1 },
  actionRow: { flexDirection: 'row', marginTop: 16, gap: 10 },
  editBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: "#0A0A0A",
    paddingVertical: 12,
    borderRadius: borderRadius.md,
    flex: 1,
    borderWidth: 1,
    borderColor: "rgba(197,160,112,0.38)",
    ...shadows.button,
  },
  cancelBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: "#8B1C1C",
    paddingVertical: 12,
    borderRadius: borderRadius.md,
    flex: 1,
    borderWidth: 1,
    borderColor: "rgba(255,112,112,0.35)",
  },
  btnText: { color: colors.white, fontWeight: '800', fontSize: 14 },
  ratingRow: { marginTop: 14, paddingTop: 12, borderTopWidth: 1, borderTopColor: "rgba(197,160,112,0.16)" },
  rateBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    alignSelf: "flex-start",
    backgroundColor: "rgba(197,160,112,0.14)",
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: "rgba(197,160,112,0.35)",
  },
  rateBtnText: { fontSize: 14, fontWeight: "800", color: "#E8C18A" },
  ratedBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  ratedText: { fontSize: 13, color: "#D3CABC", fontWeight: "700" },
  lockRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 14,
    gap: 6,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: "rgba(197,160,112,0.16)",
  },
  lockText: { fontSize: 12, color: "#B9AE9E", fontStyle: 'italic', fontWeight: "600" },
  emptyWrap: {
    alignItems: 'center',
    paddingVertical: 72,
    paddingHorizontal: 32,
  },
  emptyIconWrap: {
    width: 88,
    height: 88,
    borderRadius: 44,
    backgroundColor: "rgba(197,160,112,0.11)",
    borderWidth: 1,
    borderColor: "rgba(197,160,112,0.25)",
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  emptyTitle: { ...typography.sectionHeader, color: "#F8F5F0", marginBottom: 8, fontWeight: "800" },
  emptySubtitle: {
    fontSize: 14,
    color: "#CFC6B8",
    textAlign: 'center',
    lineHeight: 21,
    fontWeight: "600",
  },
  filterWrap: {
    paddingHorizontal: 0,
    paddingTop: 6,
    paddingBottom: 10,
  },
  filterRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
  },
  filterChip: {
    borderWidth: 1,
    borderRadius: 999,
    paddingVertical: 8,
    paddingHorizontal: 14,
  },
  filterChipText: {
    fontSize: 12,
    fontWeight: "900",
  },
});