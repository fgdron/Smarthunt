/**
 * Tests — Panier catalogue
 * Couvre : addToBasket, removeFromBasket, updateBasketType, updateBasketQty,
 *          isInBasket, getBasketType, getBasketQty, clearBasket
 */
import { useSmartHuntStore } from '@/store/useSmartHuntStore';
import type { ProductGroup } from '@/data/productsDB';

// ── Fixture ──────────────────────────────────────────────────────────────────

const makeVariant = (type: 'mdd' | 'leader' | 'bio', brand: string, basePrice: number) => ({
  ean: `000000000${basePrice}`,
  type,
  brand,
  basePrice,
  prices: {} as any,
  price_per_unit: basePrice / 4,
  unit_ref: 'unit' as const,
  last_verified: 0,
});

const makeGroup = (overrides: Partial<ProductGroup> = {}): ProductGroup => ({
  groupId:          'grp-yogurt',
  genericName:      'Yaourt nature',
  emoji:            '🥛',
  categorySlug:     'laitages',
  subcategorySlug:  'yaourts',
  equivalence_key:  'YAOURT_NATURE',
  unit_size:        0.125,
  unit_type:        'kg',
  variants: {
    mdd:    makeVariant('mdd',    'Marque Propre', 1.20),
    leader: makeVariant('leader', 'Danone',        2.50),
  },
  ...overrides,
});

// ── Reset ─────────────────────────────────────────────────────────────────────

beforeEach(() => {
  useSmartHuntStore.setState({ userBasket: [] });
  jest.clearAllMocks();
});

// ── addToBasket ───────────────────────────────────────────────────────────────

describe('addToBasket', () => {
  it('ajoute un item avec le bon type et qty initiale à 1', () => {
    const group = makeGroup();
    useSmartHuntStore.getState().addToBasket(group, 'mdd');
    const { userBasket } = useSmartHuntStore.getState();
    expect(userBasket).toHaveLength(1);
    expect(userBasket[0].groupId).toBe('grp-yogurt');
    expect(userBasket[0].selectedType).toBe('mdd');
    expect(userBasket[0].qty).toBe(1);
  });

  it('met à jour le type si le groupId est déjà présent (pas de doublon)', () => {
    const group = makeGroup();
    useSmartHuntStore.getState().addToBasket(group, 'mdd');
    useSmartHuntStore.getState().addToBasket(group, 'leader');
    const { userBasket } = useSmartHuntStore.getState();
    expect(userBasket).toHaveLength(1);
    expect(userBasket[0].selectedType).toBe('leader');
  });

  it(`ne plante pas si le type demandé n'existe pas dans les variantes`, () => {
    const group = makeGroup(); // pas de variante 'bio'
    expect(() => useSmartHuntStore.getState().addToBasket(group, 'bio')).not.toThrow();
    expect(useSmartHuntStore.getState().userBasket).toHaveLength(0);
  });

  it('peut ajouter plusieurs groupes différents', () => {
    useSmartHuntStore.getState().addToBasket(makeGroup({ groupId: 'g1' }), 'mdd');
    useSmartHuntStore.getState().addToBasket(makeGroup({ groupId: 'g2' }), 'mdd');
    expect(useSmartHuntStore.getState().userBasket).toHaveLength(2);
  });
});

// ── removeFromBasket ──────────────────────────────────────────────────────────

describe('removeFromBasket', () => {
  it('retire le bon item', () => {
    useSmartHuntStore.getState().addToBasket(makeGroup({ groupId: 'g1' }), 'mdd');
    useSmartHuntStore.getState().addToBasket(makeGroup({ groupId: 'g2' }), 'mdd');
    useSmartHuntStore.getState().removeFromBasket('g1');
    const { userBasket } = useSmartHuntStore.getState();
    expect(userBasket).toHaveLength(1);
    expect(userBasket[0].groupId).toBe('g2');
  });

  it("ne plante pas si le groupId n'existe pas", () => {
    expect(() => useSmartHuntStore.getState().removeFromBasket('ghost')).not.toThrow();
  });
});

// ── updateBasketType ──────────────────────────────────────────────────────────

