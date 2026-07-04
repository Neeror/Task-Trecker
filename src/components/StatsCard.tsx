import { StyleSheet, Text, View } from 'react-native';
import { colors, percentColor, radius, spacing, typography } from '@/theme/colors';

type Props = {
  label: string;
  value: string;
  hint?: string;
  percent?: number;
};

export function StatsCard({ label, value, hint, percent }: Props) {
  const accent =
    typeof percent === 'number' ? percentColor(Math.round(percent)) : colors.text;

  return (
    <View style={styles.card}>
      <Text style={styles.label} numberOfLines={1}>{label}</Text>
      <Text style={[styles.value, { color: accent }]} numberOfLines={1}>{value}</Text>
      {hint ? <Text style={styles.hint} numberOfLines={2}>{hint}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    flex: 1,
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
    minHeight: 92,
    justifyContent: 'center',
  },
  label: {
    fontSize: typography.caption.fontSize,
    color: colors.textMuted,
    marginBottom: spacing.xs,
  },
  value: {
    fontSize: typography.heading.fontSize,
    fontWeight: typography.heading.fontWeight,
    color: colors.text,
  },
  hint: {
    fontSize: typography.caption.fontSize,
    color: colors.textMuted,
    marginTop: spacing.xs,
  },
});
