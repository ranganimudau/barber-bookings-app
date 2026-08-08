import { useFocusEffect } from "@react-navigation/native";
import React, { useCallback, useState } from "react";
import {
    ActivityIndicator,
    Alert,
    Image,
    Linking,
    ScrollView,
    StyleSheet,
    Switch,
    Text,
    TouchableOpacity,
    View,
} from "react-native";
import Ionicons from "react-native-vector-icons/Ionicons";
import { useLightStatusBar } from "../../hooks/useLightStatusBar";
import { supabase } from "../../supabase/supabaseClient";
import { borderRadius, colors, shadows } from "../../theme/barberTheme";

// Change this once the app has its own domain and a real support inbox.
const SUPPORT_EMAIL = "ranganimudau55@gmail.com";

const NOTIFICATION_TOGGLES = [
    { key: "notify_booking_confirmed", title: "Booking confirmed" },
    { key: "notify_booking_declined", title: "Booking declined or cancelled" },
    { key: "notify_reminders", title: "Appointment reminders" },
];

const FAQ_BODY =
    "How do I book?\nOpen Find a pro, tap a business, pick a service, a date and a time, then Confirm booking. Your request goes to the business to accept.\n\n" +
    "Why is my booking still pending?\nEvery booking has to be accepted by the business. You'll get a notification as soon as they respond.\n\n" +
    "Can I cancel?\nYes — open My bookings and tap Cancel. Cancelling within 48 hours of the appointment is recorded as a late cancellation and is visible to the business.\n\n" +
    "Can I reschedule?\nUp to 48 hours before your appointment, from My bookings. Inside 48 hours you can still cancel.\n\n" +
    "When can I leave a rating?\nOnce the business marks your visit as completed.\n\n" +
    "Still stuck? Use Contact support.";

