import { useQuery } from '@powersync/react';
import { Link } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Switch, Text, View } from 'react-native';

import { DateTimeField } from '@/components/date-time-field';
import { GeoMap, GeoMapHandle } from '@/components/geo-map';
import { Button, Card, Field, Muted, SecondaryButton } from '@/components/ui';
import { Colors, Spacing } from '@/constants/theme';
import { ClientRow, CLIENTS_SEARCH_SQL, lastVisitOf } from '@/db/clients';
import type { PlanImage, VisitInput } from '@/db/visits';
import { formatPoint, geocodeAddress, getCurrentPosition, GeoPoint, reverseGeocode } from '@/domain/geo';
import { VAT_ZONE_LABEL, vatZoneFromPostalCode } from '@/domain/vat';

type Props = {
  initial: VisitInput;
  hasPlan: boolean; // une image du plan existe déjà pour cette visite
  submitLabel: string;
  onSubmit: (input: VisitInput, plan: PlanImage | null) => Promise<void>;
};

// Formulaire de visite, utilisé pour la création et la modification.
export function VisitForm({ initial, hasPlan, submitLabel, onSubmit }: Props) {
  const [form, setForm] = useState<VisitInput>(initial);
  const [saving, setSaving] = useState(false);
  const [locating, setLocating] = useState(false);
  const [geoMessage, setGeoMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [planDirty, setPlanDirty] = useState(!hasPlan);
  const mapRef = useRef<GeoMapHandle>(null);
  const [clientMessage, setClientMessage] = useState<string | null>(null);

  // Carnet clients : propositions pendant la saisie du nom (seulement pour un nouveau client).
  const search = form.clientId ? '' : form.clientName.trim();
  const { data: matches } = useQuery<ClientRow>(CLIENTS_SEARCH_SQL, [search, search, search, search]);
  const suggestions = search.length >= 2 ? matches.slice(0, 5) : [];
  const { data: selected } = useQuery<ClientRow>(
    `SELECT c.id, c.name, (SELECT COUNT(*) FROM visits v WHERE v.client_id = c.id AND v.deleted_at IS NULL) AS visit_count,
       (SELECT MAX(v.visited_at) FROM visits v WHERE v.client_id = c.id AND v.deleted_at IS NULL) AS last_visit_at
     FROM clients c WHERE c.id = ?`,
    [form.clientId ?? '']
  );
  const selectedClient = form.clientId ? selected[0] : undefined;

  // Reprend l'adresse de la dernière visite du client, si celle du chantier n'est pas encore remplie.
  const prefillFromLastVisit = async (clientId: string) => {
    const last = await lastVisitOf(clientId);
    if (last && !form.siteAddress.trim() && form.siteLat == null) {
      setForm((f) => ({
        ...f,
        siteAddress: last.site_address ?? '',
        sitePostalCode: last.site_postal_code ?? '',
        siteCity: last.site_city ?? '',
        siteLat: last.site_lat,
        siteLng: last.site_lng,
        siteAccuracyM: last.site_accuracy_m,
        accessNotes: f.accessNotes || (last.access_notes ?? ''),
      }));
      setPlanDirty(true);
      setClientMessage(`Adresse et accès repris de la visite du ${new Date(last.visited_at).toLocaleDateString('fr-FR')}. Modifie-les si le chantier est ailleurs.`);
    } else {
      setClientMessage(null);
    }
  };

  const chooseClient = async (c: ClientRow) => {
    setForm((f) => ({ ...f, clientId: c.id, clientName: c.name ?? '', clientPhone: c.phone ?? '', clientEmail: c.email ?? '' }));
    await prefillFromLastVisit(c.id);
  };

  // Nouvelle visite ouverte depuis une fiche client : même reprise d'adresse.
  useEffect(() => {
    if (!hasPlan && initial.clientId && !initial.siteAddress && initial.siteLat == null) prefillFromLastVisit(initial.clientId);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  const forgetClient = () => {
    setForm((f) => ({ ...f, clientId: null }));
    setClientMessage(null);
  };

  const set = <K extends keyof VisitInput>(key: K) => (value: VisitInput[K]) => setForm((f) => ({ ...f, [key]: value }));
  const point: GeoPoint | null =
    form.siteLat != null && form.siteLng != null
      ? { lat: form.siteLat, lng: form.siteLng, accuracyM: form.siteAccuracyM }
      : null;
  const setPoint = (p: GeoPoint) => {
    setForm((f) => ({ ...f, siteLat: p.lat, siteLng: p.lng, siteAccuracyM: p.accuracyM ?? null }));
    setPlanDirty(true);
  };

  const locateMe = async () => {
    setLocating(true);
    setGeoMessage('Recherche de la position…');
    try {
      const p = await getCurrentPosition();
      setPoint(p);
      if (!navigator.onLine) {
        setGeoMessage("Position enregistrée. Pas de réseau : l'adresse et la carte viendront au retour du réseau.");
        return;
      }
      const found = await reverseGeocode(p);
      if (found) {
        setForm((f) => ({ ...f, siteAddress: found.address, sitePostalCode: found.postalCode, siteCity: found.city }));
        setGeoMessage(`Adresse la plus proche : ${found.address}, ${found.postalCode} ${found.city}${found.distanceM != null ? ` (à ${Math.round(found.distanceM)} m)` : ''}. Vérifie-la.`);
      } else {
        setGeoMessage('Position enregistrée, aucune adresse trouvée à proximité.');
      }
    } catch (e) {
      setGeoMessage(e instanceof Error ? e.message : String(e));
    } finally {
      setLocating(false);
    }
  };

  const locateAddress = async () => {
    const query = [form.siteAddress, form.sitePostalCode, form.siteCity].filter((s) => s.trim()).join(' ');
    if (!query) {
      setGeoMessage("Saisis d'abord l'adresse.");
      return;
    }
    setLocating(true);
    try {
      const found = await geocodeAddress(query);
      if (!found) {
        setGeoMessage('Adresse introuvable. Essaie « Me localiser » sur place, ou touche la carte.');
        return;
      }
      setPoint(found);
      setForm((f) => ({ ...f, sitePostalCode: f.sitePostalCode || found.postalCode, siteCity: f.siteCity || found.city }));
      setGeoMessage('Adresse placée sur la carte. Ajuste le repère si besoin.');
    } catch {
      setGeoMessage("Pas de réseau : impossible de situer l'adresse pour l'instant.");
    } finally {
      setLocating(false);
    }
  };

  const save = async () => {
    if (!form.clientName.trim()) {
      setError('Indique au moins le nom du client.');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const plan = point && planDirty ? await mapRef.current?.capture() : null;
      await onSubmit(form, plan ?? null);
    } catch (e) {
      setError(`Enregistrement impossible : ${String(e)}`);
      setSaving(false);
    }
  };

  return (
    <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
      <Card title="Rendez-vous">
        <DateTimeField label="Date de la visite" value={form.visitedAt} onChange={set('visitedAt')} />
      </Card>

      <Card title="Client">
        {selectedClient ? (
          <View style={styles.known}>
            <View style={{ flex: 1 }}>
              <Text style={styles.knownTitle}>📒 Client du carnet</Text>
              <Text style={styles.knownSub}>
                {selectedClient.visit_count
                  ? `${selectedClient.visit_count} visite${selectedClient.visit_count > 1 ? 's' : ''}, dernière le ${new Date(selectedClient.last_visit_at!).toLocaleDateString('fr-FR')}`
                  : 'Aucune visite enregistrée'}
              </Text>
              <Link href={{ pathname: '/clients/[id]', params: { id: selectedClient.id } }} style={styles.link}>
                Voir l&apos;historique
              </Link>
            </View>
            <Pressable onPress={forgetClient} accessibilityRole="button" style={styles.change}>
              <Text style={styles.link}>Nouveau client</Text>
            </Pressable>
          </View>
        ) : null}
        <Field
          label="Nom"
          value={form.clientName}
          onChangeText={set('clientName')}
          autoCapitalize="words"
          placeholder={form.clientId ? undefined : 'Tape le nom : les clients connus s\'affichent'}
        />
        {suggestions.length ? (
          <View style={styles.suggestions}>
            <Muted>Déjà dans le carnet :</Muted>
            {suggestions.map((c) => (
              <Pressable key={c.id} onPress={() => chooseClient(c)} style={styles.suggestion} accessibilityRole="button">
                <Text style={styles.suggestionName}>{c.name}</Text>
                <Text style={styles.knownSub}>
                  {[c.city, c.phone, c.visit_count ? `${c.visit_count} visite${c.visit_count > 1 ? 's' : ''}` : null].filter(Boolean).join(' · ')}
                </Text>
              </Pressable>
            ))}
          </View>
        ) : null}
        {clientMessage ? <Muted>{clientMessage}</Muted> : null}
        <Field label="Téléphone" value={form.clientPhone} onChangeText={set('clientPhone')} keyboardType="phone-pad" />
        <Field label="E-mail" value={form.clientEmail} onChangeText={set('clientEmail')} keyboardType="email-address" autoCapitalize="none" />
      </Card>

      <Card title="Lieu du chantier">
        <View style={styles.row}>
          <View style={{ flex: 1 }}>
            <SecondaryButton label="📍 Me localiser" onPress={locateMe} disabled={locating} />
          </View>
          <View style={{ flex: 1 }}>
            <SecondaryButton label="🔎 Situer l'adresse" onPress={locateAddress} disabled={locating} />
          </View>
        </View>
        {geoMessage ? <Muted>{geoMessage}</Muted> : null}
        <Field label="Adresse" value={form.siteAddress} onChangeText={set('siteAddress')} />
        <View style={styles.row}>
          <View style={{ flex: 1 }}>
            <Field label="Code postal" value={form.sitePostalCode} onChangeText={set('sitePostalCode')} keyboardType="number-pad" maxLength={5} />
          </View>
          <View style={{ flex: 2 }}>
            <Field label="Commune" value={form.siteCity} onChangeText={set('siteCity')} />
          </View>
        </View>
        {form.sitePostalCode.length >= 3 ? (
          <Muted>Zone : {VAT_ZONE_LABEL[vatZoneFromPostalCode(form.sitePostalCode)]}</Muted>
        ) : null}
        {point ? (
          <>
            <Muted>Position : {formatPoint(point)}</Muted>
            <GeoMap
              ref={mapRef}
              center={point}
              markers={[{ id: 'site', kind: 'site', lat: point.lat, lng: point.lng }]}
              onTap={setPoint}
              onViewChange={() => setPlanDirty(true)}
              hint="Touche la carte pour placer le repère sur le chantier. Glisse pour te déplacer."
            />
            <Muted>
              {planDirty
                ? "L'image de cette vue sera enregistrée avec la visite."
                : "L'image du plan déjà enregistrée sera gardée. Touche la carte, le zoom ou le fond pour la refaire."}
            </Muted>
          </>
        ) : null}
        <Field label="Accès (portail, stationnement, chemin…)" value={form.accessNotes} onChangeText={set('accessNotes')} multiline />
        <View style={styles.switchRow}>
          <Text style={styles.switchLabel}>Lignes électriques à proximité</Text>
          <Switch value={form.nearPowerLines} onValueChange={set('nearPowerLines')} trackColor={{ true: Colors.primary }} />
        </View>
        {form.nearPowerLines ? <Text style={styles.warning}>⚠ DT-DICT à faire avant les travaux.</Text> : null}
      </Card>

      <Card title="Notes">
        <Field label="Notes (tu peux dicter avec le micro du clavier)" value={form.notes} onChangeText={set('notes')} multiline />
      </Card>

      {error ? <Text style={styles.warning}>{error}</Text> : null}
      <Button label={saving ? 'Enregistrement…' : submitLabel} onPress={save} disabled={saving} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { padding: Spacing.md, gap: Spacing.md, paddingBottom: Spacing.xl },
  row: { flexDirection: 'row', gap: Spacing.sm },
  switchRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: Spacing.sm },
  switchLabel: { fontSize: 16, color: Colors.text, flex: 1 },
  warning: { fontSize: 15, color: Colors.warning, fontWeight: '500' },
  known: { flexDirection: 'row', gap: Spacing.sm, backgroundColor: '#E6EFEC', borderRadius: 8, padding: Spacing.sm },
  knownTitle: { fontSize: 15, fontWeight: '600', color: Colors.primary },
  knownSub: { fontSize: 14, color: Colors.textSecondary },
  link: { fontSize: 15, color: Colors.primary, fontWeight: '600', textDecorationLine: 'underline' },
  change: { justifyContent: 'center' },
  suggestions: { gap: Spacing.xs, borderWidth: 1, borderColor: Colors.border, borderRadius: 8, padding: Spacing.sm },
  suggestion: { paddingVertical: 8, borderTopWidth: 1, borderTopColor: Colors.border },
  suggestionName: { fontSize: 16, fontWeight: '600', color: Colors.text },
});
