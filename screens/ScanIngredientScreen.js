import React, { useState } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet,
  Image, ActivityIndicator, TextInput, ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Alert } from '../lib/alert';
import * as ImagePicker from 'expo-image-picker';
import { analyzeIngredientImage, assetBase64 } from '../lib/api';
import { handleSubscriptionLapse } from '../lib/route';
import { CATEGORIES, UNITS, ALLERGENS, parseAllergens } from '../lib/constants';
import { NUTRIENTS, VIEWS, toView, fromView, viewFactor } from '../lib/nutrition';
import { EXPIRY_CHIPS, addDays, isValidExpiry } from '../lib/expiry';

// A saved fridge row -> the form's state, for edit mode (handoff 6.1.4).
const fromRow = (row) => ({
  name: row.name || '',
  quantity: String(row.quantity ?? ''),
  unit: row.unit || 'piece',
  category: row.category || 'Other',
  expiry: row.expiry || '',
  allergens: parseAllergens(row.allergens),
  base: Object.fromEntries(NUTRIENTS.map((k) => [k, row[k] ?? ''])),
  servingSize: row.serving_size || '',
  servingsPerContainer: row.servings_per_container || '',
});

export default function ScanIngredientScreen({ navigation, route }) {
  // With route.params.item the same form edits a saved row: photo area hidden, "Save changes" (D-37).
  const editing = route.params?.item || null;
  const [image, setImage] = useState(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [result, setResult] = useState(() => (editing ? fromRow(editing) : null));
  // Nutrition: `result.base` holds per-100 g values, unrounded. `fields` are the strings shown for `view`.
  const initialView = editing && viewFactor('serving', editing.serving_size) !== null ? 'serving' : 'per100';
  const [view, setView] = useState(initialView);
  const [fields, setFields] = useState(() =>
    (editing ? toView(fromRow(editing).base, initialView, editing.serving_size, editing.servings_per_container) : {}));

  const showView = (next, r = result) => {
    setView(next);
    setFields(toView(r.base, next, r.servingSize, r.servingsPerContainer));
  };

  // Typing in any view writes back to the per-100 g base, so the other views follow (D-14).
  const editNutrient = (key, value) => {
    setFields({ ...fields, [key]: value });
    const base = fromView(value, view, result.servingSize, result.servingsPerContainer);
    setResult({ ...result, base: { ...result.base, [key]: value.trim() === '' ? '' : base === null ? result.base[key] : String(base) } });
  };

  // Serving size or count changed: the base stays, the shown numbers follow. A view that can no longer
  // be computed falls back to per 100 g.
  const editServing = (key, value) => {
    const next = { ...result, [key]: value };
    setResult(next);
    const v = viewFactor(view, next.servingSize, next.servingsPerContainer) === null ? 'per100' : view;
    showView(v, next);
  };

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
      const next = {
        name: data.name || '',
        quantity: String(data.quantity || '1'),
        unit: data.unit || 'piece',
        category: data.category || 'Other',
        expiry: '',
        allergens: parseAllergens(data.allergens),
        base: Object.fromEntries(NUTRIENTS.map((k) => [k, data[k] === undefined || data[k] === null ? '' : String(data[k])])),
        servingSize: data.servingSize ? String(data.servingSize) : '',
        servingsPerContainer: data.servingsPerContainer ? String(data.servingsPerContainer) : (data.servingSize ? '1' : ''),
      };
      setResult(next);
      // D-34: open on "Per serving" when the label gave a serving size.
      showView(next.servingSize ? 'serving' : 'per100', next);
    } catch (e) {
      // The API's message says what went wrong (subscription, image too large, rate limit, ...).
      if (!handleSubscriptionLapse(e, navigation)) Alert.alert('Analysis failed', e.message || 'Could not identify the ingredient. Please try again.');
    }
    setAnalyzing(false);
  };

  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    if (saving) return;
    if (!result?.name) {
      Alert.alert('Missing name', 'Please enter an ingredient name.');
      return;
    }
    if (!isValidExpiry(result.expiry)) {
      Alert.alert('Check the expiry date', 'Use the format YYYY-MM-DD, for example 2026-10-24, or leave it empty.');
      return;
    }
    const newIngredient = {
      id: editing ? editing.id : Date.now().toString(),
      name: result.name,
      quantity: result.quantity,
      unit: result.unit,
      category: result.category,
      expiry: result.expiry.trim(),
      // Stored per 100 g, unrounded, so a per-serving value the user typed comes back exactly.
      calories: result.base.calories,
      protein: result.base.protein,
      carbs: result.base.carbs,
      fat: result.base.fat,
      serving_size: result.servingSize.trim() || null,
      servings_per_container: result.servingsPerContainer.trim() || null,
      allergens: result.allergens.length ? result.allergens.join(', ') : null,
    };
    // Wait for the write, so the fridge list already has the item when we go back (bug 9.2).
    setSaving(true);
    const ok = editing
      ? await route.params?.onUpdate?.(newIngredient)
      : await route.params?.onSave?.(newIngredient);
    setSaving(false);
    if (ok !== false) navigation.goBack();
  };

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Text style={styles.back}>← Back</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{editing ? 'Edit Ingredient' : 'Scan Ingredient'}</Text>
        <View style={{ width: 60 }} />
      </View>

      <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
        {/* Image preview and camera buttons (not in edit mode) */}
        {editing ? null : image ? (
          <Image source={{ uri: image }} style={styles.preview} />
        ) : (
          <View style={styles.placeholder}>
            <Text style={styles.placeholderIcon}>📷</Text>
            <Text style={styles.placeholderText}>Take or upload a photo of an ingredient</Text>
          </View>
        )}

        {!editing && (
        <View style={styles.btnRow}>
          <TouchableOpacity style={styles.photoBtn} onPress={() => pickImage(true)}>
            <Text style={styles.photoBtnText}>📷  Camera</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.photoBtn} onPress={() => pickImage(false)}>
            <Text style={styles.photoBtnText}>🖼️  Library</Text>
          </TouchableOpacity>
        </View>
        )}

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
            {!editing && <Text style={styles.sectionTitle}>✅ Ingredient Detected</Text>}

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

            <Text style={styles.label}>Allergens on the label</Text>
            <View style={styles.chipGroup}>
              {ALLERGENS.map((a) => {
                const on = result.allergens.includes(a);
                return (
                  <TouchableOpacity
                    key={a}
                    style={[styles.chip, on && styles.chipWarn]}
                    onPress={() => setResult({ ...result, allergens: on ? result.allergens.filter((x) => x !== a) : [...result.allergens, a] })}
                    accessibilityRole="checkbox"
                    accessibilityState={{ checked: on }}
                  >
                    <Text style={[styles.chipText, on && styles.chipWarnText]}>{a}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            <Text style={styles.label}>Expiry (optional)</Text>
            <TextInput
              style={styles.input}
              value={result.expiry}
              onChangeText={(v) => setResult({ ...result, expiry: v })}
              placeholder="YYYY-MM-DD"
              placeholderTextColor="#aaa"
              autoCapitalize="none"
            />
            <View style={[styles.chipGroup, { marginTop: -6 }]}>
              {EXPIRY_CHIPS.map(({ label, days }) => (
                <TouchableOpacity key={label} style={styles.chip} onPress={() => setResult({ ...result, expiry: addDays(days) })}>
                  <Text style={styles.chipText}>{label}</Text>
                </TouchableOpacity>
              ))}
            </View>

            <Text style={styles.sectionTitle}>Nutrition Facts</Text>
            <View style={styles.chipGroup}>
              {VIEWS.map(({ key, label }) => {
                const disabled = viewFactor(key, result.servingSize, result.servingsPerContainer) === null;
                return (
                  <TouchableOpacity
                    key={key}
                    style={[styles.chip, view === key && styles.chipSelected, disabled && styles.chipDisabled]}
                    onPress={() => showView(key)}
                    disabled={disabled}
                    accessibilityState={{ selected: view === key, disabled }}
                  >
                    <Text style={[styles.chipText, view === key && styles.chipTextSelected]}>{label}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>
            <View style={styles.row}>
              <View style={{ flex: 1 }}>
                <Text style={styles.label}>Serving size (g or ml)</Text>
                <TextInput
                  style={styles.input}
                  value={result.servingSize}
                  onChangeText={(v) => editServing('servingSize', v)}
                  keyboardType="numeric"
                  placeholder="e.g. 30"
                  placeholderTextColor="#aaa"
                />
              </View>
              <View style={{ flex: 1, marginLeft: 12 }}>
                <Text style={styles.label}>Servings per package</Text>
                <TextInput
                  style={styles.input}
                  value={result.servingsPerContainer}
                  onChangeText={(v) => editServing('servingsPerContainer', v)}
                  keyboardType="numeric"
                  placeholder="e.g. 1"
                  placeholderTextColor="#aaa"
                />
              </View>
            </View>
            {!result.servingSize.trim() ? <Text style={styles.hint}>Enter a serving size</Text> : null}
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
                    value={fields[key] ?? ''}
                    onChangeText={(v) => editNutrient(key, v)}
                    keyboardType="numeric"
                  />
                </View>
              ))}
            </View>

            <TouchableOpacity style={[styles.saveBtn, saving && { opacity: 0.7 }]} onPress={handleSave} disabled={saving}>
              {saving ? <ActivityIndicator color="#fff" /> : <Text style={styles.saveBtnText}>{editing ? 'Save changes' : 'Add to Fridge'}</Text>}
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
  chipDisabled: { opacity: 0.4 },
  chipWarn: { borderColor: '#E65100', backgroundColor: '#FFF3E0' },
  chipWarnText: { color: '#E65100', fontWeight: '700' },
  hint: { fontSize: 12, color: '#999', marginTop: -6, marginBottom: 12 },
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
