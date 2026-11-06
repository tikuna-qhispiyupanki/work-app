import { createClient } from '@supabase/supabase-js';

import { BASE_PATH } from '@/config/base-path';
import { SUPABASE_PUBLISHABLE_KEY, SUPABASE_URL } from '@/config/supabase';

// Client Supabase de l'application.
// La session est gardée sur le téléphone : l'application s'ouvre même sans réseau
// une fois qu'on s'est connecté une première fois.
// Flux « implicit » : le lien reçu par e-mail fonctionne même s'il s'ouvre dans Safari
// plutôt que dans l'application installée (sur iPhone, ce sont deux espaces séparés).
export const supabase = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
    flowType: 'implicit',
    storageKey: 'arboject-auth',
  },
});

// Adresse de l'application, pour les liens envoyés par e-mail.
export const appUrl = (path = '') =>
  typeof window === 'undefined' ? path : `${window.location.origin}${BASE_PATH}/${path.replace(/^\//, '')}`;

// Messages d'erreur de Supabase, traduits pour l'utilisateur.
export function authErrorMessage(e: unknown): string {
  const msg = e instanceof Error ? e.message : String(e);
  if (typeof navigator !== 'undefined' && !navigator.onLine) return 'Pas de réseau : cette action a besoin d’Internet. Réessaie avec du réseau.';
  if (/Invalid login credentials/i.test(msg)) return 'E-mail ou mot de passe incorrect.';
  if (/Email not confirmed/i.test(msg)) return 'Adresse e-mail pas encore confirmée : clique sur le lien reçu par e-mail (objet « Confirm your signup »), puis reviens te connecter.';
  if (/rate limit|too many/i.test(msg)) return 'Trop d’e-mails envoyés pour l’instant (limite de l’offre gratuite). Réessaie dans une heure.';
  if (/Password should be at least/i.test(msg)) return 'Le mot de passe doit faire au moins 8 caractères.';
  if (/User already registered/i.test(msg)) return 'Un compte existe déjà avec cette adresse : connecte-toi, ou utilise « Mot de passe oublié ».';
  if (/invalid.*email|Unable to validate email/i.test(msg)) return 'Adresse e-mail invalide.';
  if (/Failed to fetch|NetworkError|Load failed/i.test(msg)) return 'Serveur injoignable. Vérifie le réseau et réessaie.';
  return `Erreur : ${msg}`;
}
