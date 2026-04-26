import { useEffect } from 'react';
import { Platform } from 'react-native';
import {
  initNotificationsHandler,
  requestPermissionIfNeeded,
  scheduleDailyRecap,
} from '@/services/notifications';
import { useSmartHuntStore } from '@/store/useSmartHuntStore';

/**
 * Hook racine — à appeler une seule fois dans RootLayout.
 * - Initialise le handler d'affichage en foreground
 * - Demande la permission push au premier lancement
 * - Maintient le rappel quotidien synchronisé avec la huntList
 */
export function useNotifications(): void {
  const huntList = useSmartHuntStore(s => s.huntList);

  // Init handler + permission (une seule fois)
  useEffect(() => {
    if (Platform.OS === 'web') return;
    try {
      initNotificationsHandler();
      requestPermissionIfNeeded();
    } catch { /* notifications non supportées dans Expo Go SDK 53 */ }
  }, []);

  // Maintenir le rappel quotidien à jour
  useEffect(() => {
    if (Platform.OS === 'web') return;
    try {
      const activeCount = huntList.filter(i => !i.cashbackClaimed).length;
      scheduleDailyRecap(activeCount);
    } catch { /* silencieux */ }
  }, [huntList.length]);
}
