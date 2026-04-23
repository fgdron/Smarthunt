export interface Store {
  name: 'Leclerc' | 'Carrefour' | 'Intermarché';
  basePrice: number;
  promoPrice?: number;
  promoLabel?: string;
}

export interface ODR {
  source: 'Shopmium' | 'Coupon Network' | 'Poulpeo' | 'Remise directe';
  cashback: number;
  expiresAt: string;
  logoColor: string;
}

export interface Optimization {
  id: string;
  ean: string;
  name: string;
  brand: string;
  category: string;
  emoji: string;
  stores: Store[];
  odr?: ODR;
  bestStore: Store['name'];
  basePrice: number;
  promoPrice: number;
  finalPrice: number;
  savings: number;
  savingsPercent: number;
  isCumulMax: boolean;
  tags: string[];
}

export const MOCK_OPTIMIZATIONS: Optimization[] = [
  {
    id: '001',
    ean: '3045320094084',
    name: 'Nutella Pâte à tartiner',
    brand: 'Ferrero',
    category: 'Épicerie sucrée',
    emoji: '🫙',
    stores: [
      { name: 'Leclerc', basePrice: 5.99, promoPrice: 3.95, promoLabel: '-34% immédiat' },
      { name: 'Carrefour', basePrice: 6.19 },
      { name: 'Intermarché', basePrice: 5.89, promoPrice: 4.71, promoLabel: '-20%' },
    ],
    odr: { source: 'Shopmium', cashback: 2.00, expiresAt: '2026-05-15', logoColor: '#FF3B5C' },
    bestStore: 'Leclerc',
    basePrice: 5.99,
    promoPrice: 3.95,
    finalPrice: 1.95,
    savings: 4.04,
    savingsPercent: 67,
    isCumulMax: true,
    tags: ['CUMUL MAX', 'Expire bientôt'],
  },
  {
    id: '002',
    ean: '7613036018838',
    name: 'Nescafé Dolce Gusto Lungo',
    brand: 'Nescafé',
    category: 'Café & Thé',
    emoji: '☕',
    stores: [
      { name: 'Leclerc', basePrice: 8.49, promoPrice: 5.09, promoLabel: '-40% immédiat' },
      { name: 'Carrefour', basePrice: 8.99, promoPrice: 6.29, promoLabel: '-30%' },
      { name: 'Intermarché', basePrice: 8.29 },
    ],
    odr: { source: 'Coupon Network', cashback: 3.00, expiresAt: '2026-06-01', logoColor: '#0055B8' },
    bestStore: 'Leclerc',
    basePrice: 8.49,
    promoPrice: 5.09,
    finalPrice: 2.09,
    savings: 6.40,
    savingsPercent: 75,
    isCumulMax: true,
    tags: ['CUMUL MAX', 'TOP AFFAIRE'],
  },
  {
    id: '003',
    ean: '3017620425035',
    name: 'Activia Yaourt Nature',
    brand: 'Danone',
    category: 'Produits laitiers',
    emoji: '🫙',
    stores: [
      { name: 'Intermarché', basePrice: 3.19, promoPrice: 2.23, promoLabel: '-30%' },
      { name: 'Leclerc', basePrice: 2.99 },
      { name: 'Carrefour', basePrice: 3.29, promoPrice: 2.47, promoLabel: '-25%' },
    ],
    odr: { source: 'Poulpeo', cashback: 1.50, expiresAt: '2026-04-30', logoColor: '#00C4B0' },
    bestStore: 'Intermarché',
    basePrice: 3.19,
    promoPrice: 2.23,
    finalPrice: 0.73,
    savings: 2.46,
    savingsPercent: 77,
    isCumulMax: true,
    tags: ['CUMUL MAX', 'PRESQUE GRATUIT'],
  },
  {
    id: '004',
    ean: '5000112637441',
    name: "Coca-Cola Original 1,5L",
    brand: 'Coca-Cola',
    category: 'Boissons',
    emoji: '🥤',
    stores: [
      { name: 'Carrefour', basePrice: 2.09, promoPrice: 1.26, promoLabel: '-40%' },
      { name: 'Leclerc', basePrice: 1.99, promoPrice: 1.59, promoLabel: '-20%' },
      { name: 'Intermarché', basePrice: 2.19 },
    ],
    odr: { source: 'Shopmium', cashback: 0.80, expiresAt: '2026-05-20', logoColor: '#FF3B5C' },
    bestStore: 'Carrefour',
    basePrice: 2.09,
    promoPrice: 1.26,
    finalPrice: 0.46,
    savings: 1.63,
    savingsPercent: 78,
    isCumulMax: true,
    tags: ['CUMUL MAX', 'PRESQUE GRATUIT'],
  },
  {
    id: '005',
    ean: '3228857000166',
    name: 'Elle & Vire Beurre Doux',
    brand: 'Elle & Vire',
    category: 'Produits laitiers',
    emoji: '🧈',
    stores: [
      { name: 'Leclerc', basePrice: 3.49, promoPrice: 2.44, promoLabel: '-30%' },
      { name: 'Carrefour', basePrice: 3.59 },
      { name: 'Intermarché', basePrice: 3.39, promoPrice: 2.71, promoLabel: '-20%' },
    ],
    bestStore: 'Leclerc',
    basePrice: 3.49,
    promoPrice: 2.44,
    finalPrice: 2.44,
    savings: 1.05,
    savingsPercent: 30,
    isCumulMax: false,
    tags: ['PROMO CATALOGUE'],
  },
  {
    id: '006',
    ean: '3086126100079',
    name: 'Pampers Baby-Dry T4 x44',
    brand: 'Pampers',
    category: 'Bébé',
    emoji: '👶',
    stores: [
      { name: 'Carrefour', basePrice: 16.99, promoPrice: 11.89, promoLabel: '-30%' },
      { name: 'Leclerc', basePrice: 15.99, promoPrice: 12.79, promoLabel: '-20%' },
      { name: 'Intermarché', basePrice: 16.49 },
    ],
    odr: { source: 'Coupon Network', cashback: 5.00, expiresAt: '2026-05-31', logoColor: '#0055B8' },
    bestStore: 'Carrefour',
    basePrice: 16.99,
    promoPrice: 11.89,
    finalPrice: 6.89,
    savings: 10.10,
    savingsPercent: 59,
    isCumulMax: true,
    tags: ['CUMUL MAX', 'GROSSE ÉCONOMIE'],
  },
  {
    id: '007',
    ean: '8000500310427',
    name: 'Barilla Spaghetti n°5 500g',
    brand: 'Barilla',
    category: 'Épicerie salée',
    emoji: '🍝',
    stores: [
      { name: 'Intermarché', basePrice: 1.79, promoPrice: 1.07, promoLabel: '-40%' },
      { name: 'Leclerc', basePrice: 1.69, promoPrice: 1.35, promoLabel: '-20%' },
      { name: 'Carrefour', basePrice: 1.89 },
    ],
    odr: { source: 'Shopmium', cashback: 0.80, expiresAt: '2026-05-10', logoColor: '#FF3B5C' },
    bestStore: 'Intermarché',
    basePrice: 1.79,
    promoPrice: 1.07,
    finalPrice: 0.27,
    savings: 1.52,
    savingsPercent: 85,
    isCumulMax: true,
    tags: ['CUMUL MAX', 'PRESQUE GRATUIT', 'TOP AFFAIRE'],
  },
  {
    id: '008',
    ean: '3760020507350',
    name: "Häagen-Dazs Vanille Macadamia",
    brand: "Häagen-Dazs",
    category: 'Surgelés',
    emoji: '🍨',
    stores: [
      { name: 'Leclerc', basePrice: 7.49, promoPrice: 4.49, promoLabel: '-40%' },
      { name: 'Carrefour', basePrice: 7.99, promoPrice: 5.59, promoLabel: '-30%' },
      { name: 'Intermarché', basePrice: 7.29 },
    ],
    odr: { source: 'Poulpeo', cashback: 2.50, expiresAt: '2026-04-28', logoColor: '#00C4B0' },
    bestStore: 'Leclerc',
    basePrice: 7.49,
    promoPrice: 4.49,
    finalPrice: 1.99,
    savings: 5.50,
    savingsPercent: 73,
    isCumulMax: true,
    tags: ['CUMUL MAX', 'Expire demain'],
  },
  {
    id: '009',
    ean: '3029330003533',
    name: 'Président Crème Fraîche Épaisse',
    brand: 'Président',
    category: 'Produits laitiers',
    emoji: '🥛',
    stores: [
      { name: 'Carrefour', basePrice: 1.89, promoPrice: 1.32, promoLabel: '-30%' },
      { name: 'Leclerc', basePrice: 1.79 },
      { name: 'Intermarché', basePrice: 1.95, promoPrice: 1.56, promoLabel: '-20%' },
    ],
    bestStore: 'Carrefour',
    basePrice: 1.89,
    promoPrice: 1.32,
    finalPrice: 1.32,
    savings: 0.57,
    savingsPercent: 30,
    isCumulMax: false,
    tags: ['PROMO CATALOGUE'],
  },
  {
    id: '010',
    ean: '3229820129488',
    name: 'Ariel Liquide 1,98L x27 lavages',
    brand: 'Ariel',
    category: 'Entretien',
    emoji: '🧺',
    stores: [
      { name: 'Leclerc', basePrice: 12.99, promoPrice: 7.79, promoLabel: '-40% immédiat' },
      { name: 'Carrefour', basePrice: 13.49, promoPrice: 9.44, promoLabel: '-30%' },
      { name: 'Intermarché', basePrice: 12.49 },
    ],
    odr: { source: 'Coupon Network', cashback: 4.00, expiresAt: '2026-06-15', logoColor: '#0055B8' },
    bestStore: 'Leclerc',
    basePrice: 12.99,
    promoPrice: 7.79,
    finalPrice: 3.79,
    savings: 9.20,
    savingsPercent: 71,
    isCumulMax: true,
    tags: ['CUMUL MAX', 'GROSSE ÉCONOMIE'],
  },
  {
    id: '011',
    ean: '4056489059356',
    name: 'Milka Amandes Caramel 100g',
    brand: 'Milka',
    category: 'Confiserie',
    emoji: '🍫',
    stores: [
      { name: 'Intermarché', basePrice: 1.99, promoPrice: 1.19, promoLabel: '-40%' },
      { name: 'Leclerc', basePrice: 1.89, promoPrice: 1.51, promoLabel: '-20%' },
      { name: 'Carrefour', basePrice: 2.09 },
    ],
    odr: { source: 'Shopmium', cashback: 0.80, expiresAt: '2026-05-05', logoColor: '#FF3B5C' },
    bestStore: 'Intermarché',
    basePrice: 1.99,
    promoPrice: 1.19,
    finalPrice: 0.39,
    savings: 1.60,
    savingsPercent: 80,
    isCumulMax: true,
    tags: ['CUMUL MAX', 'PRESQUE GRATUIT'],
  },
  {
    id: '012',
    ean: '3155250354073',
    name: 'Huile Isio 4 Lesieur 1L',
    brand: 'Lesieur',
    category: 'Épicerie',
    emoji: '🫙',
    stores: [
      { name: 'Leclerc', basePrice: 4.49, promoPrice: 2.69, promoLabel: '-40%' },
      { name: 'Carrefour', basePrice: 4.69, promoPrice: 3.52, promoLabel: '-25%' },
      { name: 'Intermarché', basePrice: 4.39 },
    ],
    odr: { source: 'Remise directe', cashback: 1.50, expiresAt: '2026-05-25', logoColor: '#FF6B35' },
    bestStore: 'Leclerc',
    basePrice: 4.49,
    promoPrice: 2.69,
    finalPrice: 1.19,
    savings: 3.30,
    savingsPercent: 73,
    isCumulMax: true,
    tags: ['CUMUL MAX'],
  },
];

