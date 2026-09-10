import { FlatList, StyleSheet, Text, View } from 'react-native';
import { TaskItem } from '@/components/TaskItem';
import { colors, spacing, typography } from '@/theme/colors';
import type { Run, Task } from '@/types';

type Props = {
  tasks: readonly Task[];
  runsByTaskId: ReadonlyMap<string, Run>;
  onToggle: (id: string) => void;
  onDelete: (id: string) => void;
  onOpenRun: (task: Task) => void;
};

export function TaskList({
  tasks,
  runsByTaskId,
  onToggle,
  onDelete,
  onOpenRun,
}: Props) {
  if (tasks.length === 0) {
    return (
      <View style={styles.empty}>
        <Text style={styles.emptyTitle}>Задач поки немає</Text>
        <Text style={styles.emptyHint}>
          Додай першу ціль або пробіжку кнопкою «+»
        </Text>
      </View>
    );
  }

  return (
    <FlatList
      data={tasks as Task[]}
      keyExtractor={(item) => item.id}
      renderItem={({ item }) => (
        <TaskItem
          task={item}
          run={runsByTaskId.get(item.id) ?? null}
          onToggle={onToggle}
          onDelete={onDelete}
          onOpenRun={onOpenRun}
        />
      )}
      contentContainerStyle={styles.list}
      showsVerticalScrollIndicator={false}
    />
  );
}

const styles = StyleSheet.create({
  list: { paddingBottom: spacing.xl * 3 },
  empty: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.xl,
  },
  emptyTitle: {
    fontSize: typography.heading.fontSize,
    fontWeight: typography.heading.fontWeight,
    color: colors.text,
    marginBottom: spacing.sm,
  },
  emptyHint: {
    fontSize: typography.body.fontSize,
    color: colors.textMuted,
    textAlign: 'center',
  },
});
