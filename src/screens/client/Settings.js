import * as ImagePicker from 'expo-image-picker';
import React, { useEffect, useState } from "react";
import {
    ActivityIndicator,
    Alert,
    Image,
    Keyboard,
    KeyboardAvoidingView,
    Platform,
    ScrollView,
    Switch,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from "react-native";
import Ionicons from "react-native-vector-icons/Ionicons";
import KeyboardDoneBar from "../../components/common/KeyboardDoneBar";
import { useKeyboardInset } from "../../hooks/useKeyboardInset";
import { supabase } from "../../supabase/supabaseClient";
import { borderRadius, colors, shadows, typography } from "../../theme/clientTheme";
import { useClientThemeMode } from "../../theme/ClientThemeMode";

export default function Settings() {
    const { isDark, toggleMode, colors: themeColors } = useClientThemeMode();
    const keyboardInset = useKeyboardInset();
    const [loading, setLoading] = useState(true);
    const [updating, setUpdating] = useState(false);
    const [profile, setProfile] = useState({
        full_name: "",
        phone_number: "",
        avatar_url: null,
    });

    useEffect(() => {
        fetchProfile();
    }, []);

    const fetchProfile = async () => {
        try {
            const { data: { user } } = await supabase.auth.getUser();
            const { data, error } = await supabase
                .from("profiles")
                .select("full_name, phone_number, avatar_url")
                .eq("id", user.id)
                .single();

            if (error) throw error;
            if (data) setProfile(data);
        } catch (error) {
            console.error("Fetch Error:", error.message);
        } finally {
            setLoading(false);
        }
    };

    const uploadAvatar = async () => {
        try {
            const result = await ImagePicker.launchImageLibraryAsync({
                mediaTypes: 'images',
                allowsEditing: true,
                aspect: [1, 1],
                quality: 0.5,
            });

            if (result.canceled) return;

            setUpdating(true);
            const photo = result.assets[0];
            const { data: { user } } = await supabase.auth.getUser();

            const fileExt = photo.uri.split('.').pop();
            const fileName = `${user.id}-${Date.now()}.${fileExt}`;
            const filePath = fileName;

            const formData = new FormData();
            formData.append('file', {
                uri: photo.uri,
                name: fileName,
                type: `image/${fileExt === 'jpg' ? 'jpeg' : fileExt}`,
            });

            // Upload to Supabase Storage
            const { error: uploadError } = await supabase.storage
                .from('avatars')
                .upload(filePath, formData);

            if (uploadError) throw uploadError;

            const { data: urlData } = supabase.storage
                .from('avatars')
                .getPublicUrl(filePath);

            const publicUrl = `${urlData.publicUrl}?t=${Date.now()}`;

            // Update database profile
            await supabase
                .from('profiles')
                .update({ avatar_url: publicUrl })
                .eq('id', user.id);

            setProfile({ ...profile, avatar_url: publicUrl });
            Alert.alert("Success", "Profile picture updated!");
        } catch (error) {
            Alert.alert("Upload Error", error.message);
        } finally {
            setUpdating(false);
        }
    };

    const handleUpdateProfile = async () => {
        setUpdating(true);
        try {
            const { data: { user } } = await supabase.auth.getUser();
            const { error } = await supabase
                .from("profiles")
                .update({
                    full_name: profile.full_name,
                    phone_number: profile.phone_number,
                })
                .eq("id", user.id);

            if (error) throw error;
            Alert.alert("Success", "Profile details updated!");
        } catch (error) {
            Alert.alert("Update Error", error.message);
        } finally {
            setUpdating(false);
        }
    };

    // New: Handle Account Deletion logic
    const handleDeleteAccount = async () => {
        Alert.alert(
            "Delete Account",
            "This will permanently delete your profile and appointments. This action cannot be undone.",
            [
                { text: "Cancel", style: "cancel" },
                {
                    text: "Delete My Data & Logout",
                    style: "destructive",
                    onPress: async () => {
                        try {
                            setUpdating(true);
                            const { data: { user } } = await supabase.auth.getUser();

                            // Delete related data first to avoid foreign key errors
                            await supabase.from('appointments').delete().eq('client_id', user.id);
                            await supabase.from('profiles').delete().eq('id', user.id);

                            await supabase.auth.signOut();
                        } catch (error) {
                            Alert.alert("Error", error.message);
                        } finally {
                            setUpdating(false);
                        }
                    }
                }
            ]
        );
    };

    if (loading) {
        return (
            <View style={[styles.loaderWrap, { backgroundColor: themeColors.background }]}>
                <ActivityIndicator size="large" color={colors.primary} />
                <Text style={[styles.loadingText, { color: themeColors.textSecondary }]}>Loading profile...</Text>
            </View>
        );
    }

    return (
        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <ScrollView
            style={[styles.container, { backgroundColor: themeColors.background }]}
            contentContainerStyle={[styles.scrollContent, { paddingBottom: 40 + keyboardInset + 20 }]}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
            keyboardDismissMode={Platform.OS === "ios" ? "interactive" : "on-drag"}
        >
            <View style={styles.avatarSection}>
                <TouchableOpacity onPress={uploadAvatar} disabled={updating} style={styles.avatarTouch}>
                    {profile.avatar_url ? (
                        <Image source={{ uri: profile.avatar_url }} style={styles.avatar} />
                    ) : (
                        <View style={styles.avatarPlaceholder}>
                            <Ionicons name="person" size={48} color={colors.textMuted} />
                        </View>
                    )}
                    <View style={styles.cameraIcon}>
                        {updating ? (
                            <ActivityIndicator size="small" color={colors.white} />
                        ) : (
                            <Ionicons name="camera" size={20} color={colors.white} />
                        )}
                    </View>
                </TouchableOpacity>
                <Text style={[styles.avatarHint, { color: themeColors.textMuted }]}>Tap to change photo</Text>
            </View>

            <View style={[styles.section, { backgroundColor: themeColors.surface, borderColor: themeColors.border }]}>
                <Text style={[styles.sectionTitle, { color: themeColors.text }]}>Profile details</Text>
                <Text style={[styles.label, { color: themeColors.textMuted }]}>Full name</Text>
                <TextInput
                    style={[styles.input, { backgroundColor: themeColors.surfaceAlt, borderColor: themeColors.border, color: themeColors.text }]}
                    value={profile.full_name}
                    onChangeText={(t) => setProfile({ ...profile, full_name: t })}
                    placeholder="Enter your name"
                    placeholderTextColor={themeColors.textMuted}
                    returnKeyType="done"
                    onSubmitEditing={Keyboard.dismiss}
                />

                <Text style={[styles.label, { color: themeColors.textMuted }]}>Phone number</Text>
                <TextInput
                    style={[styles.input, { backgroundColor: themeColors.surfaceAlt, borderColor: themeColors.border, color: themeColors.text }]}
                    value={profile.phone_number}
                    onChangeText={(t) => setProfile({ ...profile, phone_number: t })}
                    keyboardType="phone-pad"
                    placeholder="Enter your phone number"
                    placeholderTextColor={themeColors.textMuted}
                    returnKeyType="done"
                    onSubmitEditing={Keyboard.dismiss}
                />

                <View style={[styles.themeRow, { borderColor: themeColors.border }]}>
                    <View style={styles.themeRowLeft}>
                        <Ionicons name={isDark ? "moon-outline" : "sunny-outline"} size={18} color={themeColors.accent} />
                        <View style={styles.themeTextWrap}>
                            <Text style={[styles.themeTitle, { color: themeColors.text }]}>Appearance</Text>
                            <Text style={[styles.themeSub, { color: themeColors.textMuted }]}>
                                {isDark ? "Dark mode" : "Light mode"}
                            </Text>
                        </View>
                    </View>
                    <Switch
                        value={!isDark}
                        onValueChange={toggleMode}
                        trackColor={{ false: "#545454", true: "rgba(166,124,82,0.55)" }}
                        thumbColor={isDark ? "#f4f3f4" : themeColors.accent}
                    />
                </View>

                <TouchableOpacity
                    style={[styles.saveBtn, { backgroundColor: themeColors.surfaceAlt, borderColor: themeColors.border }]}
                    onPress={handleUpdateProfile}
                    disabled={updating}
                    activeOpacity={0.85}
                >
                    {updating ? (
                        <ActivityIndicator color={colors.white} size="small" />
                    ) : (
                        <>
                            <Ionicons name="checkmark-circle" size={22} color={colors.white} />
                                <Text style={[styles.saveBtnText, { color: themeColors.text }]}>Save changes</Text>
                        </>
                    )}
                </TouchableOpacity>
            </View>

            <View style={styles.dangerSection}>
                <Text style={styles.dangerTitle}>Danger zone</Text>
                <Text style={styles.dangerSubtitle}>Permanently delete your account and data.</Text>
                <TouchableOpacity style={styles.deleteBtn} onPress={handleDeleteAccount} activeOpacity={0.8}>
                    <Ionicons name="trash-outline" size={20} color={colors.error} />
                    <Text style={styles.deleteText}>Delete account data</Text>
                </TouchableOpacity>
            </View>

            <TouchableOpacity
                style={[styles.logoutBtn, { backgroundColor: themeColors.surface, borderColor: themeColors.border }]}
                onPress={() => supabase.auth.signOut()}
                activeOpacity={0.8}
            >
                <Ionicons name="log-out-outline" size={22} color={themeColors.textSecondary} />
                <Text style={[styles.logoutText, { color: themeColors.textSecondary }]}>Log out</Text>
            </TouchableOpacity>
        </ScrollView>
        <KeyboardDoneBar inset={keyboardInset} />
        </KeyboardAvoidingView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
    scrollContent: { padding: 20, paddingBottom: 40 },
    loaderWrap: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: colors.background,
    },
    loadingText: { marginTop: 12, fontSize: 15, color: '#D3D7E0', fontWeight: '700' },
    avatarSection: { alignItems: 'center', marginTop: 20, marginBottom: 22 },
    avatarTouch: { position: 'relative' },
    avatar: {
        width: 120,
        height: 120,
        borderRadius: 60,
        borderWidth: 3.5,
        borderColor: 'rgba(197,160,112,0.65)',
    },
    avatarPlaceholder: {
        width: 120,
        height: 120,
        borderRadius: 60,
        backgroundColor: '#121216',
        justifyContent: 'center',
        alignItems: 'center',
        borderWidth: 2,
        borderColor: 'rgba(197,160,112,0.42)',
    },
    cameraIcon: {
        position: 'absolute',
        bottom: 0,
        right: 0,
        backgroundColor: '#0A0A0A',
        padding: 10,
        borderRadius: 20,
        borderWidth: 1,
        borderColor: 'rgba(197,160,112,0.42)',
        ...shadows.button,
    },
    avatarHint: { marginTop: 10, fontSize: 13, color: '#C7CEDD', fontWeight: '700' },
    section: {
        backgroundColor: '#121216',
        padding: 18,
        borderRadius: borderRadius.xl,
        marginBottom: 20,
        borderWidth: 1,
        borderColor: 'rgba(197,160,112,0.24)',
        ...shadows.card,
    },
    sectionTitle: { ...typography.sectionHeader, color: '#F8F5F0', marginBottom: 16, fontWeight: '800' },
    label: { fontSize: 13, color: '#D0C7B8', marginTop: 14, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 0.5 },
    input: {
        backgroundColor: '#0A0A0A',
        padding: 14,
        borderRadius: borderRadius.md,
        marginTop: 6,
        borderWidth: 1,
        borderColor: 'rgba(197,160,112,0.26)',
        fontSize: 15,
        color: '#F8F5F0',
    },
    saveBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
        backgroundColor: '#0A0A0A',
        paddingVertical: 16,
        borderRadius: borderRadius.lg,
        marginTop: 22,
        borderWidth: 1,
        borderColor: 'rgba(197,160,112,0.45)',
        ...shadows.button,
    },
    saveBtnText: { ...typography.button, color: '#F8F5F0', fontWeight: '800' },
    themeRow: {
        marginTop: 16,
        paddingTop: 12,
        borderTopWidth: 1,
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        gap: 10,
    },
    themeRowLeft: { flexDirection: "row", alignItems: "center", flex: 1, gap: 10 },
    themeTextWrap: { flex: 1 },
    themeTitle: { fontSize: 14, fontWeight: "800" },
    themeSub: { fontSize: 12, fontWeight: "600", marginTop: 2 },
    dangerSection: {
        backgroundColor: 'rgba(193,18,31,0.08)',
        padding: 18,
        borderRadius: borderRadius.xl,
        borderWidth: 1,
        borderColor: 'rgba(193,18,31,0.4)',
        marginBottom: 12,
    },
    dangerTitle: { fontSize: 16, fontWeight: '800', color: '#ff8a8a', marginBottom: 4 },
    dangerSubtitle: { fontSize: 13, color: '#D6CBBF', marginBottom: 14, lineHeight: 18, fontWeight: '600' },
    deleteBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 12,
        paddingHorizontal: 12,
        backgroundColor: 'rgba(193,18,31,0.15)',
        borderRadius: borderRadius.md,
        borderWidth: 1,
        borderColor: 'rgba(255,138,138,0.35)',
        gap: 10,
    },
    deleteText: { color: '#ff9b9b', fontWeight: '800', fontSize: 15 },
    logoutBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 10,
        marginTop: 20,
        marginBottom: 30,
        paddingVertical: 14,
        paddingHorizontal: 16,
        borderRadius: borderRadius.lg,
        backgroundColor: '#121216',
        borderWidth: 1,
        borderColor: 'rgba(197,160,112,0.2)',
    },
    logoutText: { color: '#E1E5EF', fontWeight: '800', fontSize: 15 },
});