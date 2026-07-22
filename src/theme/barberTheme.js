/**
 * Barber-side theme — clean corporate: white surfaces, navy/charcoal text,
 * one confident teal accent (validated via the dataviz palette checker:
 * lightness band, chroma floor, and contrast vs. white all pass). Flat
 * surfaces, soft rounded pill controls. Kept separate from clientTheme.js
 * (shared by the client booking flow and auth screens) so this rollout
 * doesn't re-theme anything else yet.
 */
export const colors = {
  background: '#FFFFFF',
  surface: '#FFFFFF',
  surfaceMuted: '#F1F4F9',

  text: '#1A2332',
  textSecondary: '#334155',
  textMuted: '#64748B',

  accent: '#0F9C8D',
  accentDark: '#0C7A6E',
  accentSoft: '#E3F5F2', // pale teal tint — badges/pills only
  accentText: '#FFFFFF', // text/icon color on top of solid accent fills

  success: '#16A34A',
  successBg: '#E7F6EC',
  pending: '#D97706',
  pendingBg: '#FDF1DF',
  error: '#DC2626',
  errorBg: '#FCE9E9',

  border: '#E2E8F0',
  borderStrong: '#CBD5E1',

  white: '#FFFFFF',
  black: '#1A2332',
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
    shadowColor: '#1A2332',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.06,
    shadowRadius: 10,
  },
  button: {
    elevation: 2,
    shadowColor: '#1A2332',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 6,
  },
  floating: {
    elevation: 6,
    shadowColor: '#1A2332',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.1,
    shadowRadius: 16,
  },
};
