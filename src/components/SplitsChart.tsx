import { StyleSheet, Text, View } from 'react-native';
import { formatPace } from '@/logic/geo';
import type { Split } from '@/logic/runMetrics';
import { colors, radius, spacing, typography } from '@/theme/colors';

type Props = { splits: readonly Split[] };

/**
 * Спліти по кілометрах. Довжина смуги — відносний темп: найшвидший км
 * займає всю ширину, решта коротші. Простіше за графік і читається з розгону.
 */
export function SplitsChart({ splits }: Props) {
  if (splits.length === 0) {
    return <Text style={styles.empty}>Замало даних для кілометрових сплітів</Text>;
  }

  const paces = splits
    .map((s) => s.paceMsPerKm)
    .filter((p) => p > 0);
  const fastest = paces.length > 0 ? Math.min(...paces) : 0;

  return (
    <View style={styles.container}>
      {splits.map((split) => {
        const ratio =
          fastest > 0 && split.paceMsPerKm > 0
            ? Math.max(0.25, fastest / split.paceMsPerKm)
            : 0.25;
        return (
          <View key={split.index} style={styles.row}>
            <Text style={styles.label}>
              {split.partial
                ? `${(split.distanceM / 1000).toFixed(2).replace('.', ',')}`
                : `${split.index}`}
            </Text>
            <View style={styles.barTrack}>
              <View
                style={[
                  styles.barFill,
                  {
                    width: `${Math.round(ratio * 100)}%`,
                    backgroundColor: split.partial
                      ? colors.textMuted
                      : colors.primary,
                  },
                ]}
              />
            </View>
            <Text style={styles.pace}>{formatPace(split.paceMsPerKm)}</Text>
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { gap: spacing.xs },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  label: {
    width: 34,
    color: colors.textMuted,
    fontSize: typography.caption.fontSize,
    textAlign: 'right',
  },
  barTrack: {
    flex: 1,
    height: 14,
    backgroundColor: colors.surfaceLight,
    borderRadius: radius.sm,
    overflow: 'hidden',
  },
  barFill: { height: '100%', borderRadius: radius.sm },
  pace: {
    width: 52,
    color: colors.text,
    fontSize: typography.caption.fontSize,
    fontVariant: ['tabular-nums'],
  },
  empty: {
    color: colors.textMuted,
    fontSize: typography.body.fontSize,
  },
});
