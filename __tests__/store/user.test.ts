/**
 * Tests — Données utilisateur + session
 * Couvre : setUserName, setMonthlyGoal, recordScan, setHasShopmium
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useSmartHuntStore } from '@/store/useSmartHuntStore';

// ── Reset ─────────────────────────────────────────────────────────────────────

beforeEach(() => {
  useSmartHuntStore.setState({
    userName:    'Alex',
    monthlyGoal: 100,
    hasShopmium: null,
    lastScanAt:  null,
  });
  jest.clearAllMocks();
  (AsyncStorage.setItem as jest.Mock).mockClear();
});

// ── setUserName ───────────────────────────────────────────────────────────────

describe('setUserName', () => {
  it('met à jour userName dans le store', () => {
    useSmartHuntStore.getState().setUserName('François');
    expect(useSmartHuntStore.getState().userName).toBe('François');
  });

  it('trim les espaces', () => {
    useSmartHuntStore.getState().setUserName('  Marie  ');
    expect(useSmartHuntStore.getState().userName).toBe('Marie');
  });

  it('persiste dans AsyncStorage', async () => {
    useSmartHuntStore.getState().setUserName('François');
    // Flush promises (AsyncStorage mock est synchrone mais les .catch() sont async)
    await Promise.resolve();
    expect(AsyncStorage.setItem).toHaveBeenCalledWith('smarthunt_user_name', 'François');
  });
});

// ── setMonthlyGoal ────────────────────────────────────────────────────────────

describe('setMonthlyGoal', () => {
  it('met à jour monthlyGoal', () => {
    useSmartHuntStore.getState().setMonthlyGoal(150);
    expect(useSmartHuntStore.getState().monthlyGoal).toBe(150);
  });

  it('persiste dans AsyncStorage', async () => {
    useSmartHuntStore.getState().setMonthlyGoal(200);
    await Promise.resolve();
    expect(AsyncStorage.setItem).toHaveBeenCalledWith('smarthunt_monthly_goal', '200');
  });

  it(`accepte n'importe quelle valeur numérique (pas de validation dans le store)`, () => {
    useSmartHuntStore.getState().setMonthlyGoal(0);
    expect(useSmartHuntStore.getState().monthlyGoal).toBe(0);
  });
});

// ── recordScan ────────────────────────────────────────────────────────────────

describe('recordScan', () => {
  it('enregistre un timestamp dans lastScanAt', () => {
    const before = Date.now();
    useSmartHuntStore.getState().recordScan();
    const { lastScanAt } = useSmartHuntStore.getState();
    const after = Date.now();
    expect(lastScanAt).not.toBeNull();
    expect(lastScanAt!).toBeGreaterThanOrEqual(before);
    expect(lastScanAt!).toBeLessThanOrEqual(after);
  });

  it('persiste dans AsyncStorage', async () => {
    useSmartHuntStore.getState().recordScan();
    await Promise.resolve();
    expect(AsyncStorage.setItem).toHaveBeenCalledWith(
      'smarthunt_last_scan_at',
      expect.any(String)
    );
  });

  it('met à jour le timestamp à chaque appel', async () => {
    useSmartHuntStore.getState().recordScan();
    const first = useSmartHuntStore.getState().lastScanAt;
    await new Promise(r => setTimeout(r, 5)); // délai minimal
    useSmartHuntStore.getState().recordScan();
    const second = useSmartHuntStore.getState().lastScanAt;
    expect(second).toBeGreaterThanOrEqual(first!);
  });
});

// ── setHasShopmium ────────────────────────────────────────────────────────────

describe('setHasShopmium', () => {
  it('passe de null à true', () => {
    expect(useSmartHuntStore.getState().hasShopmium).toBeNull();
    useSmartHuntStore.getState().setHasShopmium(true);
    expect(useSmartHuntStore.getState().hasShopmium).toBe(true);
  });

  it('peut être mis à false', () => {
    useSmartHuntStore.getState().setHasShopmium(false);
    expect(useSmartHuntStore.getState().hasShopmium).toBe(false);
  });
});
