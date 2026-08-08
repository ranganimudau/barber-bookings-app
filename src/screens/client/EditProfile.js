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
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from "react-native";
import Ionicons from "react-native-vector-icons/Ionicons";
import KeyboardDoneBar from "../../components/common/KeyboardDoneBar";
import { useKeyboardInset } from "../../hooks/useKeyboardInset";
import { useLightStatusBar } from "../../hooks/useLightStatusBar";
import { supabase } from "../../supabase/supabaseClient";
import { borderRadius, colors, shadows, typography } from "../../theme/barberTheme";

/**
 * Split out of Settings so the settings page is a short list of rows rather
 * than a long form. Reached from the profile card at the top of Settings.
 */
export default function EditProfile({ navigation }) {
    useLightStatusBar(colors.background);
    const keyboardInset = useKeyboardInset();
    const [loading, setLoading] = useState(true);
    const [updating, setUpdating] = useState(false);
    const [email, setEmail] = useState("");
    const [profile, setProfile] = useState({
        full_name: "",
        phone_number: "",
        avatar_url: null,
    });

    useEffect(() => {
        (async () => {
            try {
                const { data: { user } } = await supabase.auth.getUser();
                setEmail(user?.email || "");
                const { data, error } = await supabase
                    .from("profiles")
                    .select("full_name, phone_number, avatar_url")
                    .eq("id", user.id)
                    .single();
                if (error) throw error;
                if (data) {
                    setProfile({
                        full_name: data.full_name || "",
                        phone_number: data.phone_number || "",
                        avatar_url: data.avatar_url,
                    });
                }
            } catch (error) {
                console.error("Fetch Error:", error.message);
            } finally {
                setLoading(false);
            }
        })();
    }, []);

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

            const { error: uploadError } = await supabase.storage
                .from('avatars')
                .upload(filePath, formData);

            if (uploadError) throw uploadError;

            const { data: urlData } = supabase.storage
                .from('avatars')
                .getPublicUrl(filePath);

            const publicUrl = `${urlData.publicUrl}?t=${Date.now()}`;

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
            navigation.goBack();
        } catch (error) {
            Alert.alert("Update Error", error.message);
        } finally {
            setUpdating(false);
        }
    };

    if (loading) {
        return (
            <View style={styles.loaderWrap}>
                <ActivityIndicator size="large" color={colors.accent} />
            </View>
        );
    }

    return (
        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <ScrollView
            style={styles.container}
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
                            <Ionicons name="person" size={44} color={colors.textMuted} />
                        </View>
                    )}
                    <View style={styles.cameraIcon}>
                        {updating ? (
                            <ActivityIndicator size="small" color={colors.accentText} />
                        ) : (
                            <Ionicons name="camera" size={18} color={colors.accentText} />
                        )}
                    </View>
                </TouchableOpacity>
                <Text style={styles.avatarHint}>Tap to change photo</Text>
            </View>

            <View style={styles.section}>
                <Text style={styles.label}>Email</Text>
                {/* Read-only: changing the sign-in address needs a
                    re-verification flow that doesn't exist yet, so an
                    editable field would promise something it can't do. */}
                <View style={styles.readonlyField}>
                    <Text style={styles.readonlyText} numberOfLines={1}>{email || "—"}</Text>
                    <Ionicons name="lock-closed" size={14} color={colors.textMuted} />
                </View>
                <Text style={styles.fieldHint}>Contact support to change your email address.</Text>

                <Text style={styles.label}>Full name</Text>
                <TextInput
                    style={styles.input}
                    value={profile.full_name}
                    onChangeText={(t) => setProfile({ ...profile, full_name: t })}
                    placeholder="Enter your name"
                    placeholderTextColor={colors.textMuted}
                    returnKeyType="done"
                    onSubmitEditing={Keyboard.dismiss}
                />

                <Text style={styles.label}>Phone number</Text>
                <TextInput
                    style={styles.input}
                    value={profile.phone_number}
                    onChangeText={(t) => setProfile({ ...profile, phone_number: t })}
                    keyboardType="phone-pad"
                    placeholder="Enter your phone number"
                    placeholderTextColor={colors.textMuted}
                    returnKeyType="done"
                    onSubmitEditing={Keyboard.dismiss}
                />
            </View>

            <TouchableOpacity
                style={[styles.saveBtn, updating && styles.saveBtnDisabled]}
                onPress={handleUpdateProfile}
                disabled={updating}
                activeOpacity={0.9}
            >
                {updating ? (
                    <ActivityIndicator color={colors.accentText} size="small" />
                ) : (
                    <>
                        <Ionicons name="checkmark-circle" size={22} color={colors.accentText} />
                        <Text style={styles.saveBtnText}>Save changes</Text>
                    </>
                )}
            </TouchableOpacity>
        </ScrollView>
        <KeyboardDoneBar inset={keyboardInset} />
        </KeyboardAvoidingView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
    scrollContent: { padding: 20 },
    loaderWrap: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: colors.background,
    },
    avatarSection: { alignItems: 'center', marginTop: 4, marginBottom: 20 },
    avatarTouch: { position: 'relative' },
    avatar: {
        width: 104,
        height: 104,
        borderRadius: 52,
        borderWidth: 3,
        borderColor: colors.border,
    },
    avatarPlaceholder: {
        width: 104,
        height: 104,
        borderRadius: 52,
        backgroundColor: colors.surfaceMuted,
        justifyContent: 'center',
        alignItems: 'center',
        borderWidth: 2,
        borderColor: colors.border,
    },
    cameraIcon: {
        position: 'absolute',
        bottom: 0,
        right: 0,
        backgroundColor: colors.accent,
        padding: 9,
        borderRadius: 20,
        borderWidth: 2,
        borderColor: colors.surface,
        ...shadows.button,
    },
    avatarHint: { marginTop: 10, fontSize: 13, color: colors.textMuted, fontWeight: '600' },
    section: {
        backgroundColor: colors.surface,
        padding: 18,
        paddingTop: 4,
        borderRadius: borderRadius.xl,
        borderWidth: 1,
        borderColor: colors.border,
        ...shadows.card,
    },
    label: { fontSize: 12, color: colors.textSecondary, marginTop: 14, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5 },
    input: {
        backgroundColor: colors.surfaceMuted,
        padding: 14,
        borderRadius: borderRadius.md,
        marginTop: 6,
        borderWidth: 1,
        borderColor: colors.border,
        fontSize: 15,
        color: colors.text,
    },
    readonlyField: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        backgroundColor: colors.surfaceMuted,
        padding: 14,
        borderRadius: borderRadius.md,
        marginTop: 6,
        borderWidth: 1,
        borderColor: colors.border,
    },
    readonlyText: { flex: 1, fontSize: 15, color: colors.textSecondary, fontWeight: '600' },
    fieldHint: { fontSize: 11.5, color: colors.textMuted, marginTop: 6, fontWeight: '500' },
    saveBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
        backgroundColor: colors.accent,
        paddingVertical: 16,
        borderRadius: borderRadius.lg,
        marginTop: 16,
        ...shadows.button,
    },
    saveBtnDisabled: { opacity: 0.7 },
    saveBtnText: { ...typography.button, color: colors.accentText, fontWeight: '800' },
});
