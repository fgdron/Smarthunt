import React, { useMemo, useState } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet,
  ScrollView, Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Check, X, Info, ArrowLeft, List, ChevronRight, ExternalLink, Navigation, Rocket, Crosshair, Tag, ShoppingBag, type LucideIcon } from 'lucide-react-native';
import { useRouter } from 'expo-router';
import * as Linking from 'expo-linking';
import { Colors, Radius, Spacing } from '@/constants/theme';
import { useSmartHuntStore, BasketItem } from '@/store/useSmartHuntStore';
import { StoreId, STORES_CONFIG, ALL_STORE_IDS } from '@/data/productsDB';
import { getBestNetPrice, getNearbyStores, PARIS_CENTER, haversineKm } from '@/engine/netPrice';
import { getCrossStoreEquivalents } from '@/engine/mapping';
import { getSmartNudges } from '@/engine/nudges';
import { useUserLocation } from '@/hooks/useUserLocation';
import TransparencyModal from '@/components/TransparencyModal';
import TutorialTooltip from '@/components/TutorialTooltip';
import { useTutorial } from '@/hooks/useTutorial';

// ─────────────────────────────────────────────────────────────
// Constantes
// ─────────────────────────────────────────────────────────────

type StrategyMode = 'confort' | 'expert' | 'sagesse';

const STORE_LABELS = Object.fromEntries(
  ALL_STORE_IDS.map(id => [id, STORES_CONFIG[id].label])
) as Record<StoreId, string>;

const STORE_COLOR = Object.fromEntries(
  ALL_STORE_IDS.map(id => [id, STORES_CONFIG[id].color])
) as Record<StoreId, string>;

const STORE_SHORT = Object.fromEntries(
  ALL_STORE_IDS.map(id => [id, STORES_CONFIG[id].shortLabel])
) as Record<StoreId, string>;

// Rayon de recherche des magasins
const RADIUS_KM = 20;

// Gain minimum pour justifier un trajet supplémentaire
const EXTRA_TRIP_THRESHOLD = 2.00;

// URLs Drive par enseigne (ouverture site web si l'app n'est pas installée)
const DRIVE_URLS: Partial<Record<StoreId, string>> = {
  leclerc:     'https://www.leclercdrive.fr/',
  superu:      'https://courses.super-u.com/',
  carrefour:   'https://www.carrefour.fr/drive/',
  intermarche: 'https://courses.intermarche.com/',
  auchan:      'https://www.auchandrive.fr/',
};

// ─────────────────────────────────────────────────────────────
// Moteur de calcul (paramétré par la liste de magasins proches)
// ─────────────────────────────────────────────────────────────

interface TimelineLine {
  groupId: string;
  emoji: string;
  name: string;
  qty: number;             // quantité sélectionnée
  standardPrice: number;   // total qty × prix standard
  confortNetPrice: number; // total qty × prix confort
  expertNetPrice: number;  // total qty × prix expert
  sagessePrice: number;    // total qty × prix MDD
  expertStore: StoreId;
  confortStore: StoreId;
  promoLabel?: string;
  cashbackLabel?: string;
  substitutionLabel?: string;
  substitutionSaving?: number;
}

interface ComputedResult {
  totalStandard: number;

  confortStore: StoreId;
  confortTotal: number;
  confortSavings: number;
  confortPct: number;
  confortCaisse: number;
  confortCagnotte: number;

  expertTotal: number;
  expertSavings: number;
  expertPct: number;
  expertExtraVsConfort: number;
  expertByStore: Record<StoreId, BasketItem[]>;
  expertCaisse: number;
  expertCagnotte: number;

  sagesseTotal: number;
  sagesseSavings: number;
  sagessePct: number;

  lines: TimelineLine[];
}

