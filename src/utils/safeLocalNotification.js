import { isExpoGoAndroid } from "./isExpoGoAndroid";

export async function scheduleLocalNotificationSafe(content) {
  if (isExpoGoAndroid()) return;
  const Notifications = await import("expo-notifications");
  await Notifications.scheduleNotificationAsync({
    content,
    trigger: null,
  });
}
