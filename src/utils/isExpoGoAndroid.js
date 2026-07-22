import { Platform } from "react-native";
import Constants from "expo-constants";

/** SDK 53+: Android Expo Go cannot load remote push / expo-notifications the same way. */
export function isExpoGoAndroid() {
  return Platform.OS === "android" && Constants.appOwnership === "expo";
}
