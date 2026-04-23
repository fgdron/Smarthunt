// ============================================================
// SmartHunt — Catalogue de test (représentatif des 350 produits)
// Couvre : nationales avec CUMUL MAX, MDD sans promo, Bio, et
// produits avec cashback seul ou promo seule.
// ============================================================

import {
  Product, Store, StoreLocation,
  StorePrice, CataloguePromo, CashbackOffer,
} from './types';

// --- Enseignes ---

export const STORES: Store[] = [
  { id: 1, slug: 'leclerc',     name: 'E.Leclerc',   color: '#0055A4' },
  { id: 2, slug: 'carrefour',   name: 'Carrefour',    color: '#004B98' },
  { id: 3, slug: 'intermarche', name: 'Intermarché',  color: '#E20613' },
];

export const STORE_LOCATIONS: StoreLocation[] = [
  { id: 1,  store: STORES[0], name: 'Leclerc Nantes Nord',        city: 'Nantes',    lat: 47.2588, lng: -1.5001 },
  { id: 2,  store: STORES[1], name: 'Carrefour Nantes Atlantis',  city: 'Nantes',    lat: 47.2530, lng: -1.6198 },
  { id: 3,  store: STORES[2], name: 'Intermarché Nantes Doulon',  city: 'Nantes',    lat: 47.2270, lng: -1.5100 },
];

// --- Produits (20 représentatifs des 350) ---

export const PRODUCTS: Product[] = [
  // Nationales — avec CUMUL MAX (promo + cashback)
  { ean: '3045320094084', name: 'Nutella Pâte à tartiner',       brand: 'Ferrero',      segment: 'national', unit_label: '825g',      category_slug: 'epicerie-sucree',   bio_alt_ean: '3760020507357', is_top350: true  },
  { ean: '7613036018838', name: 'Nescafé Dolce Gusto Lungo',     brand: 'Nescafé',      segment: 'national', unit_label: 'x16',       category_slug: 'cafe-the',          is_top350: true  },
  { ean: '3017620425035', name: 'Activia Yaourt Nature x8',      brand: 'Danone',       segment: 'national', unit_label: 'x8×125g',   category_slug: 'laitiers',          bio_alt_ean: '3270190130025', is_top350: true  },
  { ean: '5000112637441', name: 'Coca-Cola Original',            brand: 'Coca-Cola',    segment: 'national', unit_label: '1,5L',      category_slug: 'boissons',          is_top350: true  },
  { ean: '3229820129488', name: 'Ariel Liquide 27 lavages',      brand: 'Ariel',        segment: 'national', unit_label: '1,98L',     category_slug: 'entretien',         is_top350: true  },
  { ean: '8000500310427', name: 'Barilla Spaghetti n°5',         brand: 'Barilla',      segment: 'national', unit_label: '500g',      category_slug: 'epicerie-salee',    bio_alt_ean: '3250391694073', is_top350: true  },
  { ean: '4056489059356', name: 'Milka Amandes Caramel',         brand: 'Milka',        segment: 'national', unit_label: '100g',      category_slug: 'confiserie',        is_top350: false },
  { ean: '3086126100079', name: 'Pampers Baby-Dry T4 x44',       brand: 'Pampers',      segment: 'national', unit_label: 'x44',       category_slug: 'bebe',              is_top350: true  },

  // Nationales — promo catalogue seule (pas de cashback)
  { ean: '3228857000166', name: 'Elle & Vire Beurre Doux',       brand: 'Elle & Vire',  segment: 'national', unit_label: '250g',      category_slug: 'laitiers',          is_top350: true  },
  { ean: '3029330003533', name: 'Président Crème Fraîche',       brand: 'Président',    segment: 'national', unit_label: '20cl',      category_slug: 'laitiers',          is_top350: true  },

  // Nationales — cashback seul (pas de promo catalogue)
  { ean: '3574661680568', name: 'Head & Shoulders Antipelliculaire', brand: 'H&S',      segment: 'national', unit_label: '400ml',     category_slug: 'hygiene',           is_top350: true  },

  // MDD — pas de promo, pas de cashback (segment Standard)
  { ean: '3245413410021', name: 'Pâtes Spaghetti',               brand: 'Marque Repère', segment: 'repere',  unit_label: '500g',      category_slug: 'epicerie-salee',    is_top350: true  },
  { ean: '3245680010120', name: 'Lait Demi-Écrémé UHT',          brand: 'Marque Repère', segment: 'repere',  unit_label: '6×1L',      category_slug: 'laitiers',          is_top350: true  },
  { ean: '3250390012234', name: 'Farine de Blé T45',             brand: 'Carrefour',    segment: 'mdd',      unit_label: '1kg',       category_slug: 'epicerie-salee',    is_top350: true  },
  { ean: '3250390034560', name: 'Riz Long Grain',                brand: 'Carrefour',    segment: 'mdd',      unit_label: '1kg',       category_slug: 'epicerie-salee',    is_top350: true  },
  { ean: '3445670019823', name: 'Huile de Tournesol',            brand: 'Leclerc',      segment: 'mdd',      unit_label: '1L',        category_slug: 'epicerie-salee',    is_top350: true  },

  // Bio — alternatives et standalone
  { ean: '3760020507357', name: 'Pâte à tartiner Bio Noisettes', brand: 'Bio Village',  segment: 'bio',      unit_label: '750g',      category_slug: 'epicerie-sucree',   is_top350: false },
  { ean: '3270190130025', name: 'Yaourt Nature Bio x4',          brand: 'Bio Village',  segment: 'bio',      unit_label: 'x4×125g',   category_slug: 'laitiers',          is_top350: false },
  { ean: '3250391694073', name: 'Pâtes Complètes Bio Spaghetti', brand: 'Bio Village',  segment: 'bio',      unit_label: '500g',      category_slug: 'epicerie-salee',    is_top350: false },
  { ean: '3760148681234', name: 'Huile d\'Olive Vierge Extra Bio', brand: 'Jardin Bio', segment: 'bio',      unit_label: '500ml',     category_slug: 'epicerie-salee',    is_top350: false },
];

