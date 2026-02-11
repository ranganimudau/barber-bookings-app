import { createStackNavigator } from '@react-navigation/stack';
import BarberProfile from '../screens/client/BarberProfile'; // Import the screen
import ClientHome from '../screens/client/ClientHome';

const Stack = createStackNavigator();

export default function ClientStack() {
  return (
    <Stack.Navigator>
      <Stack.Screen name="ClientHome" component={ClientHome} options={{ title: "Find a Barber" }} />
      {/* ADD THIS LINE BELOW */}
      <Stack.Screen name="BarberProfile" component={BarberProfile} options={{ title: "Book Service" }} />
    </Stack.Navigator>
  );
}