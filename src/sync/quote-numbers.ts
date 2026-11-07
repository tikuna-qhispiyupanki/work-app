import { currentIds } from '@/auth/current';
import { supabase } from '@/auth/supabase';
import { db, LOCAL_COMPANY_ID, newId } from '@/db/database';

// Réserve de numéros de devis sur ce téléphone : on en garde au moins MIN d'avance pour l'année
// en cours, réservés sur le serveur (sans doublon possible entre téléphones). Permet de numéroter
// un devis hors-ligne, chez le client. Un numéro réservé mais jamais utilisé laisse un « trou ».
const MIN = 5;
const BATCH = 10;
let running = false;

export async function ensureQuoteNumbers(): Promise<void> {
  const { companyId } = currentIds();
  if (running || companyId === LOCAL_COMPANY_ID || (typeof navigator !== 'undefined' && !navigator.onLine)) return;
  running = true;
  try {
    const year = new Date().getFullYear();
    const r = await db.get<{ n: number }>('SELECT COUNT(*) AS n FROM quote_number_pool WHERE company_id = ? AND year = ?', [companyId, year]);
    if (r.n >= MIN) return;
    const { data, error } = await supabase.rpc('reserve_quote_numbers', { p_company: companyId, p_year: year, p_count: BATCH });
    if (error || !data?.[0]) return;
    const { first_number, last_number } = data[0] as { first_number: number; last_number: number };
    await db.writeTransaction(async (tx) => {
      for (let n = first_number; n <= last_number; n++) {
        await tx.execute('INSERT INTO quote_number_pool (id, company_id, year, number) VALUES (?, ?, ?, ?)', [newId(), companyId, year, n]);
      }
    });
  } finally {
    running = false;
  }
}

export async function availableQuoteNumbers(): Promise<number> {
  const { companyId } = currentIds();
  const r = await db.get<{ n: number }>('SELECT COUNT(*) AS n FROM quote_number_pool WHERE company_id = ? AND year = ?', [companyId, new Date().getFullYear()]);
  return r.n;
}