function computeAll(basket: BasketItem[], nearbyStores: StoreId[], blacklistedSubs: string[] = []): ComputedResult {
  const emptyByStore = Object.fromEntries(ALL_STORE_IDS.map(s => [s, []])) as unknown as Record<StoreId, BasketItem[]>;

  if (basket.length === 0 || nearbyStores.length === 0) {
    return {
      totalStandard: 0,
      confortStore: nearbyStores[0] ?? 'leclerc',
      confortTotal: 0, confortSavings: 0, confortPct: 0,
      confortCaisse: 0, confortCagnotte: 0,
      expertTotal: 0, expertSavings: 0, expertPct: 0, expertExtraVsConfort: 0,
      expertByStore: emptyByStore,
      expertCaisse: 0, expertCagnotte: 0,
      sagesseTotal: 0, sagesseSavings: 0, sagessePct: 0,
      lines: [],
    };
  }

  // Prix unitaire de référence (standard de marché)
  const standardUnitOf = (item: BasketItem) =>
    item.group.variants.leader?.basePrice ?? item.group.variants.mdd?.basePrice ?? item.group.variants.bio?.basePrice ?? 0;

  const totalStandard = basket.reduce((s, i) => s + standardUnitOf(i) * i.qty, 0);

  // ── CONFORT ─────────────────────────────────────────────────
  const storeTotals = nearbyStores.map(store => {
    const total = basket.reduce((s, item) => {
      const v = item.group.variants[item.selectedType] ?? item.group.variants.mdd ?? item.group.variants.leader;
      if (!v) return s + 999 * item.qty;
      const res = getBestNetPrice(v, store, item.qty);
      return s + (res ? res.totalNet : 999 * item.qty);
    }, 0);
    return { store, total };
  });
  storeTotals.sort((a, b) => a.total - b.total);
  const confortStore = storeTotals[0].store;
  const confortTotal = Math.round(storeTotals[0].total * 100) / 100;
  const confortSavings = Math.round((totalStandard - confortTotal) * 100) / 100;
  const confortPct = totalStandard > 0 ? Math.round((confortSavings / totalStandard) * 100) : 0;

  // ── EXPERT Phase 1 ──────────────────────────────────────────
  interface ItemAlloc {
    item: BasketItem;
    initialStore: StoreId;
    finalStore: StoreId;
    netByStore: Partial<Record<StoreId, number>>;
    afterPromoByStore: Partial<Record<StoreId, number>>;
    promoByStore: Partial<Record<StoreId, string>>;
    cashbackByStore: Partial<Record<StoreId, string>>;
    std: number;
    mddBasePrice: number;
    confortNetPrice: number;
    confortAfterPromo: number;
  }

  let confortCaisse = 0;

  const allocs: ItemAlloc[] = basket.map(item => {
    const v = item.group.variants[item.selectedType] ?? item.group.variants.mdd ?? item.group.variants.leader;
    const mddV = item.group.variants.mdd;
    // std = prix unitaire de référence (per-unit, sans qty)
    const stdUnit = standardUnitOf(item);

    // netByStore et afterPromoByStore stockent des prix UNITAIRES moyens
    // (pour les promos volume, c'est la moyenne sur qty unités)
    const netByStore: Partial<Record<StoreId, number>> = {};
    const afterPromoByStore: Partial<Record<StoreId, number>> = {};
    const promoByStore: Partial<Record<StoreId, string>> = {};
    const cashbackByStore: Partial<Record<StoreId, string>> = {};

    let initialStore = confortStore;
    let cheapestNet = Infinity;

    for (const store of nearbyStores) {
      if (!v) {
        netByStore[store] = stdUnit;
        afterPromoByStore[store] = stdUnit;
        continue;
      }
      const res = getBestNetPrice(v, store, item.qty);
      if (!res) continue;
      netByStore[store] = Math.round(res.netPrice * 100) / 100;       // unitaire moyen
      afterPromoByStore[store] = Math.round(res.afterPromo * 100) / 100; // unitaire moyen
      if (res.promoLabel) promoByStore[store] = res.promoLabel;
      if (res.cashbackLabel) cashbackByStore[store] = res.cashbackLabel;
      if (res.netPrice < cheapestNet) { cheapestNet = res.netPrice; initialStore = store; }
    }

    const confortNetPrice = netByStore[confortStore] ?? stdUnit;      // unitaire
    const confortAfterPromo = afterPromoByStore[confortStore] ?? stdUnit; // unitaire
    confortCaisse += confortAfterPromo * item.qty;                    // total × qty

    return {
      item, initialStore, finalStore: initialStore,
      netByStore, afterPromoByStore, promoByStore, cashbackByStore,
      std: stdUnit, mddBasePrice: mddV?.basePrice ?? v?.basePrice ?? stdUnit,
      confortNetPrice, confortAfterPromo,
    };
  });

  // ── EXPERT Phase 2: seuil 2€ ────────────────────────────────
  let thresholdChanged = true;
  while (thresholdChanged) {
    thresholdChanged = false;
    const byStore = new Map<StoreId, ItemAlloc[]>(nearbyStores.map(s => [s, []]));
    for (const a of allocs) byStore.get(a.finalStore)?.push(a);

    for (const store of nearbyStores) {
      if (store === confortStore) continue;
      const storeItems = byStore.get(store) ?? [];
      if (storeItems.length === 0) continue;

      const savingVsConfort = storeItems.reduce((acc, a) => {
        const atConfort = a.netByStore[confortStore] ?? a.std; // unitaire
        const atStore = a.netByStore[store] ?? a.std;           // unitaire
        return acc + (atConfort - atStore) * a.item.qty;        // total × qty
      }, 0);

      if (savingVsConfort < EXTRA_TRIP_THRESHOLD) { // seuil en euros totaux
        for (const a of storeItems) a.finalStore = confortStore;
        thresholdChanged = true;
        break;
      }
    }
  }

  // ── EXPERT Phase 3: consolidation ───────────────────────────
  const expertByStore = Object.fromEntries(ALL_STORE_IDS.map(s => [s, []])) as unknown as Record<StoreId, BasketItem[]>;
  let expertTotal = 0;
  let expertCaisse = 0;

  const lines: TimelineLine[] = allocs.map(a => {
    const { item, finalStore } = a;
    expertByStore[finalStore].push(item);

    const expertNetPriceUnit = a.netByStore[finalStore] ?? a.std;  // unitaire
    const expertNetPrice = Math.round(expertNetPriceUnit * item.qty * 100) / 100; // total
    expertTotal += expertNetPrice;
    expertCaisse += (a.afterPromoByStore[finalStore] ?? expertNetPriceUnit) * item.qty;

    // Substitutions comparées en prix unitaires (ignorées si blacklistées)
    const subs = item.selectedType !== 'mdd' && !blacklistedSubs.includes(item.groupId)
      ? getCrossStoreEquivalents(item.group, item.selectedType, finalStore, expertNetPriceUnit)
      : [];
    const bestSub = subs[0];

    return {
      groupId: item.groupId,
      emoji: item.emoji,
      name: item.genericName,
      qty: item.qty,
      standardPrice: Math.round(a.std * item.qty * 100) / 100,           // total
      confortNetPrice: Math.round(a.confortNetPrice * item.qty * 100) / 100, // total
      expertNetPrice,                                                      // total
      sagessePrice: Math.round(a.mddBasePrice * item.qty * 100) / 100,   // total
      expertStore: finalStore,
      confortStore,
      promoLabel: a.promoByStore[finalStore],
      cashbackLabel: a.cashbackByStore[finalStore],
      substitutionLabel: bestSub
        ? `${bestSub.brand} dispo : ${bestSub.netPrice.toFixed(2)} € (-${bestSub.saving.toFixed(2)} €)`
        : undefined,
      substitutionSaving: bestSub?.saving,
    };
  });

  expertTotal = Math.round(expertTotal * 100) / 100;
  const expertSavings = Math.round((totalStandard - expertTotal) * 100) / 100;
  const expertPct = totalStandard > 0 ? Math.round((expertSavings / totalStandard) * 100) : 0;
  const expertExtraVsConfort = Math.round((confortTotal - expertTotal) * 100) / 100;

  confortCaisse = Math.round(confortCaisse * 100) / 100;
  expertCaisse = Math.round(expertCaisse * 100) / 100;
  const confortCagnotte = Math.round((confortCaisse - confortTotal) * 100) / 100;
  const expertCagnotte = Math.round((expertCaisse - expertTotal) * 100) / 100;

  // ── SAGESSE ─────────────────────────────────────────────────
  const sagesseTotal = Math.round(lines.reduce((s, l) => s + l.sagessePrice, 0) * 100) / 100;
  const sagesseSavings = Math.round((totalStandard - sagesseTotal) * 100) / 100;
  const sagessePct = totalStandard > 0 ? Math.round((sagesseSavings / totalStandard) * 100) : 0;

  return {
    totalStandard,
    confortStore, confortTotal, confortSavings, confortPct, confortCaisse, confortCagnotte,
    expertTotal, expertSavings, expertPct, expertExtraVsConfort, expertByStore, expertCaisse, expertCagnotte,
    sagesseTotal, sagesseSavings, sagessePct,
    lines,
  };
}

