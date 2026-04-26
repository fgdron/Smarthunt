/**
 * Admin Dashboard — SmartHunt Centre de Contrôle
 *
 * GET /admin          → Dashboard HTML (protégé Basic Auth)
 * GET /v1/admin/stats → Métriques JSON (protégé Basic Auth)
 *
 * Variables d'env requises :
 *   ADMIN_USERNAME  (défaut : "admin")
 *   ADMIN_PASSWORD  (défaut : "smarthunt2024" — à changer en prod !)
 */

import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';

// ─── Auth helper ──────────────────────────────────────────────────────────────

function checkBasicAuth(request: FastifyRequest, reply: FastifyReply): boolean {
  const expectedUser = process.env.ADMIN_USERNAME ?? 'admin';
  const expectedPass = process.env.ADMIN_PASSWORD ?? 'smarthunt2024';
  const expected     = Buffer.from(`${expectedUser}:${expectedPass}`).toString('base64');

  const auth = request.headers['authorization'] ?? '';
  if (!auth.startsWith('Basic ') || auth.slice(6) !== expected) {
    reply
      .status(401)
      .header('WWW-Authenticate', 'Basic realm="SmartHunt Admin"')
      .send('Accès non autorisé');
    return false;
  }
  return true;
}

// ─── Stats SQL ────────────────────────────────────────────────────────────────

async function fetchStats(pool: FastifyInstance['pool']) {
  const [catalogue, promos, offers, community, stores, activity, topCategories] =
    await Promise.all([

      // 1. Catalogue
      pool.query(`
        SELECT
          (SELECT COUNT(*)::int FROM product_groups)   AS groups,
          (SELECT COUNT(*)::int FROM product_variants) AS variants,
          (SELECT COUNT(*)::int FROM store_prices)     AS prices,
          (SELECT TO_CHAR(MAX("updatedAt"), 'DD/MM/YYYY HH24:MI') FROM store_prices) AS last_price_update,
          (SELECT COUNT(DISTINCT "storeId")::int FROM store_prices) AS stores_with_prices
      `),

      // 2. Promos catalogue
      pool.query(`
        SELECT
          COUNT(*)::int AS total,
          COUNT(*) FILTER (WHERE "validUntil" IS NULL OR "validUntil" > NOW())::int AS active,
          ROUND(AVG(value) FILTER (WHERE type = 'percent')::numeric, 1) AS avg_discount_pct,
          COUNT(*) FILTER (WHERE type = 'percent')::int  AS type_percent,
          COUNT(*) FILTER (WHERE type = 'immediate')::int AS type_immediate,
          COUNT(*) FILTER (WHERE type = 'volume')::int   AS type_volume,
          COUNT(*) FILTER (WHERE type = 'bundle')::int   AS type_bundle
        FROM catalogue_promos
      `),

      // 3. ODR / Cashback offers
      pool.query(`
        SELECT
          COUNT(*)::int AS total,
          COUNT(*) FILTER (WHERE "validUntil" > NOW() AND active = true)::int AS active,
          ROUND(COALESCE(SUM(amount) FILTER (WHERE "validUntil" > NOW() AND active = true), 0)::numeric, 2) AS total_amount,
          COUNT(*) FILTER (WHERE "validUntil" BETWEEN NOW() AND NOW() + INTERVAL '7 days' AND active = true)::int AS expiring_soon,
          ROUND(COALESCE(AVG(amount) FILTER (WHERE active = true AND "validUntil" > NOW()), 0)::numeric, 2) AS avg_amount
        FROM cashback_offers
      `),

      // 4. Community promos
      pool.query(`
        SELECT
          COUNT(*)::int AS total,
          COUNT(*) FILTER (WHERE status = 'pending')::int   AS pending,
          COUNT(*) FILTER (WHERE status = 'confirmed')::int AS confirmed,
          COUNT(*) FILTER (WHERE status = 'rejected')::int  AS rejected,
          COUNT(*) FILTER (WHERE status = 'expired')::int   AS expired,
          COUNT(*) FILTER (WHERE "createdAt" > NOW() - INTERVAL '24 hours')::int AS today,
          COUNT(DISTINCT "reporterId")::int AS unique_reporters,
          (SELECT COUNT(*)::int FROM community_votes) AS total_votes,
          (SELECT COUNT(*)::int FROM community_votes WHERE "createdAt" > NOW() - INTERVAL '24 hours') AS votes_today
        FROM community_promos
      `),

      // 5. Couverture par enseigne
      pool.query(`
        SELECT
          s.name,
          s.color,
          COUNT(sp."variantId")::int AS price_count,
          ROUND(AVG(sp.price)::numeric, 2) AS avg_price,
          MAX(sp."updatedAt") AS last_update
        FROM stores s
        LEFT JOIN store_prices sp ON s.id = sp."storeId"
        GROUP BY s.id, s.name, s.color
        ORDER BY price_count DESC
      `),

      // 6. Activité communautaire 7 derniers jours
      pool.query(`
        SELECT
          TO_CHAR(DATE("createdAt"), 'DD/MM') AS day,
          COUNT(*)::int AS count
        FROM community_promos
        WHERE "createdAt" > NOW() - INTERVAL '7 days'
        GROUP BY DATE("createdAt")
        ORDER BY DATE("createdAt") ASC
      `),

      // 7. Top catégories (nb variantes)
      pool.query(`
        SELECT
          "categorySlug" AS category,
          COUNT(*)::int AS group_count
        FROM product_groups
        GROUP BY "categorySlug"
        ORDER BY group_count DESC
        LIMIT 8
      `),
    ]);

  return {
    generated_at:  new Date().toISOString(),
    catalogue:     catalogue.rows[0],
    promos:        promos.rows[0],
    offers:        offers.rows[0],
    community:     community.rows[0],
    stores:        stores.rows,
    activity:      activity.rows,
    top_categories: topCategories.rows,
  };
}

