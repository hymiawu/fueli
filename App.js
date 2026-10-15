import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import LoginScreen from './screens/LoginScreen';
import OnboardingScreen from './screens/OnboardingScreen';
import HomeScreen from './screens/HomeScreen';
import AddIngredientScreen from './screens/AddIngredientScreen';
import ScanIngredientScreen from './screens/ScanIngredientScreen';

const Stack = createNativeStackNavigator();

export default function App() {
  return (
    <NavigationContainer>
      <Stack.Navigator screenOptions={{ headerShown: false }}>
        <Stack.Screen name="Login" component={LoginScreen} />
        <Stack.Screen name="Onboarding" component={OnboardingScreen} />
        <Stack.Screen name="Home" component={HomeScreen} />
        <Stack.Screen name="AddIngredient" component={AddIngredientScreen} />
        <Stack.Screen name="ScanIngredient" component={ScanIngredientScreen} />
      </Stack.Navigator>
    </NavigationContainer>
  );
}
