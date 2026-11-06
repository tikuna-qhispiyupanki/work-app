// Adresse de l'instance PowerSync d'Arboject (service de synchronisation, offre gratuite).
// Publique par conception : l'accès est contrôlé par le jeton de connexion Supabase
// et par les règles de powersync/sync-config.yaml.
// Vide = synchronisation pas encore branchée (l'application fonctionne alors en local seulement).
export const POWERSYNC_URL = '';
