import { useRef, useState } from 'react';
import { ScrollView, StyleSheet, Switch, Text, View } from 'react-native';

import { DateTimeField } from '@/components/date-time-field';
import { MapPicker, MapPickerHandle } from '@/components/map-picker';
import { Button, Card, Field, Muted, SecondaryButton } from '@/components/ui';
import { Colors, Spacing } from '@/constants/theme';
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
  const mapRef = useRef<MapPickerHandle>(null);

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
        <Field label="Nom" value={form.clientName} onChangeText={set('clientName')} autoCapitalize="words" />
        <Field label="Téléphone" value={form.clientPhone} onChangeText={set('clientPhone')} keyboardType="phone-pad" />
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
            <MapPicker ref={mapRef} point={point} onMove={setPoint} onViewChange={() => setPlanDirty(true)} />
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
});
