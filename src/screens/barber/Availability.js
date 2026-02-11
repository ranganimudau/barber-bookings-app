import DateTimePicker from '@react-native-community/datetimepicker';
import React, { useEffect, useState } from 'react';
import { Alert, Platform, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Calendar } from 'react-native-calendars';
import { supabase } from '../../supabase/supabaseClient';

export default function Availability() {
  const today = new Date().toISOString().split('T')[0]; // Get current date in YYYY-MM-DD format
  const [selectedDate, setSelectedDate] = useState('');
  const [loading, setLoading] = useState(false);
  
  // Initialize times as Date objects for the picker
  const [times, setTimes] = useState({
    opening: new Date(new Date().setHours(8, 0, 0, 0)),
    closing: new Date(new Date().setHours(17, 0, 0, 0)),
    lunchStart: new Date(new Date().setHours(13, 0, 0, 0)),
    lunchEnd: new Date(new Date().setHours(14, 0, 0, 0)),
  });
  
  const [showPicker, setShowPicker] = useState(null); 

  // Load existing specific settings for the selected day if they exist
  useEffect(() => {
    if (selectedDate) {
      fetchDayAvailability();
    }
  }, [selectedDate]);

  const fetchDayAvailability = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      const { data, error } = await supabase
        .from('barber_availability')
        .select('*')
        .eq('barber_id', user.id)
        .eq('available_date', selectedDate)
        .single();

      if (data && !error) {
        // Helper to convert DB time string (08:00:00) to Date object
        const parseTime = (timeStr) => {
          const [h, m] = timeStr.split(':');
          const d = new Date();
          d.setHours(parseInt(h), parseInt(m), 0, 0);
          return d;
        };

        setTimes({
          opening: parseTime(data.opening_time),
          closing: parseTime(data.closing_time),
          lunchStart: parseTime(data.lunch_start),
          lunchEnd: parseTime(data.lunch_end),
        });
      }
    } catch (err) {
      console.log("No specific hours for this date yet, using defaults.");
    }
  };

  const onTimeChange = (event, selectedValue) => {
    setShowPicker(null);
    if (selectedValue) {
      setTimes({ ...times, [showPicker]: selectedValue });
    }
  };

  const formatTime = (date) => {
    const d = new Date(date);
    return `${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}`;
  };

  const handleSaveAvailability = async () => {
    if (!selectedDate) return Alert.alert("Error", "Please select a date on the calendar.");
    setLoading(true);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      
      const { error } = await supabase.from('barber_availability').upsert({
        barber_id: user.id,
        available_date: selectedDate,
        opening_time: formatTime(times.opening),
        closing_time: formatTime(times.closing),
        lunch_start: formatTime(times.lunchStart),
        lunch_end: formatTime(times.lunchEnd),
        is_available: true
      });

      if (error) throw error;
      Alert.alert("Success", `Specific hours saved for ${selectedDate}!`);
    } catch (error) {
      Alert.alert("Error", error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <ScrollView style={styles.container}>
      <Calendar
        minDate={today} // Prevents selecting dates in the past
        onDayPress={(day) => setSelectedDate(day.dateString)}
        markedDates={{ 
          [selectedDate]: { selected: true, selectedColor: '#000' },
          [today]: { marked: true, dotColor: 'red' }
        }}
        theme={{
          todayTextColor: '#000',
          arrowColor: '#000',
          selectedDayBackgroundColor: '#000',
        }}
      />

      {selectedDate ? (
        <View style={styles.card}>
          <Text style={styles.title}>Adjust Hours: {selectedDate}</Text>
          
          <Text style={styles.label}>Shift Hours</Text>
          <View style={styles.row}>
            <TouchableOpacity style={styles.timeBtn} onPress={() => setShowPicker('opening')}>
              <Text style={styles.timeText}>{formatTime(times.opening)}</Text>
            </TouchableOpacity>
            <Text style={styles.toText}>to</Text>
            <TouchableOpacity style={styles.timeBtn} onPress={() => setShowPicker('closing')}>
              <Text style={styles.timeText}>{formatTime(times.closing)}</Text>
            </TouchableOpacity>
          </View>

          <Text style={styles.label}>Lunch Break</Text>
          <View style={styles.row}>
            <TouchableOpacity style={styles.timeBtn} onPress={() => setShowPicker('lunchStart')}>
              <Text style={styles.timeText}>{formatTime(times.lunchStart)}</Text>
            </TouchableOpacity>
            <Text style={styles.toText}>to</Text>
            <TouchableOpacity style={styles.timeBtn} onPress={() => setShowPicker('lunchEnd')}>
              <Text style={styles.timeText}>{formatTime(times.lunchEnd)}</Text>
            </TouchableOpacity>
          </View>

          {showPicker && (
            <DateTimePicker
              value={times[showPicker]}
              mode="time"
              is24Hour={true}
              display={Platform.OS === 'ios' ? 'spinner' : 'default'}
              onChange={onTimeChange}
            />
          )}

          <TouchableOpacity 
            style={[styles.saveBtn, loading && { opacity: 0.7 }]} 
            onPress={handleSaveAvailability}
            disabled={loading}
          >
            <Text style={styles.saveBtnText}>{loading ? "Saving..." : "Update Date Availability"}</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <View style={styles.placeholder}>
          <Text style={styles.placeholderText}>Select a date to set custom hours for that day.</Text>
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  card: { padding: 20, margin: 15, backgroundColor: '#f9f9f9', borderRadius: 15, elevation: 2, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.2, shadowRadius: 2 },
  title: { fontSize: 18, fontWeight: 'bold', marginBottom: 20, textAlign: 'center' },
  label: { fontSize: 13, fontWeight: '600', color: '#666', marginBottom: 8, textTransform: 'uppercase' },
  row: { flexDirection: 'row', alignItems: 'center', marginBottom: 20, justifyContent: 'space-between' },
  timeBtn: { padding: 12, backgroundColor: '#fff', borderRadius: 10, borderWidth: 1, borderColor: '#eee', flex: 0.45, alignItems: 'center' },
  timeText: { fontSize: 16, fontWeight: 'bold', color: '#000' },
  toText: { fontSize: 14, color: '#999', fontWeight: 'bold' },
  saveBtn: { backgroundColor: '#000', padding: 18, borderRadius: 12, alignItems: 'center', marginTop: 10 },
  saveBtnText: { color: '#fff', fontWeight: 'bold', fontSize: 16 },
  placeholder: { padding: 40, alignItems: 'center' },
  placeholderText: { color: '#999', textAlign: 'center', fontSize: 15 }
});