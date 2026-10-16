import React, { useState } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet,
  Image, ActivityIndicator, TextInput, ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Alert } from '../lib/alert';
import * as ImagePicker from 'expo-image-picker';
import { analyzeIngredientImage, assetBase64 } from '../lib/api';

const UNITS = ['g', 'ml', 'piece', 'cup', 'tbsp'];
const CATEGORIES = ['Produce', 'Protein', 'Dairy', 'Grains', 'Beverages', 'Condiments', 'Other'];

export default function ScanIngredientScreen({ navigation, route }) {
  const [image, setImage] = useState(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [result, setResult] = useState(null);

  const pickImage = async (useCamera) => {
    const permFn = useCamera
      ? ImagePicker.requestCameraPermissionsAsync
      : ImagePicker.requestMediaLibraryPermissionsAsync;
    const { status } = await permFn();
    if (status !== 'granted') {
      Alert.alert('Permission Required', 'Please allow access to continue.');
      return;
    }

    const launchFn = useCamera
      ? ImagePicker.launchCameraAsync
      : ImagePicker.launchImageLibraryAsync;

    const pickerResult = await launchFn({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      base64: true,
      quality: 0.7,
    });

    if (!pickerResult.canceled && pickerResult.assets[0]) {
      const asset = pickerResult.assets[0];
      setImage(asset.uri);
      setResult(null);
      analyzeImage(assetBase64(asset));
    }
  };

  const analyzeImage = async (base64) => {
    setAnalyzing(true);
    try {
      const data = await analyzeIngredientImage(base64);
      if (data.isFood === false) {
        Alert.alert('Not food?', "We couldn't see a food item. Try another photo, or add it manually.");
        setAnalyzing(false);
        return;
      }
      setResult({
        name: data.name || '',
        quantity: String(data.quantity || '1'),
        unit: data.unit || 'piece',
        category: data.category || 'Other',
        calories: String(data.calories || ''),
        protein: String(data.protein || ''),
        carbs: String(data.carbs || ''),
        fat: String(data.fat || ''),
      });
    } catch (e) {
      // The API's message says what went wrong (subscription, image too large, rate limit, ...).
      Alert.alert('Analysis failed', e.message || 'Could not identify the ingredient. Please try again.');
    }
    setAnalyzing(false);
  };

  const handleSave = () => {
    if (!result?.name) {
      Alert.alert('Missing name', 'Please enter an ingredient name.');
      return;
    }
    const newIngredient = {
      id: Date.now().toString(),
      name: result.name,
      quantity: result.quantity,
      unit: result.unit,
      category: result.category,
      expiry: '',
      calories: result.calories,
      protein: result.protein,
      carbs: result.carbs,
      fat: result.fat,
    };
    route.params?.onSave?.(newIngredient);
    navigation.goBack();
  };

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Text style={styles.back}>← Back</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Scan Ingredient</Text>
        <View style={{ width: 60 }} />
      </View>

      <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
        {/* Image preview */}
        {image ? (
          <Image source={{ uri: image }} style={styles.preview} />
        ) : (
          <View style={styles.placeholder}>
            <Text style={styles.placeholderIcon}>📷</Text>
            <Text style={styles.placeholderText}>Take or upload a photo of an ingredient</Text>
          </View>
        )}

        {/* Camera buttons */}
        <View style={styles.btnRow}>
          <TouchableOpacity style={styles.photoBtn} onPress={() => pickImage(true)}>
            <Text style={styles.photoBtnText}>📷  Camera</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.photoBtn} onPress={() => pickImage(false)}>
            <Text style={styles.photoBtnText}>🖼️  Library</Text>
          </TouchableOpacity>
        </View>

        {/* Analyzing indicator */}
        {analyzing && (
          <View style={styles.analyzingBox}>
            <ActivityIndicator color="#0D9E8A" />
            <Text style={styles.analyzingText}>Analyzing with AI...</Text>
          </View>
        )}

        {/* Results */}
        {result && !analyzing && (
          <View style={styles.resultBox}>
            <Text style={styles.sectionTitle}>✅ Ingredient Detected</Text>

            <Text style={styles.label}>Name</Text>
            <TextInput
              style={styles.input}
              value={result.name}
              onChangeText={(v) => setResult({ ...result, name: v })}
            />

            <View style={styles.row}>
              <View style={{ flex: 1 }}>
                <Text style={styles.label}>Quantity</Text>
                <TextInput
                  style={styles.input}
                  value={result.quantity}
                  onChangeText={(v) => setResult({ ...result, quantity: v })}
                  keyboardType="numeric"
                />
              </View>
              <View style={{ flex: 1, marginLeft: 12 }}>
                <Text style={styles.label}>Unit</Text>
                <View style={styles.chipGroup}>
                  {UNITS.map((u) => (
                    <TouchableOpacity
                      key={u}
                      style={[styles.chip, result.unit === u && styles.chipSelected]}
                      onPress={() => setResult({ ...result, unit: u })}
                    >
                      <Text style={[styles.chipText, result.unit === u && styles.chipTextSelected]}>
                        {u}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
            </View>

            <Text style={styles.label}>Category</Text>
            <View style={styles.chipGroup}>
              {CATEGORIES.map((c) => (
                <TouchableOpacity
                  key={c}
                  style={[styles.chip, result.category === c && styles.chipSelected]}
                  onPress={() => setResult({ ...result, category: c })}
                >
                  <Text style={[styles.chipText, result.category === c && styles.chipTextSelected]}>
                    {c}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <Text style={styles.sectionTitle}>Nutrition Facts (per 100g)</Text>
            <View style={styles.nutritionGrid}>
              {[
                { key: 'calories', label: 'Calories (kcal)' },
                { key: 'protein', label: 'Protein (g)' },
                { key: 'carbs', label: 'Carbs (g)' },
                { key: 'fat', label: 'Fat (g)' },
              ].map(({ key, label }) => (
                <View key={key} style={styles.nutritionItem}>
                  <Text style={styles.label}>{label}</Text>
                  <TextInput
                    style={styles.input}
                    value={result[key]}
                    onChangeText={(v) => setResult({ ...result, [key]: v })}
                    keyboardType="numeric"
                  />
                </View>
              ))}
            </View>

            <TouchableOpacity style={styles.saveBtn} onPress={handleSave}>
              <Text style={styles.saveBtnText}>Add to Fridge</Text>
            </TouchableOpacity>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#fff' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  back: { fontSize: 16, color: '#0D9E8A', fontWeight: '600' },
  headerTitle: { fontSize: 17, fontWeight: '700', color: '#1a1a1a' },
  container: { padding: 20, paddingBottom: 48 },
  preview: {
    width: '100%', height: 220,
    borderRadius: 16, marginBottom: 16,
    backgroundColor: '#f5f5f5',
  },
  placeholder: {
    width: '100%', height: 200,
    borderRadius: 16, backgroundColor: '#F5F5F5',
    alignItems: 'center', justifyContent: 'center',
    marginBottom: 16, borderWidth: 2,
    borderColor: '#E0E0E0', borderStyle: 'dashed',
  },
  placeholderIcon: { fontSize: 40, marginBottom: 8 },
  placeholderText: { fontSize: 14, color: '#aaa', textAlign: 'center' },
  btnRow: { flexDirection: 'row', gap: 12, marginBottom: 20 },
  photoBtn: {
    flex: 1, backgroundColor: '#F0FAF8',
    borderRadius: 12, padding: 14,
    alignItems: 'center', borderWidth: 1.5,
    borderColor: '#0D9E8A',
  },
  photoBtnText: { fontSize: 15, color: '#0D9E8A', fontWeight: '600' },
  analyzingBox: {
    flexDirection: 'row', alignItems: 'center',
    justifyContent: 'center', gap: 12,
    padding: 20, backgroundColor: '#F0FAF8',
    borderRadius: 12, marginBottom: 16,
  },
  analyzingText: { fontSize: 15, color: '#0D9E8A', fontWeight: '600' },
  resultBox: { marginTop: 4 },
  sectionTitle: {
    fontSize: 17, fontWeight: '700',
    color: '#1a1a1a', marginBottom: 14, marginTop: 8,
  },
  label: { fontSize: 13, color: '#666', marginBottom: 6, fontWeight: '500' },
  input: {
    borderWidth: 1.5, borderColor: '#E0E0E0',
    borderRadius: 10, padding: 12,
    fontSize: 15, color: '#1a1a1a', marginBottom: 14,
  },
  row: { flexDirection: 'row', marginBottom: 4 },
  chipGroup: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 16 },
  chip: {
    borderWidth: 1.5, borderColor: '#E0E0E0',
    borderRadius: 20, paddingHorizontal: 12, paddingVertical: 6,
  },
  chipSelected: { borderColor: '#0D9E8A', backgroundColor: '#F0FAF8' },
  chipText: { fontSize: 13, color: '#555', fontWeight: '500' },
  chipTextSelected: { color: '#0D9E8A', fontWeight: '700' },
  nutritionGrid: {
    flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginBottom: 8,
  },
  nutritionItem: { width: '47%' },
  saveBtn: {
    backgroundColor: '#0D9E8A', borderRadius: 12,
    padding: 16, alignItems: 'center', marginTop: 8,
  },
  saveBtnText: { color: '#fff', fontSize: 16, fontWeight: '700' },
});
