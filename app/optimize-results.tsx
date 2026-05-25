/**
 * Écran résultats — Stratégies d'optimisation panier
 *
 * Affiche les 4 stratégies avec économies calculées.
 * L'utilisateur peut explorer chaque stratégie et voir le détail produit par produit.
 */

import { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  ActivityIndicator, Alert,
} from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as Location from 'expo-location';
import {
  ArrowLeft, Sparkles, ChevronDown, ChevronUp,
  MapPin, TrendingDown, Star,
} from 'lucide-react-native';
import { Colors } from '@/constants/theme';
import { useSmartHuntStore } from '@/store/useSmartHuntStore';
import { API_URL } from '@/services/api';

// ─── Types ───────────────────────────────────────────────────────────────────

interface StrategyItem {
  original_name:  string;
  matched_name:   string;
  original_price: number;
  best_price:     number;
  savings:        number;
  store_id:       string;
  store_name:     string;
  is_mdd:         boolean;
  promo_label?:   string;
}

interface Strategy {
  id:          string;
  title:       string;
  description: string;
  total:       number;
  savings:     number;
  savings_pct: number;
  items:       StrategyItem[];
  stores:      string[];
}

// ─── Couleurs par stratégie ──────────────────────────────────────────────────

const STRATEGY_COLORS: Record<string, string> = {
  'best-price': Colors.neonGreen,
  'best-store': Colors.electricBlue,
  'mdd':        '#FF9500',
  'promos':     '#FF2D55',
};

const STRATEGY_EMOJI: Record<string, string> = {
  'best-price': '🏆',
  'best-store': '🏪',
  'mdd':        '🏷️',
  'promos':     '⚡',
};

// ─── Composant carte stratégie ───────────────────────────────────────────────

function StrategyCard({
  strategy,
  originalTotal,
  isFirst,
}: {
  strategy:      Strategy;
  originalTotal: number;
  isFirst:       boolean;
}) {
  const [expanded, setExpanded] = useState(isFirst);
  const color = STRATEGY_COLORS[strategy.id] ?? Colors.neonGreen;

  return (
    <View style={[styles.strategyCard, isFirst && { borderColor: color, borderWidth: 2 }]}>
      {/* Badge meilleure option */}
      {isFirst && (
        <View style={[styles.bestBadge, { backgroundColor: color }]}>
          <Star size={10} color={Colors.background} fill={Colors.background} />
          <Text style={styles.bestBadgeText}>Meilleure option</Text>
        </View>
      )}

      <TouchableOpacity
        style={styles.strategyHeader}
        onPress={() => setExpanded(v => !v)}
        activeOpacity={0.8}
      >
        <Text style={styles.strategyEmoji}>{STRATEGY_EMOJI[strategy.id]}</Text>

        <View style={styles.strategyMeta}>
          <Text style={styles.strategyTitle}>{strategy.title}</Text>
          <Text style={styles.strategyDesc} numberOfLines={1}>{strategy.description}</Text>
        </View>

        <View style={styles.strategyRight}>
          {strategy.savings > 0 ? (
            <>
              <Text style={[styles.strategySavings, { color }]}>
                -{strategy.savings.toFixed(2)} €
              </Text>
              <Text style={styles.strategySavingsPct}>
                -{strategy.savings_pct}%
              </Text>
            </>
          ) : (
            <Text style={styles.noSavings}>Pas d'éco.</Text>
          )}
          {expanded
            ? <ChevronUp size={16} color={Colors.textMuted} />
            : <ChevronDown size={16} color={Colors.textMuted} />
          }
        </View>
      </TouchableOpacity>

      {/* Total */}
      <View style={styles.strategyTotalRow}>
        <Text style={styles.strategyTotalLabel}>Total</Text>
        <Text style={styles.strategyTotalAmount}>{strategy.total.toFixed(2)} €</Text>
      </View>

      {/* Détail produits */}
      {expanded && strategy.items.length > 0 && (
        <View style={styles.itemList}>
          {strategy.items.map((item, i) => (
            <View key={i} style={styles.itemRow}>
              <View style={styles.itemLeft}>
                <Text style={styles.itemName} numberOfLines={1}>{item.matched_name}</Text>
                <View style={styles.itemTags}>
                  {item.is_mdd && (
                    <View style={styles.mddTag}>
                      <Text style={styles.mddTagText}>MDD</Text>
                    </View>
                  )}
                  {item.promo_label && (
                    <View style={styles.promoTag}>
                      <Text style={styles.promoTagText} numberOfLines={1}>{item.promo_label}</Text>
                    </View>
                  )}
                </View>
                <View style={styles.storeRow}>
                  <MapPin size={10} color={Colors.textMuted} />
                  <Text style={styles.storeName}>{item.store_name}</Text>
                </View>
              </View>

              <View style={styles.itemRight}>
                {item.savings > 0 && (
                  <Text style={styles.itemOriginal}>
                    {item.original_price.toFixed(2)} €
                  </Text>
                )}
                <Text style={[styles.itemPrice, { color: item.savings > 0 ? color : Colors.text }]}>
                  {item.best_price.toFixed(2)} €
                </Text>
              </View>
            </View>
          ))}
        </View>
      )}
    </View>
  );
}

