import React, { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity,
  StyleSheet, ScrollView, KeyboardAvoidingView,
  Platform, ActivityIndicator, } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Alert } from '../lib/alert';
import { supabase } from '../lib/supabase';

const STEPS = ['Stats', 'Activity', 'Goal', 'Diet', 'Account'];

const ACTIVITY_OPTIONS = [
  { label: 'Sedentary', desc: 'Little to no exercise' },
  { label: 'Lightly Active', desc: '1-3 days per week' },
  { label: 'Moderately Active', desc: '3-5 days per week' },
  { label: 'Very Active', desc: '6-7 days per week' },
];

const GOAL_OPTIONS = ['Lose Fat', 'Build Muscle', 'Maintain Weight', 'Eat Healthier'];
const DIET_OPTIONS = ['No Restriction', 'Vegetarian', 'Vegan', 'Low Carb', 'High Protein'];

export default function OnboardingScreen({ navigation }) {
  const [step, setStep] = useState(0);
  const [height, setHeight] = useState('');
  const [weight, setWeight] = useState('');
  const [activity, setActivity] = useState('');
  const [goal, setGoal] = useState('');
  const [diet, setDiet] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const canProceed = () => {
    if (step === 0) return height.length > 0 && weight.length > 0;
    if (step === 1) return activity.length > 0;
    if (step === 2) return goal.length > 0;
    if (step === 3) return diet.length > 0;
    if (step === 4) return email.length > 0 && password.length >= 6;
    return false;
  };

  const handleNext = async () => {
    if (step < 4) {
      setStep(step + 1);
      return;
    }
    setLoading(true);
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { height, weight, activity, goal, diet },
      },
    });
    setLoading(false);
    if (error) {
      Alert.alert('Sign Up Failed', error.message);
    } else if (!data.session) {
      // Email confirmation is on: the user must confirm, then log in and subscribe.
      Alert.alert('Confirm your email', 'We sent you a confirmation link. After confirming, log in to start your subscription.', [
        { text: 'OK', onPress: () => navigation.replace('Login') },
      ]);
    } else {
      Alert.alert('Account Created!', 'Welcome to Fueli 🎉 One last step: start your subscription.', [
        { text: 'Continue', onPress: () => navigation.replace('Paywall') },
      ]);
    }
  };

  const renderStep = () => {
    switch (step) {
      case 0:
        return (
          <View>
            <Text style={styles.question}>What are your stats?</Text>
            <TextInput
              style={styles.input}
              placeholder="Height (cm)"
              placeholderTextColor="#aaa"
              value={height}
              onChangeText={setHeight}
              keyboardType="numeric"
            />
            <TextInput
              style={styles.input}
              placeholder="Weight (kg)"
              placeholderTextColor="#aaa"
              value={weight}
              onChangeText={setWeight}
              keyboardType="numeric"
            />
          </View>
        );
      case 1:
        return (
          <View>
            <Text style={styles.question}>How active are you?</Text>
            {ACTIVITY_OPTIONS.map((opt) => (
              <TouchableOpacity
                key={opt.label}
                style={[styles.option, activity === opt.label && styles.optionSelected]}
                onPress={() => setActivity(opt.label)}
              >
                <Text style={[styles.optionLabel, activity === opt.label && styles.optionLabelSelected]}>
                  {opt.label}
                </Text>
                <Text style={[styles.optionDesc, activity === opt.label && styles.optionDescSelected]}>
                  {opt.desc}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        );
      case 2:
        return (
          <View>
            <Text style={styles.question}>What's your goal?</Text>
            {GOAL_OPTIONS.map((opt) => (
              <TouchableOpacity
                key={opt}
                style={[styles.option, goal === opt && styles.optionSelected]}
                onPress={() => setGoal(opt)}
              >
                <Text style={[styles.optionLabel, goal === opt && styles.optionLabelSelected]}>
                  {opt}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        );
      case 3:
        return (
          <View>
            <Text style={styles.question}>Any dietary preferences?</Text>
            {DIET_OPTIONS.map((opt) => (
              <TouchableOpacity
                key={opt}
                style={[styles.option, diet === opt && styles.optionSelected]}
                onPress={() => setDiet(opt)}
              >
                <Text style={[styles.optionLabel, diet === opt && styles.optionLabelSelected]}>
                  {opt}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        );
      case 4:
        return (
          <View>
            <Text style={styles.question}>Create your account</Text>
            <TextInput
              style={styles.input}
              placeholder="Email"
              placeholderTextColor="#aaa"
              value={email}
              onChangeText={setEmail}
              autoCapitalize="none"
              keyboardType="email-address"
            />
            <TextInput
              style={styles.input}
              placeholder="Password (min. 6 characters)"
              placeholderTextColor="#aaa"
              value={password}
              onChangeText={setPassword}
              secureTextEntry
            />
          </View>
        );
      default:
        return null;
    }
  };

  return (
    <SafeAreaView style={styles.safe}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        {/* Top bar */}
        <View style={styles.topBar}>
          <TouchableOpacity onPress={() => step === 0 ? navigation.goBack() : setStep(step - 1)}>
            <Text style={styles.backArrow}>← Back</Text>
          </TouchableOpacity>
          <View style={styles.progressContainer}>
            {STEPS.map((s, i) => (
              <View key={i} style={[styles.progressDot, i <= step && styles.progressDotActive]} />
            ))}
          </View>
        </View>

        <ScrollView
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
        >
          <Text style={styles.stepLabel}>Step {step + 1} of {STEPS.length}</Text>
          {renderStep()}
        </ScrollView>

        <View style={styles.footer}>
          <TouchableOpacity
            style={[styles.nextBtn, !canProceed() && styles.nextBtnDisabled]}
            onPress={handleNext}
            disabled={!canProceed() || loading}
          >
            {loading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.nextText}>{step === 4 ? 'Create Account' : 'Next'}</Text>
            )}
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#fff' },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 12,
    justifyContent: 'space-between',
  },
  backArrow: {
    fontSize: 16,
    color: '#0D9E8A',
    fontWeight: '600',
  },
  progressContainer: {
    flexDirection: 'row',
    gap: 8,
  },
  progressDot: {
    width: 8, height: 8,
    borderRadius: 4,
    backgroundColor: '#ddd',
  },
  progressDotActive: {
    backgroundColor: '#0D9E8A',
  },
  content: {
    flexGrow: 1,
    paddingHorizontal: 28,
    paddingTop: 8,
    paddingBottom: 32,
  },
  stepLabel: {
    fontSize: 13,
    color: '#999',
    marginBottom: 8,
  },
  question: {
    fontSize: 24,
    fontWeight: '700',
    color: '#1a1a1a',
    marginBottom: 24,
  },
  input: {
    borderWidth: 1.5,
    borderColor: '#E0E0E0',
    borderRadius: 12,
    padding: 16,
    fontSize: 16,
    color: '#1a1a1a',
    marginBottom: 16,
  },
  option: {
    borderWidth: 1.5,
    borderColor: '#E0E0E0',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
  },
  optionSelected: {
    borderColor: '#0D9E8A',
    backgroundColor: '#F0FAF8',
  },
  optionLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1a1a1a',
  },
  optionLabelSelected: { color: '#0D9E8A' },
  optionDesc: {
    fontSize: 13,
    color: '#999',
    marginTop: 2,
  },
  optionDescSelected: { color: '#0D9E8A' },
  footer: {
    paddingHorizontal: 28,
    paddingBottom: 32,
    paddingTop: 12,
  },
  nextBtn: {
    backgroundColor: '#0D9E8A',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
  },
  nextBtnDisabled: {
    backgroundColor: '#B0DDD8',
  },
  nextText: {
    fontSize: 16,
    color: '#fff',
    fontWeight: '700',
  },
});
