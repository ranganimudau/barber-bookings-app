import React from "react";
import { StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { colors } from "../../theme/barberTheme";

/**
 * Tinted strip with a hairline rule filling the status bar area on the
 * light-themed screens. Without it the system bar (clock, notification
 * chips, battery) sits directly on the same flat white as the content
 * with nothing marking where the OS ends and the app begins.
 *
 * Absolutely positioned and non-interactive so it overlays whatever is
 * already there — no screen has to change its own padding or layout, and
 * scrolling content passes underneath it rather than colliding with the
 * system bar. Render it as the first child of a screen's root View.
 */
export default function StatusBarBackdrop() {
  const insets = useSafeAreaInsets();
  if (!insets.top) return null;

  return <View pointerEvents="none" style={[styles.backdrop, { height: insets.top }]} />;
}

const styles = StyleSheet.create({
  backdrop: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    zIndex: 100,
    backgroundColor: colors.surfaceMuted,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.borderStrong,
  },
});
