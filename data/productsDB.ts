// ============================================================
// SmartHunt — Base de données produits simulée
// ~340 groupes produits × ~3 variantes = ~1 000 références EAN
// Structure : groupe générique (ex: Spaghetti 500g)
//             → variantes MDD / Leader / Bio avec prix par enseigne
// ============================================================

export type SegmentType = 'mdd' | 'leader' | 'bio';
export type StoreId = 'leclerc' | 'superu' | 'carrefour' | 'intermarche' | 'auchan' | 'monoprix' | 'lidl' | 'aldi';

// Partial: some stores (Lidl/Aldi) don't carry all product segments
export type StorePrice = Partial<Record<StoreId, number>>;

export interface StoreInfo {
  id: StoreId;
  label: string;
  shortLabel: string;
  emoji: string;
  color: string;
  has_drive: boolean;
  coords: { lat: number; lng: number };  // mock Paris-area coordinates
}

export const STORES_CONFIG: Record<StoreId, StoreInfo> = {
  leclerc:     { id: 'leclerc',     label: 'E.Leclerc',   shortLabel: 'Leclerc',   emoji: '🔵', color: '#0055A5', has_drive: true,  coords: { lat: 48.830, lng: 2.265 } },
  superu:      { id: 'superu',      label: 'Super U',     shortLabel: 'Super U',   emoji: '🟢', color: '#00853F', has_drive: true,  coords: { lat: 48.847, lng: 2.439 } },
  carrefour:   { id: 'carrefour',   label: 'Carrefour',   shortLabel: 'Carrefour', emoji: '🔴', color: '#E31E24', has_drive: true,  coords: { lat: 48.815, lng: 2.318 } },
  intermarche: { id: 'intermarche', label: 'Intermarché', shortLabel: 'Intermar.', emoji: '🟡', color: '#F6B300', has_drive: true,  coords: { lat: 48.865, lng: 2.380 } },
  auchan:      { id: 'auchan',      label: 'Auchan',      shortLabel: 'Auchan',    emoji: '🟠', color: '#E87B20', has_drive: true,  coords: { lat: 48.910, lng: 2.440 } },
  monoprix:    { id: 'monoprix',    label: 'Monoprix',    shortLabel: 'Monoprix',  emoji: '⚫', color: '#444444', has_drive: false, coords: { lat: 48.876, lng: 2.335 } },
  lidl:        { id: 'lidl',        label: 'Lidl',        shortLabel: 'Lidl',      emoji: '🔷', color: '#0050AA', has_drive: false, coords: { lat: 48.826, lng: 2.366 } },
  aldi:        { id: 'aldi',        label: 'Aldi',        shortLabel: 'Aldi',      emoji: '🔹', color: '#1E56A0', has_drive: false, coords: { lat: 48.807, lng: 2.384 } },
};

export const ALL_STORE_IDS: StoreId[] = [
  'leclerc', 'superu', 'carrefour', 'intermarche', 'auchan', 'monoprix', 'lidl', 'aldi',
];

export interface CataloguePromo {
  type: 'percent' | 'immediate' | 'volume';
  value: number;        // 0.34 = 34% | 1.50€ | 0.70 = "2ème à -70%"
  store: StoreId | 'all';
  label: string;
  minQty?: number;      // volume only — unité déclenchante (défaut 2)
}

export interface CashbackOffer {
  app: 'shopmium' | 'quoty' | 'coupon_network';
  amount: number;
  label: string;
}

export interface ProductVariant {
  ean: string;
  type: SegmentType;
  brand: string;
  basePrice: number;
  prices: StorePrice;
  price_per_unit: number;   // €/kg or €/L — basePrice / unit_size
  unit_ref: 'kg' | 'L' | 'unit';
  catalogue_promo?: CataloguePromo;
  cashback_app?: CashbackOffer;
  last_verified: number;  // timestamp ms
  // undefined = en stock partout ; false = rupture dans l'enseigne donnée
  in_stock?: Partial<Record<StoreId, boolean>>;
}

export interface ProductGroup {
  groupId: string;
  genericName: string;
  emoji: string;
  /** URL d'image produit (serveurs Drive / CDN) — optionnelle, fallback sur emoji */
  imageUrl?: string;
  categorySlug: string;
  subcategorySlug: string;
  equivalence_key: string;  // 'SPAGHETTI_500G' — derived from groupId
  unit_size: number;         // e.g. 0.5 for 500g, 1 for 1L
  unit_type: 'kg' | 'L' | 'unit';
  variants: Partial<Record<SegmentType, ProductVariant>>;
}

export interface CategoryMeta {
  slug: string;
  label: string;
  emoji: string;
  color: string;
}

export interface SubcategoryMeta {
  slug: string;
  categorySlug: string;
  label: string;
  emoji: string;
}

// ─── Métadonnées catégories ─────────────────────────────────

export const CATEGORY_META: CategoryMeta[] = [
  { slug: 'epicerie',       label: 'Épicerie',          emoji: '🛒', color: '#FF6B35' },
  { slug: 'epicerie-sucree',label: 'Épicerie Sucrée',   emoji: '🍪', color: '#F59E0B' },
  { slug: 'frais',          label: 'Frais',              emoji: '🥛', color: '#00B4FF' },
  { slug: 'boissons',       label: 'Boissons',           emoji: '🥤', color: '#06B6D4' },
  { slug: 'hygiene',        label: 'Hygiène',            emoji: '🧴', color: '#A855F7' },
  { slug: 'bebe',           label: 'Bébé',               emoji: '👶', color: '#F59E0B' },
  { slug: 'entretien',      label: 'Entretien',          emoji: '🧺', color: '#8B5CF6' },
  { slug: 'surgeles',       label: 'Surgelés',           emoji: '❄️',  color: '#3B82F6' },
  { slug: 'animalerie',     label: 'Animalerie',         emoji: '🐾', color: '#10B981' },
];

export const SUBCATEGORY_META: SubcategoryMeta[] = [
  // Épicerie
  { slug: 'pates-riz',           categorySlug: 'epicerie',        label: 'Pâtes & Riz',             emoji: '🍝' },
  { slug: 'farines',             categorySlug: 'epicerie',        label: 'Farines & Levures',        emoji: '🌾' },
  { slug: 'conserves-legumes',   categorySlug: 'epicerie',        label: 'Conserves Légumes',        emoji: '🥫' },
  { slug: 'conserves-poissons',  categorySlug: 'epicerie',        label: 'Conserves Poissons',       emoji: '🐟' },
  { slug: 'sauces-condiments',   categorySlug: 'epicerie',        label: 'Sauces & Condiments',      emoji: '🫙' },
  { slug: 'huiles-vinaigres',    categorySlug: 'epicerie',        label: 'Huiles & Vinaigres',       emoji: '🫒' },
  { slug: 'cafe-the',            categorySlug: 'epicerie',        label: 'Café & Thé',               emoji: '☕' },
  { slug: 'sucre-miel',          categorySlug: 'epicerie',        label: 'Sucre & Miel',             emoji: '🍯' },
  { slug: 'sel-epices',          categorySlug: 'epicerie',        label: 'Sel & Épices',             emoji: '🧂' },
  { slug: 'soupes',              categorySlug: 'epicerie',        label: 'Soupes & Bouillons',       emoji: '🍜' },
  { slug: 'aperitif',            categorySlug: 'epicerie',        label: 'Apéritif & Snacks',        emoji: '🧀' },
  // Épicerie Sucrée
  { slug: 'biscuits',            categorySlug: 'epicerie-sucree', label: 'Biscuits',                 emoji: '🍪' },
  { slug: 'chocolat',            categorySlug: 'epicerie-sucree', label: 'Chocolat',                 emoji: '🍫' },
  { slug: 'confitures',          categorySlug: 'epicerie-sucree', label: 'Confitures & Pâtes',       emoji: '🍓' },
  { slug: 'cereales',            categorySlug: 'epicerie-sucree', label: 'Céréales Petit-Déj',       emoji: '🥣' },
  { slug: 'desserts',            categorySlug: 'epicerie-sucree', label: 'Desserts & Entremets',     emoji: '🍮' },
  // Frais
  { slug: 'lait-creme',          categorySlug: 'frais',           label: 'Lait & Crème',             emoji: '🥛' },
  { slug: 'yaourts',             categorySlug: 'frais',           label: 'Yaourts & Fromage Blanc',  emoji: '🫙' },
  { slug: 'fromages',            categorySlug: 'frais',           label: 'Fromages',                 emoji: '🧀' },
  { slug: 'beurre',              categorySlug: 'frais',           label: 'Beurre & Margarine',       emoji: '🧈' },
  { slug: 'charcuterie',         categorySlug: 'frais',           label: 'Charcuterie',              emoji: '🥩' },
  { slug: 'viande',              categorySlug: 'frais',           label: 'Viandes',                  emoji: '🥩' },
  { slug: 'volaille',            categorySlug: 'frais',           label: 'Volailles',                emoji: '🍗' },
  { slug: 'poisson',             categorySlug: 'frais',           label: 'Poisson & Fruits de Mer',  emoji: '🐟' },
  { slug: 'oeufs',               categorySlug: 'frais',           label: 'Œufs',                     emoji: '🥚' },
  // Boissons
  { slug: 'eaux',                categorySlug: 'boissons',        label: 'Eaux',                     emoji: '💧' },
  { slug: 'sodas',               categorySlug: 'boissons',        label: 'Sodas',                    emoji: '🥤' },
  { slug: 'jus',                 categorySlug: 'boissons',        label: 'Jus & Nectars',            emoji: '🍊' },
  { slug: 'bieres',              categorySlug: 'boissons',        label: 'Bières & Cidres',          emoji: '🍺' },
  { slug: 'vins',                categorySlug: 'boissons',        label: 'Vins',                     emoji: '🍷' },
  // Hygiène
  { slug: 'soins-capillaires',   categorySlug: 'hygiene',         label: 'Soins Capillaires',        emoji: '💆' },
  { slug: 'soins-corps',         categorySlug: 'hygiene',         label: 'Soins Corps',              emoji: '🚿' },
  { slug: 'soins-visage',        categorySlug: 'hygiene',         label: 'Soins Visage',             emoji: '🧴' },
  { slug: 'dentaire',            categorySlug: 'hygiene',         label: 'Bucco-Dentaire',           emoji: '🦷' },
  { slug: 'rasage',              categorySlug: 'hygiene',         label: 'Rasage',                   emoji: '🪒' },
  { slug: 'protection-feminine', categorySlug: 'hygiene',         label: 'Protection Féminine',      emoji: '🌸' },
  // Bébé
  { slug: 'couches',             categorySlug: 'bebe',            label: 'Couches & Culottes',       emoji: '🍼' },
  { slug: 'lingettes',           categorySlug: 'bebe',            label: 'Lingettes',                emoji: '🧻' },
  { slug: 'alim-bebe',           categorySlug: 'bebe',            label: 'Alimentation Bébé',        emoji: '🥄' },
  { slug: 'soins-bebe',          categorySlug: 'bebe',            label: 'Soins Bébé',               emoji: '🧴' },
  // Entretien
  { slug: 'lessive',             categorySlug: 'entretien',       label: 'Lessive',                  emoji: '🧺' },
  { slug: 'vaisselle',           categorySlug: 'entretien',       label: 'Vaisselle',                emoji: '🫧' },
  { slug: 'menager',             categorySlug: 'entretien',       label: 'Nettoyants Ménagers',      emoji: '🧹' },
  { slug: 'papier-menage',       categorySlug: 'entretien',       label: 'Papier & Emballages',      emoji: '🧻' },
  // Surgelés
  { slug: 'legumes-surgeles',    categorySlug: 'surgeles',        label: 'Légumes Surgelés',         emoji: '🥦' },
  { slug: 'poisson-surgele',     categorySlug: 'surgeles',        label: 'Poisson Surgelé',          emoji: '🐟' },
  { slug: 'plats-prepares',      categorySlug: 'surgeles',        label: 'Plats Préparés',           emoji: '🍽️' },
  { slug: 'pizzas',              categorySlug: 'surgeles',        label: 'Pizzas',                   emoji: '🍕' },
  { slug: 'glaces',              categorySlug: 'surgeles',        label: 'Glaces & Sorbets',         emoji: '🍦' },
  // Animalerie
  { slug: 'chiens',              categorySlug: 'animalerie',      label: 'Chiens',                   emoji: '🐕' },
  { slug: 'chats',               categorySlug: 'animalerie',      label: 'Chats',                    emoji: '🐈' },
];

