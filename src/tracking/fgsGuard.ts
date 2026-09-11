import AsyncStorage from '@react-native-async-storage/async-storage';

/**
 * Запобіжник проти петлі крахів на Android 14+.
 *
 * expo-location промотує сервіс у foreground асинхронно (Service.startForeground
 * викликається з onServiceConnected). Якщо ОС відхиляє промоцію, SecurityException
 * летить на main looper ПІСЛЯ того, як проміс startLocationUpdatesAsync уже
 * зарезолвився — з JS його не зловити, процес просто вмирає.
 *
 * Тому ловимо це не винятком, а фактом: ставимо прапорець перед спробою і
 * знімаємо його через SETTLE_MS. Прапорець, який дожив до наступного запуску
 * апки, означає рівно одне: минула спроба вбила процес. Далі пишемо трек
 * без foreground service.
 */

const PENDING_KEY = 'tracking:fgsPending';
const BLOCKED_KEY = 'tracking:fgsBlocked';

/** Стільки живий процес доводить, що FGS піднявся нормально. */
const SETTLE_MS = 10_000;

let cached: boolean | null = null;
let settleTimer: ReturnType<typeof setTimeout> | null = null;

/** Чи заборонено пробувати foreground service у цій інсталяції. */
export async function isForegroundServiceBlocked(): Promise<boolean> {
  if (cached !== null) return cached;

  try {
    const [blocked, pending] = await Promise.all([
      AsyncStorage.getItem(BLOCKED_KEY),
      AsyncStorage.getItem(PENDING_KEY),
    ]);

    if (blocked === '1') {
      cached = true;
      return cached;
    }

    // Прапорець із минулої сесії — процес не дожив до settle.
    if (pending === '1') {
      await AsyncStorage.multiSet([
        [BLOCKED_KEY, '1'],
        [PENDING_KEY, '0'],
      ]);
      cached = true;
      return cached;
    }

    cached = false;
    return cached;
  } catch {
    // Сховище недоступне — не блокуємо, але й не кешуємо рішення.
    return false;
  }
}

export async function markForegroundServiceAttempt(): Promise<void> {
  try {
    await AsyncStorage.setItem(PENDING_KEY, '1');
  } catch {
    /* не критично: у гіршому разі втратимо один запобіжник */
  }

  if (settleTimer !== null) clearTimeout(settleTimer);
  settleTimer = setTimeout(() => {
    settleTimer = null;
    void AsyncStorage.setItem(PENDING_KEY, '0').catch(() => undefined);
  }, SETTLE_MS);
}

/**
 * Знімає заборону. Варто викликати з налаштувань («Спробувати запис у фоні
 * знову») або після того, як юзер щойно видав дозвіл «Завжди».
 */
export async function resetForegroundServiceBlock(): Promise<void> {
  cached = false;
  try {
    await AsyncStorage.multiSet([
      [BLOCKED_KEY, '0'],
      [PENDING_KEY, '0'],
    ]);
  } catch {
    /* ignore */
  }
}
