import AsyncStorage from "@react-native-async-storage/async-storage";
import React, { createContext, useContext, useEffect, useMemo, useState } from "react";

const STORAGE_KEY = "client_theme_mode";

const dark = {
  background: "#0A0A0A",
  surface: "#121216",
  surfaceAlt: "#0F0F12",
  border: "rgba(197,160,112,0.22)",
  text: "#F8F5F0",
  textSecondary: "#D8D0C4",
  textMuted: "#B8AE9F",
  accent: "#C5A070",
  accentSoft: "rgba(197,160,112,0.15)",
  danger: "#B03535",
};

const light = {
  background: "#F7F4EE",
  surface: "#FFFFFF",
  surfaceAlt: "#F1ECE3",
  border: "rgba(166,124,82,0.28)",
  text: "#1E1A16",
  textSecondary: "#54483B",
  textMuted: "#7C6B58",
  accent: "#A67C52",
  accentSoft: "rgba(166,124,82,0.14)",
  danger: "#A23434",
};

const ClientThemeContext = createContext({
  mode: "dark",
  isDark: true,
  colors: dark,
  toggleMode: () => {},
  setMode: () => {},
});

export function ClientThemeProvider({ children }) {
  const [mode, setMode] = useState("dark");

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const saved = await AsyncStorage.getItem(STORAGE_KEY);
        if (alive && (saved === "dark" || saved === "light")) {
          setMode(saved);
        }
      } catch {
        // ignore storage errors
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  const persistMode = async (next) => {
    setMode(next);
    try {
      await AsyncStorage.setItem(STORAGE_KEY, next);
    } catch {
      // ignore storage errors
    }
  };

  const value = useMemo(() => {
    const isDark = mode !== "light";
    return {
      mode,
      isDark,
      colors: isDark ? dark : light,
      setMode: persistMode,
      toggleMode: () => persistMode(isDark ? "light" : "dark"),
    };
  }, [mode]);

  return (
    <ClientThemeContext.Provider value={value}>
      {children}
    </ClientThemeContext.Provider>
  );
}

export function useClientThemeMode() {
  return useContext(ClientThemeContext);
}

