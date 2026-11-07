import { useStatus } from '@powersync/react';
import { useEffect, useState } from 'react';

import { POWERSYNC_URL } from '@/config/powersync';
import { db } from '@/db/database';

import { readSyncFailures, SyncFailure } from './connector';
import { pendingUploads } from './uploader';

export type SyncState = {
  kind: 'ok' | 'sending' | 'pending' | 'offline' | 'refused' | 'starting';
  online: boolean;
  pending: number; // modifications pas encore envoyées
  photos: number; // fichiers photo pas encore envoyés
  failures: SyncFailure[];
  short: string; // texte court (pastille)
  long: string; // phrase complète (page de détail, lecteurs d'écran)
};

// État de l'envoi au serveur, recalculé toutes les 2 secondes.
export function useSyncState(): SyncState {
  const status = useStatus();
  const [pending, setPending] = useState<number | null>(null);
  const [photos, setPhotos] = useState(0);
  const [online, setOnline] = useState(true);
  const [failures, setFailures] = useState<SyncFailure[]>([]);

  useEffect(() => {
    let alive = true;
    const refresh = async () => {
      try {
        const stats = await db.getUploadQueueStats();
        const files = await pendingUploads();
        if (alive) {
          setPending(stats.count);
          setPhotos(files);
        }
      } catch {
        // base pas encore prête
      }
      if (!alive) return;
      if (typeof navigator !== 'undefined') setOnline(navigator.onLine);
      setFailures(readSyncFailures());
    };
    refresh();
    const timer = setInterval(refresh, 2000);
    return () => {
      alive = false;
      clearInterval(timer);
    };
  }, []);

  const serverError = status.dataFlowStatus.downloadError ?? status.dataFlowStatus.uploadError;
  const refused = !!serverError && /401|403|Unauthorized|Forbidden/i.test(String(serverError));
  const p = pending ?? 0;
  const total = p + photos;
  const plural = (n: number, w: string) => `${n} ${w}${n > 1 ? 's' : ''}`;
  const photoText = photos ? ` ${plural(photos, 'photo')} ${online ? 'en cours d’envoi' : 'à envoyer au retour du réseau'}.` : '';

  let kind: SyncState['kind'];
  let short: string;
  let long: string;
  if (pending === null) {
    kind = 'starting';
    short = '…';
    long = 'Préparation de la base locale…';
  } else if (!POWERSYNC_URL) {
    kind = p ? 'pending' : 'ok';
    short = p ? `↑ ${p}` : 'Local';
    long = p ? `${plural(p, 'modification')} en attente d'envoi (synchronisation pas encore branchée).` : 'Tout est enregistré sur le téléphone.';
  } else if (!online) {
    kind = 'offline';
    short = total ? `Hors ligne · ${total}` : 'Hors ligne';
    long = (p ? `${plural(p, 'modification')} à envoyer au retour du réseau.` : 'Hors ligne. Tout est enregistré sur le téléphone.') + photoText;
  } else if (refused) {
    kind = 'refused';
    short = 'Refusé';
    long = `Le serveur de synchronisation refuse la connexion (réglage à corriger). Tes données restent sur le téléphone${p ? ` : ${p} en attente` : ''}.`;
  } else if (total) {
    kind = 'sending';
    short = `↑ ${total}`;
    long = (p ? `Envoi en cours… ${p} restante${p > 1 ? 's' : ''}.` : 'Modifications envoyées.') + photoText;
  } else if (status.connected) {
    kind = 'ok';
    short = 'Envoyé';
    long = '✓ Tout est envoyé au serveur.';
  } else {
    kind = 'pending';
    short = '…';
    long = 'Connexion au serveur…';
  }
  return { kind, online, pending: p, photos, failures, short, long };
}
