// Compression des images sur le téléphone, avant tout enregistrement ou envoi.
// Le passage par un « canvas » ré-encode l'image : les métadonnées EXIF (GPS, modèle du téléphone…)
// disparaissent du fichier. La date et la position utiles sont gardées en base, pas dans le fichier.

export type CompressedImage = { blob: Blob; width: number; height: number };

export const PHOTO_MAX = 1600; // plus grand côté, en pixels
export const PHOTO_HD_MAX = 3200; // option « haute définition » (diagnostic d'arbre)
export const THUMB_MAX = 320; // miniature pour les listes
export const QUALITY = 0.7;
export const HD_QUALITY = 0.85;

async function decode(source: Blob): Promise<ImageBitmap | HTMLImageElement> {
  try {
    // Respecte l'orientation de la photo (téléphone tenu en portrait).
    return await createImageBitmap(source, { imageOrientation: 'from-image' });
  } catch {
    const url = URL.createObjectURL(source);
    try {
      const img = new Image();
      img.src = url;
      await img.decode();
      return img;
    } finally {
      URL.revokeObjectURL(url);
    }
  }
}

export async function compressImage(source: Blob, maxSide: number, quality: number, background?: string): Promise<CompressedImage> {
  const img = await decode(source);
  const w0 = 'naturalWidth' in img ? img.naturalWidth : img.width;
  const h0 = 'naturalHeight' in img ? img.naturalHeight : img.height;
  const scale = Math.min(1, maxSide / Math.max(w0, h0));
  const width = Math.round(w0 * scale);
  const height = Math.round(h0 * scale);
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error("Traitement de l'image impossible sur ce téléphone.");
  if (background) {
    // Fond plein (ex. logo PNG transparent : sinon le JPEG le rendrait noir).
    ctx.fillStyle = background;
    ctx.fillRect(0, 0, width, height);
  }
  ctx.drawImage(img, 0, 0, width, height);
  if ('close' in img) img.close();
  const blob = await new Promise<Blob | null>((r) => canvas.toBlob(r, 'image/jpeg', quality));
  if (!blob) throw new Error("Traitement de l'image impossible sur ce téléphone.");
  return { blob, width, height };
}

export const makeThumbnail = (source: Blob) => compressImage(source, THUMB_MAX, QUALITY);
