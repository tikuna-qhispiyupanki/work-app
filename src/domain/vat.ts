export type VatZone = 'reunion' | 'hexagone';

// Code postal 974xx = La Réunion. Tout le reste est traité comme l'hexagone pour l'instant.
export function vatZoneFromPostalCode(postalCode: string | null | undefined): VatZone {
  return (postalCode ?? '').trim().startsWith('974') ? 'reunion' : 'hexagone';
}

export const VAT_ZONE_LABEL: Record<VatZone, string> = {
  reunion: 'La Réunion (8,5 %)',
  hexagone: 'Hexagone (20 %)',
};
