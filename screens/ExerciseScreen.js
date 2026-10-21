import React, { useState, useEffect } from 'react';
import {
  View, Text, TouchableOpacity, ScrollView, Image, TextInput,
  StyleSheet, ActivityIndicator, } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Alert } from '../lib/alert';
import { useNavigation } from '@react-navigation/native';
import { handleSubscriptionLapse } from '../lib/route';
import { getUserItem, setUserItem } from '../lib/userStorage';
import { getWorkoutSuggestions, planMyWeek } from '../lib/api';
import { supabase } from '../lib/supabase';
import Sheet from '../lib/Sheet';
import { addSession, lastTimeText, firstNumber, KG_PER_LB } from '../lib/exerciseLog';

const DAY_NAMES = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
const MONTH_NAMES = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
const WORKOUT_COLORS = { Strength:'#F44336', Cardio:'#2196F3', HIIT:'#FF9800', Flexibility:'#4CAF50' };
const DIFFICULTY_COLOR = { Beginner:'#4CAF50', Intermediate:'#FF9800', Advanced:'#F44336' };
const FILTERS = ['All','Strength','Cardio','HIIT','Flexibility'];

const toDateStr = (d) => {
  const y = d.getFullYear(), m = String(d.getMonth()+1).padStart(2,'0'), day = String(d.getDate()).padStart(2,'0');
  return `${y}-${m}-${day}`;
};
const getTodayStr = () => toDateStr(new Date());
// Monday of the week a date belongs to, as YYYY-MM-DD (weekly plan, 6.3.3).
const mondayOf = (d) => { const m = new Date(d); m.setDate(m.getDate() - ((m.getDay() + 6) % 7)); return toDateStr(m); };
const WEEK_DAYS = ['Mon','Tue','Wed','Thu','Fri','Sat','Sun'];
const weekdayIndex = (d) => (d.getDay() + 6) % 7;

const buildDays = () => {
  const days = [], base = new Date();
  base.setDate(base.getDate() - 3);
  for (let i = 0; i < 14; i++) { const d = new Date(base); d.setDate(base.getDate()+i); days.push(d); }
  return days;
};

