import { memo } from 'react';
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { formatDistance, formatDuration } from '@/logic/geo';
import { elapsedMs } from '@/logic/runMetrics';
import { colors, radius, spacing, typography } from '@/theme/colors';
import type { Run, Task } from '@/types';

type Props = {
  task: Task;
  run: Run | null;
  onToggle: (id: string) => void;
  onDelete: (id: string) => void;
  onOpenRun: (task: Task) => void;
};

function CheckIcon() {
  return (
    <Svg width={16} height={16} viewBox="0 0 24 24">
      <Path
        d="M20 6L9 17l-5-5"
        stroke={colors.background}
        strokeWidth={3}
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
    </Svg>
  );
}

function runSubtitle(task: Task, run: Run | null): string {
  const target =
    task.targetDistanceM === null ? '' : formatDistance(task.targetDistanceM);

  if (run === null) {
    return target.length > 0 ? `Ціль ${target} · тапни, щоб почати` : 'Тапни, щоб почати';
  }
  if (run.status === 'finished') {
    const time = formatDuration(elapsedMs(run, run.endedAt ?? Date.now()));
    return `${formatDistance(run.distanceM)} за ${time}`;
  }
  const label = run.status === 'paused' ? 'на паузі' : 'триває';
  return `${formatDistance(run.distanceM)} · ${label}`;
}

export const TaskItem = memo(function TaskItem({
  task,
  run,
  onToggle,
  onDelete,
  onOpenRun,
}: Props) {
  const isRun = task.kind === 'run';
  const live = run !== null && run.status !== 'finished';

  const confirmDelete = () => {
    Alert.alert(
      isRun ? 'Видалити пробіжку?' : 'Видалити задачу?',
      isRun && run !== null
        ? `${task.title}\nЗаписаний маршрут теж зникне.`
        : task.title,
      [
        { text: 'Скасувати', style: 'cancel' },
        { text: 'Видалити', style: 'destructive', onPress: () => onDelete(task.id) },
      ],
    );
  };

  return (
    <Pressable
      style={({ pressed }) => [
        styles.row,
        live && styles.rowLive,
        pressed && styles.rowPressed,
      ]}
      // Для пробіжки тап відкриває трекер, а не «закриває» задачу:
      // галочку ставить сама пробіжка, коли ціль виконана.
      onPress={() => (isRun ? onOpenRun(task) : onToggle(task.id))}
      onLongPress={confirmDelete}
      delayLongPress={400}
      accessibilityRole={isRun ? 'button' : 'checkbox'}
      accessibilityState={isRun ? { selected: live } : { checked: task.done }}
      accessibilityLabel={task.title}
      accessibilityHint={
        isRun
          ? 'Торкніться, щоб відкрити трекер. Утримуйте, щоб видалити.'
          : 'Торкніться, щоб змінити статус. Утримуйте, щоб видалити.'
      }
    >
      {isRun ? (
        <View style={[styles.badge, task.done && styles.badgeDone]}>
          <Text style={styles.badgeText}>🏃</Text>
        </View>
      ) : (
        <View style={[styles.checkbox, task.done && styles.checkboxDone]}>
          {task.done ? <CheckIcon /> : null}
        </View>
      )}

      <View style={styles.body}>
        <Text
          style={[styles.title, task.done && styles.titleDone]}
          numberOfLines={2}
        >
          {task.title}
        </Text>
        {isRun ? (
          <Text style={[styles.subtitle, live && styles.subtitleLive]}>
            {runSubtitle(task, run)}
          </Text>
        ) : null}
      </View>

      {live ? <View style={styles.pulse} /> : null}
    </Pressable>
  );
});

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    padding: spacing.md,
    marginBottom: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border,
  },
  rowLive: { borderColor: colors.success },
  rowPressed: { backgroundColor: colors.surfaceLight },
  checkbox: {
    width: 26,
    height: 26,
    borderRadius: radius.sm,
    borderWidth: 2,
    borderColor: colors.textMuted,
    marginRight: spacing.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxDone: {
    backgroundColor: colors.success,
    borderColor: colors.success,
  },
  badge: {
    width: 26,
    height: 26,
    borderRadius: radius.sm,
    marginRight: spacing.md,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surfaceLight,
    borderWidth: 2,
    borderColor: colors.border,
  },
  badgeDone: { borderColor: colors.success },
  badgeText: { fontSize: 13 },
  body: { flex: 1 },
  title: { fontSize: typography.body.fontSize, color: colors.text },
  titleDone: {
    color: colors.textMuted,
    textDecorationLine: 'line-through',
  },
  subtitle: {
    fontSize: typography.caption.fontSize,
    color: colors.textMuted,
    marginTop: 2,
  },
  subtitleLive: { color: colors.success },
  pulse: {
    width: 8,
    height: 8,
    borderRadius: radius.full,
    backgroundColor: colors.success,
    marginLeft: spacing.sm,
  },
});
