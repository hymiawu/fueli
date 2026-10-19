import React, { useState, useEffect, useRef } from 'react';
import {
  View, Text, TouchableOpacity, ScrollView, Modal,
  StyleSheet, ActivityIndicator, TextInput,
  Image, KeyboardAvoidingView, Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Alert } from '../lib/alert';
import { useNavigation } from '@react-navigation/native';
import { getUserItem, setUserItem } from '../lib/userStorage';
import * as ImagePicker from 'expo-image-picker';
import { supabase } from '../lib/supabase';
import { getMealSuggestions, analyzeOutsideFood, assetBase64 } from '../lib/api';
import { handleSubscriptionLapse } from '../lib/route';
import { planCooked, deductionRecord, summaryText } from '../lib/cooking';

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

// Meal modes (handoff 6.2.2, D-40). Keys match the API; strings are Sara's.
const MODES = [
  { key: 'hungry', title: 'Feeling hungry', helper: 'From my fridge to the table in 20 minutes.' },
  { key: 'healthy', title: 'Feeling healthy', helper: 'Build a plate around my fitness goals.' },
  { key: 'cleanOut', title: 'Clean out my fridge', helper: 'Save my food before it expires.' },
];
const MODE_TITLES = Object.fromEntries(MODES.map(m => [m.key, m.title]));
const plural = (n, word) => `${n} ${word}${n === 1 ? '' : 's'}`;

const parseIngredientStr = (str) => {
  const m1 = str.match(/^(.+?)\s*\((\d+(?:\.\d+)?)\s*(g|ml|kg|l|piece|pieces|cup|cups|tbsp|tsp)\s*\)$/i);
  if (m1) return { name: m1[1].trim(), quantity: parseFloat(m1[2]), unit: m1[3].replace(/s$/, '') };
  const m2 = str.match(/^(\d+(?:\.\d+)?)\s*(g|ml|kg|l|pieces?|cups?|tbsps?|tsps?)\s+(.+)$/i);
  if (m2) return { name: m2[3].trim(), quantity: parseFloat(m2[1]), unit: m2[2].replace(/s$/, '') };
  const m3 = str.match(/^(\d+(?:\.\d+)?)\s+(g|ml|kg|l)\s+(.+)$/i);
  if (m3) return { name: m3[3].trim(), quantity: parseFloat(m3[1]), unit: m3[2] };
  return null;
};

const getIngredientList = (meal) => {
  if (meal.structuredIngredients && meal.structuredIngredients.length > 0) {
    return meal.structuredIngredients.filter(i => i.quantity > 0);
  }
  return (meal.ingredients || []).map(parseIngredientStr).filter(Boolean);
};

const loadFridgeRows = async () => {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Please sign in again.');
  const { data, error } = await supabase.from('ingredients').select('*').eq('user_id', user.id);
  if (error) throw error;
  return data || [];
};

const refreshFridgeCache = async () => {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const { data } = await supabase.from('ingredients').select('*').eq('user_id', user.id).order('created_at', { ascending: false });
    if (data) await setUserItem('ingredients', JSON.stringify(data));
  } catch (e) {}
};

// Runs writes in order. The browser's Supabase client has no transactions, so on the first failed write the
// writes already made are undone in reverse and the error is rethrown (D-42).
const runWrites = async (writes) => {
  const done = [];
  try {
    for (const w of writes) {
      const { error } = await w.run();
      if (error) throw error;
      done.push(w);
    }
  } catch (e) {
    for (const w of done.reverse()) { try { await w.revert(); } catch (_) {} }
    throw e;
  }
};

// Cooked: subtract the recipe from the fridge, only within a unit family; a row that reaches zero is deleted.
const cookMeal = async (meal) => {
  const { ops, summary } = planCooked(getIngredientList(meal), await loadFridgeRows());
  await runWrites(ops.map(op => op.type === 'delete'
    ? { run: () => supabase.from('ingredients').delete().eq('id', op.row.id), revert: () => supabase.from('ingredients').insert(op.row) }
    : { run: () => supabase.from('ingredients').update({ quantity: String(op.quantity) }).eq('id', op.row.id),
        revert: () => supabase.from('ingredients').update({ quantity: op.row.quantity }).eq('id', op.row.id) }));
  return { records: ops.map(deductionRecord), summary };
};

