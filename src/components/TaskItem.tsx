import { memo } from 'react';
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { colors, radius, spacing, typography } from '@/theme/colors';
import type { Task } from '@/types';

type Props = {
  task: Task;
  onToggle: (id: string) => void;
  onDelete: (id: string) => void;
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

export const TaskItem = memo(function TaskItem({ task, onToggle, onDelete }: Props) {
  const confirmDelete = () => {
    Alert.alert('Видалити задачу?', task.title, [
      { text: 'Скасувати', style: 'cancel' },
      { text: 'Видалити', style: 'destructive', onPress: () => onDelete(task.id) },
    ]);
  };

  return (
    <Pressable
      style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}
      onPress={() => onToggle(task.id)}
      onLongPress={confirmDelete}
      delayLongPress={400}
      accessibilityRole="checkbox"
      accessibilityState={{ checked: task.done }}
      accessibilityLabel={task.title}
      accessibilityHint="Торкніться, щоб змінити статус. Утримуйте, щоб видалити."
    >
      <View style={[styles.checkbox, task.done && styles.checkboxDone]}>
        {task.done ? <CheckIcon /> : null}
      </View>
      <Text
        style={[styles.title, task.done && styles.titleDone]}
        numberOfLines={2}
      >
        {task.title}
      </Text>
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
  rowPressed: {
    backgroundColor: colors.surfaceLight,
  },
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
  title: {
    flex: 1,
    fontSize: typography.body.fontSize,
    color: colors.text,
  },
  titleDone: {
    color: colors.textMuted,
    textDecorationLine: 'line-through',
  },
});
