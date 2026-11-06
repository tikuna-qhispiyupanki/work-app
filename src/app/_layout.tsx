import { PowerSyncContext } from '@powersync/react';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useState } from 'react';
import { Text, View } from 'react-native';

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
            <Stack.Screen name="index" options={{ title: 'Arboject' }} />
            <Stack.Screen name="visites/nouvelle" options={{ title: 'Nouvelle visite' }} />
            <Stack.Screen name="visites/[id]" options={{ title: 'Visite' }} />
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
