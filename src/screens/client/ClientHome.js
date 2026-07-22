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
  View,
} from "react-native";
import MapView, { Callout, Marker } from "react-native-maps";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Icon from "react-native-vector-icons/Ionicons";
import { supabase } from "../../supabase/supabaseClient";
import { colors, borderRadius, shadows, typography } from "../../theme/clientTheme";
import { useClientThemeMode } from "../../theme/ClientThemeMode";
import { resolveStorageImageUrl } from "../../utils/storageImageUrl";

export default function ClientHome({ navigation }) {
  const insets = useSafeAreaInsets();
  const { colors: themeColors, isDark } = useClientThemeMode();
  const [barbers, setBarbers] = useState([]);
  const [filteredBarbers, setFilteredBarbers] = useState([]);
  const [tracksViewChanges, setTracksViewChanges] = useState(true);
  const [userLocation, setUserLocation] = useState(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [activeFilter, setActiveFilter] = useState("all");
  const [loading, setLoading] = useState(true);
  
  const mapRef = useRef(null); // Ref for map animation
  const bottomSheetRef = useRef(null);
  const snapPoints = useMemo(() => ["12%", "50%", "90%"], []);

  useEffect(() => {
    getUserLocationAndBarbers();
  }, []);

  useEffect(() => {
    const q = searchQuery.trim().toLowerCase();
    let next = [...barbers];

    if (q) {
      next = next.filter((b) =>
        (b.shop_name || "").toLowerCase().includes(q)
      );
    }

    if (activeFilter === "nearest") {
      next = next.filter((b) => b.distance != null).sort((a, b) => (a.distance || 999) - (b.distance || 999));
    } else if (activeFilter === "top") {
      next = next
        .filter((b) => b.averageRating != null)
        .sort((a, b) => Number(b.averageRating || 0) - Number(a.averageRating || 0));
    }

    setFilteredBarbers(next);
  }, [searchQuery, activeFilter, barbers]);

  useEffect(() => {
    // Prevent Android OOM: don't continuously re-render custom markers.
    setTracksViewChanges(true);
    const id = setTimeout(() => setTracksViewChanges(false), 900);
    return () => clearTimeout(id);
  }, [filteredBarbers.length, activeFilter, searchQuery]);

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

      // 3. Fetch ratings for all barbers (optional - table may not exist yet)
      let ratingsByBarber = {};
      try {
        const ids = (data || []).map((b) => b.id).filter(Boolean);
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
        latitude: barber.latitude,
        longitude: barber.longitude,
        latitudeDelta: 0.005, // Closer zoom
        longitudeDelta: 0.005,
      }, 1000);
      
      bottomSheetRef.current?.snapToIndex(0); // Show full map
      Keyboard.dismiss();
    }
  };

  const openBarberProfile = (barber) => {
    navigation.navigate("BarberProfile", { barberId: barber.id });
  };

  const renderBarberItem = ({ item }) => (
    <TouchableOpacity
      style={[styles.card, { backgroundColor: themeColors.surface, borderColor: themeColors.border }]}
      onPress={() => focusOnBarber(item)}
      activeOpacity={0.88}
    >
      <View style={[styles.avatarWrap, { borderColor: themeColors.border, backgroundColor: themeColors.surfaceAlt }]}>
        {item.avatar_url ? (
          <Image
            source={{ uri: resolveStorageImageUrl(item.avatar_url) }}
            style={styles.avatar}
            resizeMode="cover"
          />
        ) : (
          <Icon name="person-outline" size={18} color={themeColors.textMuted} />
        )}
      </View>
      <View style={styles.cardInfo}>
        <View style={styles.nameRow}>
          <Text style={[styles.shopName, { color: themeColors.text }]} numberOfLines={1}>{item.shop_name}</Text>
          {item.distance != null && (
            <View style={styles.distanceBadge}>
              <Icon name="navigate" size={12} color={colors.success} />
              <Text style={styles.distanceText}>{item.distance} km</Text>
            </View>
          )}
        </View>
        {item.averageRating != null && (
          <View style={styles.ratingRow}>
            <Icon name="star" size={14} color={colors.accent} />
            <Text style={styles.ratingText}>{item.averageRating} ({item.reviewCount})</Text>
          </View>
        )}
        <Text style={[styles.address, { color: themeColors.textSecondary }]} numberOfLines={2}>{item.address}</Text>
      </View>
      <TouchableOpacity
        style={[styles.viewProfileBtn, { backgroundColor: isDark ? "#241C0E" : "#F4EBDD", borderColor: themeColors.border }]}
        onPress={() => openBarberProfile(item)}
      >
        <Text style={[styles.viewProfileBtnText, { color: themeColors.accent }]}>Book</Text>
        <Icon name="chevron-forward" size={18} color={themeColors.accent} />
      </TouchableOpacity>
    </TouchableOpacity>
  );

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <View style={[styles.loadingIconWrap, { borderColor: themeColors.border, backgroundColor: themeColors.surface }]}>
          <Icon name="compass-outline" size={26} color={themeColors.accent} />
        </View>
        <ActivityIndicator size="large" color={themeColors.accent} />
        <Text style={[styles.loadingText, { color: themeColors.textSecondary }]}>Finding barbers near you...</Text>
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: themeColors.background }]}>
      <View
        style={[
          styles.mapHeader,
          {
            paddingTop: Math.max(insets.top, 6),
            backgroundColor: isDark ? "rgba(10,10,10,0.92)" : "rgba(247,244,238,0.95)",
            borderBottomColor: themeColors.border,
          },
        ]}
      >
        <Text style={[styles.mapHeaderTitle, { color: themeColors.text }]}>Find a barber</Text>
        <Text style={[styles.mapHeaderSub, { color: themeColors.textSecondary }]}>Tap pins or cards to preview and book.</Text>
      </View>
      <MapView
        ref={mapRef}
        style={styles.map}
        showsUserLocation={true}
        initialRegion={userLocation ? {
          latitude: userLocation.latitude,
          longitude: userLocation.longitude,
          latitudeDelta: 0.05,
          longitudeDelta: 0.05,
        } : undefined}
      >
        {filteredBarbers.slice(0, 25).map((barber) => (
          <Marker
            key={barber.id}
            coordinate={{ latitude: parseFloat(barber.latitude), longitude: parseFloat(barber.longitude) }}
            anchor={{ x: 0.5, y: 1 }}
            tracksViewChanges={tracksViewChanges}
          >
            <View
              style={[
                styles.shopMarker,
              ]}
            >
              <View
                style={[
                  styles.shopMarkerIcon,
                  {
                    backgroundColor: "#0A0A0A",
                    borderColor: "rgba(197,160,112,0.65)",
                  },
                ]}
              >
                <Icon name="cut-outline" size={14} color={"#F4E8D8"} />
              </View>
              <View
                style={[
                  styles.shopMarkerLabel,
                  {
                    backgroundColor: "#0A0A0A",
                    borderColor: "rgba(197,160,112,0.85)",
                  },
                ]}
              >
                <Text
                  style={[styles.shopMarkerText, { color: "#F8F5F0" }]}
                  numberOfLines={1}
                >
                  {barber.shop_name || "Salon"}
                </Text>
              </View>
            </View>
            <Callout
              onPress={() => navigation.navigate("BarberProfile", { barberId: barber.id })}
              style={styles.callout}
            >
              <View>
                <Text style={styles.calloutTitle}>{barber.shop_name}</Text>
                <Text style={styles.calloutBtn}>View & Book →</Text>
              </View>
            </Callout>
          </Marker>
        ))}
      </MapView>

      <TouchableOpacity
        style={[
          styles.centerBtn,
          {
            top: Math.max(insets.top, 6) + 48,
            right: 16,
            backgroundColor: isDark ? "#F4E8D8" : "#FFFFFF",
            borderColor: themeColors.border,
          },
        ]}
        onPress={centerOnUser}
        activeOpacity={0.8}
      >
        <Icon name="locate" size={24} color={isDark ? colors.primary : themeColors.accent} />
      </TouchableOpacity>

      <BottomSheet
        ref={bottomSheetRef}
        index={1}
        snapPoints={snapPoints}
        handleIndicatorStyle={styles.sheetIndicator}
        backgroundStyle={[
          styles.sheetBackground,
          { backgroundColor: themeColors.surfaceAlt, borderTopColor: themeColors.border },
        ]}
        handleStyle={[styles.sheetHandle, { backgroundColor: themeColors.surfaceAlt }]}
      >
        <View style={styles.contentContainer}>
          <Text style={[styles.sheetTitle, { color: themeColors.text }]}>Nearby barbers</Text>
          <Text style={[styles.sheetSubtitle, { color: themeColors.textSecondary }]}>Tap a pin or card to view and book</Text>
          <View style={styles.metaRow}>
            <View style={[styles.metaPill, { backgroundColor: themeColors.accentSoft, borderColor: themeColors.border }]}>
              <Icon name="location-outline" size={14} color={themeColors.accent} />
              <Text style={[styles.metaPillText, { color: themeColors.text }]}>{filteredBarbers.length} found</Text>
            </View>
            <View style={[styles.metaPill, { backgroundColor: themeColors.accentSoft, borderColor: themeColors.border }]}>
              <Icon name="sparkles-outline" size={14} color={themeColors.accent} />
              <Text style={[styles.metaPillText, { color: themeColors.text }]}>Top picks ready</Text>
            </View>
          </View>

          <View style={styles.filterRow}>
            <TouchableOpacity
              style={[
                styles.filterChip,
                {
                  backgroundColor: activeFilter === "all" ? themeColors.accentSoft : themeColors.surface,
                  borderColor: themeColors.border,
                },
              ]}
              onPress={() => setActiveFilter("all")}
              activeOpacity={0.85}
            >
              <Text style={[styles.filterChipText, { color: activeFilter === "all" ? themeColors.accent : themeColors.textMuted }]}>
                All
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[
                styles.filterChip,
                {
                  backgroundColor: activeFilter === "nearest" ? themeColors.accentSoft : themeColors.surface,
                  borderColor: themeColors.border,
                },
              ]}
              onPress={() => setActiveFilter("nearest")}
              activeOpacity={0.85}
            >
              <Text style={[styles.filterChipText, { color: activeFilter === "nearest" ? themeColors.accent : themeColors.textMuted }]}>
                Nearest
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[
                styles.filterChip,
                {
                  backgroundColor: activeFilter === "top" ? themeColors.accentSoft : themeColors.surface,
                  borderColor: themeColors.border,
                },
              ]}
              onPress={() => setActiveFilter("top")}
              activeOpacity={0.85}
            >
              <Text style={[styles.filterChipText, { color: activeFilter === "top" ? themeColors.accent : themeColors.textMuted }]}>
                Top rated
              </Text>
            </TouchableOpacity>
          </View>

          <View style={[styles.searchSection, { backgroundColor: themeColors.surface, borderColor: themeColors.border }]}>
            <Icon name="search" size={20} color={themeColors.textMuted} />
            <TextInput
              style={[styles.input, { color: themeColors.text }]}
              placeholder="Search by shop name..."
              placeholderTextColor={themeColors.textMuted}
              value={searchQuery}
              onChangeText={setSearchQuery}
              returnKeyType="done"
              onSubmitEditing={Keyboard.dismiss}
            />
          </View>

          <BottomSheetFlatList
            data={filteredBarbers}
            keyExtractor={(item) => item.id}
            renderItem={renderBarberItem}
            contentContainerStyle={styles.listPadding}
            ListEmptyComponent={
              <View style={styles.emptyWrap}>
                <View style={[styles.emptyIconCircle, { backgroundColor: themeColors.surface, borderColor: themeColors.border }]}>
                  <Icon name="search-outline" size={22} color={themeColors.accent} />
                </View>
                <Text style={[styles.emptyTitle, { color: themeColors.text }]}>No barber found</Text>
                <Text style={[styles.emptySub, { color: themeColors.textSecondary }]}>Try another shop name or clear search.</Text>
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
  mapHeader: {
    position: "absolute",
    left: 0,
    right: 0,
    top: 0,
    zIndex: 11,
    backgroundColor: "rgba(11,11,16,0.92)",
    borderBottomWidth: 1,
    borderBottomColor: "rgba(197,160,112,0.22)",
    paddingHorizontal: 18,
    paddingBottom: 8,
  },
  mapHeaderTitle: {
    color: "#F8F5F0",
    fontSize: 24,
    fontWeight: "900",
    letterSpacing: 0.2,
    marginTop: -1,
  },
  mapHeaderSub: {
    color: "#D4D4D8",
    fontSize: 12,
    fontWeight: "700",
    marginTop: 1,
  },
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
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 10,
  },
  loadingText: {
    marginTop: 12,
    fontSize: 15,
    color: colors.textSecondary,
    fontWeight: "700",
  },
  centerBtn: {
    position: "absolute",
    backgroundColor: "#F4E8D8",
    padding: 14,
    borderRadius: borderRadius.full,
    ...shadows.floating,
    zIndex: 10,
    borderWidth: 1,
    borderColor: "rgba(197,160,112,0.42)",
  },
  sheetBackground: {
    backgroundColor: "#0A0A0A",
    borderTopWidth: 1,
    borderTopColor: "rgba(197,160,112,0.30)",
  },
  sheetHandle: {
    backgroundColor: "#0A0A0A",
    borderTopLeftRadius: 18,
    borderTopRightRadius: 18,
  },
  sheetIndicator: {
    backgroundColor: "rgba(245,245,240,0.35)",
    width: 40,
  },
  contentContainer: { flex: 1, paddingHorizontal: 20, paddingTop: 8 },
  sheetTitle: {
    ...typography.titleSmall,
    color: "#F8F5F0",
    marginBottom: 4,
    fontWeight: "900",
  },
  sheetSubtitle: {
    fontSize: 14,
    color: "#CFCFD5",
    marginBottom: 16,
    fontWeight: "600",
  },
  metaRow: { flexDirection: "row", gap: 8, marginBottom: 10 },
  metaPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    borderWidth: 1,
    borderRadius: 999,
    paddingVertical: 6,
    paddingHorizontal: 10,
  },
  metaPillText: { fontSize: 12, fontWeight: "800" },
  filterRow: { flexDirection: "row", gap: 8, marginBottom: 10 },
  filterChip: {
    borderWidth: 1,
    borderRadius: 999,
    paddingVertical: 7,
    paddingHorizontal: 12,
  },
  filterChipText: { fontSize: 12, fontWeight: "800" },
  searchSection: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#121216",
    borderWidth: 1,
    borderColor: "rgba(197,160,112,0.22)",
    borderRadius: borderRadius.md,
    paddingHorizontal: 16,
    marginBottom: 20,
    height: 48,
  },
  input: {
    flex: 1,
    marginLeft: 12,
    fontSize: 16,
    color: "#F8F5F0",
    paddingVertical: 0,
  },
  card: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#121216",
    padding: 16,
    borderRadius: borderRadius.lg,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: "rgba(197,160,112,0.20)",
    ...shadows.card,
  },
  cardInfo: { flex: 1, marginRight: 12, minWidth: 0 },
  avatarWrap: {
    width: 48,
    height: 48,
    borderRadius: 999,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
    overflow: "hidden",
  },
  avatar: {
    width: "100%",
    height: "100%",
  },
  nameRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
  },
  shopName: {
    fontSize: 16,
    fontWeight: "900",
    color: "#F8F5F0",
    flex: 1,
  },
  distanceBadge: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(233,245,233,0.96)",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: borderRadius.sm,
    gap: 4,
  },
  distanceText: {
    color: colors.success,
    fontSize: 12,
    fontWeight: "600",
  },
  ratingRow: { flexDirection: "row", alignItems: "center", gap: 4, marginTop: 4 },
  ratingText: { fontSize: 13, fontWeight: "700", color: "#E8C18A" },
  address: {
    fontSize: 14,
    color: "#CFC6B8",
    marginTop: 4,
    lineHeight: 20,
    fontWeight: "600",
  },
  viewProfileBtn: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#241C0E",
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: "rgba(197,160,112,0.30)",
  },
  viewProfileBtnText: {
    fontSize: 15,
    fontWeight: "900",
    color: "#E8C18A",
    marginRight: 4,
  },
  listPadding: {
    paddingBottom: Platform.select({ ios: 86, android: 92, default: 80 }),
  },
  callout: {
    width: 180,
    padding: 12,
    alignItems: "center",
    backgroundColor: colors.surface,
    borderRadius: borderRadius.sm,
  },
  calloutTitle: {
    fontWeight: "600",
    fontSize: 14,
    textAlign: "center",
    color: colors.text,
  },
  calloutBtn: {
    color: colors.accent,
    textAlign: "center",
    marginTop: 6,
    fontSize: 12,
    fontWeight: "600",
  },
  shopMarker: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    maxWidth: 220,
    // Keep marker lightweight; avoid heavy shadows/elevation (Android memory).
  },
  shopMarkerIcon: {
    width: 26,
    height: 26,
    borderRadius: 999,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  shopMarkerLabel: {
    borderRadius: 999,
    borderWidth: 1,
    paddingVertical: 5,
    paddingHorizontal: 12,
    minWidth: 92,
    maxWidth: 210,
    justifyContent: "center",
  },
  shopMarkerText: {
    fontSize: 12.5,
    fontWeight: "800",
  },
  emptyWrap: {
    alignItems: "center",
    justifyContent: "center",
    paddingTop: 24,
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
    marginBottom: 4,
  },
  emptyTitle: { color: "#F8F5F0", fontSize: 15, fontWeight: "800" },
  emptySub: { color: "#B5B7C0", fontSize: 13, fontWeight: "600" },
});