import { useFocusEffect } from '@react-navigation/native';
import { setStatusBarBackgroundColor, setStatusBarStyle } from 'expo-status-bar';
import { useCallback } from 'react';
import { Platform } from 'react-native';

const DARK_SCREEN_BACKGROUND = '#0A0A0A';

/**
 * For barber-side screens using the new light (white) theme while other
 * tabs are still dark-themed. Flips the system status bar to dark
 * icons/background while this screen is focused, and restores the app's
 * default light-icon/dark-background style on blur — tab screens stay
 * mounted, so this can't rely on unmount.
 */
const applyLight = (lightBackground) => {
  setStatusBarStyle('dark');
  if (Platform.OS === 'android') setStatusBarBackgroundColor(lightBackground, false);
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
      applyLight(lightBackground);
      const raf = requestAnimationFrame(() => applyLight(lightBackground));
      const timeout = setTimeout(() => applyLight(lightBackground), 150);
      return () => {
        cancelAnimationFrame(raf);
        clearTimeout(timeout);
        applyDark();
      };
    }, [lightBackground])
  );
}
