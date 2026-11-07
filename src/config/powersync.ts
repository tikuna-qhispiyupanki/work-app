// Adresse de l'instance PowerSync d'Arboject (service de synchronisation, offre gratuite).
// Publique par conception : l'accès est contrôlé par le jeton de connexion Supabase
// et par les règles de powersync/sync-config.yaml.
// Instance « Production » (région à confirmer dans le tableau de bord PowerSync : EU attendu). Vide = synchronisation coupée (application locale seulement).
// Instance Production (le test à deux téléphones « bash scripts/e2e.sh sync » passe).
export const POWERSYNC_URL = 'https://6aeeb4c94d7433c80999f9fd.powersync.journeyapps.com';
