import React, { useState, useEffect } from 'react';
import {
  View, Text, TouchableOpacity, ScrollView,
  StyleSheet, ActivityIndicator, } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Alert } from '../lib/alert';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { getWorkoutSuggestions } from '../lib/api';

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
const buildDays = () => {
  const days = [], base = new Date();
  base.setDate(base.getDate() - 3);
  for (let i = 0; i < 14; i++) { const d = new Date(base); d.setDate(base.getDate()+i); days.push(d); }
  return days;
};

export default function ExerciseScreen() {
  const todayStr = getTodayStr();
  const [selectedDate, setSelectedDate] = useState(todayStr);
  const [workoutPlans, setWorkoutPlans] = useState({});
  const [loading, setLoading] = useState(false);
  const [filter, setFilter] = useState('All');
  const [expandedWorkout, setExpandedWorkout] = useState(null);
  const days = buildDays();

  useEffect(() => { loadWorkoutPlans(); }, []);

  const loadWorkoutPlans = async () => {
    try { const s = await AsyncStorage.getItem('workoutPlans'); if (s) setWorkoutPlans(JSON.parse(s)); } catch(e) {}
  };
  const saveWorkoutPlans = async (plans) => {
    setWorkoutPlans(plans);
    try { await AsyncStorage.setItem('workoutPlans', JSON.stringify(plans)); } catch(e) {}
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
      const suggestions = await getWorkoutSuggestions(recentWorkouts, filterType);
      const withIds = suggestions.map(s => ({ ...s, id:`${Date.now()}-${Math.random()}`, completed:false }));
      await saveWorkoutPlans({ ...workoutPlans, [selectedDate]: withIds });
    } catch(e) { Alert.alert('Error', e.message || 'Could not get workout suggestions. Please try again.'); }
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
    </SafeAreaView>
  );
}

function WorkoutCard({ workout, expanded, onToggleExpand, onToggleCompleted }) {
  const color = WORKOUT_COLORS[workout.type] || '#607D8B';
  const diffColor = DIFFICULTY_COLOR[workout.difficulty] || '#888';

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
                  <Text style={[styles.exerciseName, {flex:3}]}>{ex.name}</Text>
                  <Text style={[styles.exerciseVal, {flex:1}]}>{ex.sets}</Text>
                  <Text style={[styles.exerciseVal, {flex:2}]}>{ex.reps}</Text>
                  <Text style={[styles.exerciseVal, {flex:2}]}>{ex.rest}</Text>
                </View>
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
                  <Text style={styles.exerciseName}>{ex.name}</Text>
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
                <Text style={styles.exerciseName}>{ex.name}</Text>
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
                  <Text style={styles.exerciseName}>{ex.name}</Text>
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
  warnText: { fontSize:12, color:'#8A6D00', backgroundColor:'#FFFBEA', borderRadius:8, padding:8, marginBottom:8 },
});
