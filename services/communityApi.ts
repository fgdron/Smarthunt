/**
 * SmartHunt — Service API Communauté
 *
 * Gère le signalement de promos en magasin, les votes communautaires,
 * et la consultation des promos signalées.
 *
 * Authentification : UUID anonyme généré une seule fois par device,
 * stocké en AsyncStorage et envoyé en header X-User-Id.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { API_BASE_URL } from './api';

// ─── Constantes ───────────────────────────────────────────────────────────────

const CACHE_KEY_USER_ID      = 'smarthunt_user_id';
const CACHE_KEY_PROMOS       = 'smarthunt_community_promos_v1';
const PROMOS_CACHE_MS        = 15 * 60 * 1000; // 15 min
const FETCH_TIMEOUT_MS       = 8_000;

// ─── Types publics ────────────────────────────────────────────────────────────

export type PromoType    = 'percent' | 'immediate' | 'volume' | 'bundle';
export type StockLevel   = 'low' | 'medium' | 'high';
export type PromoStatus  = 'pending' | 'confirmed' | 'rejected' | 'expired';
export type VoteType     = 'up' | 'down';

export interface ReportPromoPayload {
  ean:         string;
  storeId:     string;
  promoType:   PromoType;
  promoValue:  number;
  promoLabel:  string;
  stockLevel:  StockLevel;
  unitsApprox?: number;
  validUntil?: string; // ISO datetime
}

export interface CommunityPromo {
  id:           string;
  ean:          string;
  storeId:      string;
  promoType:    PromoType;
  promoValue:   number;
  promoLabel:   string;
  stockLevel:   StockLevel;
  unitsApprox:  number | null;
  validUntil:   string | null;
  upvotes:      number;
  downvotes:    number;
  status:       PromoStatus;
  createdAt:    string;
  expiresAt:    string;
  // Enrichi par JOIN côté backend
  brand?:       string;
  variantName?: string;
  genericName?: string;
  emoji?:       string;
}

export interface VoteResult {
  ok:        boolean;
  upvotes:   number;
  downvotes: number;
  status:    PromoStatus;
}

export interface PromosByEanResult {
  ean:    string;
  promos: CommunityPromo[];
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

/** Génère ou récupère l'UUID anonyme de l'utilisateur */
export async function getUserId(): Promise<string> {
  try {
    const stored = await AsyncStorage.getItem(CACHE_KEY_USER_ID);
    if (stored) return stored;

    // Génère un UUID v4 simple
    const uuid = 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
      const r = (Math.random() * 16) | 0;
      const v = c === 'x' ? r : (r & 0x3) | 0x8;
      return v.toString(16);
    });

    await AsyncStorage.setItem(CACHE_KEY_USER_ID, uuid);
    return uuid;
  } catch {
    return 'anonymous';
  }
}

/** Fetch avec timeout et header X-User-Id */
async function fetchWithAuth(
  url: string,
  options: RequestInit = {},
): Promise<Response> {
  const userId = await getUserId();
  const ctrl   = new AbortController();
  const timer  = setTimeout(() => ctrl.abort(), FETCH_TIMEOUT_MS);

  return fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      'X-User-Id':    userId,
      ...(options.headers ?? {}),
    },
    signal: ctrl.signal,
  }).finally(() => clearTimeout(timer));
}

// ─── API publique ─────────────────────────────────────────────────────────────

/**
 * Signale une promo vue en magasin.
 * L'utilisateur vient de scanner un EAN et remplit le formulaire.
 */
export async function reportPromo(
  payload: ReportPromoPayload,
): Promise<{ ok: boolean; message: string }> {
  const res = await fetchWithAuth(`${API_BASE_URL}/community/promos`, {
    method: 'POST',
    body:   JSON.stringify(payload),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`HTTP ${res.status}: ${err}`);
  }

  return res.json();
}

/**
 * Vote pour confirmer ou rejeter un signalement.
 * Un user ne peut voter qu'une seule fois par signalement (géré backend).
 */
export async function votePromo(
  promoId: string,
  vote: VoteType,
): Promise<VoteResult> {
  const res = await fetchWithAuth(
    `${API_BASE_URL}/community/promos/${promoId}/vote`,
    {
      method: 'POST',
      body:   JSON.stringify({ vote }),
    },
  );

  if (res.status === 409) {
    throw new Error('already_voted');
  }

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`HTTP ${res.status}: ${err}`);
  }

  return res.json();
}

