import { useState } from 'react';
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { DistanceMetersSchema, UserTextSchema, type TaskKind } from '@/types';
import { colors, radius, spacing, typography } from '@/theme/colors';

export type TaskDraft =
  | { kind: 'task'; title: string }
  | { kind: 'run'; title: string; targetDistanceM: number };

type Props = {
  visible: boolean;
  onClose: () => void;
  onSubmit: (draft: TaskDraft) => Promise<boolean>;
};

const QUICK_KM = [3, 5, 10, 21.1] as const;

/** «10,5» і «10.5» — однаково валідні: кома на укр. клавіатурі під рукою. */
function parseKm(raw: string): number | null {
  const normalized = raw.trim().replace(',', '.');
  if (normalized.length === 0) return null;
  const value = Number(normalized);
  return Number.isFinite(value) ? value : null;
}

function formatKm(km: number): string {
  return String(km).replace('.', ',');
}

export function AddTaskModal({ visible, onClose, onSubmit }: Props) {
  const [kind, setKind] = useState<TaskKind>('task');
  const [title, setTitle] = useState('');
  const [km, setKm] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const handleClose = () => {
    setKind('task');
    setTitle('');
    setKm('');
    setError(null);
    onClose();
  };

  const handleSubmit = async () => {
    setError(null);

    if (kind === 'run') {
      const parsedKm = parseKm(km);
      if (parsedKm === null) {
        setError('Вкажи дистанцію в кілометрах');
        return;
      }
      const meters = DistanceMetersSchema.safeParse(Math.round(parsedKm * 1000));
      if (!meters.success) {
        setError(meters.error.issues[0]?.message ?? 'Некоректна дистанція');
        return;
      }
      // Назву можна не вводити — вона очевидна з дистанції.
      const fallback = `Пробігти ${formatKm(parsedKm)} км`;
      const parsedTitle = UserTextSchema.safeParse(
        title.trim().length > 0 ? title : fallback,
      );
      if (!parsedTitle.success) {
        setError(parsedTitle.error.issues[0]?.message ?? 'Некоректна назва');
        return;
      }

      setSubmitting(true);
      const ok = await onSubmit({
        kind: 'run',
        title: parsedTitle.data,
        targetDistanceM: meters.data,
      });
      setSubmitting(false);
      if (ok) handleClose();
      else setError('Не вдалося зберегти, спробуй ще раз');
      return;
    }

    const parsed = UserTextSchema.safeParse(title);
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? 'Некоректна назва');
      return;
    }

    setSubmitting(true);
    const ok = await onSubmit({ kind: 'task', title: parsed.data });
    setSubmitting(false);
    if (ok) handleClose();
    else setError('Не вдалося зберегти задачу, спробуй ще раз');
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={handleClose}
    >
      <KeyboardAvoidingView
        style={styles.overlay}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <Pressable style={StyleSheet.absoluteFill} onPress={handleClose} />
        <View style={styles.card}>
          <Text style={styles.heading}>
            {kind === 'run' ? 'Нова пробіжка' : 'Нова ціль на день'}
          </Text>

          <View style={styles.switcher}>
            {(['task', 'run'] as const).map((option) => (
              <Pressable
                key={option}
                style={[
                  styles.switchButton,
                  kind === option && styles.switchButtonActive,
                ]}
                onPress={() => {
                  setKind(option);
                  setError(null);
                }}
                accessibilityRole="button"
                accessibilityState={{ selected: kind === option }}
              >
                <Text
                  style={[
                    styles.switchText,
                    kind === option && styles.switchTextActive,
                  ]}
                >
                  {option === 'task' ? 'Задача' : '🏃 Пробіжка'}
                </Text>
              </Pressable>
            ))}
          </View>

          <TextInput
            style={styles.input}
            placeholder={
              kind === 'run' ? 'Назва (необов’язково)' : 'Що потрібно зробити?'
            }
            placeholderTextColor={colors.textMuted}
            value={title}
            onChangeText={(text) => {
              setTitle(text);
              if (error) setError(null);
            }}
            maxLength={200}
            autoFocus={kind === 'task'}
            returnKeyType={kind === 'task' ? 'done' : 'next'}
            onSubmitEditing={kind === 'task' ? handleSubmit : undefined}
          />

          {kind === 'run' ? (
            <>
              <View style={styles.distanceRow}>
                <TextInput
                  style={[styles.input, styles.distanceInput]}
                  placeholder="10"
                  placeholderTextColor={colors.textMuted}
                  value={km}
                  onChangeText={(text) => {
                    setKm(text.replace(/[^\d.,]/g, ''));
                    if (error) setError(null);
                  }}
                  keyboardType="decimal-pad"
                  maxLength={6}
                  returnKeyType="done"
                  onSubmitEditing={handleSubmit}
                />
                <Text style={styles.unit}>км</Text>
              </View>
              <View style={styles.quickRow}>
                {QUICK_KM.map((value) => (
                  <Pressable
                    key={value}
                    style={styles.chip}
                    onPress={() => {
                      setKm(formatKm(value));
                      setError(null);
                    }}
                  >
                    <Text style={styles.chipText}>{formatKm(value)}</Text>
                  </Pressable>
                ))}
              </View>
            </>
          ) : null}

          {error ? <Text style={styles.error}>{error}</Text> : null}

          <View style={styles.actions}>
            <Pressable style={styles.buttonSecondary} onPress={handleClose}>
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
  );
}

const styles = StyleSheet.create({
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
  switcher: {
    flexDirection: 'row',
    backgroundColor: colors.background,
    borderRadius: radius.md,
    padding: spacing.xs,
    marginBottom: spacing.xs,
  },
  switchButton: {
    flex: 1,
    paddingVertical: spacing.sm,
    alignItems: 'center',
    borderRadius: radius.sm,
  },
  switchButtonActive: { backgroundColor: colors.primary },
  switchText: { color: colors.textMuted, fontSize: typography.body.fontSize },
  switchTextActive: { color: colors.text, fontWeight: '600' },
  input: {
    backgroundColor: colors.surfaceLight,
    borderRadius: radius.md,
    padding: spacing.md,
    fontSize: typography.body.fontSize,
    color: colors.text,
    borderWidth: 1,
    borderColor: colors.border,
  },
  distanceRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  distanceInput: { flex: 1, fontSize: typography.heading.fontSize },
  unit: { color: colors.textMuted, fontSize: typography.body.fontSize },
  quickRow: { flexDirection: 'row', gap: spacing.sm },
  chip: {
    paddingVertical: spacing.xs + 2,
    paddingHorizontal: spacing.md,
    borderRadius: radius.full,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceLight,
  },
  chipText: { color: colors.text, fontSize: typography.caption.fontSize },
  error: { color: colors.danger, fontSize: typography.caption.fontSize },
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
  buttonDisabled: { opacity: 0.6 },
});
