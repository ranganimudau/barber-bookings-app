import React from 'react';
import { Dimensions, FlatList, Image, SafeAreaView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';

const { width } = Dimensions.get('window');

const SAMPLE = [
  { id: '1', name: 'Cut and Beard', price: 'R70', image: 'https://picsum.photos/seed/1/400' },
  { id: '2', name: 'Beard', price: 'R20', image: 'https://picsum.photos/seed/2/400' },
  { id: '3', name: 'Chiskop', price: 'R50', image: 'https://picsum.photos/seed/3/400' }
];

export default function ManageServicesDesign() {
  const renderItem = ({ item }) => (
    <View style={styles.card}>
      <Image source={{ uri: item.image }} style={styles.thumb} />

      <View style={styles.meta}>
        <Text numberOfLines={1} style={styles.title}>{item.name}</Text>
        <Text style={styles.price}>{item.price}</Text>
      </View>

      <View style={styles.actions}>
        <TouchableOpacity style={styles.iconBtn}>
          <Icon name="create-outline" size={20} color="#1976d2" />
        </TouchableOpacity>
        <TouchableOpacity style={styles.iconBtn}>
          <Icon name="image-outline" size={20} color="#444" />
        </TouchableOpacity>
        <TouchableOpacity style={styles.iconBtn}>
          <Icon name="trash-outline" size={20} color="#e53935" />
        </TouchableOpacity>
      </View>
    </View>
  );

  return (
    <SafeAreaView style={styles.screen}>
      <View style={styles.headerWrap}>
        <Text style={styles.header}>Manage Services</Text>
      </View>

      <FlatList
        contentContainerStyle={styles.list}
        data={SAMPLE}
        keyExtractor={(i) => i.id}
        renderItem={renderItem}
        showsVerticalScrollIndicator={false}
      />

      <View style={styles.addCard}>
        <View style={styles.addRow}>
          <TextInput placeholder="Service name" placeholderTextColor="#8a8a8a" style={styles.input} />
          <TextInput placeholder="Price" placeholderTextColor="#8a8a8a" keyboardType="numeric" style={[styles.input, styles.priceInput]} />
        </View>

        <View style={styles.addActions}>
          <TouchableOpacity style={styles.pickBtn}>
            <Icon name="image-outline" size={18} color="#fff" />
            <Text style={styles.pickText}> Pick Image</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.addBtn}>
            <Text style={styles.addText}>Add</Text>
          </TouchableOpacity>
        </View>
      </View>

      <View style={styles.bottomNav}>
        <TouchableOpacity style={styles.navItem}>
          <Icon name="calendar-outline" size={22} color="#777" />
          <Text style={styles.navLabel}>Bookings</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.navItem}>
          <Icon name="wallet-outline" size={22} color="#777" />
          <Text style={styles.navLabel}>Earnings</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.navItem, styles.navActive]}>
          <Icon name="settings-outline" size={22} color="#1976d2" />
          <Text style={[styles.navLabel, { color: '#1976d2' }]}>Settings</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#f3f4f6' },
  headerWrap: { paddingHorizontal: 20, paddingTop: 18, paddingBottom: 8 },
  header: { fontSize: 28, fontWeight: '700', color: '#111', letterSpacing: -0.2 },
  list: { paddingHorizontal: 20, paddingBottom: 20, paddingTop: 8 },

  card: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.9)',
    borderRadius: 14,
    padding: 12,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOpacity: 0.06,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 4
  },
  thumb: { width: 72, height: 72, borderRadius: 10, backgroundColor: '#eee' },
  meta: { flex: 1, marginLeft: 12, justifyContent: 'center' },
  title: { fontSize: 16, fontWeight: '700', color: '#0f1720' },
  price: { marginTop: 6, color: '#6b7280', fontSize: 14 },

  actions: { flexDirection: 'row', alignItems: 'center', marginLeft: 8 },
  iconBtn: { padding: 6, marginLeft: 6, borderRadius: 8 },

  addCard: {
    marginHorizontal: 20,
    marginBottom: 90,
    backgroundColor: 'rgba(255,255,255,0.95)',
    borderRadius: 14,
    padding: 14,
    shadowColor: '#000',
    shadowOpacity: 0.04,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 6
  },
  addRow: { flexDirection: 'row', alignItems: 'center' },
  input: {
    flex: 1,
    backgroundColor: '#f7fafc',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    color: '#111'
  },
  priceInput: { width: 110, marginLeft: 10, textAlign: 'center' },
  addActions: { flexDirection: 'row', marginTop: 12, justifyContent: 'space-between', alignItems: 'center' },
  pickBtn: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#1976d2', paddingHorizontal: 12, paddingVertical: 10, borderRadius: 10 },
  pickText: { color: '#fff', fontWeight: '600', marginLeft: 8 },
  addBtn: { backgroundColor: '#0b5ed7', paddingHorizontal: 20, paddingVertical: 12, borderRadius: 12 },
  addText: { color: '#fff', fontWeight: '800' },

  bottomNav: {
    position: 'absolute',
    left: 16,
    right: 16,
    bottom: 18,
    height: 64,
    borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.98)',
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.06,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 8 },
    elevation: 10
  },
  navItem: { alignItems: 'center' },
  navLabel: { fontSize: 11, color: '#777', marginTop: 4 },
  navActive: { /* visual marker; color handled on icon/text */ }
});
