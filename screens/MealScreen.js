import React, { useState, useEffect } from 'react';
import {
  View, Text, TouchableOpacity, ScrollView, Modal,
  StyleSheet, ActivityIndicator, TextInput,
  Image, KeyboardAvoidingView, Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Alert } from '../lib/alert';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as ImagePicker from 'expo-image-picker';
import { supabase } from '../lib/supabase';
import { getMealSuggestions, analyzeOutsideFood, assetBase64 } from '../lib/api';

const DAY_NAMES = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
const MONTH_NAMES = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
const ALL_MEAL_TYPES = ['Breakfast','Lunch','Dinner'];
const MEAL_COLORS = { Breakfast:'#FF9800', Lunch:'#4CAF50', Dinner:'#2196F3', Outside:'#9C27B0' };

const toDateStr = (d) => {
  const y = d.getFullYear(), m = String(d.getMonth()+1).padStart(2,'0'), day = String(d.getDate()).padStart(2,'0');
  return `${y}-${m}-${day}`;
};
const getTodayStr = () => toDateStr(new Date());
const buildDays = () => {
  const days = [], base = new Date();
  base.setDate(base.getDate() - 3);
  for (let i = 0; i < 14; i++) { const d = new Date(base); d.setDate(base.getDate()+i); days.push(d); }
  return days;
};

const norm = (s) => s.toLowerCase().trim().replace(/ies$/, 'y').replace(/es$/, '').replace(/s$/, '');

const parseIngredientStr = (str) => {
  const m1 = str.match(/^(.+?)\s*\((\d+(?:\.\d+)?)\s*(g|ml|kg|l|piece|pieces|cup|cups|tbsp|tsp)\s*\)$/i);
  if (m1) return { name: m1[1].trim(), quantity: parseFloat(m1[2]), unit: m1[3].replace(/s$/, '') };
  const m2 = str.match(/^(\d+(?:\.\d+)?)\s*(g|ml|kg|l|pieces?|cups?|tbsps?|tsps?)\s+(.+)$/i);
  if (m2) return { name: m2[3].trim(), quantity: parseFloat(m2[1]), unit: m2[2].replace(/s$/, '') };
  const m3 = str.match(/^(\d+(?:\.\d+)?)\s+(g|ml|kg|l)\s+(.+)$/i);
  if (m3) return { name: m3[3].trim(), quantity: parseFloat(m3[1]), unit: m3[2] };
  return null;
};

const findFridgeMatch = (fridgeItems, ingName) => {
  const normIng = norm(ingName);
  const words = normIng.split(/\s+/).filter(w => w.length > 2);
  return fridgeItems.find(item => {
    const normF = norm(item.name);
    if (normF === normIng) return true;
    if (normF.includes(normIng) || normIng.includes(normF)) return true;
    return words.some(w => normF.includes(w) || norm(item.name).includes(w));
  });
};

const getIngredientList = (meal) => {
  if (meal.structuredIngredients && meal.structuredIngredients.length > 0) {
    return meal.structuredIngredients.filter(i => i.quantity > 0);
  }
  return (meal.ingredients || []).map(parseIngredientStr).filter(Boolean);
};

const deductFridgeIngredients = async (meal) => {
  const ingList = getIngredientList(meal);
  if (ingList.length === 0) return [];

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return [];

  const { data: fridgeItems, error } = await supabase
    .from('ingredients').select('*').eq('user_id', user.id);
  if (error || !fridgeItems) return [];

  const deducted = [];
  const toDelete = [];
  const toUpdate = [];

  for (const ing of ingList) {
    const match = findFridgeMatch(fridgeItems, ing.name);
    if (!match) continue;

    const fridgeQty = parseFloat(match.quantity) || 0;
    const ingQty = parseFloat(ing.quantity) || 0;
    if (ingQty <= 0 || fridgeQty <= 0) continue;

    const newQty = Math.round((fridgeQty - ingQty) * 10) / 10;
    deducted.push({
      fridgeId: match.id,
      fridgeName: match.name,
      name: match.name,
      used: ingQty,
      unit: ing.unit || match.unit || '',
      remaining: Math.max(0, newQty),
      wasDeleted: newQty <= 0,
      originalQty: fridgeQty,
      originalItem: { ...match },
    });

    if (newQty <= 0) {
      toDelete.push(match.id);
    } else {
      toUpdate.push({ id: match.id, quantity: String(newQty) });
    }
  }

  for (const id of toDelete) {
    await supabase.from('ingredients').delete().eq('id', id);
  }
  for (const item of toUpdate) {
    await supabase.from('ingredients').update({ quantity: item.quantity }).eq('id', item.id);
  }

  const { data: refreshed } = await supabase
    .from('ingredients').select('*').eq('user_id', user.id).order('created_at', { ascending: false });
  if (refreshed) await AsyncStorage.setItem('ingredients', JSON.stringify(refreshed));

  return deducted;
};