// ─── Générateur EAN 13 ─────────────────────────────────────

function ean13(prefix: string, n: number): string {
  const body = (prefix + String(n).padStart(13 - prefix.length - 1, '0')).slice(0, 12);
  const digits = body.split('').map(Number);
  const sum = digits.reduce((s, d, i) => s + d * (i % 2 === 0 ? 1 : 3), 0);
  const check = (10 - (sum % 10)) % 10;
  return body + check;
}

// ─── Prix par enseigne (variation déterministe) ─────────────

function storePrices(base: number, seed: number, type: SegmentType): StorePrice {
  const r = (mult: number, off: number) =>
    Math.round(base * (1 + ((mult * 17 + seed * 7 + off) % 13 - 6) / 100) * 100) / 100;

  const leclerc     = r(1, 0);
  const carrefour   = r(2, 0);
  const intermarche = r(3, 0);

  // Super U : entre Leclerc & Carrefour, marque "U" agressive sur MDD (-3 à -5%)
  const suMid  = (leclerc + carrefour) / 2;
  const suDisc = type === 'mdd' ? (3 + (seed * 3) % 3) / 100 : 0;
  const superu = Math.round(suMid * (1 - suDisc) * 100) / 100;

  // Auchan : similaire Carrefour ±1%
  const auchan = Math.round(carrefour * (1 + ((seed * 2 + 1) % 5 - 2) / 100) * 100) / 100;

  // Monoprix : premium +12-25%, meilleur sur le Bio (+6%)
  const monoPremium = type === 'bio' ? 1.06 : 1.14 + (seed % 12) / 100;
  const monoprix = Math.round(leclerc * monoPremium * 100) / 100;

  if (type === 'mdd') {
    // Lidl/Aldi EDLP : -15 à -22% vs Leclerc, disponibles partout
    const lidl = Math.round(leclerc * (0.82 + ((seed * 2) % 5) / 100) * 100) / 100;
    const aldi = Math.round(leclerc * (0.78 + ((seed * 3) % 5) / 100) * 100) / 100;
    return { leclerc, superu, carrefour, intermarche, auchan, monoprix, lidl, aldi };
  }

  if (type === 'leader') {
    // Lidl : ~25% des marques nationales seulement (toutes les 4 références)
    const lidl = seed % 4 === 0 ? Math.round(leclerc * 0.94 * 100) / 100 : undefined;
    // Aldi : très rare (~10%)
    const aldi = seed % 10 === 0 ? Math.round(leclerc * 0.91 * 100) / 100 : undefined;
    return {
      leclerc, superu, carrefour, intermarche, auchan, monoprix,
      ...(lidl !== undefined ? { lidl } : {}),
      ...(aldi !== undefined ? { aldi } : {}),
    };
  }

  // bio : Lidl/Aldi quasi-absents (1 sur 20 références)
  const lidlBio = seed % 20 === 0 ? Math.round(monoprix * 0.88 * 100) / 100 : undefined;
  return {
    leclerc, superu, carrefour, intermarche, auchan, monoprix,
    ...(lidlBio !== undefined ? { lidl: lidlBio } : {}),
  };
}

// ─── Templates compacts ──────────────────────────────────────
// Format : [id, name, emoji, cat, sub, mddBrand, mddPrice, leaderBrand, leaderPrice, bioBrand, bioPrice]
// null = variante inexistante

type T = [string, string, string, string, string,
          string | null, number | null,   // MDD
          string | null, number | null,   // Leader
          string | null, number | null];  // Bio

