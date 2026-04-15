import React, { useEffect, useState } from "react";
import {
    ActivityIndicator,
    Alert,
    Image,
    Modal,
    ScrollView,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from "react-native";
import { Calendar } from "react-native-calendars";
import Icon from "react-native-vector-icons/Ionicons";
import { supabase } from "../../supabase/supabaseClient";
import {
    borderRadius,
    colors,
    shadows,
    typography,
} from "../../theme/clientTheme";
import { useClientThemeMode } from "../../theme/ClientThemeMode";
import { fetchServiceImageUrls } from "../../utils/serviceImageGallery";
import { resolveStorageImageUrl } from "../../utils/storageImageUrl";
import {
    fetchBarberSubscriptionState,
    isSubscriptionEligible,
} from "../../utils/subscriptionState";

export default function BarberProfile({ route, navigation }) {
  const { colors: themeColors, isDark } = useClientThemeMode();
  const BUFFER_MINUTES = 10;
  // Destructure editMode and appointmentId from params
  const { barberId, editMode, appointmentId } = route.params;
  const [services, setServices] = useState([]);
  const [shop, setShop] = useState(null);
  const [selectedService, setSelectedService] = useState(null);
  const [selectedDate, setSelectedDate] = useState("");
  const [selectedTime, setSelectedTime] = useState(null);
  const [availableSlots, setAvailableSlots] = useState([]);
  const [loading, setLoading] = useState(true);
  const [booking, setBooking] = useState(false);
  const [barberRating, setBarberRating] = useState(null);
  const [unavailableDateMap, setUnavailableDateMap] = useState({});
  const [dayAvailabilityMap, setDayAvailabilityMap] = useState({});
  const [subscriptionState, setSubscriptionState] = useState(null);
  const [showProfilePreview, setShowProfilePreview] = useState(false);
  const [galleryVisible, setGalleryVisible] = useState(false);
  const [galleryServiceName, setGalleryServiceName] = useState("");
  const [galleryImages, setGalleryImages] = useState([]);

  const today = new Date().toISOString().split("T")[0];

  useEffect(() => {
    fetchBarberData();
  }, []);

  useEffect(() => {
    if (selectedDate && shop) {
      generateTimeSlots();
    }
  }, [selectedDate, shop, unavailableDateMap, selectedService, services]);

  const fetchBarberData = async () => {
    try {
      const { data: barber } = await supabase
        .from("barbers")
        .select("*")
        .eq("id", barberId)
        .single();
      const { data: svc } = await supabase
        .from("barber_services")
        .select("*")
        .eq("barber_id", barberId);
      const { data: dayAvailabilityRows } = await supabase
        .from("barber_availability")
        .select(
          "available_date, is_available, opening_time, closing_time, lunch_start, lunch_end",
        )
        .eq("barber_id", barberId)
        .gte("available_date", today);
      const servicesWithGallery = await Promise.all(
        (svc || []).map(async (service) => {
          const imageGallery = await fetchServiceImageUrls(service.id);
          const coverImage = resolveStorageImageUrl(service.image_url);
          return {
            ...service,
            image_gallery: imageGallery,
            image_display: coverImage || imageGallery[0] || null,
          };
        }),
      );

      setShop(barber);
      setServices(servicesWithGallery);

      // Monetisation gate: if this barber is locked, they shouldn't receive new booking requests.
      const subState = await fetchBarberSubscriptionState(barberId);
      setSubscriptionState(subState);

      const map = {};
      const availabilityByDate = {};
      (dayAvailabilityRows || []).forEach((row) => {
        if (!row?.available_date) return;
        availabilityByDate[row.available_date] = row;
      });
      (dayAvailabilityRows || []).forEach((row) => {
        if (row.available_date) {
          if (row.is_available === false) {
            map[row.available_date] = {
              disabled: true,
              disableTouchEvent: true,
              marked: true,
              dotColor: colors.textMuted,
            };
          }
        }
      });
      setUnavailableDateMap(map);
      setDayAvailabilityMap(availabilityByDate);

      if (editMode && appointmentId) {
        const { data: existing } = await supabase
          .from("appointments")
          .select("appointment_date, appointment_time, service_name")
          .eq("id", appointmentId)
          .single();
        if (existing) {
          setSelectedDate(existing.appointment_date || "");
          setSelectedTime(
            existing.appointment_time
              ? existing.appointment_time.substring(0, 5)
              : null,
          );
          const match = (svc || []).find(
            (s) => s.service_name === existing.service_name,
          );
          if (match) setSelectedService(match);
        }
      }

      const { data: ratings } = await supabase
        .from("barber_ratings")
        .select("rating")
        .eq("barber_id", barberId);
      if (ratings && ratings.length > 0) {
        const sum = ratings.reduce((s, r) => s + (r.rating || 0), 0);
        setBarberRating({
          average: (sum / ratings.length).toFixed(1),
          count: ratings.length,
        });
      } else {
        setBarberRating(null);
      }
    } catch (error) {
      Alert.alert("Error", "Could not load profile.");
    } finally {
      setLoading(false);
    }
  };

  const normalizeTime = (t) => {
    if (!t || typeof t !== "string") return "";
    const s = t.trim();
    const parts = s.split(":");
    const h = (parts[0] || "0").replace(/\D/g, "").padStart(2, "0");
    const m = (parts[1] || "0").replace(/\D/g, "").padStart(2, "0");
    return `${h}:${m}`;
  };

  const getServiceDuration = (service) => {
    const raw = service?.duration_minutes ?? service?.duration ?? 45;
    const parsed = parseInt(raw, 10);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : 45;
  };

  const hhmmToMinutes = (hhmm) => {
    const [h, m] = normalizeTime(hhmm)
      .split(":")
      .map((v) => parseInt(v, 10) || 0);
    return h * 60 + m;
  };

  const minutesToHHMM = (mins) => {
    const h = Math.floor(mins / 60)
      .toString()
      .padStart(2, "0");
    const m = (mins % 60).toString().padStart(2, "0");
    return `${h}:${m}`;
  };

  const generateTimeSlots = async () => {
    try {
      if (unavailableDateMap[selectedDate]?.disabled) {
        setAvailableSlots([]);
        setSelectedTime(null);
        return;
      }

      if (subscriptionState && !isSubscriptionEligible(subscriptionState)) {
        setAvailableSlots([]);
        setSelectedTime(null);
        return;
      }

      const { data: booked } = await supabase
        .from("appointments")
        .select("id, appointment_time, service_name")
        .eq("barber_id", barberId)
        .eq("appointment_date", selectedDate)
        .neq("status", "cancelled");

      const bookedList = booked || [];
      const activeBooked =
        editMode && appointmentId
          ? bookedList.filter((b) => b.id !== appointmentId)
          : bookedList;
      const serviceDurations = new Map(
        (services || []).map((service) => [
          service.service_name,
          getServiceDuration(service),
        ]),
      );
      const bookedIntervals = activeBooked.map((bookingRow) => {
        const start = hhmmToMinutes(bookingRow.appointment_time);
        const duration = serviceDurations.get(bookingRow.service_name) || 45;
        return { start, end: start + duration };
      });

      const dayConfig = dayAvailabilityMap[selectedDate] || null;
      const startStr =
        dayConfig?.opening_time || shop?.default_opening || "08:00";
      const endStr =
        dayConfig?.closing_time || shop?.default_closing || "17:00";
      const lunchStartStr = dayConfig?.lunch_start || null;
      const lunchEndStr = dayConfig?.lunch_end || null;
      const selectedDuration = getServiceDuration(selectedService);
      const workdayStart = hhmmToMinutes(startStr);
      const workdayEnd = hhmmToMinutes(endStr);
      const lunchStart = lunchStartStr ? hhmmToMinutes(lunchStartStr) : null;
      const lunchEnd = lunchEndStr ? hhmmToMinutes(lunchEndStr) : null;

      const slots = [];
      for (
        let start = workdayStart;
        start + selectedDuration <= workdayEnd;
        start += 15
      ) {
        const overlapsLunch =
          lunchStart !== null &&
          lunchEnd !== null &&
          !(start >= lunchEnd || start + selectedDuration <= lunchStart);

        if (overlapsLunch) continue;

        const overlapsExisting = bookedIntervals.some(
          (interval) =>
            !(
              start >= interval.end + BUFFER_MINUTES ||
              start + selectedDuration + BUFFER_MINUTES <= interval.start
            ),
        );
        if (!overlapsExisting) slots.push(minutesToHHMM(start));
      }
      setAvailableSlots(slots);
    } catch (error) {
      console.error("Slot error:", error);
    }
  };

  const handleBooking = async () => {
    if (unavailableDateMap[selectedDate]?.disabled) {
      Alert.alert(
        "Unavailable",
        "This barber is unavailable on the selected date.",
      );
      return;
    }

    if (subscriptionState && !isSubscriptionEligible(subscriptionState)) {
      Alert.alert(
        "Bookings locked",
        "This barber is not receiving bookings right now. Please try again later.",
      );
      return;
    }

    if (!selectedService || !selectedDate || !selectedTime) {
      Alert.alert("Error", "Select service, date, and time.");
      return;
    }
    setBooking(true);
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      const appointmentData = {
        appointment_date: selectedDate,
        appointment_time: selectedTime,
        service_name: selectedService.service_name,
        price: selectedService.price,
        status: "pending", // Rescheduling sets status back to pending for approval
      };

      if (editMode && appointmentId) {
        const { data: updated, error } = await supabase
          .from("appointments")
          .update(appointmentData)
          .eq("id", appointmentId)
          .select("id")
          .single();

        if (error) throw error;
        if (!updated) throw new Error("Appointment could not be updated.");
        Alert.alert("Success!", "Appointment rescheduled.");
      } else {
        const timeNorm = normalizeTime(selectedTime);
        const { data: existing } = await supabase
          .from("appointments")
          .select("appointment_time, service_name")
          .eq("barber_id", barberId)
          .eq("appointment_date", selectedDate)
          .neq("status", "cancelled");
        const chosenStart = hhmmToMinutes(timeNorm);
        const chosenDuration = getServiceDuration(selectedService);
        const serviceDurations = new Map(
          (services || []).map((service) => [
            service.service_name,
            getServiceDuration(service),
          ]),
        );
        const overlapsExisting = (existing || []).some((row) => {
          const existingStart = hhmmToMinutes(row.appointment_time);
          const existingDuration = serviceDurations.get(row.service_name) || 45;
          const existingEnd = existingStart + existingDuration;
          return !(
            chosenStart >= existingEnd + BUFFER_MINUTES ||
            chosenStart + chosenDuration + BUFFER_MINUTES <= existingStart
          );
        });
        if (overlapsExisting) {
          setSelectedTime(null);
          await generateTimeSlots();
          Alert.alert(
            "Time no longer available",
            "This slot was just booked by someone else. Please choose another time.",
          );
          return;
        }

        const { error } = await supabase.from("appointments").insert([
          {
            ...appointmentData,
            barber_id: barberId,
            client_id: user.id,
          },
        ]);

        if (error) throw error;
        Alert.alert("Success!", "Appointment requested.");
      }

      // Navigate back to the bookings tab to see the change
      navigation.navigate("My Bookings");
    } catch (error) {
      Alert.alert("Booking Failed", error.message);
    } finally {
      setBooking(false);
    }
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={styles.loadingText}>Loading...</Text>
      </View>
    );
  }

  const calendarTheme = {
    backgroundColor: "transparent",
    calendarBackground: themeColors.surface,
    textSectionTitleColor: themeColors.textSecondary,
    selectedDayBackgroundColor: themeColors.accent,
    selectedDayTextColor: isDark ? "#0A0A0A" : "#fff",
    todayTextColor: themeColors.accent,
    todayBackgroundColor: themeColors.accentSoft,
    dayTextColor: themeColors.text,
    textDisabledColor: themeColors.textMuted,
    dotColor: themeColors.accent,
    selectedDotColor: isDark ? "#0A0A0A" : "#fff",
    arrowColor: themeColors.accent,
    monthTextColor: themeColors.text,
    textDayFontWeight: "500",
    textMonthFontWeight: "600",
    textDayHeaderFontSize: 13,
    textDayFontSize: 16,
    textMonthFontSize: 16,
  };

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: themeColors.background }]}
      contentContainerStyle={styles.scrollContent}
      showsVerticalScrollIndicator={false}
    >
      <TouchableOpacity
        activeOpacity={0.9}
        style={[
          styles.headerCard,
          {
            backgroundColor: themeColors.surface,
            borderColor: themeColors.border,
          },
        ]}
        onPress={() => setShowProfilePreview(true)}
      >
        <View
          style={[
            styles.headerIconWrap,
            {
              backgroundColor: themeColors.accentSoft,
              borderColor: themeColors.border,
            },
          ]}
        >
          {shop?.avatar_url ? (
            <Image
              source={{ uri: resolveStorageImageUrl(shop.avatar_url) }}
              style={styles.headerAvatar}
            />
          ) : (
            <Icon name="storefront" size={24} color={themeColors.accent} />
          )}
        </View>
        <View style={styles.headerTitleRow}>
          <Text style={[styles.shopName, { color: themeColors.text }]}>
            {shop?.shop_name}
          </Text>
          <View
            style={[
              styles.tapProfilePill,
              {
                backgroundColor: themeColors.accentSoft,
                borderColor: themeColors.border,
              },
            ]}
          >
            <Icon
              name="person-circle-outline"
              size={14}
              color={themeColors.accent}
            />
            <Text
              style={[styles.tapProfileText, { color: themeColors.accent }]}
            >
              View profile
            </Text>
          </View>
        </View>
        <View style={styles.addressRow}>
          <Icon
            name="location-outline"
            size={16}
            color={themeColors.textSecondary}
          />
          <Text style={[styles.address, { color: themeColors.textSecondary }]}>
            {shop?.address}
          </Text>
        </View>
        {!!(shop?.description || shop?.slogan) && (
          <Text style={[styles.sloganText, { color: themeColors.text }]}>
            {shop?.description || shop?.slogan}
          </Text>
        )}
        {barberRating && (
          <View style={styles.ratingRow}>
            <Icon name="star" size={18} color={themeColors.accent} />
            <Text style={styles.ratingText}>
              {barberRating.average} ({barberRating.count}{" "}
              {barberRating.count === 1 ? "review" : "reviews"})
            </Text>
          </View>
        )}
        {editMode && (
          <View
            style={[
              styles.editBadge,
              {
                backgroundColor: themeColors.accentSoft,
                borderColor: themeColors.border,
              },
            ]}
          >
            <Icon name="calendar" size={14} color={themeColors.accent} />
            <Text style={[styles.editBadgeText, { color: themeColors.accent }]}>
              Rescheduling appointment
            </Text>
          </View>
        )}
      </TouchableOpacity>

      <Modal
        visible={galleryVisible}
        animationType="slide"
        transparent
        onRequestClose={() => setGalleryVisible(false)}
      >
        <View style={styles.galleryOverlay}>
          <View
            style={[
              styles.galleryCard,
              {
                backgroundColor: themeColors.surface,
                borderColor: themeColors.border,
              },
            ]}
          >
            <View style={styles.galleryHeader}>
              <Text
                style={[styles.galleryTitle, { color: themeColors.text }]}
                numberOfLines={1}
              >
                {galleryServiceName || "Service photos"}
              </Text>
              <TouchableOpacity
                onPress={() => setGalleryVisible(false)}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <Icon
                  name="close"
                  size={24}
                  color={themeColors.textSecondary}
                />
              </TouchableOpacity>
            </View>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.galleryImageRow}
            >
              {galleryImages.map((uri, idx) => (
                <Image
                  key={`${uri}-${idx}`}
                  source={{ uri }}
                  style={styles.galleryImage}
                />
              ))}
            </ScrollView>
          </View>
        </View>
      </Modal>

      <Modal
        visible={showProfilePreview}
        transparent
        animationType="fade"
        onRequestClose={() => setShowProfilePreview(false)}
      >
        <View style={styles.profileModalOverlay}>
          <View
            style={[
              styles.profileModalCard,
              {
                backgroundColor: themeColors.surface,
                borderColor: themeColors.border,
              },
            ]}
          >
            <TouchableOpacity
              style={styles.profileModalClose}
              onPress={() => setShowProfilePreview(false)}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <Icon name="close" size={22} color={themeColors.textSecondary} />
            </TouchableOpacity>

            <View
              style={[
                styles.profileAvatarWrapLarge,
                {
                  backgroundColor: themeColors.accentSoft,
                  borderColor: themeColors.border,
                },
              ]}
            >
              {shop?.avatar_url ? (
                <Image
                  source={{ uri: resolveStorageImageUrl(shop.avatar_url) }}
                  style={styles.profileAvatarLarge}
                />
              ) : (
                <Icon name="storefront" size={30} color={themeColors.accent} />
              )}
            </View>

            <Text
              style={[styles.profileModalName, { color: themeColors.text }]}
            >
              {shop?.shop_name || "Barber Shop"}
            </Text>
            <View style={styles.profileModalRow}>
              <Icon
                name="location-outline"
                size={16}
                color={themeColors.textSecondary}
              />
              <Text
                style={[
                  styles.profileModalAddress,
                  { color: themeColors.textSecondary },
                ]}
              >
                {shop?.address || "No address added"}
              </Text>
            </View>

            {shop?.description || shop?.slogan ? (
              <Text
                style={[styles.profileModalBio, { color: themeColors.text }]}
              >
                {shop?.description || shop?.slogan}
              </Text>
            ) : null}

            <View style={styles.profileMetaRow}>
              <View
                style={[
                  styles.profileMetaPill,
                  {
                    backgroundColor: themeColors.accentSoft,
                    borderColor: themeColors.border,
                  },
                ]}
              >
                <Icon name="star" size={14} color={themeColors.accent} />
                <Text
                  style={[styles.profileMetaText, { color: themeColors.text }]}
                >
                  {barberRating
                    ? `${barberRating.average} (${barberRating.count})`
                    : "No ratings yet"}
                </Text>
              </View>
              <View
                style={[
                  styles.profileMetaPill,
                  {
                    backgroundColor: themeColors.accentSoft,
                    borderColor: themeColors.border,
                  },
                ]}
              >
                <Icon name="cut-outline" size={14} color={themeColors.accent} />
                <Text
                  style={[styles.profileMetaText, { color: themeColors.text }]}
                >
                  {services.length} services
                </Text>
              </View>
            </View>

            <TouchableOpacity
              style={[
                styles.profileModalBtn,
                { backgroundColor: themeColors.accent },
              ]}
              onPress={() => setShowProfilePreview(false)}
              activeOpacity={0.9}
            >
              <Text
                style={[
                  styles.profileModalBtnText,
                  { color: isDark ? "#0A0A0A" : "#fff" },
                ]}
              >
                Continue booking
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      <Text style={[styles.sectionHeader, { color: themeColors.text }]}>
        1. Select service
      </Text>
      <View
        style={[
          styles.servicesCard,
          {
            backgroundColor: themeColors.surface,
            borderColor: themeColors.border,
          },
        ]}
      >
        {services.map((item) =>
          (() => {
            const serviceImages = item.image_gallery?.length
              ? [
                  ...(item.image_display ? [item.image_display] : []),
                  ...item.image_gallery.filter(
                    (img) => img !== item.image_display,
                  ),
                ]
              : item.image_display
                ? [item.image_display]
                : [];
            return (
              <TouchableOpacity
                key={item.id}
                style={[
                  styles.serviceRow,
                  { borderColor: themeColors.border },
                  selectedService?.id === item.id && [
                    styles.selectedRow,
                    {
                      backgroundColor: themeColors.accentSoft,
                      borderColor: themeColors.accent,
                    },
                  ],
                ]}
                onPress={() => setSelectedService(item)}
                activeOpacity={0.7}
              >
                <View style={styles.serviceImagesWrap}>
                  {serviceImages.length > 0 ? (
                    <ScrollView
                      horizontal
                      showsHorizontalScrollIndicator={false}
                      contentContainerStyle={styles.serviceImageList}
                    >
                      {serviceImages.map((imgUri, idx) => (
                        <Image
                          key={`${item.id}-${idx}`}
                          source={{ uri: imgUri }}
                          style={styles.serviceImage}
                        />
                      ))}
                    </ScrollView>
                  ) : (
                    <View
                      style={[
                        styles.serviceImagePlaceholder,
                        {
                          backgroundColor: themeColors.surfaceAlt,
                          borderColor: themeColors.border,
                        },
                      ]}
                    >
                      <Icon
                        name="image-outline"
                        size={20}
                        color={themeColors.textMuted}
                      />
                    </View>
                  )}
                </View>
                <View style={styles.serviceMeta}>
                  <Text
                    style={[styles.serviceText, { color: themeColors.text }]}
                    numberOfLines={1}
                  >
                    {item.service_name}
                  </Text>
                  <Text
                    style={[
                      styles.serviceSubText,
                      { color: themeColors.textSecondary },
                    ]}
                    numberOfLines={1}
                  >
                    {getServiceDuration(item)} min service
                  </Text>
                  <View style={styles.serviceBottomRow}>
                    <Text style={[styles.price, { color: themeColors.accent }]}>
                      R{item.price}
                    </Text>
                    <View style={styles.serviceActionRow}>
                      <TouchableOpacity
                        style={[
                          styles.viewPhotosChip,
                          {
                            backgroundColor: themeColors.surfaceAlt,
                            borderColor: themeColors.border,
                          },
                        ]}
                        onPress={() => {
                          if (!serviceImages.length) return;
                          setGalleryServiceName(
                            item.service_name || "Service photos",
                          );
                          setGalleryImages(serviceImages);
                          setGalleryVisible(true);
                        }}
                        disabled={!serviceImages.length}
                        activeOpacity={0.85}
                      >
                        <Text
                          style={[
                            styles.viewPhotosText,
                            {
                              color: serviceImages.length
                                ? themeColors.textSecondary
                                : themeColors.textMuted,
                            },
                          ]}
                          numberOfLines={1}
                        >
                          View
                        </Text>
                        <Icon
                          name="images-outline"
                          size={13}
                          color={
                            serviceImages.length
                              ? themeColors.textSecondary
                              : themeColors.textMuted
                          }
                        />
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={[
                          styles.bookNowChip,
                          {
                            backgroundColor: themeColors.accentSoft,
                            borderColor: themeColors.border,
                          },
                        ]}
                        onPress={() => setSelectedService(item)}
                        activeOpacity={0.85}
                      >
                        <Text
                          style={[
                            styles.bookNowText,
                            { color: themeColors.accent },
                          ]}
                        >
                          Book Now
                        </Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                </View>
              </TouchableOpacity>
            );
          })(),
        )}
      </View>

      <Text style={[styles.sectionHeader, { color: themeColors.text }]}>
        2. Choose date
      </Text>
      <View
        style={[
          styles.calendarWrap,
          {
            backgroundColor: themeColors.surface,
            borderColor: themeColors.border,
          },
        ]}
      >
        <Calendar
          minDate={today}
          onDayPress={(day) => {
            if (unavailableDateMap[day.dateString]?.disabled) {
              Alert.alert(
                "Unavailable",
                "This barber is unavailable on that day.",
              );
              return;
            }
            setSelectedDate(day.dateString);
          }}
          markedDates={{
            ...unavailableDateMap,
            ...(selectedDate
              ? {
                  [selectedDate]: {
                    selected: true,
                    selectedColor: colors.primary,
                  },
                }
              : {}),
          }}
          theme={calendarTheme}
        />
      </View>

      {selectedDate && (
        <>
          <Text style={[styles.sectionHeader, { color: themeColors.text }]}>
            3. Available times
          </Text>
          <View style={styles.slotsContainer}>
            {availableSlots.map((time) => (
              <TouchableOpacity
                key={time}
                style={[
                  styles.slot,
                  {
                    backgroundColor: themeColors.surface,
                    borderColor: themeColors.border,
                  },
                  selectedTime === time && [
                    styles.selectedSlot,
                    {
                      backgroundColor: themeColors.accent,
                      borderColor: themeColors.accent,
                    },
                  ],
                ]}
                onPress={() => setSelectedTime(time)}
                activeOpacity={0.7}
              >
                <Text
                  style={[
                    styles.slotText,
                    { color: themeColors.text },
                    selectedTime === time && [
                      styles.slotTextSelected,
                      { color: isDark ? "#0A0A0A" : "#fff" },
                    ],
                  ]}
                >
                  {time}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </>
      )}

      <TouchableOpacity
        style={[
          styles.bookBtn,
          {
            backgroundColor: themeColors.accent,
            borderColor: themeColors.border,
          },
          !selectedTime && [
            styles.bookBtnDisabled,
            { backgroundColor: themeColors.textMuted },
          ],
        ]}
        onPress={handleBooking}
        disabled={
          booking ||
          !selectedTime ||
          (subscriptionState && !isSubscriptionEligible(subscriptionState))
        }
        activeOpacity={0.85}
      >
        {booking ? (
          <ActivityIndicator color={isDark ? "#0A0A0A" : "#fff"} />
        ) : (
          <>
            <Icon
              name="checkmark-circle"
              size={22}
              color={isDark ? "#0A0A0A" : "#fff"}
              style={{ marginRight: 8 }}
            />
            <Text
              style={[
                styles.bookBtnText,
                { color: isDark ? "#0A0A0A" : "#fff" },
              ]}
            >
              {editMode ? "Confirm reschedule" : "Confirm booking"}
            </Text>
          </>
        )}
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  scrollContent: { padding: 20, paddingBottom: 40 },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: colors.background,
  },
  loadingText: { marginTop: 12, fontSize: 15, color: colors.textSecondary },
  headerCard: {
    backgroundColor: colors.surface,
    padding: 24,
    borderRadius: borderRadius.lg,
    marginBottom: 24,
    borderWidth: 1,
    borderColor: colors.border,
    ...shadows.card,
  },
  headerIconWrap: {
    width: 48,
    height: 48,
    borderRadius: borderRadius.md,
    backgroundColor: colors.pendingBg,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 12,
    overflow: "hidden",
  },
  headerAvatar: { width: "100%", height: "100%" },
  shopName: { ...typography.title, color: colors.text, marginBottom: 6 },
  headerTitleRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 8,
  },
  tapProfilePill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    borderWidth: 1,
    borderRadius: 999,
    paddingVertical: 5,
    paddingHorizontal: 9,
  },
  tapProfileText: { fontSize: 11, fontWeight: "800" },
  addressRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  address: { fontSize: 14, color: colors.textSecondary, flex: 1 },
  sloganText: {
    marginTop: 10,
    fontSize: 14,
    color: colors.text,
    fontStyle: "italic",
  },
  ratingRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginTop: 10,
  },
  ratingText: { fontSize: 14, fontWeight: "600", color: colors.accent },
  editBadge: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    backgroundColor: colors.pendingBg,
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: borderRadius.sm,
    marginTop: 14,
    borderWidth: 1,
    borderColor: colors.accent + "50",
  },
  editBadgeText: { color: colors.pending, fontWeight: "600", fontSize: 13 },
  sectionHeader: {
    ...typography.sectionHeader,
    color: colors.text,
    marginBottom: 12,
    marginTop: 8,
  },
  servicesCard: {
    backgroundColor: colors.surface,
    borderRadius: borderRadius.lg,
    paddingVertical: 8,
    paddingHorizontal: 8,
    marginBottom: 8,
    ...shadows.card,
    borderWidth: 1,
    borderColor: colors.border,
  },
  serviceRow: {
    flexDirection: "row",
    alignItems: "center",
    padding: 10,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: colors.border + "40",
    marginBottom: 10,
  },
  selectedRow: {
    backgroundColor: colors.pendingBg,
    borderWidth: 2,
    borderColor: colors.accent,
  },
  serviceImage: {
    width: 72,
    height: 72,
    borderRadius: borderRadius.md,
    backgroundColor: colors.surface,
    marginRight: 8,
  },
  serviceImagesWrap: {
    width: 120,
    height: 72,
  },
  serviceImageList: {
    paddingRight: 4,
  },
  serviceImagePlaceholder: {
    width: 72,
    height: 72,
    borderRadius: borderRadius.md,
    backgroundColor: colors.surface,
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 1,
    borderColor: colors.border,
  },
  serviceMeta: {
    flex: 1,
    marginLeft: 12,
    justifyContent: "center",
  },
  serviceText: { fontSize: 16, color: colors.text, fontWeight: "700" },
  serviceSubText: {
    marginTop: 2,
    fontSize: 13,
    color: colors.textSecondary,
  },
  serviceBottomRow: {
    marginTop: 8,
    gap: 8,
  },
  price: { fontSize: 16, fontWeight: "700", color: colors.primary },
  bookNowChip: {
    backgroundColor: colors.pendingBg,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: borderRadius.sm,
    paddingHorizontal: 10,
    paddingVertical: 8,
    alignItems: "center",
    justifyContent: "center",
    flex: 1,
  },
  bookNowText: {
    color: colors.white,
    fontSize: 13,
    fontWeight: "800",
  },
  serviceActionRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    width: "100%",
  },
  viewPhotosChip: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
    borderWidth: 1,
    borderRadius: borderRadius.sm,
    paddingHorizontal: 8,
    paddingVertical: 8,
    flex: 1,
    minHeight: 40,
  },
  viewPhotosText: {
    fontSize: 13,
    fontWeight: "700",
  },
  calendarWrap: {
    backgroundColor: colors.surface,
    borderRadius: borderRadius.lg,
    overflow: "hidden",
    marginBottom: 8,
    ...shadows.card,
    borderWidth: 1,
    borderColor: colors.border,
  },
  slotsContainer: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
    marginBottom: 8,
  },
  slot: {
    width: "23%",
    minWidth: 72,
    padding: 14,
    backgroundColor: colors.surface,
    borderRadius: borderRadius.md,
    alignItems: "center",
    borderWidth: 1.5,
    borderColor: colors.border,
  },
  selectedSlot: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  slotText: { fontSize: 15, fontWeight: "600", color: colors.text },
  slotTextSelected: { color: colors.white },
  bookBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.primary,
    paddingVertical: 18,
    paddingHorizontal: 24,
    borderRadius: borderRadius.lg,
    marginTop: 28,
    borderWidth: 1,
    borderColor: colors.border,
    ...shadows.button,
  },
  bookBtnDisabled: { backgroundColor: colors.textMuted, opacity: 0.8 },
  bookBtnText: { ...typography.button, color: colors.white },
  profileModalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.55)",
    alignItems: "center",
    justifyContent: "center",
    padding: 22,
  },
  profileModalCard: {
    width: "100%",
    borderRadius: borderRadius.xl,
    borderWidth: 1,
    padding: 18,
  },
  profileModalClose: { alignSelf: "flex-end" },
  profileAvatarWrapLarge: {
    width: 82,
    height: 82,
    borderRadius: 999,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
    borderWidth: 1,
    marginTop: 4,
    marginBottom: 10,
    alignSelf: "center",
  },
  profileAvatarLarge: { width: "100%", height: "100%" },
  profileModalName: {
    fontSize: 28,
    fontWeight: "900",
    textAlign: "center",
    marginBottom: 8,
  },
  profileModalRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 6,
    marginBottom: 10,
  },
  profileModalAddress: { fontSize: 15, lineHeight: 21, flex: 1 },
  profileModalBio: { fontSize: 16, fontStyle: "italic", marginBottom: 12 },
  profileMetaRow: { flexDirection: "row", gap: 10, marginBottom: 12 },
  profileMetaPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    borderWidth: 1,
    borderRadius: 999,
    paddingVertical: 7,
    paddingHorizontal: 10,
    flex: 1,
    justifyContent: "center",
  },
  profileMetaText: { fontSize: 12, fontWeight: "800" },
  profileModalBtn: {
    borderRadius: borderRadius.md,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 13,
  },
  profileModalBtnText: { fontSize: 15, fontWeight: "900" },
  galleryOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.55)",
    justifyContent: "center",
    padding: 16,
  },
  galleryCard: {
    borderRadius: borderRadius.xl,
    borderWidth: 1,
    padding: 14,
  },
  galleryHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 10,
  },
  galleryTitle: {
    fontSize: 17,
    fontWeight: "900",
    flex: 1,
    marginRight: 8,
  },
  galleryImageRow: {
    gap: 10,
    paddingRight: 6,
  },
  galleryImage: {
    width: 210,
    height: 210,
    borderRadius: borderRadius.md,
    backgroundColor: colors.background,
  },
});
