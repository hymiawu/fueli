import React, { useState, useCallback, useEffect, useMemo } from 'react';
import {
  View, Text, FlatList, TouchableOpacity,
  StyleSheet, ActivityIndicator, ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Alert } from '../lib/alert';
import { useFocusEffect } from '@react-navigation/native';
import { getUserItem, setUserItem } from '../lib/userStorage';
import { supabase } from '../lib/supabase';
import { caloriesPerServing, formatNutrient, toNum } from '../lib/nutrition';
import { expiryLabel } from '../lib/expiry';
import { CATEGORIES, parseAllergens } from '../lib/constants';
import { SORTS, ADDED, DEFAULT_VIEW, applyFridgeView, filterCount } from '../lib/fridgeView';

const EXPIRY_COLORS = { expired: '#D32F2F', soon: '#FF9800', later: '#888' };

const CATEGORY_COLORS = {
  Produce: '#4CAF50', Protein: '#F44336', Dairy: '#2196F3',
  Grains: '#FF9800', Beverages: '#9C27B0', Condiments: '#795548', Other: '#607D8B',
};

export default function FridgeScreen({ navigation }) {
  const [ingredients, setIngredients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState(DEFAULT_VIEW);
  const [filterOpen, setFilterOpen] = useState(false);
  const [allergies, setAllergies] = useState([]);

  // The last sort and filter are remembered per account, so the demo opens as rehearsed (6.1.2).
  useEffect(() => {
    getUserItem('fridgeView')
      .then((raw) => { if (raw) setView({ ...DEFAULT_VIEW, ...JSON.parse(raw) }); })
      .catch(() => {});
  }, []);
  const updateView = (patch) => {
    const next = { ...view, ...patch };
    setView(next);
    setUserItem('fridgeView', JSON.stringify(next)).catch(() => {});
  };
  const toggleCategory = (c) => updateView({
    categories: view.categories.includes(c) ? view.categories.filter((x) => x !== c) : [...view.categories, c],
  });

  const visible = useMemo(() => applyFridgeView(ingredients, view), [ingredients, view]);
  const activeFilters = filterCount(view);

  // Reload every time this tab comes into focus
  useFocusEffect(
    useCallback(() => {
      loadIngredients();
    }, [])
  );

  const syncToCache = async (data) => {
    try { await setUserItem('ingredients', JSON.stringify(data)); } catch (e) {}
  };

  const loadIngredients = async () => {
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      setAllergies(parseAllergens(user.user_metadata?.allergies));
      const { data, error } = await supabase
        .from('ingredients')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });
      if (!error && data) {
        setIngredients(data);
        await syncToCache(data);
      }
    } catch (e) {}
    setLoading(false);
  };

  // Returns true once the row is saved. The list is reloaded from Supabase after the insert, instead of
  // prepending to a list that a focus reload may have replaced meanwhile (bug 9.2).
  const handleSave = async (item) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return false;
      const { error } = await supabase.from('ingredients').insert([{ ...item, user_id: user.id }]);
      if (error) throw error;
      await loadIngredients();
      return true;
    } catch (e) {
      Alert.alert('Error', 'Could not save ingredient.');
      return false;
    }
  };

  const handleDelete = (id) => {
    Alert.alert('Remove Item', 'Remove this ingredient from your fridge?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Remove', style: 'destructive',
        onPress: async () => {
          await supabase.from('ingredients').delete().eq('id', id);
          const newList = ingredients.filter(i => i.id !== id);
          setIngredients(newList);
          await syncToCache(newList);
        },
      },
    ]);
  };

  // Stored values are per 100 g and unrounded; round only here (handoff 6.1.1).
  const shown = (key, v) => formatNutrient(key, toNum(v));

  const renderItem = ({ item }) => {
    const perServing = caloriesPerServing(item);
    // Warning chip when the label's allergens overlap the profile's (6.1.3).
    const clash = parseAllergens(item.allergens).filter((a) => allergies.includes(a));
    return (
    <View style={styles.card}>
      <View style={[styles.categoryDot, { backgroundColor: CATEGORY_COLORS[item.category] || '#607D8B' }]} />
      <View style={styles.cardContent}>
        <Text style={styles.itemName}>{item.name}</Text>
        {clash.length ? <Text style={styles.allergyChip}>Contains {clash.join(', ').toLowerCase()}</Text> : null}
        <Text style={styles.itemSub}>
          {item.quantity} {item.unit} · {item.category}
          {item.calories ? `  ·  ${shown('calories', item.calories)} kcal/100g` : ''}
          {item.calories && perServing !== null ? ` · ${perServing} kcal per serving` : ''}
        </Text>
        {(item.protein || item.carbs || item.fat) ? (
          <View style={styles.macroRow}>
            {item.protein ? <Text style={styles.macro}>P: {shown('protein', item.protein)}g</Text> : null}
            {item.carbs ? <Text style={styles.macro}>C: {shown('carbs', item.carbs)}g</Text> : null}
            {item.fat ? <Text style={styles.macro}>F: {shown('fat', item.fat)}g</Text> : null}
          </View>
        ) : null}
        {(() => {
          const exp = expiryLabel(item.expiry);
          if (exp) return <Text style={[styles.expiry, { color: EXPIRY_COLORS[exp.tone] }]}>{exp.text}</Text>;
          // Older rows may hold free text that isn't a date; show it as written.
          return item.expiry ? <Text style={[styles.expiry, { color: '#888' }]}>Expires: {item.expiry}</Text> : null;
        })()}
      </View>
      <TouchableOpacity style={styles.deleteBtn} onPress={() => handleDelete(item.id)}>
        <Text style={styles.deleteText}>✕</Text>
      </TouchableOpacity>
    </View>
    );
  };

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.header}>
        <Text style={styles.title}>My Fridge</Text>
        <View style={styles.headerBtns}>
          <TouchableOpacity
            style={styles.scanBtn}
            onPress={() => navigation.navigate('ScanIngredient', { onSave: handleSave })}
          >
            <Text style={styles.scanBtnText}>📷 Scan</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.addBtn}
            onPress={() => navigation.navigate('AddIngredient', { onSave: handleSave })}
          >
            <Text style={styles.addBtnText}>+ Add</Text>
          </TouchableOpacity>
        </View>
      </View>

      {ingredients.length > 0 && (
        <View style={styles.controls}>
          <View style={styles.controlRow}>
            <ScrollView horizontal style={{ flex: 1 }} showsHorizontalScrollIndicator={false} contentContainerStyle={styles.sortRow}>
              {SORTS.map((s) => (
                <TouchableOpacity
                  key={s.key}
                  style={[styles.chip, view.sort === s.key && styles.chipSelected]}
                  onPress={() => updateView({ sort: s.key })}
                  accessibilityRole="radio"
                  accessibilityLabel={s.a11y}
                  accessibilityState={{ selected: view.sort === s.key }}
                >
                  <Text style={[styles.chipText, view.sort === s.key && styles.chipTextSelected]}>{s.label}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
            <TouchableOpacity
              style={[styles.chip, styles.filterBtn, (filterOpen || activeFilters > 0) && styles.chipSelected]}
              onPress={() => setFilterOpen(!filterOpen)}
              accessibilityState={{ expanded: filterOpen }}
            >
              <Text style={[styles.chipText, (filterOpen || activeFilters > 0) && styles.chipTextSelected]}>
                {activeFilters > 0 ? `Filter ${activeFilters}` : 'Filter'}
              </Text>
            </TouchableOpacity>
          </View>
          {filterOpen && (
            <View style={styles.filterPanel}>
              <Text style={styles.filterLabel}>Category</Text>
              <View style={styles.chipWrap}>
                {CATEGORIES.map((c) => (
                  <TouchableOpacity
                    key={c}
                    style={[styles.chip, view.categories.includes(c) && styles.chipSelected]}
                    onPress={() => toggleCategory(c)}
                    accessibilityRole="checkbox"
                    accessibilityState={{ checked: view.categories.includes(c) }}
                  >
                    <Text style={[styles.chipText, view.categories.includes(c) && styles.chipTextSelected]}>{c}</Text>
                  </TouchableOpacity>
                ))}
              </View>
              <Text style={styles.filterLabel}>Added</Text>
              <View style={styles.chipWrap}>
                {ADDED.map((a) => (
                  <TouchableOpacity
                    key={a.key}
                    style={[styles.chip, view.added === a.key && styles.chipSelected]}
                    onPress={() => updateView({ added: a.key })}
                    accessibilityRole="radio"
                    accessibilityState={{ selected: view.added === a.key }}
                  >
                    <Text style={[styles.chipText, view.added === a.key && styles.chipTextSelected]}>{a.label}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          )}
          {activeFilters > 0 && (
            <View style={styles.countRow}>
              <Text style={styles.countText}>{visible.length} of {ingredients.length} items</Text>
              <TouchableOpacity onPress={() => updateView({ categories: [], added: 'any' })}>
                <Text style={styles.clearText}>Clear</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>
      )}

      {loading ? (
        <ActivityIndicator style={{ marginTop: 60 }} color="#0D9E8A" />
      ) : ingredients.length === 0 ? (
        <View style={styles.empty}>
          <Text style={styles.emptyIcon}>🧊</Text>
          <Text style={styles.emptyTitle}>Your fridge is empty</Text>
          <Text style={styles.emptySubtitle}>
            Tap Scan to add ingredients with AI,{'\n'}or Add to enter manually.
          </Text>
        </View>
      ) : (
        <FlatList
          data={visible}
          ListEmptyComponent={<Text style={styles.noMatch}>No items match these filters.</Text>}
          keyExtractor={item => item.id}
          renderItem={renderItem}
          contentContainerStyle={styles.list}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#fff' },
  header: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: 20, paddingTop: 16, paddingBottom: 12,
    borderBottomWidth: 1, borderBottomColor: '#F0F0F0',
  },
  title: { fontSize: 26, fontWeight: '800', color: '#1a1a1a' },
  headerBtns: { flexDirection: 'row', gap: 8 },
  scanBtn: {
    backgroundColor: '#F0FAF8', borderRadius: 10, paddingHorizontal: 14,
    paddingVertical: 8, borderWidth: 1.5, borderColor: '#0D9E8A',
  },
  scanBtnText: { fontSize: 14, color: '#0D9E8A', fontWeight: '700' },
  addBtn: { backgroundColor: '#0D9E8A', borderRadius: 10, paddingHorizontal: 14, paddingVertical: 8 },
  addBtnText: { fontSize: 14, color: '#fff', fontWeight: '700' },
  list: { padding: 16 },
  controls: { paddingHorizontal: 16, paddingTop: 10 },
  controlRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  sortRow: { gap: 6, paddingRight: 4 },
  chip: {
    borderWidth: 1.5, borderColor: '#E0E0E0', borderRadius: 16,
    paddingHorizontal: 10, paddingVertical: 5,
  },
  chipSelected: { borderColor: '#0D9E8A', backgroundColor: '#F0FAF8' },
  chipText: { fontSize: 13, color: '#555', fontWeight: '500' },
  chipTextSelected: { color: '#0D9E8A', fontWeight: '700' },
  filterBtn: { marginLeft: 'auto' },
  filterPanel: { marginTop: 10, padding: 12, backgroundColor: '#FAFAFA', borderRadius: 12, borderWidth: 1, borderColor: '#F0F0F0' },
  filterLabel: { fontSize: 12, fontWeight: '700', color: '#666', marginBottom: 6 },
  chipWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 10 },
  allergyChip: {
    alignSelf: 'flex-start', fontSize: 12, fontWeight: '700', color: '#E65100',
    backgroundColor: '#FFF3E0', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 6, marginBottom: 4,
  },
  noMatch: { textAlign: 'center', color: '#aaa', marginTop: 40, fontSize: 14 },
  countRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 8 },
  countText: { fontSize: 13, color: '#888' },
  clearText: { fontSize: 13, color: '#0D9E8A', fontWeight: '700' },
  card: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: '#FAFAFA',
    borderRadius: 14, padding: 14, marginBottom: 10, borderWidth: 1, borderColor: '#F0F0F0',
  },
  categoryDot: { width: 10, height: 10, borderRadius: 5, marginRight: 12, marginTop: 4, alignSelf: 'flex-start' },
  cardContent: { flex: 1 },
  itemName: { fontSize: 16, fontWeight: '700', color: '#1a1a1a', marginBottom: 3 },
  itemSub: { fontSize: 13, color: '#888' },
  macroRow: { flexDirection: 'row', gap: 10, marginTop: 5 },
  macro: {
    fontSize: 12, color: '#0D9E8A', fontWeight: '600',
    backgroundColor: '#F0FAF8', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 6,
  },
  expiry: { fontSize: 12, color: '#FF9800', marginTop: 4 },
  deleteBtn: { padding: 8 },
  deleteText: { fontSize: 16, color: '#ccc' },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 40 },
  emptyIcon: { fontSize: 56, marginBottom: 16 },
  emptyTitle: { fontSize: 20, fontWeight: '700', color: '#1a1a1a', marginBottom: 8 },
  emptySubtitle: { fontSize: 15, color: '#aaa', textAlign: 'center', lineHeight: 22 },
});