/* eslint-disable no-multi-spaces */
const TEMPLATES: T[] = [
  // ──────────────────────────────────────────────────────────
  // ÉPICERIE — Pâtes & Riz
  // ──────────────────────────────────────────────────────────
  ['spaghetti-500g',        'Spaghetti 500g',              '🍝','epicerie','pates-riz',          'Repère',0.75, 'Barilla',1.89,       'Bio Village',1.45],
  ['penne-500g',            'Penne Rigate 500g',           '🍝','epicerie','pates-riz',          'Repère',0.79, 'Panzani',1.79,       'Priméal',1.59],
  ['fusilli-500g',          'Fusilli 500g',                '🍝','epicerie','pates-riz',          'Repère',0.75, 'Barilla',1.79,       'Bio Village',1.49],
  ['rigatoni-500g',         'Rigatoni 500g',               '🍝','epicerie','pates-riz',          'Repère',0.79, 'Panzani',1.85,       null,null],
  ['tagliatelles-250g',     'Tagliatelles Fraîches 250g',  '🍝','epicerie','pates-riz',          'Repère',1.05, 'Giovanni Rana',2.99, 'Priméal',2.45],
  ['macaroni-500g',         'Macaroni 500g',               '🍝','epicerie','pates-riz',          'Repère',0.75, 'Lustucru',1.65,      null,null],
  ['lasagnes-seches-250g',  'Feuilles Lasagnes 250g',      '🍝','epicerie','pates-riz',          'Repère',0.99, 'Panzani',2.49,       null,null],
  ['riz-basmati-1kg',       'Riz Basmati 1kg',             '🍚','epicerie','pates-riz',          'Repère',1.89, 'Taureau Ailé',3.49,  'Priméal',3.99],
  ['riz-long-1kg',          'Riz Long Grain 1kg',          '🍚','epicerie','pates-riz',          'Repère',0.99, "Uncle Ben's",2.49,   null,null],
  ['riz-rond-1kg',          'Riz Rond 1kg',                '🍚','epicerie','pates-riz',          'Repère',0.89, 'Taureau Ailé',2.29,  'Priméal',2.89],
  ['vermicelles-500g',      'Vermicelles 500g',            '🍝','epicerie','pates-riz',          'Repère',0.69, 'Panzani',1.55,       null,null],
  ['couscous-500g',         'Couscous Moyen 500g',         '🫙','epicerie','pates-riz',          'Repère',0.89, 'Ferrero',1.99,       'Biocoop',2.29],

  // ──────────────────────────────────────────────────────────
  // ÉPICERIE — Farines & Levures
  // ──────────────────────────────────────────────────────────
  ['farine-t45-1kg',        'Farine T45 1kg',              '🌾','epicerie','farines',            'Repère',0.69, 'Francine',1.49,      'Priméal Bio',2.29],
  ['farine-t55-1kg',        'Farine T55 1kg',              '🌾','epicerie','farines',            'Repère',0.65, 'Francine',1.39,      'Priméal Bio',2.09],
  ['farine-complete-1kg',   'Farine Complète 1kg',         '🌾','epicerie','farines',            'Repère',0.89, 'Francine',1.59,      'Priméal Bio',2.19],
  ['maizena-400g',          'Maïzena 400g',                '🌽','epicerie','farines',            null,null,     'Maïzena',1.99,       null,null],
  ['levure-chimique',       'Levure Chimique ×8',          '🧁','epicerie','farines',            'Repère',0.45, 'Alsa',1.15,          null,null],
  ['farine-sarrasin-500g',  'Farine Sarrasin 500g',        '🌾','epicerie','farines',            'Repère',1.29, null,null,            'Priméal Bio',3.49],

  // ──────────────────────────────────────────────────────────
  // ÉPICERIE — Conserves Légumes
  // ──────────────────────────────────────────────────────────
  ['haricots-verts-400g',   'Haricots Verts 400g',         '🫘','epicerie','conserves-legumes',  'Repère',0.55, 'Bonduelle',1.19,     'Bio Village',1.45],
  ['petits-pois-400g',      'Petits Pois 400g',            '🫘','epicerie','conserves-legumes',  'Repère',0.55, 'Bonduelle',1.29,     'Jardin Bio',1.59],
  ['tomates-concassees-400g','Tomates Concassées 400g',    '🍅','epicerie','conserves-legumes',  'Repère',0.55, 'Mutti',1.49,         'Bio Village',1.29],
  ['mais-285g',             'Maïs Doux 285g',              '🌽','epicerie','conserves-legumes',  'Repère',0.59, 'Géant Vert',1.19,    'Jardin Bio',1.49],
  ['lentilles-400g',        'Lentilles Vertes 400g',       '🫘','epicerie','conserves-legumes',  'Repère',0.69, 'Cassegrain',1.39,    'Bio Village',1.59],
  ['pois-chiches-400g',     'Pois Chiches 400g',           '🫘','epicerie','conserves-legumes',  'Repère',0.65, 'Cassegrain',1.35,    'Jardin Bio',1.55],
  ['flageolets-400g',       'Flageolets 400g',             '🫘','epicerie','conserves-legumes',  'Repère',0.65, 'Cassegrain',1.29,    null,null],
  ['champignons-400g',      'Champignons 400g',            '🍄','epicerie','conserves-legumes',  'Repère',0.79, 'Bonduelle',1.49,     'Jardin Bio',1.89],

  // ──────────────────────────────────────────────────────────
  // ÉPICERIE — Conserves Poissons
  // ──────────────────────────────────────────────────────────
  ['thon-naturel-160g',     'Thon au Naturel 160g',        '🐟','epicerie','conserves-poissons', 'Repère',1.19, 'Saupiquet',2.29,     'Petit Navire Bio',2.99],
  ['thon-huile-160g',       "Thon à l'Huile 160g",         '🐟','epicerie','conserves-poissons', 'Repère',1.29, 'Petit Navire',2.49,  null,null],
  ['sardines-135g',         'Sardines 135g',               '🐟','epicerie','conserves-poissons', 'Repère',0.99, 'La Belle-Iloise',2.99,null,null],
  ['maquereaux-140g',       'Maquereaux Vin Blanc 140g',   '🐟','epicerie','conserves-poissons', 'Repère',1.09, 'Connétable',2.19,    null,null],
  ['anchois-50g',           'Anchois 50g',                 '🐟','epicerie','conserves-poissons', null,null,     'Phare du Cap Bon',2.49,null,null],

  // ──────────────────────────────────────────────────────────
  // ÉPICERIE — Sauces & Condiments
  // ──────────────────────────────────────────────────────────
  ['ketchup-560g',          'Ketchup 560g',                '🍅','epicerie','sauces-condiments',  'Repère',0.85, 'Heinz',2.59,         null,null],
  ['mayonnaise-470g',       'Mayonnaise 470g',             '🥚','epicerie','sauces-condiments',  'Repère',0.95, "Hellmann's",2.89,    null,null],
  ['moutarde-douce-370g',   'Moutarde Douce 370g',         '🫙','epicerie','sauces-condiments',  'Repère',0.79, 'Amora',2.19,         null,null],
  ['moutarde-ancienne-200g','Moutarde Ancienne 200g',      '🫙','epicerie','sauces-condiments',  'Repère',1.09, 'Maille',2.99,        null,null],
  ['sauce-tomate-400g',     'Sauce Tomate Basilic 400g',   '🍅','epicerie','sauces-condiments',  'Repère',0.89, 'Panzani',1.99,       'Bio Village',2.19],
  ['sauce-bolognaise-400g', 'Sauce Bolognaise 400g',       '🍝','epicerie','sauces-condiments',  'Repère',1.19, 'Panzani',2.49,       null,null],
  ['vinaigrette-500ml',     'Vinaigrette 500ml',           '🫙','epicerie','sauces-condiments',  'Repère',0.99, 'Maille',2.79,        null,null],
  ['sauce-soja-150ml',      'Sauce Soja 150ml',            '🫙','epicerie','sauces-condiments',  null,null,     'Kikkoman',2.49,      null,null],

  // ──────────────────────────────────────────────────────────
  // ÉPICERIE — Huiles & Vinaigres
  // ──────────────────────────────────────────────────────────
  ['huile-tournesol-1l',    'Huile de Tournesol 1L',       '🌻','epicerie','huiles-vinaigres',   'Repère',1.25, 'Lesieur',2.49,       'Jardin Bio',3.99],
  ['huile-olive-500ml',     "Huile d'Olive V.E. 500ml",    '🫒','epicerie','huiles-vinaigres',   'Repère',2.99, 'Puget',5.99,         'Jardin Bio',6.99],
  ['huile-colza-1l',        'Huile de Colza 1L',           '🌿','epicerie','huiles-vinaigres',   'Repère',1.39, 'Lesieur',2.29,       'Jardin Bio',3.49],
  ['vinaigre-blanc-1l',     'Vinaigre Blanc 1L',           '🍶','epicerie','huiles-vinaigres',   'Repère',0.55, 'Maille',1.59,        null,null],
  ['vinaigre-balsamique',   'Vinaigre Balsamique 500ml',   '🍶','epicerie','huiles-vinaigres',   'Repère',1.49, null,null,            'Jardin Bio',3.99],

  // ──────────────────────────────────────────────────────────
  // ÉPICERIE — Café & Thé
  // ──────────────────────────────────────────────────────────
  ['cafe-moulu-250g',       'Café Moulu 250g',             '☕','epicerie','cafe-the',           'Repère',1.99, 'Lavazza',4.99,       'Legal Bio',5.49],
  ['cafe-capsules-x16',     'Capsules Café ×16',           '☕','epicerie','cafe-the',           'Repère',3.49, 'Nescafé DG',5.99,    null,null],
  ['cafe-soluble-200g',     'Café Soluble 200g',           '☕','epicerie','cafe-the',           'Repère',2.49, 'Nescafé Classic',5.49,null,null],
  ['the-noir-x25',          'Thé Noir ×25',                '🍵','epicerie','cafe-the',           'Repère',0.99, 'Lipton',2.49,        'Elephant Bio',3.29],
  ['the-vert-x25',          'Thé Vert ×25',               '🍵','epicerie','cafe-the',           'Repère',0.99, 'Lipton',2.49,        'Elephant Bio',3.29],
  ['infusions-x25',         'Infusions Camomille ×25',     '🌼','epicerie','cafe-the',           'Repère',0.89, 'Lipton',2.29,        'Elephant Bio',2.99],

  // ──────────────────────────────────────────────────────────
  // ÉPICERIE — Sucre & Miel
  // ──────────────────────────────────────────────────────────
  ['sucre-blanc-1kg',       'Sucre Blanc 1kg',             '🍬','epicerie','sucre-miel',         'Repère',0.89, 'Daddy',1.99,         null,null],
  ['sucre-roux-1kg',        'Sucre Roux 1kg',              '🍬','epicerie','sucre-miel',         'Repère',1.09, 'Daddy',2.29,         'Jardin Bio',2.99],
  ['miel-acacia-500g',      "Miel d'Acacia 500g",          '🍯','epicerie','sucre-miel',         'Repère',3.99, 'Lune de Miel',7.99,  'Famille Mary',11.99],
  ['miel-toutes-fleurs',    'Miel Toutes Fleurs 500g',     '🍯','epicerie','sucre-miel',         'Repère',3.29, 'Lune de Miel',6.49,  'Famille Mary',9.99],
  ['stevia-x250',           'Stevia ×250 tablettes',       '🌿','epicerie','sucre-miel',         null,null,     'Pure Via',4.99,      null,null],

  // ──────────────────────────────────────────────────────────
  // ÉPICERIE — Sel & Épices
  // ──────────────────────────────────────────────────────────
  ['sel-fin-1kg',           'Sel Fin 1kg',                 '🧂','epicerie','sel-epices',         'Repère',0.39, 'La Baleine',1.29,    null,null],
  ['sel-gros-1kg',          'Sel Gros 1kg',                '🧂','epicerie','sel-epices',         'Repère',0.45, 'Paludier',2.99,      null,null],
  ['poivre-noir-50g',       'Poivre Noir Moulu 50g',       '🌶️','epicerie','sel-epices',         'Repère',0.99, 'Ducros',2.99,        null,null],
  ['curry-50g',             'Curry en Poudre 50g',         '🌶️','epicerie','sel-epices',         'Repère',0.89, 'Ducros',2.49,        null,null],
  ['paprika-50g',           'Paprika 50g',                 '🌶️','epicerie','sel-epices',         'Repère',0.79, 'Ducros',2.29,        null,null],
  ['herbes-provence-25g',   'Herbes de Provence 25g',      '🌿','epicerie','sel-epices',         'Repère',0.59, 'Ducros',1.99,        'Jardin Bio',2.79],
  ['cube-bouillon-x8',      'Cube Bouillon ×8',            '🫙','epicerie','sel-epices',         'Repère',0.99, 'Maggi',2.29,         null,null],
  ['cannelle-40g',          'Cannelle en Poudre 40g',      '🌶️','epicerie','sel-epices',         'Repère',0.79, 'Ducros',2.29,        null,null],

  // ──────────────────────────────────────────────────────────
  // ÉPICERIE — Soupes & Bouillons
  // ──────────────────────────────────────────────────────────
  ['soupe-tomate-1l',       'Soupe Tomate 1L',             '🍅','epicerie','soupes',             'Repère',0.89, 'Knorr',2.49,         'Bio Village',2.89],
  ['veloute-courgette-1l',  'Velouté Courgette 1L',        '🥣','epicerie','soupes',             'Repère',0.99, 'Knorr',2.69,         'Bjorg',3.49],
  ['soupe-legumes-1l',      'Soupe Légumes 1L',            '🥦','epicerie','soupes',             'Repère',0.89, 'Liebig',2.49,        'Bio Village',2.79],
  ['veloute-champignons-1l','Velouté Champignons 1L',      '🍄','epicerie','soupes',             'Repère',0.99, 'Knorr',2.49,         null,null],
  ['soupe-oignon-1l',       'Soupe à l\'Oignon 1L',        '🧅','epicerie','soupes',             'Repère',0.89, 'Liebig',2.29,        null,null],
  ['bouillon-cube-x8',      'Bouillon Cube Poule ×8',      '🫙','epicerie','soupes',             'Repère',0.79, 'Maggi',2.19,         null,null],

  // ──────────────────────────────────────────────────────────
  // ÉPICERIE — Apéritif & Snacks
  // ──────────────────────────────────────────────────────────
  ['chips-nature-150g',     'Chips Nature 150g',           '🥔','epicerie','aperitif',           'Repère',0.99, "Lay's",2.29,         'Bjorg Bio',2.99],
  ['chips-saveur-150g',     'Chips Saveur BBQ 150g',       '🥔','epicerie','aperitif',           'Repère',0.99, "Lay's",2.29,         null,null],
  ['cacahuetes-200g',       'Cacahuètes Grillées 200g',    '🥜','epicerie','aperitif',           'Repère',1.29, 'Benenuts',2.49,      'Jardin Bio',2.99],
  ['olives-150g',           'Olives Vertes 150g',          '🫒','epicerie','aperitif',           'Repère',0.99, "Belle d'Olive",2.49, null,null],
  ['crackers-aperitif-100g','Crackers Apéritif 100g',      '🧀','epicerie','aperitif',           'Repère',0.79, 'TUC',2.19,           null,null],
  ['amandes-150g',          'Amandes Grillées 150g',       '🌰','epicerie','aperitif',           'Repère',1.49, 'Vahiné',2.99,        'Jardin Bio',3.49],
  ['pop-corn-100g',         'Pop-Corn Nature 100g',        '🍿','epicerie','aperitif',           'Repère',0.79, "Brets",1.79,         null,null],
  ['noix-melange-200g',     'Mélange de Noix 200g',        '🌰','epicerie','aperitif',           'Repère',2.49, 'Benenuts',4.49,      'Jardin Bio',4.99],

  // ──────────────────────────────────────────────────────────
  // ÉPICERIE SUCRÉE — Biscuits
  // ──────────────────────────────────────────────────────────
  ['petits-beurre-200g',    'Petits Beurre 200g',          '🍪','epicerie-sucree','biscuits',    'Repère',0.85, 'LU',2.29,            null,null],
  ['sables-chocolat-200g',  'Sablés Chocolat 200g',        '🍪','epicerie-sucree','biscuits',    'Repère',0.79, 'LU Prince',2.19,     null,null],
  ['galettes-bretonnes-400g','Galettes Bretonnes 400g',    '🍪','epicerie-sucree','biscuits',    'Repère',1.69, 'St-Michel',3.99,     null,null],
  ['cookies-pepites-200g',  'Cookies Pépites Choco 200g',  '🍪','epicerie-sucree','biscuits',    'Repère',0.99, 'Belvita',2.99,       null,null],
  ['boudoirs-400g',         'Boudoirs 400g',               '🍪','epicerie-sucree','biscuits',    'Repère',1.29, 'LU',2.79,            null,null],
  ['palets-bretagne-125g',  'Palets de Bretagne 125g',     '🍪','epicerie-sucree','biscuits',    'Repère',1.19, 'Traou Mad',3.49,     null,null],
  ['madeleines-x12',        'Madeleines ×12',              '🧁','epicerie-sucree','biscuits',    'Repère',1.19, 'St-Michel',2.89,     null,null],
  ['biscuit-chocolat-x12',  'Biscuits Fourrés Chocolat ×12','🍪','epicerie-sucree','biscuits',  'Repère',0.89, 'Prince',2.49,        null,null],

  // ──────────────────────────────────────────────────────────
  // ÉPICERIE SUCRÉE — Chocolat
  // ──────────────────────────────────────────────────────────
  ['tablette-noir-100g',    'Tablette Chocolat Noir 70% 100g','🍫','epicerie-sucree','chocolat', 'Repère',0.99, 'Lindt',2.49,         'Green & Black',3.99],
  ['tablette-lait-100g',    'Tablette Chocolat Lait 100g', '🍫','epicerie-sucree','chocolat',    'Repère',0.89, 'Milka',1.99,         null,null],
  ['tablette-blanc-100g',   'Tablette Chocolat Blanc 100g','🍫','epicerie-sucree','chocolat',    'Repère',0.89, 'Milka',1.99,         null,null],
  ['praline-200g',          'Praliné Noisettes 200g',      '🍫','epicerie-sucree','chocolat',    'Repère',1.49, 'Ferrero Rocher',3.99,'Bio Village',4.99],
  ['cacao-poudre-250g',     'Cacao en Poudre 250g',        '🍫','epicerie-sucree','chocolat',    'Repère',1.29, 'Van Houten',3.49,    null,null],

  // ──────────────────────────────────────────────────────────
  // ÉPICERIE SUCRÉE — Confitures & Pâtes
  // ──────────────────────────────────────────────────────────
  ['confiture-fraise-370g', 'Confiture Fraise 370g',       '🍓','epicerie-sucree','confitures',  'Repère',1.29, 'Bonne Maman',2.99,   'Jardin Bio',3.49],
  ['confiture-abricot-370g','Confiture Abricot 370g',      '🍑','epicerie-sucree','confitures',  'Repère',1.19, 'Bonne Maman',2.89,   'Jardin Bio',3.29],
  ['confiture-framboise',   'Confiture Framboise 370g',    '🍇','epicerie-sucree','confitures',  'Repère',1.39, 'Bonne Maman',2.99,   null,null],
  ['pate-tartiner-400g',    'Pâte à Tartiner 400g',        '🫙','epicerie-sucree','confitures',  'Repère',1.99, 'Nutella',3.99,       'Bio Village',4.49],
  ['miel-tartiner-250g',    'Miel à Tartiner 250g',        '🍯','epicerie-sucree','confitures',  'Repère',2.49, null,null,            'Jardin Bio',4.99],

  // ──────────────────────────────────────────────────────────
  // ÉPICERIE SUCRÉE — Céréales
  // ──────────────────────────────────────────────────────────
  ['muesli-500g',           'Muesli Classique 500g',       '🥣','epicerie-sucree','cereales',    'Repère',1.49, 'Jordans',3.99,       'Bio Village',3.79],
  ['granola-500g',          'Granola Miel & Amandes 500g', '🥣','epicerie-sucree','cereales',    'Repère',1.79, 'Granola',4.49,       'Bio Village',4.29],
  ['choco-pops-375g',       'Choco Pops 375g',             '🥣','epicerie-sucree','cereales',    'Repère',1.29, "Kellogg's",3.29,     null,null],
  ['cornflakes-375g',       'Cornflakes 375g',             '🥣','epicerie-sucree','cereales',    'Repère',0.99, "Kellogg's",2.99,     null,null],
  ['porridge-500g',         'Porridge Avoine 500g',        '🥣','epicerie-sucree','cereales',    'Repère',1.19, 'Quaker',2.79,        'Bio Village',3.49],
  ['muesli-fruits-500g',    'Muesli Fruits Rouges 500g',   '🥣','epicerie-sucree','cereales',    'Repère',1.59, 'Jordans',4.29,       'Bio Village',4.09],

  // ──────────────────────────────────────────────────────────
  // ÉPICERIE SUCRÉE — Desserts & Entremets
  // ──────────────────────────────────────────────────────────
  ['flan-caramel-x4',       'Flans Caramel ×4',            '🍮','epicerie-sucree','desserts',    'Repère',1.09, 'Flanby',2.29,        null,null],
  ['riz-au-lait-x4',        'Riz au Lait ×4',              '🍮','epicerie-sucree','desserts',    'Repère',1.29, 'La Laitière',2.89,   null,null],
  ['mousse-chocolat-x4',    'Mousse au Chocolat ×4',       '🍫','epicerie-sucree','desserts',    'Repère',1.09, 'Mont Blanc',2.49,    null,null],
  ['creme-brulee-x2',       'Crème Brûlée ×2',             '🍮','epicerie-sucree','desserts',    'Repère',1.49, 'La Laitière',3.49,   null,null],
  ['tiramisu-2p',           'Tiramisu 2 portions',         '🍮','epicerie-sucree','desserts',    'Repère',1.89, 'Galbani',3.99,       null,null],

  // ──────────────────────────────────────────────────────────
  // FRAIS — Lait & Crème
  // ──────────────────────────────────────────────────────────
  ['lait-demi-6x1l',        'Lait Demi-Écrémé 6×1L',       '🥛','frais','lait-creme',           'Repère',3.89, 'Candia',5.49,        null,null],
  ['lait-entier-1l',        'Lait Entier 1L',              '🥛','frais','lait-creme',            'Repère',0.79, 'Lactel',1.29,        null,null],
  ['lait-ecreme-1l',        'Lait Écrémé 1L',              '🥛','frais','lait-creme',            'Repère',0.75, 'Candia',1.19,        null,null],
  ['creme-fraiche-20cl',    'Crème Fraîche 20cl',          '🥄','frais','lait-creme',            'Repère',0.89, 'Président',1.49,     'Elle & Vire Bio',2.29],
  ['creme-liquide-20cl',    'Crème Liquide 20cl',          '🥄','frais','lait-creme',            'Repère',0.79, 'Elle & Vire',1.39,   null,null],
  ['lait-amande-1l',        "Lait d'Amande 1L",            '🥛','frais','lait-creme',            null,null,     'Alpro',2.99,         'Céréal Bio',3.49],

  // ──────────────────────────────────────────────────────────
  // FRAIS — Yaourts & Fromage Blanc
  // ──────────────────────────────────────────────────────────
  ['yaourt-nature-x8',      'Yaourts Nature ×8',           '🫙','frais','yaourts',               'Repère',1.89, 'Danone Activia',3.29,'Yoplait Bio',3.99],
  ['yaourt-vanille-x4',     'Yaourts Vanille ×4',          '🫙','frais','yaourts',               'Repère',1.19, 'Danone',2.49,        null,null],
  ['yaourt-fruits-x4',      'Yaourts Fruits ×4',           '🫙','frais','yaourts',               'Repère',1.29, 'Danone',2.69,        null,null],
  ['fromage-blanc-500g',    'Fromage Blanc 500g',          '🫙','frais','yaourts',               'Repère',1.29, 'Jockey',2.49,        'Les 2 Vaches',3.49],
  ['skyr-500g',             'Skyr Nature 500g',            '🫙','frais','yaourts',               null,null,     'Arla',2.99,          null,null],
  ['petits-suisses-x12',    'Petits-Suisses ×12',          '🫙','frais','yaourts',               'Repère',1.49, 'Gervais',2.89,       null,null],

  // ──────────────────────────────────────────────────────────
  // FRAIS — Fromages
  // ──────────────────────────────────────────────────────────
  ['emmental-rape-200g',    'Emmental Râpé 200g',          '🧀','frais','fromages',              'Repère',1.59, 'Président',2.99,     'Les 2 Vaches Bio',3.99],
  ['camembert-250g',        'Camembert 250g',              '🧀','frais','fromages',              'Repère',1.49, 'Président',2.49,     null,null],
  ['brie-250g',             'Brie 250g',                   '🧀','frais','fromages',              'Repère',1.89, 'Le Rustique',2.99,   null,null],
  ['comte-200g',            'Comté AOP 200g',              '🧀','frais','fromages',              null,null,     'Entremont',3.99,     null,null],
  ['chevre-150g',           'Bûche de Chèvre 150g',        '🧀','frais','fromages',              'Repère',1.79, 'Soignon',3.49,       'Les 2 Vaches Bio',4.29],
  ['raclette-200g',         'Raclette 200g',               '🧀','frais','fromages',              'Repère',2.49, 'Entremont',3.99,     null,null],
  ['gruyere-rape-200g',     'Gruyère Râpé 200g',           '🧀','frais','fromages',              'Repère',1.79, 'Président',3.29,     null,null],
  ['roquefort-100g',        'Roquefort 100g',              '🧀','frais','fromages',              null,null,     'Société',2.99,       null,null],

  // ──────────────────────────────────────────────────────────
  // FRAIS — Beurre & Margarine
  // ──────────────────────────────────────────────────────────
  ['beurre-doux-250g',      'Beurre Doux 250g',            '🧈','frais','beurre',                'Repère',1.95, 'Elle & Vire',2.99,   'Les 2 Vaches Bio',3.99],
  ['beurre-demi-sel-250g',  'Beurre Demi-Sel 250g',        '🧈','frais','beurre',                'Repère',1.99, 'Elle & Vire',3.09,   null,null],
  ['beurre-allege-250g',    'Beurre Allégé 250g',          '🧈','frais','beurre',                'Repère',1.79, 'Elle & Vire',2.79,   null,null],
  ['margarine-500g',        'Margarine 500g',              '🧈','frais','beurre',                'Repère',1.49, "Fruit d'Or",2.99,    null,null],

  // ──────────────────────────────────────────────────────────
  // FRAIS — Charcuterie
  // ──────────────────────────────────────────────────────────
  ['jambon-blanc-200g',     'Jambon Blanc ×4 tranches',    '🥩','frais','charcuterie',           'Repère',1.89, 'Herta',3.49,         null,null],
  ['jambon-sec-100g',       'Jambon Sec ×4',               '🥩','frais','charcuterie',           'Repère',2.29, 'Aoste',3.99,         null,null],
  ['saucisson-200g',        'Saucisson Sec 200g',          '🥩','frais','charcuterie',           'Repère',1.99, 'Justin Bridou',3.49, null,null],
  ['chorizo-200g',          'Chorizo Tranché 200g',        '🥩','frais','charcuterie',           'Repère',2.19, 'Revilla',3.79,       null,null],
  ['lardons-200g',          'Lardons Fumés 200g',          '🥩','frais','charcuterie',           'Repère',1.29, 'Herta',2.29,         null,null],
  ['pate-campagne-200g',    'Pâté de Campagne 200g',       '🥩','frais','charcuterie',           'Repère',1.09, 'Madrange',2.49,      null,null],
  ['rillettes-200g',        'Rillettes du Mans 200g',      '🥩','frais','charcuterie',           'Repère',1.29, 'William Saurin',2.89,null,null],

  // ──────────────────────────────────────────────────────────
  // FRAIS — Viandes
  // ──────────────────────────────────────────────────────────
  ['steak-hache-x4-480g',   'Steaks Hachés ×4 480g',       '🥩','frais','viande',               'Repère',4.49, 'Charal',6.99,        null,null],
  ['escalope-veau-2p',      'Escalopes Veau ×2',           '🥩','frais','viande',               'Repère',5.99, null,null,            null,null],
  ['cote-porc-2p',          'Côtes de Porc ×2',            '🥩','frais','viande',               'Repère',4.29, null,null,            null,null],
  ['filet-porc-400g',       'Filet Mignon Porc 400g',      '🥩','frais','viande',               'Repère',5.49, null,null,            null,null],
  ['chipolatas-x8',         'Chipolatas ×8',               '🌭','frais','viande',               'Repère',2.79, 'Herta',4.49,         null,null],
  ['merguez-x8',            'Merguez ×8',                  '🌭','frais','viande',               'Repère',2.99, null,null,            null,null],

  // ──────────────────────────────────────────────────────────
  // FRAIS — Volailles
  // ──────────────────────────────────────────────────────────
  ['filet-poulet-2p',       'Filets de Poulet ×2',         '🍗','frais','volaille',              'Repère',3.99, 'Le Gaulois',5.99,    null,null],
  ['escalope-dinde-2p',     'Escalopes Dinde ×2',          '🍗','frais','volaille',              'Repère',3.49, 'Le Gaulois',5.49,    null,null],
  ['cuisse-poulet-4p',      'Cuisses de Poulet ×4',        '🍗','frais','volaille',              'Repère',4.49, 'Le Gaulois',6.49,    null,null],
  ['poulet-entier-14kg',    'Poulet Fermier Entier 1,4kg',  '🍗','frais','volaille',             'Repère',5.99, null,null,            null,null],

  // ──────────────────────────────────────────────────────────
  // FRAIS — Poisson & Fruits de Mer
  // ──────────────────────────────────────────────────────────
  ['saumon-200g',           'Saumon Atlantique 200g',       '🐟','frais','poisson',              'Repère',4.99, null,null,            null,null],
  ['cabillaud-200g',        'Filet de Cabillaud 200g',      '🐟','frais','poisson',              'Repère',3.99, null,null,            null,null],
  ['crevettes-200g',        'Crevettes Cuites 200g',        '🦐','frais','poisson',              'Repère',3.49, null,null,            null,null],
  ['moules-1kg',            'Moules de Bouchot 1kg',        '🐚','frais','poisson',              'Repère',2.99, null,null,            null,null],

  // ──────────────────────────────────────────────────────────
  // FRAIS — Œufs
  // ──────────────────────────────────────────────────────────
  ['oeufs-x6',              'Œufs ×6 (cal. M)',             '🥚','frais','oeufs',                'Repère',1.39, 'Label Rouge',2.89,   'Biocoop Bio',3.49],
  ['oeufs-x12',             'Œufs ×12 (cal. M)',            '🥚','frais','oeufs',                'Repère',2.49, 'Label Rouge',4.99,   'Biocoop Bio',5.99],

  // ──────────────────────────────────────────────────────────
  // BOISSONS — Eaux
  // ──────────────────────────────────────────────────────────
  ['eau-plate-6x15l',       'Eau Plate 6×1,5L',             '💧','boissons','eaux',              'Repère',2.25, 'Evian',4.99,         null,null],
  ['eau-gazeuse-1l',        'Eau Gazeuse 1L',               '💧','boissons','eaux',              'Repère',0.39, 'Perrier',1.49,       null,null],
  ['eau-minerale-6x15l',    'Eau Minérale 6×1,5L',          '💧','boissons','eaux',              'Repère',2.49, 'Volvic',3.99,        null,null],
  ['eau-infusee-citron-1l', 'Eau Infusée Citron 1L',        '🍋','boissons','eaux',              'Repère',0.89, 'Vittel',1.89,        null,null],

  // ──────────────────────────────────────────────────────────
  // BOISSONS — Sodas
  // ──────────────────────────────────────────────────────────
  ['cola-15l',              'Cola 1,5L',                    '🥤','boissons','sodas',             'Repère',0.99, 'Coca-Cola',2.19,     null,null],
  ['cola-x6-33cl',          'Cola ×6 33cl',                 '🥤','boissons','sodas',             'Repère',2.49, 'Coca-Cola',4.79,     null,null],
  ['limonade-15l',          'Limonade 1,5L',               '🥤','boissons','sodas',             'Repère',0.79, 'Schweppes',1.99,     null,null],
  ['orangeade-15l',         'Orangeade 1,5L',              '🥤','boissons','sodas',             'Repère',0.85, 'Fanta',1.89,         null,null],
  ['tonic-1l',              'Tonic 1L',                    '🥤','boissons','sodas',             'Repère',0.79, 'Schweppes',1.99,     null,null],
  ['energie-250ml',         'Boisson Énergisante 250ml',    '⚡','boissons','sodas',             'Repère',0.99, 'Red Bull',1.89,      null,null],

  // ──────────────────────────────────────────────────────────
  // BOISSONS — Jus & Nectars
  // ──────────────────────────────────────────────────────────
  ['jus-orange-1l',         "Jus d'Orange 1L",              '🍊','boissons','jus',               'Repère',1.29, 'Tropicana',2.99,    'Innocent',3.49],
  ['jus-pomme-1l',          'Jus de Pomme 1L',              '🍎','boissons','jus',               'Repère',0.89, 'Tropicana',2.49,    'Innocent Bio',3.29],
  ['jus-multifruits-1l',    'Jus Multifruits 1L',           '🍹','boissons','jus',               'Repère',1.19, 'Tropicana',2.79,    null,null],
  ['nectar-peche-1l',       'Nectar Pêche 1L',              '🍑','boissons','jus',               'Repère',1.09, 'Joker',2.49,        null,null],
  ['smoothie-rouge-250ml',  'Smoothie Fruits Rouges 250ml', '🍓','boissons','jus',               null,null,     'Innocent',2.49,     null,null],

  // ──────────────────────────────────────────────────────────
  // BOISSONS — Bières & Cidres
  // ──────────────────────────────────────────────────────────
  ['biere-blonde-6x33',     'Bière Blonde 6×33cl',          '🍺','boissons','bieres',            'Repère',3.29, 'Kronenbourg',4.99,  null,null],
  ['biere-brune-6x33',      'Bière Brune 6×33cl',           '🍺','boissons','bieres',            'Repère',3.49, 'Leffe',6.99,        null,null],
  ['biere-sans-alcool-6x33','Bière Sans Alcool 6×33cl',     '🍺','boissons','bieres',            'Repère',2.99, 'Heineken 0.0',4.49, null,null],
  ['cidre-brut-75cl',       'Cidre Brut 75cl',              '🍎','boissons','bieres',            'Repère',2.49, 'Loïc Raison',4.49,  null,null],

  // ──────────────────────────────────────────────────────────
  // BOISSONS — Vins
  // ──────────────────────────────────────────────────────────
  ['bordeaux-rouge-75cl',   'Bordeaux Rouge 75cl',          '🍷','boissons','vins',              'Repère',4.99, 'Mouton Cadet',8.99, null,null],
  ['bourgogne-75cl',        'Bourgogne Rouge 75cl',         '🍷','boissons','vins',              'Repère',5.99, 'Louis Jadot',12.99, null,null],
  ['muscadet-75cl',         'Muscadet Blanc 75cl',          '🍾','boissons','vins',              'Repère',4.49, 'Château du Coing',7.99,null,null],
  ['rose-provence-75cl',    'Côtes de Provence Rosé 75cl',  '🍷','boissons','vins',              'Repère',5.49, 'Miraval',14.99,     null,null],
  ['champagne-brut-75cl',   'Champagne Brut 75cl',          '🍾','boissons','vins',              'Repère',12.99,'Moët & Chandon',39.99,null,null],

  // ──────────────────────────────────────────────────────────
  // HYGIÈNE — Soins Capillaires
  // ──────────────────────────────────────────────────────────
  ['shampoing-normal-400ml','Shampooing Normaux 400ml',      '🧴','hygiene','soins-capillaires',  'Repère',1.89, 'Elseve',5.49,       'Lavera',7.99],
  ['shampoing-sec-250ml',   'Shampoing Sec 250ml',          '🧴','hygiene','soins-capillaires',  'Repère',2.49, 'Batiste',4.99,      null,null],
  ['apres-shampoing-200ml', 'Après-Shampooing 200ml',       '🧴','hygiene','soins-capillaires',  'Repère',1.99, 'Elseve',5.99,       'Lavera',7.49],
  ['masque-cheveux-200ml',  'Masque Cheveux 200ml',         '🧴','hygiene','soins-capillaires',  'Repère',2.49, 'Garnier Fructis',5.49,null,null],
  ['huile-cheveux-100ml',   'Huile Cheveux 100ml',          '🧴','hygiene','soins-capillaires',  null,null,     "L'Oréal",8.99,     null,null],

  // ──────────────────────────────────────────────────────────
  // HYGIÈNE — Soins Corps
  // ──────────────────────────────────────────────────────────
  ['gel-douche-400ml',      'Gel Douche 400ml',             '🚿','hygiene','soins-corps',        'Repère',0.99, 'Dove',3.99,         'Lavera',6.49],
  ['savon-solide-x3',       'Savon Solide ×3',              '🧼','hygiene','soins-corps',        'Repère',0.79, 'Palmolive',2.49,    'La Corvette Bio',5.99],
  ['creme-corps-400ml',     'Crème Corps 400ml',            '🧴','hygiene','soins-corps',        'Repère',2.49, 'Nivea',4.99,        'Weleda',9.99],
  ['deodorant-bille-50ml',  'Déodorant Bille 50ml',         '🧴','hygiene','soins-corps',        'Repère',1.39, 'Dove',3.49,         'Sanex 0%',3.99],
  ['deodorant-spray-200ml', 'Déodorant Spray 200ml',        '🧴','hygiene','soins-corps',        'Repère',1.49, 'Axe',3.99,          null,null],

  // ──────────────────────────────────────────────────────────
  // HYGIÈNE — Soins Visage
  // ──────────────────────────────────────────────────────────
  ['creme-visage-50ml',     'Crème Visage Jour 50ml',       '🧴','hygiene','soins-visage',       'Repère',4.99, 'Nivea',7.99,        'Caudalie',22.99],
  ['nettoyant-visage-200ml','Gel Nettoyant Visage 200ml',   '🧴','hygiene','soins-visage',       'Repère',2.99, 'Garnier',5.99,      null,null],
  ['contour-yeux-15ml',     'Crème Contour des Yeux 15ml',  '🧴','hygiene','soins-visage',       null,null,     'Nivea',9.99,        null,null],
  ['serum-vitc-30ml',       'Sérum Vitamine C 30ml',        '🧴','hygiene','soins-visage',       null,null,     'Garnier',12.99,     null,null],
  ['eau-micellaire-400ml',  'Eau Micellaire 400ml',         '🧴','hygiene','soins-visage',       'Repère',2.49, 'Garnier',4.99,      null,null],

  // ──────────────────────────────────────────────────────────
  // HYGIÈNE — Bucco-Dentaire
  // ──────────────────────────────────────────────────────────
  ['dentifrice-75ml',       'Dentifrice 75ml',              '🦷','hygiene','dentaire',           'Repère',0.89, 'Signal',2.49,       null,null],
  ['bain-bouche-500ml',     'Bain de Bouche 500ml',         '🦷','hygiene','dentaire',           'Repère',1.99, 'Listerine',4.99,    null,null],
  ['fil-dentaire-50m',      'Fil Dentaire 50m',             '🦷','hygiene','dentaire',           'Repère',1.29, 'Oral-B',3.49,       null,null],
  ['brosse-dents',          'Brosse à Dents Medium',        '🪥','hygiene','dentaire',           'Repère',0.99, 'Oral-B',3.99,       'Eco Boo',5.99],

  // ──────────────────────────────────────────────────────────
  // HYGIÈNE — Rasage
  // ──────────────────────────────────────────────────────────
  ['mousse-raser-200ml',    'Mousse à Raser 200ml',         '🪒','hygiene','rasage',             'Repère',1.49, 'Gillette',3.99,     null,null],
  ['gel-raser-200ml',       'Gel à Raser 200ml',            '🪒','hygiene','rasage',             'Repère',1.39, 'Gillette',3.79,     null,null],
  ['rasoir-jetable-x5',     'Rasoir Jetable ×5',            '🪒','hygiene','rasage',             'Repère',2.49, 'Gillette',6.99,     null,null],
  ['apres-rasage-100ml',    'Après-Rasage 100ml',           '🪒','hygiene','rasage',             null,null,     'Gillette',6.99,     null,null],

  // ──────────────────────────────────────────────────────────
  // HYGIÈNE — Protection Féminine
  // ──────────────────────────────────────────────────────────
  ['tampons-x20',           'Tampons ×20',                  '🌸','hygiene','protection-feminine', 'Repère',2.49, 'Tampax',4.49,      'Organyc Bio',5.99],
  ['serviettes-x14',        'Serviettes Hygiéniques ×14',   '🌸','hygiene','protection-feminine', 'Repère',2.29, 'Always',4.29,      'Nana Bio',4.99],
  ['culotte-menstruelle',   'Culotte Menstruelle',          '🌸','hygiene','protection-feminine', null,null,     'Nana',12.99,       'Fempo',19.99],

  // ──────────────────────────────────────────────────────────
  // BÉBÉ — Couches
  // ──────────────────────────────────────────────────────────
  ['couches-t2-x40',        'Couches Taille 2 ×40',         '👶','bebe','couches',               'Repère',5.99, 'Pampers',9.99,      null,null],
  ['couches-t3-x50',        'Couches Taille 3 ×50',         '👶','bebe','couches',               'Repère',7.49, 'Pampers',12.99,     null,null],
  ['couches-t4-x44',        'Couches Taille 4 ×44',         '👶','bebe','couches',               'Repère',6.99, 'Pampers',11.99,     null,null],
  ['couches-t5-x38',        'Couches Taille 5 ×38',         '👶','bebe','couches',               'Repère',7.99, 'Pampers',13.49,     null,null],
  ['couches-nuit-t4-x32',   'Couches Nuit T4 ×32',          '👶','bebe','couches',               'Repère',7.49, 'Pampers Night',12.99,null,null],

  // ──────────────────────────────────────────────────────────
  // BÉBÉ — Lingettes
  // ──────────────────────────────────────────────────────────
  ['lingettes-x72',         'Lingettes Bébé ×72',           '🧻','bebe','lingettes',             'Repère',1.69, 'Pampers',2.99,      null,null],
  ['lingettes-x144',        'Lingettes Bébé ×144',          '🧻','bebe','lingettes',             'Repère',2.99, 'Pampers',5.49,      null,null],
  ['lingettes-sensibles-x72','Lingettes Peau Sensible ×72', '🧻','bebe','lingettes',             'Repère',1.89, 'WaterWipes',4.49,   null,null],

  // ──────────────────────────────────────────────────────────
  // BÉBÉ — Alimentation Bébé
  // ──────────────────────────────────────────────────────────
  ['compote-bebe-x4',       'Compote Bébé Pomme ×4',        '🍎','bebe','alim-bebe',             'Repère',1.49, 'Blédina',2.29,      'Hipp Bio',3.49],
  ['puree-bebe-x2',         'Petits Pots Légumes ×2',       '🥕','bebe','alim-bebe',             'Repère',1.99, 'Blédina',2.99,      'Hipp Bio',3.99],
  ['cereales-bebe-250g',    'Céréales Bébé 250g',           '🥣','bebe','alim-bebe',             'Repère',1.79, 'Blédina',3.49,      'Hipp Bio',4.29],
  ['lait-bebe-800g',        'Lait 2ème Âge 800g',           '🍼','bebe','alim-bebe',             'Repère',7.99, 'Guigoz',12.99,      null,null],
  ['petit-pot-veau-x2',     'Petits Pots Veau ×2',          '🥩','bebe','alim-bebe',             'Repère',2.49, 'Blédina',3.49,      'Hipp Bio',4.49],

  // ──────────────────────────────────────────────────────────
  // BÉBÉ — Soins Bébé
  // ──────────────────────────────────────────────────────────
  ['lait-corps-bebe-500ml', 'Lait Corps Bébé 500ml',        '🧴','bebe','soins-bebe',            'Repère',2.49, 'Mustela',9.99,      'Weleda',12.99],
  ['creme-change-75ml',     'Crème Change 75ml',            '🧴','bebe','soins-bebe',            'Repère',1.99, 'Pampers',5.49,      'Mustela Bio',8.99],
  ['shampoing-bebe-200ml',  'Shampooing Bébé 200ml',        '🧴','bebe','soins-bebe',            'Repère',1.49, 'Bübchen',3.99,      'Weleda',7.99],
  ['huile-massage-bebe',    'Huile Massage Bébé 100ml',     '🧴','bebe','soins-bebe',            null,null,     'Mustela',8.99,      'Weleda Bio',11.99],

  // ──────────────────────────────────────────────────────────
  // ENTRETIEN — Lessive
  // ──────────────────────────────────────────────────────────
  ['lessive-liquide-27l',   'Lessive Liquide 27 lavages',   '🧺','entretien','lessive',          'Repère',4.49, 'Ariel',9.99,        'Le Chat Végétal',7.99],
  ['lessive-poudre-30l',    'Lessive Poudre 30 lavages',    '🧺','entretien','lessive',          'Repère',3.99, 'Skip',8.49,         null,null],
  ['lessive-tablettes-x30', 'Lessive Tablettes ×30',        '🧺','entretien','lessive',          'Repère',5.99, 'Ariel 3en1',12.99,  null,null],
  ['assouplissant-1l',      'Assouplissant 1L',             '🌸','entretien','lessive',          'Repère',1.89, 'Cajoline',3.99,     null,null],
  ['lessive-bebe-1l',       'Lessive Spéciale Bébé 1L',     '🧺','entretien','lessive',          'Repère',3.49, null,null,           'Le Chat Bébé Bio',6.49],

  // ──────────────────────────────────────────────────────────
  // ENTRETIEN — Vaisselle
  // ──────────────────────────────────────────────────────────
  ['liquide-vaisselle-500ml','Liquide Vaisselle 500ml',     '🫧','entretien','vaisselle',        'Repère',0.99, 'Fairy',2.49,        null,null],
  ['pastilles-lave-x30',    'Pastilles Lave-Vaisselle ×30', '🫧','entretien','vaisselle',        'Repère',3.49, 'Finish',6.99,       null,null],
  ['sel-lave-vaisselle-1kg','Sel Lave-Vaisselle 1kg',       '🫧','entretien','vaisselle',        'Repère',0.69, 'Finish',1.49,       null,null],
  ['brillant-lv-500ml',     'Brillant Lave-Vaisselle 500ml','🫧','entretien','vaisselle',        'Repère',1.49, 'Finish',2.99,       null,null],

  // ──────────────────────────────────────────────────────────
  // ENTRETIEN — Nettoyants Ménagers
  // ──────────────────────────────────────────────────────────
  ['nettoyant-surfaces-750ml','Nettoyant Multi-Surfaces 750ml','🧹','entretien','menager',       'Repère',0.99, 'Mr Propre',2.99,    null,null],
  ['nettoyant-wc-750ml',    'Nettoyant WC 750ml',           '🚽','entretien','menager',          'Repère',0.89, 'Harpic',2.49,       null,null],
  ['nettoyant-sdb-500ml',   'Nettoyant Salle de Bain 500ml','🛁','entretien','menager',          'Repère',0.99, 'Cif',2.79,          null,null],
  ['desinfectant-spray-750ml','Désinfectant Spray 750ml',   '🧹','entretien','menager',          'Repère',1.49, 'Dettol',3.99,       null,null],
  ['deboucheur-500ml',      'Déboucheur 500ml',             '🚰','entretien','menager',          null,null,     'Destop',3.99,       null,null],

  // ──────────────────────────────────────────────────────────
  // ENTRETIEN — Papier & Emballages
  // ──────────────────────────────────────────────────────────
  ['papier-toilette-x6',    'Papier Toilette ×6',           '🧻','entretien','papier-menage',    'Repère',2.49, 'Lotus',5.99,        null,null],
  ['papier-toilette-x12',   'Papier Toilette ×12',          '🧻','entretien','papier-menage',    'Repère',4.49, 'Lotus',9.99,        null,null],
  ['essuie-tout-x3',        'Essuie-Tout ×3',               '🧻','entretien','papier-menage',    'Repère',2.29, 'Sopalin',4.49,      null,null],
  ['mouchoirs-x6',          'Mouchoirs ×6 boîtes',          '🤧','entretien','papier-menage',    'Repère',2.49, 'Kleenex',4.99,      null,null],
  ['sacs-poubelles-x30',    'Sacs Poubelle ×30',            '🗑️','entretien','papier-menage',    'Repère',1.99, 'Glad',3.99,         null,null],
  ['film-etirable-50m',     'Film Étirable 50m',            '📦','entretien','papier-menage',    'Repère',0.99, 'Albal',2.49,        null,null],
  ['papier-aluminium-20m',  'Papier Aluminium 20m',         '📦','entretien','papier-menage',    'Repère',0.89, 'Albal',2.29,        null,null],

  // ──────────────────────────────────────────────────────────
  // SURGELÉS — Légumes Surgelés
  // ──────────────────────────────────────────────────────────
  ['haricots-surgeles-1kg', 'Haricots Verts Surgelés 1kg',  '🫘','surgeles','legumes-surgeles',  'Repère',1.89, 'Bonduelle',3.49,    'Jardin Bio Surgel',3.99],
  ['epinards-surgeles-750g','Épinards Surgelés 750g',        '🌿','surgeles','legumes-surgeles',  'Repère',1.79, 'Bonduelle',3.29,    null,null],
  ['petits-pois-surgeles',  'Petits Pois Surgelés 1kg',     '🫘','surgeles','legumes-surgeles',  'Repère',1.69, 'Bonduelle',2.99,    null,null],
  ['poele-legumes-600g',    'Poêlée de Légumes 600g',       '🥦','surgeles','legumes-surgeles',  'Repère',2.19, 'Bonduelle',3.89,    null,null],
  ['frites-1kg',            'Frites 1kg',                   '🍟','surgeles','legumes-surgeles',  'Repère',1.49, 'McCain',2.99,       null,null],
  ['pommes-dauphine-600g',  'Pommes Dauphine 600g',         '🥔','surgeles','legumes-surgeles',  'Repère',1.99, 'McCain',3.49,       null,null],

  // ──────────────────────────────────────────────────────────
  // SURGELÉS — Poisson Surgelé
  // ──────────────────────────────────────────────────────────
  ['cabillaud-surgele-800g','Cabillaud Surgelé 800g',        '🐟','surgeles','poisson-surgele',   'Repère',4.99, null,null,           null,null],
  ['crevettes-surgeles-500g','Crevettes Surgelées 500g',     '🦐','surgeles','poisson-surgele',   'Repère',3.99, 'Hénaff',6.49,      null,null],
  ['saumon-surgele-4p',     'Pavés de Saumon ×4',           '🐟','surgeles','poisson-surgele',   'Repère',5.99, null,null,           null,null],
  ['coquilles-x6',          'Coquilles St-Jacques ×6',      '🐚','surgeles','poisson-surgele',   'Repère',6.99, null,null,           null,null],

  // ──────────────────────────────────────────────────────────
  // SURGELÉS — Plats Préparés
  // ──────────────────────────────────────────────────────────
  ['lasagnes-surgeles-400g','Lasagnes Bœuf Surgelées 400g', '🍝','surgeles','plats-prepares',    'Repère',2.49, 'Findus',4.99,       null,null],
  ['hachis-parm-400g',      'Hachis Parmentier 400g',       '🥔','surgeles','plats-prepares',    'Repère',2.29, 'Findus',4.49,       null,null],
  ['poulet-basquaise-400g', 'Poulet Basquaise 400g',        '🍗','surgeles','plats-prepares',    'Repère',2.99, 'Fleury Michon',5.49,null,null],
  ['moussaka-400g',         'Moussaka 400g',                '🥔','surgeles','plats-prepares',    'Repère',2.79, null,null,           null,null],
  ['gratin-dauphinois-400g','Gratin Dauphinois 400g',       '🥔','surgeles','plats-prepares',    'Repère',1.99, 'Père Dodu',3.99,    null,null],

  // ──────────────────────────────────────────────────────────
  // SURGELÉS — Pizzas
  // ──────────────────────────────────────────────────────────
  ['pizza-margherita-400g', 'Pizza Margherita 400g',        '🍕','surgeles','pizzas',            'Repère',1.99, 'Dr. Oetker',4.49,   null,null],
  ['pizza-4fromages-400g',  'Pizza 4 Fromages 400g',        '🍕','surgeles','pizzas',            'Repère',2.19, 'Dr. Oetker',4.79,   null,null],
  ['pizza-jambon-400g',     'Pizza Jambon 400g',            '🍕','surgeles','pizzas',            'Repère',1.99, 'Buitoni',4.49,      null,null],
  ['pizza-reine-500g',      'Pizza Reine 500g',             '🍕','surgeles','pizzas',            'Repère',2.49, 'Buitoni',5.49,      null,null],
  ['pizza-chorizo-450g',    'Pizza Chorizo 450g',           '🍕','surgeles','pizzas',            'Repère',2.29, 'Dr. Oetker',4.99,   null,null],

  // ──────────────────────────────────────────────────────────
  // SURGELÉS — Glaces & Sorbets
  // ──────────────────────────────────────────────────────────
  ['glace-vanille-1l',      'Crème Glacée Vanille 1L',      '🍦','surgeles','glaces',            'Repère',1.99, "Häagen-Dazs",5.99,  null,null],
  ['sorbet-framboise-1l',   'Sorbet Framboise 1L',          '🍓','surgeles','glaces',            "Repère",1.89, "Carte d'Or",4.49,   null,null],
  ['glace-chocolat-1l',     'Glace Chocolat 1L',            '🍫','surgeles','glaces',            'Repère',1.99, "Carte d'Or",4.49,   null,null],
  ['esquimaux-x6',          'Esquimaux ×6',                 '🍦','surgeles','glaces',            'Repère',2.49, 'Magnum',5.99,       null,null],
  ['cornets-x4',            'Cornets Glacés ×4',            '🍦','surgeles','glaces',            'Repère',1.99, 'Drumstick',3.99,    null,null],

  // ──────────────────────────────────────────────────────────
  // ANIMALERIE — Chiens
  // ──────────────────────────────────────────────────────────
  ['croquettes-petit-chien-1kg','Croquettes Petit Chien 1kg','🐕','animalerie','chiens',         'Repère',3.49, 'Purina Pro Plan',7.99,null,null],
  ['croquettes-grand-chien-3kg','Croquettes Grand Chien 3kg','🐕','animalerie','chiens',         'Repère',8.49, 'Royal Canin',19.99, null,null],
  ['pates-chien-800g',      'Pâtée Chien Bœuf 800g',        '🐕','animalerie','chiens',          'Repère',2.49, 'Pedigree',4.99,     null,null],
  ['friandises-chien-200g', 'Friandises Chien 200g',        '🐕','animalerie','chiens',          null,null,     'Pedigree',3.99,     null,null],
  ['shampoing-chien-250ml', 'Shampooing Chien 250ml',       '🐕','animalerie','chiens',          'Repère',2.99, null,null,           null,null],

  // ──────────────────────────────────────────────────────────
  // ANIMALERIE — Chats
  // ──────────────────────────────────────────────────────────
  ['croquettes-chat-1kg',   'Croquettes Chat 1kg',          '🐈','animalerie','chats',           'Repère',2.99, 'Whiskas',5.99,      null,null],
  ['croquettes-chat-steril','Croquettes Chat Stérilisé 1kg','🐈','animalerie','chats',           'Repère',3.49, 'Royal Canin',8.99,  null,null],
  ['pates-chat-saumon-x4',  'Pâtée Chat Saumon ×4',         '🐈','animalerie','chats',           'Repère',1.99, 'Purina Felix',3.49, null,null],
  ['pates-chat-boeuf-x4',   'Pâtée Chat Bœuf ×4',           '🐈','animalerie','chats',           'Repère',1.89, 'Purina Felix',3.29, null,null],
  ['friandises-chat-50g',   'Friandises Chat 50g',          '🐈','animalerie','chats',           null,null,     'Whiskas Temptations',2.99,null,null],
  ['litiere-chat-5l',       'Litière Agglomérante 5L',      '🐈','animalerie','chats',           'Repère',2.99, 'Catsan',5.99,       null,null],
];
/* eslint-enable no-multi-spaces */

