import { createClient } from '@supabase/supabase-js';
import { useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Image, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';

import { Icon } from '@/components/icon';
import { SignaturePad, SignaturePadHandle } from '@/components/signature-pad';
import { Button, Card, Muted, SecondaryButton } from '@/components/ui';
import { SUPABASE_PUBLISHABLE_KEY, SUPABASE_URL } from '@/config/supabase';
import { Colors, Spacing } from '@/constants/theme';
import { toDate } from '@/domain/dates';
import { euros, percent } from '@/domain/pricing';
import { buildQuotePdf, dataUrlBytes, PdfClient, PdfCompany, PdfLine } from '@/pdf/quote-pdf';
import { shareFile } from '@/pdf/share';

// Page PUBLIQUE (sans compte) ouverte par le client avec son lien personnel : il lit le devis,
// puis le signe au doigt ou le refuse. Elle ne lit rien d'autre que ce devis, par deux fonctions du serveur.
// Aucune base locale, aucune session : un client Supabase anonyme, propre à cette page.
const anon = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false, storageKey: 'arboject-signer' } });

type Doc = {
  number: string | null; issued_on: string | null; valid_until: string | null; vat_regime: string; vat_rate_bp: number;
  company: PdfCompany; client: PdfClient; site_address: string | null; subtotal_ht_cents: number; vat_cents: number; total_ttc_cents: number;
  payment_terms: string | null; deposit_bp: number; notes: string | null; lines: PdfLine[];
};
type Info = {
  state: 'a_signer' | 'signe' | 'refuse' | 'annule' | 'expire' | 'indisponible';
  expires_at: string; decided_at: string | null; signer_name: string | null; document: Doc; document_hash: string;
  signed_hash: string | null; signer_ip: string | null; signature_data: string | null;
};

const FRANCHISE = 'TVA non applicable, art. 293 B du CGI';
const day = (s: string | null) => (s ? toDate(s).toLocaleDateString('fr-FR') : '');
const qty = (n: number) => String(n).replace('.', ',');

const blobToDataUrl = (b: Blob) =>
  new Promise<string>((ok, ko) => {
    const r = new FileReader();
    r.onload = () => ok(String(r.result));
    r.onerror = () => ko(r.error);
    r.readAsDataURL(b);
  });

