import { useEffect, useRef } from 'react';
import { Platform, View } from 'react-native';
import { Stack, useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import * as Notifications from 'expo-notifications';
import * as Location from 'expo-location';
import { Colors } from '@/constants/theme';
import { useNotifications } from '@/hooks/useNotifications';
import { useSmartHuntStore } from '@/store/useSmartHuntStore';
import OfflineBanner from '@/components/OfflineBanner';

// ─── Types data payload ──────────────────────────────────────────────────────
type NotifData = { type?: 'odr_3d' | 'odr_1d' | 'daily_recap'; itemId?: string };

// ─── Routing selon le type de notification ────────────────────────────────────
function resolveRoute(data: NotifData): string | null {
  if (data?.type === 'odr_3d' || data?.type === 'odr_1d') return '/(tabs)/wallet';
  if (data?.type === 'daily_recap') return '/(tabs)/catalogue';
  return null;
}

/** Composant sans UI — active le système de notifications push locales. */
function NotificationsSetup() {
  useNotifications();
  return null;
}

/**
 * Composant sans UI — initialise la base de données produits au démarrage.
 *
 * Stratégie :
 *  1. Lance le fetch produits immédiatement (cache frais → instantané)
 *  2. Demande la permission de localisation en parallèle
 *  3. Si accordée, relance un fetch ciblé sur les enseignes proches
 */
function ProductDBInit() {
  const initProductDB       = useSmartHuntStore(s => s.initProductDB);
  const refreshNearbyStores = useSmartHuntStore(s => s.refreshNearbyStores);
  const refreshOffers       = useSmartHuntStore(s => s.refreshOffers);

  useEffect(() => {
    if (Platform.OS === 'web') {
      // Sur web : fetch sans coordonnées GPS
      initProductDB().catch(() => {});
      return;
    }

    // Lance le fetch immédiatement (sans coords) — utilise le cache si frais
    initProductDB().catch(() => {});

    // Offres ODR en parallèle — cache 1h, fallback tableau vide
    refreshOffers().catch(() => {});

    // Tente d'affiner avec les coordonnées GPS (meilleurs prix locaux)
    Location.getForegroundPermissionsAsync()
      .then(({ status }) => {
        if (status !== 'granted') return;
        return Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      })
      .then(location => {
        if (!location) return;
        const coords = {
          lat: location.coords.latitude,
          lng: location.coords.longitude,
        };
        // Re-fetch avec coordonnées pour filtrer les enseignes locales
        initProductDB(coords).catch(() => {});
        refreshNearbyStores(coords).catch(() => {});
      })
      .catch(() => { /* pas de localisation → données nationales */ });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return null;
}

/**
 * Composant sans UI — gère les deeplinkss depuis les notifications :
 *  - Tap en foreground/background : `addNotificationResponseReceivedListener`
 *  - Tap depuis app killed       : `getLastNotificationResponseAsync`
 */
function DeeplinkHandler() {
  const router  = useRouter();
  const handled = useRef(false); // évite de naviguer deux fois au démarrage

  useEffect(() => {
    if (Platform.OS === 'web') return;

    // ── Cas app killed : lire la dernière réponse en attente ──────────────────
    Notifications.getLastNotificationResponseAsync().then(response => {
      if (!response || handled.current) return;
      const data = response.notification.request.content.data as NotifData;
      const route = resolveRoute(data);
      if (route) {
        handled.current = true;
        // Légère attente pour laisser le layout se monter
        setTimeout(() => router.push(route as Parameters<typeof router.push>[0]), 300);
      }
    });

    // ── Cas foreground/background : écoute continue ───────────────────────────
    const sub = Notifications.addNotificationResponseReceivedListener(response => {
      const data  = response.notification.request.content.data as NotifData;
      const route = resolveRoute(data);
      if (route) router.push(route as Parameters<typeof router.push>[0]);
    });

    return () => sub.remove();
  }, [router]);

  return null;
}

export default function RootLayout() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <NotificationsSetup />
      <DeeplinkHandler />
      <ProductDBInit />
      <StatusBar style="light" />
      {/* Bannière persistante affichée au-dessus du contenu en mode dégradé */}
      <View style={{ flex: 1 }}>
        <OfflineBanner />
        <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: Colors.background },
          animation: 'slide_from_right',
        }}
      >
        <Stack.Screen name="onboarding" options={{ animation: 'fade', gestureEnabled: false }} />
        <Stack.Screen name="(tabs)" options={{ animation: 'none' }} />
        <Stack.Screen name="product/[id]" options={{ animation: 'slide_from_right' }} />
        <Stack.Screen name="basket-summary" options={{ animation: 'slide_from_bottom' }} />
        <Stack.Screen name="strategy" options={{ animation: 'slide_from_bottom' }} />
        <Stack.Screen name="report-promo" options={{ animation: 'slide_from_bottom' }} />
        </Stack>
      </View>
    </GestureHandlerRootView>
  );
}