// ─── Offres déterministes ───────────────────────────────────

// Lidl/Aldi sont EDLP (Every Day Low Price) → pas de promos catalogue
const PROMO_STORES: (StoreId | 'all')[] = ['leclerc', 'superu', 'carrefour', 'intermarche', 'auchan', 'monoprix', 'all'];
const CASHBACK_APPS: CashbackOffer['app'][] = ['shopmium', 'quoty', 'coupon_network'];

const STORE_NAME: Record<StoreId | 'all', string> = {
  leclerc: 'E.Leclerc', superu: 'Super U', carrefour: 'Carrefour',
  intermarche: 'Intermarché', auchan: 'Auchan', monoprix: 'Monoprix',
  lidl: 'Lidl', aldi: 'Aldi', all: 'toutes enseignes',
};

function makePromo(idx: number, price: number): CataloguePromo {
  const storeIdx = idx % PROMO_STORES.length;
  const store = PROMO_STORES[storeIdx];
  if (idx % 2 === 0) {
    const pct = [0.20, 0.25, 0.30, 0.34, 0.40][idx % 5];
    return { type: 'percent', value: pct, store, label: `-${Math.round(pct * 100)}% ticket ${STORE_NAME[store]}` };
  } else {
    const amount = Math.round(Math.min(price * 0.25, [0.30, 0.50, 0.80, 1.00, 1.50][idx % 5]) * 100) / 100;
    return { type: 'immediate', value: amount, store, label: `-${amount.toFixed(2)}€ remise immédiate` };
  }
}

