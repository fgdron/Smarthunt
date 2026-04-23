/**
 * SmartHunt — Service API V2
 *
 * Stratégie de données (par ordre de priorité) :
 *   1. Cache AsyncStorage frais  (<24h)  → retourné immédiatement
 *   2. Appel réseau avec timeout (8s)    → met à jour le cache
 *   3. Cache stale (<7j)                 → utilisé si réseau KO
 *   4. null                              → le store garde les données statiques locales
 *
 * TODO : remplacer API_BASE_URL par votre URL de production.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import type { ProductGroup, StoreId } from '@/data/productsDB';
import type { ExternalCashbackOffer } from '@/engine/matchOffers';

// ─── Configuration ────────────────────────────────────────────────────────────

/**
 * URL de base de l'API.
 *
 * Développement local :
 *   'http://localhost:3000/v1'
 *
 * Production Railway (après `railway domain`) :
 *   'https://smarthunt-backend-production.up.railway.app/v1'
 *
 * Remplacer cette valeur après déploiement.
 */
export const API_BASE_URL = 'http://localhost:3000/v1';

const FETCH_TIMEOUT_MS  = 8_000;

/** Re-fetch transparent si le cache est plus vieux que 24h */
const CACHE_FRESH_MS    = 24 * 60 * 60 * 1000;
/** Toujours utilisable mais déclenche la bannière "hors-ligne" */
const CACHE_STALE_MS    =  7 * 24 * 60 * 60 * 1000;
/** Cache des enseignes proches : valide 2h (les magasins bougent peu) */
const STORES_CACHE_MS   =  2 * 60 * 60 * 1000;
/** Tolérance de déplacement GPS avant d'invalider le cache enseignes (≈ 1 km) */
const GPS_DELTA_DEG     = 0.009;

const CACHE_KEY_PRODUCTS = 'smarthunt_products_v2';
const CACHE_KEY_STORES   = 'smarthunt_nearby_stores_v2';
const CACHE_KEY_OFFERS   = 'smarthunt_cashback_offers_v2';

/** Cache des offres ODR : 1h (les offres changent souvent, mais pas à la minute) */
const OFFERS_CACHE_MS    = 60 * 60 * 1000;

// ─── Types publics ────────────────────────────────────────────────────────────

export type DataStatus = 'idle' | 'loading' | 'fresh' | 'cached' | 'stale' | 'offline';

export interface UserCoords {
  lat: number;
  lng: number;
}

export interface FetchProductsResult {
  /** null = réseau KO + aucun cache disponible → le store utilise les données statiques */
  products: ProductGroup[] | null;
  fetchedAt: number | null;
  source: 'api' | 'cache' | 'fallback';
}

export interface FetchStoresResult {
  storeIds: StoreId[];
  source: 'api' | 'cache' | 'default';
}

// ─── Types internes (cache) ───────────────────────────────────────────────────

interface ApiProductsResponse {
  products: ProductGroup[];
  generated_at: number;
}

interface ApiStoresResponse {
  store_ids: StoreId[];
  generated_at: number;
}

interface ApiOffersResponse {
  offers: ExternalCashbackOffer[];
  generated_at: number;
}

interface OffersCache {
  offers: ExternalCashbackOffer[];
  fetchedAt: number;
}

interface ProductsCache {
  products: ProductGroup[];
  fetchedAt: number;
}

interface StoresCache {
  storeIds: StoreId[];
  fetchedAt: number;
  coords: UserCoords;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

/** Fetch avec timeout via AbortController */
function fetchWithTimeout(url: string, ms = FETCH_TIMEOUT_MS): Promise<Response> {
  const ctrl  = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), ms);
  return fetch(url, { signal: ctrl.signal }).finally(() => clearTimeout(timer));
}

/** Formate l'âge d'un timestamp pour l'affichage UI (ex : "3h", "2 j") */
export function formatDataAge(fetchedAt: number): string {
  const diff    = Date.now() - fetchedAt;
  const minutes = Math.floor(diff / 60_000);
  if (minutes < 1)  return 'à l\'instant';
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24)   return `${hours}h`;
  return `${Math.floor(hours / 24)} j`;
}

/** Détermine le statut selon l'âge du cache */
export function resolveStatus(fetchedAt: number | null): DataStatus {
  if (!fetchedAt) return 'offline';
  const age = Date.now() - fetchedAt;
  if (age < CACHE_FRESH_MS) return 'fresh';
  if (age < CACHE_STALE_MS) return 'cached';
  return 'stale';
}

// ─── Cache produits ───────────────────────────────────────────────────────────

async function readProductsCache(): Promise<ProductsCache | null> {
  try {
    const raw = await AsyncStorage.getItem(CACHE_KEY_PRODUCTS);
    return raw ? (JSON.parse(raw) as ProductsCache) : null;
  } catch {
    return null;
  }
}

async function writeProductsCache(products: ProductGroup[]): Promise<void> {
  try {
    const cache: ProductsCache = { products, fetchedAt: Date.now() };
    await AsyncStorage.setItem(CACHE_KEY_PRODUCTS, JSON.stringify(cache));
  } catch { /* silencieux — écriture best-effort */ }
}

// ─── Cache enseignes ──────────────────────────────────────────────────────────

async function readStoresCache(): Promise<StoresCache | null> {
  try {
    const raw = await AsyncStorage.getItem(CACHE_KEY_STORES);
    return raw ? (JSON.parse(raw) as StoresCache) : null;
  } catch {
    return null;
  }
}

