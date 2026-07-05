import { useCallback, useEffect, useState } from 'react';
import {
  Alert,
  FlatList,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { setGoalManualPercent } from '@/storage/goalsRepo';
import {
  createGoalStep,
  deleteGoalStep,
  getStepsByGoal,
  setGoalStepDone,
} from '@/storage/goalStepsRepo';
import { colors, percentColor, radius, spacing, typography } from '@/theme/colors';
import { UserTextSchema, type Goal, type GoalStep } from '@/types';

type Props = {
  goal: Goal | null;
  visible: boolean;
  onClose: () => void;
  /** Викликається після будь-якої зміни (підціль/відсоток), щоб батько оновив дані */
  onChanged: () => void;
};

const QUICK_PERCENTS = [0, 25, 50, 75, 100] as const;

export function GoalDetailModal({ goal, visible, onClose, onChanged }: Props) {
  const [steps, setSteps] = useState<GoalStep[]>([]);
  const [newStepTitle, setNewStepTitle] = useState('');
  const [manualInput, setManualInput] = useState('');
  const [manualPercent, setManualPercent] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const goalId = goal?.id ?? null;

  const loadSteps = useCallback(async () => {
    if (!goalId) return;
    try {
      const list = await getStepsByGoal(goalId);
      setSteps(list);
    } catch (e) {
      setError('Не вдалося завантажити підцілі');
      if (__DEV__) console.error('[GoalDetailModal] loadSteps:', e);
    }
  }, [goalId]);

  useEffect(() => {
    if (visible && goal) {
      setError(null);
      setNewStepTitle('');
      setManualPercent(goal.manualPercent);
      setManualInput(goal.manualPercent !== null ? String(goal.manualPercent) : '');
      void loadSteps();
    }
    // Скидаємо стан лише при відкритті модалки або зміні цілі (за id),
    // а не при кожному оновленні об'єкта goal після refresh батька.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible, goalId, loadSteps]);

  if (!goal) return null;

  const doneCount = steps.filter((s) => s.done).length;
  const stepsPercent =
    steps.length > 0 ? Math.round((doneCount / steps.length) * 100) : 0;
  const displayPercent = steps.length > 0 ? stepsPercent : (manualPercent ?? 0);

  const handleAddStep = async () => {
    const parsed = UserTextSchema.safeParse(newStepTitle);
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? 'Некоректна назва');
      return;
    }
    setLoading(true);
    try {
      await createGoalStep({ goalId: goal.id, title: parsed.data });
      setNewStepTitle('');
      setError(null);
      await loadSteps();
      onChanged();
    } catch (e) {
      setError('Не вдалося додати підціль');
      if (__DEV__) console.error('[GoalDetailModal] addStep:', e);
    } finally {
      setLoading(false);
    }
  };

  const handleToggleStep = async (step: GoalStep) => {
    try {
      const ok = await setGoalStepDone(step.id, !step.done);
      if (ok) {
        setSteps((prev) =>
          prev.map((s) => (s.id === step.id ? { ...s, done: !s.done } : s)),
        );
        onChanged();
      }
    } catch (e) {
      if (__DEV__) console.error('[GoalDetailModal] toggleStep:', e);
    }
  };

  const confirmDeleteStep = (step: GoalStep) => {
    Alert.alert('Видалити підціль?', step.title, [
      { text: 'Скасувати', style: 'cancel' },
      {
        text: 'Видалити',
        style: 'destructive',
        onPress: async () => {
          const ok = await deleteGoalStep(step.id).catch(() => false);
          if (ok) {
            await loadSteps();
            onChanged();
          }
        },
      },
    ]);
  };

  const applyManualPercent = async (value: number) => {
    if (!Number.isInteger(value) || value < 0 || value > 100) {
      setError('Відсоток має бути від 0 до 100');
      return;
    }
    try {
      const ok = await setGoalManualPercent(goal.id, value);
      if (ok) {
        setManualPercent(value);
        setManualInput(String(value));
        setError(null);
        onChanged();
      }
    } catch (e) {
      setError('Не вдалося зберегти відсоток');
      if (__DEV__) console.error('[GoalDetailModal] manualPercent:', e);
    }
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <KeyboardAvoidingView
        style={styles.overlay}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
        <View style={styles.card}>
          {/* Заголовок цілі + поточний прогрес */}
          <View style={styles.header}>
            <View style={styles.headerInfo}>
              <Text style={styles.title} numberOfLines={2}>
                {goal.title}
              </Text>
              <Text style={styles.meta}>
                {goal.period === 'month' ? 'Ціль на місяць' : 'Ціль на рік'} ·{' '}
                {goal.periodKey}
              </Text>
            </View>
            <Text
              style={[styles.percent, { color: percentColor(displayPercent) }]}
            >
              {displayPercent}%
            </Text>
          </View>

          {/* Підцілі */}
          <Text style={styles.sectionTitle}>
            Підцілі{steps.length > 0 ? ` (${doneCount} з ${steps.length})` : ''}
          </Text>

          <FlatList
            data={steps}
            keyExtractor={(item) => item.id}
            style={styles.stepList}
            keyboardShouldPersistTaps="handled"
            ListEmptyComponent={
              <Text style={styles.emptyText}>
                Додай підцілі — і прогрес рахуватиметься автоматично за
                виконаними пунктами.
              </Text>
            }
            renderItem={({ item }) => (
              <Pressable
                style={styles.stepRow}
                onPress={() => handleToggleStep(item)}
                onLongPress={() => confirmDeleteStep(item)}
                delayLongPress={400}
                accessibilityRole="checkbox"
                accessibilityState={{ checked: item.done }}
                accessibilityLabel={item.title}
                accessibilityHint="Натисніть, щоб змінити статус. Утримуйте, щоб видалити."
              >
                <View style={[styles.checkbox, item.done && styles.checkboxDone]}>
                  {item.done ? <Text style={styles.checkmark}>✓</Text> : null}
                </View>
                <Text
                  style={[styles.stepTitle, item.done && styles.stepTitleDone]}
                  numberOfLines={2}
                >
                  {item.title}
                </Text>
              </Pressable>
            )}
          />

          {/* Додавання підцілі */}
          <View style={styles.addRow}>
            <TextInput
              style={styles.input}
              placeholder="Нова підціль…"
              placeholderTextColor={colors.textMuted}
              value={newStepTitle}
              onChangeText={(text) => {
                setNewStepTitle(text);
                if (error) setError(null);
              }}
              maxLength={200}
              returnKeyType="done"
              onSubmitEditing={handleAddStep}
            />
            <Pressable
              style={[styles.addButton, loading && styles.disabled]}
              onPress={handleAddStep}
              disabled={loading}
              accessibilityRole="button"
              accessibilityLabel="Додати підціль"
            >
              <Text style={styles.addButtonText}>＋</Text>
            </Pressable>
          </View>

          {/* Ручний відсоток — тільки коли немає підцілей */}
          {steps.length === 0 ? (
            <View style={styles.manualSection}>
              <Text style={styles.sectionTitle}>Або постав прогрес вручну</Text>
              <View style={styles.quickRow}>
                {QUICK_PERCENTS.map((p) => (
                  <Pressable
                    key={p}
                    style={[
                      styles.quickChip,
                      manualPercent === p && styles.quickChipActive,
                    ]}
                    onPress={() => void applyManualPercent(p)}
                    accessibilityRole="button"
                    accessibilityState={{ selected: manualPercent === p }}
                  >
                    <Text
                      style={[
                        styles.quickChipText,
                        manualPercent === p && styles.quickChipTextActive,
                      ]}
                    >
                      {p}%
                    </Text>
                  </Pressable>
                ))}
              </View>
              <View style={styles.manualRow}>
                <TextInput
                  style={[styles.input, styles.manualInput]}
                  placeholder="0–100"
                  placeholderTextColor={colors.textMuted}
                  value={manualInput}
                  onChangeText={(text) => {
                    setManualInput(text.replace(/[^0-9]/g, '').slice(0, 3));
                    if (error) setError(null);
                  }}
                  keyboardType="number-pad"
                  maxLength={3}
                />
                <Pressable
                  style={styles.saveButton}
                  onPress={() => void applyManualPercent(Number(manualInput))}
                  accessibilityRole="button"
                  accessibilityLabel="Зберегти відсоток"
                >
                  <Text style={styles.saveButtonText}>Зберегти</Text>
                </Pressable>
              </View>
            </View>
          ) : (
            <Text style={styles.hint}>
              Прогрес рахується за підцілями. Видали всі підцілі, щоб ставити
              відсоток вручну.
            </Text>
          )}

          {error ? <Text style={styles.error}>{error}</Text> : null}

          <Pressable
            style={styles.closeButton}
            onPress={onClose}
            accessibilityRole="button"
            accessibilityLabel="Закрити"
          >
            <Text style={styles.closeButtonText}>Готово</Text>
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: colors.overlay,
    justifyContent: 'flex-end',
  },
  card: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: radius.lg,
    borderTopRightRadius: radius.lg,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: colors.border,
    maxHeight: '85%',
    gap: spacing.sm,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  headerInfo: {
    flex: 1,
  },
  title: {
    fontSize: typography.heading.fontSize,
    fontWeight: typography.heading.fontWeight,
    color: colors.text,
  },
  meta: {
    color: colors.textMuted,
    fontSize: typography.caption.fontSize,
    marginTop: spacing.xs,
  },
  percent: {
    fontSize: 32,
    fontWeight: '800',
  },
  sectionTitle: {
    color: colors.text,
    fontSize: typography.body.fontSize,
    fontWeight: '600',
    marginTop: spacing.xs,
  },
  stepList: {
    maxHeight: 260,
    flexGrow: 0,
  },
  emptyText: {
    color: colors.textMuted,
    fontSize: typography.caption.fontSize,
    paddingVertical: spacing.sm,
  },
  stepRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: radius.sm,
    borderWidth: 2,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxDone: {
    backgroundColor: colors.success,
    borderColor: colors.success,
  },
  checkmark: {
    color: colors.background,
    fontWeight: '700',
    fontSize: 14,
  },
  stepTitle: {
    flex: 1,
    color: colors.text,
    fontSize: typography.body.fontSize,
  },
  stepTitleDone: {
    color: colors.textMuted,
    textDecorationLine: 'line-through',
  },
  addRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    alignItems: 'center',
  },
  input: {
    flex: 1,
    backgroundColor: colors.surfaceLight,
    borderRadius: radius.md,
    padding: spacing.md,
    fontSize: typography.body.fontSize,
    color: colors.text,
    borderWidth: 1,
    borderColor: colors.border,
  },
  addButton: {
    width: 48,
    height: 48,
    borderRadius: radius.md,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  addButtonText: {
    color: colors.text,
    fontSize: 24,
    fontWeight: '700',
  },
  disabled: {
    opacity: 0.6,
  },
  manualSection: {
    gap: spacing.sm,
  },
  quickRow: {
    flexDirection: 'row',
    gap: spacing.xs,
  },
  quickChip: {
    flex: 1,
    paddingVertical: spacing.sm,
    alignItems: 'center',
    borderRadius: radius.sm,
    backgroundColor: colors.surfaceLight,
    borderWidth: 1,
    borderColor: colors.border,
  },
  quickChipActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  quickChipText: {
    color: colors.textMuted,
    fontSize: typography.caption.fontSize,
  },
  quickChipTextActive: {
    color: colors.text,
    fontWeight: '600',
  },
  manualRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    alignItems: 'center',
  },
  manualInput: {
    flex: 0,
    width: 100,
  },
  saveButton: {
    backgroundColor: colors.primary,
    borderRadius: radius.md,
    paddingVertical: spacing.sm + 4,
    paddingHorizontal: spacing.lg,
  },
  saveButtonText: {
    color: colors.text,
    fontWeight: '600',
    fontSize: typography.body.fontSize,
  },
  hint: {
    color: colors.textMuted,
    fontSize: typography.caption.fontSize,
  },
  error: {
    color: colors.danger,
    fontSize: typography.caption.fontSize,
  },
  closeButton: {
    marginTop: spacing.sm,
    paddingVertical: spacing.md,
    alignItems: 'center',
    borderRadius: radius.md,
    backgroundColor: colors.surfaceLight,
    borderWidth: 1,
    borderColor: colors.border,
  },
  closeButtonText: {
    color: colors.text,
    fontWeight: '600',
    fontSize: typography.body.fontSize,
  },
});