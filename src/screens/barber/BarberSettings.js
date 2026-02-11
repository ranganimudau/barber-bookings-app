import React from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { supabase } from "../../supabase/supabaseClient";

export default function BarberSettings({ navigation }) {
  const menuItems = [
    { title: "Edit Shop Profile", icon: "business-outline", screen: "EditProfile" },
    { title: "Manage Services & Prices", icon: "pricetag-outline", screen: "Services" },
    { title: "Set Availability Hours", icon: "time-outline", screen: "Availability" },
  ];

  return (
    <ScrollView style={styles.container}>
      <View style={styles.menuGroup}>
        {menuItems.map((item, index) => (
          <TouchableOpacity 
            key={index} 
            style={styles.menuItem} 
            onPress={() => navigation.navigate(item.screen)}
          >
            <View style={styles.menuLabel}>
              <Ionicons name={item.icon} size={22} color="#333" />
              <Text style={styles.menuText}>{item.title}</Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color="#ccc" />
          </TouchableOpacity>
        ))}
      </View>

      <TouchableOpacity style={styles.logoutBtn} onPress={() => supabase.auth.signOut()}>
        <Ionicons name="log-out-outline" size={22} color="red" />
        <Text style={styles.logoutText}>Logout</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8f8f8' },
  menuGroup: { backgroundColor: '#fff', marginTop: 20, borderTopWidth: 1, borderBottomWidth: 1, borderColor: '#eee' },
  menuItem: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 15, borderBottomWidth: 1, borderBottomColor: '#f1f1f1' },
  menuLabel: { flexDirection: 'row', alignItems: 'center' },
  menuText: { fontSize: 16, marginLeft: 15, color: '#333' },
  logoutBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginTop: 40, padding: 15, backgroundColor: '#fff', borderTopWidth: 1, borderBottomWidth: 1, borderColor: '#eee' },
  logoutText: { color: 'red', fontWeight: 'bold', marginLeft: 10, fontSize: 16 }
});