import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Text } from 'react-native';
import FridgeScreen from './FridgeScreen';
import MealScreen from './MealScreen';
import ExerciseScreen from './ExerciseScreen';
import ProfileScreen from './ProfileScreen';

const Tab = createBottomTabNavigator();

const icon = (emoji) => ({ focused }) => (
  <Text style={{ fontSize: 22, opacity: focused ? 1 : 0.5 }}>{emoji}</Text>
);

export default function HomeScreen() {
  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
        tabBarStyle: {
          backgroundColor: '#fff',
          borderTopColor: '#F0F0F0',
          paddingBottom: 24,
          paddingTop: 8,
          height: 80,
        },
        tabBarActiveTintColor: '#0D9E8A',
        tabBarInactiveTintColor: '#aaa',
        tabBarLabelStyle: {
          fontSize: 11,
          fontWeight: '600',
        },
      }}
    >
      <Tab.Screen
        name="Fridge"
        component={FridgeScreen}
        options={{ tabBarIcon: icon('🧊'), tabBarLabel: 'My Fridge' }}
      />
      <Tab.Screen
        name="Meal"
        component={MealScreen}
        options={{ tabBarIcon: icon('🍽️'), tabBarLabel: 'My Meal' }}
      />
      <Tab.Screen
        name="Exercise"
        component={ExerciseScreen}
        options={{ tabBarIcon: icon('💪'), tabBarLabel: 'Exercise' }}
      />
      <Tab.Screen
        name="Profile"
        component={ProfileScreen}
        options={{ tabBarIcon: icon('👤'), tabBarLabel: 'Profile' }}
      />
    </Tab.Navigator>
  );
}
