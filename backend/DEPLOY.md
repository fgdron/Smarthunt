# Déploiement SmartHunt Backend sur Railway

## Prérequis
- Compte Railway : https://railway.app (gratuit pour démarrer)
- CLI Railway installé : `npm install -g @railway/cli`
- Git initialisé dans le dossier `backend/`

---

## 1. Initialiser git dans `backend/`

```bash
cd backend/
git init
git add .
git commit -m "Initial SmartHunt backend"
```

## 2. Se connecter à Railway

```bash
railway login
```

## 3. Créer le projet et la base PostgreSQL

```bash
railway init          # → Nouveau projet "smarthunt-backend"
railway add --plugin postgresql   # → Crée une base Postgres managed
```

## 4. Configurer les variables d'environnement

Railway injecte automatiquement `DATABASE_URL` depuis le plugin PostgreSQL.
Il reste à définir les autres :

```bash
railway variables set NODE_ENV=production
railway variables set PORT=3000
railway variables set HOST=0.0.0.0
railway variables set INTERNAL_API_KEY=$(openssl rand -hex 32)
railway variables set RATE_LIMIT_MAX=100
railway variables set ALLOWED_ORIGINS=https://smarthunt.app
```

> Notez la valeur de `INTERNAL_API_KEY` — elle sera nécessaire pour le scraper.

## 5. Déployer

```bash
railway up
```

Railway détecte le `Dockerfile`, build l'image, exécute les migrations Prisma
et démarre le serveur. Le déploiement prend ~2 minutes.

## 6. Récupérer l'URL publique

```bash
railway domain
```

Exemple : `https://smarthunt-backend-production.up.railway.app`

## 7. Brancher l'app mobile

Dans `services/api.ts`, remplacer :
```ts
export const API_BASE_URL = 'https://api.smarthunt.app/v1';
```
Par :
```ts
export const API_BASE_URL = 'https://smarthunt-backend-production.up.railway.app/v1';
```

## 8. Seed des enseignes (première fois)

```bash
railway run npx tsx src/seed.ts
```

## 9. Vérifier le health check

```bash
curl https://smarthunt-backend-production.up.railway.app/health
# → { "status": "ok", "timestamp": "...", "version": "2.0.0" }
```

---

## Tester en local avant déploiement

```bash
cp .env.example .env
# → Remplir DATABASE_URL (Postgres local) + INTERNAL_API_KEY

npm install
npm run db:generate
npm run db:migrate
npx tsx src/seed.ts
npm run dev
# → SmartHunt API V2 démarré sur http://0.0.0.0:3000

# Test health
curl http://localhost:3000/health

# Test produits (sans GPS)
curl http://localhost:3000/v1/products

# Test enseignes proches (Paris)
curl "http://localhost:3000/v1/stores/nearby?lat=48.8566&lng=2.3522"

# Test offres
curl http://localhost:3000/v1/offers
```

---

## Redéploiement automatique

Chaque `git push` vers la branche connectée déclenche un nouveau build Railway.
Les migrations Prisma sont toujours appliquées avant le démarrage.
