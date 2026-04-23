import { useEffect, useState, useCallback } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

// ─── Clés disponibles ────────────────────────────────────────────────────────
export const TUTORIAL_KEYS = {
  catalogue_products: 'tutorial_catalogue_products',
  strategy_modes:     'tutorial_strategy_modes',
  scanner:            'tutorial_scanner',
} as const;

export type TutorialKey = keyof typeof TUTORIAL_KEYS;

// ─── Hook ────────────────────────────────────────────────────────────────────
/**
 * Retourne `seen = null` pendant la lecture AsyncStorage,
 * `false` si le tutoriel n'a pas encore été vu,
 * `true` s'il a déjà été vu.
 *
 * `markSeen()` persiste immédiatement et met à jour l'état local.
 */
export function useTutorial(key: TutorialKey): {
  seen: boolean | null;
  markSeen: () => void;
} {
  const [seen, setSeen] = useState<boolean | null>(null);

  useEffect(() => {
    AsyncStorage.getItem(TUTORIAL_KEYS[key])
      .then(val => setSeen(val === '1'))
      .catch(() => setSeen(true)); // En cas d'erreur, ne pas bloquer l'UI
  }, [key]);

  const markSeen = useCallback(() => {
    setSeen(true);
    AsyncStorage.setItem(TUTORIAL_KEYS[key], '1').catch(() => {});
  }, [key]);

  return { seen, markSeen };
}
