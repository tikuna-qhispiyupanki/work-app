import { useQuery } from '@powersync/react';
import { useState } from 'react';
import { Image, Linking, Pressable, StyleSheet, Text, View } from 'react-native';

import { confirmAction } from '@/components/confirm';
import { Icon } from '@/components/icon';
import { Button, Card, Muted, SecondaryButton } from '@/components/ui';
import { Colors, Spacing } from '@/constants/theme';
import type { QuoteRow } from '@/db/quotes';
import { activeRequest, cancelSignRequest, createSignRequest, SIGN_REQUESTS_SQL, SignRequestRow, signLink, signMessage } from '@/db/sign-requests';
import { toDate } from '@/domain/dates';
import { euros } from '@/domain/pricing';

const when = (s: string | null) => (s ? toDate(s).toLocaleString('fr-FR', { dateStyle: 'short', timeStyle: 'short' }) : '');

// Le client a-t-il répondu par le lien ? (pour afficher la signature reçue à distance)
export function useRemoteDecision(quoteId: string): SignRequestRow | null {
  const { data } = useQuery<SignRequestRow>(SIGN_REQUESTS_SQL, [quoteId]);
  return data.find((r) => r.status === 'signe' || r.status === 'refuse') ?? null;
}

// Preuve de la signature à distance (affichée quand le devis a été signé par le lien).
export function RemoteProof({ r }: { r: SignRequestRow }) {
  return (
    <View style={{ gap: 4 }}>
      {r.signature_data ? <Image source={{ uri: r.signature_data }} style={styles.signature} accessibilityLabel="Signature du client" resizeMode="contain" /> : null}
      <Muted>Signé à distance par le lien personnel le {when(r.decided_at)}.</Muted>
      {r.signer_ip ? <Muted>Adresse IP : {r.signer_ip}</Muted> : null}
      {r.document_hash ? <Text style={styles.hash}>Empreinte du devis : {r.document_hash}</Text> : null}
    </View>
  );
}

// « Faire signer à distance » : un lien personnel envoyé par SMS, e-mail ou WhatsApp.
export function RemoteSign({ quote, companyName, clientPhone, clientEmail }: { quote: QuoteRow; companyName: string; clientPhone?: string | null; clientEmail?: string | null }) {
  const { data: rows } = useQuery<SignRequestRow>(SIGN_REQUESTS_SQL, [quote.id]);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const active = activeRequest(rows);
  const amount = `${euros(quote.total_ttc_cents)} ${quote.vat_regime === 'franchise' ? 'net' : 'TTC'}`;

  const message = (r: SignRequestRow) => signMessage({ companyName, number: quote.number, amount, link: signLink(r.token), expires: toDate(r.expires_at) });

  const share = async (r: SignRequestRow) => {
    setError(null);
    const text = message(r);
    const nav = typeof navigator !== 'undefined' ? navigator : null;
    if (nav?.share) {
      try {
        await nav.share({ title: `Devis ${quote.number ?? ''}`, text });
        return;
      } catch (e) {
        if (e instanceof Error && e.name === 'AbortError') return; // partage annulé
      }
    }
    await copy(r);
  };
  const copy = async (r: SignRequestRow) => {
    try {
      await navigator.clipboard.writeText(signLink(r.token));
      setCopied(true);
      setTimeout(() => setCopied(false), 3000);
    } catch {
      setError('Copie impossible : sélectionne le lien ci-dessous et copie-le à la main.');
    }
  };
  const create = async () => {
    setError(null);
    try {
      const r = await createSignRequest(quote.id, quote.valid_until);
      await share(r);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  };

  return (
    <Card title="Faire signer à distance">
      {!active ? (
        <>
          <Muted>
            Le client reçoit un lien personnel (SMS, e-mail, WhatsApp…). Il lit le devis sur son téléphone ou son ordinateur et le signe au doigt, sans
            créer de compte. Le lien ne sert qu&apos;une fois et expire au bout de 15 jours (ou à la fin de validité du devis).
          </Muted>
          <Button label="Envoyer un lien de signature" icon="send-outline" onPress={create} />
        </>
      ) : (
        <>
          <View style={styles.status}>
            <Icon name={active.status === 'ouvert' ? 'eye-outline' : 'paper-plane-outline'} size={20} color={Colors.primary} />
            <Text style={styles.text}>
              {active.status === 'ouvert' ? `Lien ouvert par le client le ${when(active.opened_at)}` : `Lien créé le ${when(active.created_at)}, pas encore ouvert`}
            </Text>
          </View>
          <Muted>Valable jusqu&apos;au {toDate(active.expires_at).toLocaleDateString('fr-FR')}. Le devis passera à « Signé » tout seul quand le client aura signé.</Muted>
          <Text style={styles.link} selectable accessibilityLabel="Lien de signature">
            {signLink(active.token)}
          </Text>
          <View style={styles.row}>
            <Quick icon="share-outline" label="Partager" onPress={() => share(active)} />
            <Quick icon="copy-outline" label={copied ? 'Copié ✓' : 'Copier le lien'} onPress={() => copy(active)} />
            {clientPhone ? <Quick icon="chatbubble-outline" label="SMS" onPress={() => Linking.openURL(`sms:${clientPhone.replace(/\s/g, '')}&body=${encodeURIComponent(message(active))}`)} /> : null}
            {clientEmail ? (
              <Quick
                icon="mail-outline"
                label="E-mail"
                onPress={() => Linking.openURL(`mailto:${clientEmail}?subject=${encodeURIComponent(`Devis ${quote.number ?? ''} – ${companyName}`)}&body=${encodeURIComponent(message(active))}`)}
              />
            ) : null}
          </View>
          <SecondaryButton
            label="Annuler ce lien"
            icon="close-circle-outline"
            danger
            onPress={async () => {
              if (await confirmAction('Annuler le lien ?', 'Le client ne pourra plus signer avec ce lien. Tu pourras en envoyer un nouveau.', 'Annuler le lien')) {
                await cancelSignRequest(active.id).catch((e) => setError(String(e)));
              }
            }}
          />
        </>
      )}
      {error ? <Text style={styles.error}>{error}</Text> : null}
    </Card>
  );
}

function Quick({ icon, label, onPress }: { icon: 'share-outline' | 'copy-outline' | 'chatbubble-outline' | 'mail-outline'; label: string; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} style={styles.quick} accessibilityRole="button" accessibilityLabel={label}>
      <Icon name={icon} size={17} color={Colors.primary} />
      <Text style={styles.quickText}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  text: { fontSize: 15, color: Colors.text, flex: 1 },
  status: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  link: { fontSize: 13, color: Colors.primary, backgroundColor: '#EEF2F0', padding: 8, borderRadius: 6 },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm },
  quick: { flexDirection: 'row', alignItems: 'center', gap: 6, borderWidth: 1, borderColor: Colors.primary, borderRadius: 999, paddingHorizontal: 12, paddingVertical: 7 },
  quickText: { color: Colors.primary, fontSize: 15, fontWeight: '600' },
  error: { fontSize: 15, color: Colors.danger },
  signature: { width: 300, maxWidth: '100%', aspectRatio: 600 / 240, backgroundColor: '#fff', borderRadius: 6 },
  hash: { fontSize: 11, color: Colors.textSecondary },
});
