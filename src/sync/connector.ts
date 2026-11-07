import { AbstractPowerSyncDatabase, CrudEntry, PowerSyncBackendConnector, UpdateType } from '@powersync/web';

import { currentIds } from '@/auth/current';
import { supabase } from '@/auth/supabase';
import { POWERSYNC_URL } from '@/config/powersync';
import { LOCAL_COMPANY_ID, LOCAL_USER_ID } from '@/db/database';

// Tables que le téléphone a le droit d'envoyer. Les autres (entreprises, membres, profils)
// sont seulement reçues du serveur.
const UPLOADABLE = new Set(['clients', 'visits', 'trees', 'photos', 'price_grids', 'price_items', 'quotes', 'quote_lines', 'quote_sign_requests', 'team_members', 'team_member_costs', 'quote_crew', 'jobs', 'job_members', 'intervention_sheets', 'intervention_sheet_acks', 'job_notes', 'job_reports', 'report_links', 'companies']);
// Tables qu'on modifie seulement (jamais créées depuis le téléphone).
const UPDATE_ONLY = new Set(['companies']);

// Erreurs définitives (refus des règles d'accès, donnée invalide) : réessayer ne servirait à rien
// et bloquerait toute la file d'envoi. On les met de côté pour les montrer, puis on continue.
// Codes Postgres : 22xxx = donnée invalide, 23xxx = contrainte, 42501 = refus RLS.
const isFatal = (code?: string) => !!code && (/^22...$/.test(code) || /^23...$/.test(code) || code === '42501');

export type SyncFailure = { at: string; table: string; id: string; op: string; message: string };
const FAILURES_KEY = 'arboject-sync-failures';
export function readSyncFailures(): SyncFailure[] {
  try {
    return JSON.parse(localStorage.getItem(FAILURES_KEY) ?? '[]') as SyncFailure[];
  } catch {
    return [];
  }
}
function recordFailure(f: SyncFailure) {
  try {
    localStorage.setItem(FAILURES_KEY, JSON.stringify([...readSyncFailures(), f].slice(-50)));
  } catch {
    // stockage indisponible
  }
}

// Les données créées avant la première connexion portent des identifiants provisoires :
// on les remplace par la vraie entreprise et le vrai utilisateur au moment de l'envoi.
function withRealIds(data: Record<string, unknown>): Record<string, unknown> {
  const { companyId, userId } = currentIds();
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(data)) {
    out[k] = v === LOCAL_COMPANY_ID ? companyId : v === LOCAL_USER_ID ? userId : v;
  }
  return out;
}

async function send(op: CrudEntry) {
  const table = supabase.from(op.table);
  const data = withRealIds(op.opData ?? {});
  if (op.op === UpdateType.PUT) return table.upsert({ ...data, id: op.id });
  if (op.op === UpdateType.PATCH) return table.update(data).eq('id', op.id);
  return table.delete().eq('id', op.id);
}

export const connector: PowerSyncBackendConnector = {
  // Jeton de connexion Supabase, transmis à PowerSync pour savoir qui demande quoi.
  async fetchCredentials() {
    if (!POWERSYNC_URL) return null;
    const { data, error } = await supabase.auth.getSession();
    if (error) throw error;
    const session = data.session;
    if (!session) return null;
    return {
      endpoint: POWERSYNC_URL,
      token: session.access_token,
      expiresAt: session.expires_at ? new Date(session.expires_at * 1000) : undefined,
    };
  },

  // Envoi au serveur des modifications faites sur le téléphone, dans l'ordre, transaction par transaction.
  async uploadData(database: AbstractPowerSyncDatabase) {
    const transaction = await database.getNextCrudTransaction();
    if (!transaction) return;
    for (const op of transaction.crud) {
      if (!UPLOADABLE.has(op.table)) continue;
      if (UPDATE_ONLY.has(op.table) && op.op !== UpdateType.PATCH) continue;
      const { error } = await send(op);
      if (!error) continue;
      if (isFatal(error.code)) {
        console.warn('Envoi refusé définitivement', op.table, op.id, error);
        recordFailure({ at: new Date().toISOString(), table: op.table, id: op.id, op: op.op, message: `${error.code} ${error.message}` });
        continue;
      }
      // Erreur passagère (réseau, serveur) : PowerSync réessaiera plus tard.
      throw error;
    }
    await transaction.complete();
  },
};
