import { useQuery } from '@powersync/react';
import { router, useLocalSearchParams } from 'expo-router';

import { Muted } from '@/components/ui';
import { VisitForm } from '@/components/visit-form';
import { updateVisit, VISIT_DETAIL_SQL, VISIT_PLAN_SQL } from '@/db/visits';

type Row = {
  visited_at: string;
  client_id: string;
  client_email: string | null;
  client_name: string | null;
  client_phone: string | null;
  site_address: string | null;
  site_postal_code: string | null;
  site_city: string | null;
  site_lat: number | null;
  site_lng: number | null;
  site_accuracy_m: number | null;
  access_notes: string | null;
  notes: string | null;
  near_power_lines: number;
};

export default function EditVisitScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { data, isLoading } = useQuery<Row>(VISIT_DETAIL_SQL, [id]);
  const { data: plans, isLoading: plansLoading } = useQuery<{ id: string }>(VISIT_PLAN_SQL, [id]);
  const v = data[0];

  if (isLoading || plansLoading) return <Muted>Chargement…</Muted>;
  if (!v) return <Muted>Visite introuvable.</Muted>;

  return (
    <VisitForm
      initial={{
        visitedAt: v.visited_at,
        clientId: v.client_id,
        clientName: v.client_name ?? '',
        clientPhone: v.client_phone ?? '',
        clientEmail: v.client_email ?? '',
        siteAddress: v.site_address ?? '',
        sitePostalCode: v.site_postal_code ?? '',
        siteCity: v.site_city ?? '',
        siteLat: v.site_lat,
        siteLng: v.site_lng,
        siteAccuracyM: v.site_accuracy_m,
        accessNotes: v.access_notes ?? '',
        notes: v.notes ?? '',
        nearPowerLines: v.near_power_lines === 1,
      }}
      hasPlan={plans.length > 0}
      submitLabel="Enregistrer les modifications"
      onSubmit={async (input, plan) => {
        await updateVisit(id, input, plan);
        router.back();
      }}
    />
  );
}