// --- Prix de base par enseigne ---

export const STORE_PRICES: StorePrice[] = [
  // Nutella
  { ean: '3045320094084', store_id: 1, base_price: 5.99, in_stock: true  },
  { ean: '3045320094084', store_id: 2, base_price: 6.19, in_stock: true  },
  { ean: '3045320094084', store_id: 3, base_price: 5.89, in_stock: true  },
  // Nescafé
  { ean: '7613036018838', store_id: 1, base_price: 8.49, in_stock: true  },
  { ean: '7613036018838', store_id: 2, base_price: 8.99, in_stock: true  },
  { ean: '7613036018838', store_id: 3, base_price: 8.29, in_stock: false },
  // Activia
  { ean: '3017620425035', store_id: 1, base_price: 2.99, in_stock: true  },
  { ean: '3017620425035', store_id: 2, base_price: 3.29, in_stock: true  },
  { ean: '3017620425035', store_id: 3, base_price: 3.19, in_stock: true  },
  // Coca-Cola
  { ean: '5000112637441', store_id: 1, base_price: 1.99, in_stock: true  },
  { ean: '5000112637441', store_id: 2, base_price: 2.09, in_stock: true  },
  { ean: '5000112637441', store_id: 3, base_price: 2.19, in_stock: true  },
  // Ariel
  { ean: '3229820129488', store_id: 1, base_price: 12.99, in_stock: true },
  { ean: '3229820129488', store_id: 2, base_price: 13.49, in_stock: true },
  { ean: '3229820129488', store_id: 3, base_price: 12.49, in_stock: false },
  // Barilla
  { ean: '8000500310427', store_id: 1, base_price: 1.69, in_stock: true  },
  { ean: '8000500310427', store_id: 2, base_price: 1.89, in_stock: true  },
  { ean: '8000500310427', store_id: 3, base_price: 1.79, in_stock: true  },
  // Milka
  { ean: '4056489059356', store_id: 1, base_price: 1.89, in_stock: true  },
  { ean: '4056489059356', store_id: 2, base_price: 2.09, in_stock: true  },
  { ean: '4056489059356', store_id: 3, base_price: 1.99, in_stock: true  },
  // Pampers
  { ean: '3086126100079', store_id: 1, base_price: 15.99, in_stock: true },
  { ean: '3086126100079', store_id: 2, base_price: 16.99, in_stock: true },
  { ean: '3086126100079', store_id: 3, base_price: 16.49, in_stock: true },
  // Beurre Elle & Vire
  { ean: '3228857000166', store_id: 1, base_price: 3.49, in_stock: true  },
  { ean: '3228857000166', store_id: 2, base_price: 3.59, in_stock: true  },
  { ean: '3228857000166', store_id: 3, base_price: 3.39, in_stock: true  },
  // Crème Président
  { ean: '3029330003533', store_id: 1, base_price: 1.79, in_stock: true  },
  { ean: '3029330003533', store_id: 2, base_price: 1.89, in_stock: true  },
  { ean: '3029330003533', store_id: 3, base_price: 1.95, in_stock: true  },
  // Head & Shoulders
  { ean: '3574661680568', store_id: 1, base_price: 5.49, in_stock: true  },
  { ean: '3574661680568', store_id: 2, base_price: 5.99, in_stock: true  },
  { ean: '3574661680568', store_id: 3, base_price: 5.29, in_stock: true  },
  // MDD Pâtes Repère
  { ean: '3245413410021', store_id: 1, base_price: 0.89, in_stock: true  },
  { ean: '3245413410021', store_id: 2, base_price: 0.85, in_stock: true  },
  { ean: '3245413410021', store_id: 3, base_price: 0.92, in_stock: true  },
  // Lait Repère
  { ean: '3245680010120', store_id: 1, base_price: 5.49, in_stock: true  },
  { ean: '3245680010120', store_id: 2, base_price: 5.39, in_stock: true  },
  { ean: '3245680010120', store_id: 3, base_price: 5.59, in_stock: true  },
  // Farine MDD
  { ean: '3250390012234', store_id: 1, base_price: 0.99, in_stock: true  },
  { ean: '3250390012234', store_id: 2, base_price: 0.95, in_stock: true  },
  { ean: '3250390012234', store_id: 3, base_price: 1.05, in_stock: false },
  // Riz MDD
  { ean: '3250390034560', store_id: 1, base_price: 1.29, in_stock: true  },
  { ean: '3250390034560', store_id: 2, base_price: 1.19, in_stock: true  },
  { ean: '3250390034560', store_id: 3, base_price: 1.35, in_stock: true  },
  // Huile tournesol MDD
  { ean: '3445670019823', store_id: 1, base_price: 1.99, in_stock: true  },
  { ean: '3445670019823', store_id: 2, base_price: 2.09, in_stock: true  },
  { ean: '3445670019823', store_id: 3, base_price: 2.19, in_stock: true  },
  // Bio alternatives
  { ean: '3760020507357', store_id: 1, base_price: 4.49, in_stock: true  },
  { ean: '3760020507357', store_id: 2, base_price: 4.69, in_stock: false },
  { ean: '3760020507357', store_id: 3, base_price: 4.59, in_stock: true  },
  { ean: '3270190130025', store_id: 1, base_price: 2.29, in_stock: true  },
  { ean: '3270190130025', store_id: 2, base_price: 2.39, in_stock: true  },
  { ean: '3270190130025', store_id: 3, base_price: 2.49, in_stock: true  },
  { ean: '3250391694073', store_id: 1, base_price: 1.79, in_stock: true  },
  { ean: '3250391694073', store_id: 2, base_price: 1.89, in_stock: true  },
  { ean: '3250391694073', store_id: 3, base_price: 1.99, in_stock: false },
  { ean: '3760148681234', store_id: 1, base_price: 5.99, in_stock: true  },
  { ean: '3760148681234', store_id: 2, base_price: 6.19, in_stock: true  },
  { ean: '3760148681234', store_id: 3, base_price: 5.89, in_stock: true  },
];