/**
 * Récupère les promos confirmées — avec cache 15 min.
 * Optionnel : filtrer par storeId.
 */
export async function fetchCommunityPromos(options?: {
  storeId?: string;
  status?:  PromoStatus;
  limit?:   number;
  forceRefresh?: boolean;
}): Promise<CommunityPromo[]> {
  const { storeId, status = 'confirmed', limit = 50, forceRefresh = false } = options ?? {};

  // Cache
  if (!forceRefresh) {
    try {
      const raw = await AsyncStorage.getItem(CACHE_KEY_PROMOS);
      if (raw) {
        const { promos, fetchedAt } = JSON.parse(raw) as {
          promos: CommunityPromo[];
          fetchedAt: number;
        };
        if (Date.now() - fetchedAt < PROMOS_CACHE_MS) {
          // Filtre local si storeId précisé
          return storeId
            ? promos.filter(p => p.storeId === storeId)
            : promos;
        }
      }
    } catch { /* cache invalide, on re-fetch */ }
  }

  const params = new URLSearchParams({ status, limit: String(limit) });
  if (storeId) params.set('storeId', storeId);

  const res = await fetchWithAuth(
    `${API_BASE_URL}/community/promos?${params.toString()}`,
  );

  if (!res.ok) throw new Error(`HTTP ${res.status}`);

  const data = await res.json() as { promos: CommunityPromo[] };

  // Mise en cache (sans filtre storeId pour réutiliser)
  if (!storeId) {
    try {
      await AsyncStorage.setItem(
        CACHE_KEY_PROMOS,
        JSON.stringify({ promos: data.promos, fetchedAt: Date.now() }),
      );
    } catch { /* best-effort */ }
  }

  return data.promos;
}

/**
 * Récupère les promos (pending + confirmed) pour un EAN donné.
 * Utilisé sur la fiche produit après scan.
 * Pas de cache — on veut toujours les données fraîches.
 */
export async function fetchPromosByEan(ean: string): Promise<CommunityPromo[]> {
  const res = await fetchWithAuth(
    `${API_BASE_URL}/community/promos/product/${ean}`,
  );

  if (!res.ok) throw new Error(`HTTP ${res.status}`);

  const data = await res.json() as PromosByEanResult;
  return data.promos;
}

/**
 * Invalide le cache local des promos communautaires.
 * À appeler après un signalement pour forcer le rechargement.
 */
export async function invalidatePromosCache(): Promise<void> {
  try {
    await AsyncStorage.removeItem(CACHE_KEY_PROMOS);
  } catch { /* silencieux */ }
}

// ─── Helpers UI ───────────────────────────────────────────────────────────────

/** Label lisible pour le type de promo */
export function promoTypeLabel(type: PromoType): string {
  const labels: Record<PromoType, string> = {
    percent:   '% de réduction',
    immediate: 'Remise immédiate',
    volume:    'Offre volume',
    bundle:    'Lot / bundle',
  };
  return labels[type];
}

/** Label lisible pour le stock */
export function stockLevelLabel(level: StockLevel): string {
  const labels: Record<StockLevel, string> = {
    low:    'Stock faible (< 5)',
    medium: 'Stock moyen',
    high:   'Stock important',
  };
  return labels[level];
}

/** Emoji stock */
export function stockLevelEmoji(level: StockLevel): string {
  return { low: '🔴', medium: '🟡', high: '🟢' }[level];
}

/** Formate la valeur d'une promo pour l'affichage */
export function formatPromoValue(type: PromoType, value: number): string {
  if (type === 'percent')   return `-${value}%`;
  if (type === 'immediate') return `-${value.toFixed(2)}€`;
  if (type === 'volume')    return `Lot ×${value}`;
  return `Bundle ×${value}`;
}

/** Âge d'un signalement en texte court */
export function promoAge(createdAt: string): string {
  const diff    = Date.now() - new Date(createdAt).getTime();
  const minutes = Math.floor(diff / 60_000);
  if (minutes < 1)  return 'à l\'instant';
  if (minutes < 60) return `il y a ${minutes} min`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24)   return `il y a ${hours}h`;
  return `il y a ${Math.floor(hours / 24)}j`;
}
