import { useFocusEffect } from '@react-navigation/native';
import { setStatusBarBackgroundColor, setStatusBarStyle } from 'expo-status-bar';
import { useCallback } from 'react';
import { Platform } from 'react-native';

const DARK_SCREEN_BACKGROUND = '#0A0A0A';

/**
 * Slightly darker than the white page behind it (barberTheme surfaceMuted)
 * so the system bar reads as the OS's strip rather than blending into the
 * app's content. App.js renders the status bar non-translucent, so on
 * Android this colour *is* the visible strip on every light screen —
 * including pushed screens with a native header, which an in-screen
 * overlay could never reach. iOS has no equivalent API; there the
 * StatusBarBackdrop component covers the safe-area inset instead.
 */
const LIGHT_STATUS_BAR_TINT = '#F1F4F9';

const applyLight = () => {
  setStatusBarStyle('dark');
  if (Platform.OS === 'android') setStatusBarBackgroundColor(LIGHT_STATUS_BAR_TINT, false);
};

const applyDark = () => {
  setStatusBarStyle('light');
  if (Platform.OS === 'android') setStatusBarBackgroundColor(DARK_SCREEN_BACKGROUND, false);
};

export function useLightStatusBar(lightBackground) {
  useFocusEffect(
    useCallback(() => {
      // Calling the native status bar module synchronously while React
      // Navigation's focus/transition is still settling can silently no-op
      // on Android (the change "sticks" in JS state but never repaints) —
      // the icons/background stay stuck on whatever was there before until
      // something else forces a redraw (e.g. leaving and refocusing this
      // same screen). Applying on both the current frame and after the next
      // frame covers the case where the first call lands mid-transition.
      applyLight();
      const raf = requestAnimationFrame(() => applyLight());
      const timeout = setTimeout(() => applyLight(), 150);
      return () => {
        cancelAnimationFrame(raf);
        clearTimeout(timeout);
        applyDark();
      };
    }, [lightBackground])
  );
}
