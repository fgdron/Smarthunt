/**
 * Admin Dashboard — SmartHunt Centre de Contrôle v2
 *
 * GET /admin          → Dashboard HTML (protégé Basic Auth)
 * GET /v1/admin/stats → Métriques JSON (protégé Basic Auth)
 *
 * Variables d'env :
 *   ADMIN_USERNAME  (défaut : "admin")
 *   ADMIN_PASSWORD  (défaut : "smarthunt2024")
 */

import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';

// ─── Auth ─────────────────────────────────────────────────────────────────────

function checkBasicAuth(request: FastifyRequest, reply: FastifyReply): boolean {
  const expectedUser = process.env.ADMIN_USERNAME ?? 'admin';
  const expectedPass = process.env.ADMIN_PASSWORD ?? 'smarthunt2024';
  const expected     = Buffer.from(`${expectedUser}:${expectedPass}`).toString('base64');
  const auth         = request.headers['authorization'] ?? '';
  if (!auth.startsWith('Basic ') || auth.slice(6) !== expected) {
    reply.status(401).header('WWW-Authenticate', 'Basic realm="SmartHunt Admin"').send('Accès non autorisé');
    return false;
  }
  return true;
}

// ─── Safe query helpers ───────────────────────────────────────────────────────

async function sq<T>(pool: FastifyInstance['pool'], sql: string, fallback: T): Promise<T> {
  try { const r = await pool.query(sql); return (r.rows[0] ?? fallback) as T; } catch { return fallback; }
}
async function sqRows<T>(pool: FastifyInstance['pool'], sql: string): Promise<T[]> {
  try { const r = await pool.query(sql); return r.rows as T[]; } catch { return []; }
}

// ─── Stats ────────────────────────────────────────────────────────────────────

