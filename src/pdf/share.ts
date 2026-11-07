// Version native : à faire avec expo-sharing au passage sur l'App Store.
export async function shareFile(_data: ArrayBuffer, _fileName: string, _mime = 'application/pdf'): Promise<'partage' | 'telechargement' | 'annule'> {
  throw new Error('Partage disponible dans la version web pour l’instant.');
}
