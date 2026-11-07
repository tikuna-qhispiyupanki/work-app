import { createClient } from '@supabase/supabase-js';
import { useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { Image, ScrollView, StyleSheet, Text, View } from 'react-native';

import { Card, Muted, SecondaryButton } from '@/components/ui';
import { SUPABASE_PUBLISHABLE_KEY, SUPABASE_URL } from '@/config/supabase';
import { Colors, Spacing } from '@/constants/theme';
import { toDate } from '@/domain/dates';
import { orderPhotos, STAGE_LABEL } from '@/domain/report';
import { buildReportPdf } from '@/pdf/report-pdf';
import { shareFile } from '@/pdf/share';

// Page PUBLIQUE (sans compte) : le client voit le rapport de fin de chantier avec son lien personnel.
// Elle ne lit rien d'autre que ce rapport, par une seule fonction du serveur.
const anon = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false, storageKey: 'arboject-rapport' } });

type Photo = { url: string; stage: string | null; caption: string | null; width: number; height: number };
type Data = {
  state: 'ok' | 'expire';
  expires_at: string;
  company?: { name: string | null; address: string | null; postal_code: string | null; city: string | null; phone: string | null; email: string | null; siret: string | null };
  job?: { title: string | null; site_address: string | null };
  client?: { name?: string | null };
  quote_number?: string | null;
  report?: { works_done: string | null; remarks: string | null; advice: string | null; finished_on: string | null; status: string; client_signer_name: string | null; client_signed_at: string | null; client_reserves: string | null } | null;
  photos?: Photo[] | string;
};

export default function ReportScreen() {
  const { token } = useLocalSearchParams<{ token: string }>();
  const [d, setD] = useState<Data | null>(null);
  const [problem, setProblem] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    void (async () => {
      const { data, error } = await anon.rpc('report_for_client', { p_token: token ?? '' });
      if (error) {
        if (typeof navigator !== 'undefined' && !navigator.onLine) setProblem('Pas de connexion Internet : ce lien a besoin du réseau.');
        else if (error.code === 'P0002') setProblem('Ce lien est inconnu. Vérifiez qu’il a été copié en entier, ou demandez un nouveau lien à l’entreprise.');
        else setProblem('Le rapport ne peut pas être affiché pour le moment. Réessayez dans quelques minutes.');
        return;
      }
      setD(data as Data);
    })();
  }, [token]);

  if (problem) return <Page><Card title="Rapport de chantier"><Text style={styles.text}>{problem}</Text></Card></Page>;
  if (!d) return <Page><Muted>Chargement du rapport…</Muted></Page>;
  if (d.state === 'expire') {
    return (
      <Page>
        <Card title="Rapport de chantier">
          <Text style={styles.text}>Ce lien a expiré le {toDate(d.expires_at).toLocaleDateString('fr-FR')}. Demandez un nouveau lien à l&apos;entreprise.</Text>
        </Card>
      </Page>
    );
  }
  const c = d.company ?? { name: null, address: null, postal_code: null, city: null, phone: null, email: null, siret: null };
  const r = d.report;
  const photos = orderPhotos((typeof d.photos === 'string' ? (JSON.parse(d.photos) as Photo[]) : d.photos) ?? []);

  const pdf = async () => {
    if (!r) return;
    setBusy(true);
    try {
      const imgs = [];
      for (const p of photos) {
        const res = await fetch(p.url);
        if (res.ok) imgs.push({ jpeg: new Uint8Array(await res.arrayBuffer()), width: p.width, height: p.height, stage: p.stage, caption: p.caption });
      }
      const data = buildReportPdf({
        company: c,
        client: d.client ?? {},
        jobTitle: d.job?.title ?? 'Chantier',
        siteAddress: d.job?.site_address ?? null,
        quoteNumber: d.quote_number ?? null,
        report: r,
        photos: imgs,
      });
      await shareFile(data, 'Rapport-de-chantier.pdf');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Page>
      <View style={styles.header}>
        <Text style={styles.company}>{c.name}</Text>
        <Text style={styles.headerText}>{[c.address, [c.postal_code, c.city].filter(Boolean).join(' ')].filter(Boolean).join(', ')}</Text>
        <Text style={styles.headerText}>{[c.phone, c.email].filter(Boolean).join(' · ')}</Text>
      </View>
      <Card title="Rapport de fin de chantier">
        {d.client?.name ? <Text style={styles.text}>Client : {d.client.name}</Text> : null}
        {d.job?.site_address ? <Text style={styles.text}>Chantier : {d.job.site_address}</Text> : null}
        {r?.finished_on ? <Muted>Travaux terminés le {toDate(r.finished_on).toLocaleDateString('fr-FR')}</Muted> : null}
      </Card>
      {r ? (
        <>
          <Card title="Travaux réalisés">
            <Text style={styles.text}>{r.works_done || '-'}</Text>
            {r.remarks ? <Text style={styles.text}>{r.remarks}</Text> : null}
          </Card>
          {photos.length ? (
            <Card title={`Photos (${photos.length})`}>
              {photos.map((p, i) => (
                <View key={i} style={{ gap: 4 }}>
                  <Text style={styles.stage}>{[p.stage ? STAGE_LABEL[p.stage] : null, p.caption].filter(Boolean).join(' – ')}</Text>
                  <Image source={{ uri: p.url }} style={[styles.photo, { aspectRatio: p.width / p.height }]} accessibilityLabel={`Photo ${p.stage ? STAGE_LABEL[p.stage] : ''}`} />
                </View>
              ))}
            </Card>
          ) : null}
          {r.advice ? (
            <Card title="Conseils d'entretien">
              <Text style={styles.text}>{r.advice}</Text>
            </Card>
          ) : null}
          {r.client_signed_at ? (
            <Card title="Réception des travaux">
              <Text style={styles.text}>
                Réceptionnés le {toDate(r.client_signed_at).toLocaleDateString('fr-FR')} par {r.client_signer_name}. {r.client_reserves ? `Réserves : ${r.client_reserves}` : 'Sans réserve.'}
              </Text>
            </Card>
          ) : null}
          <SecondaryButton label={busy ? 'Préparation du PDF…' : 'Télécharger le rapport (PDF)'} icon="document-text-outline" disabled={busy} onPress={() => void pdf()} />
        </>
      ) : (
        <Muted>Le rapport n&apos;est pas encore prêt.</Muted>
      )}
      <Text style={styles.footer}>Arboject · rapport de chantier · lien valable jusqu&apos;au {toDate(d.expires_at).toLocaleDateString('fr-FR')}</Text>
    </Page>
  );
}

function Page({ children }: { children: React.ReactNode }) {
  return (
    <ScrollView style={{ flex: 1, backgroundColor: Colors.background }} contentContainerStyle={styles.page}>
      {children}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  page: { padding: Spacing.md, gap: Spacing.md, paddingBottom: Spacing.xl, width: '100%', maxWidth: 720, alignSelf: 'center' },
  header: { backgroundColor: Colors.primary, borderRadius: 12, padding: Spacing.md, gap: 2 },
  company: { fontSize: 22, fontWeight: '700', color: Colors.primaryText },
  headerText: { fontSize: 14, color: Colors.primaryText },
  text: { fontSize: 16, color: Colors.text },
  stage: { fontSize: 15, fontWeight: '700', color: Colors.primary },
  photo: { width: '100%', borderRadius: 8, backgroundColor: '#ddd' },
  footer: { fontSize: 12, color: Colors.textSecondary, textAlign: 'center' },
});
