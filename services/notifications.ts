/**
 * notifications.ts — SmartHunt notification service
 * Pure async helpers — no React, no hooks. Platform-safe (no-op on web).
 */
import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';
import AsyncStorage from '@react-native-async-storage/async-storage';

const NOTIF_IDS_KEY    = 'smarthunt_notif_ids';    // Record<itemId, string[]>
const DAILY_RECAP_KEY  = 'smarthunt_notif_daily';  // string (single ID)

// ─── Handler (à appeler une fois au démarrage) ───────────────────────────────
export function initNotificationsHandler(): void {
  if (Platform.OS === 'web') return;
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowAlert:  true,
      shouldPlaySound:  true,
      shouldSetBadge:   true,
      shouldShowBanner: true,
      shouldShowList:   true,
    }),
  });
}

// ─── Permission ──────────────────────────────────────────────────────────────
export async function requestPermissionIfNeeded(): Promise<boolean> {
  if (Platform.OS === 'web') return false;
  try {
    const { status: existing } = await Notifications.getPermissionsAsync();
    if (existing === 'granted') return true;
    const { status } = await Notifications.requestPermissionsAsync();
    return status === 'granted';
  } catch {
    return false;
  }
}

// ─── Rappels ODR ─────────────────────────────────────────────────────────────
/**
 * Programme 2 notifications locales pour un item ODR :
 *   - J-3 avant expiration
 *   - J-1 avant expiration
 * Les IDs sont persistés dans AsyncStorage pour pouvoir les annuler.
 */
export async function scheduleODRReminders(
  itemId: string,
  itemName: string,
  cashback: number,
  expiresAt: string,
): Promise<void> {
  if (Platform.OS === 'web') return;
  try {
    const expiry = new Date(expiresAt).getTime();
    const now    = Date.now();
    const ids: string[] = [];

    // J-3
    const threeDaysBefore = expiry - 3 * 24 * 60 * 60 * 1000;
    if (threeDaysBefore > now) {
      const id = await Notifications.scheduleNotificationAsync({
        content: {
          title: '⏰ ODR expire dans 3 jours',
          body:  `${itemName} — Récupérez vos ${cashback.toFixed(2)} € avant qu'il soit trop tard !`,
          data:  { itemId, type: 'odr_3d' },
        },
        trigger: {
          type: Notifications.SchedulableTriggerInputTypes.DATE,
          date: new Date(threeDaysBefore),
        },
      });
      ids.push(id);
    }

    // J-1
    const oneDayBefore = expiry - 24 * 60 * 60 * 1000;
    if (oneDayBefore > now) {
      const id = await Notifications.scheduleNotificationAsync({
        content: {
          title: '🚨 Dernière chance !',
          body:  `${itemName} — Votre remboursement de ${cashback.toFixed(2)} € expire demain !`,
          data:  { itemId, type: 'odr_1d' },
        },
        trigger: {
          type: Notifications.SchedulableTriggerInputTypes.DATE,
          date: new Date(oneDayBefore),
        },
      });
      ids.push(id);
    }

    if (ids.length > 0) {
      const stored = await _loadIds();
      stored[itemId] = ids;
      await AsyncStorage.setItem(NOTIF_IDS_KEY, JSON.stringify(stored));
    }
  } catch {
    // Silencieux : simulateurs sans support push
  }
}

/** Annule les rappels ODR programmés pour un item. */
export async function cancelODRReminders(itemId: string): Promise<void> {
  if (Platform.OS === 'web') return;
  try {
    const stored  = await _loadIds();
    const toCancel = stored[itemId] ?? [];
    await Promise.all(toCancel.map(id => Notifications.cancelScheduledNotificationAsync(id)));
    delete stored[itemId];
    await AsyncStorage.setItem(NOTIF_IDS_KEY, JSON.stringify(stored));
  } catch {}
}

// ─── Rappel quotidien ────────────────────────────────────────────────────────
/**
 * Programme (ou re-programme) un rappel quotidien à 9h00 si l'utilisateur
 * a des items actifs dans sa liste. Annule l'ancien si présent.
 */
export async function scheduleDailyRecap(activeCount: number): Promise<void> {
  if (Platform.OS === 'web') return;
  try {
    await cancelDailyRecap();
    if (activeCount === 0) return;
    const id = await Notifications.scheduleNotificationAsync({
      content: {
        title: '🎯 SmartHunt — Vos économies vous attendent',
        body: `${activeCount} produit${activeCount > 1 ? 's' : ''} dans votre liste de chasse. Pensez à scanner votre ticket !`,
        data: { type: 'daily_recap' },
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.DAILY,
        hour: 9,
        minute: 0,
      },
    });
    await AsyncStorage.setItem(DAILY_RECAP_KEY, id);
  } catch {}
}

export async function cancelDailyRecap(): Promise<void> {
  if (Platform.OS === 'web') return;
  try {
    const id = await AsyncStorage.getItem(DAILY_RECAP_KEY);
    if (id) {
      await Notifications.cancelScheduledNotificationAsync(id);
      await AsyncStorage.removeItem(DAILY_RECAP_KEY);
    }
  } catch {}
}

// ─── Helpers ─────────────────────────────────────────────────────────────────
async function _loadIds(): Promise<Record<string, string[]>> {
  try {
    const json = await AsyncStorage.getItem(NOTIF_IDS_KEY);
    return json ? JSON.parse(json) as Record<string, string[]> : {};
  } catch {
    return {};
  }
}