// Restore ingredients when unchecking a cooked meal
const restoreFridgeIngredients = async (deductedIngredients) => {
  if (!deductedIngredients || deductedIngredients.length === 0) return;

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return;

  const { data: fridgeItems } = await supabase
    .from('ingredients').select('*').eq('user_id', user.id);
  if (!fridgeItems) return;

  for (const d of deductedIngredients) {
    if (d.wasDeleted) {
      // Item was fully consumed — re-insert it with original quantity
      const orig = d.originalItem;
      await supabase.from('ingredients').insert({
        id: `restored-${Date.now()}-${Math.random().toString(36).slice(2)}`,
        user_id: user.id,
        name: orig.name,
        quantity: String(d.originalQty),
        unit: orig.unit || d.unit || '',
        category: orig.category || 'Other',
        expiry: orig.expiry || null,
        calories: orig.calories || null,
        protein: orig.protein || null,
        carbs: orig.carbs || null,
        fat: orig.fat || null,
      });
    } else {
      // Item still exists — add back the used amount
      const current = fridgeItems.find(f => f.id === d.fridgeId);
      if (current) {
        const restoredQty = Math.round((parseFloat(current.quantity) + d.used) * 10) / 10;
        await supabase.from('ingredients').update({ quantity: String(restoredQty) }).eq('id', d.fridgeId);
      }
    }
  }

  const { data: refreshed } = await supabase
    .from('ingredients').select('*').eq('user_id', user.id).order('created_at', { ascending: false });
  if (refreshed) await AsyncStorage.setItem('ingredients', JSON.stringify(refreshed));
};

