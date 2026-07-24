import React from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import { useRoute } from "@react-navigation/native";
import { colors } from "../../theme/barberTheme";

export default function SupportInfo() {
  const route = useRoute();
  const { body, draft } = route.params || {};

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      {draft ? (
        <View style={styles.draftTag}>
          <Text style={styles.draftTagText}>Draft — placeholder content, subject to change</Text>
        </View>
      ) : null}
      <Text style={styles.body}>{body}</Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  content: { padding: 20, paddingBottom: 40 },
  draftTag: {
    alignSelf: "flex-start",
    backgroundColor: colors.pendingBg,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 6,
    marginBottom: 16,
  },
  draftTagText: { color: colors.pending, fontSize: 12, fontWeight: "700" },
  body: { fontSize: 14, color: colors.textSecondary, lineHeight: 22 },
});
