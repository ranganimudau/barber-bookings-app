import BottomSheet, { BottomSheetFlatList } from "@gorhom/bottom-sheet";
import * as Location from 'expo-location';
import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Keyboard,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  Image,
  useWindowDimensions,
  View,
} from "react-native";
import MapView, { Marker } from "react-native-maps";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Icon from "react-native-vector-icons/Ionicons";
import { useGuestMode } from "../../context/GuestModeContext";
import { useLightStatusBar } from "../../hooks/useLightStatusBar";
import { supabase } from "../../supabase/supabaseClient";
import { colors, borderRadius, shadows } from "../../theme/barberTheme";
import { resolveStorageImageUrl } from "../../utils/storageImageUrl";

const FILTERS = [
  { id: "all", label: "All" },
  { id: "nearest", label: "Nearest" },
  { id: "top", label: "Top rated" },
];

const COLLAPSED_SHEET_RATIO = 0.16; // must match snapPoints[0]

export default function ClientHome({ navigation }) {
  useLightStatusBar(colors.background);
  const insets = useSafeAreaInsets();
  const { height: windowHeight } = useWindowDimensions();
  const { pendingBooking, clearPendingBooking } = useGuestMode();
  const [barbers, setBarbers] = useState([]);
  const [filteredBarbers, setFilteredBarbers] = useState([]);
  const [servicesByBarber, setServicesByBarber] = useState({});
  const [matchedServiceByBarber, setMatchedServiceByBarber] = useState({});
  const [tracksViewChanges, setTracksViewChanges] = useState(true);
  const [userLocation, setUserLocation] = useState(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [activeFilter, setActiveFilter] = useState("all");
  const [selectedBarber, setSelectedBarber] = useState(null);
  const [loading, setLoading] = useState(true);

  const mapRef = useRef(null); // Ref for map animation
  const bottomSheetRef = useRef(null);
  // Top stop stays under 90% so a strip of map is always visible — a sheet
  // that covers the map entirely leaves a blank white screen when there are
  // only a couple of results.
  const snapPoints = useMemo(() => ["16%", "52%", "88%"], []);

  useEffect(() => {
    getUserLocationAndBarbers();
  }, []);

  useEffect(() => {
    // A guest who picked a service/date/time then tapped "Sign up to book"
    // lands back here once signed in — reopen that same business with the
    // pick restored instead of making them start over.
    if (!pendingBooking) return;
    navigation.navigate("BarberProfile", {
      barberId: pendingBooking.barberId,
      prefillServiceId: pendingBooking.serviceId,
      prefillDate: pendingBooking.date,
      prefillTime: pendingBooking.time,
    });
    clearPendingBooking();
  }, [pendingBooking, navigation, clearPendingBooking]);

  useEffect(() => {
    const q = searchQuery.trim().toLowerCase();
    let next = [...barbers];
    const nextMatches = {};

    if (q) {
      next = next.filter((b) => {
        const nameMatch = (b.shop_name || "").toLowerCase().includes(q);
        const services = servicesByBarber[b.id] || [];
        const matchedService = services.find((s) => (s || "").toLowerCase().includes(q));
        // Business name promises "fades to braids, nails to makeup" — that
        // only holds up if someone can actually search "nails" and find the
        // businesses that offer it, not just ones named after it.
        if (!nameMatch && matchedService) nextMatches[b.id] = matchedService;
        return nameMatch || !!matchedService;
      });
    }
    setMatchedServiceByBarber(nextMatches);

    if (activeFilter === "nearest") {
      next = next.filter((b) => b.distance != null).sort((a, b) => (a.distance || 999) - (b.distance || 999));
    } else if (activeFilter === "top") {
      next = next
        .filter((b) => b.averageRating != null)
        .sort((a, b) => Number(b.averageRating || 0) - Number(a.averageRating || 0));
    }

    setFilteredBarbers(next);
  }, [searchQuery, activeFilter, barbers, servicesByBarber]);

  useEffect(() => {
    // Prevent Android OOM: don't continuously re-render custom markers. The
    // selected pin changes colour, so this has to run on selection too or
    // the repaint never reaches the screen.
    setTracksViewChanges(true);
    const id = setTimeout(() => setTracksViewChanges(false), 900);
    return () => clearTimeout(id);
  }, [filteredBarbers.length, activeFilter, searchQuery, selectedBarber?.id]);

  const getUserLocationAndBarbers = async () => {
    try {
      // 1. Request Permission and get user location
      let { status } = await Location.requestForegroundPermissionsAsync();
      let coords = null;

      if (status === 'granted') {
        const location = await Location.getCurrentPositionAsync({});
        coords = location.coords;
        setUserLocation(coords);
      }

      // 2. Fetch Barbers from database
      const { data, error } = await supabase
        .from("barbers")
        .select("*")
        .eq("is_profile_complete", true)
        .eq("shop_status", "active");

      if (error) throw error;

      const ids = (data || []).map((b) => b.id).filter(Boolean);

      // 3. Fetch ratings for all barbers (optional - table may not exist yet)
      let ratingsByBarber = {};
      try {
        if (ids.length > 0) {
          const { data: ratings } = await supabase
            .from("barber_ratings")
            .select("barber_id, rating")
            .in("barber_id", ids);
          (ratings || []).forEach((r) => {
            if (!ratingsByBarber[r.barber_id]) ratingsByBarber[r.barber_id] = [];
            ratingsByBarber[r.barber_id].push(r.rating);
          });
        }
      } catch (_) { /* barber_ratings table may not exist */ }

      // 3b. Fetch each business's service names so search can match "nails"
      // or "braids", not just the business's own name — and so the map
      // preview card can show what they actually offer.
      try {
        if (ids.length > 0) {
          const { data: svcRows } = await supabase
            .from("barber_services")
            .select("barber_id, service_name")
            .in("barber_id", ids);
          const svcMap = {};
          (svcRows || []).forEach((row) => {
            if (!svcMap[row.barber_id]) svcMap[row.barber_id] = [];
            svcMap[row.barber_id].push(row.service_name);
          });
          setServicesByBarber(svcMap);
        }
      } catch (_) { /* non-fatal — search just falls back to name-only */ }

      // 4. Process data with distance and rating
      const processedData = data.map((barber) => {
        const distance = (coords && barber.latitude && barber.longitude)
          ? calculateDistance(coords.latitude, coords.longitude, barber.latitude, barber.longitude)
          : null;
        const arr = ratingsByBarber[barber.id] || [];
        const averageRating = arr.length
          ? (arr.reduce((s, n) => s + n, 0) / arr.length).toFixed(1)
          : null;
        const reviewCount = arr.length;
        return { ...barber, distance, averageRating, reviewCount };
      }).sort((a, b) => (a.distance || 999) - (b.distance || 999));

      setBarbers(processedData);
      setFilteredBarbers(processedData);
    } catch (error) {
      console.error(error.message);
    } finally {
      setLoading(false);
    }
  };

  const calculateDistance = (lat1, lon1, lat2, lon2) => {
    const R = 6371; // Earth's radius in km
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
              Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLon/2) * Math.sin(dLon/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return (R * c).toFixed(1);
  };

  // Distances are computed in km but read badly under 1km ("0.4 km").
  const formatDistance = (km) => {
    const n = Number(km);
    if (!Number.isFinite(n)) return null;
    return n < 1 ? `${Math.round(n * 1000)} m` : `${n} km`;
  };

  // Center Map on the User's location
  const centerOnUser = () => {
    if (userLocation) {
      mapRef.current?.animateToRegion({
        latitude: userLocation.latitude,
        longitude: userLocation.longitude,
        latitudeDelta: 0.01,
        longitudeDelta: 0.01,
      }, 1000);
    }
  };

  // ZOOM LOGIC: Centers map on a specific shop and collapses the sheet
  const focusOnBarber = (barber) => {
    if (barber.latitude && barber.longitude) {
      mapRef.current?.animateToRegion({
        latitude: Number(barber.latitude),
        longitude: Number(barber.longitude),
        latitudeDelta: 0.005, // Closer zoom
        longitudeDelta: 0.005,
      }, 600);

      bottomSheetRef.current?.snapToIndex(0); // Show full map
      Keyboard.dismiss();
    }
  };

  /**
   * react-native-maps' built-in <Callout> renders unreliably on Android when
   * the Marker has custom children — it was showing as an empty white blip
   * with none of the shop's details. Driving our own preview card off the
   * marker's onPress gives us full control and room for real information.
   */
  const handleMarkerPress = (barber) => {
    setSelectedBarber(barber);
    focusOnBarber(barber);
  };

  const openBarberProfile = (barber) => {
    navigation.navigate("BarberProfile", { barberId: barber.id });
  };

  const renderBarberItem = ({ item }) => {
    const matchedService = matchedServiceByBarber[item.id];
    const distanceLabel = formatDistance(item.distance);

    return (
      <TouchableOpacity
        style={styles.card}
        onPress={() => openBarberProfile(item)}
        activeOpacity={0.85}
      >
        <View style={styles.avatarWrap}>
          {item.avatar_url ? (
            <Image
              source={{ uri: resolveStorageImageUrl(item.avatar_url) }}
              style={styles.avatar}
              resizeMode="cover"
            />
          ) : (
            <Icon name="storefront-outline" size={22} color={colors.textMuted} />
          )}
        </View>

        <View style={styles.cardInfo}>
          <Text style={styles.shopName} numberOfLines={1}>{item.shop_name}</Text>

          <View style={styles.metaLine}>
            {item.averageRating != null ? (
              <>
                <Icon name="star" size={13} color={colors.pending} />
                <Text style={styles.ratingText}>{item.averageRating}</Text>
                <Text style={styles.metaMuted}>({item.reviewCount})</Text>
              </>
            ) : (
              <Text style={styles.metaMuted}>New</Text>
            )}
            {distanceLabel && (
              <>
                <Text style={styles.metaDot}>·</Text>
                {/* Tapping the distance flies the map to this shop — keeps
                    that behaviour reachable now the card itself opens the
                    profile, which is what a tap here is expected to do. */}
                <TouchableOpacity
                  onPress={() => handleMarkerPress(item)}
                  hitSlop={{ top: 10, bottom: 10, left: 6, right: 10 }}
                  activeOpacity={0.7}
                >
                  <Text style={styles.distanceText}>{distanceLabel}</Text>
                </TouchableOpacity>
              </>
            )}
          </View>

          <Text style={styles.address} numberOfLines={1}>{item.address}</Text>

          {matchedService && (
            <View style={styles.matchChip}>
              <Text style={styles.matchChipText} numberOfLines={1}>{matchedService}</Text>
            </View>
          )}
        </View>

        <View style={styles.bookPill}>
          <Text style={styles.bookPillText}>Book</Text>
        </View>
      </TouchableOpacity>
    );
  };

  const renderPreviewCard = () => {
    if (!selectedBarber) return null;
    const services = servicesByBarber[selectedBarber.id] || [];
    const distanceLabel = formatDistance(selectedBarber.distance);

    return (
      <View
        style={[
          styles.previewWrap,
          { bottom: windowHeight * COLLAPSED_SHEET_RATIO + 12 },
        ]}
      >
        <View style={styles.previewCard}>
          <TouchableOpacity
            style={styles.previewClose}
            onPress={() => setSelectedBarber(null)}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            activeOpacity={0.7}
          >
            <Icon name="close" size={18} color={colors.textMuted} />
          </TouchableOpacity>

          <View style={styles.previewTop}>
            <View style={styles.previewAvatar}>
              {selectedBarber.avatar_url ? (
                <Image
                  source={{ uri: resolveStorageImageUrl(selectedBarber.avatar_url) }}
                  style={styles.avatar}
                  resizeMode="cover"
                />
              ) : (
                <Icon name="storefront-outline" size={24} color={colors.textMuted} />
              )}
            </View>

            <View style={styles.previewInfo}>
              <Text style={styles.previewName} numberOfLines={1}>
                {selectedBarber.shop_name}
              </Text>

              <View style={styles.metaLine}>
                {selectedBarber.averageRating != null ? (
                  <>
                    <Icon name="star" size={14} color={colors.pending} />
                    <Text style={styles.ratingText}>{selectedBarber.averageRating}</Text>
                    <Text style={styles.metaMuted}>
                      ({selectedBarber.reviewCount}{" "}
                      {selectedBarber.reviewCount === 1 ? "review" : "reviews"})
                    </Text>
                  </>
                ) : (
                  <Text style={styles.metaMuted}>No reviews yet</Text>
                )}
                {distanceLabel && (
                  <>
                    <Text style={styles.metaDot}>·</Text>
                    <Text style={styles.distanceText}>{distanceLabel} away</Text>
                  </>
                )}
              </View>

              <View style={styles.previewAddressRow}>
                <Icon name="location-outline" size={13} color={colors.textMuted} />
                <Text style={styles.address} numberOfLines={2}>
                  {selectedBarber.address}
                </Text>
              </View>
            </View>
          </View>

          {services.length > 0 && (
            <View style={styles.previewServices}>
              {services.slice(0, 3).map((name) => (
                <View key={name} style={styles.serviceChip}>
                  <Text style={styles.serviceChipText} numberOfLines={1}>{name}</Text>
                </View>
              ))}
              {services.length > 3 && (
                <Text style={styles.moreServices}>+{services.length - 3} more</Text>
              )}
            </View>
          )}

          <TouchableOpacity
            style={styles.previewBtn}
            onPress={() => openBarberProfile(selectedBarber)}
            activeOpacity={0.9}
          >
            <Text style={styles.previewBtnText}>View &amp; book</Text>
            <Icon name="arrow-forward" size={17} color={colors.accentText} />
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <View style={styles.loadingIconWrap}>
          <Icon name="compass-outline" size={26} color={colors.accent} />
        </View>
        <ActivityIndicator size="large" color={colors.accent} />
        <Text style={styles.loadingText}>Finding pros near you…</Text>
      </View>
    );
  }

  const resultLabel = searchQuery.trim()
    ? `${filteredBarbers.length} ${filteredBarbers.length === 1 ? "match" : "matches"} for “${searchQuery.trim()}”`
    : `${filteredBarbers.length} ${filteredBarbers.length === 1 ? "pro" : "pros"} nearby`;

  return (
    <View style={styles.container}>
      <MapView
        ref={mapRef}
        style={styles.map}
        showsUserLocation={true}
        onPress={() => setSelectedBarber(null)}
        initialRegion={userLocation ? {
          latitude: userLocation.latitude,
          longitude: userLocation.longitude,
          latitudeDelta: 0.05,
          longitudeDelta: 0.05,
        } : undefined}
      >
        {filteredBarbers.slice(0, 25).map((barber) => {
          const isSelected = selectedBarber?.id === barber.id;
          return (
            <Marker
              key={barber.id}
              coordinate={{ latitude: parseFloat(barber.latitude), longitude: parseFloat(barber.longitude) }}
              anchor={{ x: 0.5, y: 1 }}
              tracksViewChanges={tracksViewChanges}
              onPress={() => handleMarkerPress(barber)}
            >
              {/* Keep this view simple and fixed-size. Adding a text label
                  inside the marker stopped it rendering at all on Android —
                  custom marker views are snapshotted to a bitmap and text
                  laying out late leaves nothing to draw. The shop name is
                  shown in the preview card on tap instead. */}
              <View style={styles.markerWrap}>
                <View style={[styles.markerPin, isSelected && styles.markerPinSelected]}>
                  <Icon name="cut" size={15} color={colors.white} />
                </View>
                <View style={[styles.markerStem, isSelected && styles.markerStemSelected]} />
              </View>
            </Marker>
          );
        })}
      </MapView>

      {/* Floating over the map rather than a solid header bar — keeps the
          full map visible and gives search the prominence it needs now that
          it covers services as well as business names. */}
      <View style={[styles.searchFloat, { top: Math.max(insets.top, 8) + 10 }]}>
        <View style={styles.searchBar}>
          <Icon name="search" size={19} color={colors.textMuted} />
          <TextInput
            style={styles.searchInput}
            placeholder="Search salons or services"
            placeholderTextColor={colors.textMuted}
            value={searchQuery}
            onChangeText={setSearchQuery}
            returnKeyType="search"
            onSubmitEditing={Keyboard.dismiss}
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity
              onPress={() => setSearchQuery("")}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              activeOpacity={0.7}
            >
              <Icon name="close-circle" size={18} color={colors.textMuted} />
            </TouchableOpacity>
          )}
        </View>

        <TouchableOpacity
          style={styles.locateBtn}
          onPress={centerOnUser}
          activeOpacity={0.8}
        >
          <Icon name="locate" size={22} color={colors.accent} />
        </TouchableOpacity>
      </View>

      {renderPreviewCard()}

      <BottomSheet
        ref={bottomSheetRef}
        index={1}
        snapPoints={snapPoints}
        handleIndicatorStyle={styles.sheetIndicator}
        backgroundStyle={styles.sheetBackground}
        handleStyle={styles.sheetHandle}
      >
        <View style={styles.contentContainer}>
          <Text style={styles.resultCount}>{resultLabel}</Text>

          <View style={styles.filterRow}>
            {FILTERS.map((f) => {
              const active = activeFilter === f.id;
              return (
                <TouchableOpacity
                  key={f.id}
                  style={[styles.filterChip, active && styles.filterChipActive]}
                  onPress={() => setActiveFilter(f.id)}
                  activeOpacity={0.85}
                >
                  <Text style={[styles.filterChipText, active && styles.filterChipTextActive]}>
                    {f.label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>

          <BottomSheetFlatList
            data={filteredBarbers}
            keyExtractor={(item) => item.id}
            renderItem={renderBarberItem}
            contentContainerStyle={styles.listPadding}
            showsVerticalScrollIndicator={false}
            ListEmptyComponent={
              <View style={styles.emptyWrap}>
                <View style={styles.emptyIconCircle}>
                  <Icon name="search-outline" size={22} color={colors.accent} />
                </View>
                <Text style={styles.emptyTitle}>Nothing found</Text>
                <Text style={styles.emptySub}>
                  {searchQuery.trim()
                    ? "Try a different name or service."
                    : "No businesses are taking bookings in your area yet."}
                </Text>
              </View>
            }
          />
        </View>
      </BottomSheet>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  map: { ...StyleSheet.absoluteFillObject },

  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: colors.background,
  },
  loadingIconWrap: {
    width: 58,
    height: 58,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 10,
  },
  loadingText: {
    marginTop: 12,
    fontSize: 15,
    color: colors.textSecondary,
    fontWeight: "600",
  },

  searchFloat: {
    position: "absolute",
    left: 16,
    right: 16,
    zIndex: 10,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  searchBar: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    height: 50,
    paddingHorizontal: 16,
    borderRadius: 999,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    ...shadows.floating,
  },
  searchInput: {
    flex: 1,
    fontSize: 15,
    color: colors.text,
    paddingVertical: 0,
  },
  locateBtn: {
    width: 50,
    height: 50,
    borderRadius: 999,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    ...shadows.floating,
  },

  // --- Map pin ---------------------------------------------------------
  markerWrap: { alignItems: "center" },
  markerPin: {
    width: 34,
    height: 34,
    borderRadius: 999,
    backgroundColor: colors.black,
    borderWidth: 2,
    borderColor: colors.white,
    alignItems: "center",
    justifyContent: "center",
  },
  markerPinSelected: { backgroundColor: colors.accent },
  // Little tail under the circle so the pin points at its actual address
  // instead of floating over it.
  markerStem: {
    width: 2,
    height: 7,
    backgroundColor: colors.black,
    marginTop: -1,
  },
  markerStemSelected: { backgroundColor: colors.accent },

  // --- Map preview card ------------------------------------------------
  previewWrap: {
    position: "absolute",
    left: 16,
    right: 16,
    zIndex: 9,
  },
  previewCard: {
    backgroundColor: colors.surface,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 14,
    ...shadows.floating,
  },
  previewClose: {
    position: "absolute",
    top: 10,
    right: 10,
    zIndex: 2,
    width: 26,
    height: 26,
    borderRadius: 999,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.surfaceMuted,
  },
  previewTop: { flexDirection: "row", paddingRight: 26 },
  previewAvatar: {
    width: 62,
    height: 62,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceMuted,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  previewInfo: { flex: 1, minWidth: 0, marginLeft: 12 },
  previewName: { fontSize: 17, fontWeight: "800", color: colors.text },
  previewAddressRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 4,
    marginTop: 4,
  },
  previewServices: {
    flexDirection: "row",
    alignItems: "center",
    flexWrap: "wrap",
    gap: 6,
    marginTop: 12,
  },
  serviceChip: {
    paddingVertical: 5,
    paddingHorizontal: 10,
    borderRadius: 999,
    backgroundColor: colors.accentSoft,
    maxWidth: 130,
  },
  serviceChipText: { fontSize: 11.5, fontWeight: "700", color: colors.accent },
  moreServices: { fontSize: 11.5, fontWeight: "700", color: colors.textMuted },
  previewBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    marginTop: 14,
    paddingVertical: 13,
    borderRadius: 14,
    backgroundColor: colors.accent,
  },
  previewBtnText: { fontSize: 15, fontWeight: "800", color: colors.accentText },

  // --- Bottom sheet ----------------------------------------------------
  sheetBackground: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
  },
  sheetHandle: {
    backgroundColor: "transparent",
    paddingTop: 10,
    paddingBottom: 6,
  },
  sheetIndicator: {
    backgroundColor: colors.borderStrong,
    width: 44,
    height: 4,
  },
  contentContainer: { flex: 1, paddingHorizontal: 16 },
  resultCount: {
    fontSize: 13,
    fontWeight: "700",
    color: colors.textMuted,
    marginBottom: 12,
  },
  filterRow: { flexDirection: "row", gap: 8, marginBottom: 14 },
  filterChip: {
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    borderRadius: 999,
    paddingVertical: 8,
    paddingHorizontal: 14,
  },
  filterChipActive: { backgroundColor: colors.accent, borderColor: colors.accent },
  filterChipText: { fontSize: 13, fontWeight: "700", color: colors.textSecondary },
  filterChipTextActive: { color: colors.accentText },

  // --- List cards ------------------------------------------------------
  card: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.surface,
    padding: 12,
    borderRadius: borderRadius.lg,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: colors.border,
    ...shadows.card,
  },
  avatarWrap: {
    width: 54,
    height: 54,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceMuted,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  avatar: { width: "100%", height: "100%" },
  cardInfo: { flex: 1, minWidth: 0, marginLeft: 12, marginRight: 10 },
  shopName: {
    fontSize: 16,
    fontWeight: "800",
    color: colors.text,
  },
  metaLine: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    marginTop: 3,
    flexWrap: "wrap",
  },
  ratingText: { fontSize: 13, fontWeight: "800", color: colors.text },
  metaMuted: { fontSize: 12, fontWeight: "600", color: colors.textMuted },
  metaDot: { fontSize: 12, color: colors.textMuted, marginHorizontal: 2 },
  distanceText: { fontSize: 12, fontWeight: "700", color: colors.accent },
  address: {
    fontSize: 13,
    color: colors.textMuted,
    marginTop: 3,
    fontWeight: "500",
    flex: 1,
  },
  matchChip: {
    alignSelf: "flex-start",
    marginTop: 6,
    paddingVertical: 3,
    paddingHorizontal: 8,
    borderRadius: 999,
    backgroundColor: colors.accentSoft,
  },
  matchChipText: { fontSize: 11, fontWeight: "800", color: colors.accent },
  bookPill: {
    paddingVertical: 9,
    paddingHorizontal: 16,
    borderRadius: 999,
    backgroundColor: colors.accent,
  },
  bookPillText: { fontSize: 13, fontWeight: "800", color: colors.accentText },

  listPadding: {
    paddingBottom: Platform.select({ ios: 86, android: 92, default: 80 }),
  },

  emptyWrap: {
    alignItems: "center",
    justifyContent: "center",
    paddingTop: 32,
    paddingBottom: 40,
    gap: 6,
  },
  emptyIconCircle: {
    width: 50,
    height: 50,
    borderRadius: 999,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.accentSoft,
    marginBottom: 4,
  },
  emptyTitle: { color: colors.text, fontSize: 15, fontWeight: "800" },
  emptySub: {
    color: colors.textMuted,
    fontSize: 13,
    fontWeight: "600",
    textAlign: "center",
    paddingHorizontal: 24,
    lineHeight: 19,
  },
});
