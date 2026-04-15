import DateTimePicker from '@react-native-community/datetimepicker';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
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
    Modal,
    Platform,
    ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View
} from "react-native";
import MapView, { Marker } from 'react-native-maps';
import Icon from "react-native-vector-icons/Ionicons";
import { supabase } from "../../supabase/supabaseClient";
import { colors } from "../../theme/clientTheme";
import { resolveStorageImageUrl } from "../../utils/storageImageUrl";

export default function EditProfile() {
  const navigation = useNavigation();
  const [shopName, setShopName] = useState("");
  const [address, setAddress] = useState("");
  const [phone, setPhone] = useState(""); 
  const [description, setDescription] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [isEditingInfo, setIsEditingInfo] = useState(false);
  const [avatarUrl, setAvatarUrl] = useState(null);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);

  const [showPreview, setShowPreview] = useState(false);
  const [previewCoords, setPreviewCoords] = useState(null);
  const [selectedCoords, setSelectedCoords] = useState(null);
  const [mapSubtitle, setMapSubtitle] = useState("");
  const [selectedFormattedAddress, setSelectedFormattedAddress] = useState("");
  const mapRef = useRef(null);
  const formScrollRef = useRef(null);
  const [keyboardPad, setKeyboardPad] = useState(0);

  const [openingTime, setOpeningTime] = useState(new Date(new Date().setHours(8, 0, 0, 0)));
  const [closingTime, setClosingTime] = useState(new Date(new Date().setHours(17, 0, 0, 0)));
  const [showPicker, setShowPicker] = useState(null); 

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

  const loadBarberData = async () => {
    try {
      setLoading(true);
      const { data: { user } } = await supabase.auth.getUser();
      
      const { data: barberData } = await supabase.from("barbers").select("*").eq("id", user.id).single();
      const { data: profileData } = await supabase.from("profiles").select("avatar_url").eq("id", user.id).single();
      
      if (barberData) {
        setShopName(barberData.shop_name || "");
        setAddress(barberData.address || "");
        setPhone(barberData.phone_number || "");
        setDescription(barberData.description || barberData.slogan || "");
        
        const savedAvatar = barberData.avatar_url || profileData?.avatar_url;
        if (savedAvatar) {
          setAvatarUrl(resolveStorageImageUrl(savedAvatar));
        }

        if (barberData.latitude && barberData.longitude) {
          const coords = { latitude: barberData.latitude, longitude: barberData.longitude };
          setPreviewCoords(coords);
          setSelectedCoords(coords);
        }
        if (barberData.default_opening) setOpeningTime(parseTime(barberData.default_opening));
        if (barberData.default_closing) setClosingTime(parseTime(barberData.default_closing));
      }
    } catch (error) {
      console.error("Error loading profile:", error.message);
    } finally {
      setLoading(false);
    }
  };

  useFocusEffect(
    useCallback(() => {
      loadBarberData();
    }, [])
  );

  useEffect(() => {
    if (!showPreview || !previewCoords) return;
    const coord = selectedCoords || previewCoords;
    const id = setTimeout(() => {
      mapRef.current?.animateToRegion(
        {
          latitude: coord.latitude,
          longitude: coord.longitude,
          latitudeDelta: 0.0035,
          longitudeDelta: 0.0035,
        },
        350
      );
    }, 120);
    return () => clearTimeout(id);
  }, [showPreview]);

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
      // Using a unique timestamped path to avoid storage caching issues
      const filePath = `avatars/${user.id}-${Date.now()}.${fileExt}`;

      // Read as base64
      const base64 = await FileSystem.readAsStringAsync(photo.uri, {
        encoding: FileSystem.EncodingType.Base64,
      });

      // Upload using ArrayBuffer (Fixes 0-byte issue)
      const { error: uploadError } = await supabase.storage
        .from('avatars')
        .upload(filePath, decode(base64), {
          upsert: true,
          contentType: photo.mimeType || `image/${fileExt}`,
        });

      if (uploadError) throw uploadError;

      const { data: urlData } = supabase.storage.from('avatars').getPublicUrl(filePath);
      const publicUrl = urlData?.publicUrl;

      // Sync to both tables
      await supabase.from('barbers').update({ avatar_url: publicUrl }).eq('id', user.id);
      await supabase.from('profiles').update({ avatar_url: publicUrl }).eq('id', user.id);

      setAvatarUrl(resolveStorageImageUrl(publicUrl));
      Alert.alert('Success', 'Profile image updated');
    } catch (err) {
      setAvatarUrl(previousAvatar);
      Alert.alert('Upload Error', err.message);
    } finally { setUploadingAvatar(false); }
  };

  const handleSaveAll = async () => {
    setSaving(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      let latitude = selectedCoords?.latitude || previewCoords?.latitude;
      let longitude = selectedCoords?.longitude || previewCoords?.longitude;

      const updateData = {
        shop_name: shopName,
        address: address,
        phone_number: phone,
        description: description,
        default_opening: formatTime(openingTime),
        default_closing: formatTime(closingTime),
        latitude,
        longitude
      };

      let { error: barberError } = await supabase.from("barbers").update(updateData).eq("id", user.id);
      if (barberError && String(barberError.message || "").toLowerCase().includes("description")) {
        const fallbackData = { ...updateData, slogan: description };
        delete fallbackData.description;
        const fallback = await supabase.from("barbers").update(fallbackData).eq("id", user.id);
        barberError = fallback.error;
      }
      if (barberError) throw barberError;
      
      Alert.alert("Success", "Profile updated successfully!");
      navigation.goBack();
    } catch (error) {
      Alert.alert("Update Error", error.message);
    } finally {
      setSaving(false);
    }
  };

  const confirmSelectedLocation = async () => {
    const coord = selectedCoords || previewCoords;
    if (!coord) {
      setShowPreview(false);
      return;
    }

    if (selectedFormattedAddress) {
      setAddress(selectedFormattedAddress);
      setShowPreview(false);
      return;
    }

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
      // Keep existing address if reverse geocode fails.
    } finally {
      setShowPreview(false);
    }
  };

  const parseTime = (timeStr) => {
    const [h, m] = timeStr.split(':');
    const d = new Date();
    d.setHours(parseInt(h), parseInt(m), 0, 0);
    return d;
  };

  const formatTime = (date) => {
    return `${date.getHours().toString().padStart(2, '0')}:${date.getMinutes().toString().padStart(2, '0')}`;
  };

  if (loading) return <ActivityIndicator style={{ flex: 1, backgroundColor: colors.background }} size="large" color={colors.accent} />;

  return (
    <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={{ flex: 1 }}>
      <ScrollView
        ref={formScrollRef}
        style={styles.container}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode={Platform.OS === "ios" ? "interactive" : "on-drag"}
        contentContainerStyle={{ paddingBottom: 40 + keyboardPad + 20 }}
      >
        
        <Text style={styles.sectionHeader}>General Information</Text>
        <View style={styles.card}>
          <View style={styles.avatarContainerEdit}>
            <TouchableOpacity onPress={uploadBarberAvatar} disabled={uploadingAvatar || !isEditingInfo}>
              {avatarUrl ? (
                <Image key={avatarUrl} source={{ uri: avatarUrl }} style={styles.avatarImageEdit} resizeMode="cover" />
              ) : (
                <View style={styles.avatarPlaceholderEdit}>
                  <Icon name="person" size={48} color={colors.textMuted} />
                </View>
              )}
              <View style={styles.cameraIconEdit}>
                {uploadingAvatar ? <ActivityIndicator size="small" color="#fff" /> : <Icon name="camera" size={18} color="#fff" />}
              </View>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.editInfoToggleBtn, isEditingInfo && styles.editInfoToggleBtnActive]}
              onPress={() => setIsEditingInfo((prev) => !prev)}
            >
              <Icon name={isEditingInfo ? "checkmark-circle-outline" : "create-outline"} size={15} color={isEditingInfo ? "#fff" : colors.textMuted} />
              <Text style={[styles.editInfoHint, isEditingInfo && styles.editInfoHintActive]}>
                Tap to edit information.
              </Text>
            </TouchableOpacity>
          </View>

          <Text style={styles.label}>Shop Name</Text>
          <TextInput
            style={[styles.input, !isEditingInfo && styles.inputLocked]}
            value={shopName}
            onChangeText={setShopName}
            placeholder="Shop Name"
            editable={isEditingInfo}
            returnKeyType="done"
            onSubmitEditing={Keyboard.dismiss}
          />
          
          <Text style={styles.label}>Business Phone</Text>
          <TextInput
            style={[styles.input, !isEditingInfo && styles.inputLocked]}
            value={phone}
            onChangeText={setPhone}
            keyboardType="phone-pad"
            placeholder="Phone Number"
            editable={isEditingInfo}
            returnKeyType="done"
            onSubmitEditing={Keyboard.dismiss}
          />

          <Text style={styles.label}>Description / Slogan</Text>
          <TextInput
            style={[styles.input, styles.textArea, !isEditingInfo && styles.inputLocked]}
            value={description}
            onChangeText={setDescription}
            multiline
            placeholder="Describe your shop or add your slogan"
            editable={isEditingInfo}
            returnKeyType="done"
            blurOnSubmit
            onSubmitEditing={Keyboard.dismiss}
          />

          <Text style={styles.label}>Shop Address</Text>
          <TextInput
            style={[styles.input, styles.textArea, !isEditingInfo && styles.inputLocked]}
            value={address}
            onChangeText={setAddress}
            multiline
            placeholder="Address"
            editable={isEditingInfo}
            returnKeyType="done"
            blurOnSubmit
            onSubmitEditing={Keyboard.dismiss}
          />
          
          <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
            <TouchableOpacity
              style={[styles.timeBtn, !isEditingInfo && styles.disabledAction]}
              onPress={() => {
                setMapSubtitle(
                  address.trim()
                    ? address.trim()
                    : "Place the pin on your shop entrance."
                );
                setSelectedFormattedAddress(address.trim());
                setShowPreview(true);
              }}
              disabled={!isEditingInfo}
            >
              <Text style={styles.timeBtnText}>Adjust Map Pin</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.timeBtn, !isEditingInfo && styles.disabledAction]} disabled={!isEditingInfo} onPress={async () => {
                let { status } = await Location.requestForegroundPermissionsAsync();
                if (status === 'granted') {
                  const loc = await Location.getCurrentPositionAsync({});
                  setPreviewCoords(loc.coords); setSelectedCoords(loc.coords);
                  setSelectedFormattedAddress("");
                  setMapSubtitle("GPS position — drag the pin if this isn't your shop entrance.");
                  Alert.alert("Location Updated", "Pin moved to your current GPS position.");
                }
            }}>
              <Text style={styles.timeBtnText}>Use GPS</Text>
            </TouchableOpacity>
          </View>

          <Text style={[styles.label, { marginTop: 15 }]}>Operating Hours</Text>
          <View style={styles.row}>
            <TouchableOpacity style={[styles.timeBtn, !isEditingInfo && styles.disabledAction]} onPress={() => setShowPicker('opening')} disabled={!isEditingInfo}>
              <Text style={styles.timeBtnText}>Opens: {formatTime(openingTime)}</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.timeBtn, !isEditingInfo && styles.disabledAction]} onPress={() => setShowPicker('closing')} disabled={!isEditingInfo}>
              <Text style={styles.timeBtnText}>Closes: {formatTime(closingTime)}</Text>
            </TouchableOpacity>
          </View>
        </View>

        {showPicker && (
          <DateTimePicker
            value={showPicker === 'opening' ? openingTime : closingTime}
            mode="time"
            is24Hour={true}
            display="default"
            onChange={(event, date) => {
              setShowPicker(null);
              if (date) {
                if (showPicker === 'opening') setOpeningTime(date);
                else setClosingTime(date);
              }
            }}
          />
        )}

        <TouchableOpacity style={[styles.saveButton, !isEditingInfo && styles.saveButtonDisabled]} onPress={handleSaveAll} disabled={saving || !isEditingInfo}>
          {saving ? <ActivityIndicator color="#fff" /> : <Text style={styles.saveButtonText}>Save All Changes</Text>}
        </TouchableOpacity>

      <Modal visible={showPreview} animationType="slide">
        <View style={{ flex: 1, backgroundColor: colors.background }}>
          <View style={modalStyles.modalHeader}>
            <TouchableOpacity onPress={() => setShowPreview(false)} style={modalStyles.modalBackButton}>
              <Icon name="chevron-back" size={26} color="#fff" />
            </TouchableOpacity>
            <View style={{ flex: 1 }}>
              <Text style={modalStyles.modalHeaderTitle}>Place pin on your shop</Text>
              {mapSubtitle ? (
                <Text style={modalStyles.modalSubtitle} numberOfLines={2}>{mapSubtitle}</Text>
              ) : null}
            </View>
          </View>
          <Text style={modalStyles.mapHint}>
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
                setMapSubtitle("Custom position — align the pin with your shop entrance.");
              }}
            >
              <Marker
                coordinate={selectedCoords || previewCoords}
                draggable
                onDragEnd={(e) => {
                  setSelectedCoords(e.nativeEvent.coordinate);
                  setSelectedFormattedAddress("");
                  setMapSubtitle("Custom position — align the pin with your shop entrance.");
                }}
              />
            </MapView>
          ) : null}
          <TouchableOpacity style={modalStyles.fixedBottomBtn} onPress={confirmSelectedLocation}>
            <Text style={modalStyles.closeModalText}>Confirm location</Text>
          </TouchableOpacity>
        </View>
      </Modal>

      </ScrollView>
      {keyboardPad > 0 ? (
        <View style={[styles.keyboardDoneBar, { bottom: keyboardPad - 2 }]}>
          <TouchableOpacity style={styles.keyboardDoneBtn} onPress={Keyboard.dismiss} activeOpacity={0.85}>
            <Icon name="checkmark-circle-outline" size={16} color={colors.accent} />
            <Text style={styles.keyboardDoneText}>Done</Text>
          </TouchableOpacity>
        </View>
      ) : null}
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background, padding: 20 },
  sectionHeader: { fontSize: 18, fontWeight: "800", color: colors.accent, marginBottom: 12 },
  card: { backgroundColor: "rgba(255,255,255,0.03)", borderRadius: 12, padding: 15, marginBottom: 20, borderWidth: 1, borderColor: 'rgba(197,160,112,0.25)' },
  label: { fontSize: 13, fontWeight: "700", color: colors.textMuted, marginBottom: 8 },
  input: { borderWidth: 1, borderColor: 'rgba(197,160,112,0.2)', padding: 12, borderRadius: 8, marginBottom: 15, backgroundColor: "rgba(255,255,255,0.03)", color: colors.text },
  inputLocked: { backgroundColor: 'rgba(255,255,255,0.02)', color: colors.textMuted },
  textArea: { height: 60, textAlignVertical: "top" },
  row: { flexDirection: 'row', justifyContent: 'space-between' },
  timeBtn: { backgroundColor: 'rgba(255,255,255,0.03)', padding: 12, borderRadius: 8, flex: 0.48, alignItems: 'center', borderWidth: 1, borderColor: 'rgba(197,160,112,0.2)' },
  disabledAction: { opacity: 0.45 },
  timeBtnText: { fontWeight: '700', color: colors.text },
  saveButton: { backgroundColor: "#0A0A0A", padding: 18, borderRadius: 12, alignItems: "center", marginTop: 10, borderWidth: 1, borderColor: 'rgba(197,160,112,0.35)' },
  saveButtonDisabled: { backgroundColor: '#9ca3af' },
  saveButtonText: { color: colors.accent, fontWeight: "800", fontSize: 16 },
  avatarContainerEdit: { alignItems: 'center', marginBottom: 12 },
  avatarImageEdit: { width: 100, height: 100, borderRadius: 50, borderWidth: 2, borderColor: colors.accent },
  avatarPlaceholderEdit: { width: 100, height: 100, borderRadius: 50, backgroundColor: 'rgba(255,255,255,0.03)', justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: 'rgba(197,160,112,0.2)' },
  cameraIconEdit: { position: 'absolute', bottom: 0, right: 0, backgroundColor: '#0A0A0A', padding: 8, borderRadius: 20, borderWidth: 1, borderColor: 'rgba(197,160,112,0.35)' },
  editInfoToggleBtn: { marginTop: 10, flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.03)', paddingHorizontal: 12, paddingVertical: 7, borderRadius: 999, borderWidth: 1, borderColor: 'rgba(197,160,112,0.25)' },
  editInfoToggleBtnActive: { backgroundColor: '#0A0A0A', borderColor: 'rgba(197,160,112,0.45)' },
  editInfoHint: { marginLeft: 6, fontSize: 12, color: colors.textMuted, fontWeight: '500' },
  editInfoHintActive: { color: '#fff' },
  keyboardDoneBar: {
    position: "absolute",
    left: 12,
    right: 12,
    alignItems: "flex-end",
  },
  keyboardDoneBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "#0A0A0A",
    borderWidth: 1,
    borderColor: "rgba(197,160,112,0.45)",
    borderRadius: 999,
    paddingVertical: 8,
    paddingHorizontal: 12,
  },
  keyboardDoneText: {
    color: colors.accent,
    fontWeight: "800",
    fontSize: 13,
  },
});

const modalStyles = StyleSheet.create({
  modalHeader: { height: 80, paddingTop: 30, paddingHorizontal: 15, backgroundColor: '#0A0A0A', flexDirection: 'row', alignItems: 'center' },
  modalBackButton: { marginRight: 10 },
  modalHeaderTitle: { color: colors.accent, fontWeight: 'bold', fontSize: 16 },
  modalSubtitle: { color: colors.textMuted, fontSize: 12, marginTop: 4, lineHeight: 16 },
  mapHint: { paddingHorizontal: 14, paddingVertical: 10, color: colors.textMuted, fontSize: 12, lineHeight: 17, backgroundColor: 'rgba(0,0,0,0.35)' },
  fixedBottomBtn: { position: 'absolute', bottom: 30, left: 20, right: 20, backgroundColor: '#0A0A0A', padding: 15, borderRadius: 12, alignItems: 'center', borderWidth: 1, borderColor: 'rgba(197,160,112,0.35)' },
  closeModalText: { color: colors.accent, fontWeight: 'bold' },
});