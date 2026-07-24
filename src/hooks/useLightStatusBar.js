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
export function useLightStatusBar(lightBackground) {
  useFocusEffect(
    useCallback(() => {
      setStatusBarStyle('dark');
      if (Platform.OS === 'android') setStatusBarBackgroundColor(lightBackground, false);
      return () => {
        setStatusBarStyle('light');
        if (Platform.OS === 'android') setStatusBarBackgroundColor(DARK_SCREEN_BACKGROUND, false);
      };
    }, [lightBackground])
  );
}
