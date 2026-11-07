// Partage d'un fichier : feuille de partage de l'iPhone (Mail, Messages, WhatsApp, Fichiers…)
// si elle est disponible, sinon téléchargement (ordinateur).
export async function shareFile(data: ArrayBuffer, fileName: string, mime = 'application/pdf'): Promise<'partage' | 'telechargement' | 'annule'> {
  const file = new File([data], fileName, { type: mime });
  const nav = navigator as Navigator & { canShare?: (d: { files: File[] }) => boolean };
  if (nav.share && nav.canShare?.({ files: [file] })) {
    try {
      await nav.share({ files: [file], title: fileName });
      return 'partage';
    } catch (e) {
      if (e instanceof Error && e.name === 'AbortError') return 'annule';
    }
  }
  const url = URL.createObjectURL(file);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10000);
  return 'telechargement';
}
