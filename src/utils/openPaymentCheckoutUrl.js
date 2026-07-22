import { InteractionManager, Linking, Platform } from "react-native";

/**
 * Opens Paystack (or any https checkout) in the device browser.
 * Prefer Linking on Android — Custom Tabs / expo-web-browser can appear to do "nothing" on some devices.
 */
export function openPaymentCheckoutUrl(url) {
  if (!url || typeof url !== "string") return;

  const run = () => {
    Linking.openURL(url).catch((err) => {
      console.warn("[checkout] Linking.openURL failed:", err?.message);
      if (Platform.OS === "ios") {
        import("expo-web-browser")
          .then((WebBrowser) => WebBrowser.openBrowserAsync(url))
          .catch((e) => console.warn("[checkout] WebBrowser fallback failed:", e?.message));
      }
    });
  };

  InteractionManager.runAfterInteractions(run);
}
