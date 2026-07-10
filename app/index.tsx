import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { AddTaskModal } from '@/components/AddTaskModal';
import { BackgroundSettingsModal } from '@/components/BackgroundSettingsModal';
import { TaskList } from '@/components/TaskList';
import { useTasks } from '@/hooks/useTasks';
import { formatDateForDisplay, today } from '@/logic/dates';
import { calcProgress } from '@/logic/progress';
import { colors, radius, spacing, typography } from '@/theme/colors';

export default function TodayScreen() {
  const router = useRouter();
  const date = today();
  const { tasks, loading, error, addTask, toggleTask, removeTask } = useTasks(date);
  const [modalVisible, setModalVisible] = useState(false);
  const [bgModalVisible, setBgModalVisible] = useState(false);

  const { done, total } = calcProgress(tasks);

  const handleAdd = (title: string) => addTask({ title, date, goalId: null });

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View style={styles.headerRow}>
          <Text style={styles.date}>{formatDateForDisplay(date)}</Text>
          <Pressable
            style={styles.bgButton}
            onPress={() => setBgModalVisible(true)}
            accessibilityRole="button"
            accessibilityLabel="Налаштувати фон застосунку"
          >
            <Text style={styles.bgButtonText}>Фон</Text>
          </Pressable>
        </View>
        <Text style={styles.counter}>
          {total > 0 ? `Виконано ${done} з ${total}` : 'Постав цілі на день'}
        </Text>
      </View>

      {error ? <Text style={styles.error}>{error}</Text> : null}

      {!loading && (
        <TaskList tasks={tasks} onToggle={toggleTask} onDelete={removeTask} />
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
        accessibilityLabel="Додати задачу"
      >
        <Text style={styles.fabText}>＋</Text>
      </Pressable>

      <AddTaskModal
        visible={modalVisible}
        onClose={() => setModalVisible(false)}
        onSubmit={handleAdd}
      />

      <BackgroundSettingsModal
        visible={bgModalVisible}
        onClose={() => setBgModalVisible(false)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: 'transparent',
    padding: spacing.md,
  },
  header: {
    marginBottom: spacing.md,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  bgButton: {
    backgroundColor: colors.surface,
    borderRadius: radius.sm,
    paddingVertical: spacing.xs + 2,
    paddingHorizontal: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  bgButtonText: {
    color: colors.textMuted,
    fontSize: typography.caption.fontSize,
  },
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
  error: {
    color: colors.danger,
    marginBottom: spacing.sm,
  },
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
  navRow: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
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
  fabText: {
    fontSize: 30,
    color: colors.background,
    fontWeight: '700',
  },
});
