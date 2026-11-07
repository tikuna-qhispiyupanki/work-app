import { useRef, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { confirmAction } from '@/components/confirm';
import { LocalImage } from '@/components/local-image';
import { SignaturePad, SignaturePadHandle } from '@/components/signature-pad';
import { Button, Card, Field, Muted, SecondaryButton } from '@/components/ui';
import { Colors, Spacing } from '@/constants/theme';
import { QuoteRow, refuseQuote, signQuote } from '@/db/quotes';
import { toDate } from '@/domain/dates';
import { quickPosition } from '@/domain/geo';
import { euros } from '@/domain/pricing';
import { kickUploader } from '@/sync/uploader';

// Signature du client (« Bon pour accord ») sur un devis finalisé. Fonctionne sans réseau.
export function QuoteSign({ quote, clientName }: { quote: QuoteRow; clientName: string | null | undefined }) {
  const pad = useRef<SignaturePadHandle>(null);
  const [name, setName] = useState(clientName ?? '');
  const [ink, setInk] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (quote.status === 'signe') {
    return (
      <Card title="✓ Signé par le client">
        <Text style={styles.text}>
          Bon pour accord, signé le {toDate(quote.signed_at).toLocaleString('fr-FR', { dateStyle: 'long', timeStyle: 'short' })} par {quote.signer_name}.
        </Text>
        {quote.signature_photo_id ? (
          <View style={{ maxWidth: 320 }}>
            <LocalImage fileId={quote.signature_photo_id} alt="Signature du client" aspectRatio={600 / 240} companyId={quote.company_id} uploaded />
          </View>
        ) : null}
      </Card>
    );
  }
  if (quote.status === 'refuse') return <Card title="Refusé par le client"><Muted>Ce devis a été marqué comme refusé.</Muted></Card>;
  if (quote.status !== 'finalise') return null;

  const sign = async () => {
    setError(null);
    if (!name.trim()) return setError('Indique le nom de la personne qui signe.');
    const image = await pad.current?.toJpeg();
    if (!image) return setError('Le client doit signer dans le cadre.');
    setBusy(true);
    try {
      const position = await quickPosition(3000);
      await signQuote(quote.id, name, image, position);
      kickUploader();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card title="✍️ Signature du client">
      <Text style={styles.text}>
        Le client accepte le devis {quote.number} d&apos;un montant de {euros(quote.total_ttc_cents)} {quote.vat_regime === 'franchise' ? '(net à payer)' : 'TTC'} et ses conditions : « Bon pour accord ».
      </Text>
      <Field label="Nom de la personne qui signe" value={name} onChangeText={setName} autoCapitalize="words" />
      <SignaturePad ref={pad} onInk={setInk} />
      {error ? <Text style={styles.error}>{error}</Text> : null}
      <Button label={busy ? 'Enregistrement…' : '✍️ Valider la signature (Bon pour accord)'} onPress={sign} disabled={busy || !ink} />
      <SecondaryButton
        label="Le client refuse le devis"
        danger
        onPress={async () => {
          if (await confirmAction('Marquer le devis comme refusé ?', 'Il restera dans l’historique du client.', 'Refusé')) await refuseQuote(quote.id).catch((e) => setError(String(e)));
        }}
      />
    </Card>
  );
}

const styles = StyleSheet.create({
  text: { fontSize: 15, color: Colors.text },
  error: { fontSize: 15, color: Colors.danger },
});
