import { useQuery } from '@powersync/react';
import { router, useLocalSearchParams } from 'expo-router';

import { ClientForm } from '@/components/client-form';
import { Muted } from '@/components/ui';
import { CLIENT_DETAIL_SQL, ClientRow, updateClient } from '@/db/clients';

export default function EditClientScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { data, isLoading } = useQuery<ClientRow>(CLIENT_DETAIL_SQL, [id]);
  const c = data[0];
  if (isLoading) return <Muted>Chargement…</Muted>;
  if (!c) return <Muted>Client introuvable.</Muted>;
  return (
    <ClientForm
      initial={{
        kind: c.kind ?? 'particulier',
        name: c.name ?? '',
        phone: c.phone ?? '',
        email: c.email ?? '',
        address: c.address ?? '',
        postalCode: c.postal_code ?? '',
        city: c.city ?? '',
        notes: c.notes ?? '',
      }}
      submitLabel="Enregistrer"
      onSubmit={async (input) => {
        await updateClient(c.id, input);
        router.back();
      }}
    />
  );
}
