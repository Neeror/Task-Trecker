import { useMemo, useState } from 'react';
import { StyleSheet, Text, View, type LayoutChangeEvent } from 'react-native';
import Svg, { Circle, Path } from 'react-native-svg';
import {
  boundsOf,
  buildSegments,
  projectSegments,
  type ScreenPoint,
} from '@/logic/runMetrics';
import { colors, radius, spacing, typography } from '@/theme/colors';
import type { RunPoint } from '@/types';

type Props = {
  points: readonly RunPoint[];
  height: number;
  emptyHint: string;
};

function toPath(segment: readonly ScreenPoint[]): string {
  return segment
    .map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x.toFixed(1)} ${p.y.toFixed(1)}`)
    .join(' ');
}

/**
 * Маршрут без карти й без мережі: чистий SVG на базі react-native-svg,
 * який уже є в проєкті. Працює завжди — це наш «нижній рівень».
 */
export function RouteSvg({ points, height, emptyHint }: Props) {
  const [width, setWidth] = useState(0);

  const onLayout = (event: LayoutChangeEvent) => {
    const next = event.nativeEvent.layout.width;
    if (Math.abs(next - width) > 1) setWidth(next);
  };

  const segments = useMemo(() => {
    if (width <= 0 || points.length === 0) return [];
    const bounds = boundsOf(points);
    if (bounds === null) return [];
    return projectSegments(buildSegments(points), bounds, {
      width,
      height,
      padding: 16,
    });
  }, [points, width, height]);

  const first = segments[0]?.[0];
  const lastSegment = segments[segments.length - 1];
  const last = lastSegment?.[lastSegment.length - 1];

  return (
    <View style={[styles.wrapper, { height }]} onLayout={onLayout}>
      {segments.length === 0 ? (
        <Text style={styles.hint}>{emptyHint}</Text>
      ) : (
        <Svg width={width} height={height}>
          {segments.map((segment, index) => (
            <Path
              key={index}
              d={toPath(segment)}
              stroke={colors.primary}
              strokeWidth={4}
              strokeLinecap="round"
              strokeLinejoin="round"
              fill="none"
            />
          ))}
          {first !== undefined ? (
            <Circle cx={first.x} cy={first.y} r={6} fill={colors.success} />
          ) : null}
          {last !== undefined ? (
            <Circle
              cx={last.x}
              cy={last.y}
              r={6}
              fill={colors.background}
              stroke={colors.primary}
              strokeWidth={3}
            />
          ) : null}
        </Svg>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
  hint: {
    color: colors.textMuted,
    fontSize: typography.caption.fontSize,
    textAlign: 'center',
    paddingHorizontal: spacing.md,
  },
});