export default function MealScreen() {
  const todayStr = getTodayStr();
  const [selectedDate, setSelectedDate] = useState(todayStr);
  const [mealPlans, setMealPlans] = useState({});
  const [loading, setLoading] = useState(false);
  const [servings, setServings] = useState(1);
  const [expandedMeal, setExpandedMeal] = useState(null);
  const [showOutsideModal, setShowOutsideModal] = useState(false);
  const [outsideText, setOutsideText] = useState('');
  const [outsideImage, setOutsideImage] = useState(null);
  const [outsideImageBase64, setOutsideImageBase64] = useState(null);
  const [outsideLoading, setOutsideLoading] = useState(false);
  const [outsideResult, setOutsideResult] = useState(null);
  const days = buildDays();

  useEffect(() => { loadMealPlans(); }, []);

  const loadMealPlans = async () => {
    try { const s = await AsyncStorage.getItem('mealPlans'); if (s) setMealPlans(JSON.parse(s)); } catch(e) {}
    try { const n = Number(await AsyncStorage.getItem('mealServings')); if (n >= 1 && n <= SERVING_OPTIONS.length) setServings(n); } catch(e) {}
  };
  const chooseServings = async (n) => {
    setServings(n);
    try { await AsyncStorage.setItem('mealServings', String(n)); } catch(e) {}
  };
  const saveMealPlans = async (plans) => {
    setMealPlans(plans);
    try { await AsyncStorage.setItem('mealPlans', JSON.stringify(plans)); } catch(e) {}
  };

  const getSuggestions = async () => {
    const current = mealPlans[selectedDate] || [];
    const cookedMeals = current.filter(m => m.cooked);
    const cookedTypes = cookedMeals.map(m => m.type);
    const neededTypes = ALL_MEAL_TYPES.filter(t => !cookedTypes.includes(t));
    if (neededTypes.length === 0) { Alert.alert('All done! 🎉','You cooked all meals today.'); return; }
    setLoading(true); setExpandedMeal(null);
    try {
      const { meals: suggestions, blocked } = await getMealSuggestions(neededTypes, servings);
      if (blocked?.length) Alert.alert('Some meals were held back', blocked.map(b => `• ${b.type}: ${b.reason}`).join('\n'));
      const newMeals = suggestions.map(s => ({ ...s, id:`${Date.now()}-${Math.random()}`, cooked:false, planned:false, deductedIngredients:[] }));
      const combined = ALL_MEAL_TYPES.map(type => {
        const cooked = cookedMeals.find(m => m.type === type);
        return cooked || newMeals.find(m => m.type === type);
      }).filter(Boolean);
      await saveMealPlans({ ...mealPlans, [selectedDate]: combined });
    } catch(e) { Alert.alert('Error', e.message || 'Could not get suggestions. Please try again.'); }
    setLoading(false);
  };

  const toggleCooked = async (mealId) => {
    const dayMeals = mealPlans[selectedDate] || [];
    const meal = dayMeals.find(m => m.id === mealId);
    if (!meal) return;
    const wasCooked = meal.cooked;

    if (!wasCooked && meal.type !== 'Outside') {
      // Marking as COOKED → deduct ingredients
      try {
        const deducted = await deductFridgeIngredients(meal);
        const updated = dayMeals.map(m =>
          m.id === mealId ? { ...m, cooked: true, deductedIngredients: deducted } : m
        );
        await saveMealPlans({ ...mealPlans, [selectedDate]: updated });

        if (deducted.length > 0) {
          const summary = deducted.map(d =>
            d.remaining > 0
              ? `• ${d.name}: used ${d.used}${d.unit} → ${d.remaining}${d.unit} left`
              : `• ${d.name}: fully used up 🗑️`
          ).join('\n');
          Alert.alert('🧊 Fridge Updated', summary);
        } else {
          Alert.alert('🧊 Fridge', 'No matching fridge ingredients found to deduct.');
        }
      } catch(e) {
        Alert.alert('Error', 'Could not update fridge: ' + e.message);
      }

    } else if (wasCooked && meal.type !== 'Outside') {
      // Marking as UNCOOKED → restore ingredients
      try {
        const deducted = meal.deductedIngredients || [];
        await restoreFridgeIngredients(deducted);
        const updated = dayMeals.map(m =>
          m.id === mealId ? { ...m, cooked: false, deductedIngredients: [] } : m
        );
        await saveMealPlans({ ...mealPlans, [selectedDate]: updated });

        if (deducted.length > 0) {
          const summary = deducted.map(d => `• ${d.name}: +${d.used}${d.unit} restored`).join('\n');
          Alert.alert('🧊 Fridge Restored', summary);
        }
      } catch(e) {
        Alert.alert('Error', 'Could not restore fridge: ' + e.message);
      }

    } else {
      // Outside food — just toggle
      const updated = dayMeals.map(m => m.id === mealId ? { ...m, cooked: !m.cooked } : m);
      await saveMealPlans({ ...mealPlans, [selectedDate]: updated });
    }
  };

  const togglePlanned = async (mealId) => {
    const updated = (mealPlans[selectedDate]||[]).map(m => m.id === mealId ? { ...m, planned: !m.planned } : m);
    await saveMealPlans({ ...mealPlans, [selectedDate]: updated });
  };

  const pickOutsideImage = async (useCamera) => {
    const permFn = useCamera ? ImagePicker.requestCameraPermissionsAsync : ImagePicker.requestMediaLibraryPermissionsAsync;
    const { status } = await permFn();
    if (status !== 'granted') { Alert.alert('Permission Required'); return; }
    const result = await (useCamera ? ImagePicker.launchCameraAsync : ImagePicker.launchImageLibraryAsync)({
      mediaTypes: ImagePicker.MediaTypeOptions.Images, base64: true, quality: 0.7,
    });
    if (!result.canceled && result.assets[0]) {
      setOutsideImage(result.assets[0].uri);
      setOutsideImageBase64(assetBase64(result.assets[0]));
      setOutsideResult(null);
    }
  };

  const handleAnalyzeOutside = async () => {
    if (!outsideText && !outsideImageBase64) { Alert.alert('Please describe what you ate or take a photo.'); return; }
    setOutsideLoading(true);
    try {
      const result = await analyzeOutsideFood(outsideText, outsideImageBase64);
      if (result.isFood === false) Alert.alert('Not food?', "We couldn't recognize a food. Try a clearer description or photo.");
      else setOutsideResult(result);
    }
    catch(e) { Alert.alert('Error', e.message || 'Could not analyze food.'); }
    setOutsideLoading(false);
  };

  const handleAddOutside = async () => {
    if (!outsideResult) return;
    const entry = {
      id: `${Date.now()}-outside`, name: outsideResult.name, type: 'Outside',
      ingredients: [], structuredIngredients: [], recipe: '',
      calories: outsideResult.calories, protein: outsideResult.protein,
      carbs: outsideResult.carbs, fat: outsideResult.fat, prepTime: '—',
      missingIngredients: [], cooked: true, planned: false, deductedIngredients: [],
    };
    const current = mealPlans[selectedDate] || [];
    await saveMealPlans({ ...mealPlans, [selectedDate]: [...current, entry] });
    setShowOutsideModal(false);
    setOutsideText(''); setOutsideImage(null); setOutsideImageBase64(null); setOutsideResult(null);
  };

  const selectedMeals = mealPlans[selectedDate] || [];
  const selectedDateObj = new Date(selectedDate + 'T12:00:00');
  const isToday = selectedDate === todayStr;
  const cookedCount = selectedMeals.filter(m => m.cooked).length;
  const homeMeals = selectedMeals.filter(m => m.type !== 'Outside');
  const outsideMeals = selectedMeals.filter(m => m.type === 'Outside');

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.header}>
        <Text style={styles.title}>My Meal</Text>
        <Text style={styles.monthYear}>{MONTH_NAMES[selectedDateObj.getMonth()]} {selectedDateObj.getFullYear()}</Text>
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.calendarScroll} contentContainerStyle={styles.calendarStrip}>
        {days.map(date => {
          const dateStr = toDateStr(date);
          const isSelected = dateStr === selectedDate;
          const isTodayDate = dateStr === todayStr;
          const dayMeals = mealPlans[dateStr] || [];
          const hasCooked = dayMeals.some(m => m.cooked);
          const hasPlanned = dayMeals.length > 0;
          return (
            <TouchableOpacity key={dateStr}
              style={[styles.dayItem, isSelected && styles.dayItemSelected]}
              onPress={() => { setSelectedDate(dateStr); setExpandedMeal(null); }}>
              <Text style={[styles.dayName, isSelected && styles.dayTextSelected]}>{DAY_NAMES[date.getDay()]}</Text>
              <Text style={[styles.dayNumber, isSelected && styles.dayTextSelected, isTodayDate && !isSelected && styles.dayNumberToday]}>
                {date.getDate()}
              </Text>
              {hasPlanned
                ? <View style={[styles.dayDot, { backgroundColor: hasCooked ? '#4CAF50' : '#FF9800' }]} />
                : <View style={styles.dayDotEmpty} />}
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      <View style={styles.divider} />

      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.dateTitle}>{isToday ? "Today's Meals" : `${DAY_NAMES[selectedDateObj.getDay()]}, ${MONTH_NAMES[selectedDateObj.getMonth()]} ${selectedDateObj.getDate()}`}</Text>

        <Text style={styles.disclaimer}>AI suggestions are general guidance, not medical or dietary advice.</Text>
        <View style={styles.servingsRow}>
          <Text style={styles.servingsLabel}>👥 Cooking for</Text>
          {SERVING_OPTIONS.map(n => (
            <TouchableOpacity key={n} style={[styles.servingChip, servings === n && styles.servingChipActive]} onPress={() => chooseServings(n)}>
              <Text style={[styles.servingChipText, servings === n && styles.servingChipTextActive]}>{n}</Text>
            </TouchableOpacity>
          ))}
        </View>
        {selectedMeals.length === 0 ? (
          <View style={styles.empty}>
            <Text style={styles.emptyIcon}>🍽️</Text>
            <Text style={styles.emptyTitle}>No meals planned</Text>
            <Text style={styles.emptySubtitle}>Get AI suggestions based on your fridge ingredients and fitness goal.</Text>
            <TouchableOpacity style={[styles.suggestBtn, loading && {opacity:0.7}]} onPress={getSuggestions} disabled={loading}>
              {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.suggestBtnText}>✨  Get AI Suggestions</Text>}
            </TouchableOpacity>
          </View>
        ) : (
          <>
            {cookedCount > 0 && (
              <View style={styles.legend}>
                <View style={styles.legendItem}><View style={[styles.legendDot,{backgroundColor:'#FF9800'}]}/><Text style={styles.legendText}>Planned</Text></View>
                <View style={styles.legendItem}><View style={[styles.legendDot,{backgroundColor:'#4CAF50'}]}/><Text style={styles.legendText}>Cooked</Text></View>
                <Text style={styles.cookedCount}>{cookedCount} / {selectedMeals.length} done</Text>
              </View>
            )}
            {homeMeals.map(meal => (
              <MealCard key={meal.id} meal={meal}
                expanded={expandedMeal === meal.id}
                onToggleExpand={() => setExpandedMeal(expandedMeal === meal.id ? null : meal.id)}
                onToggleCooked={() => toggleCooked(meal.id)}
                onTogglePlanned={() => togglePlanned(meal.id)}
              />
            ))}
            {outsideMeals.length > 0 && (
              <>
                <Text style={styles.sectionLabel}>🥡 Outside Food</Text>
                {outsideMeals.map(meal => (
                  <MealCard key={meal.id} meal={meal}
                    expanded={expandedMeal === meal.id}
                    onToggleExpand={() => setExpandedMeal(expandedMeal === meal.id ? null : meal.id)}
                    onToggleCooked={() => toggleCooked(meal.id)}
                    onTogglePlanned={() => {}}
                  />
                ))}
              </>
            )}
            {homeMeals.some(m => !m.cooked) && (
              <TouchableOpacity style={[styles.refreshBtn, loading && {opacity:0.7}]} onPress={getSuggestions} disabled={loading}>
                {loading ? <ActivityIndicator color="#0D9E8A" /> :
                  <Text style={styles.refreshBtnText}>↻  Refresh My Meals</Text>}
              </TouchableOpacity>
            )}
          </>
        )}
        <TouchableOpacity style={styles.outsideBtn} onPress={() => setShowOutsideModal(true)}>
          <Text style={styles.outsideBtnText}>🥡  Log Outside Food</Text>
        </TouchableOpacity>
      </ScrollView>

      <Modal visible={showOutsideModal} animationType="slide" transparent>
        <KeyboardAvoidingView style={{flex:1}} behavior={Platform.OS==='ios'?'padding':'height'}>
          <View style={styles.modalOverlay}>
            <View style={styles.modalSheet}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>Log Outside Food</Text>
                <TouchableOpacity onPress={() => { setShowOutsideModal(false); setOutsideText(''); setOutsideImage(null); setOutsideImageBase64(null); setOutsideResult(null); }}>
                  <Text style={styles.modalClose}>✕</Text>
                </TouchableOpacity>
              </View>
              <ScrollView keyboardShouldPersistTaps="handled">
                <Text style={styles.modalLabel}>What did you eat?</Text>
                <TextInput style={styles.modalInput} placeholder="e.g. Tonkotsu ramen, beef noodle soup..." placeholderTextColor="#aaa" value={outsideText} onChangeText={setOutsideText} multiline />
                <Text style={styles.modalLabel}>Or take a photo</Text>
                <View style={styles.photoRow}>
                  <TouchableOpacity style={styles.photoBtn} onPress={() => pickOutsideImage(true)}><Text style={styles.photoBtnText}>📷  Camera</Text></TouchableOpacity>
                  <TouchableOpacity style={styles.photoBtn} onPress={() => pickOutsideImage(false)}><Text style={styles.photoBtnText}>🖼️  Library</Text></TouchableOpacity>
                </View>
                {outsideImage && <Image source={{ uri: outsideImage }} style={styles.outsidePreview} />}
                <TouchableOpacity style={[styles.analyzeBtn, outsideLoading && {opacity:0.7}]} onPress={handleAnalyzeOutside} disabled={outsideLoading}>
                  {outsideLoading ? <ActivityIndicator color="#fff" /> : <Text style={styles.analyzeBtnText}>✨  Analyze Calories</Text>}
                </TouchableOpacity>
                {outsideResult && (
                  <View style={styles.outsideResult}>
                    <Text style={styles.outsideResultName}>{outsideResult.name}</Text>
                    <Text style={styles.aiNote}>AI estimate · {outsideResult.confidence} confidence — portions vary by restaurant</Text>
                    <View style={styles.outsideResultMacros}>
                      <View style={styles.macroBox}><Text style={styles.macroVal}>{outsideResult.calories}</Text><Text style={styles.macroLbl}>kcal</Text></View>
                      <View style={styles.macroBox}><Text style={[styles.macroVal,{color:'#F44336'}]}>{outsideResult.protein}g</Text><Text style={styles.macroLbl}>Protein</Text></View>
                      <View style={styles.macroBox}><Text style={[styles.macroVal,{color:'#FF9800'}]}>{outsideResult.carbs}g</Text><Text style={styles.macroLbl}>Carbs</Text></View>
                      <View style={styles.macroBox}><Text style={[styles.macroVal,{color:'#2196F3'}]}>{outsideResult.fat}g</Text><Text style={styles.macroLbl}>Fat</Text></View>
                    </View>
                    <TouchableOpacity style={styles.addLogBtn} onPress={handleAddOutside}>
                      <Text style={styles.addLogBtnText}>Add to Today's Log</Text>
                    </TouchableOpacity>
                  </View>
                )}
              </ScrollView>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </SafeAreaView>
  );
}

