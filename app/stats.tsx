import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { GoalDetailModal } from '@/components/GoalDetailModal';
import { ProgressCircle } from '@/components/ProgressCircle';
import { StatsCard } from '@/components/StatsCard';
import { usePeriodProgress } from '@/hooks/useProgress';
import { currentMonthKey, currentYearKey } from '@/logic/dates';
import type { GoalProgressResult } from '@/logic/progress';
import { colors, percentColor, radius, spacing, typography } from '@/theme/colors';
import type { Goal, GoalPeriod } from '@/types';

const STATUS_LABELS: Record<GoalProgressResult['status'], string> = {
  underachieved: 'недовиконано',
  achieved: 'виконано',
  overachieved: 'перевиконано',
};

function goalMetaText(g: GoalProgressResult): string {
  if (g.source === 'steps') {
    return `${g.done} з ${g.target} підцілей · ${STATUS_LABELS[g.status]}`;
  }
  if (g.source === 'manual') {
    return `оцінка вручну · ${STATUS_LABELS[g.status]}`;
  }
  return `${g.done} з ${g.target} · ${STATUS_LABELS[g.status]}`;
}

export default function StatsScreen() {
  const [period, setPeriod] = useState<GoalPeriod>('month');
  const [selectedGoal, setSelectedGoal] = useState<Goal | null>(null);
  const periodKey = period === 'month' ? currentMonthKey() : currentYearKey();
  const { progress, avgDailyPercent, goals, loading, error, refresh } =
    usePeriodProgress(period, periodKey);


  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
    >
      <View style={styles.switcher}>
        {(['month', 'year'] as const).map((p) => (
          <Pressable
            key={p}
            style={[styles.switchButton, period === p && styles.switchButtonActive]}
            onPress={() => setPeriod(p)}
            accessibilityRole="button"
            accessibilityState={{ selected: period === p }}
          >
            <Text
              style={[
                styles.switchText,
                period === p && styles.switchTextActive,
              ]}
            >
              {p === 'month' ? 'Місяць' : 'Рік'}
            </Text>
          </Pressable>
        ))}
      </View>

      {error ? <Text style={styles.error}>{error}</Text> : null}

      {!loading && (
        <>
          <View style={styles.circleWrapper}>
            <ProgressCircle
              percent={progress.percent}
              label={period === 'month' ? 'задач за місяць' : 'задач за рік'}
            />
          </View>

          <View style={styles.cardsRow}>
            <StatsCard
              label="Виконано задач"
              value={`${progress.done} з ${progress.total}`}
            />
            <StatsCard
              label="Середній день"
              value={`${avgDailyPercent}%`}
              percent={avgDailyPercent}
              hint="за закритими днями"
            />
          </View>

          <Text style={styles.sectionTitle}>Глобальні цілі</Text>
          {goals.length === 0 ? (
            <Text style={styles.emptyText}>
              Цілей на цей період немає. Додай їх на екрані «Цілі».
            </Text>
          ) : (
          goals.map((g) => (
              <Pressable
                key={g.goal.id}
                style={styles.goalRow}
                onPress={() => setSelectedGoal(g.goal)}
                accessibilityRole="button"
                accessibilityLabel={g.goal.title}
                accessibilityHint="Натисніть, щоб керувати прогресом цілі."
              >
                <View style={styles.goalInfo}>
                  <Text style={styles.goalTitle} numberOfLines={1}>
                    {g.goal.title}
                  </Text>
                  <Text style={styles.goalMeta}>{goalMetaText(g)}</Text>
                </View>
                <Text
                  style={[styles.goalPercent, { color: percentColor(Math.min(g.percent, 100)) }]}
                >
                  {g.percent}%
                </Text>
              </Pressable>
            ))
          )}
        </>
      )}

      <GoalDetailModal
        goal={selectedGoal}
        visible={selectedGoal !== null}
        onClose={() => setSelectedGoal(null)}
        onChanged={() => void refresh()}
      />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: 'transparent',
  },
  content: {
    padding: spacing.md,
    paddingBottom: spacing.xl,
    gap: spacing.md,
  },
  switcher: {
    flexDirection: 'row',
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    padding: spacing.xs,
    borderWidth: 1,
    borderColor: colors.border,
  },
  switchButton: {
    flex: 1,
    paddingVertical: spacing.sm,
    alignItems: 'center',
    borderRadius: radius.sm,
  },
  switchButtonActive: {
    backgroundColor: colors.primary,
  },
  switchText: {
    color: colors.textMuted,
    fontSize: typography.body.fontSize,
  },
  switchTextActive: {
    color: colors.text,
    fontWeight: '600',
  },
  circleWrapper: {
    alignItems: 'center',
    paddingVertical: spacing.md,
  },
  cardsRow: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  sectionTitle: {
    fontSize: typography.heading.fontSize,
    fontWeight: typography.heading.fontWeight,
    color: colors.text,
    marginTop: spacing.sm,
  },
  emptyText: {
    color: colors.textMuted,
    fontSize: typography.body.fontSize,
  },
  goalRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  goalInfo: {
    flex: 1,
    marginRight: spacing.sm,
  },
  goalTitle: {
    color: colors.text,
    fontSize: typography.body.fontSize,
  },
  goalMeta: {
    color: colors.textMuted,
    fontSize: typography.caption.fontSize,
    marginTop: 2,
  },
  goalPercent: {
    fontSize: typography.heading.fontSize,
    fontWeight: '700',
  },
    error: {
    color: colors.danger,
    fontSize: typography.body.fontSize,
  },

});