async function fetchStats(pool: FastifyInstance['pool']) {
  const [
    catalogue, segments, priceStats, pricesByStore,
    promos, promosByType,
    offers, offersByProvider,
    community, recentReports, communityByStore,
    activity7d, activity30d,
    topCategories,
  ] = await Promise.all([

    // ── Catalogue global
    sq(pool, `
      SELECT
        (SELECT COUNT(*)::int FROM product_groups)   AS groups,
        (SELECT COUNT(*)::int FROM product_variants) AS variants,
        (SELECT COUNT(*)::int FROM store_prices)     AS prices,
        (SELECT TO_CHAR(MAX("updatedAt"), 'DD/MM/YYYY HH24:MI') FROM store_prices) AS last_price_update,
        (SELECT COUNT(DISTINCT "storeId")::int FROM store_prices) AS stores_with_prices,
        (SELECT COUNT(DISTINCT "groupId")::int FROM product_variants pv
         JOIN store_prices sp ON pv.id = sp."variantId") AS groups_with_prices
    `, { groups:0, variants:0, prices:0, last_price_update:null, stores_with_prices:0, groups_with_prices:0 }),

    // ── Répartition par segment
    sqRows(pool, `
      SELECT segment, COUNT(*)::int AS count
      FROM product_variants
      GROUP BY segment ORDER BY count DESC
    `),

    // ── Stats prix
    sq(pool, `
      SELECT
        ROUND(MIN(price)::numeric,2)  AS min_price,
        ROUND(MAX(price)::numeric,2)  AS max_price,
        ROUND(AVG(price)::numeric,2)  AS avg_price,
        ROUND(PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY price)::numeric,2) AS median_price
      FROM store_prices
    `, { min_price:0, max_price:0, avg_price:0, median_price:0 }),

    // ── Prix par enseigne
    sqRows(pool, `
      SELECT
        s.name, s.color,
        COUNT(sp.id)::int                         AS price_count,
        ROUND(AVG(sp.price)::numeric,2)           AS avg_price,
        ROUND(MIN(sp.price)::numeric,2)           AS min_price,
        ROUND(MAX(sp.price)::numeric,2)           AS max_price,
        COUNT(*) FILTER (WHERE sp."inStock" = true)::int  AS in_stock,
        COUNT(*) FILTER (WHERE sp."inStock" = false)::int AS out_of_stock,
        TO_CHAR(MAX(sp."updatedAt"), 'DD/MM HH24:MI')     AS last_update
      FROM stores s
      LEFT JOIN store_prices sp ON s.id = sp."storeId"
      GROUP BY s.id, s.name, s.color
      ORDER BY price_count DESC
    `),

    // ── Promos catalogue global
    sq(pool, `
      SELECT
        COUNT(*)::int AS total,
        COUNT(*) FILTER (WHERE "validUntil" IS NULL OR "validUntil" > NOW())::int AS active,
        ROUND(AVG(value) FILTER (WHERE type='percent')::numeric,1)   AS avg_pct,
        ROUND(AVG(value) FILTER (WHERE type='immediate')::numeric,2) AS avg_immediate,
        COUNT(*) FILTER (WHERE type='percent')::int   AS type_percent,
        COUNT(*) FILTER (WHERE type='immediate')::int AS type_immediate,
        COUNT(*) FILTER (WHERE type='volume')::int    AS type_volume,
        COUNT(*) FILTER (WHERE type='bundle')::int    AS type_bundle
      FROM catalogue_promos
    `, { total:0, active:0, avg_pct:null, avg_immediate:null, type_percent:0, type_immediate:0, type_volume:0, type_bundle:0 }),

    // ── Promos par store
    sqRows(pool, `
      SELECT
        cp.store,
        COUNT(*)::int AS count,
        ROUND(AVG(cp.value) FILTER (WHERE cp.type='percent')::numeric,1) AS avg_pct
      FROM catalogue_promos cp
      WHERE "validUntil" IS NULL OR "validUntil" > NOW()
      GROUP BY cp.store ORDER BY count DESC LIMIT 10
    `),

    // ── ODR global
    sq(pool, `
      SELECT
        COUNT(*)::int AS total,
        COUNT(*) FILTER (WHERE "validUntil" > NOW() AND active)::int AS active,
        ROUND(COALESCE(SUM(amount)  FILTER (WHERE "validUntil" > NOW() AND active),0)::numeric,2) AS total_amount,
        ROUND(COALESCE(AVG(amount)  FILTER (WHERE "validUntil" > NOW() AND active),0)::numeric,2) AS avg_amount,
        ROUND(COALESCE(MAX(amount)  FILTER (WHERE "validUntil" > NOW() AND active),0)::numeric,2) AS max_amount,
        COUNT(*) FILTER (WHERE "validUntil" BETWEEN NOW() AND NOW()+INTERVAL'7 days' AND active)::int AS expiring_7d,
        COUNT(*) FILTER (WHERE "validUntil" BETWEEN NOW() AND NOW()+INTERVAL'30 days' AND active)::int AS expiring_30d
      FROM cashback_offers
    `, { total:0, active:0, total_amount:0, avg_amount:0, max_amount:0, expiring_7d:0, expiring_30d:0 }),

    // ── ODR par provider
    sqRows(pool, `
      SELECT
        provider,
        COUNT(*)::int                                         AS total,
        COUNT(*) FILTER (WHERE active AND "validUntil">NOW())::int AS active,
        ROUND(SUM(amount) FILTER (WHERE active AND "validUntil">NOW())::numeric,2) AS total_amount,
        ROUND(AVG(amount) FILTER (WHERE active AND "validUntil">NOW())::numeric,2) AS avg_amount,
        ROUND(MAX(amount) FILTER (WHERE active AND "validUntil">NOW())::numeric,2) AS max_amount
      FROM cashback_offers
      GROUP BY provider ORDER BY total_amount DESC NULLS LAST
    `),

    // ── Communauté global
    sq(pool, `
      SELECT
        COUNT(*)::int AS total,
        COUNT(*) FILTER (WHERE status='pending')::int   AS pending,
        COUNT(*) FILTER (WHERE status='confirmed')::int AS confirmed,
        COUNT(*) FILTER (WHERE status='rejected')::int  AS rejected,
        COUNT(*) FILTER (WHERE status='expired')::int   AS expired,
        COUNT(*) FILTER (WHERE "createdAt">NOW()-INTERVAL'24h')::int AS today,
        COUNT(*) FILTER (WHERE "createdAt">NOW()-INTERVAL'7 days')::int AS this_week,
        COUNT(DISTINCT "reporterId")::int AS unique_reporters,
        (SELECT COUNT(*)::int FROM community_votes) AS total_votes,
        (SELECT COUNT(*)::int FROM community_votes WHERE "createdAt">NOW()-INTERVAL'24h') AS votes_today,
        (SELECT COUNT(*)::int FROM community_votes WHERE vote='up') AS upvotes,
        (SELECT COUNT(*)::int FROM community_votes WHERE vote='down') AS downvotes
      FROM community_promos
    `, { total:0, pending:0, confirmed:0, rejected:0, expired:0, today:0, this_week:0, unique_reporters:0, total_votes:0, votes_today:0, upvotes:0, downvotes:0 }),

    // ── 10 derniers signalements
    sqRows(pool, `
      SELECT
        cp.id, cp.ean, cp."promoType" AS promo_type,
        cp."promoValue" AS promo_value, cp."promoLabel" AS promo_label,
        cp.status, cp."stockLevel" AS stock_level,
        TO_CHAR(cp."createdAt", 'DD/MM HH24:MI') AS created_at,
        s.name AS store_name, s.color AS store_color
      FROM community_promos cp
      LEFT JOIN stores s ON s.id = cp."storeId"
      ORDER BY cp."createdAt" DESC LIMIT 10
    `),

    // ── Communauté par enseigne
    sqRows(pool, `
      SELECT
        s.name, s.color,
        COUNT(cp.id)::int AS count,
        COUNT(*) FILTER (WHERE cp.status='confirmed')::int AS confirmed
      FROM stores s
      LEFT JOIN community_promos cp ON s.id = cp."storeId"
      GROUP BY s.id, s.name, s.color
      ORDER BY count DESC
    `),

    // ── Activité 7 jours
    sqRows(pool, `
      SELECT
        TO_CHAR(DATE("createdAt"),'DD/MM') AS day,
        COUNT(*)::int AS count
      FROM community_promos
      WHERE "createdAt" > NOW()-INTERVAL'7 days'
      GROUP BY DATE("createdAt") ORDER BY DATE("createdAt") ASC
    `),

    // ── Activité 30 jours
    sqRows(pool, `
      SELECT
        TO_CHAR(DATE("createdAt"),'DD/MM') AS day,
        COUNT(*)::int AS count
      FROM community_promos
      WHERE "createdAt" > NOW()-INTERVAL'30 days'
      GROUP BY DATE("createdAt") ORDER BY DATE("createdAt") ASC
    `),

    // ── Top catégories
    sqRows(pool, `
      SELECT
        "categorySlug" AS category,
        COUNT(*)::int AS group_count,
        (SELECT COUNT(*)::int FROM product_variants pv2
         JOIN product_groups pg2 ON pg2.id=pv2."groupId"
         WHERE pg2."categorySlug"=pg."categorySlug") AS variant_count
      FROM product_groups pg
      GROUP BY "categorySlug"
      ORDER BY group_count DESC LIMIT 10
    `),
  ]);

  return {
    generated_at: new Date().toISOString(),
    catalogue, segments, priceStats, pricesByStore,
    promos, promosByType,
    offers, offersByProvider,
    community, recentReports, communityByStore,
    activity7d, activity30d,
    topCategories,
  };
}

// ─── HTML ─────────────────────────────────────────────────────────────────────

