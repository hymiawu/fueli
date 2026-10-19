import React, { useState, useEffect } from 'react';
import {
  View, Text, TextInput, TouchableOpacity,
  StyleSheet, ScrollView, ActivityIndicator, } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Alert } from '../lib/alert';
import { supabase } from '../lib/supabase';
import { toMetric, toImperial } from '../lib/units';
import { ALLERGENS, parseAllergens } from '../lib/constants';

const ACTIVITY_OPTIONS = ['Sedentary', 'Lightly Active', 'Moderately Active', 'Very Active'];
const GOAL_OPTIONS = ['Lose Fat', 'Build Muscle', 'Maintain Weight', 'Eat Healthier'];
const DIET_OPTIONS = ['No Restriction', 'Vegetarian', 'Vegan', 'Low Carb', 'High Protein'];

export default function EditProfileScreen({ navigation }) {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [email, setEmail] = useState('');
  const [height, setHeight] = useState('');
  const [weight, setWeight] = useState('');
  const [units, setUnits] = useState('metric');
  const [feet, setFeet] = useState('');
  const [inches, setInches] = useState('');
  const [pounds, setPounds] = useState('');
  const [activity, setActivity] = useState('');
  const [goal, setGoal] = useState('');
  const [diet, setDiet] = useState('');
  const [allergies, setAllergies] = useState([]);
  const toggleAllergy = (a) => setAllergies(allergies.includes(a) ? allergies.filter((x) => x !== a) : [...allergies, a]);
  const [shortTermGoal, setShortTermGoal] = useState('');
  const [longTermGoal, setLongTermGoal] = useState('');

  useEffect(() => { loadProfile(); }, []);

  const loadProfile = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      setEmail(user.email || '');
      const meta = user.user_metadata || {};
      setHeight(meta.height || '');
      setWeight(meta.weight || '');
      if (meta.units === 'imperial') {
        const imp = toImperial(meta.height, meta.weight);
        setUnits('imperial');
        setFeet(imp.feet);
        setInches(imp.inches);
        setPounds(imp.pounds);
      }
      setActivity(meta.activity || '');
      setGoal(meta.goal || '');
      setDiet(meta.diet || '');
      setAllergies(parseAllergens(meta.allergies));
      setShortTermGoal(meta.shortTermGoal || '');
      setLongTermGoal(meta.longTermGoal || '');
    }
    setLoading(false);
  };

  // Switching systems carries the current numbers across, so nothing has to be retyped.
  const switchUnits = (next) => {
    if (next === units) return;
    if (next === 'imperial') {
      const imp = toImperial(height, weight);
      setFeet(imp.feet);
      setInches(imp.inches);
      setPounds(imp.pounds);
    } else {
      const m = toMetric({ units: 'imperial', feet, inches, pounds });
      if (!m.error) {
        setHeight(m.height);
        setWeight(m.weight);
      }
    }
    setUnits(next);
  };

  const handleSave = async () => {
    const m = toMetric({ units, heightCm: height, weightKg: weight, feet, inches, pounds });
    if (m.error) {
      Alert.alert('Check your stats', m.error);
      return;
    }
    setHeight(m.height);
    setWeight(m.weight);
    setSaving(true);
    const { error } = await supabase.auth.updateUser({
      data: { height: m.height, weight: m.weight, units, activity, goal, diet, allergies, shortTermGoal, longTermGoal },
    });
    setSaving(false);
    if (error) Alert.alert('Error', error.message);
    else Alert.alert('Saved ✅', 'Your profile has been updated!');
  };

  if (loading) return (
    <SafeAreaView style={styles.safe}>
      <ActivityIndicator style={{ flex: 1 }} color="#0D9E8A" />
    </SafeAreaView>
  );

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Text style={styles.backText}>‹ Settings</Text>
        </TouchableOpacity>
        <Text style={styles.title}>Edit My Profile</Text>
        <Text style={styles.email}>{email}</Text>

        {/* Stats */}
        <Text style={styles.sectionTitle}>📏 My Stats</Text>
        <View style={styles.chipGroup}>
          {[['metric', 'Metric'], ['imperial', 'Imperial']].map(([key, label]) => (
            <TouchableOpacity
              key={key}
              style={[styles.chip, units === key && styles.chipSelected]}
              onPress={() => switchUnits(key)}
              accessibilityRole="radio"
              accessibilityState={{ selected: units === key }}
            >
              <Text style={[styles.chipText, units === key && styles.chipTextSelected]}>{label}</Text>
            </TouchableOpacity>
          ))}
        </View>
        {units === 'metric' ? (
          <View style={styles.row}>
            <View style={styles.halfField}>
              <Text style={styles.label}>Height (cm)</Text>
              <TextInput style={styles.input} value={height} onChangeText={setHeight} keyboardType="numeric" placeholder="e.g. 165" placeholderTextColor="#aaa" />
            </View>
            <View style={styles.halfField}>
              <Text style={styles.label}>Weight (kg)</Text>
              <TextInput style={styles.input} value={weight} onChangeText={setWeight} keyboardType="numeric" placeholder="e.g. 60" placeholderTextColor="#aaa" />
            </View>
          </View>
        ) : (
          <View style={styles.row}>
            <View style={styles.halfField}>
              <Text style={styles.label}>Height (ft / in)</Text>
              <View style={styles.row}>
                <TextInput style={[styles.input, styles.halfField]} value={feet} onChangeText={setFeet} keyboardType="numeric" placeholder="5" placeholderTextColor="#aaa" />
                <TextInput style={[styles.input, styles.halfField]} value={inches} onChangeText={setInches} keyboardType="numeric" placeholder="6" placeholderTextColor="#aaa" />
              </View>
            </View>
            <View style={styles.halfField}>
              <Text style={styles.label}>Weight (lb)</Text>
              <TextInput style={styles.input} value={pounds} onChangeText={setPounds} keyboardType="numeric" placeholder="e.g. 130" placeholderTextColor="#aaa" />
            </View>
          </View>
        )}

        {/* Activity */}
        <Text style={styles.sectionTitle}>🏃 Activity Level</Text>
        <View style={styles.chipGroup}>
          {ACTIVITY_OPTIONS.map(opt => (
            <TouchableOpacity key={opt} style={[styles.chip, activity === opt && styles.chipSelected]} onPress={() => setActivity(opt)}>
              <Text style={[styles.chipText, activity === opt && styles.chipTextSelected]}>{opt}</Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Fitness goal */}
        <Text style={styles.sectionTitle}>🎯 Fitness Goal</Text>
        <View style={styles.chipGroup}>
          {GOAL_OPTIONS.map(opt => (
            <TouchableOpacity key={opt} style={[styles.chip, goal === opt && styles.chipSelected]} onPress={() => setGoal(opt)}>
              <Text style={[styles.chipText, goal === opt && styles.chipTextSelected]}>{opt}</Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Diet */}
        <Text style={styles.sectionTitle}>🥗 Diet Preference</Text>
        <View style={styles.chipGroup}>
          {DIET_OPTIONS.map(opt => (
            <TouchableOpacity key={opt} style={[styles.chip, diet === opt && styles.chipSelected]} onPress={() => setDiet(opt)}>
              <Text style={[styles.chipText, diet === opt && styles.chipTextSelected]}>{opt}</Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Allergies (6.1.3): enforced by the meal planner and the Safety Guard */}
        <Text style={styles.sectionTitle}>⚠️ Allergies</Text>
        <View style={styles.chipGroup}>
          <TouchableOpacity
            style={[styles.chip, allergies.length === 0 && styles.chipSelected]}
            onPress={() => setAllergies([])}
            accessibilityRole="checkbox"
            accessibilityState={{ checked: allergies.length === 0 }}
          >
            <Text style={[styles.chipText, allergies.length === 0 && styles.chipTextSelected]}>None</Text>
          </TouchableOpacity>
          {ALLERGENS.map((a) => (
            <TouchableOpacity
              key={a}
              style={[styles.chip, allergies.includes(a) && styles.chipSelected]}
              onPress={() => toggleAllergy(a)}
              accessibilityRole="checkbox"
              accessibilityState={{ checked: allergies.includes(a) }}
            >
              <Text style={[styles.chipText, allergies.includes(a) && styles.chipTextSelected]}>{a}</Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Short-term goal */}
        <Text style={styles.sectionTitle}>⚡ Short-Term Goal</Text>
        <Text style={styles.goalHint}>e.g. "Lose 3kg in 8 weeks" · "Run 5km non-stop by next month"</Text>
        <TextInput
          style={[styles.input, styles.goalInput]}
          value={shortTermGoal}
          onChangeText={setShortTermGoal}
          placeholder="Describe your short-term goal..."
          placeholderTextColor="#aaa"
          multiline
        />

        {/* Long-term goal */}
        <Text style={styles.sectionTitle}>🏆 Long-Term Goal</Text>
        <Text style={styles.goalHint}>e.g. "Reach 15% body fat" · "Build visible muscle definition by summer"</Text>
        <TextInput
          style={[styles.input, styles.goalInput]}
          value={longTermGoal}
          onChangeText={setLongTermGoal}
          placeholder="Describe your long-term goal..."
          placeholderTextColor="#aaa"
          multiline
        />

        {/* Save */}
        <TouchableOpacity style={[styles.saveBtn, saving && { opacity: 0.7 }]} onPress={handleSave} disabled={saving}>
          {saving ? <ActivityIndicator color="#fff" /> : <Text style={styles.saveBtnText}>Save Changes</Text>}
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#fff' },
  container: { paddingHorizontal: 24, paddingTop: 12, paddingBottom: 48 },
  title: { fontSize: 28, fontWeight: '800', color: '#1a1a1a', marginBottom: 4 },
  email: { fontSize: 14, color: '#888', marginBottom: 28 },
  sectionTitle: { fontSize: 16, fontWeight: '700', color: '#1a1a1a', marginBottom: 6, marginTop: 8 },
  goalHint: { fontSize: 12, color: '#aaa', marginBottom: 10, fontStyle: 'italic' },
  row: { flexDirection: 'row', gap: 12, marginBottom: 8 },
  halfField: { flex: 1 },
  label: { fontSize: 13, color: '#666', marginBottom: 6 },
  input: { borderWidth: 1.5, borderColor: '#E0E0E0', borderRadius: 10, padding: 12, fontSize: 15, color: '#1a1a1a' },
  goalInput: { minHeight: 72, textAlignVertical: 'top', marginBottom: 8 },
  chipGroup: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 16 },
  chip: { borderWidth: 1.5, borderColor: '#E0E0E0', borderRadius: 20, paddingHorizontal: 16, paddingVertical: 8 },
  chipSelected: { borderColor: '#0D9E8A', backgroundColor: '#F0FAF8' },
  chipText: { fontSize: 14, color: '#555', fontWeight: '500' },
  chipTextSelected: { color: '#0D9E8A', fontWeight: '700' },
  saveBtn: { backgroundColor: '#0D9E8A', borderRadius: 12, padding: 16, alignItems: 'center', marginTop: 24, marginBottom: 12 },
  saveBtnText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  backBtn: { alignSelf: 'flex-start', paddingVertical: 4, marginBottom: 8 },
  backText: { fontSize: 16, color: '#0D9E8A', fontWeight: '600' },
});