export default function SignerScreen() {
  const { token } = useLocalSearchParams<{ token: string }>();
  const [info, setInfo] = useState<Info | null>(null);
  const [problem, setProblem] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [agree, setAgree] = useState(false);
  const [ink, setInk] = useState(false);
  const [refusing, setRefusing] = useState(false);
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const pad = useRef<SignaturePadHandle>(null);

  const load = useCallback(async () => {
    setProblem(null);
    const { data, error: e } = await anon.rpc('quote_for_signature', { p_token: token ?? '' });
    if (e) {
      if (typeof navigator !== 'undefined' && !navigator.onLine) setProblem('Pas de connexion Internet : ce lien a besoin du réseau. Réessayez quand vous serez connecté.');
      else if (e.code === 'P0002') setProblem('Ce lien est inconnu. Vérifiez qu’il a été copié en entier, ou demandez un nouveau lien à l’entreprise.');
      else setProblem('Le devis ne peut pas être affiché pour le moment. Réessayez dans quelques minutes.');
      return;
    }
    const i = data as Info;
    setInfo(i);
    if (!name && i.document.client?.name) setName(i.document.client.name);
  }, [token, name]);

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  const decide = async (decision: 'signe' | 'refuse') => {
    if (!info) return;
    setError(null);
    let signature: string | null = null;
    if (decision === 'signe') {
      if (!agree) return setError('Cochez « J’ai lu et j’accepte ce devis ».');
      if (name.trim().length < 2) return setError('Indiquez votre nom.');
      const img = await pad.current?.toJpeg();
      if (!img) return setError('Signez dans le cadre avec le doigt (ou la souris).');
      signature = await blobToDataUrl(img.blob);
    }
    setBusy(true);
    const { error: e } = await anon.rpc('decide_quote_signature', {
      p_token: token,
      p_decision: decision,
      p_signer_name: name.trim(),
      p_signature: signature,
      p_reason: decision === 'refuse' ? reason.trim() : null,
      p_document_hash: info.document_hash,
      p_user_agent: typeof navigator !== 'undefined' ? navigator.userAgent : '',
    });
    setBusy(false);
    if (e) {
      setError(/changé/.test(e.message) ? 'Le devis a été modifié entre-temps : la page va se recharger.' : `Enregistrement impossible : ${e.message}`);
      if (/changé|plus utilisable/.test(e.message)) setTimeout(() => void load(), 1500);
      return;
    }
    await load();
  };

  const pdf = async () => {
    if (!info) return;
    const d = info.document;
    const data = buildQuotePdf({
      quote: { ...d, status: info.state === 'signe' ? 'signe' : 'finalise', signed_at: info.decided_at, signer_name: info.signer_name },
      lines: d.lines,
      company: d.company,
      client: d.client,
      signatureJpeg: info.signature_data ? dataUrlBytes(info.signature_data) : null,
      remoteProof: info.state === 'signe' && info.signed_hash ? { hash: info.signed_hash, ip: info.signer_ip } : null,
    });
    await shareFile(data, `Devis-${d.number ?? ''}${info.state === 'signe' ? '-signe' : ''}.pdf`);
  };

  if (problem) {
    return (
      <Page>
        <Card title="Lien de signature">
          <Text style={styles.text}>{problem}</Text>
          <SecondaryButton label="Réessayer" icon="refresh-outline" onPress={() => void load()} />
        </Card>
      </Page>
    );
  }
  if (!info) {
    return (
      <Page>
        <Muted>Chargement du devis…</Muted>
      </Page>
    );
  }

  const d = info.document;
  const c = d.company ?? {};
  const cl = d.client ?? {};
  const franchise = d.vat_regime === 'franchise';
  const offered = d.lines.filter((l) => l.offered).reduce((s, l) => s + l.total_ht_cents, 0);

  return (
    <Page>
      <View style={styles.header}>
        <Text style={styles.company}>{c.name}</Text>
        <Muted>{[c.address, [c.postal_code, c.city].filter(Boolean).join(' ')].filter(Boolean).join(', ')}</Muted>
        <Muted>{[c.phone, c.email, c.siret ? `SIRET ${c.siret}` : null].filter(Boolean).join(' · ')}</Muted>
      </View>

      <StateBanner info={info} />

      <Card title={`Devis ${d.number ?? ''}`}>
        <Muted>
          Émis le {day(d.issued_on)} · valable jusqu&apos;au {day(d.valid_until)} · devis gratuit
        </Muted>
        <Text style={styles.text}>
          Client : {cl.name}
          {cl.address || cl.city ? `\n${[cl.address, [cl.postal_code, cl.city].filter(Boolean).join(' ')].filter(Boolean).join(', ')}` : ''}
        </Text>
        {d.site_address ? <Text style={styles.text}>Chantier : {d.site_address}</Text> : null}
      </Card>

      <Card title="Détail">
        {d.lines.map((l, i) => (
          <View key={i} style={styles.line}>
            <View style={{ flex: 1 }}>
              <Text style={styles.text}>{l.label}</Text>
              <Muted>
                {qty(l.quantity)} {l.unit ?? ''} × {euros(l.unit_price_ht_cents)} HT{l.surcharge_bp ? ` + ${percent(l.surcharge_bp)}` : ''}
              </Muted>
            </View>
            <Text style={[styles.amount, !!l.offered && styles.offered]}>{l.offered ? `Offert\n(${euros(l.total_ht_cents)})` : euros(l.total_ht_cents)}</Text>
          </View>
        ))}
        <View style={styles.totals}>
          <Row label="Total HT" value={euros(d.subtotal_ht_cents)} />
          {franchise ? <Muted>{FRANCHISE}</Muted> : <Row label={`TVA ${percent(d.vat_rate_bp)}`} value={euros(d.vat_cents)} />}
          <Row label={franchise ? 'Net à payer' : 'Total TTC'} value={euros(d.total_ttc_cents)} strong />
          {offered ? <Muted>Geste commercial : {euros(offered)} HT offerts.</Muted> : null}
        </View>
      </Card>

      <Card title="Conditions">
        <Text style={styles.text}>{d.payment_terms}</Text>
        {d.deposit_bp ? <Muted>Acompte à la signature : {percent(d.deposit_bp)}.</Muted> : <Muted>Aucun acompte demandé.</Muted>}
        {d.notes ? <Text style={styles.text}>{d.notes}</Text> : null}
      </Card>

      {info.state === 'a_signer' && !refusing ? (
        <Card title="Bon pour accord">
          <Pressable style={styles.check} onPress={() => setAgree(!agree)} accessibilityRole="checkbox" aria-checked={agree} accessibilityLabel="J’ai lu et j’accepte ce devis">
            <Icon name={agree ? 'checkbox' : 'square-outline'} size={26} color={Colors.primary} />
            <Text style={[styles.text, { flex: 1 }]}>
              J&apos;ai lu et j&apos;accepte ce devis ({euros(d.total_ttc_cents)} {franchise ? 'net à payer' : 'TTC'}) et ses conditions : « Bon pour accord ».
            </Text>
          </Pressable>
          <Text style={styles.label}>Votre nom</Text>
          <TextInput value={name} onChangeText={setName} style={styles.input} accessibilityLabel="Votre nom" autoCapitalize="words" autoComplete="name" />
          <Text style={styles.label}>Votre signature</Text>
          <SignaturePad ref={pad} onInk={setInk} />
          {error ? <Text style={styles.error}>{error}</Text> : null}
          <Button label={busy ? 'Enregistrement…' : 'Signer le devis'} icon="create-outline" onPress={() => void decide('signe')} disabled={busy || !ink || !agree} />
          <Muted>
            Signature électronique : la date, l&apos;heure, votre adresse IP et l&apos;empreinte du devis sont enregistrées comme preuve. Ce lien ne sert
            qu&apos;une fois.
          </Muted>
          <SecondaryButton label="Je refuse ce devis" danger onPress={() => setRefusing(true)} />
        </Card>
      ) : null}

      {info.state === 'a_signer' && refusing ? (
        <Card title="Refuser le devis">
          <Text style={styles.label}>Motif (facultatif, transmis à l&apos;entreprise)</Text>
          <TextInput value={reason} onChangeText={setReason} style={[styles.input, { minHeight: 80 }]} multiline accessibilityLabel="Motif du refus" />
          {error ? <Text style={styles.error}>{error}</Text> : null}
          <Button label={busy ? 'Enregistrement…' : 'Confirmer le refus'} onPress={() => void decide('refuse')} disabled={busy} />
          <SecondaryButton label="Retour" onPress={() => setRefusing(false)} />
        </Card>
      ) : null}

      <SecondaryButton label={info.state === 'signe' ? 'Télécharger mon exemplaire signé (PDF)' : 'Télécharger le devis (PDF)'} icon="document-text-outline" onPress={() => void pdf()} />
      <Text style={styles.footer}>Arboject · page sécurisée de signature du devis</Text>
    </Page>
  );
}

