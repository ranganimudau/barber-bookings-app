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
import { useLightStatusBar } from "../../hooks/useLightStatusBar";
import { supabase } from "../../supabase/supabaseClient";
import { colors, borderRadius, shadows, typography } from "../../theme/barberTheme";

export default function MyBookings({ navigation }) {
  useLightStatusBar(colors.background);
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

  const STATUS_LABELS = {
    pending: "Pending",
    confirmed: "Confirmed",
    completed: "Completed",
    cancelled: "Cancelled",
    declined: "Declined",
    no_show: "No-show",
    expired: "Expired",
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

  const cancelBooking = async (item) => {
    // 48h no longer blocks cancelling outright — it was leaving businesses
    // holding a dead slot when a client already knew they couldn't make it.
    // A cancel inside that window is still recorded (is_late_cancel) so the
    // business can see the pattern instead of the slot just vanishing.
    const isLate = !canRescheduleWithin48h(item);
    const message = isLate
      ? "This is within 48 hours of your appointment. Cancelling now will be recorded as a late cancellation, visible to the business. Continue?"
      : "Are you sure you want to cancel?";

    Alert.alert("Cancel Appointment", message, [
      { text: "No" },
      {
        text: isLate ? "Yes, cancel (late)" : "Yes, Cancel",
        style: isLate ? "destructive" : "default",
        onPress: async () => {
          const { error } = await supabase
            .from("appointments")
            .update({ status: "cancelled", is_late_cancel: isLate })
            .eq("id", item.id);

          if (!error) {
            Alert.alert("Cancelled", "Your appointment has been removed.");
            fetchMyBookings();
          }
        }
      }
    ]);
  };

  const deriveDisplayStatus = (item) => {
    if (item.status === "cancelled") return "cancelled";
    if (item.status === "declined") return "declined";
    if (item.status === "no_show") return "no_show";
    if (item.status === "completed") return "completed";
    if (item.status === "expired") return "expired";
    // Never answered and the slot has been and gone. Shown straight away
    // rather than waiting for the hourly server sweep to relabel it — and
    // emphatically not as "Completed", which is what this used to claim
    // about a visit that never happened.
    if (item.status === "pending" && isAppointmentPast(item)) return "expired";
    // Cosmetic only: a confirmed booking whose time has passed reads as
    // "Completed" so it doesn't sit in Upcoming forever, but this alone
    // never unlocks rating — see canRate below.
    if (item.status === "confirmed" && isAppointmentPast(item)) return "completed";
    return item.status || "pending";
  };

  const getStatusStyle = (status) => {
    if (status === "confirmed") return [styles.statusBadge, styles.statusConfirmed];
    if (status === "completed") return [styles.statusBadge, styles.statusCompleted];
    // Expired is nobody's fault and not an error — keep it neutral rather
    // than alarming red.
    if (status === "expired") return [styles.statusBadge, styles.statusExpired];
    if (status === "cancelled" || status === "declined" || status === "no_show") {
      return [styles.statusBadge, styles.statusCancelled];
    }
    // pending / approved (default)
    return [styles.statusBadge, styles.statusPending];
  };
  const getStatusTextColor = (status) => {
    if (status === "confirmed") return colors.success;
    if (status === "completed") return colors.pending;
    if (status === "expired") return colors.textMuted;
    if (status === "cancelled" || status === "declined" || status === "no_show") return colors.error;
    return colors.pending;
  };

  const renderItem = ({ item }) => {
    const derivedStatus = deriveDisplayStatus(item);
    const isActive = ["confirmed", "pending"].includes(derivedStatus);
    const canReschedule = isActive && canRescheduleWithin48h(item);
    const canCancel = isActive;
    const isRescheduleLocked = isActive && !canReschedule;

    // Only a business-confirmed "completed" unlocks rating — the cosmetic
    // time-based "completed" label above doesn't, so a no-show (or a visit
    // the business simply hasn't closed out yet) can't be rated.
    const canRate = item.status === "completed";
    const hasRated = item.rating != null;
    const statusLabel =
      (STATUS_LABELS[derivedStatus] || derivedStatus) +
      (derivedStatus === "cancelled" && item.is_late_cancel ? " (late)" : "");

    return (
      <View style={styles.card}>
        <View style={styles.header}>
          <View style={styles.shopRow}>
            <View style={styles.shopIconWrap}>
              <Icon name="cut" size={20} color={colors.accent} />
            </View>
            <Text style={styles.shopName}>{item.barbers?.shop_name || "Business"}</Text>
          </View>
          <View style={getStatusStyle(derivedStatus)}>
            <Text style={[styles.statusText, { color: getStatusTextColor(derivedStatus) }]}>{statusLabel}</Text>
          </View>
        </View>

        <View style={styles.detailRow}>
          <Icon name="pricetag-outline" size={16} color={colors.textSecondary} />
          <Text style={styles.detail}>{item.service_name} — R{item.price}</Text>
        </View>
        <View style={styles.detailRow}>
          <Icon name="calendar-outline" size={16} color={colors.textSecondary} />
          <Text style={styles.time}>
            {item.appointment_date} at {item.appointment_time?.substring(0, 5)}
          </Text>
        </View>

        {derivedStatus === "expired" && (
          <View style={styles.expiredRow}>
            <Icon name="alert-circle-outline" size={15} color={colors.textMuted} />
            <Text style={styles.expiredText}>
              The business didn&apos;t respond in time. You weren&apos;t charged — try booking again.
            </Text>
          </View>
        )}

        {(derivedStatus === "completed" || derivedStatus === "expired") && (
          <View style={derivedStatus === "expired" ? styles.rebookRow : styles.ratingRow}>
            {canRate && (
              hasRated ? (
                <View style={styles.ratedBadge}>
                  <Icon name="star" size={16} color={colors.pending} />
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
              )
            )}
            <TouchableOpacity
              style={styles.bookAgainBtn}
              onPress={() =>
                navigation.navigate("Find", {
                  screen: "BarberProfile",
                  params: { barberId: item.barber_id, prefillServiceName: item.service_name },
                })
              }
              activeOpacity={0.8}
            >
              <Icon name="repeat" size={16} color={colors.accent} />
              <Text style={styles.bookAgainText}>
                {derivedStatus === "expired" ? "Try again" : "Book again"}
              </Text>
            </TouchableOpacity>
          </View>
        )}

        {isRescheduleLocked && (
          <View style={styles.lockRow}>
            <Icon name="lock-closed" size={14} color={colors.textMuted} />
            <Text style={styles.lockText}>Rescheduling locked within 48h — you can still cancel below</Text>
          </View>
        )}
        {canCancel && (
          <View style={styles.actionRow}>
            {canReschedule && (
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
                <Icon name="time-outline" size={18} color={colors.accentText} />
                <Text style={styles.btnText}>Reschedule</Text>
              </TouchableOpacity>
            )}
            <TouchableOpacity
              style={styles.cancelBtn}
              onPress={() => cancelBooking(item)}
              activeOpacity={0.8}
            >
              <Icon name="close-circle-outline" size={18} color={colors.error} />
              <Text style={styles.cancelBtnText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>
    );
  };

  const filteredBookings = bookings.filter((b) => {
    const status = deriveDisplayStatus(b);
    if (activeFilter === "all") return true;
    if (activeFilter === "upcoming") return status === "pending" || status === "confirmed";
    if (activeFilter === "completed") return status === "completed";
    // Declined and no-show both mean "didn't happen, not the client's doing
    // to track separately" — grouped with Cancelled here, distinguished by
    // the badge label on each card.
    if (activeFilter === "cancelled") {
      return (
        status === "cancelled" ||
        status === "declined" ||
        status === "no_show" ||
        status === "expired"
      );
    }
    return true;
  });

  const FilterHeader = () => (
    <View style={styles.filterWrap}>
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
              style={[styles.filterChip, active && styles.filterChipActive]}
              onPress={() => setActiveFilter(t.id)}
              activeOpacity={0.85}
            >
              <Text style={[styles.filterChipText, active && styles.filterChipTextActive]}>
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
        <ActivityIndicator size="large" color={colors.accent} />
        <Text style={styles.loadingText}>Loading your bookings...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
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
  loadingText: { marginTop: 12, fontSize: 15, color: colors.textSecondary, fontWeight: "600" },
  card: {
    backgroundColor: colors.surface,
    padding: 16,
    borderRadius: borderRadius.xl,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: colors.border,
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
    backgroundColor: colors.accentSoft,
    borderWidth: 1,
    borderColor: colors.border,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  shopName: { ...typography.sectionHeader, color: colors.text, flex: 1, fontWeight: "800" },
  statusBadge: {
    paddingHorizontal: 11,
    paddingVertical: 6,
    borderRadius: borderRadius.full,
    borderWidth: 1,
  },
  statusConfirmed: { backgroundColor: colors.successBg, borderColor: colors.success },
  statusCompleted: { backgroundColor: colors.pendingBg, borderColor: colors.pending },
  statusPending: { backgroundColor: colors.pendingBg, borderColor: colors.pending },
  statusCancelled: { backgroundColor: colors.errorBg, borderColor: colors.error },
  statusExpired: { backgroundColor: colors.surfaceMuted, borderColor: colors.borderStrong },
  statusText: {
    fontSize: 12,
    fontWeight: '800',
  },
  detailRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 7 },
  detail: { fontSize: 14, color: colors.text, fontWeight: "700", flex: 1 },
  time: { fontSize: 13, color: colors.textSecondary, fontWeight: "600", flex: 1 },
  actionRow: { flexDirection: 'row', marginTop: 16, gap: 10 },
  editBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: colors.accent,
    paddingVertical: 12,
    borderRadius: borderRadius.md,
    flex: 1,
    ...shadows.button,
  },
  cancelBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: colors.errorBg,
    paddingVertical: 12,
    borderRadius: borderRadius.md,
    flex: 1,
    borderWidth: 1,
    borderColor: colors.error,
  },
  btnText: { color: colors.accentText, fontWeight: '800', fontSize: 14 },
  cancelBtnText: { color: colors.error, fontWeight: '800', fontSize: 14 },
  ratingRow: {
    marginTop: 14,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "center",
    gap: 10,
  },
  bookAgainBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    alignSelf: "flex-start",
    backgroundColor: "transparent",
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  bookAgainText: { fontSize: 14, fontWeight: "800", color: colors.accent },
  expiredRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 7,
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  expiredText: {
    flex: 1,
    fontSize: 12.5,
    color: colors.textMuted,
    lineHeight: 18,
    fontWeight: "600",
  },
  rebookRow: { marginTop: 12, flexDirection: "row", alignItems: "center" },
  rateBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    alignSelf: "flex-start",
    backgroundColor: colors.accentSoft,
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  rateBtnText: { fontSize: 14, fontWeight: "800", color: colors.accent },
  ratedBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  ratedText: { fontSize: 13, color: colors.textSecondary, fontWeight: "700" },
  lockRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 14,
    gap: 6,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  lockText: { fontSize: 12, color: colors.textMuted, fontStyle: 'italic', fontWeight: "600" },
  emptyWrap: {
    alignItems: 'center',
    paddingVertical: 72,
    paddingHorizontal: 32,
  },
  emptyIconWrap: {
    width: 88,
    height: 88,
    borderRadius: 44,
    backgroundColor: colors.accentSoft,
    borderWidth: 1,
    borderColor: colors.border,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  emptyTitle: { ...typography.sectionHeader, color: colors.text, marginBottom: 8, fontWeight: "800" },
  emptySubtitle: {
    fontSize: 14,
    color: colors.textSecondary,
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
    borderColor: colors.border,
    backgroundColor: colors.surface,
    borderRadius: 999,
    paddingVertical: 8,
    paddingHorizontal: 14,
  },
  filterChipActive: { backgroundColor: colors.accentSoft, borderColor: colors.accent },
  filterChipText: {
    fontSize: 12,
    fontWeight: "900",
    color: colors.textSecondary,
  },
  filterChipTextActive: { color: colors.accent },
});
