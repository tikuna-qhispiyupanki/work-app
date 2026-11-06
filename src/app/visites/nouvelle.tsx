import { useQuery } from '@powersync/react';
import { router, useLocalSearchParams } from 'expo-router';

import { Muted } from '@/components/ui';
import { CLIENT_DETAIL_SQL, ClientRow } from '@/db/clients';

import { VisitForm } from '@/components/visit-form';
import { createVisit, VisitInput } from '@/db/visits';

const emptyVisit = (): VisitInput => ({
  visitedAt: new Date().toISOString(),
  clientId: null,
  clientName: '',
  clientPhone: '',
  clientEmail: '',
  siteAddress: '',
  sitePostalCode: '',
  siteCity: '',
  siteLat: null,
  siteLng: null,
  siteAccuracyM: null,
  accessNotes: '',
  notes: '',
  nearPowerLines: false,
});

export default function NewVisitScreen() {
  // « Nouvelle visite pour ce client » depuis la fiche client : ?client=<id>
  const { client } = useLocalSearchParams<{ client?: string }>();
  const { data, isLoading } = useQuery<ClientRow>(CLIENT_DETAIL_SQL, [client ?? '']);
  if (client && isLoading) return <Muted>Chargement…</Muted>;
  const c = client ? data[0] : undefined;
  const initial = c
    ? { ...emptyVisit(), clientId: c.id, clientName: c.name ?? '', clientPhone: c.phone ?? '', clientEmail: c.email ?? '' }
    : emptyVisit();
  return (
    <VisitForm
      initial={initial}
      hasPlan={false}
      submitLabel="Enregistrer la visite"
      onSubmit={async (input, plan) => {
        const id = await createVisit(input, plan);
        router.replace({ pathname: '/visites/[id]', params: { id } });
      }}
    />
  );
}