function StateBanner({ info }: { info: Info }) {
  const m: Record<Info['state'], [string, string] | null> = {
    a_signer: null,
    signe: ['checkmark-circle', `Devis signé le ${info.decided_at ? toDate(info.decided_at).toLocaleString('fr-FR', { dateStyle: 'long', timeStyle: 'short' }) : ''} par ${info.signer_name ?? ''}. Merci ! L’entreprise est prévenue.`],
    refuse: ['close-circle', 'Vous avez refusé ce devis. L’entreprise est prévenue.'],
    annule: ['alert-circle', 'Ce lien a été annulé par l’entreprise. Demandez-lui un nouveau lien si besoin.'],
    expire: ['time', `Ce lien a expiré le ${toDate(info.expires_at).toLocaleDateString('fr-FR')}. Demandez un nouveau lien à l’entreprise.`],
    indisponible: ['alert-circle', 'Ce devis ne peut plus être signé par ce lien (il a déjà reçu une réponse ou a été remplacé).'],
  };
  const v = m[info.state];
  if (!v) return null;
  return (
    <View style={[styles.banner, info.state === 'signe' && { backgroundColor: '#E3F0E8' }]}>
      <Icon name={v[0] as 'checkmark-circle'} size={24} color={info.state === 'signe' ? Colors.primary : Colors.warning} />
      <Text style={[styles.text, { flex: 1 }]}>{v[1]}</Text>
      {info.state === 'signe' && info.signature_data ? <Image source={{ uri: info.signature_data }} style={styles.sig} resizeMode="contain" accessibilityLabel="Votre signature" /> : null}
    </View>
  );
}

function Row({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <View style={styles.row}>
      <Text style={[styles.text, strong && styles.strong]}>{label}</Text>
      <Text style={[styles.text, strong && styles.strong]}>{value}</Text>
    </View>
  );
}

function Page({ children }: { children: React.ReactNode }) {
  return (
    <ScrollView style={{ flex: 1, backgroundColor: Colors.background }} contentContainerStyle={styles.page} keyboardShouldPersistTaps="handled">
      {children}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  page: { padding: Spacing.md, gap: Spacing.md, paddingBottom: Spacing.xl, width: '100%', maxWidth: 720, alignSelf: 'center' },
  header: { backgroundColor: Colors.primary, borderRadius: 12, padding: Spacing.md, gap: 2 },
  company: { fontSize: 22, fontWeight: '700', color: Colors.primaryText },
  text: { fontSize: 16, color: Colors.text },
  strong: { fontWeight: '700', fontSize: 17 },
  label: { fontSize: 15, fontWeight: '600', color: Colors.text },
  input: { fontSize: 16, borderWidth: 1, borderColor: Colors.border, borderRadius: 8, padding: 10, backgroundColor: Colors.card, color: Colors.text },
  line: { flexDirection: 'row', gap: Spacing.sm, paddingVertical: 8, borderTopWidth: 1, borderTopColor: Colors.border },
  amount: { fontSize: 16, fontWeight: '600', color: Colors.text, textAlign: 'right' },
  offered: { color: Colors.primary },
  totals: { borderTopWidth: 2, borderTopColor: Colors.primary, paddingTop: 8, gap: 4 },
  row: { flexDirection: 'row', justifyContent: 'space-between' },
  check: { flexDirection: 'row', alignItems: 'flex-start', gap: Spacing.sm },
  error: { fontSize: 15, color: Colors.danger },
  banner: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: Spacing.sm, backgroundColor: '#F6E7D6', borderRadius: 10, padding: Spacing.md },
  sig: { width: 200, height: 80, backgroundColor: '#fff', borderRadius: 6 },
  footer: { fontSize: 12, color: Colors.textSecondary, textAlign: 'center' },
});
