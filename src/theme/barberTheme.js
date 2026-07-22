/**
 * Barber-side theme — warm, light, boutique/wellness aesthetic.
 * Kept separate from clientTheme.js (shared by the client booking flow and
 * auth screens) so this rollout doesn't re-theme anything else yet.
 */
export const colors = {
  background: '#FBF7F2',
  surface: '#FFFFFF',
  surfaceMuted: '#F5EFE8',

  text: '#2B2420',
  textSecondary: '#5C4F45',
  textMuted: '#8A7F76',

  accent: '#C1704F', // warm terracotta / clay
  accentDark: '#A15A3D',
  accentSoft: '#F3E4DC', // tint for badges/backgrounds
  accentText: '#FFFFFF', // text/icon color on top of solid accent fills

  success: '#6E9169',
  successBg: '#E8EFE6',
  pending: '#D9A441',
  pendingBg: '#FBF1DD',
  error: '#C1584A',
  errorBg: '#F8E7E4',

  border: 'rgba(43,36,32,0.10)',
  borderStrong: 'rgba(43,36,32,0.18)',

  white: '#FFFFFF',
  black: '#2B2420',
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
  title: { fontSize: 24, fontWeight: '800' },
  titleSmall: { fontSize: 20, fontWeight: '800' },
  sectionHeader: { fontSize: 16, fontWeight: '800' },
  body: { fontSize: 16, fontWeight: '400' },
  bodySmall: { fontSize: 14, fontWeight: '400' },
  caption: { fontSize: 12, fontWeight: '600' },
  button: { fontSize: 16, fontWeight: '700' },
};

export const shadows = {
  card: {
    elevation: 2,
    shadowColor: '#2B2420',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.06,
    shadowRadius: 10,
  },
  button: {
    elevation: 2,
    shadowColor: '#2B2420',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 6,
  },
  floating: {
    elevation: 6,
    shadowColor: '#2B2420',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.1,
    shadowRadius: 16,
  },
};
