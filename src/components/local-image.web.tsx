import { useEffect, useState } from 'react';

import { storagePath, thumbKey } from '@/db/photos';
import { readFile } from '@/files/local-files';
import { fetchRemotePhoto } from '@/sync/uploader';

type Props = {
  fileId: string; // identifiant de la photo
  alt: string;
  aspectRatio: number;
  thumb?: boolean; // miniature (listes) ou image complète
  companyId?: string | null;
  uploaded?: boolean; // le fichier est sur le serveur (storage_path rempli)
};

// Affiche une image : d'abord la copie du téléphone, sinon (photo prise sur un autre appareil)
// téléchargement depuis le serveur par lien signé, puis copie locale pour la prochaine fois.
export function LocalImage({ fileId, alt, aspectRatio, thumb, companyId, uploaded }: Props) {
  const [url, setUrl] = useState<string | null>(null);
  const [missing, setMissing] = useState(false);

  useEffect(() => {
    let objectUrl: string | null = null;
    let alive = true;
    (async () => {
      const key = thumb ? thumbKey(fileId) : fileId;
      let blob = (await readFile(key)) ?? (thumb ? await readFile(fileId) : undefined) ?? null;
      if (!blob && uploaded && companyId) blob = await fetchRemotePhoto(storagePath(companyId, fileId, thumb), key);
      if (!alive) return;
      if (blob) {
        objectUrl = URL.createObjectURL(blob);
        setUrl(objectUrl);
      } else setMissing(true);
    })();
    return () => {
      alive = false;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [fileId, thumb, companyId, uploaded]);

  if (url) return <img src={url} alt={alt} style={{ width: '100%', aspectRatio, objectFit: 'cover', borderRadius: 8, display: 'block' }} />;
  return (
    <div
      style={{
        width: '100%',
        aspectRatio,
        borderRadius: 8,
        background: '#DDE3D8',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        textAlign: 'center',
        fontSize: 12,
        color: '#5E625A',
        padding: 4,
        boxSizing: 'border-box',
      }}
    >
      {missing ? (uploaded ? 'Image disponible avec le réseau' : "Image sur l'autre appareil, pas encore envoyée") : ''}
    </div>
  );
}
