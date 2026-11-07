// Adresse de l'instance PowerSync d'Arboject (service de synchronisation, offre gratuite).
// Publique par conception : l'accès est contrôlé par le jeton de connexion Supabase
// et par les règles de powersync/sync-config.yaml.
// Instance « Production » (région à confirmer dans le tableau de bord PowerSync : EU attendu). Vide = synchronisation coupée (application locale seulement).
// Instance : https://6aeeb4c7e277c04a3d8e7338.powersync.journeyapps.com (coupée tant que le test à deux téléphones ne passe pas).
export const POWERSYNC_URL = '';
