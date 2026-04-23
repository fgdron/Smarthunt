-- ============================================================
-- SmartHunt — Schéma de base de données
-- PostgreSQL 16
-- ============================================================


-- ------------------------------------------------------------
-- TAXONOMIE
-- ------------------------------------------------------------

CREATE TABLE categories (
  id          SERIAL PRIMARY KEY,
  slug        VARCHAR(50) UNIQUE NOT NULL,   -- 'frais', 'epicerie', 'hygiene', 'bebe', 'bio'
  label       VARCHAR(100) NOT NULL,
  icon_emoji  VARCHAR(10),
  parent_id   INT REFERENCES categories(id)  -- sous-catégories (ex: "Fromages" sous "Frais")
);

CREATE TABLE subcategories (
  id          SERIAL PRIMARY KEY,
  category_id INT NOT NULL REFERENCES categories(id),
  slug        VARCHAR(50) UNIQUE NOT NULL,
  label       VARCHAR(100) NOT NULL
);


-- ------------------------------------------------------------
-- PRODUITS
-- Le produit est identifié par son EAN — clé centrale du système
-- ------------------------------------------------------------

CREATE TABLE products (
  ean             VARCHAR(13) PRIMARY KEY,     -- Code-barres EAN-13
  name            VARCHAR(255) NOT NULL,
  brand           VARCHAR(100),
  subcategory_id  INT REFERENCES subcategories(id),
  segment         VARCHAR(20) NOT NULL         -- 'national', 'mdd', 'bio', 'bio_village', 'repere'
                  CHECK (segment IN ('national', 'mdd', 'bio', 'bio_village', 'repere')),
  volume_ml       INT,                         -- Contenance pour le calcul prix/L
  weight_g        INT,                         -- Grammage pour le calcul prix/kg
  unit_label      VARCHAR(20),                 -- '825g', 'x40 doses', '1,5L'
  image_url       TEXT,
  bio_alt_ean     VARCHAR(13) REFERENCES products(ean),  -- EAN de l'alternative Bio
  is_top350       BOOLEAN DEFAULT FALSE,       -- Fait partie des 350 indispensables
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);

-- Index pour les recherches fréquentes
CREATE INDEX idx_products_segment ON products(segment);
CREATE INDEX idx_products_top350  ON products(is_top350);


-- ------------------------------------------------------------
-- ENSEIGNES
-- ------------------------------------------------------------

CREATE TABLE stores (
  id      SERIAL PRIMARY KEY,
  slug    VARCHAR(30) UNIQUE NOT NULL,   -- 'leclerc', 'carrefour', 'intermarche'
  name    VARCHAR(100) NOT NULL,
  color   VARCHAR(7),                    -- Couleur hex pour l'UI
  logo_url TEXT
);

CREATE TABLE store_locations (
  id          SERIAL PRIMARY KEY,
  store_id    INT NOT NULL REFERENCES stores(id),
  name        VARCHAR(150),              -- "Leclerc Nantes Nord"
  address     TEXT,
  city        VARCHAR(100),
  postal_code VARCHAR(10),
  lat         DECIMAL(9,6),
  lng         DECIMAL(9,6),
  drive_url   TEXT,                      -- URL du Drive pour le scraping
  is_active   BOOLEAN DEFAULT TRUE
);


-- ------------------------------------------------------------
-- LAYER 1 — PRIX DE BASE PAR ENSEIGNE
-- Mis à jour par scraping Drive (cron quotidien)
-- ------------------------------------------------------------

CREATE TABLE store_prices (
  id              SERIAL PRIMARY KEY,
  ean             VARCHAR(13) NOT NULL REFERENCES products(ean),
  store_id        INT NOT NULL REFERENCES stores(id),
  base_price      DECIMAL(6,2) NOT NULL,       -- Prix sans promo
  in_stock        BOOLEAN DEFAULT TRUE,
  scraped_at      TIMESTAMPTZ DEFAULT NOW(),
  source          VARCHAR(20) DEFAULT 'drive'  -- 'drive', 'manual', 'api'
);

-- On garde l'historique — pas d'UPDATE, on INSERT à chaque scrape
-- La vue ci-dessous donne le dernier prix connu
CREATE UNIQUE INDEX idx_store_prices_latest
  ON store_prices(ean, store_id, scraped_at DESC);

CREATE VIEW latest_store_prices AS
  SELECT DISTINCT ON (ean, store_id)
    ean, store_id, base_price, in_stock, scraped_at
  FROM store_prices
  ORDER BY ean, store_id, scraped_at DESC;


-- ------------------------------------------------------------
-- LAYER 2A — PROMOTIONS CATALOGUE
-- Source : PDF catalogue (OCR) ou API tiers (Tiendeo, Kimbino)
-- ------------------------------------------------------------

