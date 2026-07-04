import { useEffect } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Animated, {
  useAnimatedProps,
  useSharedValue,
  withTiming,
  Easing,
} from 'react-native-reanimated';
import Svg, { Circle } from 'react-native-svg';
import { colors, percentColor, typography } from '@/theme/colors';

const AnimatedCircle = Animated.createAnimatedComponent(Circle);

type Props = {
  percent: number;
  size?: number;
  strokeWidth?: number;
  label?: string;
};

export function ProgressCircle({
  percent,
  size = 180,
  strokeWidth = 14,
  label,
}: Props) {
  const safePercent = Number.isFinite(percent) ? Math.max(0, percent) : 0;
  const displayPercent = Math.round(safePercent);
  const fillPercent = Math.min(safePercent, 100);

  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const center = size / 2;

  const progress = useSharedValue(0);

  useEffect(() => {
    progress.value = withTiming(fillPercent, {
      duration: 800,
      easing: Easing.out(Easing.cubic),
    });
  }, [fillPercent, progress]);

  const animatedProps = useAnimatedProps(() => ({
    strokeDashoffset: circumference * (1 - progress.value / 100),
  }));

  const color = percentColor(displayPercent);

  return (
    <View
      style={[styles.container, { width: size, height: size }]}
      accessible
      accessibilityRole="progressbar"
      accessibilityLabel={label ?? 'Прогрес'}
      accessibilityValue={{ min: 0, max: 100, now: Math.min(displayPercent, 100) }}
    >
      <Svg width={size} height={size}>
        <Circle
          cx={center}
          cy={center}
          r={radius}
          stroke={colors.surfaceLight}
          strokeWidth={strokeWidth}
          fill="none"
        />
        <AnimatedCircle
          cx={center}
          cy={center}
          r={radius}
          stroke={color}
          strokeWidth={strokeWidth}
          fill="none"
          strokeLinecap="round"
          strokeDasharray={circumference}
          animatedProps={animatedProps}
          transform={`rotate(-90 ${center} ${center})`}
        />
      </Svg>
      <View style={styles.textWrapper}>
        <Text style={[styles.percentText, { color }]}>
          {displayPercent}%
        </Text>
        {label ? <Text style={styles.labelText}>{label}</Text> : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  textWrapper: {
  position: 'absolute',
  top: 0,
  left: 0,
  right: 0,
  bottom: 0,
  alignItems: 'center',
  justifyContent: 'center',
},

  percentText: {
    fontSize: typography.percent.fontSize,
    fontWeight: typography.percent.fontWeight,
  },
  labelText: {
    fontSize: typography.caption.fontSize,
    color: colors.textMuted,
    marginTop: 4,
  },
});