function MealCard({ meal, expanded, onToggleExpand, onToggleCooked, onTogglePlanned }) {
  const color = MEAL_COLORS[meal.type] || '#607D8B';
  const isOutside = meal.type === 'Outside';
  return (
    <View style={[styles.card, meal.cooked && styles.cardCooked]}>
      <View style={styles.cardTop}>
        <View style={[styles.typeBadge, { backgroundColor:color+'22', borderColor:color }]}>
          <Text style={[styles.typeBadgeText, { color }]}>{meal.type}</Text>
        </View>
        <View style={styles.cardActions}>
          {!isOutside && (
            <TouchableOpacity style={[styles.planBtn, meal.planned && styles.planBtnActive]} onPress={onTogglePlanned}>
              <Text style={[styles.planBtnText, meal.planned && styles.planBtnTextActive]}>{meal.planned ? '🔖 Planned' : '+ Plan'}</Text>
            </TouchableOpacity>
          )}
          <TouchableOpacity style={[styles.checkBox, meal.cooked && styles.checkBoxDone]} onPress={onToggleCooked}>
            {meal.cooked && <Text style={styles.checkMark}>✓</Text>}
          </TouchableOpacity>
        </View>
      </View>
      <Text style={styles.mealName}>{meal.name}</Text>
      <Text style={styles.mealMeta}>⏱ {meal.prepTime || '—'}  ·  🔥 {meal.calories} kcal{meal.servings > 1 ? ` per person  ·  👥 Serves ${meal.servings}` : ''}</Text>
      {meal.macroSource && meal.macroSource !== 'estimated' && (
        <Text style={styles.verifiedTag}>✓ Macros checked against nutrition database{meal.macroSource === 'corrected' ? ' (corrected)' : ''}</Text>
      )}
      <View style={styles.macroRow}>
        <MacroPill label="Protein" value={meal.protein} color="#F44336" />
        <MacroPill label="Carbs" value={meal.carbs} color="#FF9800" />
        <MacroPill label="Fat" value={meal.fat} color="#2196F3" />
      </View>
      {meal.warnings?.length > 0 && (
        <View style={styles.warnBox}>
          {meal.warnings.map((w, i) => <Text key={i} style={styles.warnText}>⚠️ {w}</Text>)}
        </View>
      )}
      {meal.missingIngredients?.length > 0 && (
        <View style={styles.shoppingBox}>
          <Text style={styles.shoppingTitle}>🛒 Need to buy:</Text>
          {meal.missingIngredients.map((item, i) => <Text key={i} style={styles.shoppingItem}>• {item}</Text>)}
        </View>
      )}
      {meal.planned && (!meal.missingIngredients || meal.missingIngredients.length === 0) && (
        <View style={[styles.shoppingBox, { backgroundColor:'#F0FAF8', borderColor:'#0D9E8A30' }]}>
          <Text style={[styles.shoppingTitle, { color:'#0D9E8A' }]}>✅ All ingredients in your fridge!</Text>
        </View>
      )}
      {expanded && !isOutside && (
        <View style={styles.recipeBox}>
          <Text style={styles.recipeSection}>📋 Ingredients</Text>
          {(meal.ingredients||[]).map((ing,i) => <Text key={i} style={styles.recipeItem}>• {ing}</Text>)}
          <Text style={[styles.recipeSection,{marginTop:14}]}>👨‍🍳 Instructions</Text>
          <Text style={styles.recipeText}>{meal.recipe}</Text>
        </View>
      )}
      {!isOutside && (
        <TouchableOpacity style={styles.expandBtn} onPress={onToggleExpand}>
          <Text style={styles.expandBtnText}>{expanded ? '▲  Hide Recipe' : '▼  View Recipe'}</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

function MacroPill({ label, value, color }) {
  return (
    <View style={[styles.pill, { backgroundColor:color+'15', borderColor:color+'50' }]}>
      <Text style={[styles.pillText, { color }]}>{label}  {value}g</Text>
    </View>
  );
}

// How many people a meal plan is for; ingredient amounts scale, calories are shown per person.
const SERVING_OPTIONS = [1, 2, 3, 4, 5, 6];

// "Get AI Suggestions", "Refresh My Meals" and "Log Outside Food" share one width so they line up.
const ACTION_BTN_WIDTH = 260;

const styles = StyleSheet.create({
  servingsRow: { flexDirection:'row', alignItems:'center', flexWrap:'wrap', gap:6, marginBottom:16 },
  servingsLabel: { fontSize:14, fontWeight:'600', color:'#555', marginRight:4 },
  servingChip: { minWidth:34, borderWidth:1.5, borderColor:'#E0E0E0', borderRadius:17, paddingHorizontal:10, paddingVertical:5, alignItems:'center' },
  servingChipActive: { borderColor:'#0D9E8A', backgroundColor:'#0D9E8A' },
  servingChipText: { fontSize:14, fontWeight:'600', color:'#555' },
  servingChipTextActive: { color:'#fff' },
  safe: { flex:1, backgroundColor:'#fff' },
  header: { flexDirection:'row', justifyContent:'space-between', alignItems:'center', paddingHorizontal:20, paddingTop:16, paddingBottom:10 },
  title: { fontSize:26, fontWeight:'800', color:'#1a1a1a' },
  monthYear: { fontSize:14, color:'#888', fontWeight:'600' },
  // Without this the strip shrinks on web and the day numbers get clipped by the list below.
  calendarScroll: { flexGrow:0, flexShrink:0 },
  calendarStrip: { paddingHorizontal:12, paddingBottom:12 },
  dayItem: { width:52, alignItems:'center', paddingVertical:10, borderRadius:14, marginHorizontal:3 },
  dayItemSelected: { backgroundColor:'#0D9E8A' },
  dayName: { fontSize:11, color:'#aaa', fontWeight:'600', marginBottom:6 },
  dayNumber: { fontSize:18, fontWeight:'700', color:'#1a1a1a', marginBottom:6 },
  dayNumberToday: { color:'#0D9E8A' },
  dayTextSelected: { color:'#fff' },
  dayDot: { width:6, height:6, borderRadius:3 },
  dayDotEmpty: { width:6, height:6 },
  divider: { height:1, backgroundColor:'#F0F0F0' },
  content: { padding:20, paddingBottom:48 },
  dateTitle: { fontSize:20, fontWeight:'700', color:'#1a1a1a', marginBottom:16 },
  legend: { flexDirection:'row', gap:16, marginBottom:16, alignItems:'center' },
  legendItem: { flexDirection:'row', alignItems:'center', gap:6 },
  legendDot: { width:8, height:8, borderRadius:4 },
  legendText: { fontSize:12, color:'#888' },
  cookedCount: { fontSize:12, color:'#0D9E8A', fontWeight:'700', marginLeft:'auto' },
  sectionLabel: { fontSize:15, fontWeight:'700', color:'#1a1a1a', marginTop:8, marginBottom:12 },
  empty: { alignItems:'center', paddingTop:60 },
  emptyIcon: { fontSize:52, marginBottom:16 },
  emptyTitle: { fontSize:20, fontWeight:'700', color:'#1a1a1a', marginBottom:8 },
  emptySubtitle: { fontSize:15, color:'#aaa', textAlign:'center', lineHeight:22, marginBottom:28 },
  suggestBtn: { width:ACTION_BTN_WIDTH, backgroundColor:'#0D9E8A', borderRadius:14, paddingVertical:14, alignItems:'center' },
  suggestBtnText: { color:'#fff', fontSize:16, fontWeight:'700' },
  card: { backgroundColor:'#FAFAFA', borderRadius:16, padding:16, marginBottom:14, borderWidth:1.5, borderColor:'#F0F0F0' },
  cardCooked: { borderColor:'#4CAF5040', backgroundColor:'#F6FFF6' },
  cardTop: { flexDirection:'row', justifyContent:'space-between', alignItems:'center', marginBottom:10 },
  typeBadge: { borderWidth:1.5, borderRadius:20, paddingHorizontal:12, paddingVertical:4 },
  typeBadgeText: { fontSize:12, fontWeight:'700' },
  cardActions: { flexDirection:'row', alignItems:'center', gap:10 },
  planBtn: { borderWidth:1.5, borderColor:'#ddd', borderRadius:16, paddingHorizontal:10, paddingVertical:4 },
  planBtnActive: { borderColor:'#0D9E8A', backgroundColor:'#F0FAF8' },
  planBtnText: { fontSize:12, color:'#999', fontWeight:'600' },
  planBtnTextActive: { color:'#0D9E8A' },
  checkBox: { width:28, height:28, borderRadius:14, borderWidth:2, borderColor:'#ddd', alignItems:'center', justifyContent:'center' },
  checkBoxDone: { backgroundColor:'#4CAF50', borderColor:'#4CAF50' },
  checkMark: { color:'#fff', fontSize:14, fontWeight:'800' },
  mealName: { fontSize:18, fontWeight:'800', color:'#1a1a1a', marginBottom:4 },
  mealMeta: { fontSize:13, color:'#888', marginBottom:12 },
  macroRow: { flexDirection:'row', gap:8, marginBottom:8 },
  pill: { borderWidth:1, borderRadius:20, paddingHorizontal:10, paddingVertical:4 },
  pillText: { fontSize:12, fontWeight:'600' },
  shoppingBox: { backgroundColor:'#FFF8F0', borderWidth:1, borderColor:'#FF980030', borderRadius:10, padding:12, marginTop:8 },
  shoppingTitle: { fontSize:13, fontWeight:'700', color:'#FF9800', marginBottom:6 },
  shoppingItem: { fontSize:13, color:'#555', lineHeight:22 },
  recipeBox: { backgroundColor:'#fff', borderRadius:12, padding:14, marginTop:12, borderWidth:1, borderColor:'#E8E8E8' },
  recipeSection: { fontSize:14, fontWeight:'700', color:'#1a1a1a', marginBottom:8 },
  recipeItem: { fontSize:14, color:'#555', lineHeight:22 },
  recipeText: { fontSize:14, color:'#555', lineHeight:22 },
  expandBtn: { marginTop:12, alignItems:'center' },
  expandBtnText: { fontSize:13, color:'#0D9E8A', fontWeight:'600' },
  refreshBtn: { width:ACTION_BTN_WIDTH, alignSelf:'center', borderWidth:1.5, borderColor:'#0D9E8A', borderRadius:14, paddingVertical:14, alignItems:'center', marginTop:8, marginBottom:8 },
  refreshBtnText: { color:'#0D9E8A', fontSize:15, fontWeight:'700' },
  outsideBtn: { width:ACTION_BTN_WIDTH, alignSelf:'center', marginTop:16, borderWidth:1.5, borderColor:'#9C27B0', borderRadius:14, paddingVertical:14, alignItems:'center' },
  outsideBtnText: { color:'#9C27B0', fontSize:15, fontWeight:'700' },
  modalOverlay: { flex:1, backgroundColor:'rgba(0,0,0,0.4)', justifyContent:'flex-end' },
  modalSheet: { backgroundColor:'#fff', borderTopLeftRadius:24, borderTopRightRadius:24, padding:24, maxHeight:'85%' },
  modalHeader: { flexDirection:'row', justifyContent:'space-between', alignItems:'center', marginBottom:20 },
  modalTitle: { fontSize:20, fontWeight:'800', color:'#1a1a1a' },
  modalClose: { fontSize:20, color:'#aaa', fontWeight:'600' },
  modalLabel: { fontSize:14, fontWeight:'600', color:'#444', marginBottom:8 },
  modalInput: { borderWidth:1.5, borderColor:'#E0E0E0', borderRadius:12, padding:14, fontSize:15, color:'#1a1a1a', minHeight:80, marginBottom:16, textAlignVertical:'top' },
  photoRow: { flexDirection:'row', gap:12, marginBottom:16 },
  photoBtn: { flex:1, backgroundColor:'#F8F0FF', borderRadius:12, padding:12, alignItems:'center', borderWidth:1.5, borderColor:'#9C27B0' },
  photoBtnText: { fontSize:14, color:'#9C27B0', fontWeight:'600' },
  outsidePreview: { width:'100%', height:180, borderRadius:14, marginBottom:16, backgroundColor:'#f5f5f5' },
  analyzeBtn: { backgroundColor:'#9C27B0', borderRadius:12, padding:14, alignItems:'center', marginBottom:16 },
  analyzeBtnText: { color:'#fff', fontSize:15, fontWeight:'700' },
  outsideResult: { backgroundColor:'#F8F0FF', borderRadius:14, padding:16, marginBottom:8 },
  outsideResultName: { fontSize:17, fontWeight:'800', color:'#1a1a1a', marginBottom:12 },
  outsideResultMacros: { flexDirection:'row', justifyContent:'space-around', marginBottom:16 },
  macroBox: { alignItems:'center' },
  macroVal: { fontSize:20, fontWeight:'800', color:'#1a1a1a' },
  macroLbl: { fontSize:11, color:'#888', marginTop:2 },
  addLogBtn: { backgroundColor:'#9C27B0', borderRadius:12, padding:14, alignItems:'center' },
  addLogBtnText: { color:'#fff', fontSize:15, fontWeight:'700' },
  aiNote: { fontSize:12, color:'#888', marginTop:-8, marginBottom:12 },
  verifiedTag: { fontSize:12, color:'#0D9E8A', fontWeight:'600', marginTop:-6, marginBottom:10 },
  warnBox: { backgroundColor:'#FFFBEA', borderRadius:10, padding:10, marginTop:4, marginBottom:4 },
  warnText: { fontSize:12, color:'#8A6D00', lineHeight:18 },
  disclaimer: { fontSize:12, color:'#aaa', marginTop:-8, marginBottom:14 },
});
