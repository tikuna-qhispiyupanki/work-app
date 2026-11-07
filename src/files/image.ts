// Version téléphone native : à faire avec expo-image-manipulator au passage sur l'App Store.
export type CompressedImage = { blob: Blob; width: number; height: number };
export const PHOTO_MAX = 1600;
export const PHOTO_HD_MAX = 3200;
export const THUMB_MAX = 320;
export const QUALITY = 0.7;
export const HD_QUALITY = 0.85;
export async function compressImage(_source: Blob, _maxSide: number, _quality: number): Promise<CompressedImage> {
  throw new Error('Compression non disponible hors version web pour l’instant.');
}
export const makeThumbnail = (source: Blob) => compressImage(source, THUMB_MAX, QUALITY);
