import * as ImagePicker from 'expo-image-picker';
import React, { useEffect, useState } from "react";
import {
    ActivityIndicator,
    Alert,
    Image,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View
} from "react-native";
import Ionicons from "react-native-vector-icons/Ionicons";
import { supabase } from "../../supabase/supabaseClient";

export default function Settings() {
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

    if (loading) return <ActivityIndicator style={styles.loader} size="large" color="#000" />;

    return (
        <ScrollView style={styles.container}>
            <View style={styles.avatarContainer}>
                <TouchableOpacity onPress={uploadAvatar} disabled={updating}>
                    {profile.avatar_url ? (
                        <Image source={{ uri: profile.avatar_url }} style={styles.avatar} />
                    ) : (
                        <View style={styles.avatarPlaceholder}>
                            <Ionicons name="person" size={50} color="#ccc" />
                        </View>
                    )}
                    <View style={styles.cameraIcon}>
                        {updating ? (
                            <ActivityIndicator size="small" color="#fff" />
                        ) : (
                            <Ionicons name="camera" size={20} color="#fff" />
                        )}
                    </View>
                </TouchableOpacity>
            </View>

            <View style={styles.section}>
                <Text style={styles.label}>Full Name</Text>
                <TextInput
                    style={styles.input}
                    value={profile.full_name}
                    onChangeText={(t) => setProfile({ ...profile, full_name: t })}
                    placeholder="Enter your name"
                />

                <Text style={styles.label}>Phone Number</Text>
                <TextInput
                    style={styles.input}
                    value={profile.phone_number}
                    onChangeText={(t) => setProfile({ ...profile, phone_number: t })}
                    keyboardType="phone-pad"
                    placeholder="Enter your phone number"
                />

                <TouchableOpacity
                    style={styles.saveBtn}
                    onPress={handleUpdateProfile}
                    disabled={updating}
                >
                    <Text style={styles.saveBtnText}>
                        {updating ? "Saving..." : "Save Changes"}
                    </Text>
                </TouchableOpacity>
            </View>

            {/* Danger Zone Section */}
            <View style={styles.dangerSection}>
                <Text style={styles.dangerTitle}>Danger Zone</Text>
                <TouchableOpacity style={styles.deleteBtn} onPress={handleDeleteAccount}>
                    <Ionicons name="trash-outline" size={20} color="#ff3b30" />
                    <Text style={styles.deleteText}>Delete Account Data</Text>
                </TouchableOpacity>
            </View>

            <TouchableOpacity
                style={styles.logoutBtn}
                onPress={() => supabase.auth.signOut()}
            >
                <Text style={styles.logoutText}>Logout</Text>
            </TouchableOpacity>
        </ScrollView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: "#f8f8f8", padding: 20 },
    loader: { flex: 1, justifyContent: "center" },
    avatarContainer: { alignItems: 'center', marginVertical: 30 },
    avatar: { width: 120, height: 120, borderRadius: 60, borderWidth: 2, borderColor: '#000' },
    avatarPlaceholder: {
        width: 120, height: 120, borderRadius: 60, backgroundColor: '#eee',
        justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: '#ddd'
    },
    cameraIcon: {
        position: 'absolute', bottom: 0, right: 0,
        backgroundColor: '#000', padding: 8, borderRadius: 20, elevation: 5
    },
    section: {
        backgroundColor: "#fff", padding: 20, borderRadius: 15, elevation: 2,
        shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.1, shadowRadius: 4
    },
    label: { fontSize: 14, color: "#666", marginTop: 10, fontWeight: '600' },
    input: {
        backgroundColor: "#f9f9f9", padding: 12, borderRadius: 8,
        marginTop: 5, borderWidth: 1, borderColor: "#eee", fontSize: 16
    },
    saveBtn: { backgroundColor: "#000", padding: 15, borderRadius: 10, marginTop: 20, alignItems: "center" },
    saveBtnText: { color: "#fff", fontWeight: "bold", fontSize: 16 },
    dangerSection: {
        backgroundColor: "#fff", marginTop: 20, padding: 20, borderRadius: 15,
        borderWidth: 1, borderColor: '#ffe5e5'
    },
    dangerTitle: { fontSize: 16, fontWeight: 'bold', color: '#ff3b30', marginBottom: 10 },
    deleteBtn: { flexDirection: 'row', alignItems: 'center', paddingVertical: 5 },
    deleteText: { color: '#ff3b30', fontWeight: 'bold', marginLeft: 10 },
    logoutBtn: { marginTop: 40, marginBottom: 40, alignItems: 'center', padding: 10 },
    logoutText: { color: '#777', fontWeight: 'bold', fontSize: 16 }
});