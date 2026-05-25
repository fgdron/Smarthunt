/**
 * SmartHunt — lidl search adapter
 * ⚠️  TODO : remplir SEARCH_URL + parseHit() après discovery DevTools
 */
import type { StoreProduct } from '../index.js';

const SEARCH_URL = ''; // TODO

export async function lidlSearch(
  _query: string,
  _lat?:  number,
  _lng?:  number,
): Promise<StoreProduct[]> {
  if (!SEARCH_URL) return []; // pas encore configuré
  // TODO: implémenter comme carrefour.ts
  return [];
}
