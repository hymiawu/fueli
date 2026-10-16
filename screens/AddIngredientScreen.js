import { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity,
  StyleSheet, ScrollView,
  KeyboardAvoidingView, Platform
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Alert } from '../lib/alert';
import { CATEGORIES, UNITS } from '../lib/constants';

export default function AddIngredientScreen({ navigation, route }) {
  const [name, setName]         = useState('');
  const [quantity, setQuantity] = useState('');
  const [unit, setUnit]         = useState('piece');
  const [category, setCategory] = useState(null);
  const [expiry, setExpiry]     = useState('');

  function handleSave() {
    if (!name.trim()) {
      Alert.alert('Missing info', 'Please enter an ingredient name.');
      return;
    }
    const newIngredient = {
      id:       Date.now().toString(),
      name:     name.trim(),
      quantity,
      unit,
      category,
      expiry,
    };
    route.params?.onSave?.(newIngredient);
    navigation.goBack();
  }

  return (
    <SafeAreaView style={styles.safe}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()}>
            <Text style={styles.cancel}>Cancel</Text>
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Add Ingredient</Text>
          <TouchableOpacity onPress={handleSave}>
            <Text style={styles.save}>Save</Text>
          </TouchableOpacity>
        </View>

        <ScrollView style={styles.form} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled" automaticallyAdjustKeyboardInsets={true}>
          <Text style={styles.label}>Name *</Text>
          <TextInput
            style={styles.input}
            placeholder="e.g. Chicken breast"
            placeholderTextColor="#bbb"
            value={name}
            onChangeText={setName}
          />

          <Text style={styles.label}>Quantity</Text>
          <TextInput
            style={styles.input}
            placeholder="e.g. 2"
            placeholderTextColor="#bbb"
            value={quantity}
            onChangeText={setQuantity}
            keyboardType="numeric"
          />

          <Text style={styles.label}>Unit</Text>
          <View style={styles.chipRow}>
            {UNITS.map(u => (
              <TouchableOpacity
                key={u}
                style={[styles.chip, unit === u && styles.chipSelected]}
                onPress={() => setUnit(u)}
              >
                <Text style={[styles.chipText, unit === u && styles.chipTextSelected]}>{u}</Text>
              </TouchableOpacity>
            ))}
          </View>

          <Text style={styles.label}>Category</Text>
          <View style={styles.chipRow}>
            {CATEGORIES.map(cat => (
              <TouchableOpacity
                key={cat}
                style={[styles.chip, category === cat && styles.chipSelected]}
                onPress={() => setCategory(cat)}
              >
                <Text style={[styles.chipText, category === cat && styles.chipTextSelected]}>{cat}</Text>
              </TouchableOpacity>
            ))}
          </View>

          <Text style={styles.label}>Expiry Date</Text>
          <TextInput
            style={styles.input}
            placeholder="e.g. 2026-06-01"
            placeholderTextColor="#bbb"
            value={expiry}
            onChangeText={setExpiry}
          />

          <View style={{ height: 40 }} />
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe:             { flex: 1, backgroundColor: '#fff' },
  header:           { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 24, paddingVertical: 16, borderBottomWidth: 1, borderBottomColor: '#F0F0F0' },
  headerTitle:      { fontSize: 16, fontWeight: '700', color: '#1A1A2E' },
  cancel:           { fontSize: 16, color: '#999' },
  save:             { fontSize: 16, color: '#0F9B8A', fontWeight: '700' },
  form:             { flex: 1, paddingHorizontal: 24, paddingTop: 24 },
  label:            { fontSize: 13, fontWeight: '600', color: '#888', marginBottom: 8, marginTop: 20 },
  input:            { backgroundColor: '#F7F7F7', borderRadius: 12, paddingHorizontal: 16, paddingVertical: 14, fontSize: 16, color: '#1A1A2E' },
  chipRow:          { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  chip:             { paddingHorizontal: 16, paddingVertical: 10, borderRadius: 20, borderWidth: 1.5, borderColor: '#E0E0E0' },
  chipSelected:     { backgroundColor: '#0F9B8A', borderColor: '#0F9B8A' },
  chipText:         { fontSize: 13, color: '#555', fontWeight: '500' },
  chipTextSelected: { color: '#fff', fontWeight: '600' },
});
