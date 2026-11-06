import { useEffect, useState } from 'react';

import { readFile } from '@/files/local-files';

// Affiche une image gardée sur le téléphone (IndexedDB).
export function LocalImage({ fileId, alt, aspectRatio }: { fileId: string; alt: string; aspectRatio: number }) {
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    let objectUrl: string | null = null;
    readFile(fileId).then((blob) => {
      if (blob) {
        objectUrl = URL.createObjectURL(blob);
        setUrl(objectUrl);
      }
    });
    return () => {
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [fileId]);
  return url ? (
    <img src={url} alt={alt} style={{ width: '100%', aspectRatio, borderRadius: 8, display: 'block' }} />
  ) : (
    <div style={{ width: '100%', aspectRatio, borderRadius: 8, background: '#DDE3D8' }} />
  );
}
