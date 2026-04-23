import React, { useState, useMemo } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet, Linking, Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Check, Clock, TrendingUp, ChevronRight, Wallet, ArrowLeft, Zap, Crosshair, Leaf, Tag, ShoppingCart, Rocket } from 'lucide-react-native';
import { calculateBestShoppingStrategy } from '@/engine/shoppingStrategy';
import { useSmartHuntStore } from '@/store/useSmartHuntStore';
import { Colors, Radius, Spacing } from '@/constants/theme';
import type { ShoppingScenario, StoreTotal, ItemResult } from '@/engine/types';

const USER_LOCATION = { lat: 47.2184, lng: -1.5536, radius_km: 20 };

const STORE_TRAVEL_MINUTES: Record<string, number> = {
  'E.Leclerc': 12, Carrefour: 14, Intermarché: 8,
};
const STORE_COLORS: Record<string, string> = {
  'E.Leclerc': '#0055A5', Carrefour: '#E31E24', Intermarché: '#F6B300',
  'Super U': '#00853F', Auchan: '#E87B20', Monoprix: '#444444',
  Lidl: '#0050AA', Aldi: '#1E56A0',
};

// ─────────────────────────────────────────────────────────────
// Sélecteur de stratégie
// ─────────────────────────────────────────────────────────────

function StrategySelector({
  mono, multi, selected, onSelect,
}: {
  mono: ShoppingScenario;
  multi: ShoppingScenario;
  selected: 'mono_store' | 'multi_store';
  onSelect: (s: 'mono_store' | 'multi_store') => void;
}) {
  const monoStore = mono.stores[0];
  const extraSavings = (mono.total_final - multi.total_final).toFixed(2);
  const travelTime = monoStore ? STORE_TRAVEL_MINUTES[monoStore.store_name] ?? 10 : 10;
  const monoColor = monoStore ? STORE_COLORS[monoStore.store_name] ?? Colors.electricBlue : Colors.electricBlue;
  const monoInitial = monoStore ? monoStore.store_name.charAt(0).toUpperCase() : '?';
  const isMonoSelected = selected === 'mono_store';
  const isMultiSelected = selected === 'multi_store';

  return (
    <View style={s.stratRow}>
      {/* Carte Confort */}
      <TouchableOpacity
        style={[s.stratCard, isMonoSelected && s.stratCardBlue]}
        onPress={() => onSelect('mono_store')}
        activeOpacity={0.8}
      >
        <View style={s.stratCardHeader}>
          <Text style={s.stratLabel}>CONFORT</Text>
          {isMonoSelected && (
            <View style={[s.checkCircle, { backgroundColor: Colors.electricBlue }]}>
              <Check size={12} color={Colors.background} strokeWidth={2} />
            </View>
          )}
        </View>
        <View style={[s.storeCircle, { backgroundColor: monoColor + '22', borderColor: monoColor + '60' }]}>
          <Text style={[s.storeCircleText, { color: monoColor }]}>{monoInitial}</Text>
        </View>
        <Text style={s.storeName} numberOfLines={1}>{monoStore?.store_name ?? '—'}</Text>
        <Text style={[s.stratPrice, { color: Colors.electricBlue }]}>
          {mono.total_final.toFixed(2)} €
        </Text>
        <View style={s.stratMeta}>
          <Clock size={12} color={Colors.textSecondary} strokeWidth={2} />
          <Text style={s.stratMetaText}>~{travelTime} min · 1 magasin</Text>
        </View>
        <View style={s.stratSavingsBox}>
          <Text style={s.stratSavingsText}>
            Économie :{' '}
            <Text style={[s.stratSavingsAmount, { color: Colors.electricBlue }]}>
              {mono.total_savings.toFixed(2)} €
            </Text>
          </Text>
        </View>
      </TouchableOpacity>

      {/* Carte Expert */}
      <TouchableOpacity
        style={[s.stratCard, isMultiSelected && s.stratCardGreen]}
        onPress={() => onSelect('multi_store')}
        activeOpacity={0.8}
      >
        <View style={s.stratCardHeader}>
          <Text style={s.stratLabel}>EXPERT</Text>
          {isMultiSelected && (
            <View style={[s.checkCircle, { backgroundColor: Colors.neonGreen }]}>
              <Check size={12} color={Colors.background} strokeWidth={2} />
            </View>
          )}
        </View>
        <View style={[s.storeCircle, { backgroundColor: Colors.neonGreen + '18', borderColor: Colors.neonGreen + '44' }]}>
          <Crosshair size={22} color={Colors.neonGreen} strokeWidth={1.5} />
        </View>
        <Text style={s.storeName}>Multi-enseignes</Text>
        <Text style={[s.stratPrice, { color: Colors.neonGreen }]}>
          {multi.total_final.toFixed(2)} €
        </Text>
        <View style={s.stratMeta}>
          <TrendingUp size={12} color={Colors.textSecondary} strokeWidth={2} />
          <Text style={s.stratMetaText}>{multi.stores.length} magasins</Text>
        </View>
        <View style={[s.stratSavingsBox, { backgroundColor: 'rgba(0,255,136,0.12)' }]}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, justifyContent: 'center' }}>
            <TrendingUp size={12} color={Colors.neonGreen} strokeWidth={2} />
            <Text style={[s.stratSavingsAmount, { color: Colors.neonGreen }]}>
              Gagnez {extraSavings} € de plus
            </Text>
          </View>
        </View>
      </TouchableOpacity>
    </View>
  );
}