export interface CommunityReport {
  id: string;
  store: Store['name'];
  city: string;
  discount: string;
  description: string;
  reportedAt: string;
  upvotes: number;
  emoji: string;
}

export const COMMUNITY_REPORTS: CommunityReport[] = [
  {
    id: 'r001',
    store: 'Leclerc',
    city: 'Nantes',
    discount: '-50%',
    description: 'Bac anti-gaspi : pains spéciaux, fromages, charcuterie',
    reportedAt: '2026-04-21T08:32:00Z',
    upvotes: 47,
    emoji: '🥖',
  },
  {
    id: 'r002',
    store: 'Carrefour',
    city: 'Lyon',
    discount: '-60%',
    description: 'Rayon frais : yoghourts et desserts, DLC demain',
    reportedAt: '2026-04-21T09:15:00Z',
    upvotes: 31,
    emoji: '🍮',
  },
  {
    id: 'r003',
    store: 'Intermarché',
    city: 'Bordeaux',
    discount: '-70%',
    description: 'Viandes et volailles en bac rouge, excellente qualité',
    reportedAt: '2026-04-21T07:55:00Z',
    upvotes: 89,
    emoji: '🥩',
  },
];

export const HUNTER_BADGES = [
  { id: 'b1', name: 'Chasseur Débutant',   icon: 'Target',    threshold: 0,   color: '#8A8A9A' },
  { id: 'b2', name: 'Chasseur Confirmé',   icon: 'Crosshair', threshold: 20,  color: '#CD7F32' },
  { id: 'b3', name: 'Chasseur Expert',     icon: 'Zap',       threshold: 50,  color: '#C0C0C0' },
  { id: 'b4', name: 'Chasseur Élite',      icon: 'Flame',     threshold: 100, color: '#FFD700' },
  { id: 'b5', name: 'Chasseur Légendaire', icon: 'Gem',       threshold: 200, color: '#00B4FF' },
];
