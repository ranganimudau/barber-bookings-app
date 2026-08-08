import { decode } from 'base64-arraybuffer';
import * as FileSystem from 'expo-file-system/legacy';
import * as ImagePicker from 'expo-image-picker';
import React, { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator, Alert, FlatList, Image, Keyboard, Modal,
  Platform, RefreshControl, StatusBar, StyleSheet, Text, TextInput,
  TouchableOpacity, View
} from "react-native";
import Icon from "react-native-vector-icons/Ionicons";
import KeyboardDoneBar from "../../components/common/KeyboardDoneBar";
import { useKeyboardInset } from "../../hooks/useKeyboardInset";
import { useLightStatusBar } from "../../hooks/useLightStatusBar";
import { supabase } from "../../supabase/supabaseClient";
import { fetchServiceImages } from "../../utils/serviceImageGallery";
import { resolveStorageImageUrl } from "../../utils/storageImageUrl";
import { colors, shadows } from "../../theme/barberTheme";

export default function Services() {
  useLightStatusBar(colors.background);
  const keyboardInset = useKeyboardInset();
  const listRef = useRef(null);
  const [services, setServices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  
  const [editingId, setEditingId] = useState(null);
  const [editName, setEditName] = useState("");
  const [editPrice, setEditPrice] = useState("");
  const [editDuration, setEditDuration] = useState("");

  const [newServiceName, setNewServiceName] = useState("");
  const [newServicePrice, setNewServicePrice] = useState("");
  const [newServiceDuration, setNewServiceDuration] = useState("");
  const [newServiceImageUri, setNewServiceImageUri] = useState(null);

  const [galleryModalVisible, setGalleryModalVisible] = useState(false);
  const [galleryService, setGalleryService] = useState(null);
  const [deletingImagePath, setDeletingImagePath] = useState(null);

  const modalTopInset = Platform.OS === "android" ? (StatusBar.currentHeight || 0) + 22 : 26;

  const extractPath = (fullPathOrUrl) => {
    if (!fullPathOrUrl) return null;
    const parts = fullPathOrUrl.split('/services/');
    return parts.length > 1 ? `services/${parts[1].split('?')[0]}` : fullPathOrUrl.split('?')[0];
  };

  const getFileName = (path) => {
    if (!path) return null;
    const clean = String(path).split("?")[0];
    return clean.substring(clean.lastIndexOf("/") + 1);
  };
  const isCoverImage = (service, imageItem) =>
    extractPath(service?.image_url) === extractPath(imageItem?.path || imageItem?.url);
  const normalizeDuration = (value, fallback = 45) => {
    const parsed = parseInt(value, 10);
    if (!Number.isFinite(parsed) || parsed <= 0) return fallback;
    return parsed;
  };

  const updateServiceWithDuration = async (serviceId, payload) => {
    let { error } = await supabase.from("barber_services").update(payload).eq("id", serviceId);
    if (error && String(error.message || "").toLowerCase().includes("duration_minutes")) {
      const fallbackPayload = { ...payload, duration: payload.duration_minutes };
      delete fallbackPayload.duration_minutes;
      const fallback = await supabase.from("barber_services").update(fallbackPayload).eq("id", serviceId);
      error = fallback.error;
    }
    return error;
  };

  const insertServiceWithDuration = async (payload) => {
    let response = await supabase.from("barber_services").insert([payload]).select();
    if (response.error && String(response.error.message || "").toLowerCase().includes("duration_minutes")) {
      const fallbackPayload = { ...payload, duration: payload.duration_minutes };
      delete fallbackPayload.duration_minutes;
      response = await supabase.from("barber_services").insert([fallbackPayload]).select();
    }
    return response;
  };

  useEffect(() => {
    fetchServices();
  }, []);

  const scrollFormIntoView = () => {
    requestAnimationFrame(() => {
      listRef.current?.scrollToEnd({ animated: true });
    });
  };

  const fetchServices = async () => {
    try {
      if (!refreshing) setLoading(true);
      const { data: { user } } = await supabase.auth.getUser();
      const { data, error } = await supabase
        .from("barber_services")
        .select("*")
        .eq("barber_id", user.id)
        .order("service_name", { ascending: true });

      if (error) throw error;
      
      const resolved = await Promise.all(
        (data || []).map(async (s) => {
          const imageGallery = await fetchServiceImages(s.id);
          const primaryUrl = resolveStorageImageUrl(s.image_url);
          
          return {
            ...s,
            duration_minutes: normalizeDuration(s.duration_minutes ?? s.duration, 45),
            image_gallery: imageGallery,
            image_display: primaryUrl || imageGallery[0]?.url || null,
          };
        })
      );
      setServices(resolved);
      return resolved;
    } catch (error) {
      Alert.alert("Error", "Could not load services.");
      return null;
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const uploadAndSaveImage = async (serviceId, localUri) => {
    try {
      const base64 = await FileSystem.readAsStringAsync(localUri, { encoding: FileSystem.EncodingType.Base64 });
      const filePath = `services/${serviceId}-${Date.now()}.jpg`;

      const { error: upErr } = await supabase.storage
        .from('avatars')
        .upload(filePath, decode(base64), { contentType: 'image/jpeg', cacheControl: '0' });

      if (upErr) throw upErr;
      const { data: urlData } = supabase.storage.from('avatars').getPublicUrl(filePath);
      return urlData?.publicUrl;
    } catch (err) {
      return null;
    }
  };

  const handleDeleteServiceImage = async (serviceId, rawPath) => {
    Alert.alert("Delete Photo", "Permanently remove this photo?", [
      { text: "Cancel", style: "cancel" },
      { 
        text: "Delete", style: "destructive", 
        onPress: async () => {
          try {
            setDeletingImagePath(rawPath);
            const cleanPath = extractPath(rawPath);

            const { error: storageError } = await supabase.storage
              .from("avatars")
              .remove([cleanPath]);

            if (storageError) throw storageError;

            const currentService = services.find(s => s.id === serviceId);
            if (currentService.image_url && currentService.image_url.includes(getFileName(cleanPath))) {
              await supabase
                .from("barber_services")
                .update({ image_url: null })
                .eq("id", serviceId);
            }

            await fetchServices();
            
            // Re-sync modal state after deletion
            const updated = services.find(s => s.id === serviceId);
            if (updated) {
                setGalleryService(updated);
            } else {
                setGalleryModalVisible(false);
            }

            Alert.alert("Success", "Photo deleted.");
          } catch (e) {
            Alert.alert("Delete Failed", e.message);
          } finally {
            setDeletingImagePath(null);
          }
        }
      }
    ]);
  };

  const handleUpdateService = async (serviceId) => {
    try {
      const error = await updateServiceWithDuration(serviceId, {
        service_name: editName,
        price: parseFloat(editPrice),
        duration_minutes: normalizeDuration(editDuration, 45),
      });
      if (error) throw error;
      setEditingId(null);
      fetchServices();
    } catch (e) { Alert.alert("Error", e.message); }
  };

  const handleAddService = async () => {
    if (!newServiceName) return Alert.alert("Error", "Name required");
    try {
      const { data: { user } } = await supabase.auth.getUser();
      const { data, error } = await insertServiceWithDuration({
        barber_id: user.id,
        service_name: newServiceName,
        price: parseFloat(newServicePrice) || 0,
        duration_minutes: normalizeDuration(newServiceDuration, 45),
      });

      if (error) throw error;
      const newId = data[0].id;
      if (newServiceImageUri) {
        const finalUrl = await uploadAndSaveImage(newId, newServiceImageUri);
        await supabase.from('barber_services').update({ image_url: finalUrl }).eq('id', newId);
      }
      setNewServiceName(''); setNewServicePrice(''); setNewServiceDuration(''); setNewServiceImageUri(null);
      fetchServices();
    } catch (e) { Alert.alert("Error", e.message); }
  };

  const handleSetCoverImage = async (serviceId, imageItem) => {
    try {
      const coverUrl = imageItem?.url || null;
      const { error } = await supabase
        .from("barber_services")
        .update({ image_url: coverUrl })
        .eq("id", serviceId);
      if (error) throw error;

      setServices((prev) =>
        prev.map((service) =>
          service.id === serviceId
            ? { ...service, image_url: coverUrl, image_display: coverUrl || service.image_display }
            : service
        )
      );
      setGalleryService((prev) =>
        prev && prev.id === serviceId
          ? { ...prev, image_url: coverUrl, image_display: coverUrl || prev.image_display }
          : prev
      );
    } catch (e) {
      Alert.alert("Cover Failed", e.message);
    }
  };

  const handleAddImageToService = async (serviceId) => {
    try {
      const pickResult = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        quality: 0.8,
      });
      if (pickResult.canceled) return;

      const uri = pickResult.assets?.[0]?.uri;
      if (!uri) return;

      const uploadedUrl = await uploadAndSaveImage(serviceId, uri);
      if (!uploadedUrl) throw new Error("Image upload failed.");

      const currentService = services.find((s) => s.id === serviceId);
      const nextCover = currentService?.image_url || uploadedUrl;
      const { error: dbError } = await supabase
        .from("barber_services")
        .update({ image_url: nextCover })
        .eq("id", serviceId);
      if (dbError) throw dbError;

      const updatedList = await fetchServices();
      const updatedService = (updatedList || []).find((s) => s.id === serviceId);
      if (updatedService) setGalleryService(updatedService);
      Alert.alert("Success", "Image added.");
    } catch (e) {
      Alert.alert("Add Image Failed", e.message);
    }
  };

  const renderItem = ({ item }) => {
    const isEditing = editingId === item.id;
    return (
      <View style={styles.card}>
        <View style={styles.infoRow}>
          {item.image_display ? (
            <Image key={item.image_display} source={{ uri: item.image_display }} style={styles.thumb} />
          ) : (
            <View style={styles.thumbPlaceholder}>
              <Icon name="image-outline" size={22} color={colors.textMuted} />
            </View>
          )}
          <View style={styles.serviceTextWrap}>
            {isEditing ? (
              <>
                <Text style={styles.inlineFieldLabel}>Service name</Text>
                <TextInput
                  style={styles.inlineInput}
                  value={editName}
                  onChangeText={setEditName}
                  placeholder="Service name"
                  placeholderTextColor={colors.textMuted}
                  returnKeyType="done"
                  onSubmitEditing={Keyboard.dismiss}
                  onFocus={scrollFormIntoView}
                />
                <Text style={[styles.inlineFieldLabel, { marginTop: 6 }]}>Price (R)</Text>
                <TextInput
                  style={[styles.inlineInput, { marginTop: 4 }]}
                  value={editPrice}
                  onChangeText={setEditPrice}
                  keyboardType="numeric"
                  placeholder="Price (R)"
                  placeholderTextColor={colors.textMuted}
                  returnKeyType="done"
                  onSubmitEditing={Keyboard.dismiss}
                  onFocus={scrollFormIntoView}
                />
                <Text style={[styles.inlineFieldLabel, { marginTop: 6 }]}>Duration (min)</Text>
                <TextInput
                  style={[styles.inlineInput, { marginTop: 4 }]}
                  value={editDuration}
                  onChangeText={setEditDuration}
                  keyboardType="numeric"
                  placeholder="Duration (minutes)"
                  placeholderTextColor={colors.textMuted}
                  returnKeyType="done"
                  onSubmitEditing={Keyboard.dismiss}
                  onFocus={scrollFormIntoView}
                />
              </>
            ) : (
              <>
                <Text style={styles.serviceName}>{item.service_name}</Text>
                <Text style={styles.priceText}>R{item.price}</Text>
                <Text style={styles.durationText}>{normalizeDuration(item.duration_minutes ?? item.duration, 45)} min</Text>
                <Text style={styles.galleryCountText}>
                  {(() => {
                    const n = item.image_gallery?.length || 0;
                    if (!n) return "No photos yet";
                    return `${n} photo${n === 1 ? "" : "s"}`;
                  })()}
                </Text>
              </>
            )}
          </View>
        </View>
        <View style={styles.actions}>
          {isEditing ? (
            <TouchableOpacity onPress={() => handleUpdateService(item.id)}><Icon name="checkmark-circle" size={30} color="#2ecc71" /></TouchableOpacity>
          ) : (
            <>
              <TouchableOpacity onPress={() => { setEditingId(item.id); setEditName(item.service_name); setEditPrice(item.price.toString()); setEditDuration(String(normalizeDuration(item.duration_minutes ?? item.duration, 45))); }} style={styles.iconBtn}><Icon name="create-outline" size={22} color={colors.accent} /></TouchableOpacity>
              <TouchableOpacity onPress={() => { setGalleryService(item); setGalleryModalVisible(true); }} style={styles.iconBtn}><Icon name="images-outline" size={22} color={colors.textMuted} /></TouchableOpacity>
              <TouchableOpacity onPress={() => {
                Alert.alert("Delete", "Delete service?", [
                  { text: "No" },
                  { text: "Yes", onPress: () => supabase.from('barber_services').delete().eq('id', item.id).then(() => fetchServices()) }
                ]);
              }} style={styles.iconBtn}><Icon name="trash-outline" size={22} color="#e74c3c" /></TouchableOpacity>
            </>
          )}
        </View>
      </View>
    );
  };

  // No StatusBarBackdrop here: unlike the other barber screens this one is
  // pushed with a nav header ("Manage Services"), so the status bar is
  // already covered. The backdrop is absolutely positioned at the top of the
  // root View — below that header — where it sat over the content and
  // clipped the first rows. The nav header also already names the screen, so
  // an in-screen heading just repeated it.
  return (
    <View style={styles.container}>
      <FlatList
        ref={listRef}
        keyboardShouldPersistTaps="handled"
        data={services}
        renderItem={renderItem}
        keyExtractor={(item) => item.id.toString()}
        contentContainerStyle={{ paddingBottom: keyboardInset + 120 }}
        bounces={false}
        overScrollMode="never"
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); fetchServices(); }} />}
        ListFooterComponent={
          <View style={styles.addContainer}>
            <Text style={styles.addTitle}>Add New Service</Text>
            <View style={styles.addRow}>
              <TouchableOpacity style={styles.addImageTile} onPress={() => ImagePicker.launchImageLibraryAsync({allowsEditing: true}).then(r => !r.canceled && setNewServiceImageUri(r.assets[0].uri))}>
                {newServiceImageUri ? <Image source={{uri: newServiceImageUri}} style={styles.addTileImage}/> : <Icon name="camera" size={28} color={colors.textMuted}/>}
              </TouchableOpacity>
              <View style={styles.addFields}>
                <TextInput
                  placeholder="Service name (e.g. Haircut)"
                  placeholderTextColor={colors.textMuted}
                  value={newServiceName}
                  onChangeText={setNewServiceName}
                  style={styles.addInput}
                  returnKeyType="done"
                  onSubmitEditing={Keyboard.dismiss}
                  onFocus={scrollFormIntoView}
                />
                <View style={styles.priceInputWrap}>
                  <Text style={styles.pricePrefix}>R</Text>
                  <TextInput
                    placeholder="Price"
                    placeholderTextColor={colors.textMuted}
                    value={newServicePrice}
                    onChangeText={setNewServicePrice}
                    keyboardType="numeric"
                    style={styles.priceInput}
                    returnKeyType="done"
                    onSubmitEditing={Keyboard.dismiss}
                    onFocus={scrollFormIntoView}
                  />
                </View>
                <View style={styles.priceInputWrap}>
                  <Icon name="time-outline" size={15} color={colors.textMuted} />
                  <TextInput
                    placeholder="Duration (minutes)"
                    placeholderTextColor={colors.textMuted}
                    value={newServiceDuration}
                    onChangeText={setNewServiceDuration}
                    keyboardType="numeric"
                    style={[styles.priceInput, { marginLeft: 6 }]}
                    returnKeyType="done"
                    onSubmitEditing={Keyboard.dismiss}
                    onFocus={scrollFormIntoView}
                  />
                </View>
                <TouchableOpacity onPress={handleAddService} style={styles.addServiceBtn}><Text style={{color: '#fff', fontWeight: 'bold'}}>Save</Text></TouchableOpacity>
              </View>
            </View>
          </View>
        }
      />

      <Modal visible={galleryModalVisible} animationType="slide">
        <View style={[styles.galleryModalContainer, { paddingTop: modalTopInset }]}>
          <View style={styles.galleryModalHeader}>
            <TouchableOpacity onPress={() => setGalleryModalVisible(false)}><Icon name="chevron-back" size={30} color={colors.text} /></TouchableOpacity>
            <Text style={styles.galleryTitle}>{galleryService?.service_name}</Text>
            <TouchableOpacity
              style={styles.headerAddBtn}
              onPress={() => galleryService?.id && handleAddImageToService(galleryService.id)}
            >
              <Icon name="add" size={18} color="#fff" />
              <Text style={styles.headerAddBtnText}>Add</Text>
            </TouchableOpacity>
          </View>
          <FlatList
            data={
              galleryService?.image_gallery
                ? [
                    ...galleryService.image_gallery.filter((img) => isCoverImage(galleryService, img)),
                    ...galleryService.image_gallery.filter((img) => !isCoverImage(galleryService, img)),
                  ]
                : []
            }
            keyExtractor={(img) => img.path}
            ListEmptyComponent={
              <View style={styles.emptyGallery}>
                <Icon name="images-outline" size={28} color={colors.textMuted} />
                <Text style={styles.emptyGalleryText}>No images yet</Text>
                <Text style={styles.emptyGalleryHint}>Press add to upload a service image</Text>
                <TouchableOpacity
                  style={styles.emptyAddBtn}
                  onPress={() => galleryService?.id && handleAddImageToService(galleryService.id)}
                >
                  <Icon name="add-circle-outline" size={18} color="#fff" />
                  <Text style={styles.emptyAddBtnText}>Add Image</Text>
                </TouchableOpacity>
              </View>
            }
            renderItem={({ item: imageItem }) => (
              <View style={styles.galleryCard}>
                <Image source={{ uri: imageItem.url }} style={styles.galleryImage} />
                {isCoverImage(galleryService, imageItem) && (
                  <View style={styles.coverBadge}>
                    <Icon name="star" size={12} color="#fff" />
                    <Text style={styles.coverBadgeText}>Main cover</Text>
                  </View>
                )}
                <View style={styles.galleryActionRow}>
                  <TouchableOpacity
                    style={[styles.coverBtn, isCoverImage(galleryService, imageItem) && styles.coverBtnActive]}
                    onPress={() => handleSetCoverImage(galleryService.id, imageItem)}
                  >
                    <Icon
                      name={isCoverImage(galleryService, imageItem) ? "checkmark-circle" : "star-outline"}
                      size={16}
                      color="#fff"
                    />
                    <Text style={styles.coverBtnText}>
                      {isCoverImage(galleryService, imageItem) ? "Cover selected" : "Set as cover"}
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.delBtn} onPress={() => handleDeleteServiceImage(galleryService.id, imageItem.path)}>
                    {deletingImagePath === imageItem.path ? <ActivityIndicator color="#fff"/> : <Icon name="trash" size={20} color="#fff"/>}
                  </TouchableOpacity>
                </View>
              </View>
            )}
          />
        </View>
      </Modal>
      <KeyboardDoneBar inset={keyboardInset} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 20, backgroundColor: colors.background },
  card: { flexDirection: "row", padding: 15, backgroundColor: colors.surface, borderRadius: 16, marginBottom: 12, borderWidth: 1, borderColor: colors.border, ...shadows.card },
  infoRow: { flexDirection: 'row', alignItems: 'center', flex: 1 },
  serviceTextWrap: { marginLeft: 15, flex: 1 },
  serviceName: { fontSize: 17, fontWeight: "800", color: colors.text },
  priceText: { color: colors.accent, fontWeight: "800" },
  durationText: { fontSize: 12, color: colors.textMuted, marginTop: 1 },
  galleryCountText: { fontSize: 12, color: colors.textMuted },
  thumb: { width: 65, height: 65, borderRadius: 12, backgroundColor: colors.surfaceMuted, borderWidth: 1, borderColor: colors.border },
  thumbPlaceholder: {
    width: 65,
    height: 65,
    borderRadius: 12,
    backgroundColor: colors.surfaceMuted,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border,
    borderStyle: 'dashed',
  },
  inlineFieldLabel: { fontSize: 11, color: colors.textMuted, fontWeight: '700' },
  inlineInput: { borderBottomWidth: 1, borderColor: colors.border, padding: 5, color: colors.text },
  actions: { flexDirection: "row", alignItems: 'center' },
  iconBtn: { padding: 8 },
  addContainer: { marginTop: 20, padding: 20, backgroundColor: colors.surface, borderRadius: 20, borderStyle: 'dashed', borderWidth: 1, borderColor: colors.borderStrong },
  addTitle: { fontWeight: '800', fontSize: 18, marginBottom: 15, color: colors.text },
  addRow: { flexDirection: 'row' },
  addImageTile: { width: 90, height: 90, backgroundColor: colors.surfaceMuted, borderRadius: 15, justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: colors.border },
  addTileImage: { width: 90, height: 90, borderRadius: 15 },
  addFields: { flex: 1, marginLeft: 15 },
  addInput: { backgroundColor: colors.surfaceMuted, padding: 10, borderRadius: 10, color: colors.text },
  priceInputWrap: {
    marginTop: 8,
    backgroundColor: colors.surfaceMuted,
    borderRadius: 10,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
  },
  pricePrefix: { fontSize: 16, fontWeight: '800', color: colors.accent, marginRight: 6 },
  priceInput: { flex: 1, paddingVertical: 10, color: colors.text },
  addServiceBtn: { backgroundColor: colors.accent, padding: 10, borderRadius: 10, marginTop: 10, alignItems: 'center' },
  galleryModalContainer: { flex: 1, backgroundColor: colors.background },
  galleryModalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  galleryTitle: { fontSize: 22, fontWeight: '800', marginLeft: 12, color: colors.text },
  headerAddBtn: {
    marginLeft: 'auto',
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.accent,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
  },
  headerAddBtnText: { color: colors.accentText, fontWeight: '700', marginLeft: 4 },
  galleryCard: {
    marginHorizontal: 14,
    marginTop: 14,
    padding: 12,
    backgroundColor: colors.surface,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: colors.border,
    ...shadows.card,
  },
  galleryImage: { width: '100%', height: 230, borderRadius: 16 },
  coverBadge: {
    position: 'absolute',
    top: 22,
    right: 22,
    backgroundColor: colors.success,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 5,
    flexDirection: 'row',
    alignItems: 'center',
  },
  coverBadgeText: { color: '#fff', fontSize: 11, fontWeight: '700', marginLeft: 4 },
  galleryActionRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 12 },
  coverBtn: {
    backgroundColor: colors.accent,
    paddingVertical: 11,
    borderRadius: 12,
    flex: 0.78,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
  },
  coverBtnActive: { backgroundColor: colors.success },
  coverBtnText: { color: '#fff', fontWeight: '700', marginLeft: 6, fontSize: 13 },
  delBtn: {
    backgroundColor: colors.error,
    paddingVertical: 11,
    borderRadius: 12,
    flex: 0.18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyGallery: { alignItems: 'center', justifyContent: 'center', paddingVertical: 40 },
  emptyGalleryText: { marginTop: 8, color: colors.textMuted, fontSize: 14 },
  emptyGalleryHint: { marginTop: 4, color: colors.textMuted, fontSize: 12 },
  emptyAddBtn: {
    marginTop: 14,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.accent,
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 12,
  },
  emptyAddBtnText: { color: colors.accentText, fontWeight: '700', marginLeft: 6 }
});