function makeCashback(idx: number, price: number): CashbackOffer {
  const app = CASHBACK_APPS[idx % 3];
  const amount = Math.round(Math.min(price * 0.15, [0.50, 1.00, 1.50, 2.00, 2.50][idx % 5]) * 100) / 100;
  const appLabel = app === 'shopmium' ? 'Shopmium' : app === 'quoty' ? 'Quoty' : 'Coupon Network';
  return { app, amount, label: `-${amount.toFixed(2)}€ cashback ${appLabel}` };
}

// Base timestamp: simulates prices verified between 2 and 90 min ago
const BASE_TS = Date.now();
function lastVerified(idx: number): number {
  const minutesAgo = 2 + ((idx * 13 + 7) % 89);
  return BASE_TS - minutesAgo * 60 * 1000;
}

// ─── Unité de mesure (extraite du groupId) ─────────────────

function parseUnitFromId(id: string): { unit_size: number; unit_type: 'kg' | 'L' | 'unit' } {
  const kgM = id.match(/[-_](\d+)kg$/i);
  if (kgM) return { unit_size: parseFloat(kgM[1]), unit_type: 'kg' };
  const gM = id.match(/[-_](\d+)g$/i);
  if (gM) return { unit_size: parseFloat(gM[1]) / 1000, unit_type: 'kg' };
  const lDecM = id.match(/[-_](\d+)l(\d+)$/i);
  if (lDecM) return { unit_size: parseFloat(lDecM[1]) + parseFloat(lDecM[2]) / 10, unit_type: 'L' };
  const lM = id.match(/[-_](\d+)l$/i);
  if (lM) return { unit_size: parseFloat(lM[1]), unit_type: 'L' };
  const mlM = id.match(/[-_](\d+)ml$/i);
  if (mlM) return { unit_size: parseFloat(mlM[1]) / 1000, unit_type: 'L' };
  return { unit_size: 1, unit_type: 'unit' };
}

