// ============================================================
// Tests de la fonction calculateBestShoppingStrategy
// Exécuter avec : npx ts-node engine/shoppingStrategy.test.ts
// ============================================================

import { calculateBestShoppingStrategy } from './shoppingStrategy';
import { BasketItem, UserLocation } from './types';

// ── Localisation utilisateur (Nantes centre) ──
const USER_LOCATION: UserLocation = {
  lat: 47.2184,
  lng: -1.5536,
  radius_km: 20,
};

// ── Panier de test : mélange de tous les cas ──
const TEST_BASKET: BasketItem[] = [
  { ean: '3045320094084', qty: 1 },  // Nutella        → CUMUL MAX Leclerc
  { ean: '7613036018838', qty: 1 },  // Nescafé        → CUMUL MAX Leclerc
  { ean: '3017620425035', qty: 2 },  // Activia x8     → CUMUL MAX Intermarché
  { ean: '5000112637441', qty: 3 },  // Coca-Cola 1,5L → CUMUL MAX Carrefour
  { ean: '3229820129488', qty: 1 },  // Ariel          → CUMUL MAX Leclerc
  { ean: '8000500310427', qty: 2 },  // Barilla        → CUMUL MAX Intermarché
  { ean: '3086126100079', qty: 1 },  // Pampers T4     → CUMUL MAX Carrefour
  { ean: '3228857000166', qty: 1 },  // Beurre E&V     → Promo seule Leclerc
  { ean: '3574661680568', qty: 1 },  // Head&Shoulders → Cashback seul
  { ean: '3245413410021', qty: 2 },  // Pâtes Repère   → MDD, pas de promo
  { ean: '3245680010120', qty: 1 },  // Lait Repère    → MDD, pas de promo
  { ean: '3250390034560', qty: 1 },  // Riz MDD        → MDD, pas de promo
];

function section(title: string) {
  console.log('\n' + '═'.repeat(60));
  console.log(`  ${title}`);
  console.log('═'.repeat(60));
}

function line(label: string, value: string | number) {
  const v = typeof value === 'number' ? `${value.toFixed(2)} €` : value;
  console.log(`  ${label.padEnd(38)} ${v}`);
}

// ── Exécution ──

const result = calculateBestShoppingStrategy(TEST_BASKET, USER_LOCATION);

section('ENSEIGNES PROCHES DÉTECTÉES');
for (const loc of result.nearby_stores) {
  console.log(`  📍 ${loc.name} (${loc.store.slug}) — ${loc.distance_km} km`);
}

// ── Scénario Mono-magasin ──
section('SCÉNARIO 1 — MONO-MAGASIN');
const mono = result.mono_store;
const monoStore = mono.stores[0];
console.log(`  Meilleure enseigne : ${monoStore.store_name}`);
line('Total prix de base',  mono.total_base);
line('Économies catalogue', mono.total_promo_savings);
line('Cashback ODR',        mono.total_cashback);
line('TOTAL NET-NET',       mono.total_final);
line('Économie totale',     `${mono.total_savings.toFixed(2)} € (-${mono.savings_percent}%)`);

console.log('\n  Détail des articles :');
for (const item of monoStore.items) {
  const flags = [
    item.is_cumul_max ? '🟢 CUMUL MAX' : '',
    item.promo_label  ? `📋 ${item.promo_label}` : '',
    item.cashback     ? `💸 -${item.cashback.amount.toFixed(2)}€ ${item.cashback.partner}` : '',
    item.bio_switch?.recommended ? `🌿 Switch Bio possible` : '',
  ].filter(Boolean).join(' ');
  console.log(`    ${item.name.padEnd(35)} ${item.base_price.toFixed(2)}€ → ${item.final_price.toFixed(2)}€  ${flags}`);
}

if (mono.unavailable_items.length > 0) {
  console.log('\n  ⚠️  Articles indisponibles dans cette enseigne :');
  mono.unavailable_items.forEach(u => console.log(`    - ${u.name}`));
}

