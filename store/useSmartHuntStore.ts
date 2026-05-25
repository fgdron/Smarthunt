import { create } from 'zustand';

// ─── Type partagé ParsedProduct (résultat Claude Vision) ─────────────────────
export interface ParsedProduct {
  name:        string;
  brand:       string;
  quantity:    number;
  unit_price:  number;
  total_price: number;
  unit:        string;
}
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Optimization, MOCK_OPTIMIZATIONS } from '@/data/mockData';
import { ProductGroup, ProductVariant, SegmentType, StoreId, findProductGroup, setLiveProductsDB } from '@/data/productsDB';
import { scheduleODRReminders, cancelODRReminders } from '@/services/notifications';
import { fetchProducts, fetchNearbyStores, fetchCashbackOffers, resolveStatus, type DataStatus, type UserCoords } from '@/services/api';
import { filterValidOffers, type ExternalCashbackOffer } from '@/engine/matchOffers';

const SAVED_LISTS_KEY  = 'smarthunt_saved_lists';
const LAST_SCAN_KEY    = 'smarthunt_last_scan_at';
const USER_NAME_KEY    = 'smarthunt_user_name';
const MONTHLY_GOAL_KEY = 'smarthunt_monthly_goal';

// ─── Types ─────────────────────────────────────────────────

interface SavedListItem {
  groupId: string;
  selectedType: SegmentType;
  qty: number;
}

export interface SavedList {
  id: string;
  name: string;
  items: SavedListItem[];
  createdAt: number;  // timestamp ms
}

interface HuntItem {
  optimization: Optimization;
  purchased: boolean;
  cashbackClaimed: boolean;
}

export interface BasketItem {
  groupId: string;
  genericName: string;
  emoji: string;
  selectedType: SegmentType;
  variant: ProductVariant;
  group: ProductGroup;  // toutes les variantes dispo pour la stratégie
  qty: number;
}

// ─── State ─────────────────────────────────────────────────

interface SmartHuntState {
  // Legacy hunt list (scan/ODR flow)
  optimizations: Optimization[];
  huntList: HuntItem[];
  totalSavings: number;
  pendingCashback: number;
  availableCashback: number;
  monthlyGoal: number;
  badges: string[];
  hasShopmium: boolean | null;
  userName: string;

  // Nouveau panier catalogue
  userBasket: BasketItem[];

  // ── Basket Optimizer (nouvelle vision) ───────────────────────────────────
  importedBasket: ParsedProduct[];
  setImportedBasket: (products: ParsedProduct[]) => void;
  clearImportedBasket: () => void;

  // Session active (IDs produits sélectionnés) et Liste Type sauvegardée
  currentSession: string[];
  savedListType: string[];

  // Bibliothèque de listes nommées (persisté via AsyncStorage)
  savedLists: SavedList[];

  // ── Actions hunt legacy ───────────────────────────────────
  addToHunt: (opt: Optimization) => void;
  removeFromHunt: (id: string) => void;
  isInHunt: (id: string) => boolean;
  markPurchased: (id: string) => void;
  claimCashback: (id: string) => void;
  requestTransfer: () => void;
  setHasShopmium: (value: boolean) => void;
  setUserName: (name: string) => void;
  setMonthlyGoal: (goal: number) => void;

  // ── Actions panier catalogue ──────────────────────────────
  addToBasket: (group: ProductGroup, type: SegmentType) => void;
  removeFromBasket: (groupId: string) => void;
  updateBasketType: (groupId: string, type: SegmentType) => void;
  updateBasketQty: (groupId: string, qty: number) => void;
  isInBasket: (groupId: string) => boolean;
  getBasketType: (groupId: string) => SegmentType | null;
  getBasketQty: (groupId: string) => number;
  clearBasket: () => void;

  // ── Session / Liste Type ──────────────────────────────────
  setCurrentSession: (ids: string[]) => void;
  saveListType: () => void;
  loadListType: () => void;

  // ── Bibliothèque de listes ────────────────────────────────
  saveList: (name: string) => void;
  loadList: (id: string) => void;
  deleteList: (id: string) => void;