// ─────────────────────────────────────────────────────────────
// Ligne produit
// ─────────────────────────────────────────────────────────────

function BasketItemRow({ item }: { item: ItemResult }) {
  const hasDiscount = item.final_price < item.base_price;
  const isBio = item.segment === 'bio' || item.segment === 'bio_village';
  const isMdd = item.segment === 'mdd' || item.segment === 'repere';
  const segColor = isBio ? Colors.neonGreen : isMdd ? Colors.electricBlue : Colors.textSecondary;
  const SegIcon = isBio ? Leaf : isMdd ? Tag : ShoppingCart;

  return (
    <View style={s.itemWrap}>
      <View style={s.itemRow}>
        <View style={[s.itemIcon, { backgroundColor: segColor + '18' }]}>
          <SegIcon size={16} color={segColor} strokeWidth={2} />
        </View>

        <View style={{ flex: 1 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
            <Text style={s.itemName} numberOfLines={1}>{item.name}</Text>
            {item.qty > 1 && (
              <View style={s.qtyBadge}>
                <Text style={s.qtyText}>×{item.qty}</Text>
              </View>
            )}
          </View>

          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 4, marginTop: 4 }}>
            {item.is_cumul_max && (
              <View style={[s.badge, { backgroundColor: Colors.neonGreen }]}>
                <Text style={[s.badgeText, { color: Colors.background }]}>CUMUL MAX</Text>
              </View>
            )}
            {item.promo_label && !item.is_cumul_max && (
              <View style={[s.badge, { backgroundColor: 'rgba(0,180,255,0.2)' }]}>
                <Text style={[s.badgeText, { color: Colors.electricBlue }]}>{item.promo_label}</Text>
              </View>
            )}
            {item.cashback && !item.is_cumul_max && (
              <View style={[s.badge, { backgroundColor: Colors.card, borderWidth: 1, borderColor: Colors.cardBorder, flexDirection: 'row', alignItems: 'center', gap: 3 }]}>
                <Zap size={10} color={Colors.textSecondary} strokeWidth={2} />
                <Text style={[s.badgeText, { color: Colors.textSecondary }]}>{item.cashback.partner}</Text>
              </View>
            )}
          </View>

          <Text style={s.itemStore}>{item.store_name}</Text>
        </View>

        <View style={{ alignItems: 'flex-end' }}>
          {hasDiscount && (
            <Text style={s.itemBasePrice}>{(item.base_price * item.qty).toFixed(2)} €</Text>
          )}
          <Text style={[s.itemFinalPrice, { color: hasDiscount ? Colors.neonGreen : Colors.white }]}>
            {item.line_total.toFixed(2)} €
          </Text>
          {item.savings_percent > 0 && (
            <View style={s.pctBadge}>
              <Text style={s.pctText}>-{item.savings_percent}%</Text>
            </View>
          )}
        </View>
      </View>

      {/* Bio Switch */}
      {item.bio_switch?.recommended && (
        <TouchableOpacity style={s.bioSwitch}>
          <Leaf size={16} color={Colors.neonGreenDim} strokeWidth={2} />
          <View style={{ flex: 1 }}>
            <Text style={[s.badgeText, { color: Colors.neonGreenDim, fontWeight: '700' }]}>Switch Bio disponible</Text>
            <Text style={s.itemStore} numberOfLines={1}>
              {item.bio_switch.bio_name} · {item.bio_switch.bio_best_store}
            </Text>
          </View>
          <Text style={[s.badgeText, { color: Colors.neonGreenDim, fontWeight: '700' }]}>
            {item.bio_switch.price_delta <= 0
              ? `${Math.abs(item.bio_switch.price_delta).toFixed(2)} € MOINS CHER`
              : `+${item.bio_switch.price_delta.toFixed(2)} €`}
          </Text>
          <ChevronRight size={14} color={Colors.neonGreenDim} strokeWidth={2} />
        </TouchableOpacity>
      )}

      {/* Cashback deeplink */}
      {item.cashback && (
        <TouchableOpacity
          style={s.cashbackLink}
          onPress={() => {
            const url = Platform.OS === 'ios'
              ? item.cashback!.deeplink_ios
              : item.cashback!.deeplink_ios.replace('ios', 'android');
            Linking.openURL(url).catch(() => {});
          }}
        >
          <Zap size={12} color={Colors.electricBlue} strokeWidth={2} />
          <Text style={s.cashbackText}>
            Activer -{item.cashback.amount.toFixed(2)} € via {item.cashback.partner}
          </Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

// ─────────────────────────────────────────────────────────────
// Groupe par enseigne
// ─────────────────────────────────────────────────────────────

function StoreGroup({ group }: { group: StoreTotal }) {
  const storeColor = STORE_COLORS[group.store_name] ?? Colors.electricBlue;
  const storeInitial = group.store_name.charAt(0).toUpperCase();

  return (
    <View style={{ marginBottom: 16 }}>
      <View style={s.storeHeader}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <View style={[s.storeCircle, { backgroundColor: storeColor + '22', borderColor: storeColor + '60' }]}>
            <Text style={[s.storeCircleText, { color: storeColor }]}>{storeInitial}</Text>
          </View>
          <Text style={s.storeName2}>{group.store_name}</Text>
          <View style={[s.countChip, { backgroundColor: group.store_color + '22' }]}>
            <Text style={[s.countChipText, { color: group.store_color }]}>
              {group.items_in_stock} article{group.items_in_stock > 1 ? 's' : ''}
            </Text>
          </View>
        </View>
        <Text style={[s.storeSubtotal, { color: Colors.neonGreen }]}>
          {group.subtotal_final.toFixed(2)} €
        </Text>
      </View>

      {group.items.map(item => <BasketItemRow key={item.ean} item={item} />)}

      {group.subtotal_cashback > 0 && (
        <View style={s.cashbackBox}>
          <Wallet size={14} color={Colors.electricBlue} strokeWidth={2} />
          <Text style={s.cashbackBoxText}>
            À cagnotter chez {group.store_name} :{' '}
            <Text style={{ fontWeight: '700' }}>+{group.subtotal_cashback.toFixed(2)} €</Text>
            {' '}après scan du ticket
          </Text>
        </View>
      )}
    </View>
  );
}

// ─────────────────────────────────────────────────────────────
// ÉCRAN PRINCIPAL
// ─────────────────────────────────────────────────────────────

export default function BasketSummaryScreen() {
  const router = useRouter();
  const { huntList } = useSmartHuntStore();
  const [strategy, setStrategy] = useState<'mono_store' | 'multi_store'>('multi_store');

  const userBasket = huntList.map(i => ({ ean: i.optimization.ean, qty: 1 }));

  const demoBasket = [
    { ean: '3045320094084', qty: 1 },
    { ean: '7613036018838', qty: 1 },
    { ean: '3017620425035', qty: 2 },
    { ean: '5000112637441', qty: 3 },
    { ean: '3229820129488', qty: 1 },
    { ean: '8000500310427', qty: 2 },
    { ean: '3086126100079', qty: 1 },
    { ean: '3228857000166', qty: 1 },
    { ean: '3574661680568', qty: 1 },
    { ean: '3245413410021', qty: 2 },
    { ean: '3245680010120', qty: 1 },
    { ean: '3250390034560', qty: 1 },
  ];

  const result = useMemo(() => {
    try {
      return calculateBestShoppingStrategy(
        userBasket.length > 0 ? userBasket : demoBasket,
        USER_LOCATION,
      );
    } catch {
      return null;
    }
  }, [huntList.length]);

  if (!result) {
    return (
      <SafeAreaView style={[s.root, { alignItems: 'center', justifyContent: 'center' }]}>
        <Text style={{ color: Colors.textSecondary, fontSize: 16 }}>Impossible de calculer la stratégie.</Text>
      </SafeAreaView>
    );
  }

  const activeScenario = strategy === 'mono_store' ? result.mono_store : result.multi_store;
  const totalCashback = activeScenario.stores.reduce((sum, g) => sum + g.subtotal_cashback, 0);
  const nbStores = activeScenario.stores.length;
  const nbItems = userBasket.length > 0 ? userBasket.length : demoBasket.length;

  return (
    <SafeAreaView style={s.root} edges={['top']}>

      {/* Header */}
      <View style={s.header}>
        <TouchableOpacity style={s.backBtn} onPress={() => router.back()}>
          <ArrowLeft size={20} color={Colors.white} strokeWidth={2} />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={s.headerTitle}>Résumé du Panier</Text>
          <Text style={s.headerSub}>{nbItems} produits · {result.nearby_stores.length} enseignes proches</Text>
        </View>
      </View>

      {/* Sélecteur stratégie */}
      <StrategySelector
        mono={result.mono_store}
        multi={result.multi_store}
        selected={strategy}
        onSelect={setStrategy}
      />

      {/* Bandeau comparatif */}
      {result.multi_store_extra_savings > 0 && (
        <View style={s.extraBanner}>
          <TrendingUp size={16} color={Colors.neonGreen} strokeWidth={2} />
          <Text style={s.extraBannerText}>
            Le scénario Expert vous fait économiser{' '}
            <Text style={{ fontWeight: '900' }}>{result.multi_store_extra_savings.toFixed(2)} €</Text> de plus
            {result.recommended_scenario === 'mono_store'
              ? ' — mais le trajet peut ne pas en valoir la peine.'
              : ' — largement rentable !'}
          </Text>
        </View>
      )}

      {/* Liste scrollable */}
      <ScrollView
        style={{ flex: 1, paddingHorizontal: 16 }}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 160 }}
      >
        {activeScenario.stores.map(group => (
          <StoreGroup key={group.store_id} group={group} />
        ))}

        {activeScenario.unavailable_items.length > 0 && (
          <View style={s.unavailableBox}>
            <Text style={[s.itemName, { color: Colors.orange, marginBottom: 8 }]}>
              Articles non trouvés ({activeScenario.unavailable_items.length})
            </Text>
            {activeScenario.unavailable_items.map(u => (
              <Text key={u.ean} style={[s.itemStore, { marginBottom: 2 }]}>• {u.name}</Text>
            ))}
          </View>
        )}

        {/* Récap */}
        <View style={s.recapBox}>
          <Text style={s.recapTitle}>Récapitulatif des économies</Text>
          <View style={s.recapRow}>
            <Text style={s.recapLabel}>Prix de base total</Text>
            <Text style={[s.recapValue, { textDecorationLine: 'line-through', color: Colors.textSecondary }]}>
              {activeScenario.total_base.toFixed(2)} €
            </Text>
          </View>
          <View style={s.recapRow}>
            <Text style={s.recapLabel}>Remises catalogue</Text>
            <Text style={s.recapValue}>- {activeScenario.total_promo_savings.toFixed(2)} €</Text>
          </View>
          <View style={s.recapRow}>
            <Text style={s.recapLabel}>Cashback ODR (après scan)</Text>
            <Text style={[s.recapValue, { color: Colors.electricBlue }]}>
              - {activeScenario.total_cashback.toFixed(2)} €
            </Text>
          </View>
          <View style={s.recapDivider} />
          <View style={s.recapRow}>
            <Text style={[s.recapLabel, { color: Colors.white, fontWeight: '900', fontSize: 16 }]}>Prix Net-Net</Text>
            <Text style={s.recapTotal}>{activeScenario.total_final.toFixed(2)} €</Text>
          </View>
        </View>
      </ScrollView>

      {/* Footer */}
      <View style={s.footer}>
        {totalCashback > 0 && (
          <View style={s.footerCashback}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <Wallet size={16} color={Colors.electricBlue} strokeWidth={2} />
              <Text style={{ color: Colors.textSecondary, fontSize: 14 }}>À cagnotter après scan</Text>
            </View>
            <Text style={{ color: Colors.electricBlue, fontWeight: '900', fontSize: 18 }}>
              +{totalCashback.toFixed(2)} €
            </Text>
          </View>
        )}

        <TouchableOpacity
          style={s.ctaBtn}
          onPress={() => router.push('/scan')}
          activeOpacity={0.85}
        >
          <Rocket size={22} color={Colors.background} strokeWidth={2} />
          <Text style={s.ctaBtnText}>
            Lancer la chasse ({nbStores} magasin{nbStores > 1 ? 's' : ''})
          </Text>
        </TouchableOpacity>

        <Text style={s.footerSub}>
          Économie totale : {activeScenario.total_savings.toFixed(2)} € · -{activeScenario.savings_percent}% sur le prix de base
        </Text>
      </View>
    </SafeAreaView>
  );
}

// ─────────────────────────────────────────────────────────────
// Styles
// ─────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.background },

  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingTop: 12, paddingBottom: 4, gap: 12 },
  backBtn: { width: 40, height: 40, backgroundColor: Colors.card, borderRadius: Radius.full, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { color: Colors.white, fontWeight: '900', fontSize: 20 },
  headerSub: { color: Colors.textSecondary, fontSize: 12 },

  stratRow: { flexDirection: 'row', gap: 12, paddingHorizontal: 16, paddingTop: 16, paddingBottom: 8 },
  stratCard: { flex: 1, borderRadius: Radius.lg, borderWidth: 2, borderColor: Colors.cardBorder, backgroundColor: Colors.card, padding: 16 },
  stratCardBlue: { borderColor: Colors.electricBlue, backgroundColor: 'rgba(0,180,255,0.08)' },
  stratCardGreen: { borderColor: Colors.neonGreen, backgroundColor: 'rgba(0,255,136,0.08)' },
  stratCardHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 },
  stratLabel: { fontSize: 10, fontWeight: '700', color: Colors.textSecondary, letterSpacing: 1.5 },
  checkCircle: { width: 20, height: 20, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  storeCircle: { width: 44, height: 44, borderRadius: 22, borderWidth: 1.5, alignItems: 'center', justifyContent: 'center', marginBottom: 4 },
  storeCircleText: { fontSize: 18, fontWeight: '800' },
  storeName: { color: Colors.white, fontWeight: '700', fontSize: 13, marginBottom: 4 },
  stratPrice: { fontWeight: '900', fontSize: 24, lineHeight: 28 },
  stratMeta: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 8 },
  stratMetaText: { color: Colors.textSecondary, fontSize: 11 },
  stratSavingsBox: { marginTop: 12, backgroundColor: Colors.surface, borderRadius: Radius.sm, padding: 8 },
  stratSavingsText: { color: Colors.textSecondary, fontSize: 11, textAlign: 'center' },
  stratSavingsAmount: { fontWeight: '700' },

  extraBanner: { marginHorizontal: 16, marginBottom: 12, backgroundColor: 'rgba(0,255,136,0.08)', borderWidth: 1, borderColor: 'rgba(0,255,136,0.25)', borderRadius: Radius.md, paddingHorizontal: 16, paddingVertical: 10, flexDirection: 'row', alignItems: 'center', gap: 8 },
  extraBannerText: { color: Colors.neonGreen, fontSize: 12, flex: 1 },

  itemWrap: { marginBottom: 8 },
  itemRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: Colors.card, borderRadius: Radius.md, borderWidth: 1, borderColor: Colors.cardBorder, padding: 12, gap: 12 },
  itemIcon: { width: 40, height: 40, backgroundColor: Colors.surface, borderRadius: Radius.sm, alignItems: 'center', justifyContent: 'center' },
  itemName: { color: Colors.white, fontWeight: '600', fontSize: 13, flexShrink: 1 },
  itemStore: { color: Colors.textMuted, fontSize: 11, marginTop: 4 },
  itemBasePrice: { color: Colors.textMuted, fontSize: 11, textDecorationLine: 'line-through' },
  itemFinalPrice: { fontWeight: '900', fontSize: 18 },

  badge: { borderRadius: 4, paddingHorizontal: 6, paddingVertical: 2 },
  badgeText: { fontSize: 10, fontWeight: '700' },
  qtyBadge: { backgroundColor: Colors.surface, borderWidth: 1, borderColor: Colors.cardBorder, borderRadius: Radius.full, paddingHorizontal: 6, paddingVertical: 2 },
  qtyText: { color: Colors.textSecondary, fontSize: 11 },
  pctBadge: { backgroundColor: 'rgba(0,255,136,0.15)', borderRadius: 4, paddingHorizontal: 4, marginTop: 2 },
  pctText: { color: Colors.neonGreen, fontSize: 11, fontWeight: '700' },

  bioSwitch: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: 'rgba(0,204,106,0.08)', borderWidth: 1, borderColor: 'rgba(0,204,106,0.25)', borderRadius: Radius.sm, marginHorizontal: 4, paddingHorizontal: 12, paddingVertical: 8, marginTop: 4 },
  cashbackLink: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 12, paddingVertical: 6 },
  cashbackText: { color: Colors.electricBlue, fontSize: 12 },

  storeHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8, paddingHorizontal: 4 },
  storeName2: { color: Colors.white, fontWeight: '700', fontSize: 16 },
  countChip: { borderRadius: Radius.full, paddingHorizontal: 8, paddingVertical: 2 },
  countChipText: { fontSize: 11, fontWeight: '600' },
  storeSubtotal: { fontWeight: '700', fontSize: 16 },
  cashbackBox: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: 'rgba(0,180,255,0.08)', borderWidth: 1, borderColor: 'rgba(0,180,255,0.25)', borderRadius: Radius.sm, paddingHorizontal: 12, paddingVertical: 8, marginTop: 4 },
  cashbackBoxText: { color: Colors.electricBlue, fontSize: 12, flex: 1 },

  unavailableBox: { backgroundColor: Colors.card, borderWidth: 1, borderColor: Colors.cardBorder, borderRadius: Radius.md, padding: 16, marginBottom: 16 },

  recapBox: { backgroundColor: Colors.card, borderWidth: 1, borderColor: 'rgba(0,255,136,0.3)', borderRadius: Radius.lg, padding: 16, marginBottom: 16 },
  recapTitle: { color: Colors.white, fontWeight: '700', fontSize: 15, marginBottom: 12 },
  recapRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 },
  recapLabel: { color: Colors.textSecondary, fontSize: 13 },
  recapValue: { color: Colors.white, fontSize: 13, fontWeight: '600' },
  recapDivider: { height: 1, backgroundColor: Colors.cardBorder, marginVertical: 12 },
  recapTotal: { color: Colors.neonGreen, fontWeight: '900', fontSize: 22 },

  footer: { position: 'absolute', bottom: 0, left: 0, right: 0, backgroundColor: Colors.surface, borderTopWidth: 1, borderTopColor: Colors.cardBorder, paddingHorizontal: 16, paddingTop: 12, paddingBottom: 32 },
  footerCashback: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 },
  ctaBtn: { backgroundColor: Colors.neonGreen, borderRadius: Radius.lg, paddingVertical: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  ctaBtnText: { color: Colors.background, fontWeight: '900', fontSize: 18 },
  footerSub: { textAlign: 'center', color: Colors.textMuted, fontSize: 11, marginTop: 8 },
});