// --- Promotions catalogue (valides aujourd'hui) ---

export const CATALOGUE_PROMOS: CataloguePromo[] = [
  // Nationales CUMUL MAX
  { id: 101, ean: '3045320094084', store_id: 1, promo_label: '-34% immédiat',  promo_price: 3.95, valid_until: '2026-04-27' },
  { id: 102, ean: '3045320094084', store_id: 3, promo_label: '-20%',           promo_price: 4.71, valid_until: '2026-04-27' },
  { id: 103, ean: '7613036018838', store_id: 1, promo_label: '-40% immédiat',  promo_price: 5.09, valid_until: '2026-04-30' },
  { id: 104, ean: '7613036018838', store_id: 2, promo_label: '-30%',           promo_price: 6.29, valid_until: '2026-04-30' },
  { id: 105, ean: '3017620425035', store_id: 3, promo_label: '-30%',           promo_price: 2.23, valid_until: '2026-04-28' },
  { id: 106, ean: '3017620425035', store_id: 2, promo_label: '-25%',           promo_price: 2.47, valid_until: '2026-04-28' },
  { id: 107, ean: '5000112637441', store_id: 2, promo_label: '-40%',           promo_price: 1.26, valid_until: '2026-05-04' },
  { id: 108, ean: '5000112637441', store_id: 1, promo_label: '-20%',           promo_price: 1.59, valid_until: '2026-05-04' },
  { id: 109, ean: '3229820129488', store_id: 1, promo_label: '-40% immédiat',  promo_price: 7.79, valid_until: '2026-05-05' },
  { id: 110, ean: '3229820129488', store_id: 2, promo_label: '-30%',           promo_price: 9.44, valid_until: '2026-05-05' },
  { id: 111, ean: '8000500310427', store_id: 3, promo_label: '-40%',           promo_price: 1.07, valid_until: '2026-05-11' },
  { id: 112, ean: '8000500310427', store_id: 1, promo_label: '-20%',           promo_price: 1.35, valid_until: '2026-05-11' },
  { id: 113, ean: '4056489059356', store_id: 3, promo_label: '-40%',           promo_price: 1.19, valid_until: '2026-05-04' },
  { id: 114, ean: '3086126100079', store_id: 2, promo_label: '-30%',           promo_price: 11.89, valid_until: '2026-05-18' },
  // Nationales promo seule
  { id: 115, ean: '3228857000166', store_id: 1, promo_label: '-30%',           promo_price: 2.44, valid_until: '2026-04-27' },
  { id: 116, ean: '3228857000166', store_id: 3, promo_label: '-20%',           promo_price: 2.71, valid_until: '2026-04-27' },
  { id: 117, ean: '3029330003533', store_id: 2, promo_label: '-30%',           promo_price: 1.32, valid_until: '2026-05-04' },
  // Bio promos
  { id: 118, ean: '3760020507357', store_id: 1, promo_label: '-20%',           promo_price: 3.59, valid_until: '2026-04-30' },
  { id: 119, ean: '3270190130025', store_id: 3, promo_label: '-25%',           promo_price: 1.87, valid_until: '2026-04-30' },
];

