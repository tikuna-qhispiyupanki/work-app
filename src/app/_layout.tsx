import { PowerSyncContext } from '@powersync/react';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useState } from 'react';
import { Image, Text, View } from 'react-native';

import { AuthProvider, useAuth } from '@/auth/session';
import { SyncPill } from '@/components/sync-pill';
import { Colors } from '@/constants/theme';
import { db, requestPersistentStorage } from '@/db/database';
import { registerServiceWorker } from '@/pwa/register';
import { hideSplash } from '@/pwa/splash';

// Pages publiques (liens envoyés au client : signature du devis, rapport de chantier) : ni base locale, ni compte, ni installation.
const PUBLIC_PAGE = typeof window !== 'undefined' && /\/(signer|rapport)\/[^/]+\/?$/.test(window.location.pathname);

export default function RootLayout() {
  if (PUBLIC_PAGE) return <PublicLayout />;
  return <AppLayout />;
}

function PublicLayout() {
  useEffect(() => hideSplash(), []);
  return (
    <View style={{ flex: 1, backgroundColor: Colors.background }}>
      <StatusBar style="dark" />
      <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: Colors.background } }} />
    </View>
  );
}

function AppLayout() {
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    db.init().catch((e: unknown) => setError(String(e)));
    requestPersistentStorage();
    registerServiceWorker();
  }, []);

  return (
    <PowerSyncContext.Provider value={db}>
      <AuthProvider>
        <StatusBar style="light" />
        <View style={{ flex: 1, backgroundColor: Colors.background }}>
          <View style={{ flex: 1, width: '100%', maxWidth: 720, alignSelf: 'center' }}>
            <AppStack />
            {error ? <Text style={{ color: Colors.warning, padding: 12 }}>Erreur de la base locale : {error}</Text> : null}
          </View>
        </View>
      </AuthProvider>
    </PowerSyncContext.Provider>
  );
}

// Écrans accessibles selon l'état : non connecté → connexion ;
// connecté sans entreprise → création de l'entreprise ; sinon → l'application.
function AppStack() {
  const { status, company } = useAuth();
  useEffect(() => {
    if (status !== 'loading') hideSplash(); // application prête : l'écran de démarrage s'efface
  }, [status]);
  if (status === 'loading') {
    return <View style={{ flex: 1, backgroundColor: Colors.brandBackground }} />;
  }
  const signedIn = status === 'signedIn';
  const ready = signedIn && company !== null;

  return (
    <>
      <Stack
        screenOptions={{
          headerStyle: { backgroundColor: Colors.primary },
          headerTintColor: Colors.primaryText,
          contentStyle: { backgroundColor: Colors.background },
          headerBackTitle: 'Retour',
          headerRight: ready ? () => <SyncPill /> : undefined,
        }}
      >
        <Stack.Protected guard={ready}>
          <Stack.Screen name="(tabs)" options={{ headerShown: false, title: 'Arboject' }} />
          <Stack.Screen name="synchro" options={{ title: 'Synchronisation' }} />
          <Stack.Screen name="visites/nouvelle" options={{ title: 'Nouvelle visite' }} />
          <Stack.Screen name="visites/[id]/index" options={{ title: 'Visite' }} />
          <Stack.Screen name="visites/[id]/modifier" options={{ title: 'Modifier la visite' }} />
          <Stack.Screen name="clients/[id]/index" options={{ title: 'Client' }} />
          <Stack.Screen name="clients/[id]/modifier" options={{ title: 'Modifier le client' }} />
          <Stack.Screen name="clients/nouveau" options={{ title: 'Nouveau client' }} />
          <Stack.Screen name="clients/import" options={{ title: 'Importer des clients' }} />
          <Stack.Screen name="photos/[id]" options={{ title: 'Photo' }} />
          <Stack.Screen name="grille" options={{ title: 'Grille de prix' }} />
          <Stack.Screen name="equipe" options={{ title: 'Mon équipe' }} />
          <Stack.Screen name="chantiers/[id]" options={{ title: 'Chantier' }} />
          <Stack.Screen name="chantiers/decouverte" options={{ title: "Découverte d'un réseau" }} />
          <Stack.Screen name="chantiers/voirie" options={{ title: 'Arrêté de voirie' }} />
          <Stack.Screen name="fiches/[id]" options={{ title: "Fiche d'intervention" }} />
          <Stack.Screen name="arbres/[id]" options={{ title: 'Fiche arbre' }} />
          <Stack.Screen name="devis/[id]" options={{ title: 'Devis' }} />
          <Stack.Screen name="fiche-entreprise" options={{ title: 'Fiche entreprise' }} />
          <Stack.Screen name="croquis" options={{ title: 'Croquis' }} />
        </Stack.Protected>
        <Stack.Protected guard={!signedIn}>
          <Stack.Screen name="connexion" options={{ headerShown: false }} />
        </Stack.Protected>
        <Stack.Protected guard={signedIn && company === null}>
          <Stack.Screen name="entreprise" options={{ title: 'Mon entreprise', headerTitle: () => <BrandTitle /> }} />
        </Stack.Protected>
        <Stack.Screen name="mot-de-passe" options={{ title: 'Nouveau mot de passe' }} />
        <Stack.Screen name="signer/[token]" options={{ headerShown: false }} />
        <Stack.Screen name="rapport/[token]" options={{ headerShown: false }} />
      </Stack>
    </>
  );
}

// Logo + nom dans l'en-tête.
function BrandTitle() {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
      <Image
        source={require('../../assets/images/logo-96.png')}
        style={{ width: 34, height: 34, borderRadius: 8 }}
        accessibilityLabel="Logo Arboject"
      />
      <Text style={{ color: Colors.primaryText, fontSize: 20, fontWeight: '600' }}>Arboject</Text>
    </View>
  );
}
