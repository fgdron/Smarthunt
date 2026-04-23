/**
 * Tests — Hunt list (legacy ODR flow)
 * Couvre : addToHunt, removeFromHunt, isInHunt, markPurchased, claimCashback, requestTransfer
 */
import { useSmartHuntStore } from '@/store/useSmartHuntStore';
import type { Optimization } from '@/data/mockData';

// ── Fixture ──────────────────────────────────────────────────────────────────

const makeOpt = (overrides: Partial<Optimization> = {}): Optimization => ({
  id: 'test-001',
  ean: '0000000000001',
  name: 'Produit Test',
  brand: 'BrandTest',
  category: 'Test',
  emoji: '🧪',
  stores: [{ name: 'Leclerc', basePrice: 5.00, promoPrice: 3.00 }],
  odr: { source: 'Shopmium', cashback: 2.00, expiresAt: '2027-12-31', logoColor: '#FF0000' },
  bestStore: 'Leclerc',
  basePrice: 5.00,
  promoPrice: 3.00,
  finalPrice: 1.00,
  savings: 4.00,
  savingsPercent: 80,
  isCumulMax: true,
  tags: [],
  ...overrides,
});

// ── Reset store avant chaque test ────────────────────────────────────────────

beforeEach(() => {
  useSmartHuntStore.setState({
    huntList:          [],
    totalSavings:      0,
    pendingCashback:   0,
    availableCashback: 0,
  });
  jest.clearAllMocks();
});

// ── addToHunt ─────────────────────────────────────────────────────────────────

describe('addToHunt', () => {
  it('ajoute un item à la huntList', () => {
    const opt = makeOpt();
    useSmartHuntStore.getState().addToHunt(opt);
    const { huntList } = useSmartHuntStore.getState();
    expect(huntList).toHaveLength(1);
    expect(huntList[0].optimization.id).toBe('test-001');
    expect(huntList[0].purchased).toBe(false);
    expect(huntList[0].cashbackClaimed).toBe(false);
  });

  it("n'ajoute pas deux fois le même item (idempotent)", () => {
    const opt = makeOpt();
    useSmartHuntStore.getState().addToHunt(opt);
    useSmartHuntStore.getState().addToHunt(opt);
    expect(useSmartHuntStore.getState().huntList).toHaveLength(1);
  });

  it('peut ajouter plusieurs items différents', () => {
    useSmartHuntStore.getState().addToHunt(makeOpt({ id: 'a' }));
    useSmartHuntStore.getState().addToHunt(makeOpt({ id: 'b' }));
    useSmartHuntStore.getState().addToHunt(makeOpt({ id: 'c' }));
    expect(useSmartHuntStore.getState().huntList).toHaveLength(3);
  });
});

// ── removeFromHunt ────────────────────────────────────────────────────────────

describe('removeFromHunt', () => {
  it('retire un item existant', () => {
    useSmartHuntStore.getState().addToHunt(makeOpt());
    useSmartHuntStore.getState().removeFromHunt('test-001');
    expect(useSmartHuntStore.getState().huntList).toHaveLength(0);
  });

  it("ne plante pas si l'item n'existe pas", () => {
    expect(() => useSmartHuntStore.getState().removeFromHunt('ghost-id')).not.toThrow();
  });

  it('ne retire que le bon item (autres items intacts)', () => {
    useSmartHuntStore.getState().addToHunt(makeOpt({ id: 'a' }));
    useSmartHuntStore.getState().addToHunt(makeOpt({ id: 'b' }));
    useSmartHuntStore.getState().removeFromHunt('a');
    const { huntList } = useSmartHuntStore.getState();
    expect(huntList).toHaveLength(1);
    expect(huntList[0].optimization.id).toBe('b');
  });
});

// ── isInHunt ──────────────────────────────────────────────────────────────────

