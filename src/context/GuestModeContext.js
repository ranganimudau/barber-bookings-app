import React, { createContext, useCallback, useContext, useMemo, useState } from "react";
import { Alert } from "react-native";

/**
 * Lets someone browse the client side (map, businesses, services, prices)
 * without an account, and only asks them to sign up at the point they try
 * to do something that needs one — booking, saving, or viewing their own
 * appointments.
 *
 * This is browse-only by design: the RLS policies on `barbers` and
 * `barber_services` already grant SELECT to the public role, so a guest
 * reads exactly what a signed-in client reads. Nothing that writes is
 * reachable without a session, so guest mode can't create data.
 */
const GuestModeContext = createContext({
  isGuest: false,
  enterGuestMode: () => {},
  exitGuestMode: () => {},
  requireAccount: () => false,
  pendingBooking: null,
  setPendingBooking: () => {},
  clearPendingBooking: () => {},
});

export function GuestModeProvider({ children }) {
  const [isGuest, setIsGuest] = useState(false);
  // Holds a guest's in-progress service/date/time pick across the
  // sign-up-or-log-in detour, so tapping "Sign up to book" doesn't throw
  // away the choice they just made — see BarberProfile.js and ClientHome.js.
  const [pendingBooking, setPendingBookingState] = useState(null);

  const enterGuestMode = useCallback(() => setIsGuest(true), []);
  const exitGuestMode = useCallback(() => setIsGuest(false), []);
  const setPendingBooking = useCallback((booking) => setPendingBookingState(booking), []);
  const clearPendingBooking = useCallback(() => setPendingBookingState(null), []);

  /**
   * Call at the top of any account-only action. Returns true when the
   * action was blocked (caller should bail out), false when it's fine to
   * continue. Leaving guest mode drops the user back at the auth stack,
   * which starts on Welcome.
   */
  const requireAccount = useCallback(
    (actionLabel = "do this") => {
      if (!isGuest) return false;
      Alert.alert(
        "Create an account",
        `You're browsing as a guest. Sign up or log in to ${actionLabel}.`,
        [
          { text: "Keep browsing", style: "cancel" },
          { text: "Sign up / Log in", onPress: () => setIsGuest(false) },
        ]
      );
      return true;
    },
    [isGuest]
  );

  const value = useMemo(
    () => ({
      isGuest,
      enterGuestMode,
      exitGuestMode,
      requireAccount,
      pendingBooking,
      setPendingBooking,
      clearPendingBooking,
    }),
    [isGuest, enterGuestMode, exitGuestMode, requireAccount, pendingBooking, setPendingBooking, clearPendingBooking]
  );

  return <GuestModeContext.Provider value={value}>{children}</GuestModeContext.Provider>;
}

export function useGuestMode() {
  return useContext(GuestModeContext);
}
