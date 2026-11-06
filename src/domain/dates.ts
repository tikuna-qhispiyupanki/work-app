// Dates venant du serveur : « 2026-11-06 12:00:00.000Z » (espace au lieu de « T »).
// Safari sur iPhone ne sait pas lire ce format : on le normalise avant de créer la date.
export function toDate(value: string | null | undefined): Date {
  if (!value) return new Date(NaN);
  return new Date(value.includes('T') ? value : value.replace(' ', 'T'));
}
