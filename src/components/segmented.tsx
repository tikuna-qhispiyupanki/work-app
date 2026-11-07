import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Colors } from '@/constants/theme';

// Onglets en haut d'une page (ex. visite : Infos · Arbres · Photos · Croquis · Devis).
// Largeurs selon le texte, tout tient sur la largeur d'un iPhone ; le nombre d'éléments est une petite pastille.
export function Segmented<T extends string>({ items, value, onChange }: { items: { key: T; label: string; count?: number }[]; value: T; onChange: (v: T) => void }) {
  return (
    <View style={styles.bar} accessibilityRole="tablist">
      {items.map((it) => {
        const on = it.key === value;
        return (
          <Pressable key={it.key} onPress={() => onChange(it.key)} accessibilityRole="tab" accessibilityState={{ selected: on }} accessibilityLabel={it.label} style={[styles.tab, on && styles.tabOn]}>
            <Text style={[styles.text, on && styles.textOn]} numberOfLines={1}>
              {it.label}
            </Text>
            {it.count ? (
              <View style={[styles.count, on && styles.countOn]}>
                <Text style={[styles.countText, on && { color: Colors.primary }]}>{it.count}</Text>
              </View>
            ) : null}
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  bar: { flexDirection: 'row', flexWrap: 'wrap', gap: 4, paddingHorizontal: 12, paddingVertical: 8 },
  tab: { flexGrow: 1, flexShrink: 1, flexBasis: 'auto', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 3, borderRadius: 999, paddingHorizontal: 8, paddingVertical: 8, backgroundColor: Colors.card, borderWidth: 1, borderColor: Colors.border, minWidth: 0 },
  tabOn: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  text: { fontSize: 14, fontWeight: '600', color: Colors.text, flexShrink: 1 },
  textOn: { color: Colors.primaryText },
  count: { minWidth: 18, height: 18, borderRadius: 9, paddingHorizontal: 4, backgroundColor: Colors.primary, alignItems: 'center', justifyContent: 'center' },
  countOn: { backgroundColor: Colors.primaryText },
  countText: { fontSize: 11, fontWeight: '700', color: Colors.primaryText },
});
