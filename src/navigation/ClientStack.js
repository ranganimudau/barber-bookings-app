import { createStackNavigator } from '@react-navigation/stack';
import MapScreen from '../screens/client/MapScreen'; // [cite: 43, 44]

const Stack = createStackNavigator();

export default function ClientStack() {
  return (
    <Stack.Navigator>
      <Stack.Screen name="Home" component={MapScreen} />
    </Stack.Navigator>
  );
}