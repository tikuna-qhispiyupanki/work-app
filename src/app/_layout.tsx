import { PowerSyncContext } from '@powersync/react';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useState } from 'react';
import { Image, Text, View } from 'react-native';

import { SyncStatus } from '@/components/sync-status';
import { Colors } from '@/constants/theme';
import { db, requestPersistentStorage } from '@/db/database';
import { registerServiceWorker } from '@/pwa/register';

export default function RootLayout() {
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    db.init().catch((e: unknown) => setError(String(e)));
    requestPersistentStorage();
    registerServiceWorker();
  }, []);

  return (
    <PowerSyncContext.Provider value={db}>
      <StatusBar style="light" />
      <View style={{ flex: 1, backgroundColor: Colors.background }}>
        <View style={{ flex: 1, width: '100%', maxWidth: 720, alignSelf: 'center' }}>
          <Stack
            screenOptions={{
              headerStyle: { backgroundColor: Colors.primary },
              headerTintColor: Colors.primaryText,
              contentStyle: { backgroundColor: Colors.background },
            }}
          >
            <Stack.Screen name="index" options={{ title: 'Arboject', headerTitle: () => <BrandTitle /> }} />
            <Stack.Screen name="visites/nouvelle" options={{ title: 'Nouvelle visite' }} />
            <Stack.Screen name="visites/[id]/index" options={{ title: 'Visite' }} />
            <Stack.Screen name="visites/[id]/modifier" options={{ title: 'Modifier la visite' }} />
          </Stack>
          {error ? (
            <Text style={{ color: Colors.warning, padding: 12 }}>Erreur de la base locale : {error}</Text>
          ) : null}
          <SyncStatus />
        </View>
      </View>
    </PowerSyncContext.Provider>
  );
}

// Logo + nom dans l'en-tête de l'accueil.
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
