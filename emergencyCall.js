import { Linking, Platform } from 'react-native';
import * as IntentLauncher from 'expo-intent-launcher';

// Keep digits and a leading '+' only, so a number typed with spaces/dashes still dials.
export const sanitizeNumber = (raw) => {
  const str = String(raw ?? '').trim();
  const plus = str.startsWith('+') ? '+' : '';
  return plus + str.replace(/\D/g, '');
};

// Places the emergency call.
// Android with CALL_PHONE permission (dev/EAS build): dials directly, no tap needed.
// Android without the permission (Expo Go) and iOS: opens the dialer pre-filled.
// Resolves to 'direct' or 'dialer' so the caller can log which one happened.
export const placeEmergencyCall = async (rawNumber) => {
  const number = sanitizeNumber(rawNumber);
  if (!number) throw new Error('No emergency number configured');
  const url = `tel:${number}`;

  if (Platform.OS === 'android') {
    try {
      await IntentLauncher.startActivityAsync('android.intent.action.CALL', { data: url });
      return 'direct';
    } catch (err) {
      // SecurityException when CALL_PHONE isn't granted (e.g. Expo Go) -> fall back to the dialer.
      console.log('Direct call unavailable, opening dialer: ', err?.message);
    }
  }

  await Linking.openURL(url);
  return 'dialer';
};