// ─────────────────────────────────────────────────────────────
// Export Drive — deep link + récap EAN
// ─────────────────────────────────────────────────────────────

function openDrive(store: StoreId, items: BasketItem[], total: number) {
  const si = STORES_CONFIG[store];
  const eanList = items
    .map(i => `${i.emoji} ${i.genericName}${i.qty > 1 ? ` ×${i.qty}` : ''}\n    EAN : ${i.variant.ean}`)
    .join('\n');
  const driveUrl = DRIVE_URLS[store];

  if (si.has_drive && driveUrl) {
    Alert.alert(
      `${si.emoji} Drive ${si.label}`,
      `${items.length} article${items.length > 1 ? 's' : ''} · ${total.toFixed(2)} €\n\n${eanList}`,
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text: `Ouvrir ${si.label} Drive`,
          onPress: () => Linking.openURL(driveUrl).catch(() =>
            Alert.alert('Erreur', `Impossible d'ouvrir ${si.label} Drive.`)
          ),
        },
      ],
    );
  } else {
    Alert.alert(
      `${si.emoji} Liste ${si.label}`,
      `Prix constatés en magasin (pas de Drive).\n\n${eanList}\n\nTotal estimé : ${total.toFixed(2)} €`,
      [{ text: 'OK' }],
    );
  }
}

function handleDriveExport(
  mode: StrategyMode,
  result: ComputedResult,
  basket: BasketItem[],
  nearbyStores: StoreId[],
) {
  if (mode === 'confort' || mode === 'sagesse') {
    const total = mode === 'sagesse' ? result.sagesseTotal : result.confortTotal;
    openDrive(result.confortStore, basket, total);
  } else {
    // Expert: show summary then let user pick a store
    const groups = nearbyStores.filter(s => result.expertByStore[s].length > 0);
    const summary = groups.map(store => {
      const si = STORES_CONFIG[store];
      const items = result.expertByStore[store];
      const tag = si.has_drive ? 'Drive' : 'En magasin';
      return `${si.emoji} ${si.label} [${tag}] — ${items.length} art.`;
    }).join('\n');

    Alert.alert(
      'Export Multi-Enseignes',
      `${groups.length} enseigne(s) :\n${summary}\n\nÉconomie totale : -${result.expertSavings.toFixed(2)} €`,
      [
        { text: 'Annuler', style: 'cancel' },
        ...groups.slice(0, 2).map(store => {
          const si = STORES_CONFIG[store];
          const items = result.expertByStore[store];
          const storeTotal = result.lines
            .filter(l => l.expertStore === store)
            .reduce((s, l) => s + l.expertNetPrice, 0);
          return {
            text: si.has_drive ? `Drive ${si.shortLabel}` : si.shortLabel,
            onPress: () => openDrive(store, items, storeTotal),
          };
        }),
      ],
    );
  }
}

// ─────────────────────────────────────────────────────────────
// Composants
// ─────────────────────────────────────────────────────────────

function StrategyCard({
  mode, selected, onSelect, result,
}: {
  mode: StrategyMode;
  selected: boolean;
  onSelect: () => void;
  result: ComputedResult;
}) {
  const activeExpertStores = Object.values(result.expertByStore).filter(i => i.length > 0).length;

  const confortColor = STORE_COLOR[result.confortStore] ?? Colors.electricBlue;
  const confortInitial = STORE_SHORT[result.confortStore]?.charAt(0).toUpperCase() ?? '?';

  const configs: Record<StrategyMode, {
    color: string; icon: LucideIcon | null; storeInitial?: string; storeColor?: string;
    label: string; title: string; subtitle: string;
    total: number; savings: number; pct: number;
    badge: string | null; detail: string;
  }> = {
    confort: {
      color: Colors.electricBlue,
      icon: null,
      storeInitial: confortInitial,
      storeColor: confortColor,
      label: 'CONFORT',
      title: `Mono-Enseigne ${STORE_LABELS[result.confortStore]}`,
      subtitle: 'Un seul magasin, zéro tracas',
      total: result.confortTotal,
      savings: result.confortSavings,
      pct: result.confortPct,
      badge: null,
      detail: `Meilleure enseigne pour l'ensemble du panier`,
    },
    expert: {
      color: Colors.neonGreen,
      icon: Crosshair,
      label: 'EXPERT',
      title: 'Multi-Enseignes',
      subtitle: 'Le meilleur prix produit par produit',
      total: result.expertTotal,
      savings: result.expertSavings,
      pct: result.expertPct,
      badge: result.expertExtraVsConfort > 0 ? `+${result.expertExtraVsConfort.toFixed(2)} € vs Confort` : null,
      detail: `Répartition sur ${activeExpertStores} enseigne${activeExpertStores > 1 ? 's' : ''}`,
    },
    sagesse: {
      color: '#FFD700',
      icon: Tag,
      label: 'SAGESSE',
      title: 'MDD Uniquement',
      subtitle: 'Prix budget, zéro marque',
      total: result.sagesseTotal,
      savings: result.sagesseSavings,
      pct: result.sagessePct,
      badge: null,
      detail: 'Référence budget sans marque nationale',
    },
  };

  const c = configs[mode];
  const { color, icon: CardIcon, storeInitial, storeColor, label, title, subtitle, total, savings, pct, badge, detail } = c;

  return (
    <TouchableOpacity
      style={[s.card, selected && { borderColor: color, borderWidth: 2, backgroundColor: color + '0A' }]}
      onPress={onSelect}
      activeOpacity={0.8}
    >
      <View style={s.cardHeader}>
        <View style={[s.modeTag, { backgroundColor: selected ? color : color + '22' }]}>
          <Text style={[s.modeTagText, { color: selected ? Colors.background : color }]}>{label}</Text>
        </View>
        {badge && (
          <View style={s.extraBadge}>
            <Text style={s.extraBadgeText}>{badge}</Text>
          </View>
        )}
        {selected && (
          <View style={[s.checkDot, { backgroundColor: color }]}>
            <Check size={11} color={Colors.background} strokeWidth={2} />
          </View>
        )}
      </View>

      <View style={s.cardBody}>
        <View style={[s.cardIconWrap, { backgroundColor: (storeColor ?? color) + '22', borderColor: (storeColor ?? color) + '44', borderWidth: 1.5 }]}>
          {CardIcon
            ? <CardIcon size={24} color={color} strokeWidth={1.5} />
            : <Text style={[s.cardIconInitial, { color: storeColor ?? color }]}>{storeInitial}</Text>
          }
        </View>
        <View style={{ flex: 1 }}>
          <Text style={s.cardTitle}>{title}</Text>
          <Text style={s.cardSub}>{subtitle}</Text>
        </View>
      </View>

      <View style={s.priceRow}>
        <View>
          <Text style={s.priceLabel}>Prix SmartHunt</Text>
          <Text style={[s.priceFinal, { color }]}>{total.toFixed(2)} €</Text>
        </View>
        <View style={[s.savingsBox, { backgroundColor: color + '15', borderColor: color + '30' }]}>
          <Text style={[s.savingsAmount, { color }]}>-{savings.toFixed(2)} €</Text>
          <Text style={[s.savingsPct, { color: color + 'AA' }]}>-{pct}%</Text>
        </View>
      </View>

      <Text style={s.detailText}>{detail}</Text>
    </TouchableOpacity>
  );
}