export default function Settings({ navigation }) {
    useLightStatusBar(colors.background);
    const [loading, setLoading] = useState(true);
    const [email, setEmail] = useState("");
    const [profile, setProfile] = useState({ full_name: "", avatar_url: null });
    const [notifyPrefs, setNotifyPrefs] = useState({
        notify_booking_confirmed: true,
        notify_booking_declined: true,
        notify_reminders: true,
    });

    // Refetch on focus so edits made on the Edit profile screen show up in
    // the summary card when you come back.
    useFocusEffect(
        useCallback(() => {
            let cancelled = false;
            (async () => {
                try {
                    const { data: { user } } = await supabase.auth.getUser();
                    if (cancelled || !user) return;
                    setEmail(user.email || "");

                    const { data, error } = await supabase
                        .from("profiles")
                        .select("full_name, avatar_url, notify_booking_confirmed, notify_booking_declined, notify_reminders")
                        .eq("id", user.id)
                        .single();

                    if (error) throw error;
                    if (cancelled || !data) return;

                    setProfile({ full_name: data.full_name || "", avatar_url: data.avatar_url });
                    setNotifyPrefs({
                        notify_booking_confirmed: data.notify_booking_confirmed !== false,
                        notify_booking_declined: data.notify_booking_declined !== false,
                        notify_reminders: data.notify_reminders !== false,
                    });
                } catch (error) {
                    console.error("Fetch Error:", error.message);
                } finally {
                    if (!cancelled) setLoading(false);
                }
            })();
            return () => { cancelled = true; };
        }, [])
    );

    // Saved immediately rather than behind a Save button — a switch that
    // silently needs saving elsewhere reads as broken.
    const toggleNotification = async (key) => {
        const next = !notifyPrefs[key];
        setNotifyPrefs((prev) => ({ ...prev, [key]: next }));
        try {
            const { data: { user } } = await supabase.auth.getUser();
            const { error } = await supabase
                .from("profiles")
                .update({ [key]: next })
                .eq("id", user.id);
            if (error) throw error;
        } catch (error) {
            setNotifyPrefs((prev) => ({ ...prev, [key]: !next })); // put it back
            Alert.alert("Couldn't save", "That setting didn't save. Check your connection and try again.");
        }
    };

    const handleDeleteAccount = () => {
        Alert.alert(
            "Delete Account",
            "This will permanently delete your profile and appointment history. Any upcoming bookings will be cancelled and the business notified. This action cannot be undone.",
            [
                { text: "Cancel", style: "cancel" },
                {
                    text: "Delete My Data & Logout",
                    style: "destructive",
                    onPress: async () => {
                        try {
                            const { data: { user } } = await supabase.auth.getUser();

                            // Cancel anything still open first, rather than just
                            // wiping the rows — this is the update the business's
                            // push notification reacts to, so they find out the
                            // slot is free instead of holding it for no one.
                            await supabase
                                .from('appointments')
                                .update({ status: 'cancelled' })
                                .eq('client_id', user.id)
                                .in('status', ['pending', 'confirmed']);

                            // Delete related data first to avoid foreign key errors
                            await supabase.from('appointments').delete().eq('client_id', user.id);
                            await supabase.from('profiles').delete().eq('id', user.id);

                            await supabase.auth.signOut();
                        } catch (error) {
                            Alert.alert("Error", error.message);
                        }
                    }
                }
            ]
        );
    };

    const openSupportEmail = () => {
        Linking.openURL(`mailto:${SUPPORT_EMAIL}?subject=SkoonBook%20support`).catch(() =>
            Alert.alert("No email app", `Email us at ${SUPPORT_EMAIL}`)
        );
    };

    if (loading) {
        return (
            <View style={styles.loaderWrap}>
                <ActivityIndicator size="large" color={colors.accent} />
            </View>
        );
    }

    return (
        <ScrollView
            style={styles.container}
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={false}
        >
            {/* Photo + name + email only — the editable form lives one tap
                away so this page stays a short list of rows. */}
            <TouchableOpacity
                style={styles.profileCard}
                onPress={() => navigation.navigate("EditProfile")}
                activeOpacity={0.85}
            >
                {profile.avatar_url ? (
                    <Image source={{ uri: profile.avatar_url }} style={styles.profileAvatar} />
                ) : (
                    <View style={styles.profileAvatarFallback}>
                        <Ionicons name="person" size={24} color={colors.textMuted} />
                    </View>
                )}
                <View style={styles.profileTextWrap}>
                    <Text style={styles.profileName} numberOfLines={1}>
                        {profile.full_name || "Your profile"}
                    </Text>
                    <Text style={styles.profileEmail} numberOfLines={1}>{email}</Text>
                </View>
                <Ionicons name="chevron-forward" size={20} color={colors.textMuted} />
            </TouchableOpacity>

            <Text style={styles.groupLabel}>Account</Text>
            <View style={styles.group}>
                <TouchableOpacity
                    style={styles.row}
                    onPress={() => navigation.navigate("EditProfile")}
                    activeOpacity={0.8}
                >
                    <Text style={styles.rowTitle}>Edit profile</Text>
                    <Ionicons name="chevron-forward" size={20} color={colors.textMuted} />
                </TouchableOpacity>
                <TouchableOpacity
                    style={[styles.row, styles.rowLast]}
                    onPress={() => supabase.auth.signOut()}
                    activeOpacity={0.8}
                >
                    <Text style={styles.rowTitle}>Log out</Text>
                    <Ionicons name="log-out-outline" size={20} color={colors.textMuted} />
                </TouchableOpacity>
            </View>

            <Text style={styles.groupLabel}>Preferences</Text>
            <View style={styles.group}>
                {NOTIFICATION_TOGGLES.map((item) => (
                    <View key={item.key} style={styles.row}>
                        <Text style={styles.rowTitle}>{item.title}</Text>
                        <Switch
                            value={notifyPrefs[item.key]}
                            onValueChange={() => toggleNotification(item.key)}
                            trackColor={{ false: colors.borderStrong, true: colors.accent }}
                            thumbColor={colors.white}
                        />
                    </View>
                ))}
                <TouchableOpacity
                    style={[styles.row, styles.rowLast]}
                    onPress={() =>
                        Alert.alert(
                            "Language",
                            "SkoonBook is currently available in English only. More South African languages are on the way."
                        )
                    }
                    activeOpacity={0.8}
                >
                    <Text style={styles.rowTitle}>Language</Text>
                    <View style={styles.rowValueWrap}>
                        <Text style={styles.rowValue}>English</Text>
                        <Ionicons name="chevron-forward" size={20} color={colors.textMuted} />
                    </View>
                </TouchableOpacity>
            </View>

            <Text style={styles.groupLabel}>More</Text>
            <View style={styles.group}>
                <TouchableOpacity style={styles.row} onPress={openSupportEmail} activeOpacity={0.8}>
                    <Text style={styles.rowTitle}>Contact support</Text>
                    <Ionicons name="mail-outline" size={20} color={colors.textMuted} />
                </TouchableOpacity>
                <TouchableOpacity
                    style={styles.row}
                    onPress={() => navigation.navigate("SupportInfo", { title: "Help & FAQ", body: FAQ_BODY })}
                    activeOpacity={0.8}
                >
                    <Text style={styles.rowTitle}>Help &amp; FAQ</Text>
                    <Ionicons name="chevron-forward" size={20} color={colors.textMuted} />
                </TouchableOpacity>
                <TouchableOpacity
                    style={[styles.row, styles.rowLast]}
                    onPress={() => navigation.navigate("AboutLegal")}
                    activeOpacity={0.8}
                >
                    <Text style={styles.rowTitle}>About &amp; legal</Text>
                    <Ionicons name="chevron-forward" size={20} color={colors.textMuted} />
                </TouchableOpacity>
            </View>

            {/* Outlined rather than filled: a solid red block made deleting
                your account the loudest thing on the screen. */}
            <TouchableOpacity style={styles.deleteBtn} onPress={handleDeleteAccount} activeOpacity={0.8}>
                <Ionicons name="trash-outline" size={18} color={colors.error} />
                <Text style={styles.deleteText}>Delete account</Text>
            </TouchableOpacity>
            <Text style={styles.deleteHint}>
                Permanently deletes your profile and history. Upcoming bookings are cancelled and the
                businesses notified.
            </Text>
        </ScrollView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
    scrollContent: { padding: 16, paddingBottom: 32 },
    loaderWrap: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: colors.background,
    },

    profileCard: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: colors.surface,
        borderRadius: borderRadius.xl,
        padding: 14,
        borderWidth: 1,
        borderColor: colors.border,
        ...shadows.card,
    },
    profileAvatar: { width: 52, height: 52, borderRadius: 26, backgroundColor: colors.surfaceMuted },
    profileAvatarFallback: {
        width: 52,
        height: 52,
        borderRadius: 26,
        backgroundColor: colors.surfaceMuted,
        alignItems: 'center',
        justifyContent: 'center',
    },
    profileTextWrap: { flex: 1, marginLeft: 12, marginRight: 8, minWidth: 0 },
    profileName: { fontSize: 17, fontWeight: '800', color: colors.text },
    profileEmail: { marginTop: 2, fontSize: 12.5, color: colors.textMuted, fontWeight: '600' },

    groupLabel: {
        fontSize: 12,
        fontWeight: '700',
        color: colors.textMuted,
        marginTop: 16,
        marginBottom: 8,
        marginLeft: 4,
        letterSpacing: 0.5,
        textTransform: 'uppercase',
    },
    // Rows sit flush inside one card with hairline dividers rather than
    // floating as separate cards with gaps between them.
    group: {
        backgroundColor: colors.surface,
        borderRadius: borderRadius.xl,
        borderWidth: 1,
        borderColor: colors.border,
        overflow: 'hidden',
        ...shadows.card,
    },
    row: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 12,
        paddingHorizontal: 16,
        paddingVertical: 13,
        minHeight: 52,
        borderBottomWidth: StyleSheet.hairlineWidth,
        borderBottomColor: colors.border,
    },
    rowLast: { borderBottomWidth: 0 },
    rowTitle: { fontSize: 15, fontWeight: '700', color: colors.text, flex: 1 },
    rowValueWrap: { flexDirection: 'row', alignItems: 'center', gap: 6 },
    rowValue: { fontSize: 14, fontWeight: '600', color: colors.textMuted },

    deleteBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
        marginTop: 24,
        paddingVertical: 13,
        borderRadius: borderRadius.lg,
        backgroundColor: colors.surface,
        borderWidth: 1,
        borderColor: colors.error,
    },
    deleteText: { color: colors.error, fontWeight: '800', fontSize: 15 },
    deleteHint: {
        fontSize: 12,
        color: colors.textMuted,
        lineHeight: 17,
        fontWeight: '500',
        textAlign: 'center',
        marginTop: 10,
        paddingHorizontal: 8,
    },
});
