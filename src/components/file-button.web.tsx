import { useRef } from 'react';

import type { IconName } from '@/components/icon';
import { SecondaryButton } from '@/components/ui';

// Bouton qui ouvre le sélecteur de fichiers (iPhone : « Fichiers », iCloud Drive ; ordinateur : explorateur).
export function FileButton({ label, accept, onFile, disabled, icon }: { label: string; accept: string; onFile: (f: File) => void; disabled?: boolean; icon?: IconName }) {
  const input = useRef<HTMLInputElement>(null);
  return (
    <>
      <input
        ref={input}
        type="file"
        accept={accept}
        aria-label={label}
        style={{ display: 'none' }}
        onChange={(e) => {
          const f = e.target.files?.[0];
          e.target.value = '';
          if (f) onFile(f);
        }}
      />
      <SecondaryButton label={label} icon={icon} onPress={() => input.current?.click()} disabled={disabled} />
    </>
  );
}