// Undo Cooked: put back exactly what was taken. A deleted row comes back with its original id, created_at and
// every column (serving size, allergens, ...), so it keeps its place under Newest and the date filters.
const uncookMeal = async (records) => {
  const rows = await loadFridgeRows();
  await runWrites(records.map(d => {
    const current = rows.find(r => r.id === d.fridgeId);
    if (d.wasDeleted || !current) {
      const row = { ...d.originalItem, quantity: String(d.wasDeleted ? d.originalQty : d.used) };
      return { run: () => supabase.from('ingredients').insert(row), revert: () => supabase.from('ingredients').delete().eq('id', row.id) };
    }
    const restored = Math.round((parseFloat(current.quantity) + d.used) * 10) / 10;
    return { run: () => supabase.from('ingredients').update({ quantity: String(restored) }).eq('id', d.fridgeId),
             revert: () => supabase.from('ingredients').update({ quantity: current.quantity }).eq('id', d.fridgeId) };
  }));
};

export default function MealScreen() {
  const navigation = useNavigation();
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
  // selectedMode drives the next request only; each meal keeps the mode it was generated with (6.2.2).
  const [selectedMode, setSelectedMode] = useState('hungry');
  const busyMeal = useRef(null); // ignores a second tap while Cooked or undo is running
  const days = buildDays();

  useEffect(() => { loadMealPlans(); }, []);

  const loadMealPlans = async () => {
    try { const s = await getUserItem('mealPlans'); if (s) setMealPlans(JSON.parse(s)); } catch(e) {}
    try { const n = Number(await getUserItem('mealServings')); if (n >= 1 && n <= SERVING_OPTIONS.length) setServings(n); } catch(e) {}
    try { const m = await getUserItem('mealMode'); if (MODE_TITLES[m]) setSelectedMode(m); } catch(e) {}
  };
  const chooseMode = async (m) => {
    setSelectedMode(m);
    try { await setUserItem('mealMode', m); } catch(e) {}
  };
  const chooseServings = async (n) => {
    setServings(n);
    try { await setUserItem('mealServings', String(n)); } catch(e) {}
  };
  const saveMealPlans = async (plans) => {
    setMealPlans(plans);
    try { await setUserItem('mealPlans', JSON.stringify(plans)); } catch(e) {}
  };

  const getSuggestions = async (mode = selectedMode) => {
    if (loading) return;
    const current = mealPlans[selectedDate] || [];
    const cookedMeals = current.filter(m => m.cooked);
    const cookedTypes = cookedMeals.map(m => m.type);
    const neededTypes = ALL_MEAL_TYPES.filter(t => !cookedTypes.includes(t));
    if (neededTypes.length === 0) { Alert.alert('All done! 🎉','You cooked all meals today.'); return; }
    setLoading(true); setExpandedMeal(null);
    try {
      const res = await getMealSuggestions(neededTypes, servings, mode);
      const { meals: suggestions, blocked } = res;
      if (blocked?.length) Alert.alert('Some meals were held back', blocked.map(b => `• ${b.type}: ${b.reason}`).join('\n'));
      const generatedMode = res.mode || mode;
      const newMeals = suggestions.map(s => ({ ...s, generatedMode, modeNote: res.modeNote || null, id:`${Date.now()}-${Math.random()}`, cooked:false, planned:false, deductedIngredients:[] }));
      const combined = ALL_MEAL_TYPES.map(type => {
        const cooked = cookedMeals.find(m => m.type === type);
        return cooked || newMeals.find(m => m.type === type);
      }).filter(Boolean);
      await saveMealPlans({ ...mealPlans, [selectedDate]: combined });
    } catch(e) {
      if (handleSubscriptionLapse(e, navigation)) { /* sent back to the paywall */ }
      // The daily cap says when it resets; retrying now would not help.
      else if (e.status === 429) Alert.alert('Try again later', e.message);
      else Alert.alert('Could not refresh', 'We could not refresh your meals. Your current plan is still available.', [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Try again', onPress: () => getSuggestions(mode) },
      ]);
    }
    setLoading(false);
  };

  const toggleCooked = async (mealId) => {
    if (busyMeal.current) return;
    const dayMeals = mealPlans[selectedDate] || [];
    const meal = dayMeals.find(m => m.id === mealId);
    if (!meal) return;

    if (meal.type === 'Outside') {
      // Outside food — just toggle
      const updated = dayMeals.map(m => m.id === mealId ? { ...m, cooked: !m.cooked } : m);
      await saveMealPlans({ ...mealPlans, [selectedDate]: updated });
      return;
    }

    busyMeal.current = mealId;
    try {
      if (!meal.cooked) {
        // The meal is marked Cooked only after every fridge write succeeded.
        const { records, summary } = await cookMeal(meal);
        const updated = dayMeals.map(m => m.id === mealId ? { ...m, cooked: true, deductedIngredients: records } : m);
        await saveMealPlans({ ...mealPlans, [selectedDate]: updated });
        Alert.alert('🧊 Fridge Updated', summaryText(summary));
      } else {
        const records = meal.deductedIngredients || [];
        await uncookMeal(records);
        const updated = dayMeals.map(m => m.id === mealId ? { ...m, cooked: false, deductedIngredients: [] } : m);
        await saveMealPlans({ ...mealPlans, [selectedDate]: updated });
        if (records.length > 0) Alert.alert('🧊 Fridge Restored', records.map(d => `• ${d.name}: +${d.used} ${d.unit}`.trimEnd()).join('\n'));
      }
    } catch (e) {
      Alert.alert('Error', `Could not ${meal.cooked ? 'restore' : 'update'} the fridge, so nothing was changed. ${e.message || ''}`.trim());
    } finally {
      await refreshFridgeCache();
      busyMeal.current = null;
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
    catch(e) { if (!handleSubscriptionLapse(e, navigation)) Alert.alert('Error', e.message || 'Could not analyze food.'); }
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
  const canPlan = ALL_MEAL_TYPES.some(t => !homeMeals.some(m => m.type === t && m.cooked));

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
        {canPlan && (
          <View style={styles.modeSection} accessibilityRole="radiogroup">
            <Text style={styles.modeHeading}>Choose how to plan</Text>
            {MODES.map(m => {
              const selected = selectedMode === m.key;
              return (
                <TouchableOpacity key={m.key}
                  style={[styles.modeCard, selected && styles.modeCardSelected, loading && styles.modeCardDisabled]}
                  onPress={() => chooseMode(m.key)} disabled={loading}
                  accessibilityRole="radio" accessibilityState={{ selected, disabled: loading }}
                  accessibilityLabel={`${m.title}. ${m.helper}`}>
                  <View style={[styles.radio, selected && styles.radioSelected]}>{selected && <View style={styles.radioDot} />}</View>
                  <View style={{ flex:1 }}>
                    <Text style={[styles.modeTitle, selected && styles.modeTitleSelected]}>{m.title}</Text>
                    <Text style={styles.modeHelper}>{m.helper}</Text>
                  </View>
                </TouchableOpacity>
              );
            })}
            <TouchableOpacity style={[styles.suggestBtn, { alignSelf:'center', marginTop:6 }, loading && {opacity:0.7}]} onPress={() => getSuggestions()} disabled={loading}>
              <Text style={styles.suggestBtnText}>
                {loading ? 'Planning your meals…' : selectedMeals.length === 0 ? '✨  Get AI Suggestions' : '↻  Refresh My Meals'}
              </Text>
            </TouchableOpacity>
          </View>
        )}
        {selectedMeals.length === 0 ? (
          <View style={styles.empty}>
            <Text style={styles.emptyIcon}>🍽️</Text>
            <Text style={styles.emptyTitle}>No meals planned</Text>
            <Text style={styles.emptySubtitle}>Get AI suggestions based on your fridge ingredients and fitness goal.</Text>
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
  // Meals saved before the API stopped sending this note still carry it; don't show it.
  const visibleWarnings = (meal.warnings || []).filter(w => !w.startsWith('Not in nutrition database'));
  const toBuy = meal.modeEvidence?.toBuy ?? ((meal.missingIngredients?.length || 0) + (meal.shortIngredients?.length || 0));
  const soonUsed = meal.modeEvidence?.soonUsed || [];
  // The mode line comes from the checker's evidence on the response, never from another model call (6.2.2).
  const modeLine = !meal.generatedMode || isOutside ? null
    : meal.generatedMode === 'hungry' ? `Feeling hungry · ${meal.prepTime || '—'} · ${toBuy === 0 ? 'All ingredients in fridge' : `${plural(toBuy, 'item')} to buy`}`
    : meal.generatedMode === 'healthy' ? `Feeling healthy · ${meal.calories} kcal · ${meal.protein} g protein · ${plural(toBuy, 'item')} to buy`
    : `Clean out my fridge · Uses ${plural(soonUsed.length, 'soon-to-expire item')}`;
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
          <TouchableOpacity style={styles.cookedBtn} onPress={onToggleCooked}
            accessibilityRole="checkbox" accessibilityState={{ checked: !!meal.cooked }}>
            <View style={[styles.checkBox, meal.cooked && styles.checkBoxDone]}>
              {meal.cooked && <Text style={styles.checkMark}>✓</Text>}
            </View>
            {!isOutside && <Text style={[styles.cookedLabel, meal.cooked && styles.cookedLabelDone]}>Cooked</Text>}
          </TouchableOpacity>
        </View>
      </View>
      {modeLine && <Text style={styles.modeLine}>{modeLine}</Text>}
      {meal.generatedMode === 'hungry' && toBuy > 0 && toBuy <= 2 && (
        <Text style={styles.modeNote}>No complete meal under 20 minutes was available. This option needs {toBuy} additional ingredient{toBuy === 1 ? '' : 's'}.</Text>
      )}
      {meal.generatedMode === 'cleanOut' && meal.modeNote && <Text style={styles.modeNote}>{meal.modeNote}</Text>}
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
      {visibleWarnings.length > 0 && (
        <View style={styles.warnBox}>
          {visibleWarnings.map((w, i) => <Text key={i} style={styles.warnText}>⚠️ {w}</Text>)}
        </View>
      )}
      {(meal.missingIngredients?.length > 0 || meal.shortIngredients?.length > 0) && (
        <View style={styles.shoppingBox}>
          <Text style={styles.shoppingTitle}>🛒 Need to buy:</Text>
          {(meal.missingIngredients || []).map((item, i) => <Text key={i} style={styles.shoppingItem}>• {item}</Text>)}
          {(meal.shortIngredients || []).map((item, i) => <Text key={`s${i}`} style={styles.shoppingItem}>• More {item}</Text>)}
        </View>
      )}
      {meal.planned && !meal.missingIngredients?.length && !meal.shortIngredients?.length && (
        <View style={[styles.shoppingBox, { backgroundColor:'#F0FAF8', borderColor:'#0D9E8A30' }]}>
          <Text style={[styles.shoppingTitle, { color:'#0D9E8A' }]}>✅ All ingredients in your fridge!</Text>
        </View>
      )}
      {expanded && !isOutside && (
        <View style={styles.recipeBox}>
          {meal.generatedMode === 'cleanOut' && soonUsed.length > 0 && (
            <Text style={styles.soonUsed}>Soon-to-expire items used: {soonUsed.join(', ')}</Text>
          )}
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
  cookedBtn: { flexDirection:'row', alignItems:'center', gap:6, minHeight:44, paddingLeft:4 },
  cookedLabel: { fontSize:12, color:'#999', fontWeight:'600' },
  cookedLabelDone: { color:'#4CAF50' },
  modeSection: { marginBottom:16 },
  modeHeading: { fontSize:15, fontWeight:'700', color:'#1a1a1a', marginBottom:8 },
  modeCard: { flexDirection:'row', alignItems:'center', gap:12, minHeight:44, borderWidth:1.5, borderColor:'#E0E0E0', backgroundColor:'#fff', borderRadius:14, paddingHorizontal:14, paddingVertical:10, marginBottom:8 },
  modeCardSelected: { borderColor:'#0D9E8A', backgroundColor:'#F0FAF8' },
  modeCardDisabled: { opacity:0.6 },
  radio: { width:20, height:20, borderRadius:10, borderWidth:2, borderColor:'#BBB', alignItems:'center', justifyContent:'center' },
  radioSelected: { borderColor:'#0D9E8A' },
  radioDot: { width:10, height:10, borderRadius:5, backgroundColor:'#0D9E8A' },
  modeTitle: { fontSize:15, fontWeight:'700', color:'#1a1a1a' },
  modeTitleSelected: { color:'#0D9E8A' },
  modeHelper: { fontSize:13, color:'#777', marginTop:2 },
  modeLine: { fontSize:12, fontWeight:'700', color:'#0D9E8A', marginBottom:6 },
  modeNote: { fontSize:12, color:'#8A6D00', backgroundColor:'#FFFBEA', borderRadius:8, padding:8, marginBottom:8 },
  soonUsed: { fontSize:13, color:'#0D9E8A', fontWeight:'600', marginBottom:10 },
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