  // ── Substitutions masquées ────────────────────────────────
  // groupIds dont l'utilisateur a refusé les suggestions MDD
  blacklistedSubstitutes: string[];
  blacklistSubstitute: (groupId: string) => void;

  // ── Scan tracking ─────────────────────────────────────────────
  lastScanAt: number | null; // timestamp ms du dernier scan complété
  recordScan: () => void;

  // ── Base de données V2 (données live) ─────────────────────
  /** Statut de fraîcheur des données produits */
  dbStatus: DataStatus;
  /** Timestamp (ms) du dernier fetch ou lecture de cache réussi */
  dbLastFetched: number | null;
  /**
   * IDs des enseignes disponibles près de l'utilisateur.
   * null = non encore déterminé (GPS absent ou API non appelée).
   */
  nearbyStoreIds: StoreId[] | null;

  /**
   * Initialise la base produits au démarrage :
   *  - Tente un fetch réseau (avec fallback cache)
   *  - Met à jour `dbStatus` et `dbLastFetched`
   *  - Si coords fournis, filtre les enseignes locales
   */
  initProductDB: (coords?: UserCoords) => Promise<void>;

  /**
   * Met à jour les enseignes proches selon les coordonnées GPS.
   * Appelé dès que la permission de localisation est accordée.
   */
  refreshNearbyStores: (coords: UserCoords) => Promise<void>;

  // ── Offres de remboursement (Matchmaker ODR V2) ────────────
  /**
   * Liste des offres externes actives (Shopmium, Quoty, Coupon Network).
   * Pré-filtrées par date d'expiration via `filterValidOffers()`.
   */
  cashbackOffers: ExternalCashbackOffer[];

  /**
   * Rafraîchit les offres depuis l'API et met à jour le cache.
   * Appelé au démarrage et peut être rappelé manuellement (pull-to-refresh).
   */
  refreshOffers: () => Promise<void>;
}

// ─── Store ─────────────────────────────────────────────────

