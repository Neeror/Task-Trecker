import { Image, Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { useBackground } from '@/hooks/useBackground';
import { colors, radius, spacing, typography } from '@/theme/colors';

interface Props {
  visible: boolean;
  onClose: () => void;
}

const DIM_STEPS = [0.25, 0.4, 0.55, 0.7] as const;
const DIM_LABELS = ['Слабке', 'Середнє', 'Сильне', 'Максимум'] as const;

export function BackgroundSettingsModal({ visible, onClose }: Props) {
  const { settings, error, pickBackground, resetBackground, setDimOpacity, clearError } =
    useBackground();

  const handleClose = () => {
    clearError();
    onClose();
  };

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={handleClose}>
      <View style={styles.overlay}>
        <View style={styles.sheet}>
          <Text style={styles.title}>Фон застосунку</Text>

          {settings.imageUri !== null ? (
            <Image
              source={{ uri: settings.imageUri }}
              style={styles.preview}
              resizeMode="cover"
              accessibilityLabel="Поточний фон"
            />
          ) : (
            <View style={[styles.preview, styles.previewEmpty]}>
              <Text style={styles.previewEmptyText}>Стандартний фон</Text>
            </View>
          )}

          {error !== null ? <Text style={styles.error}>{error}</Text> : null}

          <Pressable
            style={styles.primaryButton}
            onPress={() => void pickBackground()}
            accessibilityRole="button"
            accessibilityLabel="Вибрати фото з галереї"
          >
            <Text style={styles.primaryButtonText}>Вибрати фото з галереї</Text>
          </Pressable>

          {settings.imageUri !== null ? (
            <>
              <Text style={styles.sectionLabel}>Затемнення</Text>
              <View style={styles.dimRow}>
                {DIM_STEPS.map((step, i) => {
                  const active = Math.abs(settings.dimOpacity - step) < 0.05;
                  return (
                    <Pressable
                      key={step}
                      style={[styles.dimButton, active && styles.dimButtonActive]}
                      onPress={() => void setDimOpacity(step)}
                      accessibilityRole="button"
                      accessibilityLabel={`Затемнення: ${DIM_LABELS[i]}`}
                    >
                      <Text
                        style={[styles.dimButtonText, active && styles.dimButtonTextActive]}
                      >
                        {DIM_LABELS[i]}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>

              <Pressable
                style={styles.dangerButton}
                onPress={() => void resetBackground()}
                accessibilityRole="button"
                accessibilityLabel="Прибрати фон"
              >
                <Text style={styles.dangerButtonText}>Прибрати фон</Text>
              </Pressable>
            </>
          ) : null}

          <Pressable
            style={styles.closeButton}
            onPress={handleClose}
            accessibilityRole="button"
            accessibilityLabel="Закрити"
          >
            <Text style={styles.closeButtonText}>Закрити</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: colors.overlay,
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: radius.lg,
    borderTopRightRadius: radius.lg,
    padding: spacing.lg,
    gap: spacing.md,
  },
  title: {
    fontSize: typography.heading.fontSize,
    fontWeight: typography.heading.fontWeight,
    color: colors.text,
  },
  preview: {
    height: 140,
    borderRadius: radius.md,
    backgroundColor: colors.surfaceLight,
  },
  previewEmpty: {
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.border,
  },
  previewEmptyText: {
    color: colors.textMuted,
    fontSize: typography.body.fontSize,
  },
  error: {
    color: colors.danger,
    fontSize: typography.caption.fontSize,
  },
  primaryButton: {
    backgroundColor: colors.primary,
    borderRadius: radius.md,
    padding: spacing.md,
    alignItems: 'center',
  },
  primaryButtonText: {
    color: colors.text,
    fontSize: typography.body.fontSize,
    fontWeight: '600',
  },
  sectionLabel: {
    color: colors.textMuted,
    fontSize: typography.caption.fontSize,
  },
  dimRow: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  dimButton: {
    flex: 1,
    borderRadius: radius.sm,
    paddingVertical: spacing.sm,
    alignItems: 'center',
    backgroundColor: colors.surfaceLight,
    borderWidth: 1,
    borderColor: colors.border,
  },
  dimButtonActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  dimButtonText: {
    color: colors.textMuted,
    fontSize: typography.caption.fontSize,
  },
  dimButtonTextActive: {
    color: colors.text,
    fontWeight: '600',
  },
  dangerButton: {
    borderRadius: radius.md,
    padding: spacing.md,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.danger,
  },
  dangerButtonText: {
    color: colors.danger,
    fontSize: typography.body.fontSize,
  },
  closeButton: {
    padding: spacing.sm,
    alignItems: 'center',
  },
  closeButtonText: {
    color: colors.textMuted,
    fontSize: typography.body.fontSize,
  },
});