async function writeStoresCache(storeIds: StoreId[], coords: UserCoords): Promise<void> {
  try {
    const cache: StoresCache = { storeIds, fetchedAt: Date.now(), coords };
    await AsyncStorage.setItem(CACHE_KEY_STORES, JSON.stringify(cache));
  } catch { /* silencieux */ }
}

// ─── API publique ─────────────────────────────────────────────────────────────

/**
 * Récupère la base produits depuis l'API avec fallback cache → statique.
 *
 * @param coords  Optionnel — si fourni, l'API filtre les prix aux enseignes proches.
 */
export async function fetchProducts(coords?: UserCoords): Promise<FetchProductsResult> {
  // 1. Cache frais → réponse immédiate, pas d'appel réseau
  const cached = await readProductsCache();
  if (cached && Date.now() - cached.fetchedAt < CACHE_FRESH_MS) {
    return { products: cached.products, fetchedAt: cached.fetchedAt, source: 'cache' };
  }

  // 2. Appel réseau
  try {
    const qs  = coords ? `?lat=${coords.lat}&lng=${coords.lng}` : '';
    const res = await fetchWithTimeout(`${API_BASE_URL}/products${qs}`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);

    const data: ApiProductsResponse = await res.json();
    await writeProductsCache(data.products);
    return { products: data.products, fetchedAt: Date.now(), source: 'api' };
  } catch {
    // 3. Cache stale si disponible
    if (cached) {
      return { products: cached.products, fetchedAt: cached.fetchedAt, source: 'cache' };
    }
    // 4. Aucun cache → le store utilisera les données statiques locales
    return { products: null, fetchedAt: null, source: 'fallback' };
  }
}

/**
 * Récupère les IDs des enseignes proches pour l'emplacement GPS donné.
 * Cache 2h, invalide si l'utilisateur s'est déplacé de plus de ~1 km.
 *
 * @param coords    Coordonnées GPS de l'utilisateur.
 * @param radiusKm  Rayon de recherche en km (défaut : 20).
 */
export async function fetchNearbyStores(
  coords: UserCoords,
  radiusKm = 20,
): Promise<FetchStoresResult> {
  // Cache valide et position proche ?
  const cached = await readStoresCache();
  if (cached) {
    const fresh    = Date.now() - cached.fetchedAt < STORES_CACHE_MS;
    const sameZone = Math.abs(cached.coords.lat - coords.lat) < GPS_DELTA_DEG
                  && Math.abs(cached.coords.lng - coords.lng) < GPS_DELTA_DEG;
    if (fresh && sameZone) {
      return { storeIds: cached.storeIds, source: 'cache' };
    }
  }

  // Appel réseau
  try {
    const url = `${API_BASE_URL}/stores/nearby?lat=${coords.lat}&lng=${coords.lng}&radius_km=${radiusKm}`;
    const res = await fetchWithTimeout(url);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);

    const data: ApiStoresResponse = await res.json();
    await writeStoresCache(data.store_ids, coords);
    return { storeIds: data.store_ids, source: 'api' };
  } catch {
    // Fallback cache stale
    if (cached) return { storeIds: cached.storeIds, source: 'cache' };

    // Fallback absolu : toutes les enseignes (comportement pré-V2)
    return {
      storeIds: ['leclerc', 'superu', 'carrefour', 'intermarche', 'auchan', 'monoprix', 'lidl', 'aldi'],
      source: 'default',
    };
  }
}

// ─── Cache offres ODR ─────────────────────────────────────────────────────────

async function readOffersCache(): Promise<OffersCache | null> {
  try {
    const raw = await AsyncStorage.getItem(CACHE_KEY_OFFERS);
    return raw ? (JSON.parse(raw) as OffersCache) : null;
  } catch {
    return null;
  }
}

async function writeOffersCache(offers: ExternalCashbackOffer[]): Promise<void> {
  try {
    const cache: OffersCache = { offers, fetchedAt: Date.now() };
    await AsyncStorage.setItem(CACHE_KEY_OFFERS, JSON.stringify(cache));
  } catch { /* silencieux */ }
}

// ─── fetchCashbackOffers ──────────────────────────────────────────────────────

export interface FetchOffersResult {
  offers: ExternalCashbackOffer[];
  /** false si les données viennent d'un cache stale ou du réseau */
  fromCache: boolean;
}

/**
 * Récupère les offres de remboursement actives depuis l'API.
 *
 * Cache 1h — les offres sont rafraîchies fréquemment côté serveur.
 * En cas d'échec réseau, retourne le cache stale (offres potentiellement expirées,
 * mais `filterValidOffers()` dans le matchmaker élimine les périmées).
 *
 * Endpoint attendu : GET /v1/offers
 * Réponse         : { offers: ExternalCashbackOffer[], generated_at: number }
 */
export async function fetchCashbackOffers(): Promise<FetchOffersResult> {
  // Cache frais → réponse immédiate
  const cached = await readOffersCache();
  if (cached && Date.now() - cached.fetchedAt < OFFERS_CACHE_MS) {
    return { offers: cached.offers, fromCache: true };
  }

  // Appel réseau
  try {
    const res = await fetchWithTimeout(`${API_BASE_URL}/offers`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);

    const data: ApiOffersResponse = await res.json();
    await writeOffersCache(data.offers);
    return { offers: data.offers, fromCache: false };
  } catch {
    // Cache stale si disponible
    if (cached) return { offers: cached.offers, fromCache: true };
    // Aucune offre disponible — le matchmaker retournera null pour chaque produit
    return { offers: [], fromCache: false };
  }
}
