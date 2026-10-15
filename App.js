import { Platform, StyleSheet, View, useWindowDimensions } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import LoginScreen from './screens/LoginScreen';
import OnboardingScreen from './screens/OnboardingScreen';
import HomeScreen from './screens/HomeScreen';
import AddIngredientScreen from './screens/AddIngredientScreen';
import ScanIngredientScreen from './screens/ScanIngredientScreen';
import PaywallScreen from './screens/PaywallScreen';
import EditProfileScreen from './screens/EditProfileScreen';
import MembershipScreen from './screens/MembershipScreen';

const Stack = createNativeStackNavigator();

// On wide web screens the app is shown inside a phone-sized frame, since the UI is designed for phones.
// Screen size matches an iPhone 15/16 (393×852 pt); the whole phone scales down evenly on short windows.
const SCREEN_WIDTH = 393;
const SCREEN_HEIGHT = 852;
const BEZEL = 12;
const SCREEN_RADIUS = 47;
const FRAME_BREAKPOINT = 600;
const MARGIN = 24;

function PhoneFrame({ children }) {
  const { width, height } = useWindowDimensions();
  if (Platform.OS !== 'web' || width < FRAME_BREAKPOINT) return children;

  const phoneWidth = SCREEN_WIDTH + BEZEL * 2;
  const phoneHeight = SCREEN_HEIGHT + BEZEL * 2;
  const scale = Math.min(1, (height - MARGIN * 2) / phoneHeight, (width - MARGIN * 2) / phoneWidth);

  return (
    <View style={styles.backdrop}>
      <View style={[styles.phone, { width: phoneWidth, height: phoneHeight, transform: [{ scale }] }]}>
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
          <Stack.Screen name="Paywall" component={PaywallScreen} />
          <Stack.Screen name="Home" component={HomeScreen} />
          <Stack.Screen name="AddIngredient" component={AddIngredientScreen} />
          <Stack.Screen name="ScanIngredient" component={ScanIngredientScreen} />
          <Stack.Screen name="EditProfile" component={EditProfileScreen} />
          <Stack.Screen name="Membership" component={MembershipScreen} />
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
    overflow: 'hidden',
    backgroundColor: '#E8EEED',
  },
  phone: {
    overflow: 'hidden',
    borderRadius: SCREEN_RADIUS + BEZEL,
    borderWidth: BEZEL,
    borderColor: '#1A1A1A',
    backgroundColor: '#fff',
    boxShadow: '0 20px 60px rgba(0, 0, 0, 0.25)',
  },
});
