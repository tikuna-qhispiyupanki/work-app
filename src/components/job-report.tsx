import { useQuery } from '@powersync/react';
import { useRef, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { confirmAction } from '@/components/confirm';
import { DateField } from '@/components/date-field';
import { LocalImage } from '@/components/local-image';
import { SignaturePad, SignaturePadHandle } from '@/components/signature-pad';
import { Button, Card, Field, Muted, SecondaryButton } from '@/components/ui';
import { Colors, Spacing } from '@/constants/theme';
import {
  createReportLink, ensureReport, REPORT_LINKS_SQL, REPORT_PHOTOS_SQL, REPORT_SQL, ReportField, ReportLinkRow, reportLink, ReportPhotoRow, ReportRow, signReport, updateReport,
} from '@/db/reports';
import { toDate } from '@/domain/dates';
import { quickPosition } from '@/domain/geo';
import { shareFile } from '@/pdf/share';
import { reportPdf } from '@/pdf/report-pdf-data';
import { kickUploader } from '@/sync/uploader';

// Rapport de fin de chantier : travaux réalisés, remarques, conseils, photos, réception signée par le client ;
// PDF à envoyer, et lien privé pour que le client le voie en ligne.
export function JobReport({ jobId, clientName, clientPhone, companyName }: { jobId: string; clientName: string | null; clientPhone: string | null; companyName: string | null }) {
  const { data: reports } = useQuery<ReportRow>(REPORT_SQL, [jobId]);
  const { data: photos } = useQuery<ReportPhotoRow>(REPORT_PHOTOS_SQL, [jobId]);
  const { data: links } = useQuery<ReportLinkRow>(REPORT_LINKS_SQL, [jobId]);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const r = reports[0];

  if (!r) {
    return (
      <Card title="Rapport de fin de chantier">
        <Muted>Pour le client : travaux réalisés, photos avant / après, conseils d&apos;entretien et réception des travaux signée. Pré-rempli avec le devis.</Muted>
        <Button label="Préparer le rapport" icon="document-text-outline" onPress={() => void ensureReport(jobId)} />
      </Card>
    );
  }
  const draft = r.status === 'brouillon';
  const set = (f: ReportField) => (v: string | null) => void updateReport(r.id, f, v).catch((e) => setError(String(e)));
  const run = async (label: string, f: () => Promise<void>) => {
    setError(null);
    setBusy(label);
    try {
      await f();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
    setBusy(null);
  };
  const link = links.find((l) => toDate(l.expires_at).getTime() > Date.now()) ?? null;
  const message = (token: string) =>
    `Bonjour, voici le rapport de fin de chantier de ${companyName ?? 'votre élagueur'} (photos et conseils d'entretien) : ${reportLink(token)}`;

  return (
    <>
      <Card title="Rapport de fin de chantier">
        {draft ? (
          <>
            <Block key={`w:${r.works_done}`} label="Travaux réalisés" value={r.works_done} onSave={set('works_done')} />
            <Block key={`r:${r.remarks}`} label="Remarques (ce qui a été fait en plus, points d'attention…)" value={r.remarks} onSave={set('remarks')} />
            <Block key={`a:${r.advice}`} label="Conseils d'entretien" value={r.advice} onSave={set('advice')} />
            <DateField label="Travaux terminés le" value={r.finished_on} onChange={set('finished_on')} />
          </>
        ) : (
          <>
            <Read label="Travaux réalisés" value={r.works_done} />
            <Read label="Remarques" value={r.remarks} />
            <Read label="Conseils d'entretien" value={r.advice} />
          </>
        )}
        <Muted>
          {photos.length} photo{photos.length > 1 ? 's' : ''} dans le rapport (choisies dans l&apos;onglet « Fil » : « Dans le rapport du client »).
        </Muted>
      </Card>

      {draft ? (
        <ReceptionCard reportId={r.id} defaultName={clientName} onError={setError} />
      ) : (
        <Card title="Travaux réceptionnés">
          <Text style={styles.text}>
            Le {toDate(r.client_signed_at).toLocaleString('fr-FR', { dateStyle: 'long', timeStyle: 'short' })} par {r.client_signer_name}.
          </Text>
          <Text style={styles.text}>{r.client_reserves ? `Réserves : ${r.client_reserves}` : 'Sans réserve.'}</Text>
          {r.client_signature_photo_id ? (
            <View style={{ maxWidth: 300 }}>
              <LocalImage fileId={r.client_signature_photo_id} alt="Signature du client" aspectRatio={600 / 240} companyId={r.company_id} uploaded />
            </View>
          ) : null}
        </Card>
      )}

      <Card title="Envoyer au client">
        <SecondaryButton
          label={busy === 'pdf' ? 'Préparation du PDF…' : 'PDF du rapport (SMS, WhatsApp, e-mail…)'}
          icon="share-outline"
          disabled={!!busy}
          onPress={() => run('pdf', async () => {
            const p = await reportPdf(jobId);
            await shareFile(p.data, p.fileName);
          })}
        />
        <Button
          label={busy === 'lien' ? 'Création du lien…' : link ? 'Renvoyer le lien en ligne' : 'Envoyer un lien pour voir le rapport en ligne'}
          icon="link-outline"
          disabled={!!busy}
          onPress={() => run('lien', async () => {
            const l = link ?? (await createReportLink(jobId));
            kickUploader();
            const nav = navigator as Navigator & { share?: (d: { title?: string; text?: string }) => Promise<void> };
            if (nav.share) {
              try {
                await nav.share({ title: 'Rapport de chantier', text: message(l.token) });
                return;
              } catch (e) {
                if (e instanceof Error && e.name === 'AbortError') return;
              }
            }
            await navigator.clipboard?.writeText(reportLink(l.token)).catch(() => undefined);
          })}
        />
        {link ? (
          <>
            <Text style={styles.link} selectable accessibilityLabel="Lien du rapport">
              {reportLink(link.token)}
            </Text>
            <Muted>
              Valable jusqu&apos;au {toDate(link.expires_at).toLocaleDateString('fr-FR')}
              {link.opened_at ? ` · ouvert par le client le ${toDate(link.opened_at).toLocaleDateString('fr-FR')}` : ' · pas encore ouvert'}.
              {' '}Le lien a besoin d&apos;Internet ; les photos doivent être envoyées avant.
            </Muted>
          </>
        ) : null}
        {error ? <Text style={styles.error}>{error}</Text> : null}
      </Card>
    </>
  );
}

function Block({ label, value, onSave }: { label: string; value: string | null; onSave: (v: string | null) => void }) {
  const [t, setT] = useState(value ?? '');
  return <Field label={label} value={t} onChangeText={setT} onBlur={() => t !== (value ?? '') && onSave(t)} multiline />;
}

function Read({ label, value }: { label: string; value: string | null }) {
  if (!value) return null;
  return (
    <View style={{ gap: 2 }}>
      <Text style={styles.label}>{label}</Text>
      <Text style={styles.text}>{value}</Text>
    </View>
  );
}

function ReceptionCard({ reportId, defaultName, onError }: { reportId: string; defaultName: string | null; onError: (e: string | null) => void }) {
  const pad = useRef<SignaturePadHandle>(null);
  const [name, setName] = useState(defaultName ?? '');
  const [reserves, setReserves] = useState('');
  const [ink, setInk] = useState(false);
  const [busy, setBusy] = useState(false);
  return (
    <Card title="Réception des travaux par le client">
      <Muted>À la fin du chantier, le client vérifie les travaux et signe sur ton téléphone (fonctionne sans réseau). Le chantier passe à « Terminé ».</Muted>
      <Field label="Nom du client" value={name} onChangeText={setName} autoCapitalize="words" />
      <Field label="Réserves éventuelles (laisser vide si aucune)" value={reserves} onChangeText={setReserves} multiline />
      <SignaturePad ref={pad} onInk={setInk} />
      <Button
        label={busy ? 'Enregistrement…' : 'Valider la réception'}
        icon="checkmark-done-outline"
        disabled={busy || !ink || !name.trim()}
        onPress={async () => {
          onError(null);
          const image = await pad.current?.toJpeg();
          if (!image) return onError('Le client doit signer dans le cadre.');
          if (!(await confirmAction('Valider la réception ?', 'Le rapport ne pourra plus être modifié.', 'Valider'))) return;
          setBusy(true);
          try {
            await signReport(reportId, name, reserves, image, await quickPosition(3000));
            kickUploader();
          } catch (e) {
            onError(e instanceof Error ? e.message : String(e));
          }
          setBusy(false);
        }}
      />
    </Card>
  );
}

const styles = StyleSheet.create({
  label: { fontSize: 15, fontWeight: '600', color: Colors.text },
  text: { fontSize: 16, color: Colors.text },
  link: { fontSize: 13, color: Colors.primary, backgroundColor: '#EEF2F0', padding: 8, borderRadius: 6, marginTop: Spacing.xs },
  error: { fontSize: 15, color: Colors.danger },
});
