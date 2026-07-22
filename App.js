import AsyncStorage from "@react-native-async-storage/async-storage";
import { NavigationContainer } from "@react-navigation/native";
import { createStackNavigator } from "@react-navigation/stack";
import * as Linking from "expo-linking";
import React, { useEffect, useRef, useState } from "react";
import { ActivityIndicator, Platform, View } from "react-native";
import Constants from "expo-constants";
import * as Device from "expo-device";
import { StatusBar } from "expo-status-bar";
import { SafeAreaProvider } from "react-native-safe-area-context";
import AuthStack from "./src/navigation/AuthStack";
import BarberStack from "./src/navigation/BarberStack";
import ClientStack from "./src/navigation/ClientStack";
import ResetPassword, {
  AUTH_OPEN_LOGIN_AFTER_RESET_KEY,
} from "./src/screens/auth/ResetPassword";
import ProfileSetup from "./src/screens/barber/ProfileSetup";
import SubscriptionPaywall from "./src/screens/barber/SubscriptionPaywall";
import { ClientThemeProvider } from "./src/theme/ClientThemeMode";
import { supabase } from "./src/supabase/supabaseClient";
import { isExpoGoAndroid } from "./src/utils/isExpoGoAndroid";
import {
  parseSupabaseAuthParams,
  shouldOpenPasswordRecovery,
} from "./src/utils/parseSupabaseAuthUrl";

const Stack = createStackNavigator();

