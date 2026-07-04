export const colors = {
  background: '#0F1115',
  surface: '#1A1D24',
  surfaceLight: '#242833',
  primary: '#4F8EF7',
  primaryDark: '#3A6FC4',
  success: '#34C77B',
  warning: '#F5A623',
  danger: '#E5484D',
  text: '#F2F4F8',
  textMuted: '#8A91A0',
  border: '#2E3340',
  overlay: 'rgba(0, 0, 0, 0.6)',
} as const;

export const spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
} as const;

export const radius = {
  sm: 8,
  md: 12,
  lg: 20,
  full: 999,
} as const;

export const typography = {
  title: { fontSize: 28, fontWeight: '700' },
  heading: { fontSize: 20, fontWeight: '600' },
  body: { fontSize: 16, fontWeight: '400' },
  caption: { fontSize: 13, fontWeight: '400' },
  percent: { fontSize: 48, fontWeight: '800' },
} as const;

export function percentColor(percent: number): string {
  if (percent >= 80) return colors.success;
  if (percent >= 50) return colors.warning;
  return colors.danger;
}