function renderDashboard(): string {
  return `<!DOCTYPE html>
<html lang="fr">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>SmartHunt — Centre de Contrôle</title>
<script src="https://cdn.jsdelivr.net/npm/chart.js@4.4.0/dist/chart.umd.min.js"></script>
<style>
*{box-sizing:border-box;margin:0;padding:0}
:root{
  --bg:#0A0A0F;--surface:#141420;--card:#1C1C2E;--border:#2A2A3E;
  --green:#00FF88;--blue:#00B4FF;--gold:#FFD700;--orange:#FF6B35;
  --red:#FF4444;--purple:#A855F7;--pink:#FF4D8D;
  --text:#E8E8F0;--muted:#8A8A9A;--faint:#4A4A5A;
}
body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;background:var(--bg);color:var(--text);min-height:100vh}

/* ── Layout ── */
.sidebar{position:fixed;top:0;left:0;width:220px;height:100vh;background:var(--surface);border-right:1px solid var(--border);padding:0;display:flex;flex-direction:column;z-index:100}
.main{margin-left:220px;padding:28px 32px;min-height:100vh}
@media(max-width:768px){.sidebar{width:100%;height:auto;position:relative;flex-direction:row;overflow-x:auto}.main{margin-left:0;padding:16px}}

/* ── Sidebar ── */
.brand{padding:20px 20px 16px;border-bottom:1px solid var(--border)}
.brand-name{font-size:18px;font-weight:800;color:var(--green)}
.brand-sub{font-size:10px;color:var(--faint);letter-spacing:1px;text-transform:uppercase;margin-top:2px}
.nav-section{padding:12px 12px 4px;font-size:9px;font-weight:700;text-transform:uppercase;letter-spacing:1.2px;color:var(--faint)}
.nav-item{display:flex;align-items:center;gap:10px;padding:9px 16px;cursor:pointer;border-radius:8px;margin:2px 8px;font-size:13px;font-weight:500;color:var(--muted);transition:all .15s}
.nav-item:hover{background:var(--card);color:var(--text)}
.nav-item.active{background:var(--green)18;color:var(--green);font-weight:600}
.nav-item .icon{font-size:15px;width:20px;text-align:center}
.nav-badge{margin-left:auto;background:var(--border);color:var(--muted);font-size:10px;padding:2px 7px;border-radius:100px}
.nav-item.active .nav-badge{background:var(--green)30;color:var(--green)}
.sidebar-footer{margin-top:auto;padding:16px;border-top:1px solid var(--border)}
.refresh-btn{width:100%;padding:8px;background:var(--green)15;border:1px solid var(--green)40;color:var(--green);border-radius:8px;cursor:pointer;font-size:12px;font-weight:600}
.refresh-btn:hover{background:var(--green)25}
.last-update{font-size:10px;color:var(--faint);text-align:center;margin-top:8px}

/* ── Sections ── */
.section{display:none}.section.active{display:block}
.page-header{margin-bottom:24px}
.page-title{font-size:22px;font-weight:800}
.page-sub{font-size:13px;color:var(--muted);margin-top:4px}

/* ── Grids ── */
.grid-5{display:grid;grid-template-columns:repeat(5,1fr);gap:12px;margin-bottom:24px}
.grid-4{display:grid;grid-template-columns:repeat(4,1fr);gap:12px;margin-bottom:24px}
.grid-3{display:grid;grid-template-columns:repeat(3,1fr);gap:12px;margin-bottom:24px}
.grid-2{display:grid;grid-template-columns:repeat(2,1fr);gap:12px;margin-bottom:24px}
.grid-2-1{display:grid;grid-template-columns:2fr 1fr;gap:16px;margin-bottom:24px}
.grid-1-2{display:grid;grid-template-columns:1fr 2fr;gap:16px;margin-bottom:24px}
@media(max-width:1100px){.grid-5{grid-template-columns:repeat(3,1fr)}.grid-4{grid-template-columns:repeat(2,1fr)}.grid-2-1,.grid-1-2{grid-template-columns:1fr}}
@media(max-width:700px){.grid-5,.grid-4,.grid-3,.grid-2{grid-template-columns:1fr}}
.section-label{font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:1px;color:var(--faint);margin-bottom:10px;margin-top:8px}

/* ── KPI Cards ── */
.kpi{background:var(--card);border:1px solid var(--border);border-radius:12px;padding:16px 18px;position:relative;overflow:hidden}
.kpi::before{content:'';position:absolute;top:0;left:0;right:0;height:2px;background:var(--accent,var(--green))}
.kpi-label{font-size:10px;font-weight:600;text-transform:uppercase;letter-spacing:.8px;color:var(--muted);margin-bottom:6px}
.kpi-value{font-size:28px;font-weight:800;line-height:1;color:var(--accent,var(--green))}
.kpi-sub{font-size:11px;color:var(--muted);margin-top:5px}
.kpi-delta{display:inline-flex;align-items:center;gap:3px;font-size:11px;font-weight:600;padding:2px 8px;border-radius:100px;margin-top:6px}
.delta-up{background:#00FF8818;color:var(--green)}
.delta-dn{background:#FF444418;color:var(--red)}
.delta-neu{background:var(--border);color:var(--muted)}

/* ── Chart cards ── */
.chart-card{background:var(--card);border:1px solid var(--border);border-radius:12px;padding:20px}
.chart-title{font-size:13px;font-weight:700;margin-bottom:4px}
.chart-sub{font-size:11px;color:var(--muted);margin-bottom:16px}
.chart-wrap{position:relative}

/* ── Tables ── */
.data-table{width:100%;border-collapse:collapse}
.data-table th{text-align:left;font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.8px;color:var(--faint);padding:8px 12px;border-bottom:1px solid var(--border)}
.data-table td{padding:10px 12px;font-size:13px;border-bottom:1px solid #1C1C2E;vertical-align:middle}
.data-table tr:last-child td{border-bottom:none}
.data-table tr:hover td{background:#1C1C2E50}
.table-card{background:var(--card);border:1px solid var(--border);border-radius:12px;overflow:hidden}
.table-header{padding:16px 20px;border-bottom:1px solid var(--border);display:flex;align-items:center;justify-content:space-between}
.table-title{font-size:14px;font-weight:700}
.table-count{font-size:11px;color:var(--muted)}

/* ── Pills / badges ── */
.pill{display:inline-flex;align-items:center;gap:4px;font-size:10px;font-weight:600;padding:3px 9px;border-radius:100px;white-space:nowrap}
.pill-green{background:var(--green)18;color:var(--green)}
.pill-blue{background:var(--blue)18;color:var(--blue)}
.pill-gold{background:var(--gold)18;color:var(--gold)}
.pill-orange{background:var(--orange)18;color:var(--orange)}
.pill-red{background:var(--red)18;color:var(--red)}
.pill-muted{background:var(--border);color:var(--muted)}
.pill-purple{background:var(--purple)18;color:var(--purple)}

/* ── Store dot ── */
.store-dot{display:inline-block;width:9px;height:9px;border-radius:50%;margin-right:7px;vertical-align:middle;flex-shrink:0}

/* ── Progress bar ── */
.prog-bg{background:var(--border);border-radius:4px;height:6px;margin-top:5px;overflow:hidden}
.prog-fill{height:6px;border-radius:4px;transition:width .5s ease}

/* ── Status indicator ── */
.status-dot{width:7px;height:7px;border-radius:50%;display:inline-block;margin-right:6px}

/* ── Community stacked bar ── */
.stack-bar{height:10px;border-radius:5px;overflow:hidden;display:flex;margin:8px 0 12px}
.stack-seg{height:100%;transition:width .4s ease}

/* ── Loading / error ── */
.loading{display:flex;flex-direction:column;align-items:center;justify-content:center;min-height:60vh;gap:16px;color:var(--faint)}
.spinner{width:32px;height:32px;border:2px solid var(--border);border-top-color:var(--green);border-radius:50%;animation:spin .7s linear infinite}
@keyframes spin{to{transform:rotate(360deg)}}
.error-box{background:var(--red)10;border:1px solid var(--red)40;border-radius:12px;padding:20px;color:var(--red);font-size:14px;text-align:center}

/* ── Misc ── */
.green{color:var(--green)}.blue{color:var(--blue)}.gold{color:var(--gold)}.orange{color:var(--orange)}.red{color:var(--red)}.muted{color:var(--muted)}.purple{color:var(--purple)}
b.green{color:var(--green)}b.blue{color:var(--blue)}b.gold{color:var(--gold)}
.text-right{text-align:right}
.fw7{font-weight:700}
.mt8{margin-top:8px}
.empty-state{padding:24px;text-align:center;color:var(--faint);font-size:13px}
</style>
</head>
<body>

<!-- ── Sidebar ── -->
<div class="sidebar">
  <div class="brand">
    <div class="brand-name">SmartHunt</div>
    <div class="brand-sub">Centre de Contrôle</div>
  </div>
  <div style="overflow-y:auto;flex:1">
    <div class="nav-section">Vue d'ensemble</div>
    <div class="nav-item active" onclick="showSection('overview')">
      <span class="icon">📊</span>Vue globale
    </div>
    <div class="nav-section">Données</div>
    <div class="nav-item" onclick="showSection('catalogue')">
      <span class="icon">📦</span>Catalogue
      <span class="nav-badge" id="nb-catalogue">—</span>
    </div>
    <div class="nav-item" onclick="showSection('promos')">
      <span class="icon">🏷️</span>Promos
      <span class="nav-badge" id="nb-promos">—</span>
    </div>
    <div class="nav-item" onclick="showSection('odr')">
      <span class="icon">💰</span>ODR
      <span class="nav-badge" id="nb-odr">—</span>
    </div>
    <div class="nav-item" onclick="showSection('stores')">
      <span class="icon">🏪</span>Magasins
      <span class="nav-badge" id="nb-stores">—</span>
    </div>
    <div class="nav-section">Utilisateurs</div>
    <div class="nav-item" onclick="showSection('community')">
      <span class="icon">👥</span>Communauté
      <span class="nav-badge" id="nb-community">—</span>
    </div>
  </div>
  <div class="sidebar-footer">
    <button class="refresh-btn" onclick="load()">⟳ Actualiser</button>
    <div class="last-update" id="lastUpdate">—</div>
  </div>
</div>

<!-- ── Main ── -->
<div class="main">
  <div id="content">
    <div class="loading"><div class="spinner"></div><span>Chargement…</span></div>
  </div>
</div>

<script>
// ── État ──────────────────────────────────────────────────────────────────────
let currentData = null;
let charts = {};
let activeSection = 'overview';

function fmt(n, d=0) {
  if (n == null || n === '') return '—';
  return Number(n).toLocaleString('fr-FR', {minimumFractionDigits:d, maximumFractionDigits:d});
}
function fmtEur(n) { return n != null ? fmt(n,2) + ' €' : '—'; }
function pct(a,b) { return b>0 ? Math.round((a/b)*100) : 0; }

// ── Navigation ────────────────────────────────────────────────────────────────
function showSection(id) {
  activeSection = id;
  document.querySelectorAll('.nav-item').forEach(el => el.classList.remove('active'));
  document.querySelector('[onclick="showSection(\\''+id+'\\')"]')?.classList.add('active');
  if (currentData) renderSection(id, currentData);
}

// ── Charts helpers ────────────────────────────────────────────────────────────
const CHART_DEFAULTS = {
  responsive:true, maintainAspectRatio:true,
  plugins:{ legend:{ labels:{ color:'#8A8A9A', font:{ size:11 } } } },
};
const GRID_COLOR = '#2A2A3E';

function destroyChart(id) {
  if (charts[id]) { charts[id].destroy(); delete charts[id]; }
}

function barChart(id, labels, datasets, opts={}) {
  destroyChart(id);
  const ctx = document.getElementById(id)?.getContext('2d');
  if (!ctx) return;
  charts[id] = new Chart(ctx, {
    type: 'bar',
    data: { labels, datasets },
    options: {
      ...CHART_DEFAULTS,
      ...opts,
      scales: {
        x: { grid:{ color:GRID_COLOR }, ticks:{ color:'#8A8A9A', font:{size:10} }, ...(opts.scales?.x||{}) },
        y: { grid:{ color:GRID_COLOR }, ticks:{ color:'#8A8A9A', font:{size:10} }, ...(opts.scales?.y||{}) },
        ...(opts.scales||{}),
      },
    },
  });
}

function lineChart(id, labels, datasets, opts={}) {
  destroyChart(id);
  const ctx = document.getElementById(id)?.getContext('2d');
  if (!ctx) return;
  charts[id] = new Chart(ctx, {
    type: 'line',
    data: { labels, datasets },
    options: {
      ...CHART_DEFAULTS, ...opts,
      scales: {
        x:{ grid:{color:GRID_COLOR}, ticks:{color:'#8A8A9A',font:{size:10}} },
        y:{ grid:{color:GRID_COLOR}, ticks:{color:'#8A8A9A',font:{size:10}}, beginAtZero:true },
      },
    },
  });
}

function donutChart(id, labels, data, colors) {
  destroyChart(id);
  const ctx = document.getElementById(id)?.getContext('2d');
  if (!ctx) return;
  charts[id] = new Chart(ctx, {
    type: 'doughnut',
    data: { labels, datasets:[{ data, backgroundColor:colors, borderColor:'#141420', borderWidth:3 }] },
    options: {
      ...CHART_DEFAULTS,
      cutout:'68%',
      plugins:{ legend:{ position:'right', labels:{ color:'#8A8A9A', font:{size:11}, padding:12, boxWidth:12 } } },
    },
  });
}

// ── Render section ────────────────────────────────────────────────────────────

function renderSection(id, d) {
  const el = document.getElementById('content');
  if (!el) return;

  if      (id === 'overview')   el.innerHTML = renderOverview(d);
  else if (id === 'catalogue')  el.innerHTML = renderCatalogue(d);
  else if (id === 'promos')     el.innerHTML = renderPromos(d);
  else if (id === 'odr')        el.innerHTML = renderODR(d);
  else if (id === 'stores')     el.innerHTML = renderStores(d);
  else if (id === 'community')  el.innerHTML = renderCommunity(d);

  // Charts must be drawn after DOM is ready
  setTimeout(() => drawCharts(id, d), 50);
}

// ── OVERVIEW ─────────────────────────────────────────────────────────────────

function renderOverview(d) {
  const c = d.catalogue; const p = d.promos; const o = d.offers; const co = d.community;
  const confRate = co.total > 0 ? Math.round((co.confirmed/co.total)*100) : 0;
  return \`
  <div class="page-header">
    <div class="page-title">Vue globale</div>
    <div class="page-sub">Actualisé le \${new Date(d.generated_at).toLocaleString('fr-FR')}</div>
  </div>

  <div class="section-label">Catalogue</div>
  <div class="grid-4">
    \${kpi('Groupes produits', fmt(c.groups), 'var(--green)', 'catégories génériques')}
    \${kpi('Variantes (EAN)', fmt(c.variants), 'var(--blue)', 'marques · formats · segments')}
    \${kpi('Prix constatés', fmt(c.prices), 'var(--gold)', 'MAJ : '+(c.last_price_update||'—'))}
    \${kpi('Magasins couverts', fmt(c.stores_with_prices), 'var(--orange)', 'sur '+d.pricesByStore.length+' enseignes')}
  </div>

  <div class="section-label">Promos & ODR</div>
  <div class="grid-4">
    \${kpi('Promos actives', fmt(p.active), 'var(--green)', 'sur '+fmt(p.total)+' au total')}
    \${kpi('Remise moyenne', p.avg_pct ? fmt(p.avg_pct,1)+'%' : '—', 'var(--blue)', 'promos en pourcentage')}
    \${kpi('ODR actives', fmt(o.active), 'var(--gold)', 'sur '+fmt(o.total)+' au total')}
    \${kpi('Montant ODR total', fmtEur(o.total_amount), 'var(--orange)', 'remboursements actifs cumulés')}
  </div>

  <div class="section-label">Communauté</div>
  <div class="grid-4">
    \${kpi('Signalements', fmt(co.total), 'var(--blue)', fmt(co.today)+' aujourd\\'hui · '+fmt(co.this_week)+' cette semaine')}
    \${kpi('Contributeurs', fmt(co.unique_reporters), 'var(--purple)', 'utilisateurs anonymes actifs')}
    \${kpi('Votes total', fmt(co.total_votes), 'var(--gold)', '👍 '+fmt(co.upvotes)+' · 👎 '+fmt(co.downvotes))}
    \${kpi('Taux confirmation', confRate+'%', confRate>=50?'var(--green)':'var(--orange)', co.confirmed+' promos vérifiées')}
  </div>

  <div class="grid-2">
    <div class="chart-card">
      <div class="chart-title">Activité communautaire — 30 jours</div>
      <div class="chart-sub">Signalements de promos par jour</div>
      <div class="chart-wrap"><canvas id="c-activity30" height="110"></canvas></div>
    </div>
    <div class="chart-card">
      <div class="chart-title">Répartition des prix par enseigne</div>
      <div class="chart-sub">Nombre de prix constatés</div>
      <div class="chart-wrap"><canvas id="c-stores-overview" height="110"></canvas></div>
    </div>
  </div>
  \`;
}

// ── CATALOGUE ────────────────────────────────────────────────────────────────

function renderCatalogue(d) {
  const c = d.catalogue; const ps = d.priceStats;
  return \`
  <div class="page-header">
    <div class="page-title">📦 Catalogue</div>
    <div class="page-sub">Produits · variantes · prix constatés</div>
  </div>

  <div class="grid-5">
    \${kpi('Groupes', fmt(c.groups), 'var(--green)', 'produits génériques')}
    \${kpi('Variantes', fmt(c.variants), 'var(--blue)', 'EAN distincts')}
    \${kpi('Prix', fmt(c.prices), 'var(--gold)', 'entrées store_prices')}
    \${kpi('Prix moy.', fmtEur(ps.avg_price), 'var(--orange)', 'médiane : '+fmtEur(ps.median_price))}
    \${kpi('Couverture', pct(c.groups_with_prices,c.groups)+'%', 'var(--purple)', c.groups_with_prices+'/'+c.groups+' groupes avec prix')}
  </div>

  <div class="grid-2">
    <div class="chart-card">
      <div class="chart-title">Top catégories</div>
      <div class="chart-sub">Nombre de groupes produits par catégorie</div>
      <div class="chart-wrap"><canvas id="c-categories" height="160"></canvas></div>
    </div>
    <div class="chart-card">
      <div class="chart-title">Répartition par segment</div>
      <div class="chart-sub">Premium · Standard · MDD</div>
      <div class="chart-wrap" style="max-width:340px;margin:0 auto"><canvas id="c-segments" height="160"></canvas></div>
    </div>
  </div>

  <div class="section-label">Fourchette de prix</div>
  <div class="grid-4">
    \${kpi('Prix minimum', fmtEur(ps.min_price), 'var(--green)', 'prix le plus bas en base')}
    \${kpi('Prix maximum', fmtEur(ps.max_price), 'var(--red)', 'prix le plus haut en base')}
    \${kpi('Prix moyen', fmtEur(ps.avg_price), 'var(--blue)', 'moyenne globale')}
    \${kpi('Médiane', fmtEur(ps.median_price), 'var(--gold)', '50% des prix en dessous')}
  </div>
  \`;
}

// ── PROMOS ───────────────────────────────────────────────────────────────────

function renderPromos(d) {
  const p = d.promos;
  const typesRows = [
    ['Remise %', p.type_percent, p.avg_pct ? fmt(p.avg_pct,1)+'%' : '—', 'var(--green)'],
    ['Immédiate €', p.type_immediate, p.avg_immediate ? fmtEur(p.avg_immediate) : '—', 'var(--blue)'],
    ['Volume', p.type_volume, '—', 'var(--gold)'],
    ['Bundle', p.type_bundle, '—', 'var(--orange)'],
  ];
  return \`
  <div class="page-header">
    <div class="page-title">🏷️ Promos catalogue</div>
    <div class="page-sub">Réductions vérifiées en magasin</div>
  </div>

  <div class="grid-4">
    \${kpi('Promos actives', fmt(p.active), 'var(--green)', 'sur '+fmt(p.total)+' au total')}
    \${kpi('Remise % moy.', p.avg_pct?fmt(p.avg_pct,1)+'%':'—', 'var(--blue)', 'promos en pourcentage')}
    \${kpi('Remise imm. moy.', p.avg_immediate?fmtEur(p.avg_immediate):'—', 'var(--gold)', 'promos en montant €')}
    \${kpi('Inactives', fmt((p.total||0)-(p.active||0)), 'var(--faint)', 'expirées ou sans date')}
  </div>

  <div class="grid-2-1">
    <div class="chart-card">
      <div class="chart-title">Promos par enseigne (actives)</div>
      <div class="chart-sub">Top 10 enseignes par nombre de promos actives</div>
      <div class="chart-wrap"><canvas id="c-promos-stores" height="160"></canvas></div>
    </div>
    <div class="chart-card">
      <div class="chart-title">Types de promo</div>
      <div class="chart-sub">Répartition</div>
      <div class="chart-wrap" style="max-width:280px;margin:0 auto"><canvas id="c-promo-types" height="160"></canvas></div>
    </div>
  </div>

  <div class="table-card">
    <div class="table-header">
      <div class="table-title">Détail par type</div>
    </div>
    <table class="data-table">
      <thead><tr><th>Type</th><th>Nombre</th><th>Part</th><th>Valeur moy.</th><th>Couverture</th></tr></thead>
      <tbody>
        \${typesRows.map(([name, count, avg, color]) => \`
        <tr>
          <td><span class="status-dot" style="background:\${color}"></span>\${name}</td>
          <td class="fw7" style="color:\${color}">\${fmt(count)}</td>
          <td>\${pct(count,p.total||1)}%</td>
          <td>\${avg}</td>
          <td><div class="prog-bg"><div class="prog-fill" style="width:\${pct(count,p.total||1)}%;background:\${color}"></div></div></td>
        </tr>\`).join('')}
      </tbody>
    </table>
  </div>
  \`;
}

// ── ODR ──────────────────────────────────────────────────────────────────────

function renderODR(d) {
  const o = d.offers;
  return \`
  <div class="page-header">
    <div class="page-title">💰 ODR & Cashback</div>
    <div class="page-sub">Offres de remboursement différé</div>
  </div>

  <div class="grid-4">
    \${kpi('Offres actives', fmt(o.active), 'var(--green)', 'sur '+fmt(o.total)+' au total')}
    \${kpi('Montant cumulé', fmtEur(o.total_amount), 'var(--gold)', 'remboursements disponibles')}
    \${kpi('Remboursement moy.', fmtEur(o.avg_amount), 'var(--blue)', 'par offre active')}
    \${kpi('Meilleure ODR', fmtEur(o.max_amount), 'var(--orange)', 'montant max actif')}
  </div>

  <div class="grid-2">
    <div class="chart-card">
      <div class="chart-title">Montant total par provider</div>
      <div class="chart-sub">Cumul des remboursements disponibles</div>
      <div class="chart-wrap"><canvas id="c-odr-amount" height="140"></canvas></div>
    </div>
    <div class="chart-card">
      <div class="chart-title">Offres par provider</div>
      <div class="chart-sub">Répartition active / total</div>
      <div class="chart-wrap"><canvas id="c-odr-count" height="140"></canvas></div>
    </div>
  </div>

  <div class="grid-2">
    <div class="table-card">
      <div class="table-header">
        <div class="table-title">Providers</div>
        <div class="table-count">\${d.offersByProvider.length} providers</div>
      </div>
      <table class="data-table">
        <thead><tr><th>Provider</th><th>Actives</th><th>Total</th><th>Moy.</th><th>Max</th></tr></thead>
        <tbody>
          \${d.offersByProvider.length === 0
            ? '<tr><td colspan="5" class="empty-state">Aucune offre</td></tr>'
            : d.offersByProvider.map(p => \`
          <tr>
            <td class="fw7">\${p.provider}</td>
            <td><span class="pill \${p.active>0?'pill-green':'pill-muted'}">\${p.active||0}</span></td>
            <td class="muted">\${p.total}</td>
            <td class="gold">\${fmtEur(p.avg_amount)}</td>
            <td class="fw7">\${fmtEur(p.max_amount)}</td>
          </tr>\`).join('')}
        </tbody>
      </table>
    </div>
    <div class="chart-card">
      <div class="chart-title">Alertes expiration</div>
      <div class="chart-sub">Offres qui arrivent à terme</div>
      <div style="display:flex;flex-direction:column;gap:12px;margin-top:8px">
        \${alertBar('Expirent dans 7 jours', o.expiring_7d, o.active, 'var(--red)')}
        \${alertBar('Expirent dans 30 jours', o.expiring_30d, o.active, 'var(--orange)')}
        \${alertBar('Encore actives >30j', (o.active||0)-(o.expiring_30d||0), o.active, 'var(--green)')}
      </div>
      \${o.expiring_7d > 0 ? '<div class="pill pill-orange mt8">⚠️ '+o.expiring_7d+' offre(s) à renouveler sous 7 jours</div>' : '<div class="pill pill-green mt8">✓ Aucune expiration imminente</div>'}
    </div>
  </div>
  \`;
}

// ── STORES ────────────────────────────────────────────────────────────────────

function renderStores(d) {
  const c = d.catalogue;
  return \`
  <div class="page-header">
    <div class="page-title">🏪 Magasins</div>
    <div class="page-sub">Couverture prix par enseigne</div>
  </div>

  <div class="grid-4">
    \${kpi('Enseignes', fmt(d.pricesByStore.length), 'var(--green)', 'avec données en base')}
    \${kpi('Prix total', fmt(c.prices), 'var(--blue)', 'entrées store_prices')}
    \${kpi('Couverts', fmt(c.stores_with_prices), 'var(--gold)', 'enseignes avec prix')}
    \${kpi('Dernière MAJ', c.last_price_update||'—', 'var(--orange)', 'dernier prix enregistré')}
  </div>

  <div class="chart-card" style="margin-bottom:24px">
    <div class="chart-title">Prix constatés par enseigne</div>
    <div class="chart-sub">Nombre de variantes pricées + prix moyen</div>
    <div class="chart-wrap"><canvas id="c-stores-detail" height="120"></canvas></div>
  </div>

  <div class="table-card">
    <div class="table-header">
      <div class="table-title">Détail par enseigne</div>
      <div class="table-count">\${d.pricesByStore.length} enseignes</div>
    </div>
    <table class="data-table">
      <thead><tr><th>Enseigne</th><th>Prix</th><th>Couverture</th><th>Prix moy.</th><th>Min</th><th>Max</th><th>En stock</th><th>MAJ</th></tr></thead>
      <tbody>
        \${d.pricesByStore.length === 0
          ? '<tr><td colspan="8" class="empty-state">Aucun magasin</td></tr>'
          : d.pricesByStore.map(s => {
              const maxPrices = Math.max(...d.pricesByStore.map(x=>x.price_count||0), 1);
              const p = pct(s.price_count||0, maxPrices);
              return \`<tr>
                <td><span class="store-dot" style="background:\${s.color||'#4A4A5A'}"></span>\${s.name}</td>
                <td class="fw7 \${s.price_count>0?'green':'muted'}">\${fmt(s.price_count)}</td>
                <td style="min-width:100px"><div class="prog-bg"><div class="prog-fill" style="width:\${p}%;background:\${s.color||'var(--green)'}"></div></div></td>
                <td class="muted">\${fmtEur(s.avg_price)}</td>
                <td>\${fmtEur(s.min_price)}</td>
                <td>\${fmtEur(s.max_price)}</td>
                <td>\${s.in_stock!=null?\`<span class="pill pill-green">\${fmt(s.in_stock)}</span>\`:'—'}</td>
                <td class="muted" style="font-size:11px">\${s.last_update||'—'}</td>
              </tr>\`;
            }).join('')}
      </tbody>
    </table>
  </div>
  \`;
}

// ── COMMUNITY ────────────────────────────────────────────────────────────────

function renderCommunity(d) {
  const co = d.community;
  const confRate = co.total > 0 ? Math.round((co.confirmed/co.total)*100) : 0;
  const statusColors = { pending:'var(--gold)', confirmed:'var(--green)', rejected:'var(--red)', expired:'var(--faint)' };
  const statusLabels = { pending:'En attente', confirmed:'Confirmé', rejected:'Rejeté', expired:'Expiré' };
  return \`
  <div class="page-header">
    <div class="page-title">👥 Communauté</div>
    <div class="page-sub">Signalements de promos par les utilisateurs</div>
  </div>

  <div class="grid-4">
    \${kpi('Signalements', fmt(co.total), 'var(--blue)', fmt(co.today)+' aujourd\\'hui · '+fmt(co.this_week)+' cette semaine')}
    \${kpi('Contributeurs', fmt(co.unique_reporters), 'var(--purple)', 'utilisateurs anonymes')}
    \${kpi('Votes', fmt(co.total_votes), 'var(--gold)', '👍 '+fmt(co.upvotes)+' · 👎 '+fmt(co.downvotes))}
    \${kpi('Taux confirmation', confRate+'%', confRate>=50?'var(--green)':'var(--orange)', co.confirmed+' promos vérifiées')}
  </div>

  <div class="grid-2">
    <div class="chart-card">
      <div class="chart-title">Activité — 7 derniers jours</div>
      <div class="chart-sub">Signalements par jour</div>
      <div class="chart-wrap"><canvas id="c-activity7" height="130"></canvas></div>
    </div>
    <div class="chart-card">
      <div class="chart-title">Statuts des signalements</div>
      <div class="chart-sub">Répartition globale</div>
      <div class="chart-wrap" style="max-width:300px;margin:0 auto"><canvas id="c-community-status" height="160"></canvas></div>
    </div>
  </div>

  <div class="grid-2">
    <div class="chart-card">
      <div class="chart-title">Signalements par enseigne</div>
      <div class="chart-sub">Total · confirmés</div>
      <div class="chart-wrap"><canvas id="c-community-stores" height="140"></canvas></div>
    </div>
    <div class="chart-card">
      <div class="chart-title">Votes</div>
      <div class="chart-sub">Répartition upvotes / downvotes</div>
      <div class="chart-wrap" style="max-width:260px;margin:0 auto"><canvas id="c-votes" height="140"></canvas></div>
    </div>
  </div>

  <div class="table-card">
    <div class="table-header">
      <div class="table-title">10 derniers signalements</div>
      <div class="table-count">\${d.recentReports.length} affichés</div>
    </div>
    \${d.recentReports.length === 0
      ? '<div class="empty-state">Aucun signalement pour l\\'instant</div>'
      : \`<table class="data-table">
          <thead><tr><th>Date</th><th>EAN</th><th>Enseigne</th><th>Type</th><th>Valeur</th><th>Label</th><th>Stock</th><th>Statut</th></tr></thead>
          <tbody>
            \${d.recentReports.map(r => \`<tr>
              <td class="muted" style="font-size:11px">\${r.created_at}</td>
              <td style="font-family:monospace;font-size:11px">\${r.ean}</td>
              <td>\${r.store_name?'<span class="store-dot" style="background:'+(r.store_color||'#4A4A5A')+'"></span>'+r.store_name:'—'}</td>
              <td><span class="pill pill-blue">\${r.promo_type}</span></td>
              <td class="fw7">\${r.promo_type==='percent'?fmt(r.promo_value,1)+'%':fmtEur(r.promo_value)}</td>
              <td class="muted" style="max-width:160px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">\${r.promo_label||'—'}</td>
              <td>\${r.stock_level==='high'?'🟢':r.stock_level==='medium'?'🟡':'🔴'} \${r.stock_level||'—'}</td>
              <td><span class="pill" style="background:\${statusColors[r.status]||'var(--border)'}18;color:\${statusColors[r.status]||'var(--muted)'}">\${statusLabels[r.status]||r.status}</span></td>
            </tr>\`).join('')}
          </tbody>
        </table>\`}
  </div>
  \`;
}

// ── Chart drawing ─────────────────────────────────────────────────────────────

function drawCharts(section, d) {
  if (section === 'overview') {
    const act = d.activity30d;
    lineChart('c-activity30',
      act.map(a=>a.day), [{
        label:'Signalements',
        data: act.map(a=>a.count),
        borderColor:'#00B4FF', backgroundColor:'#00B4FF20',
        fill:true, tension:0.4, pointRadius:3, pointBackgroundColor:'#00B4FF',
      }]
    );
    const stores = d.pricesByStore.filter(s=>s.price_count>0);
    barChart('c-stores-overview',
      stores.map(s=>s.name),
      [{ label:'Prix', data:stores.map(s=>s.price_count), backgroundColor:stores.map(s=>s.color||'#00FF88')+'99' }],
      { plugins:{ legend:{ display:false } } }
    );
  }

  if (section === 'catalogue') {
    const cats = d.topCategories;
    barChart('c-categories',
      cats.map(c=>c.category),
      [{ label:'Groupes', data:cats.map(c=>c.group_count), backgroundColor:'#00FF8866', borderColor:'#00FF88', borderWidth:1 },
       { label:'Variantes', data:cats.map(c=>c.variant_count||0), backgroundColor:'#00B4FF44', borderColor:'#00B4FF', borderWidth:1 }],
      { plugins:{ legend:{ display:true, position:'top' } } }
    );
    const segs = d.segments;
    const segColors = { premium:'#FFD70099', standard:'#00B4FF99', mdd:'#00FF8899', default:'#8A8A9A99' };
    donutChart('c-segments',
      segs.map(s=>s.segment||'inconnu'),
      segs.map(s=>s.count),
      segs.map(s=>segColors[s.segment]||segColors.default)
    );
  }

  if (section === 'promos') {
    const stores = d.promosByType;
    barChart('c-promos-stores',
      stores.map(s=>s.store||'Inconnu'),
      [{ label:'Promos actives', data:stores.map(s=>s.count), backgroundColor:'#00FF8866', borderColor:'#00FF88', borderWidth:1 }],
      { plugins:{ legend:{ display:false } } }
    );
    const p = d.promos;
    donutChart('c-promo-types',
      ['Remise %', 'Immédiate', 'Volume', 'Bundle'],
      [p.type_percent||0, p.type_immediate||0, p.type_volume||0, p.type_bundle||0],
      ['#00FF8899','#00B4FF99','#FFD70099','#FF6B3599']
    );
  }

  if (section === 'odr') {
    const providers = d.offersByProvider;
    barChart('c-odr-amount',
      providers.map(p=>p.provider),
      [{ label:'Montant total (€)', data:providers.map(p=>p.total_amount||0), backgroundColor:'#FFD70066', borderColor:'#FFD700', borderWidth:1 }],
      { plugins:{ legend:{ display:false } } }
    );
    barChart('c-odr-count',
      providers.map(p=>p.provider),
      [{ label:'Actives', data:providers.map(p=>p.active||0), backgroundColor:'#00FF8866', borderColor:'#00FF88', borderWidth:1 },
       { label:'Total', data:providers.map(p=>p.total||0), backgroundColor:'#4A4A5A66', borderColor:'#4A4A5A', borderWidth:1 }],
      { plugins:{ legend:{ display:true, position:'top' } } }
    );
  }

  if (section === 'stores') {
    const stores = d.pricesByStore;
    barChart('c-stores-detail',
      stores.map(s=>s.name),
      [{ label:'Prix constatés', data:stores.map(s=>s.price_count||0), backgroundColor:stores.map(s=>(s.color||'#00FF88')+'66'), borderColor:stores.map(s=>s.color||'#00FF88'), borderWidth:1 },
       { label:'Prix moyen (€)', data:stores.map(s=>s.avg_price||0), type:'line', borderColor:'#00B4FF', backgroundColor:'transparent', yAxisID:'y2', pointRadius:4 }],
      { scales:{ y:{ title:{ display:true, text:'Nombre de prix', color:'#6A6A7A' } }, y2:{ position:'right', title:{ display:true, text:'Prix moy (€)', color:'#00B4FF' }, grid:{ drawOnChartArea:false }, ticks:{ color:'#00B4FF' } } } }
    );
  }

  if (section === 'community') {
    const act7 = d.activity7d;
    lineChart('c-activity7',
      act7.map(a=>a.day), [{
        label:'Signalements',
        data:act7.map(a=>a.count),
        borderColor:'#00B4FF', backgroundColor:'#00B4FF20',
        fill:true, tension:0.4, pointRadius:4, pointBackgroundColor:'#00B4FF',
      }]
    );
    const co = d.community;
    donutChart('c-community-status',
      ['Confirmés','En attente','Rejetés','Expirés'],
      [co.confirmed||0, co.pending||0, co.rejected||0, co.expired||0],
      ['#00FF8899','#FFD70099','#FF444499','#4A4A5A99']
    );
    const cstores = d.communityByStore.filter(s=>s.count>0);
    barChart('c-community-stores',
      cstores.map(s=>s.name),
      [{ label:'Total', data:cstores.map(s=>s.count), backgroundColor:'#00B4FF44', borderColor:'#00B4FF', borderWidth:1 },
       { label:'Confirmés', data:cstores.map(s=>s.confirmed||0), backgroundColor:'#00FF8866', borderColor:'#00FF88', borderWidth:1 }],
      { plugins:{ legend:{ display:true, position:'top' } } }
    );
    donutChart('c-votes',
      ['👍 Upvotes','👎 Downvotes'],
      [co.upvotes||0, co.downvotes||0],
      ['#00FF8899','#FF444499']
    );
  }
}

// ── Helper templates ──────────────────────────────────────────────────────────

function kpi(label, value, color, sub) {
  return \`<div class="kpi" style="--accent:\${color}">
    <div class="kpi-label">\${label}</div>
    <div class="kpi-value">\${value}</div>
    \${sub ? '<div class="kpi-sub">'+sub+'</div>' : ''}
  </div>\`;
}

function alertBar(label, count, total, color) {
  const p = pct(count||0, total||1);
  return \`<div>
    <div style="display:flex;justify-content:space-between;font-size:12px;margin-bottom:4px">
      <span class="muted">\${label}</span>
      <b style="color:\${color}">\${fmt(count)}</b>
    </div>
    <div class="prog-bg"><div class="prog-fill" style="width:\${p}%;background:\${color}"></div></div>
  </div>\`;
}

// ── Update badges ─────────────────────────────────────────────────────────────

function updateBadges(d) {
  const set = (id, val) => { const el = document.getElementById(id); if(el) el.textContent = val; };
  set('nb-catalogue', d.catalogue.groups||0);
  set('nb-promos', d.promos.active||0);
  set('nb-odr', d.offers.active||0);
  set('nb-stores', d.pricesByStore.length||0);
  set('nb-community', d.community.today||0);
}

// ── Load & render ─────────────────────────────────────────────────────────────

async function load() {
  try {
    const res = await fetch('/v1/admin/stats');
    if (!res.ok) throw new Error('HTTP ' + res.status);
    currentData = await res.json();
    updateBadges(currentData);
    renderSection(activeSection, currentData);
    document.getElementById('lastUpdate').textContent =
      new Date().toLocaleTimeString('fr-FR', {hour:'2-digit',minute:'2-digit',second:'2-digit'});
  } catch(err) {
    document.getElementById('content').innerHTML =
      '<div class="error-box" style="margin-top:40px">Erreur : ' + err.message + '</div>';
  }
}

load();
setInterval(load, 30000);
</script>
</body>
</html>`;
}

// ─── Routes ───────────────────────────────────────────────────────────────────

export async function adminRoutes(app: FastifyInstance) {

  app.get('/admin', async (request, reply) => {
    if (!checkBasicAuth(request, reply)) return;
    reply.header('Content-Type', 'text/html; charset=utf-8').header('Cache-Control', 'no-store').send(renderDashboard());
  });

  app.get('/v1/admin/stats', async (request, reply) => {
    if (!checkBasicAuth(request, reply)) return;
    try {
      return reply.send(await fetchStats(app.pool));
    } catch (err) {
      app.log.error(err, 'Admin stats failed');
      return reply.status(500).send({ error: 'Erreur stats' });
    }
  });
}