// ── Scénario Multi-magasins ──
section('SCÉNARIO 2 — MULTI-MAGASINS (NET-NET ABSOLU)');
const multi = result.multi_store;
line('Total prix de base',  multi.total_base);
line('Économies catalogue', multi.total_promo_savings);
line('Cashback ODR',        multi.total_cashback);
line('TOTAL NET-NET',       multi.total_final);
line('Économie totale',     `${multi.total_savings.toFixed(2)} € (-${multi.savings_percent}%)`);

for (const group of multi.stores) {
  console.log(`\n  🏪 ${group.store_name} (${group.items_in_stock} articles — ${group.subtotal_final.toFixed(2)} €)`);
  for (const item of group.items) {
    const flags = [
      item.is_cumul_max ? 'CUMUL MAX' : '',
      item.cashback     ? `+cashback ${item.cashback.amount.toFixed(2)}€` : '',
    ].filter(Boolean).join(', ');
    console.log(`    [ ] ${item.name.padEnd(35)} Net: ${item.final_price.toFixed(2)} €  ${flags}`);
  }
}

// ── Comparatif ──
section('COMPARATIF DES SCÉNARIOS');
line('Total Mono-magasin',      mono.total_final);
line('Total Multi-magasins',    multi.total_final);
line('Gain supplémentaire multi', result.multi_store_extra_savings);
console.log(`\n  ✅ Scénario recommandé : ${result.recommended_scenario.replace('_', '-').toUpperCase()}`);
if (result.recommended_scenario === 'mono_store') {
  console.log(`     (Le gain multi de ${result.multi_store_extra_savings.toFixed(2)}€ ne justifie pas un 2ème déplacement)`);
}

// ── Bio Switch ──
const allBioSwitches = [
  ...mono.bio_switches,
  ...multi.bio_switches.filter(b => !mono.bio_switches.find(m => m.bio_ean === b.bio_ean)),
];

if (allBioSwitches.length > 0) {
  section('🌿 SUGGESTIONS BIO SWITCH');
  for (const sw of allBioSwitches) {
    const delta = sw.price_delta <= 0 ? `${Math.abs(sw.price_delta).toFixed(2)}€ MOINS CHER` : `+${sw.price_delta.toFixed(2)}€ seulement`;
    console.log(`  ${sw.bio_name}`);
    console.log(`    Prix conventionnel net : ${sw.conventional_final_price.toFixed(2)} €`);
    console.log(`    Prix bio net           : ${sw.bio_final_price.toFixed(2)} € (${delta})`);
    console.log(`    Disponible chez        : ${sw.bio_best_store}`);
    console.log(`    Recommandé             : ${sw.recommended ? '✅ OUI' : '❌ trop cher'}`);
    console.log();
  }
}

// ── JSON brut pour l'API ──
section('OBJET JSON RETOURNÉ (extrait)');
const preview = {
  recommended_scenario: result.recommended_scenario,
  multi_store_extra_savings: result.multi_store_extra_savings,
  mono_store: {
    total_base: result.mono_store.total_base,
    total_final: result.mono_store.total_final,
    total_savings: result.mono_store.total_savings,
    savings_percent: result.mono_store.savings_percent,
    stores: result.mono_store.stores.map(s => ({
      store_name: s.store_name,
      subtotal_final: s.subtotal_final,
      items_count: s.items.length,
    })),
  },
  multi_store: {
    total_base: result.multi_store.total_base,
    total_final: result.multi_store.total_final,
    total_savings: result.multi_store.total_savings,
    savings_percent: result.multi_store.savings_percent,
    stores: result.multi_store.stores.map(s => ({
      store_name: s.store_name,
      subtotal_final: s.subtotal_final,
      items_count: s.items.length,
    })),
  },
  bio_switches_recommended: allBioSwitches.filter(s => s.recommended).length,
};
console.log(JSON.stringify(preview, null, 2));