export const useSmartHuntStore = create<SmartHuntState>((set, get) => ({
  optimizations: MOCK_OPTIMIZATIONS,
  huntList: [],
  totalSavings: 34.80,
  pendingCashback: 8.50,
  availableCashback: 26.30,
  monthlyGoal: 100,
  badges: ['b1', 'b2'],
  hasShopmium: null,
  userName: 'Alex',
  userBasket: [],
  importedBasket: [],
  currentSession: [],
  savedListType: [],
  savedLists: [],
  blacklistedSubstitutes: [],
  lastScanAt: null,

  // V2 — état de la base de données live
  dbStatus: 'idle',
  dbLastFetched: null,
  nearbyStoreIds: null,

  // V2 — offres ODR externes
  cashbackOffers: [],

  // ── Hunt legacy ──────────────────────────────────────────

  addToHunt: (opt) => {
    if (!get().huntList.find(i => i.optimization.id === opt.id)) {
      set(s => ({ huntList: [...s.huntList, { optimization: opt, purchased: false, cashbackClaimed: false }] }));
      // Programme les rappels ODR si applicable
      if (opt.odr?.expiresAt) {
        scheduleODRReminders(opt.id, opt.name, opt.odr.cashback, opt.odr.expiresAt).catch(() => {});
      }
    }
  },
  removeFromHunt: (id) => {
    set(s => ({ huntList: s.huntList.filter(i => i.optimization.id !== id) }));
    cancelODRReminders(id).catch(() => {});
  },
  isInHunt: (id) =>
    get().huntList.some(i => i.optimization.id === id),
  markPurchased: (id) =>
    set(s => ({
      huntList: s.huntList.map(i => i.optimization.id === id ? { ...i, purchased: true } : i),
      pendingCashback: s.pendingCashback + (s.huntList.find(i => i.optimization.id === id)?.optimization.odr?.cashback ?? 0),
    })),
  claimCashback: (id) => {
    const item = get().huntList.find(i => i.optimization.id === id);
    if (!item || !item.purchased || item.cashbackClaimed) return;
    const cb = item.optimization.odr?.cashback ?? 0;
    set(s => ({
      huntList: s.huntList.map(i => i.optimization.id === id ? { ...i, cashbackClaimed: true } : i),
      pendingCashback: Math.max(0, s.pendingCashback - cb),
      availableCashback: s.availableCashback + cb,
      totalSavings: s.totalSavings + item.optimization.savings,
    }));
  },
  requestTransfer: () => {
    if (get().availableCashback >= 20) set({ availableCashback: 0 });
  },
  setHasShopmium: (value) => set({ hasShopmium: value }),
  setUserName: (name) => {
    const trimmed = name.trim();
    set({ userName: trimmed });
    AsyncStorage.setItem(USER_NAME_KEY, trimmed).catch(() => {});
  },
  setMonthlyGoal: (goal) => {
    set({ monthlyGoal: goal });
    AsyncStorage.setItem(MONTHLY_GOAL_KEY, String(goal)).catch(() => {});
  },

  // ── Panier catalogue ─────────────────────────────────────

  addToBasket: (group, type) => {
    const variant = group.variants[type];
    if (!variant) return;
    set(s => {
      const exists = s.userBasket.find(i => i.groupId === group.groupId);
      if (exists) {
        // Mettre à jour le type sélectionné
        return {
          userBasket: s.userBasket.map(i =>
            i.groupId === group.groupId
              ? { ...i, selectedType: type, variant: group.variants[type]! }
              : i
          ),
        };
      }
      return {
        userBasket: [...s.userBasket, {
          groupId: group.groupId,
          genericName: group.genericName,
          emoji: group.emoji,
          selectedType: type,
          variant,
          group,
          qty: 1,
        }],
      };
    });
  },

  removeFromBasket: (groupId) =>
    set(s => ({ userBasket: s.userBasket.filter(i => i.groupId !== groupId) })),

  updateBasketType: (groupId, type) => {
    const item = get().userBasket.find(i => i.groupId === groupId);
    if (!item) return;
    const variant = item.group.variants[type];
    if (!variant) return;
    set(s => ({
      userBasket: s.userBasket.map(i =>
        i.groupId === groupId ? { ...i, selectedType: type, variant } : i
      ),
    }));
  },

  updateBasketQty: (groupId, qty) =>
    set(s => ({
      userBasket: s.userBasket.map(i =>
        i.groupId === groupId ? { ...i, qty: Math.max(1, Math.min(99, qty)) } : i
      ),
    })),

  isInBasket: (groupId) =>
    get().userBasket.some(i => i.groupId === groupId),

  getBasketType: (groupId) =>
    get().userBasket.find(i => i.groupId === groupId)?.selectedType ?? null,

  getBasketQty: (groupId) =>
    get().userBasket.find(i => i.groupId === groupId)?.qty ?? 1,

  clearBasket: () => set({ userBasket: [] }),

  // ── Basket Optimizer ─────────────────────────────────────────────────────
  setImportedBasket:   (products) => set({ importedBasket: products }),
  clearImportedBasket: () => set({ importedBasket: [] }),

  // ── Session / Liste Type ─────────────────────────────────

  setCurrentSession: (ids) => set({ currentSession: ids }),

  saveListType: () => {
    const ids = get().userBasket.map(i => i.groupId);
    set({ savedListType: ids });
  },

  loadListType: () => {
    const { savedListType } = get();
    const items: BasketItem[] = savedListType.flatMap(id => {
      const group = findProductGroup(id);
      if (!group) return [];
      const type: SegmentType = group.variants.mdd ? 'mdd'
        : group.variants.leader ? 'leader' : 'bio';
      const variant = group.variants[type]!;
      return [{ groupId: id, genericName: group.genericName, emoji: group.emoji, selectedType: type, variant, group, qty: 1 }];
    });
    set({ userBasket: items });
  },

  // ── Bibliothèque de listes ────────────────────────────────

  saveList: (name) => {
    const { userBasket, savedLists } = get();
    const newList: SavedList = {
      id: `list_${Date.now()}`,
      name: name.trim(),
      items: userBasket.map(i => ({ groupId: i.groupId, selectedType: i.selectedType, qty: i.qty })),
      createdAt: Date.now(),
    };
    const updated = [...savedLists, newList];
    set({ savedLists: updated });
    AsyncStorage.setItem(SAVED_LISTS_KEY, JSON.stringify(updated)).catch(() => {});
  },

  loadList: (id) => {
    const list = get().savedLists.find(l => l.id === id);
    if (!list) return;
    const items: BasketItem[] = list.items.flatMap(saved => {
      const group = findProductGroup(saved.groupId);
      if (!group) return [];
      // Fallback si le type sauvegardé n'existe plus
      const type: SegmentType = group.variants[saved.selectedType]
        ? saved.selectedType
        : (group.variants.mdd ? 'mdd' : group.variants.leader ? 'leader' : 'bio');
      const variant = group.variants[type]!;
      return [{ groupId: saved.groupId, genericName: group.genericName, emoji: group.emoji, selectedType: type, variant, group, qty: saved.qty }];
    });
    set({ userBasket: items });
  },

  deleteList: (id) => {
    const updated = get().savedLists.filter(l => l.id !== id);
    set({ savedLists: updated });
    AsyncStorage.setItem(SAVED_LISTS_KEY, JSON.stringify(updated)).catch(() => {});
  },

  blacklistSubstitute: (groupId) =>
    set(s => ({
      blacklistedSubstitutes: s.blacklistedSubstitutes.includes(groupId)
        ? s.blacklistedSubstitutes
        : [...s.blacklistedSubstitutes, groupId],
    })),

  recordScan: () => {
    const ts = Date.now();
    set({ lastScanAt: ts });
    AsyncStorage.setItem(LAST_SCAN_KEY, String(ts)).catch(() => {});
  },

  // ── V2 — Initialisation dynamique ───────────────────────

  initProductDB: async (coords) => {
    set({ dbStatus: 'loading' });
    try {
      const result = await fetchProducts(coords);

      if (result.products) {
        // Données réseau ou cache — on remplace la base statique
        setLiveProductsDB(result.products);
      }
      // Si result.products === null : pas de réseau et pas de cache
      // → on garde PRODUCTS_DB statique (findProductGroup fonctionne toujours)

      const status = resolveStatus(result.fetchedAt);
      set({ dbStatus: status, dbLastFetched: result.fetchedAt });

      // Filtrage enseignes proches si coordonnées fournies
      if (coords) {
        get().refreshNearbyStores(coords).catch(() => {});
      }
    } catch {
      set({ dbStatus: 'offline' });
    }
  },

  refreshNearbyStores: async (coords) => {
    try {
      const result = await fetchNearbyStores(coords);
      set({ nearbyStoreIds: result.storeIds });
    } catch {
      // En cas d'erreur totale, on laisse nearbyStoreIds à null (toutes enseignes)
    }
  },

  refreshOffers: async () => {
    try {
      const result = await fetchCashbackOffers();
      // On filtre les offres expirées avant de les stocker
      const valid = filterValidOffers(result.offers);
      set({ cashbackOffers: valid });
    } catch {
      // Erreur totale — on garde les offres déjà en mémoire
    }
  },
}));

// ── Auto-hydratation AsyncStorage au démarrage ──────────────
AsyncStorage.getItem(SAVED_LISTS_KEY)
  .then(json => {
    if (json) useSmartHuntStore.setState({ savedLists: JSON.parse(json) });
  })
  .catch(() => {});

AsyncStorage.getItem(LAST_SCAN_KEY)
  .then(val => { if (val) useSmartHuntStore.setState({ lastScanAt: Number(val) }); })
  .catch(() => {});

AsyncStorage.getItem(USER_NAME_KEY)
  .then(val => { if (val) useSmartHuntStore.setState({ userName: val }); })
  .catch(() => {});

AsyncStorage.getItem(MONTHLY_GOAL_KEY)
  .then(val => { if (val) useSmartHuntStore.setState({ monthlyGoal: Number(val) }); })
  .catch(() => {});
