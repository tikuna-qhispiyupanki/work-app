import { currentIds } from '@/auth/current';
import { supabase } from '@/auth/supabase';
import { db, LOCAL_COMPANY_ID, newId } from '@/db/database';

// Réserve de numéros de devis sur ce téléphone : on en garde au moins MIN d'avance pour l'année
// en cours, réservés sur le serveur (sans doublon possible entre téléphones). Permet de numéroter
// un devis hors-ligne, chez le client. Un numéro réservé mais jamais utilisé laisse un « trou ».
// Si le compteur a été remis à zéro sur le serveur (« série » différente), les numéros réservés
// avant la remise à zéro sont jetés : ils feraient doublon.
const MIN = 5;
const BATCH = 10;
let running = false;

export async function ensureQuoteNumbers(): Promise<void> {
  const { companyId } = currentIds();
  if (running || companyId === LOCAL_COMPANY_ID || (typeof navigator !== 'undefined' && !navigator.onLine)) return;
  running = true;
  try {
    const year = new Date().getFullYear();
    const { data: epoch, error: epochError } = await supabase.rpc('quote_counter_epoch', { p_company: companyId, p_year: year });
    if (epochError || typeof epoch !== 'number') return;
    await db.execute('DELETE FROM quote_number_pool WHERE company_id = ? AND (year <> ? OR epoch IS NULL OR epoch <> ?)', [companyId, year, epoch]);
    const r = await db.get<{ n: number }>('SELECT COUNT(*) AS n FROM quote_number_pool WHERE company_id = ? AND year = ?', [companyId, year]);
    if (r.n >= MIN) return;
    const { data, error } = await supabase.rpc('reserve_quote_numbers', { p_company: companyId, p_year: year, p_count: BATCH });
    if (error || !data?.[0]) return;
    const reserved = data[0] as { first_number: number; last_number: number; epoch: number };
    await db.writeTransaction(async (tx) => {
      for (let n = reserved.first_number; n <= reserved.last_number; n++) {
        await tx.execute('INSERT INTO quote_number_pool (id, company_id, year, number, epoch) VALUES (?, ?, ?, ?, ?)', [newId(), companyId, year, n, reserved.epoch]);
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
