import { useFocusEffect } from '@react-navigation/native';
import { decode } from 'base64-arraybuffer';
import * as FileSystem from 'expo-file-system/legacy';
import * as ImagePicker from 'expo-image-picker';
import * as Location from 'expo-location';
import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator, Alert,
  Image,
  Keyboard,
  KeyboardAvoidingView,
  Modal, Platform, ScrollView, StyleSheet,
  Text, TextInput, TouchableOpacity, View
} from "react-native";
import MapView, { Marker } from 'react-native-maps';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Icon from "react-native-vector-icons/Ionicons";
import KeyboardDoneBar from "../../components/common/KeyboardDoneBar";
import { useLightStatusBar } from "../../hooks/useLightStatusBar";
import { supabase } from "../../supabase/supabaseClient";
import { colors, shadows } from "../../theme/barberTheme";
import { geocodeAddressString } from "../../utils/geocodeAddress";
import { resolveStorageImageUrl } from "../../utils/storageImageUrl";

function normalizeDuration(value, fallback = 45) {
  const parsed = parseInt(String(value), 10);
  if (!Number.isFinite(parsed) || parsed <= 0) return fallback;
  return parsed;
}

async function insertBarberServices(supabaseClient, barberId, items) {
  const rows = items.map((s) => ({
    barber_id: barberId,
    service_name: s.name.trim(),
    price: parseFloat(String(s.price)) || 0,
    duration_minutes: normalizeDuration(s.durationMinutes, 45),
  }));
  let result = await supabaseClient.from("barber_services").insert(rows).select();
  if (result.error && String(result.error.message || "").toLowerCase().includes("duration_minutes")) {
    const fallbackRows = rows.map(({ duration_minutes, ...r }) => ({
      ...r,
      duration: duration_minutes,
    }));
    result = await supabaseClient.from("barber_services").insert(fallbackRows).select();
  }
  return result;
}

async function uploadServiceCoverImage(serviceId, localUri) {
  const base64 = await FileSystem.readAsStringAsync(localUri, {
    encoding: FileSystem.EncodingType.Base64,
  });
  const filePath = `services/${serviceId}-${Date.now()}.jpg`;
  const { error: upErr } = await supabase.storage
    .from("avatars")
    .upload(filePath, decode(base64), { contentType: "image/jpeg", cacheControl: "0" });
  if (upErr) throw upErr;
  const { data: urlData } = supabase.storage.from("avatars").getPublicUrl(filePath);
  return urlData?.publicUrl ?? null;
}

