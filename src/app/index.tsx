import { useCallback, useState } from 'react';
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { AddTaskModal, type TaskDraft } from '@/components/AddTaskModal';
import { TaskList } from '@/components/TaskList';
import { useLiveRun } from '@/hooks/useLiveRun';
import { useTasks } from '@/hooks/useTasks';
import { formatDistance, formatDuration } from '@/logic/geo';
import { formatDateForDisplay, today } from '@/logic/dates';
import { calcProgress } from '@/logic/progress';
import { getRunByTaskId } from '@/storage/runsRepo';
import { beginRun } from '@/tracking/runController';
import { colors, radius, spacing, typography } from '@/theme/colors';
import type { Task } from '@/types';

export default function TodayScreen() {
  const router = useRouter();
  const date = today();
  const { tasks, runsByTaskId, loading, error, refresh, addTask, toggleTask, removeTask } =
    useTasks(date);
  const { run: liveRun, elapsed, distanceM } = useLiveRun();
  const [modalVisible, setModalVisible] = useState(false);
  const [starting, setStarting] = useState(false);

  // Повертаємось із трекера — список має показати свіжий результат.
  useFocusEffect(
    useCallback(() => {
      void refresh();
    }, [refresh]),
  );

  const { done, total } = calcProgress(tasks);

  const handleAdd = (draft: TaskDraft) =>
    draft.kind === 'run'
      ? addTask({
          kind: 'run',
          title: draft.title,
          date,
          goalId: null,
          targetDistanceM: draft.targetDistanceM,
        })
      : addTask({ kind: 'task', title: draft.title, date, goalId: null });

  const openRun = async (task: Task) => {
    if (starting) return;

    // Уже біжимо саме цю задачу — просто відкриваємо трекер.
    if (liveRun !== null && liveRun.taskId === task.id) {
      router.push('/run/active');
      return;
    }
    if (liveRun !== null) {
      Alert.alert(
        'Пробіжка вже триває',
        'Спершу заверши поточну — двох одночасно бути не може.',
        [
          { text: 'Ок', style: 'cancel' },
          { text: 'Відкрити', onPress: () => router.push('/run/active') },
        ],
      );
      return;
    }

    const existing = await getRunByTaskId(task.id);
    if (existing?.status === 'finished') {
      router.push(`/run/${existing.id}`);
      return;
    }

    setStarting(true);
    const result = await beginRun({
      taskId: task.id,
      targetDistanceM: task.targetDistanceM,
    });
    setStarting(false);

    if (!result.ok) {
      Alert.alert('Не вийшло почати', result.reason);
      return;
    }
    router.push('/run/active');
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.date}>{formatDateForDisplay(date)}</Text>
        <Text style={styles.counter}>
          {total > 0 ? `Виконано ${done} з ${total}` : 'Постав цілі на день'}
        </Text>
      </View>

      {liveRun !== null ? (
        <Pressable
          style={styles.liveBanner}
          onPress={() => router.push('/run/active')}
          accessibilityRole="button"
          accessibilityLabel="Відкрити активну пробіжку"
        >
          <View style={styles.liveDot} />
          <Text style={styles.liveText}>
            {liveRun.status === 'paused' ? 'Пробіжка на паузі' : 'Пробіжка триває'} ·{' '}
            {formatDistance(distanceM)} · {formatDuration(elapsed)}
          </Text>
        </Pressable>
      ) : null}

      {error ? <Text style={styles.error}>{error}</Text> : null}

      {!loading && (
        <TaskList
          tasks={tasks}
          runsByTaskId={runsByTaskId}
          onToggle={toggleTask}
          onDelete={removeTask}
          onOpenRun={(task) => void openRun(task)}
        />
      )}

      <View style={styles.footer}>
        <Pressable
          style={styles.summaryButton}
          onPress={() => router.push('/summary')}
          accessibilityRole="button"
          accessibilityLabel="Підбити підсумок дня"
        >
          <Text style={styles.summaryButtonText}>Підбити підсумок дня</Text>
        </Pressable>
        <View style={styles.navRow}>
          <Pressable style={styles.navButton} onPress={() => router.push('/stats')}>
            <Text style={styles.navButtonText}>Статистика</Text>
          </Pressable>
          <Pressable style={styles.navButton} onPress={() => router.push('/goals')}>
            <Text style={styles.navButtonText}>Цілі</Text>
          </Pressable>
        </View>
      </View>

      <Pressable
        style={styles.fab}
        onPress={() => setModalVisible(true)}
        accessibilityRole="button"
        accessibilityLabel="Додати задачу або пробіжку"
      >
        <Text style={styles.fabText}>＋</Text>
      </Pressable>

      <AddTaskModal
        visible={modalVisible}
        onClose={() => setModalVisible(false)}
        onSubmit={handleAdd}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
    padding: spacing.md,
  },
  header: { marginBottom: spacing.md },
  date: {
    fontSize: typography.title.fontSize,
    fontWeight: typography.title.fontWeight,
    color: colors.text,
  },
  counter: {
    fontSize: typography.body.fontSize,
    color: colors.textMuted,
    marginTop: spacing.xs,
  },
  liveBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.success,
    padding: spacing.md,
    marginBottom: spacing.sm,
  },
  liveDot: {
    width: 10,
    height: 10,
    borderRadius: radius.full,
    backgroundColor: colors.success,
  },
  liveText: {
    color: colors.text,
    fontSize: typography.caption.fontSize,
    fontVariant: ['tabular-nums'],
  },
  error: { color: colors.danger, marginBottom: spacing.sm },
  footer: {
    position: 'absolute',
    left: spacing.md,
    right: spacing.md,
    bottom: spacing.lg,
    gap: spacing.sm,
  },
  summaryButton: {
    backgroundColor: colors.primary,
    borderRadius: radius.md,
    padding: spacing.md,
    alignItems: 'center',
  },
  summaryButtonText: {
    color: colors.text,
    fontSize: typography.body.fontSize,
    fontWeight: '600',
  },
  navRow: { flexDirection: 'row', gap: spacing.sm },
  navButton: {
    flex: 1,
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    padding: spacing.md,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border,
  },
  navButtonText: {
    color: colors.textMuted,
    fontSize: typography.body.fontSize,
  },
  fab: {
    position: 'absolute',
    right: spacing.lg,
    bottom: 140,
    width: 60,
    height: 60,
    borderRadius: radius.full,
    backgroundColor: colors.success,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 6,
    shadowColor: '#000',
    shadowOpacity: 0.3,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
  },
  fabText: { fontSize: 30, color: colors.background, fontWeight: '700' },
});
