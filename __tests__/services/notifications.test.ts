/**
 * Tests — notifications.ts
 * Couvre : scheduleODRReminders (J-3/J-1), cancelODRReminders, scheduleDailyRecap
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Notifications from 'expo-notifications';

// ── Import du service APRÈS les mocks ─────────────────────────────────────────
import {
  scheduleODRReminders,
  cancelODRReminders,
  scheduleDailyRecap,
  cancelDailyRecap,
} from '@/services/notifications';

// ── Reset ─────────────────────────────────────────────────────────────────────

beforeEach(async () => {
  await AsyncStorage.clear();
  jest.clearAllMocks();
  (Notifications.scheduleNotificationAsync as jest.Mock).mockImplementation(async () => {
    return `mock-id-${Math.random().toString(36).slice(2)}`;
  });
});

// ── scheduleODRReminders ──────────────────────────────────────────────────────

describe('scheduleODRReminders', () => {
  it('programme 2 notifications pour une expiration lointaine (J-3 + J-1)', async () => {
    const farFuture = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
    await scheduleODRReminders('item-1', 'Nutella', 2.00, farFuture);
    expect(Notifications.scheduleNotificationAsync).toHaveBeenCalledTimes(2);
  });

  it("programme 1 seule notification si J-3 est déjà passé mais J-1 est dans le futur", async () => {
    // Dans 2 jours = J-3 passé, J-1 encore valide
    const twoDaysFromNow = new Date(Date.now() + 2 * 24 * 60 * 60 * 1000).toISOString();
    await scheduleODRReminders('item-2', 'Dolce Gusto', 1.50, twoDaysFromNow);
    expect(Notifications.scheduleNotificationAsync).toHaveBeenCalledTimes(1);
  });

  it("ne programme aucune notification si les deux dates sont passées", async () => {
    const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    await scheduleODRReminders('item-3', 'Produit Expiré', 3.00, yesterday);
    expect(Notifications.scheduleNotificationAsync).not.toHaveBeenCalled();
  });

  it('persiste les IDs de notification dans AsyncStorage', async () => {
    const farFuture = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
    await scheduleODRReminders('item-4', 'Test', 1.00, farFuture);
    const stored = await AsyncStorage.getItem('smarthunt_notif_ids');
    expect(stored).not.toBeNull();
    const parsed = JSON.parse(stored!);
    expect(parsed['item-4']).toHaveLength(2);
  });

  it('les notifications ODR contiennent le bon itemId en data', async () => {
    const farFuture = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
    await scheduleODRReminders('item-5', 'Test Data', 2.50, farFuture);
    const calls = (Notifications.scheduleNotificationAsync as jest.Mock).mock.calls;
    calls.forEach(([payload]) => {
      expect(payload.content.data.itemId).toBe('item-5');
    });
  });

  it('les 2 notifications ont des types différents (odr_3d et odr_1d)', async () => {
    const farFuture = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
    await scheduleODRReminders('item-6', 'Test Types', 1.00, farFuture);
    const calls = (Notifications.scheduleNotificationAsync as jest.Mock).mock.calls;
    const types = calls.map(([p]) => p.content.data.type);
    expect(types).toContain('odr_3d');
    expect(types).toContain('odr_1d');
  });
});

// ── cancelODRReminders ────────────────────────────────────────────────────────

describe('cancelODRReminders', () => {
  it("appelle cancelScheduledNotificationAsync pour chaque ID stocké", async () => {
    // Prépare de faux IDs dans AsyncStorage
    await AsyncStorage.setItem(
      'smarthunt_notif_ids',
      JSON.stringify({ 'item-X': ['id-aaa', 'id-bbb'] })
    );
    await cancelODRReminders('item-X');
    expect(Notifications.cancelScheduledNotificationAsync).toHaveBeenCalledWith('id-aaa');
    expect(Notifications.cancelScheduledNotificationAsync).toHaveBeenCalledWith('id-bbb');
  });

  it("supprime les IDs d'AsyncStorage après annulation", async () => {
    await AsyncStorage.setItem(
      'smarthunt_notif_ids',
      JSON.stringify({ 'item-Y': ['id-ccc'] })
    );
    await cancelODRReminders('item-Y');
    const stored = await AsyncStorage.getItem('smarthunt_notif_ids');
    const parsed = JSON.parse(stored!);
    expect(parsed['item-Y']).toBeUndefined();
  });

  it("ne plante pas si aucun ID n'est stocké pour cet item", async () => {
    await expect(cancelODRReminders('item-ghost')).resolves.not.toThrow();
    expect(Notifications.cancelScheduledNotificationAsync).not.toHaveBeenCalled();
  });
});

// ── scheduleDailyRecap ────────────────────────────────────────────────────────

describe('scheduleDailyRecap', () => {
  it('programme une notification daily si count > 0', async () => {
    await scheduleDailyRecap(3);
    expect(Notifications.scheduleNotificationAsync).toHaveBeenCalledTimes(1);
    const [payload] = (Notifications.scheduleNotificationAsync as jest.Mock).mock.calls[0];
    expect(payload.content.data.type).toBe('daily_recap');
  });

  it('ne programme rien si count = 0', async () => {
    await scheduleDailyRecap(0);
    expect(Notifications.scheduleNotificationAsync).not.toHaveBeenCalled();
  });

  it('programme à 9h00 (trigger DAILY)', async () => {
    await scheduleDailyRecap(1);
    const [payload] = (Notifications.scheduleNotificationAsync as jest.Mock).mock.calls[0];
    expect(payload.trigger.hour).toBe(9);
    expect(payload.trigger.minute).toBe(0);
  });

  it('mentionne le nombre de produits dans le body', async () => {
    await scheduleDailyRecap(5);
    const [payload] = (Notifications.scheduleNotificationAsync as jest.Mock).mock.calls[0];
    expect(payload.content.body).toMatch(/5/);
  });

  it(`persiste l'ID du recap dans AsyncStorage`, async () => {
    await scheduleDailyRecap(2);
    const stored = await AsyncStorage.getItem('smarthunt_notif_daily');
    expect(stored).toBeTruthy();
  });
});

// ── cancelDailyRecap ──────────────────────────────────────────────────────────

describe('cancelDailyRecap', () => {
  it("annule la notification et nettoie AsyncStorage", async () => {
    await AsyncStorage.setItem('smarthunt_notif_daily', 'recap-id-999');
    await cancelDailyRecap();
    expect(Notifications.cancelScheduledNotificationAsync).toHaveBeenCalledWith('recap-id-999');
    const stored = await AsyncStorage.getItem('smarthunt_notif_daily');
    expect(stored).toBeNull();
  });

  it("ne plante pas s'il n'y a pas de recap programmé", async () => {
    await expect(cancelDailyRecap()).resolves.not.toThrow();
    expect(Notifications.cancelScheduledNotificationAsync).not.toHaveBeenCalled();
  });
});
