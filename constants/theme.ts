export const Colors = {
  background:       '#0B0F1A',
  surface:          '#111827',
  card:             '#1F2937',
  cardBorder:       '#374151',
  neonGreen:        '#10B981',
  neonGreenDim:     '#059669',
  electricBlue:     '#3B82F6',
  electricBlueDim:  '#2563EB',
  gold:             '#FBBF24',
  orange:           '#F97316',
  white:            '#F9FAFB',
  textSecondary:    '#9CA3AF',
  textMuted:        '#6B7280',
  danger:           '#EF4444',
  success:          '#10B981',
  overlay:          'rgba(0,0,0,0.7)',
} as const;

export const Spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
} as const;

export const Radius = {
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  full: 999,
} as const;

export const Typography = {
  h1: { fontSize: 28, fontWeight: '800' as const, letterSpacing: -0.5 },
  h2: { fontSize: 22, fontWeight: '700' as const, letterSpacing: -0.3 },
  h3: { fontSize: 18, fontWeight: '700' as const },
  body: { fontSize: 15, fontWeight: '400' as const },
  bodyBold: { fontSize: 15, fontWeight: '600' as const },
  small: { fontSize: 12, fontWeight: '400' as const },
  smallBold: { fontSize: 12, fontWeight: '700' as const },
  tiny: { fontSize: 10, fontWeight: '600' as const },
} as const;
