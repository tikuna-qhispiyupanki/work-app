import { ReactNode } from 'react';
import { Pressable, StyleSheet, Text, TextInput, TextInputProps, View } from 'react-native';

import { Colors, Spacing } from '@/constants/theme';

export function Card({ title, children }: { title?: string; children: ReactNode }) {
  return (
    <View style={styles.card}>
      {title ? <Text style={styles.cardTitle}>{title}</Text> : null}
      {children}
    </View>
  );
}

export function Button({ label, onPress, disabled }: { label: string; onPress: () => void; disabled?: boolean }) {
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) => [styles.button, (pressed || disabled) && { opacity: 0.6 }]}
    >
      <Text style={styles.buttonText}>{label}</Text>
    </Pressable>
  );
}

export function SecondaryButton({ label, onPress, disabled, danger }: { label: string; onPress: () => void; disabled?: boolean; danger?: boolean }) {
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) => [styles.secondary, danger && { borderColor: Colors.danger }, (pressed || disabled) && { opacity: 0.6 }]}
    >
      <Text style={[styles.secondaryText, danger && { color: Colors.danger }]}>{label}</Text>
    </Pressable>
  );
}

export function Field({ label, ...props }: { label: string } & TextInputProps) {
  return (
    <View style={{ gap: Spacing.xs }}>
      <Text style={styles.label}>{label}</Text>
      <TextInput
        accessibilityLabel={label}
        placeholderTextColor={Colors.textSecondary}
        style={[styles.input, props.multiline && { minHeight: 90, textAlignVertical: 'top' }]}
        {...props}
      />
    </View>
  );
}

export function Muted({ children }: { children: ReactNode }) {
  return <Text style={styles.muted}>{children}</Text>;
}

export const styles = StyleSheet.create({
  card: {
    backgroundColor: Colors.card,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: Spacing.md,
    gap: Spacing.sm,
  },
  cardTitle: { fontSize: 20, fontWeight: '600', color: Colors.text },
  button: {
    backgroundColor: Colors.primary,
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: 'center',
  },
  buttonText: { color: Colors.primaryText, fontSize: 17, fontWeight: '600' },
  secondary: {
    borderWidth: 1.5,
    borderColor: Colors.primary,
    borderRadius: 10,
    paddingVertical: 12,
    paddingHorizontal: 8,
    alignItems: 'center',
    backgroundColor: Colors.card,
  },
  secondaryText: { color: Colors.primary, fontSize: 16, fontWeight: '600', textAlign: 'center' },
  label: { fontSize: 15, fontWeight: '500', color: Colors.text },
  input: {
    backgroundColor: Colors.card,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 17, // 16 px minimum : évite le zoom automatique de Safari iPhone
    color: Colors.text,
  },
  muted: { fontSize: 16, color: Colors.textSecondary },
});
