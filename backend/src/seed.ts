/**
 * Script de seed — peuple la base avec les enseignes supportées.
 * npx tsx src/seed.ts
 *
 * Ne crée les enseignes que si elles n'existent pas encore.
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// IDs alignés avec StoreId de data/productsDB.ts
const STORES = [
  { id: 'leclerc',     name: 'E.Leclerc',   color: '#0055A5', lat: 48.830, lng: 2.265 },
  { id: 'superu',      name: 'Super U',     color: '#00853F', lat: 48.847, lng: 2.439 },
  { id: 'carrefour',   name: 'Carrefour',   color: '#E31E24', lat: 48.815, lng: 2.318 },
  { id: 'intermarche', name: 'Intermarché', color: '#F6B300', lat: 48.865, lng: 2.380 },
  { id: 'auchan',      name: 'Auchan',      color: '#E87B20', lat: 48.910, lng: 2.440 },
  { id: 'monoprix',    name: 'Monoprix',    color: '#444444', lat: 48.876, lng: 2.335 },
  { id: 'lidl',        name: 'Lidl',        color: '#0050AA', lat: 48.826, lng: 2.366 },
  { id: 'aldi',        name: 'Aldi',        color: '#1E56A0', lat: 48.807, lng: 2.384 },
];

async function main() {
  console.log('🌱 Seeding stores...');

  for (const store of STORES) {
    await prisma.store.upsert({
      where:  { id: store.id },
      create: store,
      update: { name: store.name, color: store.color, lat: store.lat, lng: store.lng },
    });
    console.log(`  ✓ ${store.name}`);
  }

  console.log(`\n✅ ${STORES.length} stores seeded.`);
}

main()
  .catch(e => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