// ─── Écran principal ─────────────────────────────────────────────────────────

export default function OptimizeResultsScreen() {
  const router        = useRouter();
  const importedBasket = useSmartHuntStore(s => s.importedBasket);

  const [loading,       setLoading]       = useState(true);
  const [strategies,    setStrategies]    = useState<Strategy[]>([]);
  const [originalTotal, setOriginalTotal] = useState(0);
  const [error,         setError]         = useState<string | null>(null);

  useEffect(() => {
    if (importedBasket.length === 0) {
      router.back();
      return;
    }
    runOptimization();
  }, []);

  async function runOptimization() {
    setLoading(true);
    setError(null);

    // Récupère la position GPS
    let lat: number | undefined;
    let lng: number | undefined;

    try {
      const { status } = await Location.getForegroundPermissionsAsync();
      if (status === 'granted') {
        const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
        lat = loc.coords.latitude;
        lng = loc.coords.longitude;
      }
    } catch { /* GPS non disponible → optimisation sans filtre géo */ }

    try {
      const res = await fetch(`${API_URL}/v1/basket/optimize`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({
          products:  importedBasket,
          lat,
          lng,
          radiusKm:  15,
          maxStores: 3,
        }),
      });

      if (!res.ok) throw new Error(`HTTP ${res.status}`);

      const data = await res.json() as { strategies: Strategy[]; originalTotal: number };
      setStrategies(data.strategies);
      setOriginalTotal(data.originalTotal);
    } catch (err) {
      setError('Impossible d\'optimiser le panier. Vérifie ta connexion.');
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  const bestSavings = strategies[0]?.savings ?? 0;

  return (
    <SafeAreaView style={styles.container}>
      {/* Barre du haut */}
      <View style={styles.topBar}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <ArrowLeft size={22} color={Colors.text} />
        </TouchableOpacity>
        <Text style={styles.screenTitle}>Optimisation</Text>
        <View style={{ width: 40 }} />
      </View>

      {/* Chargement */}
      {loading && (
        <View style={styles.centerBox}>
          <ActivityIndicator size="large" color={Colors.neonGreen} />
          <Text style={styles.loadingText}>Analyse des prix dans les magasins proches…</Text>
        </View>
      )}

      {/* Erreur */}
      {!loading && error && (
        <View style={styles.centerBox}>
          <Text style={styles.errorText}>{error}</Text>
          <TouchableOpacity style={styles.retryBtn} onPress={runOptimization}>
            <Text style={styles.retryBtnText}>Réessayer</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Résultats */}
      {!loading && !error && strategies.length > 0 && (
        <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>

          {/* Résumé */}
          <View style={styles.summaryBox}>
            <Sparkles size={20} color={Colors.neonGreen} />
            <View style={{ flex: 1 }}>
              <Text style={styles.summaryTitle}>
                Jusqu'à {bestSavings.toFixed(2)} € d'économies
              </Text>
              <Text style={styles.summarySubtitle}>
                Panier actuel : {originalTotal.toFixed(2)} € · {importedBasket.length} produits
              </Text>
            </View>
          </View>

          {/* Cartes stratégies */}
          <View style={styles.strategiesList}>
            {strategies.map((s, i) => (
              <StrategyCard
                key={s.id}
                strategy={s}
                originalTotal={originalTotal}
                isFirst={i === 0}
              />
            ))}
          </View>

          {/* Aucune donnée de prix */}
          {strategies.every(s => s.savings === 0) && (
            <View style={styles.noDataBox}>
              <TrendingDown size={32} color={Colors.textMuted} />
              <Text style={styles.noDataTitle}>Prix non disponibles</Text>
              <Text style={styles.noDataText}>
                Nos magasins n'ont pas encore de prix pour ces produits.
                Lance l'enrichissement des EANs et le scraper Open Prices.
              </Text>
            </View>
          )}

        </ScrollView>
      )}

      {/* Aucune stratégie retournée */}
      {!loading && !error && strategies.length === 0 && (
        <View style={styles.centerBox}>
          <Text style={styles.errorText}>Aucun magasin trouvé à proximité.</Text>
        </View>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container:       { flex: 1, backgroundColor: Colors.background },

  topBar:          { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 16 },
  backBtn:         { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  screenTitle:     { fontSize: 18, fontWeight: '700', color: Colors.text },

  centerBox:       { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32, gap: 16 },
  loadingText:     { fontSize: 15, color: Colors.textMuted, textAlign: 'center' },
  errorText:       { fontSize: 15, color: '#FF4444', textAlign: 'center' },
  retryBtn:        { backgroundColor: Colors.surface, borderRadius: 10, paddingHorizontal: 24, paddingVertical: 12 },
  retryBtnText:    { color: Colors.text, fontWeight: '600' },

  scroll:          { padding: 16, paddingBottom: 40, gap: 16 },

  summaryBox:      {
    backgroundColor: Colors.surface,
    borderRadius: 14, padding: 16,
    flexDirection: 'row', alignItems: 'center', gap: 12,
    borderWidth: 1, borderColor: Colors.neonGreen + '40',
  },
  summaryTitle:    { fontSize: 17, fontWeight: '700', color: Colors.neonGreen },
  summarySubtitle: { fontSize: 13, color: Colors.textMuted, marginTop: 2 },

  strategiesList:  { gap: 12 },

  strategyCard:    {
    backgroundColor: Colors.surface,
    borderRadius: 14, padding: 16,
    borderWidth: 1, borderColor: Colors.cardBorder,
    gap: 10,
  },
  bestBadge:       {
    position: 'absolute', top: -10, left: 14,
    flexDirection: 'row', alignItems: 'center', gap: 4,
    paddingHorizontal: 8, paddingVertical: 3, borderRadius: 20,
  },
  bestBadgeText:   { fontSize: 10, fontWeight: '700', color: Colors.background },

  strategyHeader:  { flexDirection: 'row', alignItems: 'center', gap: 10 },
  strategyEmoji:   { fontSize: 28 },
  strategyMeta:    { flex: 1, gap: 2 },
  strategyTitle:   { fontSize: 15, fontWeight: '700', color: Colors.text },
  strategyDesc:    { fontSize: 12, color: Colors.textMuted },
  strategyRight:   { alignItems: 'flex-end', gap: 2 },
  strategySavings: { fontSize: 18, fontWeight: '800' },
  strategySavingsPct: { fontSize: 12, color: Colors.textMuted },
  noSavings:       { fontSize: 13, color: Colors.textMuted },

  strategyTotalRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingTop: 4, borderTopWidth: 1, borderTopColor: Colors.cardBorder },
  strategyTotalLabel: { fontSize: 13, color: Colors.textMuted },
  strategyTotalAmount: { fontSize: 18, fontWeight: '700', color: Colors.text },

  itemList:        { gap: 8, paddingTop: 4 },
  itemRow:         { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8 },
  itemLeft:        { flex: 1, gap: 3 },
  itemName:        { fontSize: 13, fontWeight: '600', color: Colors.text },
  itemTags:        { flexDirection: 'row', gap: 6, flexWrap: 'wrap' },
  mddTag:          { backgroundColor: '#FF950020', borderRadius: 6, paddingHorizontal: 6, paddingVertical: 2 },
  mddTagText:      { fontSize: 10, color: '#FF9500', fontWeight: '700' },
  promoTag:        { backgroundColor: '#FF2D5520', borderRadius: 6, paddingHorizontal: 6, paddingVertical: 2, maxWidth: 160 },
  promoTagText:    { fontSize: 10, color: '#FF2D55', fontWeight: '600' },
  storeRow:        { flexDirection: 'row', alignItems: 'center', gap: 3 },
  storeName:       { fontSize: 11, color: Colors.textMuted },
  itemRight:       { alignItems: 'flex-end', gap: 2 },
  itemOriginal:    { fontSize: 12, color: Colors.textMuted, textDecorationLine: 'line-through' },
  itemPrice:       { fontSize: 15, fontWeight: '700' },

  noDataBox:       { alignItems: 'center', padding: 32, gap: 12 },
  noDataTitle:     { fontSize: 17, fontWeight: '700', color: Colors.textMuted },
  noDataText:      { fontSize: 13, color: Colors.textMuted, textAlign: 'center', lineHeight: 20 },
});