// ─── HTML Dashboard ───────────────────────────────────────────────────────────

function renderDashboard(): string {
  return `<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>SmartHunt — Centre de Contrôle</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }

    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
      background: #0A0A0F;
      color: #E8E8F0;
      min-height: 100vh;
      padding: 24px;
    }

    header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      margin-bottom: 32px;
      padding-bottom: 20px;
      border-bottom: 1px solid #2A2A3E;
    }

    .logo { font-size: 22px; font-weight: 800; color: #00FF88; letter-spacing: -0.5px; }
    .logo span { color: #E8E8F0; }

    .refresh-info {
      font-size: 12px;
      color: #6A6A7A;
    }
    .refresh-info b { color: #00B4FF; }

    .last-update {
      font-size: 11px;
      color: #4A4A5A;
      margin-top: 4px;
      text-align: right;
    }

    /* ── Grid sections ── */
    .section-title {
      font-size: 11px;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 1.2px;
      color: #6A6A7A;
      margin-bottom: 12px;
      margin-top: 28px;
    }

    .grid-4 { display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px; }
    .grid-3 { display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px; }
    .grid-2 { display: grid; grid-template-columns: repeat(2, 1fr); gap: 12px; }

    @media (max-width: 900px) {
      .grid-4, .grid-3 { grid-template-columns: repeat(2, 1fr); }
    }
    @media (max-width: 500px) {
      .grid-4, .grid-3, .grid-2 { grid-template-columns: 1fr; }
    }

    /* ── Cards ── */
    .card {
      background: #141420;
      border: 1px solid #2A2A3E;
      border-radius: 12px;
      padding: 18px 20px;
    }

    .card-label {
      font-size: 11px;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.8px;
      color: #6A6A7A;
      margin-bottom: 8px;
    }

    .card-value {
      font-size: 32px;
      font-weight: 800;
      line-height: 1;
      margin-bottom: 4px;
    }

    .card-sub {
      font-size: 12px;
      color: #6A6A7A;
      margin-top: 4px;
    }

    .card-sub b { color: #A0A0B0; }

    .green  { color: #00FF88; }
    .blue   { color: #00B4FF; }
    .gold   { color: #FFD700; }
    .orange { color: #FF6B35; }
    .muted  { color: #8A8A9A; }
    .red    { color: #FF4444; }

    /* ── Status pill ── */
    .pill {
      display: inline-flex;
      align-items: center;
      gap: 5px;
      font-size: 11px;
      font-weight: 600;
      padding: 3px 10px;
      border-radius: 100px;
    }
    .pill-green  { background: #00FF8820; color: #00FF88; }
    .pill-orange { background: #FF6B3520; color: #FF6B35; }
    .pill-red    { background: #FF444420; color: #FF4444; }
    .pill-blue   { background: #00B4FF20; color: #00B4FF; }
    .pill-muted  { background: #2A2A3E; color: #8A8A9A; }

    .dot { width: 6px; height: 6px; border-radius: 50%; background: currentColor; }

    /* ── Table stores ── */
    .stores-table { width: 100%; border-collapse: collapse; }
    .stores-table th {
      text-align: left;
      font-size: 10px;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.8px;
      color: #4A4A5A;
      padding: 8px 12px;
      border-bottom: 1px solid #2A2A3E;
    }
    .stores-table td {
      padding: 10px 12px;
      font-size: 13px;
      border-bottom: 1px solid #1C1C2E;
      vertical-align: middle;
    }
    .stores-table tr:last-child td { border-bottom: none; }

    .store-dot {
      display: inline-block;
      width: 10px; height: 10px;
      border-radius: 50%;
      margin-right: 8px;
      vertical-align: middle;
    }

    .bar-bg {
      background: #2A2A3E;
      border-radius: 4px;
      height: 6px;
      width: 100%;
      margin-top: 4px;
    }
    .bar-fill {
      background: #00FF88;
      border-radius: 4px;
      height: 6px;
    }

    /* ── Activity chart ── */
    .chart-bars {
      display: flex;
      align-items: flex-end;
      gap: 8px;
      height: 80px;
      margin-top: 12px;
    }
    .chart-bar-wrap {
      flex: 1;
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 4px;
    }
    .chart-bar {
      width: 100%;
      background: #00B4FF40;
      border-radius: 4px 4px 0 0;
      border: 1px solid #00B4FF60;
      transition: height 0.4s ease;
    }
    .chart-label {
      font-size: 9px;
      color: #4A4A5A;
      white-space: nowrap;
    }
    .chart-count {
      font-size: 10px;
      color: #00B4FF;
      font-weight: 700;
    }

    /* ── Category pills ── */
    .cat-grid { display: flex; flex-wrap: wrap; gap: 8px; margin-top: 8px; }
    .cat-pill {
      background: #1C1C2E;
      border: 1px solid #2A2A3E;
      border-radius: 8px;
      padding: 6px 12px;
      font-size: 12px;
      display: flex;
      justify-content: space-between;
      align-items: center;
      gap: 12px;
      min-width: 120px;
    }
    .cat-name { color: #A0A0B0; }
    .cat-count { color: #00FF88; font-weight: 700; }

    /* ── Community breakdown ── */
    .community-bar {
      height: 8px;
      border-radius: 4px;
      background: #2A2A3E;
      overflow: hidden;
      display: flex;
      margin: 12px 0 6px;
    }
    .cb-confirmed { background: #00FF88; }
    .cb-pending   { background: #FFD700; }
    .cb-rejected  { background: #FF4444; }
    .cb-expired   { background: #4A4A5A; }

    .cb-legend {
      display: flex;
      gap: 12px;
      flex-wrap: wrap;
      font-size: 11px;
    }
    .cb-legend-item { display: flex; align-items: center; gap: 5px; }
    .cb-dot { width: 8px; height: 8px; border-radius: 50%; }

    /* ── Loading ── */
    .loading {
      text-align: center;
      padding: 60px;
      color: #4A4A5A;
      font-size: 14px;
    }
    .spinner {
      display: inline-block;
      width: 24px; height: 24px;
      border: 2px solid #2A2A3E;
      border-top-color: #00FF88;
      border-radius: 50%;
      animation: spin 0.8s linear infinite;
      margin-bottom: 12px;
    }
    @keyframes spin { to { transform: rotate(360deg); } }

    /* ── Error ── */
    .error-box {
      background: #FF444415;
      border: 1px solid #FF444440;
      border-radius: 12px;
      padding: 20px;
      text-align: center;
      color: #FF4444;
      font-size: 14px;
    }

    .section-card {
      background: #141420;
      border: 1px solid #2A2A3E;
      border-radius: 12px;
      padding: 20px;
    }
  </style>
</head>
<body>

<header>
  <div>
    <div class="logo">Smart<span>Hunt</span> <span style="color:#4A4A5A;font-weight:400;font-size:14px">/ Centre de Contrôle</span></div>
  </div>
  <div>
    <div class="refresh-info">Actualisation auto toutes les <b>30s</b></div>
    <div class="last-update" id="lastUpdate">—</div>
  </div>
</header>

<div id="content">
  <div class="loading">
    <div class="spinner"></div><br>
    Chargement des données…
  </div>
</div>

<script>
  let maxPriceCount = 1;

  function fmt(n, decimals = 0) {
    if (n == null) return '—';
    return Number(n).toLocaleString('fr-FR', { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
  }

  function pill(text, type) {
    return '<span class="pill pill-' + type + '"><span class="dot"></span>' + text + '</span>';
  }

  function renderStores(stores) {
    if (!stores || stores.length === 0) return '<div class="muted" style="font-size:13px;padding:12px">Aucun magasin</div>';
    const max = Math.max(...stores.map(s => s.price_count || 0), 1);
    return '<table class="stores-table"><thead><tr>' +
      '<th>Enseigne</th><th>Prix</th><th>Prix moy.</th><th>Couverture</th><th>Dernière MAJ</th>' +
      '</tr></thead><tbody>' +
      stores.map(s => {
        const pct = Math.round(((s.price_count || 0) / max) * 100);
        const date = s.last_update ? new Date(s.last_update).toLocaleDateString('fr-FR') : '—';
        return '<tr>' +
          '<td><span class="store-dot" style="background:' + (s.color || '#4A4A5A') + '"></span>' + s.name + '</td>' +
          '<td class="' + (s.price_count > 0 ? 'green' : 'muted') + '" style="font-weight:700">' + fmt(s.price_count) + '</td>' +
          '<td class="muted">' + (s.avg_price ? fmt(s.avg_price, 2) + ' €' : '—') + '</td>' +
          '<td style="width:120px"><div class="bar-bg"><div class="bar-fill" style="width:' + pct + '%"></div></div></td>' +
          '<td class="muted" style="font-size:11px">' + date + '</td>' +
          '</tr>';
      }).join('') +
      '</tbody></table>';
  }

  function renderActivity(activity) {
    if (!activity || activity.length === 0) {
      return '<div class="muted" style="font-size:12px;padding-top:12px">Aucune activité</div>';
    }
    const max = Math.max(...activity.map(a => a.count), 1);
    return '<div class="chart-bars">' +
      activity.map(a => {
        const h = Math.max(8, Math.round((a.count / max) * 80));
        return '<div class="chart-bar-wrap">' +
          '<div class="chart-count">' + a.count + '</div>' +
          '<div class="chart-bar" style="height:' + h + 'px"></div>' +
          '<div class="chart-label">' + a.day + '</div>' +
          '</div>';
      }).join('') +
      '</div>';
  }

  function renderCommunityBar(community) {
    const total = community.total || 1;
    const confirmed = Math.round(((community.confirmed || 0) / total) * 100);
    const pending   = Math.round(((community.pending   || 0) / total) * 100);
    const rejected  = Math.round(((community.rejected  || 0) / total) * 100);
    const expired   = 100 - confirmed - pending - rejected;
    return '<div class="community-bar">' +
      '<div class="cb-confirmed" style="width:' + confirmed + '%"></div>' +
      '<div class="cb-pending"   style="width:' + pending   + '%"></div>' +
      '<div class="cb-rejected"  style="width:' + rejected  + '%"></div>' +
      '<div class="cb-expired"   style="width:' + Math.max(0,expired) + '%"></div>' +
      '</div>' +
      '<div class="cb-legend">' +
      '<div class="cb-legend-item"><div class="cb-dot" style="background:#00FF88"></div><span class="muted">Confirmés <b class="green">' + (community.confirmed||0) + '</b></span></div>' +
      '<div class="cb-legend-item"><div class="cb-dot" style="background:#FFD700"></div><span class="muted">En attente <b class="gold">' + (community.pending||0) + '</b></span></div>' +
      '<div class="cb-legend-item"><div class="cb-dot" style="background:#FF4444"></div><span class="muted">Rejetés <b class="red">' + (community.rejected||0) + '</b></span></div>' +
      '<div class="cb-legend-item"><div class="cb-dot" style="background:#4A4A5A"></div><span class="muted">Expirés <b>' + (community.expired||0) + '</b></span></div>' +
      '</div>';
  }

  function render(data) {
    const c  = data.catalogue;
    const p  = data.promos;
    const o  = data.offers;
    const co = data.community;

    const html = \`
      <div class="section-title">📦 Catalogue produits</div>
      <div class="grid-4">
        <div class="card">
          <div class="card-label">Groupes produits</div>
          <div class="card-value green">\${fmt(c.groups)}</div>
          <div class="card-sub">catégories génériques</div>
        </div>
        <div class="card">
          <div class="card-label">Variantes (EAN)</div>
          <div class="card-value blue">\${fmt(c.variants)}</div>
          <div class="card-sub">marques, formats, segments</div>
        </div>
        <div class="card">
          <div class="card-label">Prix constatés</div>
          <div class="card-value gold">\${fmt(c.prices)}</div>
          <div class="card-sub">MAJ : <b>\${c.last_price_update || '—'}</b></div>
        </div>
        <div class="card">
          <div class="card-label">Enseignes avec prix</div>
          <div class="card-value orange">\${fmt(c.stores_with_prices)}</div>
          <div class="card-sub">sur \${data.stores.length} magasins</div>
        </div>
      </div>

      <div class="section-title">🏷️ Promos catalogue</div>
      <div class="grid-4">
        <div class="card">
          <div class="card-label">Promos actives</div>
          <div class="card-value green">\${fmt(p.active)}</div>
          <div class="card-sub">sur \${fmt(p.total)} total</div>
        </div>
        <div class="card">
          <div class="card-label">Remise moy. (%)</div>
          <div class="card-value blue">\${p.avg_discount_pct ? fmt(p.avg_discount_pct, 1) + '%' : '—'}</div>
          <div class="card-sub">promos en pourcentage</div>
        </div>
        <div class="card">
          <div class="card-label">Types de promo</div>
          <div class="card-value muted" style="font-size:14px;margin-top:6px">
            \${['Remise %', 'Immédiate', 'Volume', 'Bundle'].map((t,i) => {
              const v = [p.type_percent, p.type_immediate, p.type_volume, p.type_bundle][i];
              return '<div style="display:flex;justify-content:space-between;padding:2px 0">' +
                '<span class="muted">' + t + '</span><b style="color:#E8E8F0">' + (v||0) + '</b></div>';
            }).join('')}
          </div>
        </div>
        <div class="card">
          <div class="card-label">Catégories top</div>
          <div class="cat-grid">
            \${(data.top_categories || []).slice(0,6).map(cat =>
              '<div class="cat-pill"><span class="cat-name">' + cat.category + '</span><span class="cat-count">' + cat.group_count + '</span></div>'
            ).join('')}
          </div>
        </div>
      </div>

      <div class="section-title">💰 ODR & Cashback</div>
      <div class="grid-4">
        <div class="card">
          <div class="card-label">Offres actives</div>
          <div class="card-value green">\${fmt(o.active)}</div>
          <div class="card-sub">sur \${fmt(o.total)} total</div>
        </div>
        <div class="card">
          <div class="card-label">Montant total ODR</div>
          <div class="card-value gold">\${fmt(o.total_amount, 2)} €</div>
          <div class="card-sub">cumulé sur offres actives</div>
        </div>
        <div class="card">
          <div class="card-label">Remboursement moy.</div>
          <div class="card-value blue">\${fmt(o.avg_amount, 2)} €</div>
          <div class="card-sub">par offre ODR active</div>
        </div>
        <div class="card">
          <div class="card-label">Expiration J+7</div>
          <div class="card-value \${o.expiring_soon > 0 ? 'orange' : 'muted'}">\${fmt(o.expiring_soon)}</div>
          <div class="card-sub">\${o.expiring_soon > 0 ? pill('À renouveler', 'orange') : pill('OK', 'green')}</div>
        </div>
      </div>

      <div class="section-title">👥 Communauté</div>
      <div class="grid-3">
        <div class="card">
          <div class="card-label">Signalements</div>
          <div class="card-value blue">\${fmt(co.total)}</div>
          <div class="card-sub"><b class="green">+\${co.today||0}</b> aujourd'hui · <b>\${co.unique_reporters||0}</b> contributeurs</div>
        </div>
        <div class="card">
          <div class="card-label">Votes</div>
          <div class="card-value gold">\${fmt(co.total_votes)}</div>
          <div class="card-sub"><b class="blue">+\${co.votes_today||0}</b> ces 24h</div>
        </div>
        <div class="card" style="grid-column: span 1">
          <div class="card-label">Taux de confirmation</div>
          <div class="card-value green">\${co.total > 0 ? Math.round(((co.confirmed||0) / co.total) * 100) : 0}%</div>
          <div class="card-sub">\${co.confirmed||0} promos vérifiées communautairement</div>
        </div>
      </div>

      <div class="section-title" style="margin-top:16px">Répartition signalements</div>
      <div class="section-card">
        \${renderCommunityBar(co)}
      </div>

      <div class="section-title">🏪 Couverture par enseigne</div>
      <div class="section-card">
        \${renderStores(data.stores)}
      </div>

      <div class="section-title">📈 Activité communautaire (7 jours)</div>
      <div class="section-card">
        \${data.activity.length > 0
          ? renderActivity(data.activity)
          : '<div class="muted" style="font-size:13px;padding:12px 0">Aucune activité cette semaine</div>'}
      </div>
    \`;

    document.getElementById('content').innerHTML = html;
    document.getElementById('lastUpdate').textContent =
      'Actualisé à ' + new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  }

  async function load() {
    try {
      const res = await fetch('/v1/admin/stats');
      if (!res.ok) throw new Error('HTTP ' + res.status);
      const data = await res.json();
      render(data);
    } catch (err) {
      document.getElementById('content').innerHTML =
        '<div class="error-box">Erreur de chargement : ' + err.message + '</div>';
    }
  }

  load();
  setInterval(load, 30_000);
</script>
</body>
</html>`;
}

// ─── Routes ───────────────────────────────────────────────────────────────────

export async function adminRoutes(app: FastifyInstance) {

  // ── GET /admin → Dashboard HTML ─────────────────────────────────────────────
  app.get('/admin', async (request, reply) => {
    if (!checkBasicAuth(request, reply)) return;

    reply
      .header('Content-Type', 'text/html; charset=utf-8')
      .header('Cache-Control', 'no-store')
      .send(renderDashboard());
  });

  // ── GET /v1/admin/stats → JSON métriques ────────────────────────────────────
  app.get('/v1/admin/stats', async (request, reply) => {
    if (!checkBasicAuth(request, reply)) return;

    try {
      const stats = await fetchStats(app.pool);
      return reply.send(stats);
    } catch (err) {
      app.log.error(err, 'Admin stats query failed');
      return reply.status(500).send({ error: 'Erreur lors du chargement des stats' });
    }
  });
}
