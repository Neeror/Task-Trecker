import { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  AppState,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useKeepAwake } from 'expo-keep-awake';
import { useRouter } from 'expo-router';
import { RouteSvg } from '@/components/RouteSvg';
import { useLiveRun } from '@/hooks/useLiveRun';
import { formatDistance, formatDuration, formatPace } from '@/logic/geo';
import {
  finishCurrentRun,
  pauseCurrentRun,
  resumeCurrentRun,
  syncTracking,
} from '@/tracking/runController';
import { hasBackgroundPermission } from '@/tracking/permissions';
import { colors, radius, spacing, typography } from '@/theme/colors';

export default function ActiveRunScreen() {
  const router = useRouter();
  useKeepAwake();

  const { run, points, loading, elapsed, pace, distanceM, remaining, goalMet } =
    useLiveRun();
  const [busy, setBusy] = useState(false);
  const [backgroundOk, setBackgroundOk] = useState(true);
  const leftRef = useRef(false);

  // ОС могла прибити foreground service, поки апка була у фоні.
  // Джерело істини — БД, тому просто зводимо GPS до її стану.
  useEffect(() => {
    void syncTracking();
    void hasBackgroundPermission().then(setBackgroundOk);
    const subscription = AppState.addEventListener('change', (next) => {
      if (next === 'active') void syncTracking();
    });
    return () => subscription.remove();
  }, []);

  // Пробіжки більше немає (завершили з іншого місця) — не тримаємо мертвий екран.
  useEffect(() => {
    if (!loading && run === null && !leftRef.current) {
      leftRef.current = true;
      router.replace('/');
    }
  }, [loading, run, router]);

  if (loading || run === null) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

  const paused = run.status === 'paused';

  const handlePauseToggle = async () => {
    setBusy(true);
    if (paused) await resumeCurrentRun(run.id);
    else await pauseCurrentRun(run.id);
    setBusy(false);
  };

  const handleFinish = () => {
    Alert.alert(
      'Завершити пробіжку?',
      `${formatDistance(distanceM)} за ${formatDuration(elapsed)}`,
      [
        { text: 'Продовжити біг', style: 'cancel' },
        {
          text: 'Завершити',
          style: 'destructive',
          onPress: () => {
            void (async () => {
              setBusy(true);
              const { run: finished, taskCompleted } = await finishCurrentRun(run.id);
              setBusy(false);
              leftRef.current = true;
              if (finished === null) {
                router.replace('/');
                return;
              }
              if (taskCompleted) {
                Alert.alert('Ціль виконана', 'Задачу закрито автоматично 💪');
              }
              router.replace(`/run/${finished.id}`);
            })();
          },
        },
      ],
    );
  };

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
    >
      {!backgroundOk ? (
        <Text style={styles.warning}>
          Дозволу на фонову геолокацію немає — не гаси екран, інакше трек порветься.
        </Text>
      ) : null}

      <View style={styles.hero}>
        <Text style={styles.distance}>{formatDistance(distanceM)}</Text>
        <Text style={styles.subline}>
          {run.targetDistanceM === null
            ? 'вільна пробіжка'
            : goalMet
              ? 'ціль виконана 🎉'
              : `лишилось ${formatDistance(remaining)}`}
        </Text>
      </View>

      <View style={styles.metricsRow}>
        <View style={styles.metric}>
          <Text style={styles.metricLabel}>Час</Text>
          <Text style={styles.metricValue}>{formatDuration(elapsed)}</Text>
        </View>
        <View style={styles.metric}>
          <Text style={styles.metricLabel}>Темп</Text>
          <Text style={styles.metricValue}>{formatPace(pace)}</Text>
        </View>
        <View style={styles.metric}>
          <Text style={styles.metricLabel}>У руху</Text>
          <Text style={styles.metricValue}>{formatDuration(run.movingMs)}</Text>
        </View>
      </View>

      <RouteSvg
        points={points}
        height={260}
        emptyHint={
          paused
            ? 'Пауза. GPS вимкнено, щоб не садити батарею.'
            : 'Ловимо сигнал GPS… Перші точки з’являться за кілька секунд.'
        }
      />

      <Text style={styles.pointsHint}>
        {points.length} точок збережено локально · інтернет не потрібен
      </Text>

      <View style={styles.actions}>
        <Pressable
          style={[styles.buttonSecondary, busy && styles.disabled]}
          onPress={() => void handlePauseToggle()}
          disabled={busy}
          accessibilityRole="button"
        >
          <Text style={styles.buttonSecondaryText}>
            {paused ? 'Продовжити' : 'Пауза'}
          </Text>
        </Pressable>
        <Pressable
          style={[styles.buttonFinish, busy && styles.disabled]}
          onPress={handleFinish}
          disabled={busy}
          accessibilityRole="button"
        >
          <Text style={styles.buttonFinishText}>Фініш</Text>
        </Pressable>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  center: {
    flex: 1,
    backgroundColor: colors.background,
    alignItems: 'center',
    justifyContent: 'center',
  },
  content: { padding: spacing.md, gap: spacing.md, paddingBottom: spacing.xl },
  warning: {
    color: colors.warning,
    fontSize: typography.caption.fontSize,
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.warning,
    padding: spacing.sm,
  },
  hero: { alignItems: 'center', paddingVertical: spacing.md },
  distance: {
    color: colors.text,
    fontSize: 56,
    fontWeight: '800',
    fontVariant: ['tabular-nums'],
  },
  subline: {
    color: colors.textMuted,
    fontSize: typography.body.fontSize,
    marginTop: spacing.xs,
  },
  metricsRow: { flexDirection: 'row', gap: spacing.sm },
  metric: {
    flex: 1,
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    alignItems: 'center',
  },
  metricLabel: {
    color: colors.textMuted,
    fontSize: typography.caption.fontSize,
  },
  metricValue: {
    color: colors.text,
    fontSize: typography.heading.fontSize,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
    marginTop: 2,
  },
  pointsHint: {
    color: colors.textMuted,
    fontSize: typography.caption.fontSize,
    textAlign: 'center',
  },
  actions: { flexDirection: 'row', gap: spacing.sm },
  buttonSecondary: {
    flex: 1,
    backgroundColor: colors.surfaceLight,
    borderRadius: radius.md,
    padding: spacing.md,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border,
  },
  buttonSecondaryText: {
    color: colors.text,
    fontSize: typography.body.fontSize,
    fontWeight: '600',
  },
  buttonFinish: {
    flex: 1,
    backgroundColor: colors.danger,
    borderRadius: radius.md,
    padding: spacing.md,
    alignItems: 'center',
  },
  buttonFinishText: {
    color: colors.text,
    fontSize: typography.body.fontSize,
    fontWeight: '700',
  },
  disabled: { opacity: 0.6 },
});
