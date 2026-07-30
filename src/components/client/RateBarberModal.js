import React, { useState } from "react";
import {
    ActivityIndicator,
    Alert,
    Modal,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from "react-native";
import Icon from "react-native-vector-icons/Ionicons";
import { borderRadius, colors, shadows, typography } from "../../theme/clientTheme";

const STAR_COUNT = 5;

export default function RateBarberModal({ visible, onClose, appointment, onSubmit }) {
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async () => {
    if (rating < 1 || rating > STAR_COUNT) {
      Alert.alert("Select a rating", "Tap the stars to rate from 1 to 5.");
      return;
    }
    setSubmitting(true);
    try {
      await onSubmit({ rating, comment: comment.trim() || null });
      setRating(0);
      setComment("");
      onClose();
    } catch (err) {
      Alert.alert("Error", err.message || "Could not submit rating.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleClose = () => {
    if (!submitting) {
      setRating(0);
      setComment("");
      onClose();
    }
  };

  if (!appointment) return null;

  const shopName = appointment.barbers?.shop_name || "Professional";

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={handleClose}
    >
      <TouchableOpacity
        style={styles.overlay}
        activeOpacity={1}
        onPress={handleClose}
      >
        <TouchableOpacity activeOpacity={1} onPress={(e) => e.stopPropagation()} style={styles.content}>
          <View style={styles.header}>
            <Text style={styles.title}>Rate your visit</Text>
            <Text style={styles.shopName}>{shopName}</Text>
            <TouchableOpacity onPress={handleClose} style={styles.closeBtn} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
              <Icon name="close" size={24} color={colors.textSecondary} />
            </TouchableOpacity>
          </View>

          <Text style={styles.label}>Your rating</Text>
          <View style={styles.starsRow}>
            {[1, 2, 3, 4, 5].map((value) => (
              <TouchableOpacity
                key={value}
                onPress={() => setRating(value)}
                style={styles.starBtn}
                activeOpacity={0.7}
              >
                <Icon
                  name={rating >= value ? "star" : "star-outline"}
                  size={40}
                  color={rating >= value ? colors.accent : colors.border}
                />
              </TouchableOpacity>
            ))}
          </View>

          <Text style={styles.label}>Comment (optional)</Text>
          <TextInput
            style={styles.input}
            value={comment}
            onChangeText={setComment}
            placeholder="How was your experience?"
            placeholderTextColor={colors.textMuted}
            multiline
            numberOfLines={3}
            maxLength={300}
          />

          <TouchableOpacity
            style={[styles.submitBtn, submitting && styles.submitBtnDisabled]}
            onPress={handleSubmit}
            disabled={submitting}
            activeOpacity={0.85}
          >
            {submitting ? (
              <ActivityIndicator color={colors.white} />
            ) : (
              <>
                <Icon name="send" size={20} color={colors.white} />
                <Text style={styles.submitBtnText}>Submit rating</Text>
              </>
            )}
          </TouchableOpacity>
        </TouchableOpacity>
      </TouchableOpacity>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "center",
    alignItems: "center",
    padding: 24,
  },
  content: {
    width: "100%",
    maxWidth: 400,
    backgroundColor: colors.surface,
    borderRadius: borderRadius.lg,
    padding: 24,
    ...shadows.floating,
  },
  header: { position: "relative", marginBottom: 20 },
  closeBtn: { position: "absolute", top: -4, right: -4 },
  title: { ...typography.titleSmall, color: colors.text, marginBottom: 4 },
  shopName: { fontSize: 15, color: colors.textSecondary },
  label: { fontSize: 14, fontWeight: "600", color: colors.text, marginTop: 16, marginBottom: 8 },
  starsRow: { flexDirection: "row", justifyContent: "center", gap: 8, marginBottom: 8 },
  starBtn: { padding: 4 },
  input: {
    backgroundColor: colors.background,
    borderRadius: borderRadius.md,
    padding: 14,
    fontSize: 15,
    color: colors.text,
    borderWidth: 1,
    borderColor: colors.border,
    minHeight: 80,
    textAlignVertical: "top",
  },
  submitBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: colors.primary,
    paddingVertical: 16,
    borderRadius: borderRadius.lg,
    marginTop: 24,
    ...shadows.button,
  },
  submitBtnDisabled: { opacity: 0.7 },
  submitBtnText: { ...typography.button, color: colors.white },
});
