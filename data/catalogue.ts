// ============================================================
// SmartHunt — Catalogue hiérarchique
// Catégorie → Sous-catégorie → Produit → Variantes (MDD / Leader / Bio)
// ============================================================

export type SegmentChoice = 'mdd' | 'national' | 'bio';

export interface ProductVariant {
  ean: string;
  segment: SegmentChoice;
  label: string;
  brand: string;
}

export interface CatalogueProduct {
  id: string;
  genericName: string;
  emoji: string;
  variants: ProductVariant[];  // toujours [mdd?, national?, bio?]
}

export interface Subcategory {
  slug: string;
  label: string;
  emoji: string;
  products: CatalogueProduct[];
}

export interface Category {
  slug: string;
  label: string;
  emoji: string;
  color: string;
  subcategories: Subcategory[];
}

export const CATALOGUE: Category[] = [
  {
    slug: 'epicerie',
    label: 'Épicerie',
    emoji: '🛒',
    color: '#FF6B35',
    subcategories: [
      {
        slug: 'pates-riz',
        label: 'Pâtes & Riz',
        emoji: '🍝',
        products: [
          {
            id: 'spaghetti',
            genericName: 'Spaghetti 500g',
            emoji: '🍝',
            variants: [
              { ean: '3245413410021', segment: 'mdd',      label: 'Marque Repère', brand: 'Marque Repère' },
              { ean: '8000500310427', segment: 'national',  label: 'Leader Marché', brand: 'Barilla' },
              { ean: '3250391694073', segment: 'bio',       label: 'Bio',           brand: 'Bio Village' },
            ],
          },
          {
            id: 'riz-long',
            genericName: 'Riz Long Grain 1kg',
            emoji: '🍚',
            variants: [
              { ean: '3250390034560', segment: 'mdd',      label: 'Marque Repère', brand: 'Carrefour' },
              { ean: '3250390034561', segment: 'national',  label: 'Leader Marché', brand: 'Uncle Ben\'s' },
            ],
          },
          {
            id: 'farine',
            genericName: 'Farine de Blé T45 1kg',
            emoji: '🌾',
            variants: [
              { ean: '3250390012234', segment: 'mdd',      label: 'Marque Repère', brand: 'Carrefour' },
              { ean: '3250390012235', segment: 'national',  label: 'Leader Marché', brand: 'Francine' },
            ],
          },
        ],
      },
      {
        slug: 'epicerie-sucree',
        label: 'Épicerie sucrée',
        emoji: '🍪',
        products: [
          {
            id: 'pate-tartiner',
            genericName: 'Pâte à tartiner 750g',
            emoji: '🫙',
            variants: [
              { ean: '3045320094085', segment: 'mdd',      label: 'Marque Repère', brand: 'Marque Repère' },
              { ean: '3045320094084', segment: 'national',  label: 'Leader Marché', brand: 'Nutella' },
              { ean: '3760020507357', segment: 'bio',       label: 'Bio',           brand: 'Bio Village' },
            ],
          },
          {
            id: 'chocolat',
            genericName: 'Tablette Chocolat au Lait 100g',
            emoji: '🍫',
            variants: [
              { ean: '4056489059357', segment: 'mdd',      label: 'Marque Repère', brand: 'Marque Repère' },
              { ean: '4056489059356', segment: 'national',  label: 'Leader Marché', brand: 'Milka' },
            ],
          },
        ],
      },
      {
        slug: 'cafe-the',
        label: 'Café & Thé',
        emoji: '☕',
        products: [
          {
            id: 'capsules-cafe',
            genericName: 'Capsules Café x16',
            emoji: '☕',
            variants: [
              { ean: '7613036018839', segment: 'mdd',      label: 'Marque Repère', brand: 'Marque Repère' },
              { ean: '7613036018838', segment: 'national',  label: 'Leader Marché', brand: 'Nescafé DG' },
            ],
          },
        ],
      },
      {
        slug: 'huiles-sauces',
        label: 'Huiles & Sauces',
        emoji: '🫙',
        products: [
          {
            id: 'huile-tournesol',
            genericName: 'Huile de Tournesol 1L',
            emoji: '🌻',
            variants: [
              { ean: '3445670019823', segment: 'mdd',      label: 'Marque Repère', brand: 'Leclerc' },
              { ean: '3155250354073', segment: 'national',  label: 'Leader Marché', brand: 'Lesieur Isio4' },
              { ean: '3760148681234', segment: 'bio',       label: 'Bio',           brand: 'Jardin Bio Olive' },
            ],
          },
        ],
      },
    ],
  },

  {
    slug: 'frais',
    label: 'Frais',
    emoji: '🥛',
    color: '#00B4FF',
    subcategories: [
      {
        slug: 'laitiers',
        label: 'Produits Laitiers',
        emoji: '🥛',
        products: [
          {
            id: 'lait-uht',
            genericName: 'Lait Demi-Écrémé UHT 6×1L',
            emoji: '🥛',
            variants: [
              { ean: '3245680010120', segment: 'mdd',      label: 'Marque Repère', brand: 'Marque Repère' },
              { ean: '3245680010121', segment: 'national',  label: 'Leader Marché', brand: 'Candia' },
            ],
          },
          {
            id: 'yaourt-nature',
            genericName: 'Yaourts Nature x8',
            emoji: '🫙',
            variants: [
              { ean: '3270190130026', segment: 'mdd',      label: 'Marque Repère', brand: 'Marque Repère' },
              { ean: '3017620425035', segment: 'national',  label: 'Leader Marché', brand: 'Danone Activia' },
              { ean: '3270190130025', segment: 'bio',       label: 'Bio',           brand: 'Bio Village' },
            ],
          },
          {
            id: 'beurre',
            genericName: 'Beurre Doux 250g',
            emoji: '🧈',
            variants: [
              { ean: '3228857000167', segment: 'mdd',      label: 'Marque Repère', brand: 'Marque Repère' },
              { ean: '3228857000166', segment: 'national',  label: 'Leader Marché', brand: 'Elle & Vire' },
            ],
          },
          {
            id: 'creme-fraiche',
            genericName: 'Crème Fraîche Épaisse 20cl',
            emoji: '🥄',
            variants: [
              { ean: '3029330003534', segment: 'mdd',      label: 'Marque Repère', brand: 'Marque Repère' },
              { ean: '3029330003533', segment: 'national',  label: 'Leader Marché', brand: 'Président' },
            ],
          },
        ],
      },
    ],
  },

  {
    slug: 'boissons',
    label: 'Boissons',
    emoji: '🥤',
    color: '#06B6D4',
    subcategories: [
      {
        slug: 'sodas-eaux',
        label: 'Sodas & Eaux',
        emoji: '💧',
        products: [
          {
            id: 'cola',
            genericName: 'Cola 1,5L',
            emoji: '🥤',
            variants: [
              { ean: '5000112637442', segment: 'mdd',      label: 'Marque Repère', brand: 'Marque Repère' },
              { ean: '5000112637441', segment: 'national',  label: 'Leader Marché', brand: 'Coca-Cola' },
            ],
          },
          {
            id: 'eau-plate',
            genericName: 'Eau Plate 6×1,5L',
            emoji: '💧',
            variants: [
              { ean: '3017620007090', segment: 'mdd',      label: 'Marque Repère', brand: 'Marque Repère' },
              { ean: '3017750313053', segment: 'national',  label: 'Leader Marché', brand: 'Évian' },
            ],
          },
        ],
      },
    ],
  },

  {
    slug: 'hygiene',
    label: 'Hygiène',
    emoji: '🧴',
    color: '#A855F7',
    subcategories: [
      {
        slug: 'soins-capillaires',
        label: 'Soins Capillaires',
        emoji: '💆',
        products: [
          {
            id: 'shampoing',
            genericName: 'Shampooing 400ml',
            emoji: '🧴',
            variants: [
              { ean: '3574661680569', segment: 'mdd',      label: 'Marque Repère', brand: 'Carrefour' },
              { ean: '3574661680568', segment: 'national',  label: 'Leader Marché', brand: 'Head & Shoulders' },
            ],
          },
        ],
      },
    ],
  },

  {
    slug: 'bebe',
    label: 'Bébé',
    emoji: '👶',
    color: '#F59E0B',
    subcategories: [
      {
        slug: 'couches',
        label: 'Couches & Lingettes',
        emoji: '🍼',
        products: [
          {
            id: 'couches-t4',
            genericName: 'Couches Taille 4 ×44',
            emoji: '👶',
            variants: [
              { ean: '3086126100080', segment: 'mdd',      label: 'Marque Repère', brand: 'Marque Repère' },
              { ean: '3086126100079', segment: 'national',  label: 'Leader Marché', brand: 'Pampers Baby-Dry' },
            ],
          },
        ],
      },
    ],
  },

  {
    slug: 'entretien',
    label: 'Entretien',
    emoji: '🧺',
    color: '#8B5CF6',
    subcategories: [
      {
        slug: 'lessive',
        label: 'Lessive & Ménager',
        emoji: '🫧',
        products: [
          {
            id: 'lessive-liquide',
            genericName: 'Lessive Liquide 27 lavages',
            emoji: '🧺',
            variants: [
              { ean: '3229820129489', segment: 'mdd',      label: 'Marque Repère', brand: 'Marque Repère' },
              { ean: '3229820129488', segment: 'national',  label: 'Leader Marché', brand: 'Ariel' },
            ],
          },
        ],
      },
    ],
  },

  {
    slug: 'bio',
    label: 'Bio',
    emoji: '🌿',
    color: '#00FF88',
    subcategories: [
      {
        slug: 'epicerie-bio',
        label: 'Épicerie Bio',
        emoji: '🌾',
        products: [
          {
            id: 'pate-tartiner-bio',
            genericName: 'Pâte à tartiner Bio 750g',
            emoji: '🫙',
            variants: [
              { ean: '3760020507357', segment: 'bio', label: 'Bio Village', brand: 'Bio Village' },
            ],
          },
          {
            id: 'huile-olive-bio',
            genericName: 'Huile d\'Olive Vierge Extra Bio 500ml',
            emoji: '🫒',
            variants: [
              { ean: '3760148681234', segment: 'bio', label: 'Bio', brand: 'Jardin Bio' },
            ],
          },
        ],
      },
    ],
  },
];
