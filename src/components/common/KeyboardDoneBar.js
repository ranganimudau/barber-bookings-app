import React from "react";
import { Keyboard, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import Icon from "react-native-vector-icons/Ionicons";
import { colors } from "../../theme/clientTheme";

export default function KeyboardDoneBar({ inset }) {
  if (!inset) return null;

  return (
    <View style={[styles.wrap, { bottom: inset - 2 }]}>
      <TouchableOpacity style={styles.btn} onPress={Keyboard.dismiss} activeOpacity={0.85}>
        <Icon name="checkmark-circle-outline" size={16} color={colors.accent} />
        <Text style={styles.text}>Done</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    position: "absolute",
    left: 12,
    right: 12,
    alignItems: "flex-end",
  },
  btn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "#0A0A0A",
    borderWidth: 1,
    borderColor: "rgba(197,160,112,0.45)",
    borderRadius: 999,
    paddingVertical: 8,
    paddingHorizontal: 12,
  },
  text: {
    color: colors.accent,
    fontWeight: "800",
    fontSize: 13,
  },
});

