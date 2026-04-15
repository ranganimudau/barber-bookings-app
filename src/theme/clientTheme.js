/**
 * Client app theme – professional barbershop aesthetic
 */
export const colors = {
  primary: '#0b0b10',
  primaryLight: '#111827',
  accent: '#C5A070', // bronze / rose-gold
  accentLight: '#A67C52',
  surface: '#111827',
  background: '#0b0b10',
  backgroundWarm: '#0f172a',
  text: '#f8fafc',
  textSecondary: '#cbd5e1',
  textMuted: '#9ca3af',
  border: '#1f2937',
  borderLight: '#0f172a',
  success: '#2d6a4f',
  successBg: '#e8f5e9',
  pending: '#d4af37',
  pendingBg: '#2a210b',
  error: '#c1121f',
  errorBg: '#ffe5e5',
  white: '#ffffff',
  black: '#0b0b10',
};

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 24,
};

export const borderRadius = {
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  full: 999,
};

export const typography = {
  title: { fontSize: 24, fontWeight: '700' },
  titleSmall: { fontSize: 20, fontWeight: '700' },
  sectionHeader: { fontSize: 17, fontWeight: '600' },
  body: { fontSize: 16, fontWeight: '400' },
  bodySmall: { fontSize: 14, fontWeight: '400' },
  caption: { fontSize: 12, fontWeight: '500' },
  button: { fontSize: 16, fontWeight: '600' },
};

export const shadows = {
  card: {
    elevation: 3,
    shadowColor: '#1a1a2e',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
  },
  button: {
    elevation: 2,
    shadowColor: '#1a1a2e',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.12,
    shadowRadius: 4,
  },
  floating: {
    elevation: 6,
    shadowColor: '#1a1a2e',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.15,
    shadowRadius: 10,
  },
};
