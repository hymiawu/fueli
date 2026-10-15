import { Platform, StyleSheet, View, useWindowDimensions } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import LoginScreen from './screens/LoginScreen';
import OnboardingScreen from './screens/OnboardingScreen';
import HomeScreen from './screens/HomeScreen';
import AddIngredientScreen from './screens/AddIngredientScreen';
import ScanIngredientScreen from './screens/ScanIngredientScreen';

const Stack = createNativeStackNavigator();

// On wide web screens the app is shown inside a phone-sized frame, since the UI is designed for phones.
const PHONE_WIDTH = 390;
const PHONE_HEIGHT = 844;
const FRAME_BREAKPOINT = 600;

function PhoneFrame({ children }) {
  const { width, height } = useWindowDimensions();
  if (Platform.OS !== 'web' || width < FRAME_BREAKPOINT) return children;

  return (
    <View style={styles.backdrop}>
      <View style={[styles.phone, { height: Math.min(PHONE_HEIGHT, height - 48) }]}>
        {children}
      </View>
    </View>
  );
}

export default function App() {
  return (
    <PhoneFrame>
      <NavigationContainer>
        <Stack.Navigator screenOptions={{ headerShown: false }}>
          <Stack.Screen name="Login" component={LoginScreen} />
          <Stack.Screen name="Onboarding" component={OnboardingScreen} />
          <Stack.Screen name="Home" component={HomeScreen} />
          <Stack.Screen name="AddIngredient" component={AddIngredientScreen} />
          <Stack.Screen name="ScanIngredient" component={ScanIngredientScreen} />
        </Stack.Navigator>
      </NavigationContainer>
    </PhoneFrame>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#E8EEED',
  },
  phone: {
    width: PHONE_WIDTH,
    overflow: 'hidden',
    borderRadius: 36,
    borderWidth: 8,
    borderColor: '#1A1A1A',
    backgroundColor: '#fff',
    boxShadow: '0 20px 60px rgba(0, 0, 0, 0.25)',
  },
});
