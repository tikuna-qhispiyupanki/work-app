import { router } from 'expo-router';

import { VisitForm } from '@/components/visit-form';
import { createVisit, VisitInput } from '@/db/visits';

const emptyVisit = (): VisitInput => ({
  visitedAt: new Date().toISOString(),
  clientName: '',
  clientPhone: '',
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
  return (
    <VisitForm
      initial={emptyVisit()}
      hasPlan={false}
      submitLabel="Enregistrer la visite"
      onSubmit={async (input, plan) => {
        const id = await createVisit(input, plan);
        router.replace({ pathname: '/visites/[id]', params: { id } });
      }}
    />
  );
}
