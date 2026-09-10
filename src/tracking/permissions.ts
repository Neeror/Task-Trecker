import { Alert, Linking, Platform } from 'react-native';
import * as Location from 'expo-location';

export type PermissionFailure =
  | 'services-disabled'
  | 'foreground-denied'
  | 'cancelled';

export type RunPermissionResult =
  | { ok: true; background: boolean }
  | { ok: false; reason: PermissionFailure };

function confirm(title: string, message: string, confirmText: string): Promise<boolean> {
  return new Promise((resolve) => {
    Alert.alert(title, message, [
      { text: 'Не зараз', style: 'cancel', onPress: () => resolve(false) },
      { text: confirmText, onPress: () => resolve(true) },
    ]);
  });
}

/**
 * Google Play вимагає показати ПОЯСНЕННЯ до системного запиту фонової
 * геолокації (Android 10+, суворо з 14). Тому спершу наш діалог, потім ОС.
 */
export async function ensureRunPermissions(): Promise<RunPermissionResult> {
  if (!(await Location.hasServicesEnabledAsync())) {
    Alert.alert(
      'Геолокація вимкнена',
      'Увімкни GPS у налаштуваннях — інтернет не потрібен, лише геолокація.',
      [
        { text: 'Скасувати', style: 'cancel' },
        { text: 'Налаштування', onPress: () => void Linking.openSettings() },
      ],
    );
    return { ok: false, reason: 'services-disabled' };
  }

  const foreground = await Location.requestForegroundPermissionsAsync();
  if (foreground.status !== 'granted') {
    return { ok: false, reason: 'foreground-denied' };
  }

  const alreadyBackground = await Location.getBackgroundPermissionsAsync();
  if (alreadyBackground.status === 'granted') return { ok: true, background: true };

  const wants = await confirm(
    'Записувати з вимкненим екраном?',
    Platform.OS === 'android'
      ? 'Щоб трек не рвався, коли екран згас або ти згорнув апку, потрібен доступ «Завжди». Дані нікуди не йдуть — усе лишається на телефоні.'
      : 'Щоб трек не рвався, коли екран згас, обери «Завжди». Дані нікуди не йдуть — усе лишається на телефоні.',
    'Дозволити',
  );
  if (!wants) return { ok: true, background: false };

  const background = await Location.requestBackgroundPermissionsAsync();
  return { ok: true, background: background.status === 'granted' };
}

/** Чи дозволено писати трек із згаслим екраном. Потрібно для попередження на екрані пробіжки. */
export async function hasBackgroundPermission(): Promise<boolean> {
  try {
    const status = await Location.getBackgroundPermissionsAsync();
    return status.status === 'granted';
  } catch {
    return false;
  }
}
