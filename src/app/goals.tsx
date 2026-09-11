import { useCallback, useEffect, useRef, useState } from 'react';
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
import { GoalDetailModal } from '@/components/GoalDetailModal';
import { currentMonthKey, currentYearKey } from '@/logic/dates';
import { createGoal, deleteGoal, getAllGoals } from '@/storage/goalsRepo';
import { colors, radius, spacing, typography } from '@/theme/colors';
import { NewGoalInputSchema, type Goal, type GoalPeriod } from '@/types';

export default function GoalsScreen() {
  const [goals, setGoals] = useState<Goal[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [modalVisible, setModalVisible] = useState(false);
  const [selectedGoal, setSelectedGoal] = useState<Goal | null>(null);
  const [title, setTitle] = useState('');
  const [target, setTarget] = useState('');
  const [period, setPeriod] = useState<GoalPeriod>('month');
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const mountedRef = useRef(true);

  const refresh = useCallback(async () => {
    try {
        const all = await getAllGoals();
      if (mountedRef.current) {
        setGoals(all);
        setSelectedGoal((prev) =>
          prev ? (all.find((g) => g.id === prev.id) ?? prev) : prev,
        );
        setLoadError(null);
      }
    } catch (e) {
      if (mountedRef.current) setLoadError('Не вдалося завантажити цілі');
      if (__DEV__) console.error('[goals] refresh:', e);
    }
  }, []);

  useEffect(() => {
    mountedRef.current = true;
    void refresh();
    return () => {
      mountedRef.current = false;
    };
  }, [refresh]);

  const closeModal = () => {
    setModalVisible(false);
    setTitle('');
    setTarget('');
    setPeriod('month');
    setFormError(null);
  };

  const handleSubmit = async () => {
    const targetNumber = Number(target.trim());
    const parsed = NewGoalInputSchema.safeParse({
      title,
      period,
      periodKey: period === 'month' ? currentMonthKey() : currentYearKey(),
      targetCount: Number.isInteger(targetNumber) ? targetNumber : NaN,
    });

    if (!parsed.success) {
      setFormError(parsed.error.issues[0]?.message ?? 'Некоректні дані');
      return;
    }

    setSubmitting(true);
    try {
      await createGoal(parsed.data);
      await refresh();
      closeModal();
    } catch (e) {
      setFormError('Не вдалося зберегти ціль, спробуй ще раз');
      if (__DEV__) console.error('[goals] createGoal:', e);
    } finally {
      setSubmitting(false);
    }
  };

  const confirmDelete = (goal: Goal) => {
    Alert.alert('Видалити ціль?', goal.title, [
      { text: 'Скасувати', style: 'cancel' },
      {
        text: 'Видалити',
        style: 'destructive',
        onPress: async () => {
          const ok = await deleteGoal(goal.id).catch(() => false);
          if (ok) await refresh();
        },
      },
    ]);
  };

  return (
    <View style={styles.container}>
      {loadError ? <Text style={styles.error}>{loadError}</Text> : null}

      <FlatList
        data={goals}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.list}
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Text style={styles.emptyTitle}>Цілей поки немає</Text>
            <Text style={styles.emptyHint}>
              Додай глобальну ціль на місяць або рік кнопкою «+»
            </Text>
          </View>
        }
        renderItem={({ item }) => (
            <Pressable
            style={styles.goalRow}
            onPress={() => setSelectedGoal(item)}
            onLongPress={() => confirmDelete(item)}
            delayLongPress={400}
            accessibilityRole="button"
            accessibilityLabel={item.title}
            accessibilityHint="Натисніть, щоб відкрити деталі. Утримуйте, щоб видалити."
          >
            <View style={styles.goalInfo}>
              <Text style={styles.goalTitle} numberOfLines={2}>
                {item.title}
              </Text>
              <Text style={styles.goalMeta}>
                {item.period === 'month' ? 'Місяць' : 'Рік'} · {item.periodKey} ·
                план: {item.targetCount}
                {item.manualPercent !== null
                  ? ` · вручну: ${item.manualPercent}%`
                  : ''}
              </Text>
            </View>
            <Text style={styles.goalChevron}>›</Text>
          </Pressable>
        )}
      />

     <Pressable
        style={styles.fab}
        onPress={() => setModalVisible(true)}
        accessibilityRole="button"
        accessibilityLabel="Додати ціль"
      >
        <Text style={styles.fabText}>＋</Text>
      </Pressable>

      <GoalDetailModal
        goal={selectedGoal}
        visible={selectedGoal !== null}
        onClose={() => setSelectedGoal(null)}
        onChanged={() => void refresh()}
      />

      <Modal
        visible={modalVisible}
        transparent
        animationType="fade"
        onRequestClose={closeModal}
      >
        <KeyboardAvoidingView
          style={styles.overlay}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <Pressable style={StyleSheet.absoluteFill} onPress={closeModal} />
          <View style={styles.card}>
            <Text style={styles.heading}>Нова глобальна ціль</Text>

            <TextInput
              style={styles.input}
              placeholder="Назва цілі"
              placeholderTextColor={colors.textMuted}
              value={title}
              onChangeText={(text) => {
                setTitle(text);
                if (formError) setFormError(null);
              }}
              maxLength={200}
              autoFocus
            />

            <TextInput
              style={styles.input}
              placeholder="Скільки задач плануєш (число)"
              placeholderTextColor={colors.textMuted}
              value={target}
              onChangeText={(text) => {
                setTarget(text.replace(/[^0-9]/g, ''));
                if (formError) setFormError(null);
              }}
              keyboardType="number-pad"
              maxLength={5}
            />

            <View style={styles.periodRow}>
              {(['month', 'year'] as const).map((p) => (
                <Pressable
                  key={p}
                  style={[styles.periodButton, period === p && styles.periodButtonActive]}
                  onPress={() => setPeriod(p)}
                  accessibilityRole="button"
                  accessibilityState={{ selected: period === p }}
                >
                  <Text
                    style={[styles.periodText, period === p && styles.periodTextActive]}
                  >
                    {p === 'month' ? 'Місяць' : 'Рік'}
                  </Text>
                </Pressable>
              ))}
            </View>

            {formError ? <Text style={styles.error}>{formError}</Text> : null}

            <View style={styles.actions}>
              <Pressable style={styles.buttonSecondary} onPress={closeModal}>
                <Text style={styles.buttonSecondaryText}>Скасувати</Text>
              </Pressable>
              <Pressable
                style={[styles.buttonPrimary, submitting && styles.buttonDisabled]}
                onPress={handleSubmit}
                disabled={submitting}
              >
                <Text style={styles.buttonPrimaryText}>
                  {submitting ? 'Зберігаю…' : 'Додати'}
                </Text>
              </Pressable>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: 'transparent',
    padding: spacing.md,
  },
  list: {
    paddingBottom: spacing.xl * 3,
  },
  empty: {
    alignItems: 'center',
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
  goalRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    padding: spacing.md,
    marginBottom: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border,
  },
  goalInfo: {
    flex: 1,
  },
  goalChevron: {
    color: colors.textMuted,
    fontSize: 24,
    marginLeft: spacing.sm,
  },
  
  goalTitle: {
    color: colors.text,
    fontSize: typography.body.fontSize,
  },
  goalMeta: {
    color: colors.textMuted,
    fontSize: typography.caption.fontSize,
    marginTop: spacing.xs,
  },
  fab: {
    position: 'absolute',
    right: spacing.lg,
    bottom: spacing.lg,
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
  overlay: {
    flex: 1,
    backgroundColor: colors.overlay,
    justifyContent: 'center',
    padding: spacing.lg,
  },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: colors.border,
    gap: spacing.sm,
  },
  heading: {
    fontSize: typography.heading.fontSize,
    fontWeight: typography.heading.fontWeight,
    color: colors.text,
    marginBottom: spacing.xs,
  },
  input: {
    backgroundColor: colors.surfaceLight,
    borderRadius: radius.md,
    padding: spacing.md,
    fontSize: typography.body.fontSize,
    color: colors.text,
    borderWidth: 1,
    borderColor: colors.border,
  },
  periodRow: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  periodButton: {
    flex: 1,
    paddingVertical: spacing.sm,
    alignItems: 'center',
    borderRadius: radius.sm,
    backgroundColor: colors.surfaceLight,
    borderWidth: 1,
    borderColor: colors.border,
  },
  periodButtonActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  periodText: {
    color: colors.textMuted,
    fontSize: typography.body.fontSize,
  },
  periodTextActive: {
    color: colors.text,
    fontWeight: '600',
  },
  error: {
    color: colors.danger,
    fontSize: typography.caption.fontSize,
  },
  actions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: spacing.sm,
    marginTop: spacing.sm,
  },
  buttonPrimary: {
    backgroundColor: colors.primary,
    borderRadius: radius.md,
    paddingVertical: spacing.sm + 4,
    paddingHorizontal: spacing.lg,
  },
  buttonPrimaryText: {
    color: colors.text,
    fontWeight: '600',
    fontSize: typography.body.fontSize,
  },
  buttonSecondary: {
    borderRadius: radius.md,
    paddingVertical: spacing.sm + 4,
    paddingHorizontal: spacing.lg,
  },
  buttonSecondaryText: {
    color: colors.textMuted,
    fontSize: typography.body.fontSize,
  },
  buttonDisabled: {
    opacity: 0.6,
  },
});