export default function ExerciseScreen() {
  const navigation = useNavigation();
  const todayStr = getTodayStr();
  const [selectedDate, setSelectedDate] = useState(todayStr);
  const [workoutPlans, setWorkoutPlans] = useState({});
  const [loading, setLoading] = useState(false);
  const [filter, setFilter] = useState('All');
  const [expandedWorkout, setExpandedWorkout] = useState(null);
  // Weekly plan (6.3.3), exercise detail (6.3.4) and reps/weight log (6.3.5)
  const [weekPlan, setWeekPlan] = useState(null);
  const [daysPerWeek, setDaysPerWeek] = useState(3);
  const [planning, setPlanning] = useState(false);
  const [weekOpen, setWeekOpen] = useState(false);
  const [detail, setDetail] = useState(null); // { exercise, workout }
  const [logFor, setLogFor] = useState(null); // exercise being logged
  const [exerciseLog, setExerciseLog] = useState({});
  const [units, setUnits] = useState('metric');
  const days = buildDays();

  useEffect(() => { loadWorkoutPlans(); }, []);

  const loadWorkoutPlans = async () => {
    try { const s = await getUserItem('workoutPlans'); if (s) setWorkoutPlans(JSON.parse(s)); } catch(e) {}
    try { const w = await getUserItem('weekPlan'); if (w) setWeekPlan(JSON.parse(w)); } catch(e) {}
    try { const l = await getUserItem('exerciseLog'); if (l) setExerciseLog(JSON.parse(l)); } catch(e) {}
    try { const { data: { user } } = await supabase.auth.getUser(); if (user?.user_metadata?.units === 'imperial') setUnits('imperial'); } catch(e) {}
  };

  // A plan belongs to one Monday-to-Sunday week; "Plan my week" comes back when a new week starts.
  const thisMonday = mondayOf(new Date());
  const currentPlan = weekPlan?.weekStart === thisMonday ? weekPlan : null;
  const focusOn = (dateStr) => {
    if (!currentPlan || mondayOf(new Date(dateStr + 'T12:00:00')) !== currentPlan.weekStart) return undefined;
    return currentPlan.days[weekdayIndex(new Date(dateStr + 'T12:00:00'))]?.focus;
  };

  const makeWeekPlan = async () => {
    setPlanning(true);
    try {
      const plan = await planMyWeek(daysPerWeek);
      const saved = { ...plan, weekStart: thisMonday, daysPerWeek };
      setWeekPlan(saved);
      setWeekOpen(false);
      try { await setUserItem('weekPlan', JSON.stringify(saved)); } catch(e) {}
    } catch(e) { if (!handleSubscriptionLapse(e, navigation)) Alert.alert('Could not plan your week', e.message || 'Please try again.'); }
    setPlanning(false);
  };

  const saveLog = async (exerciseId, sets) => {
    const next = addSession(exerciseLog, exerciseId, { date: todayStr, sets });
    setExerciseLog(next);
    try { await setUserItem('exerciseLog', JSON.stringify(next)); } catch(e) {}
  };
  const saveWorkoutPlans = async (plans) => {
    setWorkoutPlans(plans);
    try { await setUserItem('workoutPlans', JSON.stringify(plans)); } catch(e) {}
  };

  const getAllRecentWorkouts = () => {
    const results = [];
    Object.entries(workoutPlans).forEach(([date, workouts]) => {
      workouts.filter(w => w.completed).forEach(w => results.push({ ...w, date }));
    });
    return results.sort((a,b) => b.date.localeCompare(a.date));
  };

  const getSuggestions = async () => {
    setLoading(true); setExpandedWorkout(null);
    try {
      const recentWorkouts = getAllRecentWorkouts();
      const filterType = filter === 'All' ? null : filter;
      const suggestions = await getWorkoutSuggestions(recentWorkouts, filterType, focusOn(selectedDate));
      const withIds = suggestions.map(s => ({ ...s, id:`${Date.now()}-${Math.random()}`, completed:false }));
      await saveWorkoutPlans({ ...workoutPlans, [selectedDate]: withIds });
    } catch(e) { if (!handleSubscriptionLapse(e, navigation)) Alert.alert('Error', e.message || 'Could not get workout suggestions. Please try again.'); }
    setLoading(false);
  };

  const toggleCompleted = async (workoutId) => {
    const updated = (workoutPlans[selectedDate]||[]).map(w =>
      w.id === workoutId ? { ...w, completed: !w.completed } : w
    );
    await saveWorkoutPlans({ ...workoutPlans, [selectedDate]: updated });
  };

  const selectedWorkouts = workoutPlans[selectedDate] || [];
  const filteredWorkouts = filter === 'All' ? selectedWorkouts : selectedWorkouts.filter(w => w.type === filter);
  const selectedDateObj = new Date(selectedDate + 'T12:00:00');
  const isToday = selectedDate === todayStr;
  const completedCount = selectedWorkouts.filter(w => w.completed).length;

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.header}>
        <Text style={styles.title}>Exercise</Text>
        <Text style={styles.monthYear}>{MONTH_NAMES[selectedDateObj.getMonth()]} {selectedDateObj.getFullYear()}</Text>
      </View>

      <WeekCard plan={currentPlan} open={weekOpen} onToggle={() => setWeekOpen(!weekOpen)}
        daysPerWeek={daysPerWeek} onDaysPerWeek={setDaysPerWeek} planning={planning} onPlan={makeWeekPlan} />

      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.calendarScroll} contentContainerStyle={styles.calendarStrip}>
        {days.map(date => {
          const dateStr = toDateStr(date);
          const isSelected = dateStr === selectedDate;
          const isTodayDate = dateStr === todayStr;
          const dayWorkouts = workoutPlans[dateStr] || [];
          const hasCompleted = dayWorkouts.some(w => w.completed);
          const hasAny = dayWorkouts.length > 0;
          return (
            <TouchableOpacity key={dateStr}
              style={[styles.dayItem, isSelected && styles.dayItemSelected]}
              onPress={() => { setSelectedDate(dateStr); setExpandedWorkout(null); }}>
              <Text style={[styles.dayName, isSelected && styles.dayTextSelected]}>{DAY_NAMES[date.getDay()]}</Text>
              <Text style={[styles.dayNumber, isSelected && styles.dayTextSelected, isTodayDate && !isSelected && styles.dayNumberToday]}>
                {date.getDate()}
              </Text>
              {hasAny
                ? <View style={[styles.dayDot, { backgroundColor: hasCompleted ? '#4CAF50' : '#FF9800' }]} />
                : <View style={styles.dayDotEmpty} />}
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      <View style={styles.divider} />

      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.dateTitleRow}>
          <Text style={styles.dateTitle}>
            {isToday ? "Today's Workout" : `${DAY_NAMES[selectedDateObj.getDay()]}, ${MONTH_NAMES[selectedDateObj.getMonth()]} ${selectedDateObj.getDate()}`}
          </Text>
          {completedCount > 0 && <Text style={styles.completedCount}>💪 {completedCount} done</Text>}
        </View>

        {/* Filters */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterStrip}>
          {FILTERS.map(f => (
            <TouchableOpacity key={f}
              style={[styles.filterPill, filter === f && styles.filterPillActive]}
              onPress={() => setFilter(f)}>
              <Text style={[styles.filterPillText, filter === f && styles.filterPillTextActive]}>{f}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        {selectedWorkouts.length === 0 ? (
          <View style={styles.empty}>
            <Text style={styles.emptyIcon}>💪</Text>
            <Text style={styles.emptyTitle}>No workouts yet</Text>
            <Text style={styles.emptySubtitle}>AI will tailor workouts to your goals{'\n'}and recent training history.</Text>
            <TouchableOpacity style={[styles.suggestBtn, loading && {opacity:0.7}]} onPress={getSuggestions} disabled={loading}>
              {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.suggestBtnText}>✨  Get AI Suggestions</Text>}
            </TouchableOpacity>
          </View>
        ) : (
          <>
            {filteredWorkouts.length === 0 ? (
              <View style={styles.emptyFilter}>
                <Text style={styles.emptyFilterText}>No {filter} workouts for this day.</Text>
              </View>
            ) : (
              filteredWorkouts.map(workout => (
                <WorkoutCard key={workout.id} workout={workout}
                  expanded={expandedWorkout === workout.id}
                  onToggleExpand={() => setExpandedWorkout(expandedWorkout === workout.id ? null : workout.id)}
                  onToggleCompleted={() => toggleCompleted(workout.id)}
                  onOpenExercise={(ex) => setDetail({ exercise: ex, workout })}
                  onLog={(ex) => setLogFor(ex)}
                  lastTime={(ex) => (ex.exerciseId ? lastTimeText(exerciseLog[ex.exerciseId], units) : null)}
                />
              ))
            )}
            <TouchableOpacity style={[styles.refreshBtn, loading && {opacity:0.7}]} onPress={getSuggestions} disabled={loading}>
              {loading ? <ActivityIndicator color="#0D9E8A" /> :
                <Text style={styles.refreshBtnText}>↻  New Suggestions{filter !== 'All' ? ` (${filter})` : ''}</Text>}
            </TouchableOpacity>
          </>
        )}
      </ScrollView>

      {detail && <ExerciseDetail exercise={detail.exercise} onClose={() => setDetail(null)} />}
      {logFor && (
        <LogSheet exercise={logFor} units={units} onClose={() => setLogFor(null)}
          onSave={async (sets) => { await saveLog(logFor.exerciseId, sets); setLogFor(null); }} />
      )}
    </SafeAreaView>
  );
}

function WeekCard({ plan, open, onToggle, daysPerWeek, onDaysPerWeek, planning, onPlan }) {
  if (!plan) {
    return (
      <View style={styles.weekCard}>
        <Text style={styles.weekTitle}>Plan my week</Text>
        <View style={styles.weekChips}>
          <Text style={styles.weekLabel}>Days per week:</Text>
          {[2, 3, 4, 5].map(n => (
            <TouchableOpacity key={n} style={[styles.weekChip, daysPerWeek === n && styles.weekChipOn]} onPress={() => onDaysPerWeek(n)}
              accessibilityRole="radio" accessibilityState={{ selected: daysPerWeek === n }}>
              <Text style={[styles.weekChipText, daysPerWeek === n && styles.weekChipTextOn]}>{n}</Text>
            </TouchableOpacity>
          ))}
        </View>
        <TouchableOpacity style={[styles.weekBtn, planning && { opacity:0.7 }]} onPress={onPlan} disabled={planning}>
          {planning ? <ActivityIndicator color="#fff" /> : <Text style={styles.weekBtnText}>Plan my week</Text>}
        </TouchableOpacity>
      </View>
    );
  }
  const i = weekdayIndex(new Date());
  const today = plan.days[i]?.focus;
  const tomorrow = i < 6 ? plan.days[i + 1]?.focus : null;
  return (
    <View style={styles.weekCard}>
      <TouchableOpacity onPress={onToggle} accessibilityState={{ expanded: open }}>
        <Text style={styles.weekLabel}>This week</Text>
        <Text style={styles.weekTitle}>Today: {today}{tomorrow ? ` · Tomorrow: ${tomorrow}` : ''}</Text>
        <Text style={styles.weekTag}>✓ Checked against training rules</Text>
      </TouchableOpacity>
      {open && (
        <View style={{ marginTop:8 }}>
          {plan.days.map((d, k) => (
            <View key={d.day} style={[styles.weekRow, k === i && styles.weekRowToday]}>
              <Text style={styles.weekDay}>{d.day}</Text>
              <View style={{ flex:1 }}>
                <Text style={styles.weekFocus}>{d.focus}</Text>
                {d.note ? <Text style={styles.weekNote}>{d.note}</Text> : null}
              </View>
            </View>
          ))}
          <TouchableOpacity onPress={onPlan} disabled={planning} style={{ marginTop:6 }}>
            <Text style={styles.weekReplan}>{planning ? 'Planning…' : 'Re-plan'}</Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}

// Detail laid out like Neil's app (6.3.4): photos alternate every second; a photo that fails to load is hidden.
function ExerciseDetail({ exercise, onClose }) {
  const [photo, setPhoto] = useState(0);
  const [photoFailed, setPhotoFailed] = useState(false);
  const images = exercise.images || [];
  useEffect(() => {
    if (images.length < 2) return undefined;
    const t = setInterval(() => setPhoto(p => (p + 1) % images.length), 1000);
    return () => clearInterval(t);
  }, [images.length]);
  const muscles = [...(exercise.primaryMuscles || []), ...(exercise.secondaryMuscles || [])];
  return (
    <Sheet onClose={onClose}>
      <View style={styles.modalOverlay}>
        <View style={styles.modalSheet}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>{exercise.name}</Text>
            <TouchableOpacity onPress={onClose} accessibilityLabel="Close"><Text style={styles.modalClose}>✕</Text></TouchableOpacity>
          </View>
          <ScrollView>
            {images.length > 0 && !photoFailed && (
              <Image source={{ uri: images[photo] }} style={styles.exercisePhoto} resizeMode="cover"
                onError={() => setPhotoFailed(true)} accessibilityLabel={`${exercise.name}, ${photo === 0 ? 'start' : 'end'} position`} />
            )}
            <View style={styles.muscleRow}>
              {muscles.map((m, k) => (
                <View key={k} style={[styles.muscleTag, k < (exercise.primaryMuscles || []).length && styles.muscleTagMain]}>
                  <Text style={styles.muscleTagText}>{m}</Text>
                </View>
              ))}
            </View>
            {exercise.equipment ? <Text style={styles.detailLine}>Equipment: {exercise.equipment}</Text> : null}
            {(exercise.sets || exercise.reps || exercise.rest) ? (
              <Text style={styles.detailLine}>Plan: {[exercise.sets && `${exercise.sets} sets`, exercise.reps && `${exercise.reps} reps`, exercise.rest && `rest ${exercise.rest}`].filter(Boolean).join(' · ')}</Text>
            ) : null}
            {(exercise.instructions || []).map((step, k) => (
              <Text key={k} style={styles.stepText}>{k + 1}. {step}</Text>
            ))}
          </ScrollView>
        </View>
      </View>
    </Sheet>
  );
}

// One line per planned set: reps prefilled from the plan, weight in the profile's units, stored in kg (6.3.5).
function LogSheet({ exercise, units, onClose, onSave }) {
  const setCount = Math.min(10, Math.max(1, firstNumber(exercise.sets, 3)));
  const [rows, setRows] = useState(() => Array.from({ length: setCount }, () => ({ reps: String(firstNumber(exercise.reps, '')), weight: '' })));
  const unit = units === 'imperial' ? 'lb' : 'kg';
  const save = () => {
    const sets = rows
      .map(r => ({ reps: Number(r.reps), w: Number(String(r.weight).replace(',', '.')) }))
      .filter(r => r.reps > 0 && Number.isFinite(r.w) && r.w >= 0)
      .map(r => ({ reps: r.reps, weightKg: Math.round((units === 'imperial' ? r.w * KG_PER_LB : r.w) * 10) / 10 }));
    if (!sets.length) { Alert.alert('Nothing to save', 'Enter reps and weight for at least one set.'); return; }
    onSave(sets);
  };
  return (
    <Sheet onClose={onClose}>
      <View style={styles.modalOverlay}>
        <View style={styles.modalSheet}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Log {exercise.name}</Text>
            <TouchableOpacity onPress={onClose} accessibilityLabel="Close"><Text style={styles.modalClose}>✕</Text></TouchableOpacity>
          </View>
          <ScrollView keyboardShouldPersistTaps="handled">
            {rows.map((r, k) => (
              <View key={k} style={styles.logRow}>
                <Text style={styles.logSet}>Set {k + 1}</Text>
                <TextInput style={styles.logInput} value={r.reps} keyboardType="numeric" placeholder="reps" placeholderTextColor="#aaa"
                  onChangeText={v => setRows(rows.map((x, j) => j === k ? { ...x, reps: v } : x))} accessibilityLabel={`Set ${k + 1} reps`} />
                <TextInput style={styles.logInput} value={r.weight} keyboardType="numeric" placeholder={unit} placeholderTextColor="#aaa"
                  onChangeText={v => setRows(rows.map((x, j) => j === k ? { ...x, weight: v } : x))} accessibilityLabel={`Set ${k + 1} weight in ${unit}`} />
                <Text style={styles.logUnit}>{unit}</Text>
              </View>
            ))}
            <TouchableOpacity style={styles.weekBtn} onPress={save}><Text style={styles.weekBtnText}>Save</Text></TouchableOpacity>
          </ScrollView>
        </View>
      </View>
    </Sheet>
  );
}

function WorkoutCard({ workout, expanded, onToggleExpand, onToggleCompleted, onOpenExercise, onLog, lastTime }) {
  const color = WORKOUT_COLORS[workout.type] || '#607D8B';
  const diffColor = DIFFICULTY_COLOR[workout.difficulty] || '#888';

  // Exercises from the library open their detail (steps, muscles, photos).
  const nameEl = (ex, style) => ex.instructions?.length
    ? <TouchableOpacity style={style} onPress={() => onOpenExercise(ex)} accessibilityHint="Shows steps and photos">
        <Text style={[styles.exerciseName, styles.exerciseLink]}>{ex.name}</Text>
      </TouchableOpacity>
    : <Text style={[styles.exerciseName, style]}>{ex.name}</Text>;

  const renderExercises = () => {
    if (!workout.exercises || workout.exercises.length === 0) return null;
    switch (workout.type) {
      case 'Strength':
        return (
          <View>
            <View style={styles.tableHeader}>
              <Text style={[styles.tableHeaderCell, {flex:3}]}>Exercise</Text>
              <Text style={[styles.tableHeaderCell, {flex:1}]}>Sets</Text>
              <Text style={[styles.tableHeaderCell, {flex:2}]}>Reps</Text>
              <Text style={[styles.tableHeaderCell, {flex:2}]}>Rest</Text>
            </View>
            {workout.exercises.map((ex, i) => (
              <View key={i}>
                <View style={[styles.tableRow, i % 2 === 0 && styles.tableRowAlt]}>
                  {nameEl(ex, {flex:3})}
                  <Text style={[styles.exerciseVal, {flex:1}]}>{ex.sets}</Text>
                  <Text style={[styles.exerciseVal, {flex:2}]}>{ex.reps}</Text>
                  <Text style={[styles.exerciseVal, {flex:2}]}>{ex.rest}</Text>
                </View>
                {(lastTime(ex) || ex.exerciseId) && (
                  <View style={styles.logLine}>
                    <Text style={styles.lastTime}>{lastTime(ex) || ''}</Text>
                    {ex.exerciseId && (
                      <TouchableOpacity style={styles.logBtn} onPress={() => onLog(ex)} accessibilityLabel={`Log ${ex.name}`}>
                        <Text style={styles.logBtnText}>Log</Text>
                      </TouchableOpacity>
                    )}
                  </View>
                )}
                {ex.weight && <Text style={styles.exerciseDetail}>🏋️ Weight: {ex.weight}{ex.tempo ? `  ·  Tempo: ${ex.tempo}` : ''}</Text>}
                {ex.formTip && <Text style={styles.exerciseDetail}>💡 {ex.formTip}</Text>}
                {ex.notes && <Text style={styles.exerciseNote}>📝 {ex.notes}</Text>}
              </View>
            ))}
          </View>
        );
      case 'HIIT':
        return (
          <View>
            {workout.exercises.map((ex, i) => (
              <View key={i} style={[styles.hiitRow, i % 2 === 0 && styles.tableRowAlt]}>
                <View style={{flex:1}}>
                  {nameEl(ex)}
                  {ex.notes && <Text style={styles.exerciseNote}>💡 {ex.notes}</Text>}
                </View>
                <View style={styles.hiitMeta}>
                  <Text style={styles.hiitWork}>⚡ {ex.work}</Text>
                  <Text style={styles.hiitRest}>💤 {ex.rest}</Text>
                  {ex.rounds && <Text style={styles.hiitRounds}>× {ex.rounds}</Text>}
                </View>
              </View>
            ))}
          </View>
        );
      case 'Cardio':
        return (
          <View>
            {workout.exercises.map((ex, i) => (
              <View key={i} style={[styles.cardioRow, i % 2 === 0 && styles.tableRowAlt]}>
                {nameEl(ex)}
                <View style={styles.cardioStats}>
                  {ex.duration && <StatTag label="⏱" value={ex.duration} />}
                  {ex.intensity && <StatTag label="🔥" value={ex.intensity} color={getIntensityColor(ex.intensity)} />}
                  {ex.targetHR && <StatTag label="❤️" value={ex.targetHR} />}
                </View>
                {ex.structure && <Text style={styles.exerciseDetail}>📋 {ex.structure}</Text>}
                {ex.notes && <Text style={styles.exerciseNote}>💡 {ex.notes}</Text>}
              </View>
            ))}
          </View>
        );
      case 'Flexibility':
        return (
          <View>
            {workout.exercises.map((ex, i) => (
              <View key={i} style={[styles.flexRow, i % 2 === 0 && styles.tableRowAlt]}>
                <View style={{flex:1}}>
                  {nameEl(ex)}
                  {ex.breathingCue && <Text style={styles.exerciseDetail}>🌬️ {ex.breathingCue}</Text>}
                  {ex.notes && <Text style={styles.exerciseNote}>💡 {ex.notes}</Text>}
                </View>
                <View style={styles.flexMeta}>
                  {ex.hold && <Text style={styles.flexMetaText}>{ex.hold}</Text>}
                  {ex.sets && <Text style={styles.flexMetaText}>{ex.sets} sets</Text>}
                </View>
              </View>
            ))}
          </View>
        );
      default:
        return null;
    }
  };

  return (
    <View style={[styles.card, workout.completed && styles.cardCompleted]}>
      {/* Top row */}
      <View style={styles.cardTop}>
        <View style={styles.badges}>
          <View style={[styles.typeBadge, { backgroundColor: color+'22', borderColor: color }]}>
            <Text style={[styles.typeBadgeText, { color }]}>{workout.type}</Text>
          </View>
          <View style={[styles.diffBadge, { backgroundColor: diffColor+'20' }]}>
            <Text style={[styles.diffText, { color: diffColor }]}>{workout.difficulty}</Text>
          </View>
        </View>
        <TouchableOpacity style={[styles.checkBox, workout.completed && styles.checkBoxDone]} onPress={onToggleCompleted}>
          {workout.completed && <Text style={styles.checkMark}>✓</Text>}
        </TouchableOpacity>
      </View>

      <Text style={styles.workoutName}>{workout.name}</Text>

      {workout.muscleGroups?.length > 0 && (
        <View style={styles.muscleRow}>
          {workout.muscleGroups.map((m,i) => <View key={i} style={styles.muscleTag}><Text style={styles.muscleTagText}>{m}</Text></View>)}
        </View>
      )}

      <View style={styles.statsRow}>
        <StatPill icon="⏱" value={workout.duration} />
        <StatPill icon="🔥" value={`~${workout.caloriesBurned} kcal`} />
        <StatPill icon="📋" value={`${workout.exercises?.length || 0} exercises`} />
      </View>

      {workout.exerciseSource === 'verified' && <Text style={styles.verifiedTag}>✓ Exercises checked against the exercise library</Text>}
      {workout.description && <Text style={styles.description}>{workout.description}</Text>}
      {workout.warnings?.map((w, i) => <Text key={i} style={styles.warnText}>⚠️ {w}</Text>)}

      {/* Expanded detail */}
      {expanded && (
        <View style={styles.detailBox}>
          {workout.warmup && (
            <View style={styles.prepSection}>
              <Text style={styles.prepTitle}>🔆 Warm-Up</Text>
              <Text style={styles.prepText}>{workout.warmup}</Text>
            </View>
          )}
          <Text style={styles.exerciseListTitle}>
            {workout.type === 'Strength' ? '🏋️ Training Plan' :
             workout.type === 'HIIT' ? '⚡ HIIT Circuit' :
             workout.type === 'Cardio' ? '🏃 Cardio Plan' : '🧘 Stretch Routine'}
          </Text>
          {renderExercises()}
          {workout.cooldown && (
            <View style={[styles.prepSection, {marginTop:14}]}>
              <Text style={styles.prepTitle}>🌙 Cool-Down</Text>
              <Text style={styles.prepText}>{workout.cooldown}</Text>
            </View>
          )}
        </View>
      )}

      <TouchableOpacity style={styles.expandBtn} onPress={onToggleExpand}>
        <Text style={styles.expandBtnText}>{expanded ? '▲  Hide Details' : '▼  View Full Plan'}</Text>
      </TouchableOpacity>
    </View>
  );
}

function StatPill({ icon, value }) {
  return <View style={styles.statPill}><Text style={styles.statPillText}>{icon}  {value}</Text></View>;
}

function StatTag({ label, value, color }) {
  return (
    <View style={[styles.statTag, color && { backgroundColor: color+'15' }]}>
      <Text style={[styles.statTagText, color && { color }]}>{label} {value}</Text>
    </View>
  );
}

function getIntensityColor(i) {
  const map = { low:'#4CAF50', easy:'#4CAF50', moderate:'#FF9800', high:'#F44336', hard:'#F44336' };
  return map[i?.toLowerCase()] || '#888';
}

const styles = StyleSheet.create({
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
  dateTitleRow: { flexDirection:'row', justifyContent:'space-between', alignItems:'center', marginBottom:14 },
  dateTitle: { fontSize:20, fontWeight:'700', color:'#1a1a1a' },
  completedCount: { fontSize:14, color:'#4CAF50', fontWeight:'700' },
  filterStrip: { paddingBottom:16, gap:8 },
  filterPill: { borderWidth:1.5, borderColor:'#E0E0E0', borderRadius:20, paddingHorizontal:16, paddingVertical:7 },
  filterPillActive: { backgroundColor:'#0D9E8A', borderColor:'#0D9E8A' },
  filterPillText: { fontSize:14, color:'#888', fontWeight:'600' },
  filterPillTextActive: { color:'#fff' },
  empty: { alignItems:'center', paddingTop:50 },
  emptyIcon: { fontSize:52, marginBottom:16 },
  emptyTitle: { fontSize:20, fontWeight:'700', color:'#1a1a1a', marginBottom:8 },
  emptySubtitle: { fontSize:15, color:'#aaa', textAlign:'center', lineHeight:22, marginBottom:28 },
  suggestBtn: { backgroundColor:'#0D9E8A', borderRadius:14, paddingHorizontal:28, paddingVertical:14 },
  suggestBtnText: { color:'#fff', fontSize:16, fontWeight:'700' },
  emptyFilter: { alignItems:'center', paddingVertical:32 },
  emptyFilterText: { fontSize:15, color:'#aaa' },
  card: { backgroundColor:'#FAFAFA', borderRadius:16, padding:16, marginBottom:14, borderWidth:1.5, borderColor:'#F0F0F0' },
  cardCompleted: { borderColor:'#4CAF5040', backgroundColor:'#F6FFF6' },
  cardTop: { flexDirection:'row', justifyContent:'space-between', alignItems:'center', marginBottom:10 },
  badges: { flexDirection:'row', gap:8 },
  typeBadge: { borderWidth:1.5, borderRadius:20, paddingHorizontal:12, paddingVertical:4 },
  typeBadgeText: { fontSize:12, fontWeight:'700' },
  diffBadge: { borderRadius:20, paddingHorizontal:10, paddingVertical:4 },
  diffText: { fontSize:12, fontWeight:'600' },
  checkBox: { width:28, height:28, borderRadius:14, borderWidth:2, borderColor:'#ddd', alignItems:'center', justifyContent:'center' },
  checkBoxDone: { backgroundColor:'#4CAF50', borderColor:'#4CAF50' },
  checkMark: { color:'#fff', fontSize:14, fontWeight:'800' },
  workoutName: { fontSize:19, fontWeight:'800', color:'#1a1a1a', marginBottom:8 },
  muscleRow: { flexDirection:'row', flexWrap:'wrap', gap:6, marginBottom:10 },
  muscleTag: { backgroundColor:'#F0F0F0', borderRadius:12, paddingHorizontal:10, paddingVertical:3 },
  muscleTagText: { fontSize:12, color:'#555', fontWeight:'500' },
  statsRow: { flexDirection:'row', gap:8, marginBottom:10, flexWrap:'wrap' },
  statPill: { backgroundColor:'#F5F5F5', borderRadius:20, paddingHorizontal:12, paddingVertical:5 },
  statPillText: { fontSize:13, color:'#555', fontWeight:'500' },
  description: { fontSize:14, color:'#777', lineHeight:20, marginBottom:8 },
  detailBox: { backgroundColor:'#fff', borderRadius:12, padding:14, marginTop:10, borderWidth:1, borderColor:'#E8E8E8' },
  prepSection: { backgroundColor:'#F8F8F8', borderRadius:10, padding:12, marginBottom:14 },
  prepTitle: { fontSize:13, fontWeight:'700', color:'#555', marginBottom:4 },
  prepText: { fontSize:13, color:'#666', lineHeight:20 },
  exerciseListTitle: { fontSize:14, fontWeight:'800', color:'#1a1a1a', marginBottom:12 },
  tableHeader: { flexDirection:'row', paddingBottom:8, borderBottomWidth:1, borderBottomColor:'#F0F0F0', marginBottom:4 },
  tableHeaderCell: { fontSize:11, fontWeight:'700', color:'#aaa', textTransform:'uppercase', textAlign:'center' },
  tableRow: { flexDirection:'row', paddingVertical:10, paddingHorizontal:4, alignItems:'center' },
  tableRowAlt: { backgroundColor:'#F9F9F9', borderRadius:8 },
  exerciseName: { fontSize:14, fontWeight:'600', color:'#1a1a1a' },
  exerciseVal: { fontSize:14, color:'#555', textAlign:'center' },
  exerciseDetail: { fontSize:12, color:'#888', paddingLeft:4, paddingBottom:4, lineHeight:18 },
  exerciseNote: { fontSize:12, color:'#aaa', fontStyle:'italic', paddingLeft:4, paddingBottom:6 },
  hiitRow: { flexDirection:'row', alignItems:'center', paddingVertical:10, paddingHorizontal:4, borderRadius:8 },
  hiitMeta: { alignItems:'flex-end', gap:2 },
  hiitWork: { fontSize:13, fontWeight:'700', color:'#FF9800' },
  hiitRest: { fontSize:12, color:'#888' },
  hiitRounds: { fontSize:12, fontWeight:'600', color:'#555' },
  cardioRow: { paddingVertical:10, paddingHorizontal:4, borderRadius:8 },
  cardioStats: { flexDirection:'row', flexWrap:'wrap', gap:6, marginTop:6, marginBottom:4 },
  statTag: { backgroundColor:'#F5F5F5', borderRadius:12, paddingHorizontal:8, paddingVertical:3 },
  statTagText: { fontSize:12, color:'#555', fontWeight:'500' },
  flexRow: { flexDirection:'row', alignItems:'flex-start', paddingVertical:10, paddingHorizontal:4, borderRadius:8 },
  flexMeta: { alignItems:'flex-end', gap:2, paddingLeft:8 },
  flexMetaText: { fontSize:13, fontWeight:'600', color:'#4CAF50' },
  expandBtn: { marginTop:12, alignItems:'center' },
  expandBtnText: { fontSize:13, color:'#0D9E8A', fontWeight:'600' },
  refreshBtn: { borderWidth:1.5, borderColor:'#0D9E8A', borderRadius:12, padding:14, alignItems:'center', marginTop:4 },
  refreshBtnText: { color:'#0D9E8A', fontSize:15, fontWeight:'700' },
  weekCard: { marginHorizontal:16, marginBottom:10, backgroundColor:'#F0FAF8', borderRadius:14, padding:14, borderWidth:1.5, borderColor:'#0D9E8A30' },
  weekLabel: { fontSize:12, color:'#0D9E8A', fontWeight:'700', marginRight:6 },
  weekTitle: { fontSize:16, fontWeight:'800', color:'#1a1a1a', marginTop:2 },
  weekTag: { fontSize:12, color:'#0D9E8A', fontWeight:'600', marginTop:4 },
  weekChips: { flexDirection:'row', alignItems:'center', gap:6, marginVertical:10 },
  weekChip: { minWidth:34, minHeight:34, borderWidth:1.5, borderColor:'#D0D0D0', borderRadius:17, alignItems:'center', justifyContent:'center', backgroundColor:'#fff' },
  weekChipOn: { borderColor:'#0D9E8A', backgroundColor:'#0D9E8A' },
  weekChipText: { fontSize:14, fontWeight:'700', color:'#555' },
  weekChipTextOn: { color:'#fff' },
  weekBtn: { backgroundColor:'#0D9E8A', borderRadius:12, paddingVertical:12, alignItems:'center', marginTop:4 },
  weekBtnText: { color:'#fff', fontSize:15, fontWeight:'700' },
  weekRow: { flexDirection:'row', gap:10, paddingVertical:6, paddingHorizontal:6, borderRadius:8 },
  weekRowToday: { backgroundColor:'#fff' },
  weekDay: { width:34, fontSize:13, fontWeight:'700', color:'#555' },
  weekFocus: { fontSize:14, fontWeight:'700', color:'#1a1a1a' },
  weekNote: { fontSize:12, color:'#777', marginTop:1 },
  weekReplan: { fontSize:13, color:'#0D9E8A', fontWeight:'700' },
  verifiedTag: { fontSize:12, color:'#0D9E8A', fontWeight:'600', marginBottom:8 },
  exerciseLink: { color:'#0D9E8A', textDecorationLine:'underline' },
  logLine: { flexDirection:'row', alignItems:'center', justifyContent:'space-between', paddingLeft:4, paddingBottom:4 },
  lastTime: { fontSize:12, color:'#555', fontWeight:'600' },
  logBtn: { borderWidth:1.5, borderColor:'#0D9E8A', borderRadius:12, paddingHorizontal:12, paddingVertical:3 },
  logBtnText: { fontSize:12, color:'#0D9E8A', fontWeight:'700' },
  modalOverlay: { flex:1, backgroundColor:'rgba(0,0,0,0.4)', justifyContent:'flex-end' },
  modalSheet: { backgroundColor:'#fff', borderTopLeftRadius:24, borderTopRightRadius:24, padding:24, maxHeight:'85%' },
  modalHeader: { flexDirection:'row', justifyContent:'space-between', alignItems:'center', marginBottom:16 },
  modalTitle: { fontSize:20, fontWeight:'800', color:'#1a1a1a', flex:1, marginRight:12 },
  modalClose: { fontSize:20, color:'#aaa', fontWeight:'600' },
  exercisePhoto: { width:'100%', height:220, borderRadius:14, marginBottom:12, backgroundColor:'#f5f5f5' },
  muscleTagMain: { backgroundColor:'#D7F2EC' },
  detailLine: { fontSize:13, color:'#555', marginBottom:8 },
  stepText: { fontSize:14, color:'#333', lineHeight:21, marginBottom:8 },
  logRow: { flexDirection:'row', alignItems:'center', gap:8, marginBottom:10 },
  logSet: { width:48, fontSize:13, fontWeight:'700', color:'#555' },
  logInput: { flex:1, borderWidth:1.5, borderColor:'#E0E0E0', borderRadius:10, padding:10, fontSize:15, color:'#1a1a1a' },
  logUnit: { width:22, fontSize:13, color:'#888' },
  warnText: { fontSize:12, color:'#8A6D00', backgroundColor:'#FFFBEA', borderRadius:8, padding:8, marginBottom:8 },
});