export default function ProfileSetup({ navigation }) {
  useLightStatusBar(colors.background);
  const insets = useSafeAreaInsets();
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [avatarUrl, setAvatarUrl] = useState(null);
  const [shopName, setShopName] = useState("");
  const [address, setAddress] = useState("");
  const [phone, setPhone] = useState(""); 
  const [description, setDescription] = useState("");
  const [services, setServices] = useState([]);
  const [loading, setLoading] = useState(false);
  const [newServiceName, setNewServiceName] = useState("");
  const [newServicePrice, setNewServicePrice] = useState("");
  const [newServiceDuration, setNewServiceDuration] = useState("45");
  const [newServiceImageUri, setNewServiceImageUri] = useState(null);

  const [showPreview, setShowPreview] = useState(false);
  const [previewCoords, setPreviewCoords] = useState(null);
  const [selectedCoords, setSelectedCoords] = useState(null);
  const [geoCandidates, setGeoCandidates] = useState([]);
  const [mapSubtitle, setMapSubtitle] = useState("");
  const [selectedFormattedAddress, setSelectedFormattedAddress] = useState("");
  const mapRef = useRef(null);
  const formScrollRef = useRef(null);
  const [keyboardPad, setKeyboardPad] = useState(0);

  useEffect(() => {
    const showEvt = Platform.OS === "ios" ? "keyboardWillShow" : "keyboardDidShow";
    const hideEvt = Platform.OS === "ios" ? "keyboardWillHide" : "keyboardDidHide";
    const onShow = (e) => setKeyboardPad(e?.endCoordinates?.height ?? 0);
    const onHide = () => setKeyboardPad(0);
    const subShow = Keyboard.addListener(showEvt, onShow);
    const subHide = Keyboard.addListener(hideEvt, onHide);
    return () => {
      subShow.remove();
      subHide.remove();
    };
  }, []);

  const scrollServicesIntoView = () => {
    requestAnimationFrame(() => {
      formScrollRef.current?.scrollToEnd({ animated: true });
    });
  };

  const fetchProfile = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const [{ data: barber }, { data: profile }] = await Promise.all([
        supabase.from('barbers').select('*').eq('id', user.id).maybeSingle(),
        supabase.from('profiles').select('avatar_url').eq('id', user.id).maybeSingle(),
      ]);

      if (barber) {
        setShopName(barber.shop_name || "");
        setAddress(barber.address || "");
        setPhone(barber.phone_number || "");
        setDescription(barber.description || barber.slogan || "");
      }

      const savedAvatar = barber?.avatar_url || profile?.avatar_url;
      if (savedAvatar) {
        setAvatarUrl(resolveStorageImageUrl(savedAvatar));
      }

      const { data: servicesData } = await supabase
        .from('barber_services')
        .select('*')
        .eq('barber_id', user.id);

      if (servicesData && servicesData.length > 0) {
        setServices(
          servicesData.map((s) => ({
            name: s.service_name,
            price: String(s.price ?? ""),
            durationMinutes: String(
              normalizeDuration(s.duration_minutes ?? s.duration, 45)
            ),
            imageUrl: s.image_url || null,
            localImageUri: null,
          }))
        );
      }
    } catch (error) {
      console.log("Error loading profile:", error);
    }
  };

  useFocusEffect(
    useCallback(() => {
      fetchProfile();
    }, [])
  );

  const uploadBarberAvatar = async () => {
    let previousAvatar = null;
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        quality: 0.6,
      });
      if (result.canceled) return;

      const photo = result.assets[0];
      previousAvatar = avatarUrl;
      setAvatarUrl(photo.uri);
      setUploadingAvatar(true);

      const { data: { user } } = await supabase.auth.getUser();
      const fileExt = photo.uri.split('.').pop();
      const filePath = `avatars/${user.id}-${Date.now()}.${fileExt}`;

      // 1. Convert to Base64
      const base64 = await FileSystem.readAsStringAsync(photo.uri, {
        encoding: FileSystem.EncodingType.Base64,
      });

      // 2. Upload using ArrayBuffer (Fixes 0-byte issue)
      const { error: uploadError } = await supabase.storage
        .from('avatars')
        .upload(filePath, decode(base64), {
          upsert: true,
          contentType: photo.mimeType || `image/${fileExt}`,
        });

      if (uploadError) throw uploadError;

      // 3. Get URL
      const { data: urlData } = supabase.storage.from('avatars').getPublicUrl(filePath);
      const publicUrl = urlData?.publicUrl;

      // 4. Update Tables
      await supabase.from('barbers').upsert({ id: user.id, avatar_url: publicUrl });
      await supabase.from('profiles').update({ avatar_url: publicUrl }).eq('id', user.id);

      setAvatarUrl(resolveStorageImageUrl(publicUrl));
      Alert.alert('Success', 'Profile image updated');
    } catch (err) {
      setAvatarUrl(previousAvatar);
      Alert.alert('Upload Error', err.message);
    } finally {
      setUploadingAvatar(false);
    }
  };

  const handleSaveProfile = async () => {
    if (!shopName || !address || !phone) {
      Alert.alert("Error", "Please fill in all business details.");
      return;
    }
    const servicesToSave = services.filter((s) => s.name.trim());
    if (servicesToSave.length === 0) {
      Alert.alert(
        "Add at least one service",
        "List the services you offer with duration (minutes) and price."
      );
      return;
    }
    setLoading(true);
    try {
      let { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') throw new Error('Location permission required.');

      let latitude, longitude;
      if (selectedCoords) {
        latitude = selectedCoords.latitude;
        longitude = selectedCoords.longitude;
      } else {
        let location = await Location.getCurrentPositionAsync({});
        latitude = location.coords.latitude;
        longitude = location.coords.longitude;
      }

      const { data: { user } } = await supabase.auth.getUser();

      let { error: barberError } = await supabase.from("barbers").upsert({
        id: user.id,
        shop_name: shopName,
        address: address,
        phone_number: phone, 
        description: description,
        latitude: latitude,
        longitude: longitude,
        is_profile_complete: true,
      });
      if (barberError && String(barberError.message || "").toLowerCase().includes("description")) {
        const fallback = await supabase.from("barbers").upsert({
          id: user.id,
          shop_name: shopName,
          address: address,
          phone_number: phone,
          slogan: description,
          latitude: latitude,
          longitude: longitude,
          is_profile_complete: true,
        });
        barberError = fallback.error;
      }
      if (barberError) throw barberError;

      await supabase.from("barber_services").delete().eq("barber_id", user.id);
      const { data: insertedServices, error: serviceError } = await insertBarberServices(
        supabase,
        user.id,
        servicesToSave
      );
      if (serviceError) throw serviceError;

      if (insertedServices?.length === servicesToSave.length) {
        for (let i = 0; i < insertedServices.length; i++) {
          const row = insertedServices[i];
          const src = servicesToSave[i];
          try {
            if (src.localImageUri) {
              const url = await uploadServiceCoverImage(row.id, src.localImageUri);
              if (url) {
                await supabase.from("barber_services").update({ image_url: url }).eq("id", row.id);
              }
            } else if (src.imageUrl) {
              await supabase
                .from("barber_services")
                .update({ image_url: src.imageUrl })
                .eq("id", row.id);
            }
          } catch (imgErr) {
            console.warn("Service image step failed:", imgErr?.message || imgErr);
          }
        }
      }

      // SaaS flow: create default locked state and open subscription paywall.
      const { data: existingSub } = await supabase
        .from("barber_subscription_state")
        .select("shop_status")
        .eq("barber_id", user.id)
        .maybeSingle();

      if (!existingSub || existingSub.shop_status !== "active") {
        await supabase.from("barber_subscription_state").upsert(
          {
            barber_id: user.id,
            shop_status: "locked",
            subscription_status: "none",
          },
          { onConflict: "barber_id" }
        );
      }

      navigation.reset({ index: 0, routes: [{ name: "SubscriptionPaywall" }] });
    } catch (error) {
      Alert.alert("Setup Error", error.message);
    } finally {
      setLoading(false);
    }
  };

  const updateServicePrice = (index, newPrice) => {
    const updated = [...services];
    updated[index].price = newPrice;
    setServices(updated);
  };

  const updateServiceDuration = (index, value) => {
    const updated = [...services];
    updated[index].durationMinutes = value;
    setServices(updated);
  };

  const updateServiceName = (index, newName) => {
    const updated = [...services];
    updated[index].name = newName;
    setServices(updated);
  };

  const pickServiceImageAtIndex = async (index) => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      quality: 0.65,
    });
    if (result.canceled) return;
    const uri = result.assets[0]?.uri;
    if (!uri) return;
    setServices((prev) => {
      const next = [...prev];
      next[index] = { ...next[index], localImageUri: uri };
      return next;
    });
  };

  const clearServiceImageAtIndex = (index) => {
    setServices((prev) => {
      const next = [...prev];
      next[index] = { ...next[index], localImageUri: null, imageUrl: null };
      return next;
    });
  };

  const pickNewServiceImage = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      quality: 0.65,
    });
    if (result.canceled) return;
    const uri = result.assets[0]?.uri;
    if (uri) setNewServiceImageUri(uri);
  };

  const handleAddService = () => {
    if (!newServiceName.trim()) return;
    setServices([
      ...services,
      {
        name: newServiceName.trim(),
        price: newServicePrice || "0",
        durationMinutes: newServiceDuration || "45",
        imageUrl: null,
        localImageUri: newServiceImageUri || null,
      },
    ]);
    setNewServiceName("");
    setNewServicePrice("");
    setNewServiceDuration("45");
    setNewServiceImageUri(null);
  };

  const handleDeleteService = (index) => {
    setServices(services.filter((_, i) => i !== index));
  };

  const applyGeocodeCandidate = useCallback((c, opts = {}) => {
    const { fromList } = opts;
    const coord = { latitude: c.latitude, longitude: c.longitude };
    setPreviewCoords(coord);
    setSelectedCoords(coord);
    if (c.formattedAddress) {
      setSelectedFormattedAddress(c.formattedAddress);
      setAddress(c.formattedAddress);
    }
    if (fromList) {
      if (c.formattedAddress) setMapSubtitle(c.formattedAddress);
      else if (opts.fallbackText) setMapSubtitle(opts.fallbackText);
    }
    setTimeout(() => {
      mapRef.current?.animateToRegion(
        {
          ...coord,
          latitudeDelta: 0.0035,
          longitudeDelta: 0.0035,
        },
        350
      );
    }, 80);
  }, []);

  const handleSearchAddress = async () => {
    const trimmed = address.trim();
    if (!trimmed) return;
    try {
      const { candidates } = await geocodeAddressString(trimmed);
      setGeoCandidates(candidates);
      if (candidates?.[0]?.formattedAddress) {
        setAddress(candidates[0].formattedAddress);
        setSelectedFormattedAddress(candidates[0].formattedAddress);
      }
      applyGeocodeCandidate(candidates[0], { fromList: true, fallbackText: trimmed });
      setShowPreview(true);
    } catch (err) {
      if (err?.code === "GOOGLE_REQUEST_DENIED") {
        Alert.alert(
          "Google key can’t search addresses",
          "Geocoding is enabled, but keys restricted to “Android apps” usually fail for address search (HTTPS). In Google Cloud → Credentials: open your key → Application restrictions → None, and keep API restrictions limited to Geocoding API + Maps SDK. Or add a second key in app.json under extra.googleGeocodingApiKey (same settings, no Android-only restriction)."
        );
        return;
      }
      if (err?.code === "GOOGLE_OVER_QUERY_LIMIT") {
        Alert.alert("Address lookup", err.message || "Geocoding quota exceeded. Try again later.");
        return;
      }
      if (String(err?.code || "").startsWith("GOOGLE_")) {
        Alert.alert("Address lookup", err.message || "Google Geocoding error.");
        return;
      }
      const code = err?.message;
      const hint =
        code === "ZERO_RESULTS" || code === "EMPTY_ADDRESS"
          ? "Try adding suburb and city, e.g. 1742 Nephawe Street, Polokwane, Limpopo."
          : "Check your internet connection. If it keeps failing, add city and province.";
      Alert.alert("Address not found", hint);
    }
  };

  const scrollPadBottom = 32 + keyboardPad + Platform.select({ ios: 12, android: 24, default: 16 });

  const confirmSelectedLocation = async () => {
    const coord = selectedCoords || previewCoords;
    if (!coord) {
      setShowPreview(false);
      return;
    }

    // If user picked a candidate with formatted text, persist it directly.
    if (selectedFormattedAddress) {
      setAddress(selectedFormattedAddress);
      setShowPreview(false);
      return;
    }

    // If user moved the pin manually, try reverse geocoding to extract full address.
    try {
      const reversed = await Location.reverseGeocodeAsync(coord);
      const r = reversed?.[0];
      if (r) {
        const parts = [
          [r.streetNumber, r.street].filter(Boolean).join(" ").trim(),
          r.district,
          r.city || r.subregion,
          r.region,
          r.postalCode,
          r.country,
        ].filter(Boolean);
        if (parts.length > 0) {
          const full = parts.join(", ");
          setAddress(full);
          setSelectedFormattedAddress(full);
          setMapSubtitle(full);
        }
      }
    } catch (_) {
      // Keep existing typed address if reverse geocode fails.
    } finally {
      setShowPreview(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.keyboardRoot}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      keyboardVerticalOffset={Platform.OS === "ios" ? 0 : 0}
    >
    <ScrollView
      ref={formScrollRef}
      keyboardShouldPersistTaps="handled"
      keyboardDismissMode={Platform.OS === "ios" ? "interactive" : "on-drag"}
      contentInsetAdjustmentBehavior="automatic"
      contentContainerStyle={[styles.container, { paddingBottom: scrollPadBottom }]}
      bounces={false}
      overScrollMode="never"
    >
      <Text style={[styles.header, { marginTop: Math.max(insets.top, 24) + 24 }]}>Business Setup</Text>
      
      <View style={styles.section}>
        <View style={styles.avatarContainer}>
          <TouchableOpacity onPress={uploadBarberAvatar} disabled={uploadingAvatar}>
            {avatarUrl ? (
              <Image key={avatarUrl} source={{ uri: avatarUrl }} style={styles.avatar} resizeMode="cover" />
            ) : (
              <View style={styles.avatarPlaceholder}>
                <Icon name="person" size={48} color={colors.textMuted} />
              </View>
            )}
            <View style={styles.cameraIcon}>
              {uploadingAvatar ? <ActivityIndicator size="small" color="#fff" /> : <Icon name="camera" size={18} color="#fff" />}
            </View>
          </TouchableOpacity>
        </View>

        <Text style={styles.fieldLabel}>Business Name</Text>
        <TextInput
          placeholder="Business Name"
          style={styles.input}
          value={shopName}
          onChangeText={setShopName}
          returnKeyType="done"
          onSubmitEditing={Keyboard.dismiss}
        />

        <Text style={styles.fieldLabel}>Business Phone</Text>
        <TextInput
          placeholder="Phone Number"
          style={styles.input}
          value={phone}
          onChangeText={setPhone}
          keyboardType="phone-pad"
          returnKeyType="done"
          onSubmitEditing={Keyboard.dismiss}
        />

        <Text style={styles.fieldLabel}>Description / Slogan</Text>
        <TextInput
          placeholder="Describe your business or add your slogan"
          style={[styles.input, styles.textArea]}
          value={description}
          onChangeText={setDescription}
          multiline
          returnKeyType="done"
          blurOnSubmit
          onSubmitEditing={Keyboard.dismiss}
        />

        <Text style={styles.fieldLabel}>Physical Address</Text>
        <TextInput
          placeholder="Address"
          style={[styles.input, styles.textArea]}
          value={address}
          onChangeText={setAddress}
          multiline
          returnKeyType="done"
          blurOnSubmit
          onSubmitEditing={Keyboard.dismiss}
        />
        
        <TouchableOpacity style={styles.previewBtn} onPress={handleSearchAddress}>
          <Icon name="search-outline" size={20} color={colors.accent} />
          <Text style={styles.previewBtnText}>Find Address on Map</Text>
        </TouchableOpacity>
      </View>

      <Modal visible={showPreview} animationType="slide">
        <View style={{ flex: 1, backgroundColor: colors.background }}>
            <View style={styles.modalHeader}>
              <TouchableOpacity onPress={() => setShowPreview(false)} style={styles.modalBackButton}>
                <Icon name="chevron-back" size={26} color={colors.text} />
              </TouchableOpacity>
              <View style={{ flex: 1 }}>
                <Text style={styles.modalHeaderTitle}>Place pin on your business</Text>
                {mapSubtitle ? (
                  <Text style={styles.modalSubtitle} numberOfLines={2}>{mapSubtitle}</Text>
                ) : null}
              </View>
            </View>
            {geoCandidates.length > 1 ? (
              <View style={styles.candidateStrip}>
                <Text style={styles.candidateStripLabel}>Other matches</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.candidateChips}>
                  {geoCandidates.map((c, idx) => (
                    <TouchableOpacity
                      key={`${c.latitude}-${c.longitude}-${idx}`}
                      style={styles.candidateChip}
                      onPress={() => {
                        applyGeocodeCandidate(c, { fromList: true });
                      }}
                    >
                      <Text style={styles.candidateChipText} numberOfLines={2}>
                        {c.formattedAddress || `Match ${idx + 1}`}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              </View>
            ) : null}
            <Text style={styles.mapHint}>
              Drag the pin or tap the map so it sits on your entrance. Zoom in if needed.
            </Text>
            {previewCoords ? (
              <MapView
                ref={mapRef}
                style={{ flex: 1 }}
                initialRegion={{
                  latitude: previewCoords.latitude,
                  longitude: previewCoords.longitude,
                  latitudeDelta: 0.0035,
                  longitudeDelta: 0.0035,
                }}
                onPress={(e) => {
                  setSelectedCoords(e.nativeEvent.coordinate);
                  setSelectedFormattedAddress("");
                  setMapSubtitle("Custom position — align the pin with your entrance.");
                }}
              >
                <Marker
                  coordinate={selectedCoords || previewCoords}
                  draggable
                  onDragEnd={(e) => {
                    const coord = e.nativeEvent.coordinate;
                    setSelectedCoords(coord);
                    setSelectedFormattedAddress("");
                    setMapSubtitle("Custom position — align the pin with your entrance.");
                  }}
                />
              </MapView>
            ) : null}
            <TouchableOpacity style={styles.modalButtonFixed} onPress={confirmSelectedLocation}>
                <Text style={styles.closeModalText}>Confirm location</Text>
            </TouchableOpacity>
        </View>
      </Modal>

      <Text style={styles.label}>Services & prices</Text>
      <Text style={styles.servicesHint}>
        Add each service — name, optional photo, duration (minutes), and price. Photos show to clients on your service list.
      </Text>
      {services.map((service, index) => {
        const thumbUri =
          service.localImageUri ||
          (service.imageUrl ? resolveStorageImageUrl(service.imageUrl) : null);
        const hasImage = !!(service.localImageUri || service.imageUrl);
        return (
        <View key={index} style={styles.serviceCard}>
          <View style={styles.serviceTopRow}>
            <View style={styles.serviceThumbWrap}>
              <TouchableOpacity onPress={() => pickServiceImageAtIndex(index)} activeOpacity={0.85}>
                {thumbUri ? (
                  <Image source={{ uri: thumbUri }} style={styles.serviceThumb} resizeMode="cover" />
                ) : (
                  <View style={styles.serviceThumbPlaceholder}>
                    <Icon name="image-outline" size={22} color={colors.textMuted} />
                    <Text style={styles.serviceThumbLabel}>Photo</Text>
                  </View>
                )}
              </TouchableOpacity>
              {hasImage ? (
                <TouchableOpacity
                  style={styles.clearThumbBtn}
                  onPress={() => clearServiceImageAtIndex(index)}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                >
                  <Icon name="close-circle" size={22} color={colors.error} />
                </TouchableOpacity>
              ) : null}
            </View>
            <TextInput
              placeholder="Service name"
              style={[styles.input, styles.serviceNameInputFlex]}
              value={service.name}
              onChangeText={(text) => updateServiceName(index, text)}
              onFocus={scrollServicesIntoView}
            />
          </View>
          <View style={styles.serviceMetaRow}>
            <View style={styles.durationBlock}>
              <Text style={styles.durationLabel}>Min</Text>
              <TextInput
                keyboardType="numeric"
                placeholder="45"
                style={styles.durationInput}
                value={String(service.durationMinutes ?? "45")}
                onChangeText={(text) => updateServiceDuration(index, text)}
                onFocus={scrollServicesIntoView}
              />
            </View>
            <View style={styles.priceBlock}>
              <Text style={styles.currency}>R</Text>
              <TextInput
                keyboardType="numeric"
                style={styles.priceInputWide}
                value={service.price}
                onChangeText={(text) => updateServicePrice(index, text)}
                onFocus={scrollServicesIntoView}
              />
            </View>
            <TouchableOpacity onPress={() => handleDeleteService(index)} style={styles.deleteServiceBtn}>
              <Icon name="trash-outline" size={20} color={colors.error} />
            </TouchableOpacity>
          </View>
        </View>
        );
      })}

      <Text style={styles.fieldLabel}>Add a service</Text>
      <View style={styles.serviceTopRow}>
        <View style={styles.serviceThumbWrap}>
          <TouchableOpacity onPress={pickNewServiceImage} activeOpacity={0.85}>
            {newServiceImageUri ? (
              <Image source={{ uri: newServiceImageUri }} style={styles.serviceThumb} resizeMode="cover" />
            ) : (
              <View style={styles.serviceThumbPlaceholder}>
                <Icon name="add-outline" size={22} color={colors.accent} />
                <Text style={styles.serviceThumbLabel}>Photo</Text>
              </View>
            )}
          </TouchableOpacity>
          {newServiceImageUri ? (
            <TouchableOpacity
              style={styles.clearThumbBtn}
              onPress={() => setNewServiceImageUri(null)}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <Icon name="close-circle" size={22} color={colors.error} />
            </TouchableOpacity>
          ) : null}
        </View>
        <TextInput
          placeholder="Service name"
          style={[styles.input, styles.serviceNameInputFlex]}
          value={newServiceName}
          onChangeText={setNewServiceName}
          onFocus={scrollServicesIntoView}
        />
      </View>
      <View style={styles.addServiceMetaRow}>
        <View style={styles.durationBlock}>
          <Text style={styles.durationLabel}>Min</Text>
          <TextInput
            keyboardType="numeric"
            placeholder="45"
            style={styles.durationInput}
            value={newServiceDuration}
            onChangeText={setNewServiceDuration}
            onFocus={scrollServicesIntoView}
          />
        </View>
        <View style={styles.priceBlock}>
          <Text style={styles.currency}>R</Text>
          <TextInput
            keyboardType="numeric"
            placeholder="0"
            style={styles.priceInputWide}
            value={newServicePrice}
            onChangeText={setNewServicePrice}
            onFocus={scrollServicesIntoView}
          />
        </View>
        <TouchableOpacity onPress={handleAddService} style={styles.addServiceFab}>
          <Icon name="add-circle" size={36} color={colors.accent} />
        </TouchableOpacity>
      </View>

      <TouchableOpacity style={styles.button} onPress={handleSaveProfile} disabled={loading}>
        {loading ? <ActivityIndicator color={colors.accentText} /> : <Text style={styles.buttonText}>Finish & Go Live</Text>}
      </TouchableOpacity>
    </ScrollView>
    <KeyboardDoneBar inset={keyboardPad} />
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  keyboardRoot: { flex: 1, backgroundColor: colors.background },
  container: { padding: 25, paddingBottom: 25, backgroundColor: colors.background, flexGrow: 1 },
  header: { fontSize: 26, fontWeight: "800", marginBottom: 20, color: colors.text },
  section: { marginBottom: 20 },
  label: { fontSize: 18, fontWeight: "800", marginBottom: 15, color: colors.text },
  input: { borderWidth: 1, borderColor: colors.border, padding: 12, borderRadius: 12, backgroundColor: colors.surface, marginBottom: 10, color: colors.text },
  textArea: { height: 60, textAlignVertical: 'top' },
  previewBtn: { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.surface, padding: 12, borderRadius: 10, marginTop: 5, borderWidth: 1, borderColor: colors.border },
  previewBtnText: { marginLeft: 10, fontWeight: '700', color: colors.text },
  modalHeader: { height: 80, paddingTop: 30, paddingHorizontal: 15, backgroundColor: colors.surface, flexDirection: 'row', alignItems: 'center', borderBottomWidth: 1, borderBottomColor: colors.border },
  modalBackButton: { marginRight: 10 },
  modalHeaderTitle: { color: colors.text, fontWeight: 'bold', fontSize: 16 },
  modalSubtitle: { color: colors.textMuted, fontSize: 12, marginTop: 4, lineHeight: 16 },
  candidateStrip: { paddingVertical: 10, paddingHorizontal: 12, backgroundColor: colors.surfaceMuted, borderBottomWidth: 1, borderBottomColor: colors.border },
  candidateStripLabel: { color: colors.textMuted, fontSize: 11, fontWeight: '700', marginBottom: 8, textTransform: 'uppercase', letterSpacing: 0.5 },
  candidateChips: { paddingRight: 12, flexDirection: 'row', alignItems: 'flex-start' },
  candidateChip: { maxWidth: 220, paddingVertical: 8, paddingHorizontal: 12, borderRadius: 10, backgroundColor: colors.accentSoft, borderWidth: 1, borderColor: colors.accent, marginRight: 8 },
  candidateChipText: { color: colors.text, fontSize: 12, lineHeight: 16 },
  mapHint: { paddingHorizontal: 14, paddingVertical: 10, color: colors.textSecondary, fontSize: 12, lineHeight: 17, backgroundColor: colors.surfaceMuted },
  modalButtonFixed: { position: 'absolute', bottom: 30, left: 20, right: 20, backgroundColor: colors.accent, padding: 15, borderRadius: 12, alignItems: 'center', ...shadows.floating },
  closeModalText: { color: colors.accentText, fontWeight: 'bold' },
  avatarContainer: { alignItems: 'center', marginBottom: 18 },
  avatar: { width: 100, height: 100, borderRadius: 50, borderWidth: 2, borderColor: colors.accent },
  avatarPlaceholder: { width: 100, height: 100, borderRadius: 50, backgroundColor: colors.surfaceMuted, justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: colors.border },
  cameraIcon: { position: 'absolute', bottom: 0, right: 0, backgroundColor: colors.accent, padding: 8, borderRadius: 20, borderWidth: 2, borderColor: colors.surface },
  servicesHint: { fontSize: 13, color: colors.textMuted, marginBottom: 14, lineHeight: 19 },
  serviceCard: {
    marginBottom: 16,
    paddingBottom: 14,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  serviceTopRow: { flexDirection: "row", alignItems: "flex-start", marginBottom: 8 },
  serviceThumbWrap: {
    width: 72,
    marginRight: 10,
    position: "relative",
  },
  serviceThumb: {
    width: 72,
    height: 72,
    borderRadius: 12,
    backgroundColor: colors.surfaceMuted,
    borderWidth: 1,
    borderColor: colors.border,
  },
  serviceThumbPlaceholder: {
    width: 72,
    height: 72,
    borderRadius: 12,
    backgroundColor: colors.surfaceMuted,
    borderWidth: 1,
    borderColor: colors.border,
    justifyContent: "center",
    alignItems: "center",
  },
  serviceThumbLabel: { fontSize: 9, color: colors.textMuted, marginTop: 2, fontWeight: "600" },
  clearThumbBtn: { position: "absolute", top: -6, right: -6, backgroundColor: colors.surface, borderRadius: 12 },
  serviceNameInput: { marginBottom: 8 },
  serviceNameInputFlex: { flex: 1, marginBottom: 0, minHeight: 48 },
  serviceMetaRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  durationBlock: { flexDirection: "row", alignItems: "center" },
  durationLabel: { fontSize: 12, fontWeight: "700", color: colors.textMuted, marginRight: 8, width: 34 },
  durationInput: {
    width: 52,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 8,
    textAlign: "center",
    color: colors.text,
    backgroundColor: colors.surface,
  },
  priceBlock: { flexDirection: "row", alignItems: "center", flex: 1, marginLeft: 12, marginRight: 8 },
  currency: { marginRight: 4, fontWeight: "bold", color: colors.accent },
  priceInputWide: {
    flex: 1,
    minWidth: 56,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 10,
    color: colors.text,
    backgroundColor: colors.surface,
  },
  deleteServiceBtn: { padding: 6 },
  addServiceMetaRow: { flexDirection: "row", alignItems: "center", marginBottom: 8 },
  addServiceFab: { marginLeft: 4, paddingVertical: 4 },
  button: { backgroundColor: colors.accent, padding: 18, borderRadius: 12, alignItems: "center", marginTop: 30, marginBottom: 50, ...shadows.button },
  buttonText: { color: colors.accentText, fontWeight: "bold", fontSize: 16 },
  fieldLabel: { fontSize: 12, fontWeight: 'bold', color: colors.textMuted, marginBottom: 4 },
});