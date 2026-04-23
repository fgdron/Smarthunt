// ============================================================
// SmartHunt — Types du moteur de comparaison
// ============================================================

export type Segment = 'national' | 'mdd' | 'bio' | 'bio_village' | 'repere';
export type Partner = 'shopmium' | 'coupon_network' | 'poulpeo' | 'remise_directe';
export type PromoType = 'percent' | 'fixed' | 'lot' | 'second_half';

// --- Données catalogue ---

export interface Product {
  ean: string;
  name: string;
  brand: string;
  segment: Segment;
  unit_label: string;
  category_slug: string;
  bio_alt_ean?: string;       // EAN de l'alternative Bio si elle existe
  is_top350: boolean;
}

export interface Store {
  id: number;
  slug: string;
  name: string;
  color: string;
}

export interface StoreLocation {
  id: number;
  store: Store;
  name: string;
  city: string;
  lat: number;
  lng: number;
}

export interface StorePrice {
  ean: string;
  store_id: number;
  base_price: number;
  in_stock: boolean;
}

export interface CataloguePromo {
  id: number;
  ean: string;
  store_id: number;
  promo_label: string;
  promo_price: number;        // Prix après remise catalogue
  valid_until: string;
}

export interface CashbackOffer {
  id: number;
  ean: string;
  partner: Partner;
  cashback_amount: number;
  store_ids: number[] | null; // null = valable dans toutes les enseignes
  deeplink_ios: string;
  deeplink_android: string;
  valid_until: string;
}

// --- Panier utilisateur ---

export interface BasketItem {
  ean: string;
  qty: number;
}

export interface UserLocation {
  lat: number;
  lng: number;
  radius_km?: number;          // Rayon de recherche (défaut 10km)
}

// --- Résultats du moteur ---

export interface BioSwitchSuggestion {
  bio_ean: string;
  bio_name: string;
  bio_brand: string;
  bio_unit_label: string;
  bio_best_store: string;
  bio_final_price: number;
  conventional_final_price: number;
  price_delta: number;         // bio - conventional (négatif = bio moins cher)
  recommended: boolean;        // true si delta < 0.30€ ou bio moins cher
}

export interface ItemResult {
  ean: string;
  name: string;
  brand: string;
  unit_label: string;
  segment: Segment;
  qty: number;
  store_id: number;
  store_name: string;
  base_price: number;
  promo_price: number;         // Après remise catalogue (= base_price si pas de promo)
  final_price: number;         // Après cashback
  line_total: number;          // final_price × qty
  savings_amount: number;      // (base_price - final_price) × qty
  savings_percent: number;
  is_cumul_max: boolean;
  promo_label?: string;
  cashback?: {
    partner: Partner;
    amount: number;
    deeplink_ios: string;
  };
  bio_switch?: BioSwitchSuggestion;
}

export interface StoreTotal {
  store_id: number;
  store_name: string;
  store_color: string;
  items: ItemResult[];
  subtotal_base: number;
  subtotal_promo: number;      // Économies catalogue uniquement
  subtotal_cashback: number;   // Total ODR à récupérer
  subtotal_final: number;      // Net-Net
  items_in_stock: number;
  items_total: number;
}

export interface ShoppingScenario {
  scenario: 'mono_store' | 'multi_store';
  total_base: number;
  total_promo_savings: number;
  total_cashback: number;
  total_final: number;
  total_savings: number;
  savings_percent: number;
  stores: StoreTotal[];
  unavailable_items: Array<{ ean: string; name: string }>;
  bio_switches: BioSwitchSuggestion[];
}

export interface StrategyResult {
  user_location: UserLocation;
  nearby_stores: Array<StoreLocation & { distance_km: number }>;
  mono_store: ShoppingScenario;
  multi_store: ShoppingScenario;
  recommended_scenario: 'mono_store' | 'multi_store';
  multi_store_extra_savings: number;  // Gain supplémentaire vs mono
  computed_at: string;
}
