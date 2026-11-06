import { LOCAL_COMPANY_ID, LOCAL_USER_ID } from '@/db/database';

// Entreprise active et utilisateur connecté, utilisés pour chaque nouvelle donnée.
// Mis à jour par AuthProvider (src/auth/session.tsx).
let current = { companyId: LOCAL_COMPANY_ID, userId: LOCAL_USER_ID };

export const currentIds = () => current;
export function setCurrentIds(companyId: string, userId: string) {
  current = { companyId, userId };
}
