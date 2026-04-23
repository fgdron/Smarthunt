/**
 * Tests — useTutorial hook
 * Couvre : état initial (null), seen=false si non vu, seen=true si déjà vu, markSeen
 */
import { renderHook, act, waitFor } from '@testing-library/react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useTutorial } from '@/hooks/useTutorial';

// ── Reset ─────────────────────────────────────────────────────────────────────

beforeEach(async () => {
  await AsyncStorage.clear();
  jest.clearAllMocks();
});

// ── État initial ──────────────────────────────────────────────────────────────

describe('état initial', () => {
  it('retourne seen=null immédiatement (avant AsyncStorage)', () => {
    const { result } = renderHook(() => useTutorial('catalogue_products'));
    // Au premier rendu, avant que getItem resolve
    expect(result.current.seen).toBeNull();
  });

  it('retourne seen=false si AsyncStorage ne contient rien', async () => {
    const { result } = renderHook(() => useTutorial('catalogue_products'));
    await waitFor(() => {
      expect(result.current.seen).toBe(false);
    });
  });

  it('retourne seen=true si AsyncStorage contient "1"', async () => {
    await AsyncStorage.setItem('tutorial_catalogue_products', '1');
    const { result } = renderHook(() => useTutorial('catalogue_products'));
    await waitFor(() => {
      expect(result.current.seen).toBe(true);
    });
  });
});

// ── Chaque clé est indépendante ───────────────────────────────────────────────

describe('indépendance des clés', () => {
  it('catalogue_products et scanner sont indépendantes', async () => {
    await AsyncStorage.setItem('tutorial_scanner', '1');
    const catalogue = renderHook(() => useTutorial('catalogue_products'));
    const scanner   = renderHook(() => useTutorial('scanner'));

    await waitFor(() => {
      expect(catalogue.result.current.seen).toBe(false);
      expect(scanner.result.current.seen).toBe(true);
    });
  });
});

// ── markSeen ──────────────────────────────────────────────────────────────────

describe('markSeen', () => {
  it('passe seen de false à true', async () => {
    const { result } = renderHook(() => useTutorial('strategy_modes'));
    await waitFor(() => expect(result.current.seen).toBe(false));

    act(() => { result.current.markSeen(); });
    expect(result.current.seen).toBe(true);
  });

  it('persiste "1" dans AsyncStorage', async () => {
    const { result } = renderHook(() => useTutorial('strategy_modes'));
    await waitFor(() => expect(result.current.seen).toBe(false));

    act(() => { result.current.markSeen(); });
    await waitFor(async () => {
      const val = await AsyncStorage.getItem('tutorial_strategy_modes');
      expect(val).toBe('1');
    });
  });

  it('est idempotent (appeler deux fois ne pose pas de problème)', async () => {
    const { result } = renderHook(() => useTutorial('scanner'));
    await waitFor(() => expect(result.current.seen).toBe(false));

    act(() => { result.current.markSeen(); });
    act(() => { result.current.markSeen(); });
    expect(result.current.seen).toBe(true);
  });
});
