import { StyleSheet, Text, View } from 'react-native';
import {
  formatDistance,
  formatDuration,
  formatPace,
  formatSpeedKmh,
} from '@/logic/geo';
import { colors, radius, spacing, typography } from '@/theme/colors';
import type { Run } from '@/types';

type Props = { run: Run; elapsedMs: number; paceMsPerKm: number };

export function RunStats({ run, elapsedMs: elapsed, paceMsPerKm: pace }: Props) {
  const cells: { label: string; value: string }[] = [
    { label: 'Дистанція', value: formatDistance(run.distanceM) },
    { label: 'Загальний час', value: formatDuration(elapsed) },
    { label: 'Час у руху', value: formatDuration(run.movingMs) },
    { label: 'Темп', value: `${formatPace(pace)} /км` },
    {
      label: 'Швидкість',
      value: `${formatSpeedKmh(run.distanceM, run.movingMs > 0 ? run.movingMs : elapsed)} км/г`,
    },
    { label: 'Набір висоти', value: `${Math.round(run.ascentM)} м` },
  ];

  return (
    <View style={styles.grid}>
      {cells.map((cell) => (
        <View key={cell.label} style={styles.cell}>
          <Text style={styles.label}>{cell.label}</Text>
          <Text style={styles.value}>{cell.value}</Text>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  cell: {
    flexGrow: 1,
    flexBasis: '30%',
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
  },
  label: {
    color: colors.textMuted,
    fontSize: typography.caption.fontSize,
    marginBottom: 2,
  },
  value: {
    color: colors.text,
    fontSize: typography.heading.fontSize,
    fontWeight: typography.heading.fontWeight,
    fontVariant: ['tabular-nums'],
  },
});
