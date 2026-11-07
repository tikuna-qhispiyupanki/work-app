import { currentIds } from '@/auth/current';
import { BASE_PATH } from '@/config/base-path';
import { toDate } from '@/domain/dates';

import { db, newId, nowIso } from './database';

export type SignRequestRow = {
  id: string;
  quote_id: string;
  token: string;
  created_at: string;
  expires_at: string;
  status: 'envoye' | 'ouvert' | 'signe' | 'refuse' | 'annule';
  opened_at: string | null;
  decided_at: string | null;
  signer_name: string | null;
  signer_ip: string | null;
  document_hash: string | null;
  consent_text: string | null;
  signature_data: string | null;
  refusal_reason: string | null;
};

export const SIGN_REQUESTS_SQL = `SELECT id, quote_id, token, created_at, expires_at, status, opened_at, decided_at, signer_name, signer_ip, document_hash,
  consent_text, signature_data, refusal_reason
  FROM quote_sign_requests WHERE quote_id = ? AND deleted_at IS NULL ORDER BY created_at DESC`;

// Durée d'un lien : 15 jours, jamais au-delà de la validité du devis.
export const LINK_DAYS = 15;

// Jeton secret du lien : 32 octets aléatoires (256 bits), en caractères sûrs pour une adresse web.
function newToken(): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return btoa(String.fromCharCode(...bytes)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

export function signLink(token: string): string {
  const origin = typeof window === 'undefined' ? '' : window.location.origin;
  return `${origin}${BASE_PATH}/signer/${token}`;
}

export function linkExpiry(validUntil: string | null, now = new Date()): Date {
  const max = new Date(now.getTime() + LINK_DAYS * 86400000);
  if (!validUntil) return max;
  const end = new Date(`${validUntil.slice(0, 10)}T23:59:59`);
  return end < max ? end : max;
}

// Crée le lien (fonctionne sans réseau : il marchera pour le client une fois envoyé au serveur).
export async function createSignRequest(quoteId: string, validUntil: string | null): Promise<SignRequestRow> {
  const { companyId, userId } = currentIds();
  const expires = linkExpiry(validUntil);
  if (expires.getTime() <= Date.now()) throw new Error('Ce devis n’est plus valable : refais un devis pour l’envoyer.');
  const now = nowIso();
  const row = { id: newId(), token: newToken(), expires_at: expires.toISOString() };
  await db.execute(
    `INSERT INTO quote_sign_requests (id, company_id, created_at, updated_at, created_by, quote_id, token, expires_at, status)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'envoye')`,
    [row.id, companyId, now, now, userId, quoteId, row.token, row.expires_at]
  );
  return {
    ...row, quote_id: quoteId, created_at: now, status: 'envoye', opened_at: null, decided_at: null, signer_name: null, signer_ip: null,
    document_hash: null, consent_text: null, signature_data: null, refusal_reason: null,
  };
}

export async function cancelSignRequest(id: string) {
  await db.execute(`UPDATE quote_sign_requests SET status = 'annule', updated_at = ? WHERE id = ? AND status IN ('envoye', 'ouvert')`, [nowIso(), id]);
}

// La demande « en cours » : envoyée ou ouverte, pas expirée.
export const activeRequest = (rows: SignRequestRow[], now = Date.now()) =>
  rows.find((r) => (r.status === 'envoye' || r.status === 'ouvert') && toDate(r.expires_at).getTime() > now) ?? null;

// Le message envoyé au client (SMS, e-mail, WhatsApp…).
export function signMessage(o: { companyName: string; number: string | null; amount: string; link: string; expires: Date }) {
  return (
    `Bonjour, voici le devis ${o.number ?? ''} de ${o.companyName} (${o.amount}). ` +
    `Vous pouvez le lire et le signer en ligne jusqu'au ${o.expires.toLocaleDateString('fr-FR')} : ${o.link}`
  );
}
