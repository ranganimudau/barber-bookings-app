import { useCallback, useRef } from "react";
import { Platform } from "react-native";

/**
 * Keeps the field you're typing in visible above the software keyboard.
 *
 * Android resizes the window when the keyboard opens (softwareKeyboardLayoutMode
 * is "resize" in app.json), but React Native's ScrollView does not then scroll
 * the focused TextInput into the remaining space — so fields low down the form,
 * like the password on signup, sat hidden behind the keyboard while being typed
 * into.
 *
 * Attach `scrollRef` to the ScrollView and `handleFocus` to each TextInput's
 * onFocus.
 */
export function useScrollToFocusedInput(extraOffset = 120) {
  const scrollRef = useRef(null);

  const handleFocus = useCallback(
    (event) => {
      const node = event?.target;
      if (node == null) return;

      // Wait for the keyboard to actually be up — measuring against the
      // pre-resize viewport lands the scroll short of the field.
      setTimeout(() => {
        const scroll = scrollRef.current;
        if (!scroll) return;

        // Method lives directly on ScrollView, or behind getScrollResponder()
        // depending on how the component is wrapped. Guarded so a future RN
        // version dropping it degrades to today's behaviour rather than
        // throwing mid-typing.
        const responder =
          typeof scroll.scrollResponderScrollNativeHandleToKeyboard === "function"
            ? scroll
            : scroll.getScrollResponder?.();

        responder?.scrollResponderScrollNativeHandleToKeyboard?.(node, extraOffset, true);
      }, Platform.OS === "android" ? 150 : 50);
    },
    [extraOffset]
  );

  return { scrollRef, handleFocus };
}