CREATE TABLE catalogue_promos (
  id              SERIAL PRIMARY KEY,
  ean             VARCHAR(13) NOT NULL REFERENCES products(ean),
  store_id        INT NOT NULL REFERENCES stores(id),
  promo_type      VARCHAR(20) NOT NULL
                  CHECK (promo_type IN ('percent', 'fixed', 'lot', 'second_half')),
                  -- 'percent'     = -34% immédiat
                  -- 'fixed'       = -1,50€
                  -- 'lot'         = 3 pour 2
                  -- 'second_half' = le 2ème à -50%
  promo_value     DECIMAL(6,2) NOT NULL,  -- 34 si percent, 1.50 si fixed
  promo_label     VARCHAR(80),            -- "-34% immédiat" (affiché en rayon)
  promo_price     DECIMAL(6,2),           -- Prix après promo (calculé ou scrappé)
  valid_from      DATE NOT NULL,
  valid_until     DATE NOT NULL,
  catalogue_page  INT,                    -- Page du catalogue PDF
  source          VARCHAR(30),            -- 'tiendeo', 'kimbino', 'ocr_manual', 'api'
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_catalogue_promos_ean       ON catalogue_promos(ean);
CREATE INDEX idx_catalogue_promos_validity  ON catalogue_promos(valid_from, valid_until);
CREATE INDEX idx_catalogue_promos_store     ON catalogue_promos(store_id);


-- ------------------------------------------------------------
-- LAYER 2B — OFFRES DE REMBOURSEMENT (ODR / Cashback)
-- Source : Shopmium, Coupon Network, Poulpeo, etc.
-- Activation via deep link ou scan ticket
-- ------------------------------------------------------------

CREATE TABLE cashback_offers (
  id              SERIAL PRIMARY KEY,
  ean             VARCHAR(13) NOT NULL REFERENCES products(ean),
  partner         VARCHAR(30) NOT NULL
                  CHECK (partner IN ('shopmium', 'coupon_network', 'poulpeo', 'remise_directe')),
  cashback_amount DECIMAL(5,2) NOT NULL,   -- Montant remboursé en €
  cashback_type   VARCHAR(20) DEFAULT 'scan_ticket'
                  CHECK (cashback_type IN ('scan_ticket', 'qr_code', 'code_promo')),
  deeplink_ios    TEXT,                    -- shopmium://offer/abc123
  deeplink_android TEXT,
  store_ids       INT[],                   -- NULL = valable partout, sinon liste d'IDs enseignes
  min_purchase_qty INT DEFAULT 1,
  valid_from      DATE NOT NULL,
  valid_until     DATE NOT NULL,
  is_exclusive    BOOLEAN DEFAULT FALSE,   -- Offre négociée exclusivement par SmartHunt
  source_ref      VARCHAR(100),            -- ID interne partenaire (pour les APIs)
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_cashback_offers_ean      ON cashback_offers(ean);
CREATE INDEX idx_cashback_offers_partner  ON cashback_offers(partner);
CREATE INDEX idx_cashback_offers_validity ON cashback_offers(valid_from, valid_until);


-- ------------------------------------------------------------
-- LAYER 3 — OPTIMISATIONS CALCULÉES
-- Résultat du moteur de matching EAN
-- Recalculé à chaque mise à jour de store_prices ou promo
-- ------------------------------------------------------------

CREATE TABLE optimizations (
  id                  SERIAL PRIMARY KEY,
  ean                 VARCHAR(13) NOT NULL REFERENCES products(ean),
  store_id            INT NOT NULL REFERENCES stores(id),
  catalogue_promo_id  INT REFERENCES catalogue_promos(id),
  cashback_offer_id   INT REFERENCES cashback_offers(id),

  -- Prix calculés (snapshot au moment du calcul)
  base_price          DECIMAL(6,2) NOT NULL,
  promo_price         DECIMAL(6,2) NOT NULL,   -- Après remise catalogue
  final_price         DECIMAL(6,2) NOT NULL,   -- Après cashback
  savings_amount      DECIMAL(6,2) NOT NULL,   -- base_price - final_price
  savings_percent     SMALLINT NOT NULL,        -- Arrondi entier pour tri

  is_cumul_max        BOOLEAN NOT NULL DEFAULT FALSE,  -- promo + cashback simultanés
  is_nearly_free      BOOLEAN GENERATED ALWAYS AS (final_price < 1.00) STORED,

  computed_at         TIMESTAMPTZ DEFAULT NOW(),
  valid_until         DATE NOT NULL              -- Date d'expiration la plus proche des deux offres
);

CREATE INDEX idx_optimizations_ean      ON optimizations(ean);
CREATE INDEX idx_optimizations_savings  ON optimizations(savings_percent DESC);
CREATE INDEX idx_optimizations_validity ON optimizations(valid_until);
CREATE INDEX idx_optimizations_cumul    ON optimizations(is_cumul_max);


-- ------------------------------------------------------------
-- PANIERS UTILISATEUR
-- ------------------------------------------------------------

CREATE TABLE users (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pseudonym     VARCHAR(50),
  has_shopmium  BOOLEAN,
  total_savings DECIMAL(8,2) DEFAULT 0,
  cagnotte      DECIMAL(6,2) DEFAULT 0,
  level         SMALLINT DEFAULT 1,
  created_at    TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE baskets (
  id          SERIAL PRIMARY KEY,
  user_id     UUID NOT NULL REFERENCES users(id),
  name        VARCHAR(100) DEFAULT 'Ma chasse',
  status      VARCHAR(20) DEFAULT 'active'
              CHECK (status IN ('active', 'shopping', 'completed', 'archived')),
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  completed_at TIMESTAMPTZ
);

CREATE TABLE basket_items (
  id              SERIAL PRIMARY KEY,
  basket_id       INT NOT NULL REFERENCES baskets(id) ON DELETE CASCADE,
  ean             VARCHAR(13) NOT NULL REFERENCES products(ean),
  optimization_id INT REFERENCES optimizations(id),  -- NULL si pas d'optim disponible
  qty             SMALLINT DEFAULT 1,
  is_purchased    BOOLEAN DEFAULT FALSE,
  is_cashback_claimed BOOLEAN DEFAULT FALSE,
  purchased_at    TIMESTAMPTZ,
  added_at        TIMESTAMPTZ DEFAULT NOW()
);

CREATE UNIQUE INDEX idx_basket_items_unique ON basket_items(basket_id, ean);


-- ------------------------------------------------------------
-- COMPARAISON PANIER PAR ENSEIGNE
-- Vue matérialisée mise à jour après chaque modification de panier
-- ------------------------------------------------------------

CREATE TABLE basket_store_comparisons (
  id              SERIAL PRIMARY KEY,
  basket_id       INT NOT NULL REFERENCES baskets(id) ON DELETE CASCADE,
  store_id        INT NOT NULL REFERENCES stores(id),
  total_base      DECIMAL(8,2),  -- Total sans aucune promo
  total_promo     DECIMAL(8,2),  -- Total après promos catalogue
  total_cashback  DECIMAL(6,2),  -- Total des ODR à récupérer
  total_final     DECIMAL(8,2),  -- Net-Net
  items_available INT,           -- Produits disponibles dans cette enseigne
  items_total     INT,
  computed_at     TIMESTAMPTZ DEFAULT NOW()
);


-- ------------------------------------------------------------
-- TICKETS DE CAISSE (VALIDATION POST-ACHAT)
-- ------------------------------------------------------------

CREATE TABLE receipts (
  id              SERIAL PRIMARY KEY,
  basket_id       INT NOT NULL REFERENCES baskets(id),
  store_id        INT REFERENCES stores(id),
  image_url       TEXT,
  ocr_raw         TEXT,              -- Texte brut renvoyé par l'API OCR
  ocr_status      VARCHAR(20) DEFAULT 'pending'
                  CHECK (ocr_status IN ('pending', 'processing', 'done', 'failed')),
  total_detected  DECIMAL(8,2),      -- Montant total lu sur le ticket
  uploaded_at     TIMESTAMPTZ DEFAULT NOW(),
  processed_at    TIMESTAMPTZ
);

CREATE TABLE receipt_line_items (
  id          SERIAL PRIMARY KEY,
  receipt_id  INT NOT NULL REFERENCES receipts(id) ON DELETE CASCADE,
  ean         VARCHAR(13) REFERENCES products(ean),  -- NULL si non reconnu
  name_raw    VARCHAR(255),  -- Libellé brut sur le ticket
  price_raw   DECIMAL(6,2),
  matched     BOOLEAN DEFAULT FALSE
);


-- ------------------------------------------------------------
-- COMMUNAUTÉ — SIGNALEMENTS ANTI-GASPI
-- ------------------------------------------------------------

CREATE TABLE community_reports (
  id              SERIAL PRIMARY KEY,
  user_id         UUID REFERENCES users(id),
  store_location_id INT REFERENCES store_locations(id),
  discount_pct    SMALLINT,              -- Ex: 50 pour -50%
  description     TEXT,
  photo_url       TEXT,
  lat             DECIMAL(9,6),
  lng             DECIMAL(9,6),
  upvotes         INT DEFAULT 0,
  is_active       BOOLEAN DEFAULT TRUE,
  expires_at      TIMESTAMPTZ,           -- Auto-expire après 24h si non confirmé
  reported_at     TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_community_reports_geo
  ON community_reports USING GIST (point(lng, lat));  -- Recherche géographique
