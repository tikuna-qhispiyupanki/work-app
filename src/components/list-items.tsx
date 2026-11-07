import { router } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Icon } from '@/components/icon';
import { Colors, Spacing } from '@/constants/theme';
import { QUOTE_STATUS_LABEL, QuoteListRow, VisitListRow } from '@/db/lists';
import { toDate } from '@/domain/dates';
import { euros } from '@/domain/pricing';

export function VisitItem({ v, showDate }: { v: VisitListRow; showDate?: boolean }) {
  const d = toDate(v.visited_at);
  const when = showDate
    ? `${d.toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric', month: 'short' })} · ${d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}`
    : d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
  const done = v.status === 'faite';
  return (
    <Pressable style={styles.item} onPress={() => router.push({ pathname: '/visites/[id]', params: { id: v.id } })} accessibilityRole="button">
      <Icon name={done ? 'checkmark-circle' : 'ellipse-outline'} size={22} color={done ? Colors.primary : Colors.textSecondary} />
      <View style={{ flex: 1 }}>
        <Text style={styles.title}>{v.client_name || 'Client sans nom'}</Text>
        <Text style={styles.sub}>
          {[[v.site_address, v.site_city].filter(Boolean).join(', ') || 'Adresse à compléter', v.tree_count ? `${v.tree_count} arbre${v.tree_count > 1 ? 's' : ''}` : null]
            .filter(Boolean)
            .join(' · ')}
        </Text>
      </View>
      <Text style={styles.side}>{when}</Text>
    </Pressable>
  );
}

const STATUS_COLOR: Record<string, string> = { brouillon: '#B5651D', finalise: '#1E5AA8', signe: Colors.primary, refuse: Colors.danger };

export function QuoteItem({ q }: { q: QuoteListRow }) {
  return (
    <Pressable style={styles.item} onPress={() => router.push({ pathname: '/devis/[id]', params: { id: q.id } })} accessibilityRole="button">
      <Icon name={q.status === 'signe' ? 'checkmark-done-circle' : 'document-text-outline'} size={22} color={STATUS_COLOR[q.status] ?? Colors.textSecondary} />
      <View style={{ flex: 1 }}>
        <Text style={styles.title}>{q.client_name || 'Client'}</Text>
        <Text style={styles.sub}>
          {q.number ? `${q.number} · ` : ''}<Text style={{ color: STATUS_COLOR[q.status] }}>{QUOTE_STATUS_LABEL[q.status] ?? q.status}</Text> ·{' '}
          {toDate(q.issued_on ?? q.created_at).toLocaleDateString('fr-FR')}
        </Text>
      </View>
      <Text style={[styles.side, { fontWeight: '700', color: Colors.text }]}>{euros(q.total_ttc_cents)}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  item: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, paddingVertical: Spacing.sm, borderTopWidth: 1, borderTopColor: Colors.border },
  title: { fontSize: 17, fontWeight: '500', color: Colors.text },
  sub: { fontSize: 14, color: Colors.textSecondary },
  side: { fontSize: 14, color: Colors.textSecondary },
});
