import { useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { RunMap } from '@/components/RunMap';
import { RunStats } from '@/components/RunStats';
import { SplitsChart } from '@/components/SplitsChart';
import { useRunDetail } from '@/hooks/useRunDetail';
import { boundsOf } from '@/logic/runMetrics';
import { formatDateForDisplay } from '@/logic/dates';
import { deleteRun } from '@/storage/runsRepo';
import { downloadRegion } from '@/tracking/offlineMap';
import { emitRunUpdated } from '@/tracking/runEvents';
import { colors, radius, spacing, typography } from '@/theme/colors';

export default function RunDetailScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ id: string }>();
  const runId = typeof params.id === 'string' ? params.id : '';
  const { run, points, title, splits, elapsed, pace, loading, error } =
    useRunDetail(runId);
  const [downloading, setDownloading] = useState<number | null>(null);

  const bounds = useMemo(() => boundsOf(points), [points]);

  const handleDownload = () => {
    if (bounds === null) return;
    Alert.alert(
      'Завантажити карту цього району?',
      'Один раз по Wi-Fi (кілька десятків МБ) — далі карта відкривається без інтернету.',
      [
        { text: 'Скасувати', style: 'cancel' },
        {
          text: 'Завантажити',
          onPress: () => {
            void (async () => {
              setDownloading(0);
              const result = await downloadRegion(bounds, {
                onProgress: (percent) => setDownloading(Math.round(percent)),
              });
              setDownloading(null);
              if (!result.ok) {
                Alert.alert(
                  'Не вдалося',
                  result.reason === 'unavailable'
                    ? 'Карта доступна лише у dev build (не в Expo Go)'
                    : 'Перевір інтернет і спробуй ще раз',
                );
              }
            })();
          },
        },
      ],
    );
  };

  const handleDelete = () => {
    Alert.alert('Видалити пробіжку?', 'Маршрут і статистику не відновити.', [
      { text: 'Скасувати', style: 'cancel' },
      {
        text: 'Видалити',
        style: 'destructive',
        onPress: () => {
          void (async () => {
            await deleteRun(runId);
            emitRunUpdated();
            router.back();
          })();
        },
      },
    ]);
  };

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

  if (run === null) {
    return (
      <View style={styles.center}>
        <Text style={styles.error}>{error ?? 'Пробіжку не знайдено'}</Text>
      </View>
    );
  }

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
    >
      <View>
        <Text style={styles.title}>{title ?? 'Вільна пробіжка'}</Text>
        <Text style={styles.date}>{formatDateForDisplay(run.date)}</Text>
      </View>

      <RunMap
        points={points}
        height={280}
        emptyHint="Для цієї пробіжки не збереглося жодної точки"
      />

      {downloading !== null ? (
        <Text style={styles.hint}>Качаю офлайн-карту… {downloading}%</Text>
      ) : (
        <Pressable style={styles.linkButton} onPress={handleDownload}>
          <Text style={styles.linkButtonText}>
            Завантажити карту району для офлайну
          </Text>
        </Pressable>
      )}

      <RunStats run={run} elapsedMs={elapsed} paceMsPerKm={pace} />

      <Text style={styles.sectionTitle}>Кілометри</Text>
      <SplitsChart splits={splits} />

      <Pressable style={styles.deleteButton} onPress={handleDelete}>
        <Text style={styles.deleteText}>Видалити пробіжку</Text>
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  center: {
    flex: 1,
    backgroundColor: colors.background,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.lg,
  },
  content: { padding: spacing.md, gap: spacing.md, paddingBottom: spacing.xl },
  title: {
    color: colors.text,
    fontSize: typography.title.fontSize,
    fontWeight: typography.title.fontWeight,
  },
  date: {
    color: colors.textMuted,
    fontSize: typography.body.fontSize,
    marginTop: spacing.xs,
  },
  sectionTitle: {
    color: colors.text,
    fontSize: typography.heading.fontSize,
    fontWeight: typography.heading.fontWeight,
    marginTop: spacing.sm,
  },
  hint: {
    color: colors.textMuted,
    fontSize: typography.caption.fontSize,
    textAlign: 'center',
  },
  linkButton: { alignItems: 'center', paddingVertical: spacing.xs },
  linkButtonText: {
    color: colors.primary,
    fontSize: typography.caption.fontSize,
  },
  deleteButton: {
    marginTop: spacing.lg,
    alignItems: 'center',
    padding: spacing.md,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.danger,
  },
  deleteText: { color: colors.danger, fontSize: typography.body.fontSize },
  error: { color: colors.danger, fontSize: typography.body.fontSize },
});
