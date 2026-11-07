import { useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';

import { Icon, IconName } from '@/components/icon';
import { Colors, Spacing } from '@/constants/theme';

export type MenuAction = { label: string; icon: IconName; onPress: () => void; danger?: boolean; hidden?: boolean };

// Bouton « ⋯ » d'en-tête qui ouvre une liste d'actions en bas de l'écran.
export function ActionMenu({ actions, label = 'Actions' }: { actions: MenuAction[]; label?: string }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Pressable onPress={() => setOpen(true)} accessibilityRole="button" accessibilityLabel={label} style={{ padding: 8 }}>
        <Icon name="ellipsis-horizontal-circle-outline" size={26} color={Colors.primaryText} />
      </Pressable>
      <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)}>
        <Pressable style={styles.backdrop} onPress={() => setOpen(false)} accessibilityLabel="Fermer le menu">
          <View style={styles.sheet}>
            {actions
              .filter((a) => !a.hidden)
              .map((a) => (
                <Pressable
                  key={a.label}
                  accessibilityRole="button"
                  accessibilityLabel={a.label}
                  style={({ pressed }) => [styles.row, pressed && { backgroundColor: '#EEF2F0' }]}
                  onPress={() => {
                    setOpen(false);
                    a.onPress();
                  }}
                >
                  <Icon name={a.icon} size={22} color={a.danger ? Colors.danger : Colors.primary} />
                  <Text style={[styles.label, a.danger && { color: Colors.danger }]}>{a.label}</Text>
                </Pressable>
              ))}
            <Pressable style={[styles.row, styles.cancel]} onPress={() => setOpen(false)} accessibilityRole="button">
              <Text style={[styles.label, { textAlign: 'center', flex: 1 }]}>Annuler</Text>
            </Pressable>
          </View>
        </Pressable>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.35)', justifyContent: 'flex-end' },
  sheet: { backgroundColor: Colors.card, borderTopLeftRadius: 16, borderTopRightRadius: 16, paddingBottom: Spacing.lg, paddingTop: Spacing.sm, maxWidth: 720, width: '100%', alignSelf: 'center' },
  row: { flexDirection: 'row', alignItems: 'center', gap: 14, paddingHorizontal: Spacing.lg, paddingVertical: 14 },
  label: { fontSize: 17, color: Colors.text },
  cancel: { borderTopWidth: 1, borderTopColor: Colors.border, marginTop: 4 },
});
