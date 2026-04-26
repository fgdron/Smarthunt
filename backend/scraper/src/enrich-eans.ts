#!/usr/bin/env tsx
/**
 * SmartHunt — Enrichissement EANs réels via Open Food Facts
 *
 * Pour chaque variante de notre catalogue (EAN mock 300000000xxxx),
 * cherche le vrai EAN dans Open Food Facts via recherche nom + marque.
 * Met à jour la base via un endpoint dédié.
 *
 * Usage :
 *   INTERNAL_API_KEY=xxx API_URL=https://xxx.railway.app npx tsx src/enrich-eans.ts
 *   --dry-run  : affiche les matchs sans modifier la DB
 *   --limit=50 : limite le nombre de variantes traitées
 */

const API_URL    = process.env.API_URL    ?? 'http://localhost:3000';
const API_KEY    = process.env.INTERNAL_API_KEY;
const OFF_BASE   = 'https://world.openfoodfacts.org/cgi/search.pl';
const DELAY_MS   = 600;
const DRY_RUN    = process.argv.includes('--dry-run');
const LIMIT_ARG  = process.argv.find(a => a.startsWith('--limit='));
const LIMIT      = LIMIT_ARG ? parseInt(LIMIT_ARG.split('=')[1]) : 0;

if (!API_KEY) { console.error('❌  INTERNAL_API_KEY manquante'); process.exit(1); }

const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));

// ─── Types ────────────────────────────────────────────────────────────────────

interface Variant {
  id:    string;
  ean:   string;
  brand: string;
  name:  string;
}

interface OFFProduct {
  code:             string;
  product_name:     string;
  brands:           string;
  quantity:         string;
  countries_tags:   string[];
  stores_tags:      string[];
}

interface OFFResponse {
  products: OFFProduct[];
  count:    number;
}

// ─── OFF search ───────────────────────────────────────────────────────────────

/**
 * Calcule un score de similarité entre deux chaînes (0-1).
 */
function similarity(a: string, b: string): number {
  const na = a.toLowerCase().trim();
  const nb = b.toLowerCase().trim();
  if (na === nb) return 1;
  if (na.includes(nb) || nb.includes(na)) return 0.8;
  const wordsA = new Set(na.split(/\s+/));
  const wordsB = new Set(nb.split(/\s+/));
  const inter  = [...wordsA].filter(w => wordsB.has(w)).length;
  return inter / Math.max(wordsA.size, wordsB.size);
}

/**
 * Cherche le vrai EAN d'un produit dans Open Food Facts.
 * Retourne le meilleur match ou null.
 */
async function searchRealEan(
  brand: string,
  name:  string,
): Promise<{ ean: string; productName: string; score: number } | null> {
  try {
    // Requête : marque + nom, filtré France
    const query = encodeURIComponent(`${brand} ${name}`.trim().slice(0, 60));
    const url   = `${OFF_BASE}?search_terms=${query}&countries_tags=en:france&json=1&page_size=10`;

    const res = await fetch(url, {
      headers: { 'User-Agent': 'SmartHunt-EanEnricher/1.0 (contact@smarthunt.app)' },
    });
    if (!res.ok) return null;

    const data = await res.json() as OFFResponse;
    if (!data.products || data.products.length === 0) return null;

    // Score chaque résultat
    const scored = data.products
      .filter(p => p.code && p.code.length >= 8 && /^\d+$/.test(p.code))
      .map(p => {
        const brandScore = similarity(brand, p.brands ?? '');
        const nameScore  = similarity(name,  p.product_name ?? '');
        return {
          ean:         p.code,
          productName: p.product_name,
          score:       (brandScore * 0.4) + (nameScore * 0.6),
        };
      })
      .sort((a, b) => b.score - a.score);

    const best = scored[0];
    return best && best.score >= 0.3 ? best : null;

  } catch {
    return null;
  }
}

// ─── API helpers ──────────────────────────────────────────────────────────────

