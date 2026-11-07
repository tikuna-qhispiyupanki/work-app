import type { Session } from '@supabase/supabase-js';
import { createContext, ReactNode, useCallback, useContext, useEffect, useState } from 'react';

import { POWERSYNC_URL } from '@/config/powersync';
import { db, LOCAL_COMPANY_ID, LOCAL_USER_ID } from '@/db/database';
import { clearFiles } from '@/files/local-files';
import { connector } from '@/sync/connector';
import { pendingUploads, startUploader, stopUploader } from '@/sync/uploader';

import { setCurrentIds } from './current';
import { supabase } from './supabase';

export type Role = 'gerant' | 'bureau' | 'chef_equipe' | 'technicien';
export type ActiveCompany = { id: string; name: string; role: Role };

type AuthState = {
  status: 'loading' | 'signedOut' | 'signedIn';
  session: Session | null;
  company: ActiveCompany | null;
  companyStatus: 'unknown' | 'none' | 'ok' | 'offline';
  refreshCompany: () => Promise<void>;
  signOut: () => Promise<{ ok: boolean; pending: number }>;
};

const AuthContext = createContext<AuthState | null>(null);
export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth hors de AuthProvider');
  return ctx;
};

// Mémoire de l'entreprise active, pour s'ouvrir sans réseau.
const CACHE_KEY = 'arboject-company';
type Cached = ActiveCompany & { userId: string };
const readCache = (userId: string): ActiveCompany | null => {
  try {
    const c = JSON.parse(localStorage.getItem(CACHE_KEY) ?? 'null') as Cached | null;
    return c && c.userId === userId ? { id: c.id, name: c.name, role: c.role } : null;
  } catch {
    return null;
  }
};
const writeCache = (userId: string, c: ActiveCompany | null) => {
  try {
    if (c) localStorage.setItem(CACHE_KEY, JSON.stringify({ ...c, userId }));
    else localStorage.removeItem(CACHE_KEY);
  } catch {
    // stockage indisponible : sans conséquence, on relira le serveur
  }
};

// Données créées sur ce téléphone avant la première connexion : rattachées à l'entreprise.
// (Les envois en attente sont corrigés de la même façon au moment de la synchronisation, étape 2c-3.)
async function adoptLocalData(companyId: string, userId: string) {
  await db.writeTransaction(async (tx) => {
    for (const table of ['clients', 'visits', 'trees', 'photos']) {
      await tx.execute(`UPDATE ${table} SET company_id = ?, created_by = ? WHERE company_id = ?`, [companyId, userId, LOCAL_COMPANY_ID]);
      await tx.execute(`UPDATE ${table} SET created_by = ? WHERE created_by = ?`, [userId, LOCAL_USER_ID]);
    }
  });
}

// Démarre la synchronisation avec le serveur (si elle est configurée).
// Sans réseau, PowerSync attend et réessaie tout seul.
let syncStarted = false;
function startSync() {
  startUploader(); // envoi des fichiers photo (indépendant de PowerSync)
  if (!POWERSYNC_URL || syncStarted) return;
  syncStarted = true;
  db.connect(connector).catch((e: unknown) => {
    syncStarted = false;
    console.warn('Synchronisation impossible pour le moment', e);
  });
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<AuthState['status']>('loading');
  const [session, setSession] = useState<Session | null>(null);
  const [company, setCompany] = useState<ActiveCompany | null>(null);
  const [companyStatus, setCompanyStatus] = useState<AuthState['companyStatus']>('unknown');

  const applyCompany = useCallback(async (c: ActiveCompany | null, userId: string) => {
    setCompany(c);
    writeCache(userId, c);
    if (c) {
      setCurrentIds(c.id, userId);
      await adoptLocalData(c.id, userId);
      startSync();
    }
  }, []);

  const loadCompany = useCallback(
    async (s: Session | null) => {
      if (!s) {
        setCompany(null);
        setCompanyStatus('unknown');
        return;
      }
      const userId = s.user.id;
      const cached = readCache(userId);
      if (cached) {
        setCompany(cached);
        setCurrentIds(cached.id, userId);
        setCompanyStatus('ok');
        startSync(); // hors-ligne aussi : PowerSync enverra au retour du réseau
      }
      const { data, error } = await supabase
        .from('memberships')
        .select('role, company:companies(id, name)')
        .eq('user_id', userId)
        .eq('active', true)
        .order('created_at');
      if (error) {
        if (!cached) setCompanyStatus('offline');
        return; // pas de réseau : on garde la mémoire
      }
      const first = (data ?? [])[0] as unknown as { role: Role; company: { id: string; name: string } | null } | undefined;
      if (!first?.company) {
        await applyCompany(null, userId);
        setCompanyStatus('none');
        return;
      }
      await applyCompany({ id: first.company.id, name: first.company.name, role: first.role }, userId);
      setCompanyStatus('ok');
    },
    [applyCompany]
  );

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setStatus(data.session ? 'signedIn' : 'signedOut');
      loadCompany(data.session);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((event, s) => {
      setSession(s);
      setStatus(s ? 'signedIn' : 'signedOut');
      if (event === 'SIGNED_IN' || event === 'SIGNED_OUT' || event === 'USER_UPDATED') loadCompany(s);
    });
    return () => sub.subscription.unsubscribe();
  }, [loadCompany]);

  const value: AuthState = {
    status,
    session,
    company,
    companyStatus,
    refreshCompany: () => loadCompany(session),
    // Déconnexion refusée tant que des modifications ne sont pas envoyées (sinon elles seraient perdues).
    // Une fois tout envoyé, les données du téléphone sont effacées : le prochain utilisateur ne les voit pas.
    signOut: async () => {
      if (POWERSYNC_URL) {
        const { count } = await db.getUploadQueueStats();
        const photos = await pendingUploads();
        if (count + photos > 0) return { ok: false, pending: count + photos };
        stopUploader();
        await db.disconnectAndClear();
        await clearFiles(); // photos du téléphone : elles sont sur le serveur
      }
      // Sans synchronisation configurée : on garde les données (elles n'existent que sur ce téléphone).
      syncStarted = false;
      await supabase.auth.signOut({ scope: 'local' });
      setCurrentIds(LOCAL_COMPANY_ID, LOCAL_USER_ID);
      return { ok: true, pending: 0 };
    },
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