// ─── Génération de la base de données ──────────────────────

function buildDB(): ProductGroup[] {
  let mddN = 1, leaderN = 1, bioN = 1;

  return TEMPLATES.map((t, idx) => {
    const [id, name, emoji, cat, sub,
      mddBrand, mddPrice,
      leaderBrand, leaderPrice,
      bioBrand, bioPrice] = t;

    const variants: Partial<Record<SegmentType, ProductVariant>> = {};
    const { unit_size, unit_type } = parseUnitFromId(id);
    const ppu = (price: number) =>
      unit_size > 0 ? Math.round(price / unit_size * 100) / 100 : price;

    // Every 4th product gets a catalogue promo, every 8th also gets cashback
    const hasPromo = idx % 4 === 0;
    const hasCashback = idx % 8 === 0;

    if (mddBrand && mddPrice) {
      variants.mdd = {
        ean: ean13('32', mddN++),
        type: 'mdd',
        brand: mddBrand,
        basePrice: mddPrice,
        prices: storePrices(mddPrice, idx, 'mdd'),
        price_per_unit: ppu(mddPrice),
        unit_ref: unit_type,
        last_verified: lastVerified(idx),
        ...(hasPromo ? { catalogue_promo: makePromo(idx, mddPrice) } : {}),
        ...(hasCashback ? { cashback_app: makeCashback(idx, mddPrice) } : {}),
      };
    }
    if (leaderBrand && leaderPrice) {
      const promoIdx = idx + 1;
      const hasLeaderPromo = promoIdx % 4 === 0;
      const hasLeaderCashback = promoIdx % 8 === 0;
      variants.leader = {
        ean: ean13('30', leaderN++),
        type: 'leader',
        brand: leaderBrand,
        basePrice: leaderPrice,
        prices: storePrices(leaderPrice, idx + 1000, 'leader'),
        price_per_unit: ppu(leaderPrice),
        unit_ref: unit_type,
        last_verified: lastVerified(idx + 1),
        ...(hasLeaderPromo ? { catalogue_promo: makePromo(promoIdx, leaderPrice) } : {}),
        ...(hasLeaderCashback ? { cashback_app: makeCashback(promoIdx, leaderPrice) } : {}),
      };
    }
    if (bioBrand && bioPrice) {
      const promoIdx = idx + 2;
      const hasBioPromo = promoIdx % 4 === 0;
      const hasBioCashback = promoIdx % 8 === 0;
      variants.bio = {
        ean: ean13('37', bioN++),
        type: 'bio',
        brand: bioBrand,
        basePrice: bioPrice,
        prices: storePrices(bioPrice, idx + 2000, 'bio'),
        price_per_unit: ppu(bioPrice),
        unit_ref: unit_type,
        last_verified: lastVerified(idx + 2),
        ...(hasBioPromo ? { catalogue_promo: makePromo(promoIdx, bioPrice) } : {}),
        ...(hasBioCashback ? { cashback_app: makeCashback(promoIdx, bioPrice) } : {}),
      };
    }

    const equivalence_key = id.toUpperCase().replace(/-/g, '_');
    return { groupId: id, genericName: name, emoji, categorySlug: cat, subcategorySlug: sub, equivalence_key, unit_size, unit_type, variants };
  });
}