// --- Offres de remboursement (cashback ODR) ---

export const CASHBACK_OFFERS: CashbackOffer[] = [
  { id: 1, ean: '3045320094084', partner: 'shopmium',       cashback_amount: 2.00, store_ids: null,   deeplink_ios: 'shopmium://offer/nutella-825g',     deeplink_android: 'shopmium://offer/nutella-825g',     valid_until: '2026-05-15' },
  { id: 2, ean: '7613036018838', partner: 'coupon_network', cashback_amount: 3.00, store_ids: [1, 2], deeplink_ios: 'cn://offer/nescafe-lungo',          deeplink_android: 'cn://offer/nescafe-lungo',          valid_until: '2026-06-01' },
  { id: 3, ean: '3017620425035', partner: 'poulpeo',        cashback_amount: 1.50, store_ids: null,   deeplink_ios: 'poulpeo://offer/activia-nature',   deeplink_android: 'poulpeo://offer/activia-nature',   valid_until: '2026-04-30' },
  { id: 4, ean: '5000112637441', partner: 'shopmium',       cashback_amount: 0.80, store_ids: [2],    deeplink_ios: 'shopmium://offer/coca-cola-1-5l',  deeplink_android: 'shopmium://offer/coca-cola-1-5l',  valid_until: '2026-05-20' },
  { id: 5, ean: '3229820129488', partner: 'coupon_network', cashback_amount: 4.00, store_ids: [1, 2], deeplink_ios: 'cn://offer/ariel-27-lavages',      deeplink_android: 'cn://offer/ariel-27-lavages',      valid_until: '2026-06-15' },
  { id: 6, ean: '8000500310427', partner: 'shopmium',       cashback_amount: 0.80, store_ids: null,   deeplink_ios: 'shopmium://offer/barilla-spag',    deeplink_android: 'shopmium://offer/barilla-spag',    valid_until: '2026-05-10' },
  { id: 7, ean: '4056489059356', partner: 'shopmium',       cashback_amount: 0.80, store_ids: null,   deeplink_ios: 'shopmium://offer/milka-amandes',   deeplink_android: 'shopmium://offer/milka-amandes',   valid_until: '2026-05-05' },
  { id: 8, ean: '3086126100079', partner: 'coupon_network', cashback_amount: 5.00, store_ids: [2],    deeplink_ios: 'cn://offer/pampers-t4-44',         deeplink_android: 'cn://offer/pampers-t4-44',         valid_until: '2026-05-31' },
  // Cashback seul (sans promo catalogue)
  { id: 9, ean: '3574661680568', partner: 'shopmium',       cashback_amount: 2.00, store_ids: null,   deeplink_ios: 'shopmium://offer/head-shoulders',  deeplink_android: 'shopmium://offer/head-shoulders',  valid_until: '2026-06-30' },
];