async function apiGet(path: string): Promise<unknown> {
  const res = await fetch(`${API_URL}${path}`, {
    headers: { 'Authorization': `Bearer ${API_KEY}` },
  });
  if (!res.ok) throw new Error(`GET ${path} → ${res.status}`);
  return res.json();
}

async function apiPost(path: string, body: unknown): Promise<unknown> {
  const res = await fetch(`${API_URL}${path}`, {
    method:  'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${API_KEY}` },
    body:    JSON.stringify(body),
  });
  if (!res.ok) {
    const t = await res.text().catch(() => '');
    throw new Error(`POST ${path} → ${res.status}: ${t.slice(0, 200)}`);
  }
  return res.json();
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  console.log('═══════════════════════════════════════════════════');
  console.log('🔬 Enrichissement EANs — Open Food Facts');
  console.log(`   Mode : ${DRY_RUN ? 'DRY RUN (pas de modif DB)' : 'LIVE'}`);
  console.log('═══════════════════════════════════════════════════\n');

  // 1. Récupère les variantes avec EANs mock
  const data = await apiGet('/v1/internal/variants') as { variants: Variant[] };
  const mockVariants = data.variants.filter(v => v.ean.startsWith('300000000'));
  const targets = LIMIT > 0 ? mockVariants.slice(0, LIMIT) : mockVariants;

  console.log(`📦 ${data.variants.length} variantes en DB — ${mockVariants.length} avec EAN mock`);
  console.log(`🎯 Traitement de ${targets.length} variantes\n`);

  let matched = 0, noMatch = 0, updated = 0;
  const results: Array<{ id: string; oldEan: string; newEan: string; name: string; score: number }> = [];

  for (let i = 0; i < targets.length; i++) {
    const v = targets[i];
    await sleep(DELAY_MS);

    const match = await searchRealEan(v.brand, v.name);

    if (match) {
      matched++;
      results.push({ id: v.id, oldEan: v.ean, newEan: match.ean, name: v.name, score: match.score });
      process.stdout.write(`\r  ✓ ${i+1}/${targets.length} — ${matched} matchs, ${noMatch} sans résultat`);
    } else {
      noMatch++;
      process.stdout.write(`\r  ○ ${i+1}/${targets.length} — ${matched} matchs, ${noMatch} sans résultat`);
    }
  }

  console.log('\n');

  // 2. Affiche les résultats
  console.log('📋 Résultats (score ≥ 0.3) :');
  for (const r of results.slice(0, 20)) {
    console.log(`  ${r.score >= 0.7 ? '✅' : '⚠️ '} [${r.score.toFixed(2)}] ${r.name} : ${r.oldEan} → ${r.newEan}`);
  }
  if (results.length > 20) console.log(`  … et ${results.length - 20} autres`);

  // 3. Met à jour la DB (seulement les bons matchs, score ≥ 0.5)
  const confident = results.filter(r => r.score >= 0.5);
  console.log(`\n🎯 ${confident.length}/${results.length} matchs avec score ≥ 0.5 (fiables)`);

  if (!DRY_RUN && confident.length > 0) {
    console.log('\n📤 Mise à jour des EANs en DB…');
    try {
      const res = await apiPost('/v1/internal/update-eans', {
        updates: confident.map(r => ({ variantId: r.id, ean: r.newEan })),
      }) as { updated: number; skipped: number };
      updated = res.updated;
      console.log(`  ✅ ${updated} EANs mis à jour, ${res.skipped} ignorés (EAN déjà utilisé)`);
    } catch (err) {
      console.error('  ❌ Erreur mise à jour:', err);
    }
  } else if (DRY_RUN) {
    console.log('  ℹ️  Dry run — aucune modification en DB');
  }

  console.log('\n════════════════════════════════════════');
  console.log(`✅ Terminé : ${matched} matchs OFF / ${targets.length} variantes`);
  console.log(`   Score ≥ 0.5 : ${confident.length} | Mis à jour : ${updated}`);
  console.log('════════════════════════════════════════\n');
}

main().catch(err => { console.error('💥', err); process.exit(1); });
