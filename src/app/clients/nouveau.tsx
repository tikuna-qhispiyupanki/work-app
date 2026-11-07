import { router } from 'expo-router';

import { ClientForm, EMPTY_CLIENT } from '@/components/client-form';
import { createClient } from '@/db/clients';

export default function NewClientScreen() {
  return (
    <ClientForm
      initial={EMPTY_CLIENT}
      submitLabel="Créer la fiche client"
      onSubmit={async (input) => {
        const id = await createClient(input);
        router.replace({ pathname: '/clients/[id]', params: { id } });
      }}
    />
  );
}
