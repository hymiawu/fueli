import React, { useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView, ActivityIndicator, Linking, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Alert } from '../lib/alert';
import { getMembership, cancelMembership, resumeMembership, startCheckout } from '../lib/api';
import { membershipLabel, formatDate, PRICE_LABEL, PRICE_PER_MONTH } from '../lib/membership';

export default function MembershipScreen({ navigation }) {
  const [info, setInfo] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const load = () => getMembership().then(setInfo).catch((e) => setError(e.message));
  useEffect(() => { load(); }, []);

  const run = async (action) => {
    setBusy(true);
    setError('');
    try {
      setInfo(await action());
    } catch (e) {
      setError(e.message);
    }
    setBusy(false);
  };

  const cancel = () => {
    if (status === 'grandfathered') {
      Alert.alert(
        'Cancel membership?',
        `Your free access ends right away. To use Fueli again you will need a ${PRICE_PER_MONTH} subscription.`,
        [
          { text: 'Keep It', style: 'cancel' },
          { text: 'Cancel Membership', style: 'destructive', onPress: async () => {
            setBusy(true);
            try {
              await cancelMembership();
              navigation.reset({ index: 0, routes: [{ name: 'Paywall' }] });
            } catch (e) {
              setError(e.message);
              setBusy(false);
            }
          }},
        ],
      );
      return;
    }
    Alert.alert(
      'Cancel subscription?',
      `You'll keep access until ${formatDate(info.periodEnd)}, and you won't be charged again.`,
      [
        { text: 'Keep It', style: 'cancel' },
        { text: 'Cancel Subscription', style: 'destructive', onPress: () => run(cancelMembership) },
      ],
    );
  };

  const subscribe = async () => {
    setBusy(true);
    setError('');
    try {
      const { url } = await startCheckout();
      if (Platform.OS === 'web') window.location.assign(url);
      else await Linking.openURL(url);
    } catch (e) {
      setError(e.message);
      setBusy(false);
    }
  };

  const status = info?.status;
  const subscribed = status === 'active' || status === 'trialing';
  let detail = 'Subscribe to use AI meal plans, workouts and food scans.';
  if (status === 'grandfathered') detail = '';
  else if (subscribed && info.cancelAtPeriodEnd) detail = `Canceled. You have access until ${formatDate(info.periodEnd)}.`;
  else if (subscribed) detail = `Renews on ${formatDate(info.periodEnd)}.`;

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.container}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Text style={styles.backText}>‹ Settings</Text>
        </TouchableOpacity>
        <Text style={styles.title}>Membership</Text>

        {!info && !error ? (
          <ActivityIndicator style={{ marginTop: 40 }} color="#0D9E8A" />
        ) : (
          <>
            {info && (
              <View style={styles.card}>
                <Text style={styles.plan}>Fueli Monthly</Text>
                <Text style={styles.price}>
                  {PRICE_LABEL}<Text style={styles.per}> / month</Text>
                </Text>
                <View style={[styles.badge, (subscribed || status === 'grandfathered') && !info.cancelAtPeriodEnd ? styles.badgeOn : styles.badgeOff]}>
                  <Text style={styles.badgeText}>{info.cancelAtPeriodEnd ? 'Canceling' : membershipLabel(status).split(' · ')[0]}</Text>
                </View>
                {detail ? <Text style={styles.detail}>{detail}</Text> : null}
                {info.dailyUsage?.meals ? (
                  <Text style={styles.usage}>
                    {Math.max(0, info.dailyUsage.meals.limit - info.dailyUsage.meals.used)} of {info.dailyUsage.meals.limit} meal plans left today
                  </Text>
                ) : null}
              </View>
            )}

            {error ? <Text style={styles.error}>{error}</Text> : null}

            {info && ((subscribed && !info.cancelAtPeriodEnd) || status === 'grandfathered') && (
              <TouchableOpacity style={[styles.cancelBtn, busy && styles.dim]} onPress={cancel} disabled={busy}>
                {busy ? <ActivityIndicator color="#FF4444" /> : <Text style={styles.cancelText}>Cancel Membership</Text>}
              </TouchableOpacity>
            )}
            {info && subscribed && info.cancelAtPeriodEnd && (
              <TouchableOpacity style={[styles.primaryBtn, busy && styles.dim]} onPress={() => run(resumeMembership)} disabled={busy}>
                {busy ? <ActivityIndicator color="#fff" /> : <Text style={styles.primaryText}>Keep My Subscription</Text>}
              </TouchableOpacity>
            )}
            {info && !subscribed && status !== 'grandfathered' && (
              <TouchableOpacity style={[styles.primaryBtn, busy && styles.dim]} onPress={subscribe} disabled={busy}>
                {busy ? <ActivityIndicator color="#fff" /> : <Text style={styles.primaryText}>Subscribe with Stripe</Text>}
              </TouchableOpacity>
            )}
            {!info && (
              <TouchableOpacity style={styles.primaryBtn} onPress={() => { setError(''); load(); }}>
                <Text style={styles.primaryText}>Try Again</Text>
              </TouchableOpacity>
            )}
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#F7F8F8' },
  container: { paddingHorizontal: 20, paddingTop: 12, paddingBottom: 48 },
  backBtn: { alignSelf: 'flex-start', paddingVertical: 4, marginBottom: 8 },
  backText: { fontSize: 16, color: '#0D9E8A', fontWeight: '600' },
  title: { fontSize: 28, fontWeight: '800', color: '#1a1a1a', marginBottom: 20 },
  card: { backgroundColor: '#fff', borderRadius: 16, borderWidth: 1, borderColor: '#EEE', padding: 20, marginBottom: 20 },
  plan: { fontSize: 15, fontWeight: '700', color: '#666', marginBottom: 4 },
  price: { fontSize: 32, fontWeight: '800', color: '#1a1a1a', marginBottom: 12 },
  per: { fontSize: 15, fontWeight: '600', color: '#888' },
  badge: { alignSelf: 'flex-start', borderRadius: 12, paddingHorizontal: 10, paddingVertical: 4, marginBottom: 12 },
  badgeOn: { backgroundColor: '#E6F6F3' },
  badgeOff: { backgroundColor: '#FFF1E6' },
  badgeText: { fontSize: 13, fontWeight: '700', color: '#1a1a1a' },
  detail: { fontSize: 14, color: '#555', lineHeight: 20 },
  usage: { fontSize: 13, color: '#888', marginTop: 8 },
  error: { color: '#FF4444', fontSize: 14, textAlign: 'center', marginBottom: 12 },
  primaryBtn: { backgroundColor: '#0D9E8A', borderRadius: 12, padding: 16, alignItems: 'center', marginBottom: 12 },
  primaryText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  cancelBtn: { backgroundColor: '#fff', borderWidth: 1.5, borderColor: '#FF4444', borderRadius: 12, padding: 16, alignItems: 'center', marginBottom: 12 },
  cancelText: { color: '#FF4444', fontSize: 16, fontWeight: '600' },
  dim: { opacity: 0.7 },
});