export default function App() {
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState(null);
  const [role, setRole] = useState(null);
  const [isSetupComplete, setIsSetupComplete] = useState(false);
  const [passwordRecovery, setPasswordRecovery] = useState(false);
  const passwordRecoveryRef = useRef(false);
  const notificationsModRef = useRef(null);

  useEffect(() => {
    let cancelled = false;
    let authSubscription = null;
    let linkingSubscription = null;

    const configureAndroidNotificationChannel = async (Notifications) => {
      try {
        if (Platform.OS !== "android") return;
        await Notifications.setNotificationChannelAsync("default", {
          name: "default",
          importance: Notifications.AndroidImportance.HIGH,
          vibrationPattern: [0, 250, 250, 250],
          lightColor: "#2563EB",
        });
      } catch (error) {
        console.log("Notification channel setup failed:", error?.message);
      }
    };

    const requestNotificationPermission = async (Notifications) => {
      try {
        const { status } = await Notifications.getPermissionsAsync();
        if (status !== "granted") {
          await Notifications.requestPermissionsAsync();
        }
      } catch (error) {
        console.log("Notification permission failed:", error?.message);
      }
    };

    const registerExpoPushToken = async (userId) => {
      const Notifications = notificationsModRef.current;
      if (!Notifications) return;
      try {
        if (!userId) {
          console.warn("[Push] Skipped: no user id (not signed in).");
          return;
        }
        if (!Device.isDevice) {
          console.warn(
            "[Push] Skipped: not a physical device (simulator / emulator). Use a real phone for push tokens."
          );
          return;
        }
        if (isExpoGoAndroid()) {
          console.warn("[Push] Skipped: Android Expo Go cannot register remote push tokens.");
          return;
        }

        const { status: existingStatus } = await Notifications.getPermissionsAsync();
        let finalStatus = existingStatus;
        if (existingStatus !== "granted") {
          const { status } = await Notifications.requestPermissionsAsync();
          finalStatus = status;
        }
        if (finalStatus !== "granted") {
          console.warn("[Push] Skipped: notification permission not granted.");
          return;
        }

        const projectId =
          Constants?.expoConfig?.extra?.eas?.projectId ||
          Constants?.easConfig?.projectId;
        if (!projectId) {
          console.warn(
            "[Push] Skipped: missing EAS projectId in app config. Rebuild dev client after eas init / app.json extra.eas.projectId."
          );
          return;
        }

        const tokenResponse = await Notifications.getExpoPushTokenAsync({ projectId });
        const expoPushToken = tokenResponse?.data;
        if (!expoPushToken) {
          console.warn("[Push] Skipped: getExpoPushTokenAsync returned no token.", tokenResponse);
          return;
        }

        const { error: upsertError } = await supabase.from("user_push_tokens").upsert(
          {
            user_id: userId,
            token: expoPushToken,
            device_type: Device.osName || "unknown",
            updated_at: new Date().toISOString(),
          },
          { onConflict: "user_id,token" }
        );

        if (upsertError) {
          console.warn("[Push] Supabase upsert failed:", upsertError.message, upsertError);
          return;
        }

        console.log("[Push] Token saved for user", userId, "→", expoPushToken.slice(0, 28) + "…");
      } catch (error) {
        console.warn("[Push] registerExpoPushToken error:", error?.message, error);
      }
    };

    const fetchUserData = async (userId) => {
      try {
        const { data: profile } = await supabase.from("profiles").select("role").eq("id", userId).single();
        if (profile) {
          setRole(profile.role);
          if (profile.role === "barber") {
            const { data: barber } = await supabase
              .from("barbers")
              .select("is_profile_complete")
              .eq("id", userId)
              .single();
            setIsSetupComplete(barber?.is_profile_complete || false);
          }
        }
      } catch (error) {
        console.error("Error fetching user data:", error.message);
      }
    };

    const handleAuthDeepLink = async (url) => {
      if (!url) return;
      const params = parseSupabaseAuthParams(url);
      if (!shouldOpenPasswordRecovery(url, params)) return;

      try {
        await AsyncStorage.removeItem(AUTH_OPEN_LOGIN_AFTER_RESET_KEY);
      } catch {
        /* ignore */
      }

      passwordRecoveryRef.current = true;
      setPasswordRecovery(true);

      if (params.code) {
        const { error } = await supabase.auth.exchangeCodeForSession(params.code);
        if (error) {
          console.warn("Recovery code exchange error:", error.message);
          passwordRecoveryRef.current = false;
          setPasswordRecovery(false);
        }
        return;
      }

      if (!params?.access_token || !params?.refresh_token) {
        passwordRecoveryRef.current = false;
        setPasswordRecovery(false);
        return;
      }

      const { error } = await supabase.auth.setSession({
        access_token: params.access_token,
        refresh_token: params.refresh_token,
      });
      if (error) {
        console.warn("Recovery session error:", error.message);
        passwordRecoveryRef.current = false;
        setPasswordRecovery(false);
      }
    };

    (async () => {
      if (!isExpoGoAndroid()) {
        try {
          const Notifications = await import("expo-notifications");
          if (cancelled) return;
          notificationsModRef.current = Notifications;
          Notifications.setNotificationHandler({
            handleNotification: async () => ({
              shouldShowAlert: true,
              shouldPlaySound: true,
              shouldSetBadge: false,
            }),
          });
          await configureAndroidNotificationChannel(Notifications);
          await requestNotificationPermission(Notifications);
        } catch (e) {
          console.warn("[Notifications] init failed:", e?.message);
        }
      } else {
        console.warn("[Notifications] Skipped on Android Expo Go (SDK 53+). Use a dev build for push.");
      }

      if (cancelled) return;

      const { data: authListener } = supabase.auth.onAuthStateChange(async (event, session) => {
        if (event === "PASSWORD_RECOVERY" && session) {
          passwordRecoveryRef.current = true;
          setPasswordRecovery(true);
          setUser(session.user);
          setLoading(false);
          return;
        }

        if (event === "SIGNED_OUT") {
          passwordRecoveryRef.current = false;
          setPasswordRecovery(false);
          setUser(null);
          setRole(null);
          setIsSetupComplete(false);
          setLoading(false);
          return;
        }

        if (session) {
          if (passwordRecoveryRef.current) {
            setUser(session.user);
            setLoading(false);
            return;
          }
          setUser(session.user);
          registerExpoPushToken(session.user.id);
          await fetchUserData(session.user.id);
        } else {
          setUser(null);
          setRole(null);
          setIsSetupComplete(false);
        }
        setLoading(false);
      });

      authSubscription = authListener;

      try {
        const initialUrl = await Linking.getInitialURL();
        if (initialUrl) await handleAuthDeepLink(initialUrl);
      } catch (e) {
        console.warn("Initial URL handling failed:", e?.message);
      }
      if (cancelled) {
        authSubscription?.subscription?.unsubscribe();
        authSubscription = null;
        return;
      }

      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (cancelled) {
        authSubscription?.subscription?.unsubscribe();
        authSubscription = null;
        return;
      }
      if (session) {
        if (passwordRecoveryRef.current) {
          setUser(session.user);
        } else {
          setUser(session.user);
          registerExpoPushToken(session.user.id);
          await fetchUserData(session.user.id);
        }
      }
      setLoading(false);

      if (cancelled) {
        authSubscription?.subscription?.unsubscribe();
        authSubscription = null;
        return;
      }

      linkingSubscription = Linking.addEventListener("url", ({ url }) => {
        handleAuthDeepLink(url);
      });
    })();

    return () => {
      cancelled = true;
      authSubscription?.subscription?.unsubscribe();
      linkingSubscription?.remove();
    };
  }, []);

  if (loading)
    return (
      <View style={{ flex: 1, justifyContent: "center", backgroundColor: "#fff" }}>
        <ActivityIndicator size="large" color="#000" />
      </View>
    );

  return (
    <SafeAreaProvider>
      <ClientThemeProvider>
        <StatusBar style="light" backgroundColor="#0A0A0A" translucent={false} />
        <NavigationContainer>
          <Stack.Navigator screenOptions={{ headerShown: false }}>
            {passwordRecovery ? (
              <Stack.Screen name="ResetPassword" component={ResetPassword} />
            ) : user && role ? (
              role === "barber" ? (
                <>
                  {!isSetupComplete ? (
                    <Stack.Screen name="ProfileSetup" component={ProfileSetup} />
                  ) : (
                    <Stack.Screen name="BarberStack" component={BarberStack} />
                  )}
                  <Stack.Screen name="SubscriptionPaywall" component={SubscriptionPaywall} />
                  <Stack.Screen name="BarberDashboard" component={BarberStack} />
                </>
              ) : (
                <Stack.Screen name="ClientStack" component={ClientStack} />
              )
            ) : (
              <Stack.Screen name="AuthStack" component={AuthStack} />
            )}
          </Stack.Navigator>
        </NavigationContainer>
      </ClientThemeProvider>
    </SafeAreaProvider>
  );
}
