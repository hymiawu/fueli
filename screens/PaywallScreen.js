import React, { useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ActivityIndicator, Linking, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { supabase } from '../lib/supabase';
import { getBillingStatus, startCheckout, confirmCheckout } from '../lib/api';
import { checkoutReturn } from '../lib/route';
import { PRICE_LABEL } from '../lib/membership';

const FEATURES = [
  '🧊 Fridge inventory with photo scanning',
  '🍽️ AI meal plans from what you already have',
  '💪 Personalized AI workouts',
  '🥡 Calorie estimates for outside food',
];

export default function PaywallScreen({ navigation }) {
  const [checking, setChecking] = useState(true);
  const [redirecting, setRedirecting] = useState(false);
  const [message, setMessage] = useState('');

  useEffect(() => {
    (async () => {
      const back = checkoutReturn();
      // Drop the ?checkout=... query so a reload doesn't repeat this step.
      if (back) window.history.replaceState(null, '', window.location.pathname);
      try {
        const status = back?.result === 'success' && back.sessionId ? await confirmCheckout(back.sessionId) : await getBillingStatus();
        if (status.active) return navigation.replace('Home');
        if (back?.result === 'cancel') setMessage('Checkout was canceled. You can subscribe whenever you are ready.');
        else if (back?.result === 'success') setMessage('Payment is still processing. Try again in a moment.');
      } catch (e) {
        setMessage(e.message);
      }
      setChecking(false);
    })();
  }, []);

  const subscribe = async () => {
    setRedirecting(true);
    setMessage('');
    try {
      const { url } = await startCheckout();
      if (Platform.OS === 'web') window.location.assign(url);
      else await Linking.openURL(url);
    } catch (e) {
      setMessage(e.message);
      setRedirecting(false);
    }
  };

  const logOut = async () => {
    await supabase.auth.signOut();
    navigation.replace('Login');
  };

  if (checking) {
    return (
      <SafeAreaView style={[styles.safe, styles.center]}>
        <ActivityIndicator color="#fff" size="large" />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.container}>
        <Text style={styles.logo}>Fueli 🥗</Text>
        <Text style={styles.title}>Start your subscription</Text>

        <View style={styles.card}>
          <Text style={styles.price}>
            {PRICE_LABEL}<Text style={styles.per}> / month</Text>
          </Text>
          {FEATURES.map((f) => (
            <Text key={f} style={styles.feature}>{f}</Text>
          ))}
          <Text style={styles.cancelNote}>Cancel anytime.</Text>
        </View>

        {message ? <Text style={styles.message}>{message}</Text> : null}

        <TouchableOpacity style={[styles.subscribeBtn, redirecting && { opacity: 0.7 }]} onPress={subscribe} disabled={redirecting}>
          {redirecting ? <ActivityIndicator color="#0D9E8A" /> : <Text style={styles.subscribeText}>Subscribe with Stripe</Text>}
        </TouchableOpacity>

        <Text style={styles.testNote}>Test mode: pay with card 4242 4242 4242 4242, any future date and any CVC.</Text>

        <TouchableOpacity style={styles.logOutBtn} onPress={logOut}>
          <Text style={styles.logOutText}>Log out</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#0D9E8A' },
  center: { justifyContent: 'center', alignItems: 'center' },
  container: { flexGrow: 1, justifyContent: 'center', paddingHorizontal: 28, paddingBottom: 32 },
  logo: { fontSize: 34, fontWeight: '800', color: '#fff', textAlign: 'center', marginBottom: 6 },
  title: { fontSize: 17, color: 'rgba(255,255,255,0.9)', textAlign: 'center', marginBottom: 28 },
  card: { backgroundColor: '#fff', borderRadius: 18, padding: 22, marginBottom: 20 },
  price: { fontSize: 34, fontWeight: '800', color: '#1a1a1a', marginBottom: 14 },
  per: { fontSize: 16, fontWeight: '600', color: '#888' },
  feature: { fontSize: 15, color: '#333', marginBottom: 10 },
  cancelNote: { fontSize: 13, color: '#888', marginTop: 4 },
  message: { color: '#fff', fontSize: 14, textAlign: 'center', marginBottom: 14 },
  subscribeBtn: { backgroundColor: '#fff', borderRadius: 12, padding: 16, alignItems: 'center', marginBottom: 12 },
  subscribeText: { color: '#0D9E8A', fontSize: 16, fontWeight: '700' },
  testNote: { color: 'rgba(255,255,255,0.8)', fontSize: 12, textAlign: 'center', marginBottom: 8 },
  logOutBtn: { alignItems: 'center', padding: 12 },
  logOutText: { color: 'rgba(255,255,255,0.9)', fontSize: 15 },
});