describe('isInHunt', () => {
  it('retourne true si présent', () => {
    useSmartHuntStore.getState().addToHunt(makeOpt());
    expect(useSmartHuntStore.getState().isInHunt('test-001')).toBe(true);
  });

  it('retourne false si absent', () => {
    expect(useSmartHuntStore.getState().isInHunt('not-there')).toBe(false);
  });

  it('retourne false après suppression', () => {
    useSmartHuntStore.getState().addToHunt(makeOpt());
    useSmartHuntStore.getState().removeFromHunt('test-001');
    expect(useSmartHuntStore.getState().isInHunt('test-001')).toBe(false);
  });
});

// ── markPurchased ─────────────────────────────────────────────────────────────

describe('markPurchased', () => {
  it('marque un item comme acheté', () => {
    useSmartHuntStore.getState().addToHunt(makeOpt());
    useSmartHuntStore.getState().markPurchased('test-001');
    const item = useSmartHuntStore.getState().huntList[0];
    expect(item.purchased).toBe(true);
  });

  it('incrémente pendingCashback du montant ODR', () => {
    useSmartHuntStore.setState({ pendingCashback: 0 });
    useSmartHuntStore.getState().addToHunt(makeOpt({ odr: { source: 'Shopmium', cashback: 2.50, expiresAt: '2027-12-31', logoColor: '#F00' } }));
    useSmartHuntStore.getState().markPurchased('test-001');
    expect(useSmartHuntStore.getState().pendingCashback).toBeCloseTo(2.50);
  });
});

// ── claimCashback ─────────────────────────────────────────────────────────────

describe('claimCashback', () => {
  it('transfère le cashback de pending vers available après claim', () => {
    useSmartHuntStore.setState({ pendingCashback: 5.00, availableCashback: 10.00 });
    useSmartHuntStore.getState().addToHunt(makeOpt({ odr: { source: 'Shopmium', cashback: 3.00, expiresAt: '2027-12-31', logoColor: '#F00' } }));
    // D'abord marquer comme acheté
    useSmartHuntStore.getState().markPurchased('test-001');
    useSmartHuntStore.setState({ pendingCashback: 3.00 }); // reset propre pour le test
    useSmartHuntStore.getState().claimCashback('test-001');
    const { pendingCashback, availableCashback } = useSmartHuntStore.getState();
    expect(pendingCashback).toBeCloseTo(0);
    expect(availableCashback).toBeCloseTo(13.00);
  });

  it("ne claim pas si l'item n'est pas acheté", () => {
    useSmartHuntStore.setState({ availableCashback: 10.00 });
    useSmartHuntStore.getState().addToHunt(makeOpt());
    useSmartHuntStore.getState().claimCashback('test-001'); // pas purchased
    expect(useSmartHuntStore.getState().availableCashback).toBe(10.00);
  });

  it('ne claim pas deux fois (idempotent)', () => {
    useSmartHuntStore.setState({ pendingCashback: 2.00, availableCashback: 0 });
    useSmartHuntStore.getState().addToHunt(makeOpt());
    useSmartHuntStore.getState().markPurchased('test-001');
    useSmartHuntStore.setState({ pendingCashback: 2.00 });
    useSmartHuntStore.getState().claimCashback('test-001');
    const availableAfterFirst = useSmartHuntStore.getState().availableCashback;
    useSmartHuntStore.getState().claimCashback('test-001');
    expect(useSmartHuntStore.getState().availableCashback).toBe(availableAfterFirst);
  });
});

// ── requestTransfer ───────────────────────────────────────────────────────────

describe('requestTransfer', () => {
  it('remet availableCashback à 0 si >= 20€', () => {
    useSmartHuntStore.setState({ availableCashback: 25.00 });
    useSmartHuntStore.getState().requestTransfer();
    expect(useSmartHuntStore.getState().availableCashback).toBe(0);
  });

  it("ne fait rien si availableCashback < 20€", () => {
    useSmartHuntStore.setState({ availableCashback: 15.00 });
    useSmartHuntStore.getState().requestTransfer();
    expect(useSmartHuntStore.getState().availableCashback).toBe(15.00);
  });

  it('accepte exactement 20€', () => {
    useSmartHuntStore.setState({ availableCashback: 20.00 });
    useSmartHuntStore.getState().requestTransfer();
    expect(useSmartHuntStore.getState().availableCashback).toBe(0);
  });
});