// ── Timeline item ──────────────────────────────────────────────

function TimelineItem({
  line, mode, onDismissSubstitution,
}: {
  line: TimelineLine;
  mode: StrategyMode;
  onDismissSubstitution?: (groupId: string) => void;
}) {
  const netPrice = mode === 'confort' ? line.confortNetPrice
    : mode === 'expert' ? line.expertNetPrice
    : line.sagessePrice;
  const saving = Math.round((line.standardPrice - netPrice) * 100) / 100;
  const hasSaving = saving > 0.005;
  // Prix unitaire moyen (affiché si qty > 1)
  const unitNet = line.qty > 1 ? Math.round((netPrice / line.qty) * 100) / 100 : null;

  return (
    <View style={s.timelineItem}>
      <Text style={s.timelineEmoji}>{line.emoji}</Text>
      <View style={{ flex: 1, gap: 2 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
          <Text style={s.timelineName} numberOfLines={1}>{line.name}</Text>
          {line.qty > 1 && (
            <View style={s.qtyBadge}>
              <Text style={s.qtyBadgeText}>×{line.qty}</Text>
            </View>
          )}
        </View>
        <View style={s.timelinePrices}>
          <Text style={s.timelineStandard}>{line.standardPrice.toFixed(2)} €</Text>
          {hasSaving && (
            <>
              <ChevronRight size={10} color={Colors.textMuted} strokeWidth={2} />
              <Text style={s.timelineNet}>{netPrice.toFixed(2)} €</Text>
              {unitNet !== null && (
                <Text style={s.timelinePerUnit}>({unitNet.toFixed(2)} €/u)</Text>
              )}
            </>
          )}
          {mode === 'expert' && (
            <View style={[s.timelineStoreChip, { backgroundColor: STORE_COLOR[line.expertStore] + '22' }]}>
              <Text style={[s.timelineStore, { color: STORE_COLOR[line.expertStore] }]}>{STORE_SHORT[line.expertStore]}</Text>
            </View>
          )}
        </View>
        {line.promoLabel && mode === 'expert' && (
          <Text style={s.timelinePromo}>{line.promoLabel}</Text>
        )}
        {line.cashbackLabel && mode === 'expert' && (
          <Text style={s.timelineCashback}>{line.cashbackLabel}</Text>
        )}
        {line.substitutionLabel && mode === 'expert' && (
          <View style={s.substitutionRow}>
            <Text style={[s.timelineSubstitution, { flex: 1 }]}>{line.substitutionLabel}</Text>
            {onDismissSubstitution && (
              <TouchableOpacity
                onPress={() => onDismissSubstitution(line.groupId)}
                hitSlop={{ top: 6, bottom: 6, left: 8, right: 8 }}
                style={s.dismissBtn}
              >
                <X size={13} color={Colors.textMuted} strokeWidth={2} />
                <Text style={s.dismissText}>Ne plus proposer</Text>
              </TouchableOpacity>
            )}
          </View>
        )}
      </View>
      {hasSaving && (
        <View style={s.timelineSavingBox}>
          <Text style={s.timelineSaving}>-{saving.toFixed(2)} €</Text>
        </View>
      )}
    </View>
  );
}

// ── Connecteur de route entre 2 enseignes ─────────────────────

function RouteConnector({ km }: { km: number }) {
  return (
    <View style={s.routeConnector}>
      <View style={s.routeLine} />
      <View style={s.routeBadge}>
        <Navigation size={10} color={Colors.textMuted} strokeWidth={2} />
        <Text style={s.routeKm}>{km.toFixed(1)} km</Text>
      </View>
      <View style={s.routeLine} />
    </View>
  );
}

// ── Expert store group ─────────────────────────────────────────

function ExpertStoreGroup({
  store, items, result, distanceKm,
}: {
  store: StoreId;
  items: BasketItem[];
  result: ComputedResult;
  distanceKm: number;
}) {
  const storeTotal = result.lines
    .filter(l => l.expertStore === store)
    .reduce((s2, l) => s2 + l.expertNetPrice, 0);
  const info = STORES_CONFIG[store];

  return (
    <View style={s.storeGroup}>
      <View style={[s.storeGroupHeader, { borderLeftColor: info.color }]}>
        <View style={[s.storeGroupDot, { backgroundColor: info.color + '22', borderColor: info.color + '55' }]}>
          <Text style={[s.storeGroupDotText, { color: info.color }]}>{info.shortLabel.charAt(0).toUpperCase()}</Text>
        </View>
        <View style={{ flex: 1 }}>
          <Text style={s.storeGroupLabel}>{info.label}</Text>
          <Text style={s.storeGroupDist}>{distanceKm.toFixed(1)} km</Text>
        </View>
        {!info.has_drive && (
          <View style={s.noDriveBadge}><Text style={s.noDriveBadgeText}>En magasin</Text></View>
        )}
        <Text style={s.storeGroupCount}>{items.length} art.</Text>
        <Text style={s.storeGroupTotal}>{storeTotal.toFixed(2)} €</Text>
      </View>
      {items.map(item => {
        const line = result.lines.find(l => l.groupId === item.groupId);
        return (
          <View key={item.groupId} style={s.storeGroupItem}>
            <Text style={s.storeGroupItemEmoji}>{item.emoji}</Text>
            <Text style={s.storeGroupItemName} numberOfLines={1}>
              {item.genericName}{item.qty > 1 ? ` ×${item.qty}` : ''}
            </Text>
            <Text style={s.storeGroupItemPrice}>
              {line?.expertNetPrice.toFixed(2)} €
            </Text>
          </View>
        );
      })}
    </View>
  );
}

// ─────────────────────────────────────────────────────────────
// ÉCRAN PRINCIPAL
// ─────────────────────────────────────────────────────────────

export default function StrategyScreen() {
  const router = useRouter();
  const { userBasket, blacklistedSubstitutes, blacklistSubstitute } = useSmartHuntStore();
  const [mode, setMode] = useState<StrategyMode>('expert');
  const [transparencyVisible, setTransparencyVisible] = useState(false);
  const { seen: tutorialSeen, markSeen: markTutorialSeen } = useTutorial('strategy_modes');

  const { coords, status: locationStatus } = useUserLocation();

  // Magasins dans le rayon — recalculé à chaque changement de position
  const nearbyStores = useMemo(() => {
    const stores = getNearbyStores(coords, RADIUS_KM);
    return stores.length > 0 ? stores : [...ALL_STORE_IDS];
  }, [coords]);

  // Calcul complet mémoïsé — recalculé uniquement si panier ou position changent
  const result = useMemo(
    () => computeAll(userBasket, nearbyStores, blacklistedSubstitutes),
    [userBasket, nearbyStores, blacklistedSubstitutes],
  );

  // Expert stores sorted by proximity (itinéraire logique)
  const expertStoreGroups = useMemo(
    () => nearbyStores
      .filter(sid => result.expertByStore[sid].length > 0)
      .sort((a, b) => haversineKm(coords, STORES_CONFIG[a].coords) - haversineKm(coords, STORES_CONFIG[b].coords)),
    [result, nearbyStores, coords],
  );

  // Nudges manqués (opportunités de volume non appliquées)
  const missedNudges = useMemo(() => getSmartNudges(userBasket), [userBasket]);
  const missedNudgeSaving = useMemo(
    () => Math.round(missedNudges.reduce((s, n) => s + n.savingDelta, 0) * 100) / 100,
    [missedNudges],
  );

  if (userBasket.length === 0) {
    return (
      <SafeAreaView style={[s.root, { alignItems: 'center', justifyContent: 'center', gap: 20, padding: 32 }]} edges={['top']}>
        <Text style={{ fontSize: 64 }}>🎩</Text>
        <Text style={{ color: Colors.white, fontSize: 20, fontWeight: '800', textAlign: 'center' }}>
          Votre majordome attend.
        </Text>
        <Text style={{ color: Colors.textSecondary, fontSize: 15, textAlign: 'center', lineHeight: 24 }}>
          Donnez-lui votre liste pour qu'il commence{'\n'}la chasse aux économies !
        </Text>
        <TouchableOpacity
          style={[s.ctaBtn, { paddingHorizontal: 28 }]}
          onPress={() => router.canGoBack() ? router.back() : router.navigate('/(tabs)/catalogue')}
        >
          <List size={20} color={Colors.background} strokeWidth={2} />
          <Text style={s.ctaBtnText}>Composer ma liste</Text>
        </TouchableOpacity>
      </SafeAreaView>
    );
  }

  const currentTotal = mode === 'confort' ? result.confortTotal : mode === 'expert' ? result.expertTotal : result.sagesseTotal;
  const currentSavings = mode === 'confort' ? result.confortSavings : mode === 'expert' ? result.expertSavings : result.sagesseSavings;
  const currentPct = mode === 'confort' ? result.confortPct : mode === 'expert' ? result.expertPct : result.sagessePct;

  return (
    <SafeAreaView style={s.root} edges={['top']}>

      {/* ── Header ── */}
      <View style={s.header}>
        <TouchableOpacity style={s.backBtn} onPress={() => router.back()}>
          <ArrowLeft size={20} color={Colors.white} strokeWidth={2} />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={s.headerTitle}>Verdict SmartHunt</Text>
          <Text style={s.headerSub}>
            {userBasket.length} produit{userBasket.length > 1 ? 's' : ''} · Réf. {result.totalStandard.toFixed(2)} €
          </Text>
        </View>
        {/* Badge localisation */}
        <View style={[s.locBadge, locationStatus === 'granted' && s.locBadgeActive]}>
          <Navigation
            size={11}
            color={locationStatus === 'granted' ? Colors.neonGreen : Colors.textMuted}
            strokeWidth={2}
          />
          <Text style={[s.locText, locationStatus === 'granted' && { color: Colors.neonGreen }]}>
            {locationStatus === 'granted' ? 'GPS' : locationStatus === 'loading' ? '...' : 'Paris'}
          </Text>
        </View>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 160 }}>

        {/* ── Encart économie globale ── */}
        <View style={s.savingsHero}>
          <TouchableOpacity
            style={s.savingsHeroLabelRow}
            onPress={() => setTransparencyVisible(true)}
            activeOpacity={0.7}
          >
            <Text style={s.savingsHeroLabel}>Économie totale</Text>
            <Info size={15} color={Colors.textMuted} strokeWidth={2} />
          </TouchableOpacity>
          <Text style={s.savingsHeroAmount}>{currentSavings.toFixed(2)} €</Text>
          <Text style={s.savingsHeroSub}>-{currentPct}% par rapport au prix standard</Text>
        </View>

        {/* ── Nudges manqués ── */}
        {missedNudges.length > 0 && (
          <View style={s.missedNudges}>
            <View style={s.missedNudgesHeader}>
              <Info size={14} color={Colors.gold} strokeWidth={2} />
              <Text style={s.missedNudgesTitle}>
                Optimisation possible : +{missedNudgeSaving.toFixed(2)} € d'économies
              </Text>
              <TouchableOpacity
                style={s.missedNudgesBtn}
                onPress={() => router.canGoBack() ? router.back() : router.navigate('/(tabs)/catalogue')}
              >
                <Text style={s.missedNudgesBtnText}>Modifier</Text>
              </TouchableOpacity>
            </View>
            <Text style={s.missedNudgesSub} numberOfLines={2}>
              {missedNudges.map(n => `${n.emoji} ${n.genericName} ×${n.suggestedQty}`).join(' · ')}
            </Text>
          </View>
        )}

        {/* ── 3 cartes stratégie ── */}
        <View style={{ paddingHorizontal: Spacing.lg }}>
          {(['confort', 'expert', 'sagesse'] as StrategyMode[]).map(m => (
            <StrategyCard key={m} mode={m} selected={mode === m} onSelect={() => setMode(m)} result={result} />
          ))}
        </View>

        {/* ── Avertissement si magasin filtré par distance ── */}
        {nearbyStores.length < ALL_STORE_IDS.length && (
          <View style={s.distanceWarning}>
            <Info size={14} color={Colors.gold} strokeWidth={2} />
            <Text style={s.distanceWarningText}>
              {ALL_STORE_IDS.length - nearbyStores.length} enseigne{ALL_STORE_IDS.length - nearbyStores.length > 1 ? 's' : ''} hors rayon {RADIUS_KM} km exclue{ALL_STORE_IDS.length - nearbyStores.length > 1 ? 's' : ''}
            </Text>
          </View>
        )}

        {/* ── Timeline : Preuve des gains ── */}
        <View style={s.section}>
          <Text style={s.sectionTitle}>Preuve des gains</Text>
          <Text style={s.sectionSub}>Prix Standard → Prix SmartHunt</Text>
          <View style={s.timelineBox}>
            {result.lines.map(line => (
              <TimelineItem
                key={line.groupId}
                line={line}
                mode={mode}
                onDismissSubstitution={blacklistSubstitute}
              />
            ))}
          </View>
        </View>

        {/* ── Itinéraire Expert multi-enseignes ── */}
        {mode === 'expert' && expertStoreGroups.length > 1 && (
          <View style={s.section}>
            <Text style={s.sectionTitle}>Itinéraire multi-enseignes</Text>
            <Text style={s.sectionSub}>
              {expertStoreGroups.length} arrêts · {result.expertExtraVsConfort.toFixed(2)} € de plus qu'en Confort
            </Text>
            {expertStoreGroups.map((store, idx) => (
              <React.Fragment key={store}>
                <ExpertStoreGroup
                  store={store}
                  items={result.expertByStore[store]}
                  result={result}
                  distanceKm={haversineKm(coords, STORES_CONFIG[store].coords)}
                />
                {idx < expertStoreGroups.length - 1 && (
                  <RouteConnector
                    km={haversineKm(
                      STORES_CONFIG[store].coords,
                      STORES_CONFIG[expertStoreGroups[idx + 1]].coords,
                    )}
                  />
                )}
              </React.Fragment>
            ))}
          </View>
        )}

        {/* ── Boutons Drive par enseigne ── */}
        {mode === 'expert' && expertStoreGroups.length > 1 && (
          <View style={[s.section, { gap: 10 }]}>
            <Text style={s.sectionTitle}>Remplir les Drives</Text>
            {expertStoreGroups.map(store => {
              const si = STORES_CONFIG[store];
              const count = result.expertByStore[store].length;
              const storeTotal = result.lines
                .filter(l => l.expertStore === store)
                .reduce((sum, l) => sum + l.expertNetPrice, 0);
              return (
                <TouchableOpacity
                  key={store}
                  style={[s.driveBtn, { borderColor: si.color + '80' }]}
                  onPress={() => openDrive(store, result.expertByStore[store], storeTotal)}
                  activeOpacity={0.8}
                >
                  <Text style={s.driveBtnEmoji}>{si.emoji}</Text>
                  <View style={{ flex: 1 }}>
                    <Text style={s.driveBtnLabel}>{si.has_drive ? `Drive ${si.label}` : si.label}</Text>
                    <Text style={s.driveBtnSub}>
                      {count} article{count > 1 ? 's' : ''} · {storeTotal.toFixed(2)} €
                      {!si.has_drive ? ' · En magasin' : ''}
                    </Text>
                  </View>
                  {si.has_drive
                    ? <ExternalLink size={18} color={Colors.electricBlue} strokeWidth={2} />
                    : <Navigation size={18} color={Colors.textMuted} strokeWidth={2} />
                  }
                </TouchableOpacity>
              );
            })}
          </View>
        )}

      </ScrollView>

      {/* ── Footer CTA ── */}
      <View style={s.footer}>
        {mode !== 'sagesse' && (
          <View style={s.breakdownRow}>
            <View style={s.breakdownItem}>
              <Text style={s.breakdownLabel}>À payer en caisse</Text>
              <Text style={s.breakdownCaisse}>
                {(mode === 'confort' ? result.confortCaisse : result.expertCaisse).toFixed(2)} €
              </Text>
            </View>
            <View style={s.breakdownDivider} />
            <View style={s.breakdownItem}>
              <Text style={s.breakdownLabel}>Cagnotte cashback</Text>
              <Text style={s.breakdownCagnotte}>
                +{(mode === 'confort' ? result.confortCagnotte : result.expertCagnotte).toFixed(2)} €
              </Text>
              <Text style={s.breakdownCagnotteSub}>remboursé via appli</Text>
            </View>
          </View>
        )}
        {mode === 'sagesse' && (
          <View style={[s.breakdownRow, { justifyContent: 'center' }]}>
            <View style={s.breakdownItem}>
              <Text style={s.breakdownLabel}>Total à payer en caisse</Text>
              <Text style={s.breakdownCaisse}>{result.sagesseTotal.toFixed(2)} €</Text>
              <Text style={s.breakdownCagnotteSub}>sans cashback ni promo</Text>
            </View>
          </View>
        )}
        <TouchableOpacity
          style={s.ctaBtn}
          onPress={() => handleDriveExport(mode, result, userBasket, nearbyStores)}
          activeOpacity={0.85}
        >
          <Rocket size={20} color={Colors.background} strokeWidth={2} />
          <Text style={s.ctaBtnText}>
            {mode === 'confort'
              ? `Remplir mon Drive ${STORE_LABELS[result.confortStore]}`
              : mode === 'expert'
              ? 'Finaliser ma commande Expert'
              : 'Voir le Drive le moins cher'}
          </Text>
        </TouchableOpacity>
      </View>

      <TransparencyModal visible={transparencyVisible} onClose={() => setTransparencyVisible(false)} />

      <TutorialTooltip
        visible={tutorialSeen === false}
        icon={Info}
        title="Les 3 modes de stratégie"
        body={"Confort : une enseigne, simple et rapide.\nExpert : multi-enseignes, économie maximale.\nSagesse : équilibre prix / praticité."}
        onDismiss={markTutorialSeen}
      />

    </SafeAreaView>
  );
}

