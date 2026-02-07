import { signOut } from 'firebase/auth';
import React from 'react';
import { Alert, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';
import { auth } from '../../firebase/firebaseConfig';

export default function ProfileScreen({ navigation }) {
  const user = auth.currentUser;

  const handleLogout = () => {
    Alert.alert(
      "Logout",
      "Are you sure you want to sign out?",
      [
        { text: "Cancel", style: "cancel" },
        { 
          text: "Logout", 
          style: "destructive", 
          onPress: () => signOut(auth).catch(err => Alert.alert("Error", err.message)) 
        }
      ]
    );
  };

  return (
    <View style={styles.container}>
      {/* Header Section */}
      <View style={styles.header}>
        <View style={styles.avatarContainer}>
          <Icon name="person-circle" size={100} color="#ddd" />
        </View>
        <Text style={styles.userName}>{user?.displayName || "BarberLink User"}</Text>
        <Text style={styles.userEmail}>{user?.email}</Text>
      </View>

      {/* Options Menu */}
      <View style={styles.menuContainer}>
        <TouchableOpacity style={styles.menuItem} onPress={() => navigation.navigate('MyBookings')}>
          <Icon name="calendar-outline" size={22} color="#333" />
          <Text style={styles.menuText}>My Appointments</Text>
          <Icon name="chevron-forward" size={18} color="#ccc" />
        </TouchableOpacity>

        <TouchableOpacity style={styles.menuItem}>
          <Icon name="settings-outline" size={22} color="#333" />
          <Text style={styles.menuText}>Account Settings</Text>
          <Icon name="chevron-forward" size={18} color="#ccc" />
        </TouchableOpacity>

        <TouchableOpacity style={styles.menuItem}>
          <Icon name="help-circle-outline" size={22} color="#333" />
          <Text style={styles.menuText}>Help & Support</Text>
          <Icon name="chevron-forward" size={18} color="#ccc" />
        </TouchableOpacity>

        {/* Logout Button */}
        <TouchableOpacity style={[styles.menuItem, styles.logoutItem]} onPress={handleLogout}>
          <Icon name="log-out-outline" size={22} color="#FF3B30" />
          <Text style={[styles.menuText, styles.logoutText]}>Logout</Text>
        </TouchableOpacity>
      </View>

      <Text style={styles.versionText}>BarberLink v1.0.0 (MVP)</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  header: { 
    alignItems: 'center', 
    paddingVertical: 40, 
    borderBottomWidth: 1, 
    borderBottomColor: '#f0f0f0',
    backgroundColor: '#fafafa'
  },
  avatarContainer: { marginBottom: 10 },
  userName: { fontSize: 22, fontWeight: 'bold', color: '#000' },
  userEmail: { fontSize: 14, color: '#666', marginTop: 4 },
  menuContainer: { paddingHorizontal: 20, marginTop: 20 },
  menuItem: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    paddingVertical: 15, 
    borderBottomWidth: 1, 
    borderBottomColor: '#f9f9f9' 
  },
  menuText: { flex: 1, fontSize: 16, marginLeft: 15, color: '#333' },
  logoutItem: { marginTop: 20, borderBottomWidth: 0 },
  logoutText: { color: '#FF3B30', fontWeight: 'bold' },
  versionText: { 
    textAlign: 'center', 
    color: '#ccc', 
    fontSize: 12, 
    marginTop: 'auto', 
    marginBottom: 20 
  }
});