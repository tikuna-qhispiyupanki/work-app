// Requêtes des listes (accueil, onglets Visites et Devis).

export type VisitListRow = {
  id: string;
  visited_at: string;
  status: string;
  site_address: string | null;
  site_city: string | null;
  client_name: string | null;
  tree_count: number;
};

const VISIT_COLUMNS = `v.id, v.visited_at, v.status, v.site_address, v.site_city, c.name AS client_name,
  (SELECT COUNT(*) FROM trees t WHERE t.visit_id = v.id AND t.deleted_at IS NULL) AS tree_count`;

// Recherche par client, adresse ou commune ; « ? » vide = toutes.
export const VISITS_SEARCH_SQL = `
  SELECT ${VISIT_COLUMNS}
  FROM visits v LEFT JOIN clients c ON c.id = v.client_id
  WHERE v.deleted_at IS NULL
    AND (? = '' OR c.name LIKE '%' || ? || '%' OR v.site_address LIKE '%' || ? || '%' OR v.site_city LIKE '%' || ? || '%')
  ORDER BY v.visited_at`;

export type QuoteListRow = {
  id: string;
  number: string | null;
  status: string;
  total_ttc_cents: number;
  created_at: string;
  issued_on: string | null;
  valid_until: string | null;
  signed_at: string | null;
  client_name: string | null;
};

export const QUOTES_LIST_SQL = `
  SELECT q.id, q.number, q.status, q.total_ttc_cents, q.created_at, q.issued_on, q.valid_until, q.signed_at, c.name AS client_name
  FROM quotes q LEFT JOIN clients c ON c.id = q.client_id
  WHERE q.deleted_at IS NULL
  ORDER BY q.created_at DESC`;

export const QUOTE_STATUS_LABEL: Record<string, string> = { brouillon: 'Brouillon', finalise: 'À faire signer', signe: 'Signé', refuse: 'Refusé' };
