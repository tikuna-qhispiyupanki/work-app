import { Tabs, useIsFocused } from 'expo-router';
import type { ReactNode } from 'react';
import { Image, Text, View } from 'react-native';

import { Icon, IconName } from '@/components/icon';
import { SyncPill } from '@/components/sync-pill';
import { Colors } from '@/constants/theme';

const tab = (title: string, icon: IconName, iconOn: IconName) => ({
  title,
  tabBarLabel: title,
  tabBarIcon: ({ focused, color }: { focused: boolean; color: unknown }) => <Icon name={focused ? iconOn : icon} size={24} color={typeof color === 'string' ? color : undefined} />,
});

// Barre de navigation en bas : Accueil · Visites · Devis · Clients · Plus.
export default function TabsLayout() {
  return (
    <Tabs
      screenLayout={({ children }) => <OnlyWhenFocused>{children}</OnlyWhenFocused>}
      screenOptions={{
        headerStyle: { backgroundColor: Colors.primary },
        headerTintColor: Colors.primaryText,
        headerTitleStyle: { fontWeight: '600' },
        headerRight: () => <SyncPill />,
        tabBarActiveTintColor: Colors.primary,
        tabBarInactiveTintColor: Colors.textSecondary,
        tabBarStyle: { backgroundColor: Colors.card, borderTopColor: Colors.border, height: 62, paddingTop: 4 },
        tabBarLabelStyle: { fontSize: 12, fontWeight: '600', paddingBottom: 4 },
        sceneStyle: { backgroundColor: Colors.background },
      }}
    >
      <Tabs.Screen name="index" options={{ ...tab('Accueil', 'home-outline', 'home'), headerTitle: () => <BrandTitle /> }} />
      <Tabs.Screen name="visites" options={tab('Visites', 'calendar-outline', 'calendar')} />
      <Tabs.Screen name="devis" options={tab('Devis', 'document-text-outline', 'document-text')} />
      <Tabs.Screen name="clients" options={{ ...tab('Clients', 'people-outline', 'people'), title: 'Carnet clients', tabBarLabel: 'Clients' }} />
      <Tabs.Screen name="plus" options={tab('Plus', 'ellipsis-horizontal-circle-outline', 'ellipsis-horizontal-circle')} />
    </Tabs>
  );
}

function BrandTitle() {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
      <Image source={require('../../../assets/images/logo-96.png')} style={{ width: 32, height: 32, borderRadius: 8 }} accessibilityLabel="Logo Arboject" />
      <Text style={{ color: Colors.primaryText, fontSize: 20, fontWeight: '600' }}>Arboject</Text>
    </View>
  );
}

// Les onglets déjà ouverts restent en mémoire, superposés derrière l'onglet affiché :
// on les masque vraiment (lecteur d'écran VoiceOver, tests automatiques).
function OnlyWhenFocused({ children }: { children: ReactNode }) {
  const focused = useIsFocused();
  return <View style={{ flex: 1, display: focused ? 'flex' : 'none' }}>{children}</View>;
}
