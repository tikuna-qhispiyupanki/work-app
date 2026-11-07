import { ReactNode } from 'react';
import { Pressable, StyleSheet, Text, TextInput, TextInputProps, View } from 'react-native';

import { Icon, IconName } from '@/components/icon';
import { Colors, Spacing } from '@/constants/theme';

export function Card({ title, children }: { title?: string; children: ReactNode }) {
  return (
    <View style={styles.card}>
      {title ? <Text style={styles.cardTitle}>{title}</Text> : null}
      {children}
    </View>
  );
}

export function Button({ label, onPress, disabled, icon }: { label: string; onPress: () => void; disabled?: boolean; icon?: IconName }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) => [styles.button, (pressed || disabled) && { opacity: 0.6 }]}
    >
      <View style={styles.inner}>
        {icon ? <Icon name={icon} size={20} color={Colors.primaryText} /> : null}
        <Text style={[styles.buttonText, styles.shrink]}>{label}</Text>
      </View>
    </Pressable>
  );
}

export function SecondaryButton({
  label,
  onPress,
  disabled,
  danger,
  icon,
}: {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  danger?: boolean;
  icon?: IconName;
}) {
  const color = danger ? Colors.danger : Colors.primary;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) => [styles.secondary, danger && { borderColor: Colors.danger }, (pressed || disabled) && { opacity: 0.6 }]}
    >
      <View style={styles.inner}>
        {icon ? <Icon name={icon} size={19} color={color} /> : null}
        <Text style={[styles.secondaryText, styles.shrink, { color }]}>{label}</Text>
      </View>
    </Pressable>
  );
}

// Ligne de menu (écran « Plus », menu « ⋯ ») : icône, libellé, flèche.
export function MenuRow({ icon, label, detail, onPress, danger }: { icon: IconName; label: string; detail?: string; onPress: () => void; danger?: boolean }) {
  return (
    <Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel={label} style={({ pressed }) => [styles.menuRow, pressed && { opacity: 0.6 }]}>
      <Icon name={icon} size={22} color={danger ? Colors.danger : Colors.primary} />
      <View style={{ flex: 1 }}>
        <Text style={[styles.menuLabel, danger && { color: Colors.danger }]}>{label}</Text>
        {detail ? <Text style={styles.menuDetail}>{detail}</Text> : null}
      </View>
      <Icon name="chevron-forward" size={18} color={Colors.textSecondary} />
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
  inner: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  shrink: { flexShrink: 1, textAlign: 'center' },
  menuRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12, borderTopWidth: 1, borderTopColor: Colors.border },
  menuLabel: { fontSize: 16, fontWeight: '500', color: Colors.text },
  menuDetail: { fontSize: 13, color: Colors.textSecondary },
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
