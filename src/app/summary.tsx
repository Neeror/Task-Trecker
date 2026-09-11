import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { ProgressCircle } from '@/components/ProgressCircle';
import { formatDateForDisplay, today } from '@/logic/dates';
import { closeDay } from '@/storage/summariesRepo';
import { colors, spacing, typography } from '@/theme/colors';
import type { DailySummary } from '@/types';

export default function SummaryScreen() {
  const [summary, setSummary] = useState<DailySummary | null>(null);
  const [error, setError] = useState<string | null>(null);
  const mountedRef = useRef(true);

  const runCloseDay = useCallback(async () => {
    try {
      const result = await closeDay(today());
      if (mountedRef.current) setSummary(result);
    } catch (e) {
      if (mountedRef.current) setError('Не вдалося підбити підсумок дня');
      if (__DEV__) console.error('[summary] closeDay:', e);
    }
  }, []);

  useEffect(() => {
    mountedRef.current = true;
    void runCloseDay();
    return () => {
      mountedRef.current = false;
    };
  }, [runCloseDay]);

  if (error) {
    return (
      <View style={styles.container}>
        <Text style={styles.error}>{error}</Text>
      </View>
    );
  }

  if (!summary) {
    return (
      <View style={styles.container}>
        <ActivityIndicator color={colors.primary} size="large" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Text style={styles.date}>{formatDateForDisplay(summary.date)}</Text>
      <ProgressCircle percent={summary.percent} label="виконано за день" />
      <Text style={styles.details}>
        {summary.totalTasks > 0
          ? `Виконано ${summary.doneTasks} з ${summary.totalTasks} задач`
          : 'Сьогодні задач не було'}
      </Text>
      <Text style={styles.hint}>
        {summary.percent >= 80
          ? 'Потужний день! Так тримати 💪'
          : summary.percent >= 50
            ? 'Непогано, але є куди рости'
            : 'Завтра буде кращий день'}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.lg,
    gap: spacing.lg,
  },
  date: {
    fontSize: typography.heading.fontSize,
    fontWeight: typography.heading.fontWeight,
    color: colors.text,
  },
  details: {
    fontSize: typography.body.fontSize,
    color: colors.text,
  },
  hint: {
    fontSize: typography.caption.fontSize,
    color: colors.textMuted,
  },
  error: {
    color: colors.danger,
    fontSize: typography.body.fontSize,
  },
});
