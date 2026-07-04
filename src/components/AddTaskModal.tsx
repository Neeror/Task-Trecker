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
import { UserTextSchema } from '@/types';
import { colors, radius, spacing, typography } from '@/theme/colors';

type Props = {
  visible: boolean;
  onClose: () => void;
  onSubmit: (title: string) => Promise<boolean>;
};

export function AddTaskModal({ visible, onClose, onSubmit }: Props) {
  const [title, setTitle] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const handleClose = () => {
    setTitle('');
    setError(null);
    onClose();
  };

  const handleSubmit = async () => {
    const parsed = UserTextSchema.safeParse(title);
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? 'Некоректна назва');
      return;
    }

    setSubmitting(true);
    const ok = await onSubmit(parsed.data);
    setSubmitting(false);

    if (ok) {
      handleClose();
    } else {
      setError('Не вдалося зберегти задачу, спробуй ще раз');
    }
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
          <Text style={styles.heading}>Нова ціль на день</Text>
          <TextInput
            style={styles.input}
            placeholder="Що потрібно зробити?"
            placeholderTextColor={colors.textMuted}
            value={title}
            onChangeText={(text) => {
              setTitle(text);
              if (error) setError(null);
            }}
            maxLength={200}
            autoFocus
            returnKeyType="done"
            onSubmitEditing={handleSubmit}
          />
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
  },
  heading: {
    fontSize: typography.heading.fontSize,
    fontWeight: typography.heading.fontWeight,
    color: colors.text,
    marginBottom: spacing.md,
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
  error: {
    color: colors.danger,
    fontSize: typography.caption.fontSize,
    marginTop: spacing.sm,
  },
  actions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: spacing.sm,
    marginTop: spacing.lg,
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
