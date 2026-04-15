import { useFocusEffect } from '@react-navigation/native';
import React, { useCallback, useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    FlatList,
    Image,
    Linking,
    RefreshControl,
    StyleSheet,
    Text,
    TouchableOpacity,
    View
} from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';
import { supabase } from '../../supabase/supabaseClient';
import { colors } from '../../theme/clientTheme';
import { ensureBarberSubscriptionState, getTrialRemaining, isSubscriptionEligible } from '../../utils/subscriptionState';

export default function BarberDashboard({ navigation }) {
  const [bookings, setBookings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [barberName, setBarberName] = useState('');
  const [barberAvatar, setBarberAvatar] = useState(null);
  const [subscriptionState, setSubscriptionState] = useState(null);

  // Fetch bookings and related client data
  const fetchBookings = useCallback(async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("No user logged in");

      try {
        const state = await ensureBarberSubscriptionState(user.id);
        setSubscriptionState(state);
      } catch (e) {
        console.warn("Subscription state load failed:", e?.message);
      }

      // Fetch barber's name for the header
      const { data: barberProfile } = await supabase
        .from('barbers')
        .select('shop_name, avatar_url')
        .eq('id', user.id)
        .single();

      if (barberProfile) {
        setBarberName(barberProfile.shop_name);
        // Add a timestamp to the avatar URL to prevent caching issues on focus
        if (barberProfile.avatar_url) {
          const avatar = barberProfile.avatar_url;
          setBarberAvatar(
            avatar.startsWith('data:image/')
              ? avatar
              : `${avatar}${avatar.includes('?') ? '&' : '?'}t=${new Date().getTime()}`
          );
        } else {
          setBarberAvatar(null);
        }
      }

      // --- KEY CHANGE: Fetch Bookings with Client Details ---
      // This query joins the 'bookings' with the 'profiles' table.
      // It assumes 'client_id' in 'bookings' is the foreign key to 'profiles'.
      // 'client:client_id(...)' creates a nested object named 'client' with the selected fields.
      const { data: bookingsData, error: bookingsError } = await supabase
        .from('bookings')
        .select(`
          id,
          booking_date,
          booking_time,
          status,
          client:client_id ( full_name, phone_number, avatar_url )
        `)
        .eq('barber_id', user.id)
        .order('booking_date', { ascending: true });

      if (bookingsError) {
        throw bookingsError;
      }
      
      // The result for each booking will now look like:
      // { id: 1, ..., client: { full_name: 'John Doe', phone_number: '0821234567' } }
      if (bookingsData) {
        // --- DEBUG: Log the data to see what Supabase is returning ---
        console.log("Fetched Bookings Data:", JSON.stringify(bookingsData, null, 2));
        setBookings(bookingsData);
      }

    } catch (error) {
      Alert.alert('Error fetching data', error.message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      fetchBookings();
    }, [fetchBookings])
  );
  const onRefresh = () => {
    setRefreshing(true);
    fetchBookings();
  };

  // Function to handle calling the client
  const handleCallClient = (phoneNumber) => {
    if (!phoneNumber) {
      Alert.alert("No Phone Number", "This client has not provided a phone number.");
      return;
    }
    // This will open the phone's dialer
    Linking.openURL(`tel:${phoneNumber}`);
  };

  const updateBookingStatus = async (bookingId, newStatus) => {
    // Optimistically update the UI for a faster user experience
    const originalBookings = bookings;
    setBookings(currentBookings =>
      currentBookings.map(booking =>
        booking.id === bookingId ? { ...booking, status: newStatus } : booking
      )
    );

    const { error } = await supabase
      .from('bookings')
      .update({ status: newStatus })
      .eq('id', bookingId);

    if (error) {
      Alert.alert('Update Error', error.message);
      setBookings(originalBookings); // Revert on error
    }
  };

  // --- UI CHANGE: Render the Client's Name and Phone ---
  const renderBookingItem = ({ item }) => {
    const clientName = item.client?.full_name || 'Client Name Unavailable';
    const clientPhone = item.client?.phone_number;
    const clientAvatar = item.client?.avatar_url;
    const bookingDate = new Date(item.booking_date).toLocaleDateString('en-ZA', {
        day: 'numeric',
        month: 'long',
        year: 'numeric'
    });

    return (
      <View style={styles.bookingCard}>
        <View style={styles.cardHeader}>
          {clientAvatar ? (
            <Image source={{ uri: clientAvatar }} style={styles.avatarImage} />
          ) : (
            <Icon name="person-circle" size={40} color={colors.textMuted} style={styles.avatarIcon} />
          )}
          <View style={styles.headerText}>
            <Text style={styles.clientName}>{clientName}</Text>
            <Text style={styles.bookingDate}>
              {bookingDate} at {item.booking_time}
            </Text>
          </View>
        </View>
        <View style={styles.cardBody}>
          <Text style={styles.status}>Status: {item.status}</Text>
          {clientPhone ? (
            <TouchableOpacity style={styles.callButton} onPress={() => handleCallClient(clientPhone)}>
              <Icon name="call" size={16} color="#fff" />
              <Text style={styles.callButtonText}>{clientPhone}</Text>
            </TouchableOpacity>
          ) : (
            <Text style={styles.noPhoneText}>No phone number</Text>
          )}
        </View>
      </View>
    );
  };

  if (loading) return <ActivityIndicator style={[styles.centered, { backgroundColor: colors.background }]} size="large" color={colors.accent} />;

  const subscriptionEligible = isSubscriptionEligible(subscriptionState);
  const showSubscriptionBanner =
    !!subscriptionState &&
    !subscriptionEligible &&
    ((subscriptionState.status === "trial" && getTrialRemaining(subscriptionState) <= 0) ||
      (subscriptionState.status === "inactive" && subscriptionState.registration_fee_paid));

  return (
    <View style={styles.container}>
      <View style={styles.headerContainer}>
        {barberAvatar && <Image source={{ uri: barberAvatar }} style={styles.headerAvatar} />}
        <Text style={styles.header}>Welcome, {barberName || 'Barber'}</Text>
      </View>

      {showSubscriptionBanner ? (
        <View style={styles.subscriptionBanner}>
          <View style={styles.subscriptionBannerLeft}>
            <Icon name="lock-closed-outline" size={16} color={colors.accent} />
            <Text style={styles.subscriptionBannerText}>Trial finished. Pay R100 to continue receiving bookings.</Text>
          </View>
          <TouchableOpacity
            style={styles.subscriptionBannerBtn}
            onPress={() => navigation.navigate("SubscriptionPaywall")}
            activeOpacity={0.88}
          >
            <Text style={styles.subscriptionBannerBtnText}>Pay now</Text>
          </TouchableOpacity>
        </View>
      ) : null}

      <Text style={styles.subHeader}>Your Appointments</Text>
      <FlatList
        data={bookings}
        renderItem={renderBookingItem}
        keyExtractor={(item) => item.id.toString()}
        contentContainerStyle={{ paddingBottom: 20 }}
        ListEmptyComponent={<Text style={styles.emptyText}>You have no upcoming bookings.</Text>}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[colors.accent]} />
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
    paddingHorizontal: 20,
    paddingTop: 60,
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 5,
  },
  headerAvatar: {
    width: 50,
    height: 50,
    borderRadius: 25,
    marginRight: 15,
  },
  header: {
    fontSize: 28,
    fontWeight: '800',
    color: colors.accent,
    flex: 1,
  },
  subHeader: {
    fontSize: 18,
    color: colors.textMuted,
    marginBottom: 20,
  },
  subscriptionBanner: {
    marginBottom: 12,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(197,160,112,0.35)',
    backgroundColor: 'rgba(255,255,255,0.04)',
    padding: 10,
    flexDirection: 'row',
    alignItems: 'center',
  },
  subscriptionBannerLeft: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: 8,
  },
  subscriptionBannerText: {
    color: '#F5F5F0',
    fontSize: 12,
    fontWeight: '800',
    lineHeight: 16,
    marginLeft: 8,
    flex: 1,
  },
  subscriptionBannerBtn: {
    borderRadius: 10,
    backgroundColor: colors.accent,
    paddingVertical: 8,
    paddingHorizontal: 10,
  },
  subscriptionBannerBtnText: {
    color: '#0A0A0A',
    fontSize: 11,
    fontWeight: '900',
  },
  bookingCard: {
    backgroundColor: 'rgba(255,255,255,0.03)',
    borderRadius: 12,
    padding: 15,
    marginBottom: 15,
    shadowColor: "#000",
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 3.84,
    elevation: 1,
    borderWidth: 1,
    borderColor: 'rgba(197,160,112,0.25)',
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.08)',
    paddingBottom: 10,
    marginBottom: 10,
  },
  avatarIcon: {
    marginRight: 12,
  },
  avatarImage: {
    width: 40,
    height: 40,
    borderRadius: 20,
    marginRight: 12,
    backgroundColor: 'rgba(255,255,255,0.05)',
  },
  headerText: {
    flex: 1,
  },
  clientName: {
    fontSize: 18,
    fontWeight: '700',
    color: '#F5F5F0',
  },
  bookingDate: {
    fontSize: 14,
    color: colors.textMuted,
  },
  cardBody: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  status: {
    fontSize: 14,
    fontWeight: '600',
    color: '#F5F5F0',
    textTransform: 'capitalize',
  },
  callButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#0A0A0A',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(197,160,112,0.35)',
  },
  callButtonText: {
    color: '#fff',
    marginLeft: 6,
    fontWeight: 'bold',
  },
  noPhoneText: {
    fontSize: 14,
    color: colors.textMuted,
    fontStyle: 'italic',
  },
  emptyText: {
    textAlign: 'center',
    marginTop: 50,
    fontSize: 16,
    color: colors.textMuted,
  },
  cardActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginTop: 15,
    paddingTop: 15,
    borderTopWidth: 1,
    borderTopColor: '#eee',
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 20,
    marginLeft: 10,
  },
  actionButtonText: {
    color: '#fff',
    marginLeft: 6,
    fontWeight: 'bold',
    fontSize: 12,
  },
  completeButton: { backgroundColor: '#28a745' /* Green */ },
  cancelButton: { backgroundColor: '#dc3545' /* Red */ },
});
