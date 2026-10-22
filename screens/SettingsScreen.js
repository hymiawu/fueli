import React, { useCallback, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { Alert } from '../lib/alert';
import { supabase } from '../lib/supabase';
import { currentUser } from '../lib/session';
import { getBillingStatus } from '../lib/api';
import { membershipLabel } from '../lib/membership';

function MenuRow({ icon, title, subtitle, onPress }) {
  return (
    <TouchableOpacity style={styles.row} onPress={onPress}>
      <Text style={styles.rowIcon}>{icon}</Text>
      <View style={styles.rowBody}>
        <Text style={styles.rowTitle}>{title}</Text>
        {subtitle ? <Text style={styles.rowSubtitle}>{subtitle}</Text> : null}
      </View>
      <Text style={styles.chevron}>›</Text>
    </TouchableOpacity>
  );
}

export default function SettingsScreen({ navigation }) {
  const [email, setEmail] = useState('');
  const [membership, setMembership] = useState('');

  // Refresh when coming back from the sub-pages (e.g. after canceling).
  useFocusEffect(
    useCallback(() => {
      currentUser().then((user) => setEmail(user?.email || ''));
      getBillingStatus()
        .then(({ status }) => setMembership(membershipLabel(status)))
        .catch(() => setMembership(''));
    }, []),
  );

  const handleLogout = () => {
    Alert.alert('Log Out', 'Are you sure?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Log Out', style: 'destructive', onPress: async () => {
        await supabase.auth.signOut();
        navigation.replace('Login');
      }},
    ]);
  };

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.container}>
        <Text style={styles.title}>Settings</Text>
        <Text style={styles.email}>{email}</Text>

        <Text style={styles.sectionLabel}>ACCOUNT</Text>
        <View style={styles.group}>
          <MenuRow icon="👤" title="Edit My Profile" subtitle="Stats, activity, goals and diet" onPress={() => navigation.navigate('EditProfile')} />
          <View style={styles.separator} />
          <MenuRow icon="💳" title="Membership" subtitle={membership} onPress={() => navigation.navigate('Membership')} />
        </View>

        <TouchableOpacity style={styles.logoutBtn} onPress={handleLogout}>
          <Text style={styles.logoutText}>Log Out</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#F7F8F8' },
  container: { paddingHorizontal: 20, paddingTop: 24, paddingBottom: 48 },
  title: { fontSize: 28, fontWeight: '800', color: '#1a1a1a', marginBottom: 4 },
  email: { fontSize: 14, color: '#888', marginBottom: 28 },
  sectionLabel: { fontSize: 12, fontWeight: '700', color: '#999', letterSpacing: 0.5, marginBottom: 8, marginLeft: 4 },
  group: { backgroundColor: '#fff', borderRadius: 14, borderWidth: 1, borderColor: '#EEE', marginBottom: 28 },
  row: { flexDirection: 'row', alignItems: 'center', paddingVertical: 14, paddingHorizontal: 16 },
  rowIcon: { fontSize: 22, marginRight: 14 },
  rowBody: { flex: 1 },
  rowTitle: { fontSize: 16, fontWeight: '600', color: '#1a1a1a' },
  rowSubtitle: { fontSize: 13, color: '#888', marginTop: 2 },
  chevron: { fontSize: 24, color: '#C4C4C4', marginLeft: 8 },
  separator: { height: 1, backgroundColor: '#F0F0F0', marginLeft: 52 },
  logoutBtn: { backgroundColor: '#fff', borderWidth: 1.5, borderColor: '#FF4444', borderRadius: 12, padding: 16, alignItems: 'center' },
  logoutText: { color: '#FF4444', fontSize: 16, fontWeight: '600' },
});
