import DateTimePicker from '@react-native-community/datetimepicker';
import React, { useEffect, useState } from 'react';
import { Alert, Platform, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Calendar } from 'react-native-calendars';
import Icon from 'react-native-vector-icons/Ionicons';
import { supabase } from '../../supabase/supabaseClient';
import { colors } from '../../theme/clientTheme';
import { ensureBarberSubscriptionState, isSubscriptionEligible } from '../../utils/subscriptionState';

export default function Availability({ navigation }) {
  const today = new Date().toISOString().split('T')[0]; // Get current date in YYYY-MM-DD format
  const [selectedDate, setSelectedDate] = useState('');
  const [loading, setLoading] = useState(false);
  const [markUnavailable, setMarkUnavailable] = useState(false);
  const [hasActiveBookings, setHasActiveBookings] = useState(false);
  const [activeBookingCount, setActiveBookingCount] = useState(0);

  const [subscriptionState, setSubscriptionState] = useState(null);
  const [subscriptionLoading, setSubscriptionLoading] = useState(true);

  const subscriptionEligible = isSubscriptionEligible(subscriptionState);
  const subscriptionLocked = !subscriptionLoading && subscriptionState && !subscriptionEligible;
  const showSubscriptionBanner = subscriptionLocked;

  useEffect(() => {
    const loadSubscription = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;
        const state = await ensureBarberSubscriptionState(user.id);
        setSubscriptionState(state);
      } catch (e) {
        // Dev fallback if subscription table isn't migrated yet.
        console.warn("Subscription state load failed:", e?.message);
        setSubscriptionState(null);
      } finally {
        setSubscriptionLoading(false);
      }
    };
    loadSubscription();
  }, []);
  
  // Initialize times as Date objects for the picker
  const [times, setTimes] = useState({
    opening: new Date(new Date().setHours(8, 0, 0, 0)),
    closing: new Date(new Date().setHours(17, 0, 0, 0)),
    lunchStart: new Date(new Date().setHours(13, 0, 0, 0)),
    lunchEnd: new Date(new Date().setHours(14, 0, 0, 0)),
  });
  
  const [showPicker, setShowPicker] = useState(null); 

  // Load existing specific settings for the selected day if they exist
  useEffect(() => {
    if (selectedDate) {
      fetchDayAvailability();
    }
  }, [selectedDate]);

  const fetchDayAvailability = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      const { data, error } = await supabase
        .from('barber_availability')
        .select('*')
        .eq('barber_id', user.id)
        .eq('available_date', selectedDate)
        .maybeSingle();

      const { data: dayAppointments, error: apptError } = await supabase
        .from('appointments')
        .select('id, status')
        .eq('barber_id', user.id)
        .eq('appointment_date', selectedDate);

      if (apptError) throw apptError;

      const activeCount = (dayAppointments || []).filter((a) => {
        const status = (a.status || '').toLowerCase();
        return status !== 'cancelled' && status !== 'declined';
      }).length;
      setActiveBookingCount(activeCount);
      setHasActiveBookings(activeCount > 0);

      if (data && !error) {
        // Helper to convert DB time string (08:00:00) to Date object
        const parseTime = (timeStr) => {
          const [h, m] = timeStr.split(':');
          const d = new Date();
          d.setHours(parseInt(h), parseInt(m), 0, 0);
          return d;
        };

        setTimes({
          opening: parseTime(data.opening_time),
          closing: parseTime(data.closing_time),
          lunchStart: parseTime(data.lunch_start),
          lunchEnd: parseTime(data.lunch_end),
        });
        setMarkUnavailable(data.is_available === false);
      } else {
        setMarkUnavailable(false);
      }
    } catch (err) {
      console.log("Could not load specific hours for this date.");
      setMarkUnavailable(false);
    }
  };

  const onTimeChange = (event, selectedValue) => {
    setShowPicker(null);
    if (selectedValue) {
      setTimes({ ...times, [showPicker]: selectedValue });
    }
  };

  const formatTime = (date) => {
    const d = new Date(date);
    return `${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}`;
  };

  const renderTimeField = (key, label) => (
    <TouchableOpacity
      style={[styles.timeField, markUnavailable && styles.disabledTimeBtn]}
      onPress={() => {
        if (markUnavailable || subscriptionLocked) return;
        setShowPicker(key);
      }}
      disabled={markUnavailable || subscriptionLocked}
      activeOpacity={0.85}
    >
      <Text style={styles.timeFieldLabel}>{label}</Text>
      <View style={styles.timeValueRow}>
        <Text style={styles.timeText}>{formatTime(times[key])}</Text>
        <Icon name="chevron-down" size={16} color="#4b5563" />
      </View>
    </TouchableOpacity>
  );

  const handleSaveAvailability = async () => {
    if (!selectedDate) return Alert.alert("Error", "Please select a date on the calendar.");

    if (subscriptionLocked) {
      return Alert.alert(
        "Subscription required",
        "Activate subscription to update availability and receive booking requests."
      );
    }

    if (markUnavailable && hasActiveBookings) {
      return Alert.alert(
        "Cannot mark unavailable",
        `This date already has ${activeBookingCount} booking(s). Please resolve bookings first.`
      );
    }

    setLoading(true);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      
      const { error } = await supabase
        .from('barber_availability')
        .upsert(
          {
            barber_id: user.id,
            available_date: selectedDate,
            opening_time: formatTime(times.opening),
            closing_time: formatTime(times.closing),
            lunch_start: formatTime(times.lunchStart),
            lunch_end: formatTime(times.lunchEnd),
            is_available: !markUnavailable
          },
          { onConflict: 'barber_id,available_date' }
        );

      if (error) throw error;
      Alert.alert(
        "Success",
        markUnavailable
          ? `${selectedDate} marked as unavailable.`
          : `Specific hours saved for ${selectedDate}!`
      );
    } catch (error) {
      Alert.alert("Error", error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.contentContainer}>
      {showSubscriptionBanner ? (
        <View style={styles.subBanner}>
          <View style={styles.subBannerLeft}>
            <Icon name="lock-closed-outline" size={16} color={colors.accent} />
            <Text style={styles.subBannerText}>Locked. Pay R70/month to continue receiving bookings.</Text>
          </View>
          <TouchableOpacity
            style={styles.subBannerBtn}
            onPress={() => navigation.navigate("SubscriptionPaywall")}
            activeOpacity={0.88}
          >
            <Text style={styles.subBannerBtnText}>Pay now</Text>
          </TouchableOpacity>
        </View>
      ) : null}

      <View style={styles.calendarWrap}>
        <Calendar
          minDate={today} // Prevents selecting dates in the past
          onDayPress={(day) => setSelectedDate(day.dateString)}
          markedDates={{ 
            [selectedDate]: { selected: true, selectedColor: '#111827' },
            [today]: { marked: true, dotColor: '#ef4444' }
          }}
          theme={{
            todayTextColor: colors.accent,
            arrowColor: colors.accent,
            selectedDayBackgroundColor: '#0A0A0A',
            textDayFontWeight: '600',
            textMonthFontWeight: '700',
            textDayHeaderFontWeight: '600',
          }}
        />
      </View>

      {selectedDate ? (
        <View style={styles.card}>
          <Text style={styles.title}>Adjust Hours: {selectedDate}</Text>

          {subscriptionLoading ? null : subscriptionLocked ? (
            <View style={styles.lockedBanner}>
              <View style={styles.lockedBannerRow}>
                <Icon name="lock-closed-outline" size={18} color={colors.accent} />
                <Text style={styles.lockedBannerText}>
                  Activate subscription to update availability and receive booking requests.
                </Text>
              </View>
              <TouchableOpacity
                style={styles.lockedBannerBtn}
                onPress={() => navigation.navigate("SubscriptionPaywall")}
              >
                <Text style={styles.lockedBannerBtnText}>Upgrade</Text>
              </TouchableOpacity>
            </View>
          ) : null}

          <View style={styles.unavailableWrap}>
            <View style={{ flex: 1 }}>
              <Text style={styles.unavailableTitle}>Unavailable for this day</Text>
              <Text style={styles.unavailableSub}>
                Block all appointments on this date.
              </Text>
            </View>
            <TouchableOpacity
              style={[styles.toggle, markUnavailable && styles.toggleActive]}
              onPress={() => {
                    if (subscriptionLocked) {
                      Alert.alert("Subscription required", "Activate subscription to update availability.");
                      return;
                    }
                if (!markUnavailable && hasActiveBookings) {
                  Alert.alert(
                    "Unavailable blocked",
                    `This date already has ${activeBookingCount} booking(s).`
                  );
                  return;
                }
                setMarkUnavailable((prev) => !prev);
              }}
            >
              <Text style={[styles.toggleText, markUnavailable && styles.toggleTextActive]}>
                {markUnavailable ? "On" : "Off"}
              </Text>
            </TouchableOpacity>
          </View>

          {hasActiveBookings ? (
            <Text style={styles.warningText}>
              This date has {activeBookingCount} active booking(s). You can still edit hours, but full day-off is blocked.
            </Text>
          ) : null}
          
          <Text style={styles.label}>Shift Hours</Text>
          <View style={styles.row}>
            {renderTimeField('opening', 'Start')}
            <Text style={styles.toText}>to</Text>
            {renderTimeField('closing', 'End')}
          </View>

          <Text style={styles.label}>Lunch Break</Text>
          <View style={styles.row}>
            {renderTimeField('lunchStart', 'Start')}
            <Text style={styles.toText}>to</Text>
            {renderTimeField('lunchEnd', 'End')}
          </View>

          {showPicker && (
            <View style={styles.pickerWrap}>
              <DateTimePicker
                value={times[showPicker]}
                mode="time"
                is24Hour={true}
                display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                onChange={onTimeChange}
                minuteInterval={5}
                textColor={colors.text}
                themeVariant="dark"
                style={styles.timePicker}
              />
            </View>
          )}

          <TouchableOpacity 
            style={[styles.saveBtn, loading && { opacity: 0.7 }]} 
            onPress={handleSaveAvailability}
            disabled={loading}
          >
            <Text style={styles.saveBtnText}>
              {loading ? "Saving..." : markUnavailable ? "Mark Day Unavailable" : "Update Date Availability"}
            </Text>
          </TouchableOpacity>
        </View>
      ) : (
        <View style={styles.placeholder}>
          <Text style={styles.placeholderText}>Select a date to set custom hours for that day.</Text>
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  contentContainer: { paddingBottom: 24 },
  calendarWrap: {
    backgroundColor: 'rgba(255,255,255,0.03)',
    marginHorizontal: 14,
    marginTop: 14,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(197,160,112,0.25)',
    overflow: 'hidden',
  },
  subBanner: {
    marginBottom: 12,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "rgba(197,160,112,0.35)",
    backgroundColor: "rgba(255,255,255,0.04)",
    padding: 10,
    flexDirection: "row",
    alignItems: "center",
  },
  subBannerLeft: { flex: 1, flexDirection: "row", alignItems: "center", marginRight: 8, gap: 8 },
  subBannerText: { color: "#F5F5F0", fontSize: 12, fontWeight: "800", lineHeight: 16, flex: 1 },
  subBannerBtn: {
    borderRadius: 10,
    backgroundColor: colors.accent,
    paddingVertical: 8,
    paddingHorizontal: 10,
  },
  subBannerBtnText: { color: "#0A0A0A", fontSize: 11, fontWeight: "900" },
  card: {
    padding: 18,
    marginHorizontal: 14,
    marginTop: 14,
    backgroundColor: 'rgba(255,255,255,0.03)',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(197,160,112,0.25)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 3,
    elevation: 1,
  },
  title: { fontSize: 22, fontWeight: '800', marginBottom: 18, textAlign: 'center', color: colors.accent },
  unavailableWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: 'rgba(255,255,255,0.03)',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(197,160,112,0.2)',
    padding: 12,
    marginBottom: 12,
  },
  unavailableTitle: { fontSize: 14, fontWeight: '700', color: colors.text },
  unavailableSub: { fontSize: 12, color: colors.textMuted, marginTop: 2 },
  toggle: {
    minWidth: 60,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(197,160,112,0.35)',
    paddingVertical: 8,
    paddingHorizontal: 14,
    backgroundColor: 'rgba(255,255,255,0.03)',
  },
  toggleActive: { backgroundColor: '#000', borderColor: '#000' },
  toggleText: { fontWeight: '700', color: colors.textSecondary },
  toggleTextActive: { color: '#fff' },
  warningText: {
    marginBottom: 10,
    color: '#C5A070',
    fontSize: 13,
    fontWeight: '600',
    backgroundColor: 'rgba(197,160,112,0.1)',
    borderColor: 'rgba(197,160,112,0.35)',
    borderWidth: 1,
    borderRadius: 10,
    padding: 10,
  },
  label: { fontSize: 14, fontWeight: '700', color: colors.textMuted, marginBottom: 8, textTransform: 'uppercase', letterSpacing: 0.3 },
  row: { flexDirection: 'row', alignItems: 'center', marginBottom: 20, justifyContent: 'space-between' },
  timeField: {
    backgroundColor: 'rgba(255,255,255,0.03)',
    borderRadius: 12,
    borderWidth: 1.2,
    borderColor: 'rgba(197,160,112,0.25)',
    flex: 0.45,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  timeFieldLabel: { fontSize: 12, color: colors.textMuted, fontWeight: '600', marginBottom: 4 },
  timeValueRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  disabledTimeBtn: { opacity: 0.75, backgroundColor: 'rgba(255,255,255,0.03)', borderColor: 'rgba(197,160,112,0.15)' },
  timeText: { fontSize: 22, fontWeight: '800', color: colors.text },
  toText: { fontSize: 14, color: colors.textMuted, fontWeight: '700' },
  saveBtn: {
    backgroundColor: '#0A0A0A',
    borderWidth: 1,
    borderColor: 'rgba(197,160,112,0.45)',
    padding: 18,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 10,
  },
  saveBtnText: { color: colors.accent, fontWeight: 'bold', fontSize: 16 },
  pickerWrap: {
    marginTop: 4,
    marginBottom: 10,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(197,160,112,0.25)',
    backgroundColor: 'rgba(255,255,255,0.03)',
    overflow: 'hidden',
  },
  timePicker: {
    height: 80,
    width: '100%',
    backgroundColor: 'rgba(255,255,255,0.03)',
  },
  placeholder: {
    marginHorizontal: 14,
    marginTop: 14,
    backgroundColor: 'rgba(255,255,255,0.03)',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(197,160,112,0.25)',
    padding: 30,
    alignItems: 'center',
  },
  placeholderText: { color: colors.textMuted, textAlign: 'center', fontSize: 15, lineHeight: 22 },
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