describe('updateBasketType', () => {
  it('change le type et met à jour la variante', () => {
    const group = makeGroup();
    useSmartHuntStore.getState().addToBasket(group, 'mdd');
    useSmartHuntStore.getState().updateBasketType('grp-yogurt', 'leader');
    const item = useSmartHuntStore.getState().userBasket[0];
    expect(item.selectedType).toBe('leader');
    expect(item.variant.brand).toBe('Danone');
  });

  it("ignore si le type demandé n'existe pas dans les variantes", () => {
    const group = makeGroup();
    useSmartHuntStore.getState().addToBasket(group, 'mdd');
    useSmartHuntStore.getState().updateBasketType('grp-yogurt', 'bio'); // bio n'existe pas
    expect(useSmartHuntStore.getState().userBasket[0].selectedType).toBe('mdd'); // inchangé
  });
});

// ── updateBasketQty ───────────────────────────────────────────────────────────

describe('updateBasketQty', () => {
  it('met à jour la quantité', () => {
    const group = makeGroup();
    useSmartHuntStore.getState().addToBasket(group, 'mdd');
    useSmartHuntStore.getState().updateBasketQty('grp-yogurt', 4);
    expect(useSmartHuntStore.getState().userBasket[0].qty).toBe(4);
  });

  it('clamp à 1 minimum', () => {
    const group = makeGroup();
    useSmartHuntStore.getState().addToBasket(group, 'mdd');
    useSmartHuntStore.getState().updateBasketQty('grp-yogurt', 0);
    expect(useSmartHuntStore.getState().userBasket[0].qty).toBe(1);
    useSmartHuntStore.getState().updateBasketQty('grp-yogurt', -5);
    expect(useSmartHuntStore.getState().userBasket[0].qty).toBe(1);
  });

  it('clamp à 99 maximum', () => {
    const group = makeGroup();
    useSmartHuntStore.getState().addToBasket(group, 'mdd');
    useSmartHuntStore.getState().updateBasketQty('grp-yogurt', 200);
    expect(useSmartHuntStore.getState().userBasket[0].qty).toBe(99);
  });
});

// ── isInBasket / getBasketType / getBasketQty ─────────────────────────────────

describe('sélecteurs panier', () => {
  it('isInBasket retourne true/false correctement', () => {
    const group = makeGroup();
    expect(useSmartHuntStore.getState().isInBasket('grp-yogurt')).toBe(false);
    useSmartHuntStore.getState().addToBasket(group, 'mdd');
    expect(useSmartHuntStore.getState().isInBasket('grp-yogurt')).toBe(true);
  });

  it('getBasketType retourne le type courant ou null', () => {
    const group = makeGroup();
    expect(useSmartHuntStore.getState().getBasketType('grp-yogurt')).toBeNull();
    useSmartHuntStore.getState().addToBasket(group, 'leader');
    expect(useSmartHuntStore.getState().getBasketType('grp-yogurt')).toBe('leader');
  });

  it('getBasketQty retourne 1 par défaut si absent, la vraie valeur sinon', () => {
    const group = makeGroup();
    expect(useSmartHuntStore.getState().getBasketQty('grp-yogurt')).toBe(1);
    useSmartHuntStore.getState().addToBasket(group, 'mdd');
    useSmartHuntStore.getState().updateBasketQty('grp-yogurt', 3);
    expect(useSmartHuntStore.getState().getBasketQty('grp-yogurt')).toBe(3);
  });
});

// ── clearBasket ───────────────────────────────────────────────────────────────

describe('clearBasket', () => {
  it('vide entièrement le panier', () => {
    useSmartHuntStore.getState().addToBasket(makeGroup({ groupId: 'g1' }), 'mdd');
    useSmartHuntStore.getState().addToBasket(makeGroup({ groupId: 'g2' }), 'mdd');
    useSmartHuntStore.getState().clearBasket();
    expect(useSmartHuntStore.getState().userBasket).toHaveLength(0);
  });

  it('ne plante pas si panier déjà vide', () => {
    expect(() => useSmartHuntStore.getState().clearBasket()).not.toThrow();
  });
});