// ─────────────────────────────────────────────────────────────
// Styles
// ─────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.background },

  // ── Header ─────────────────────────────────────────────────
  header: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: Spacing.lg, paddingTop: Spacing.md, paddingBottom: Spacing.sm, gap: 10,
  },
  backBtn: {
    width: 40, height: 40, backgroundColor: Colors.card,
    borderRadius: Radius.full, alignItems: 'center', justifyContent: 'center',
  },
  headerTitle: { fontSize: 18, fontWeight: '800', color: Colors.white },
  headerSub: { fontSize: 12, color: Colors.textSecondary, marginTop: 2 },
  locBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 3,
    backgroundColor: Colors.card, borderRadius: Radius.full,
    paddingHorizontal: 8, paddingVertical: 4,
    borderWidth: 1, borderColor: Colors.cardBorder,
  },
  locBadgeActive: { borderColor: Colors.neonGreen + '60' },
  locText: { fontSize: 10, fontWeight: '700', color: Colors.textMuted },

  // ── Encart économie ─────────────────────────────────────────
  savingsHero: {
    marginHorizontal: Spacing.lg, marginVertical: Spacing.lg,
    backgroundColor: Colors.neonGreen + '12',
    borderRadius: Radius.xl, borderWidth: 1, borderColor: Colors.neonGreen + '30',
    paddingVertical: Spacing.xl, alignItems: 'center',
  },
  savingsHeroLabelRow: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  savingsHeroLabel: { fontSize: 13, color: Colors.textSecondary, fontWeight: '600', letterSpacing: 0.5, textTransform: 'uppercase' },
  savingsHeroAmount: { fontSize: 48, fontWeight: '900', color: Colors.neonGreen, lineHeight: 58, letterSpacing: -1 },
  savingsHeroSub: { fontSize: 13, color: Colors.textMuted, marginTop: 4 },

  // ── Nudges manqués ──────────────────────────────────────────
  missedNudges: {
    marginHorizontal: Spacing.lg, marginBottom: Spacing.md,
    backgroundColor: Colors.gold + '12', borderRadius: Radius.lg,
    borderWidth: 1, borderColor: Colors.gold + '35',
    padding: Spacing.md,
  },
  missedNudgesHeader: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  missedNudgesTitle: { flex: 1, fontSize: 12, fontWeight: '700', color: Colors.gold },
  missedNudgesBtn: {
    backgroundColor: Colors.gold, borderRadius: Radius.sm,
    paddingHorizontal: 10, paddingVertical: 3,
  },
  missedNudgesBtnText: { fontSize: 11, fontWeight: '800', color: Colors.background },
  missedNudgesSub: { fontSize: 11, color: Colors.gold + 'AA', marginTop: 5, lineHeight: 16 },

  // ── Avertissement distance ──────────────────────────────────
  distanceWarning: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    marginHorizontal: Spacing.lg, marginBottom: Spacing.md,
    backgroundColor: Colors.gold + '15', borderRadius: Radius.md,
    paddingHorizontal: 12, paddingVertical: 8,
    borderWidth: 1, borderColor: Colors.gold + '30',
  },
  distanceWarningText: { fontSize: 12, color: Colors.gold, flex: 1 },

  // ── Carte stratégie ─────────────────────────────────────────
  card: {
    backgroundColor: Colors.card, borderRadius: Radius.xl,
    borderWidth: 1, borderColor: Colors.cardBorder,
    padding: Spacing.lg, marginBottom: Spacing.md,
  },
  cardHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: Spacing.md },
  modeTag: { paddingHorizontal: 10, paddingVertical: 3, borderRadius: Radius.full },
  modeTagText: { fontSize: 10, fontWeight: '900', letterSpacing: 1 },
  extraBadge: { backgroundColor: Colors.neonGreen + '20', borderRadius: Radius.full, paddingHorizontal: 8, paddingVertical: 3, borderWidth: 1, borderColor: Colors.neonGreen + '40' },
  extraBadgeText: { fontSize: 10, fontWeight: '700', color: Colors.neonGreen },
  checkDot: { width: 22, height: 22, borderRadius: 11, alignItems: 'center', justifyContent: 'center', marginLeft: 'auto' },
  cardBody: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: Spacing.md },
  cardIconWrap: { width: 44, height: 44, borderRadius: Radius.md, alignItems: 'center', justifyContent: 'center' },
  cardIconInitial: { fontSize: 20, fontWeight: '900' },
  cardTitle: { fontSize: 15, fontWeight: '800', color: Colors.white },
  cardSub: { fontSize: 11, color: Colors.textMuted, marginTop: 2 },
  priceRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 },
  priceLabel: { fontSize: 10, color: Colors.textMuted, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.5 },
  priceFinal: { fontSize: 28, fontWeight: '900', lineHeight: 34, letterSpacing: -0.5 },
  savingsBox: { borderRadius: Radius.md, borderWidth: 1, paddingHorizontal: 14, paddingVertical: 10, alignItems: 'center' },
  savingsAmount: { fontSize: 18, fontWeight: '900' },
  savingsPct: { fontSize: 11, marginTop: 1 },
  detailText: { fontSize: 11, color: Colors.textMuted, fontStyle: 'italic' },

  // ── Section ─────────────────────────────────────────────────
  section: { paddingHorizontal: Spacing.lg, marginTop: Spacing.xl },
  sectionTitle: { fontSize: 16, fontWeight: '800', color: Colors.white, marginBottom: 2 },
  sectionSub: { fontSize: 12, color: Colors.textMuted, marginBottom: Spacing.md },

  // ── Timeline ────────────────────────────────────────────────
  timelineBox: { backgroundColor: Colors.card, borderRadius: Radius.lg, borderWidth: 1, borderColor: Colors.cardBorder, overflow: 'hidden' },
  timelineItem: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: Spacing.md, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: Colors.cardBorder },
  timelineEmoji: { fontSize: 20, width: 28 },
  timelineName: { fontSize: 13, fontWeight: '600', color: Colors.white },
  timelinePrices: { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 2 },
  timelineStandard: { fontSize: 11, color: Colors.textMuted, textDecorationLine: 'line-through' },
  timelineNet: { fontSize: 12, fontWeight: '700', color: Colors.neonGreen },
  timelineStoreChip: { borderRadius: Radius.full, paddingHorizontal: 5, paddingVertical: 1, marginLeft: 2 },
  timelineStore: { fontSize: 10, fontWeight: '700' },
  timelinePerUnit: { fontSize: 10, color: Colors.textMuted, fontStyle: 'italic' },
  qtyBadge: {
    backgroundColor: Colors.electricBlue + '22', borderRadius: Radius.full,
    paddingHorizontal: 5, paddingVertical: 1, borderWidth: 1, borderColor: Colors.electricBlue + '55',
  },
  qtyBadgeText: { fontSize: 10, fontWeight: '800', color: Colors.electricBlue },
  timelinePromo: { fontSize: 10, color: Colors.electricBlue, marginTop: 1 },
  timelineCashback: { fontSize: 10, color: '#00CC6A', marginTop: 0 },
  timelineSubstitution: { fontSize: 10, color: '#10B981', fontStyle: 'italic', marginTop: 1 },
  substitutionRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 1 },
  dismissBtn: { flexDirection: 'row', alignItems: 'center', gap: 2, paddingLeft: 4 },
  dismissText: { fontSize: 9, color: Colors.textMuted },
  timelineSavingBox: { backgroundColor: Colors.neonGreen + '18', borderRadius: Radius.sm, paddingHorizontal: 6, paddingVertical: 3, minWidth: 52, alignItems: 'center' },
  timelineSaving: { fontSize: 12, fontWeight: '800', color: Colors.neonGreen },

  // ── Route connector ─────────────────────────────────────────
  routeConnector: { flexDirection: 'row', alignItems: 'center', marginHorizontal: Spacing.md, marginVertical: 4 },
  routeLine: { flex: 1, height: 1, backgroundColor: Colors.cardBorder },
  routeBadge: { flexDirection: 'row', alignItems: 'center', gap: 3, paddingHorizontal: 8, paddingVertical: 3, backgroundColor: Colors.card, borderRadius: Radius.full, borderWidth: 1, borderColor: Colors.cardBorder },
  routeKm: { fontSize: 10, color: Colors.textMuted, fontWeight: '600' },

  // ── Expert store groups ──────────────────────────────────────
  storeGroup: { backgroundColor: Colors.card, borderRadius: Radius.lg, borderWidth: 1, borderColor: Colors.cardBorder, overflow: 'hidden', marginBottom: 4 },
  storeGroupHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: Spacing.md, paddingVertical: 10, backgroundColor: Colors.surface, borderLeftWidth: 3 },
  storeGroupDot: { width: 30, height: 30, borderRadius: 15, borderWidth: 1.5, alignItems: 'center', justifyContent: 'center' },
  storeGroupDotText: { fontSize: 13, fontWeight: '800' },
  storeGroupLabel: { fontSize: 14, fontWeight: '800', color: Colors.white },
  storeGroupDist: { fontSize: 10, color: Colors.textMuted, marginTop: 1 },
  noDriveBadge: { backgroundColor: Colors.textMuted + '30', borderRadius: 4, paddingHorizontal: 5, paddingVertical: 2 },
  noDriveBadgeText: { fontSize: 9, fontWeight: '700', color: Colors.textMuted },
  storeGroupCount: { fontSize: 11, color: Colors.textMuted },
  storeGroupTotal: { fontSize: 14, fontWeight: '800', color: Colors.neonGreen, marginLeft: 8 },
  storeGroupItem: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: Spacing.md, paddingVertical: 8, borderTopWidth: 1, borderTopColor: Colors.cardBorder },
  storeGroupItemEmoji: { fontSize: 16, width: 24 },
  storeGroupItemName: { fontSize: 13, color: Colors.textSecondary, flex: 1 },
  storeGroupItemPrice: { fontSize: 13, fontWeight: '700', color: Colors.white },

  // ── Drive buttons ────────────────────────────────────────────
  driveBtn: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: Colors.card, borderRadius: Radius.lg, borderWidth: 1, paddingHorizontal: Spacing.md, paddingVertical: 14 },
  driveBtnEmoji: { fontSize: 22 },
  driveBtnLabel: { fontSize: 14, fontWeight: '700', color: Colors.white },
  driveBtnSub: { fontSize: 11, color: Colors.textMuted, marginTop: 1 },

  // ── Footer ──────────────────────────────────────────────────
  footer: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    backgroundColor: Colors.surface + 'F8',
    borderTopWidth: 1, borderTopColor: Colors.cardBorder,
    paddingHorizontal: Spacing.lg, paddingTop: Spacing.md, paddingBottom: 36,
    gap: Spacing.md,
  },
  breakdownRow: { flexDirection: 'row', gap: Spacing.md, backgroundColor: Colors.card, borderRadius: Radius.md, borderWidth: 1, borderColor: Colors.cardBorder, padding: Spacing.md },
  breakdownItem: { flex: 1, alignItems: 'center', gap: 2 },
  breakdownDivider: { width: 1, backgroundColor: Colors.cardBorder },
  breakdownLabel: { fontSize: 10, color: Colors.textMuted, fontWeight: '600', textAlign: 'center' },
  breakdownCaisse: { fontSize: 20, fontWeight: '900', color: Colors.white },
  breakdownCagnotte: { fontSize: 20, fontWeight: '900', color: Colors.neonGreen },
  breakdownCagnotteSub: { fontSize: 10, color: Colors.textMuted, fontStyle: 'italic' },
  ctaBtn: {
    backgroundColor: Colors.neonGreen, borderRadius: Radius.lg,
    paddingVertical: 16, flexDirection: 'row', alignItems: 'center',
    justifyContent: 'center', gap: 10,
  },
  ctaBtnText: { fontSize: 16, fontWeight: '900', color: Colors.background },
});
