import { createStackNavigator } from '@react-navigation/stack';
import Dashboard from '../screens/barber/Dashboard';

const Stack = createStackNavigator();

export default function BarberStack() {
  return (
    <Stack.Navigator>
      <Stack.Screen 
        name="BarberDashboard" 
        component={Dashboard} 
        options={{ title: 'My Shop Dashboard' }} 
      />
    </Stack.Navigator>
  );
}