export const PRODUCTS_DB: ProductGroup[] = buildDB();

// ─── Live override (V2 — données API) ─────────────────────
// Permet au store de remplacer la base statique par des données fraîches
// sans casser findProductGroup / getProductsByCategory etc.

let _liveDB: ProductGroup[] | null = null;

/**
 * Remplace la base de données locale par les données reçues de l'API.
 * Appelé par le store au démarrage dès que le fetch réseau réussit.
 */
export function setLiveProductsDB(products: ProductGroup[]): void {
  _liveDB = products;
}

/** Réinitialise la base live (utile pour les tests). */
export function resetLiveProductsDB(): void {
  _liveDB = null;
}

/** Base active : live si disponible, sinon statique. */
function activeDB(): ProductGroup[] {
  return _liveDB ?? PRODUCTS_DB;
}

// ─── Helpers ───────────────────────────────────────────────

export function getProductsBySubcategory(catSlug: string, subSlug: string): ProductGroup[] {
  return activeDB().filter(p => p.categorySlug === catSlug && p.subcategorySlug === subSlug);
}

export function getProductsByCategory(catSlug: string): ProductGroup[] {
  return activeDB().filter(p => p.categorySlug === catSlug);
}

export function findProductGroup(groupId: string): ProductGroup | undefined {
  return activeDB().find(p => p.groupId === groupId);
}

export function totalEANCount(): number {
  return activeDB().reduce((s, g) => s + Object.keys(g.variants).length, 0);
}

// ─── Stats (pour affichage dans l'UI) ─────────────────────

export function categoryProductCount(catSlug: string): number {
  return activeDB().filter(p => p.categorySlug === catSlug).length;
}

export function subcategoryProductCount(catSlug: string, subSlug: string): number {
  return activeDB().filter(p => p.categorySlug === catSlug && p.subcategorySlug === subSlug).length;
}
