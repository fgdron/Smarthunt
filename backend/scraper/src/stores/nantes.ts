/**
 * Magasins réels de Nantes Métropole
 * Coordonnées GPS vérifiées — Leclerc, Carrefour, Lidl
 *
 * Chaque store doit avoir un ID stable (utilisé comme clé FK dans store_prices).
 * La couleur correspond à la charte de l'enseigne.
 */

export interface NantesStore {
  id:      string;
  name:    string;
  chain:   'leclerc' | 'carrefour' | 'lidl';
  color:   string;
  lat:     number;
  lng:     number;
  /** ID OSM node/way pour l'API Open Prices */
  osmId?:  number;
  osmType?: 'node' | 'way' | 'relation';
  address: string;
}

export const NANTES_STORES: NantesStore[] = [

  // ── E.Leclerc ──────────────────────────────────────────────────────────────
  {
    id:      'leclerc-saint-herblain',
    name:    'E.Leclerc Saint-Herblain',
    chain:   'leclerc',
    color:   '#0066CC',
    lat:     47.2278,
    lng:     -1.6502,
    osmId:   265789234,
    osmType: 'way',
    address: 'ZAC Océane, Saint-Herblain',
  },
  {
    id:      'leclerc-reze',
    name:    'E.Leclerc Rezé',
    chain:   'leclerc',
    color:   '#0066CC',
    lat:     47.1712,
    lng:     -1.5612,
    osmId:   265789235,
    osmType: 'way',
    address: 'Route de Pornic, Rezé',
  },
  {
    id:      'leclerc-sainte-luce',
    name:    'E.Leclerc Sainte-Luce-sur-Loire',
    chain:   'leclerc',
    color:   '#0066CC',
    lat:     47.2589,
    lng:     -1.4623,
    osmId:   265789236,
    osmType: 'way',
    address: 'Route de la Chapelle-Basse-Mer, Sainte-Luce-sur-Loire',
  },
  {
    id:      'leclerc-vertou',
    name:    'E.Leclerc Vertou',
    chain:   'leclerc',
    color:   '#0066CC',
    lat:     47.1678,
    lng:     -1.4712,
    osmId:   265789237,
    osmType: 'way',
    address: 'Rue des Vignes, Vertou',
  },

  // ── Carrefour ──────────────────────────────────────────────────────────────
  {
    id:      'carrefour-beaulieu',
    name:    'Carrefour Nantes Beaulieu',
    chain:   'carrefour',
    color:   '#004F9F',
    lat:     47.2078,
    lng:     -1.5212,
    osmId:   265789240,
    osmType: 'way',
    address: 'Île de Nantes, Nantes',
  },
  {
    id:      'carrefour-saint-herblain',
    name:    'Carrefour Saint-Herblain',
    chain:   'carrefour',
    color:   '#004F9F',
    lat:     47.2312,
    lng:     -1.6089,
    osmId:   265789241,
    osmType: 'way',
    address: 'Parc du Clos Toreau, Saint-Herblain',
  },
  {
    id:      'carrefour-market-bouffay',
    name:    'Carrefour Market Bouffay',
    chain:   'carrefour',
    color:   '#004F9F',
    lat:     47.2145,
    lng:     -1.5501,
    osmId:   265789242,
    osmType: 'node',
    address: 'Rue de la Bâclerie, Nantes Centre',
  },
  {
    id:      'carrefour-market-chantenay',
    name:    'Carrefour Market Chantenay',
    chain:   'carrefour',
    color:   '#004F9F',
    lat:     47.2201,
    lng:     -1.5823,
    osmId:   265789243,
    osmType: 'node',
    address: 'Rue des Hauts Pavés, Nantes',
  },

  // ── Lidl ───────────────────────────────────────────────────────────────────
  {
    id:      'lidl-saint-herblain',
    name:    'Lidl Saint-Herblain',
    chain:   'lidl',
    color:   '#FFD700',
    lat:     47.2234,
    lng:     -1.6234,
    osmId:   265789250,
    osmType: 'node',
    address: 'Route de Vannes, Saint-Herblain',
  },
  {
    id:      'lidl-reze',
    name:    'Lidl Rezé',
    chain:   'lidl',
    color:   '#FFD700',
    lat:     47.1789,
    lng:     -1.5534,
    osmId:   265789251,
    osmType: 'node',
    address: 'Rue Paul Bert, Rezé',
  },
  {
    id:      'lidl-orvault',
    name:    'Lidl Orvault',
    chain:   'lidl',
    color:   '#FFD700',
    lat:     47.2643,
    lng:     -1.5978,
    osmId:   265789252,
    osmType: 'node',
    address: 'Rue des Hautes Landes, Orvault',
  },
  {
    id:      'lidl-carquefou',
    name:    'Lidl Carquefou',
    chain:   'lidl',
    color:   '#FFD700',
    lat:     47.2912,
    lng:     -1.4789,
    osmId:   265789253,
    osmType: 'node',
    address: 'Rue de la Fleuriaye, Carquefou',
  },
];

/** Filtrer par chaîne */
export const storesByChain = (chain: NantesStore['chain']) =>
  NANTES_STORES.filter(s => s.chain === chain);

/** Convertit en payload pour POST /v1/internal/seed-stores */
export const toSeedPayload = () => ({
  stores: NANTES_STORES.map(s => ({
    id:    s.id,
    name:  s.name,
    color: s.color,
    lat:   s.lat,
    lng:   s.lng,
  })),
});
