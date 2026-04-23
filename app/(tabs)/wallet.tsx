import React, { useMemo, useState } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Clock, ShieldCheck, Tag, Smartphone, ArrowUpCircle, Gift, Target, Crosshair, Zap, Flame, Gem, Lock, type LucideIcon } from 'lucide-react-native';
import { Colors, Spacing, Radius, Typography } from '@/constants/theme';
import { useSmartHuntStore } from '@/store/useSmartHuntStore';
import { HUNTER_BADGES } from '@/data/mockData';
import { StoreId, STORES_CONFIG } from '@/data/productsDB';
import { getBestNetPrice, getNearbyStores, PARIS_CENTER } from '@/engine/netPrice';
import { showAlert } from '@/utils/alert';
import TransparencyModal from '@/components/TransparencyModal';

const ALL_STORES = getNearbyStores(PARIS_CENTER, 15);

const BADGE_ICONS: Record<string, LucideIcon> = {
  Target, Crosshair, Zap, Flame, Gem,
};


const APP_COLORS: Record<string, string> = {
  shopmium:       '#FF3B5C',
  quoty:          '#A855F7',
  coupon_network: '#0055B8',
};
const APP_LABELS: Record<string, string> = {
  shopmium:       'Shopmium',
  quoty:          'Quoty',
  coupon_network: 'Coupon Network',
};

const TRANSACTIONS = [
  { id: 't1', label: 'Nutella · Shopmium',         amount: 2.00,   date: '21 avr.', out: false },
  { id: 't2', label: 'Nescafé · Coupon Network',   amount: 3.00,   date: '19 avr.', out: false },
  { id: 't3', label: 'Barilla · Shopmium',          amount: 0.80,   date: '18 avr.', out: false },
  { id: 't4', label: 'Ariel · Coupon Network',      amount: 4.00,   date: '15 avr.', out: false },
  { id: 't5', label: 'Virement reçu',               amount: -20.00, date: '10 avr.', out: true  },
  { id: 't6', label: 'Pampers · Coupon Network',    amount: 5.00,   date: '08 avr.', out: false },
  { id: 't7', label: 'Milka · Shopmium',            amount: 0.80,   date: '05 avr.', out: false },
];

const DAY_MS = 24 * 60 * 60 * 1000;

export default function WalletScreen() {
  const { availableCashback, pendingCashback, totalSavings, userBasket, requestTransfer, huntList, monthlyGoal } = useSmartHuntStore();
  const [transparencyVisible, setTransparencyVisible] = useState(false);

  // ── ODR actifs (non encore remboursés) ───────────────────
  const activeODRs = useMemo(() =>
    huntList
      .filter(i => i.optimization.odr?.expiresAt && !i.cashbackClaimed)
      .map(i => {
        const odr       = i.optimization.odr!;
        const daysLeft  = (new Date(odr.expiresAt).getTime() - Date.now()) / DAY_MS;
        // Barre d'urgence : 0% = 30j+ restants, 100% = expiré
        const barPct    = Math.min(100, Math.max(0, Math.round((1 - daysLeft / 30) * 100)));
        const urgency   = daysLeft < 2 ? 'critical' : daysLeft < 7 ? 'urgent' : 'normal';
        return { item: i, odr, daysLeft, barPct, urgency };
      })
      .sort((a, b) => a.daysLeft - b.daysLeft), // les plus urgents en premier
  [huntList]);

  // ── Cashbacks en attente depuis le panier courant ─────────
  const pendingByApp = useMemo(() => {
    const byApp = new Map<string, { label: string; color: string; amount: number; count: number }>();
    for (const item of userBasket) {
      const cb = item.variant.cashback_app;
      if (!cb) continue;
      const existing = byApp.get(cb.app) ?? {
        label: APP_LABELS[cb.app] ?? cb.app,
        color: APP_COLORS[cb.app] ?? Colors.neonGreen,
        amount: 0,
        count: 0,
      };
      existing.amount = Math.round((existing.amount + cb.amount * item.qty) * 100) / 100;
      existing.count += item.qty;
      byApp.set(cb.app, existing);
    }
    return [...byApp.values()];
  }, [userBasket]);

  const totalBasketCashback = Math.round(pendingByApp.reduce((s, a) => s + a.amount, 0) * 100) / 100;

  // ── Répartition économies par enseigne (meilleur prix par produit) ─
  const storeBreakdown = useMemo((): Array<{ storeId: StoreId; savings: number; cashback: number; items: number }> => {
    const byStore = new Map<StoreId, { savings: number; cashback: number; items: number }>();

    for (const item of userBasket) {
      const v = item.variant;
      let bestStore: StoreId | null = null;
      let bestNet = Infinity;

      for (const sid of ALL_STORES) {
        const res = getBestNetPrice(v, sid);
        if (res && res.netPrice < bestNet) { bestNet = res.netPrice; bestStore = sid; }
      }
      if (!bestStore) continue;

      const entry = byStore.get(bestStore) ?? { savings: 0, cashback: 0, items: 0 };
      entry.savings = Math.round((entry.savings + Math.max(0, v.basePrice - bestNet) * item.qty) * 100) / 100;
      entry.cashback = Math.round((entry.cashback + (v.cashback_app?.amount ?? 0) * item.qty) * 100) / 100;
      entry.items += item.qty;
      byStore.set(bestStore, entry);
    }

    return [...byStore.entries()]
      .map(([storeId, data]) => ({ storeId, ...data }))
      .sort((a, b) => (b.savings + b.cashback) - (a.savings + a.cashback));
  }, [userBasket]);

  const monthlyProgress = Math.min((totalSavings / monthlyGoal) * 100, 100);
  const currentBadge = HUNTER_BADGES.filter(b => totalSavings >= b.threshold).slice(-1)[0];
  const nextBadge = HUNTER_BADGES.find(b => totalSavings < b.threshold);

  const handleTransfer = () => {
    if (availableCashback < 20) {
      showAlert(
        'Seuil non atteint',
        `Il vous faut 20 € minimum. Il vous manque ${(20 - availableCashback).toFixed(2)} €.`
      );
      return;
    }
    showAlert(
      'Demande de virement',
      `Confirmer le virement de ${availableCashback.toFixed(2)} € sur votre compte bancaire ?`,
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text: 'Confirmer', onPress: () => {
            requestTransfer();
            showAlert('Virement demandé', 'Vous recevrez votre argent sous 3-5 jours ouvrés.');
          },
        },
      ]
    );
  };

  const handleGiftCard = () => {
    showAlert(
      'Convertir en carte cadeau',
      'Choisissez votre enseigne partenaire.',
      [
        { text: 'Annuler', style: 'cancel' },
        { text: 'Amazon',  onPress: () => showAlert('Bientôt disponible', 'Cette fonctionnalité arrive très bientôt !') },
        { text: 'Leclerc', onPress: () => showAlert('Bientôt disponible', 'Cette fonctionnalité arrive très bientôt !') },
      ]
    );
  };

  return (
    <SafeAreaView style={s.root} edges={['top']}>
      <ScrollView contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false}>

        {/* ── Header ── */}
        <View style={s.header}>
          <Text style={s.title}>Ma Cagnotte</Text>
          {currentBadge && (() => {
            const BadgeIcon = BADGE_ICONS[currentBadge.icon] ?? Target;
            return (
              <View style={[s.badgeChip, { borderColor: currentBadge.color }]}>
                <BadgeIcon size={14} color={currentBadge.color} strokeWidth={2} />
                <Text style={[s.badgeChipLabel, { color: currentBadge.color }]}>{currentBadge.name}</Text>
              </View>
            );
          })()}
        </View>

        {/* ── Solde principal ── */}
        <View style={s.balanceCard}>
          <Text style={s.balanceLabel}>Disponible</Text>
          <Text style={s.balanceAmount}>{availableCashback.toFixed(2)} €</Text>
          {(pendingCashback > 0 || totalBasketCashback > 0) && (
            <View style={s.pendingRow}>
              <Clock size={13} color={Colors.gold} strokeWidth={2} />
              <Text style={s.pendingText}>
                {(pendingCashback + totalBasketCashback).toFixed(2)} € en attente de validation
              </Text>
            </View>
          )}
        </View>

        {/* ── Certification SmartHunt ── */}
        <TouchableOpacity style={s.certBanner} onPress={() => setTransparencyVisible(true)} activeOpacity={0.7}>
          <ShieldCheck size={13} color={Colors.neonGreen} strokeWidth={2} />
          <Text style={s.certBannerText}>
            Certifié SmartHunt : Ces gains correspondent à des remises réelles applicables immédiatement ou via preuve d'achat.
          </Text>
          <Text style={s.certBannerLink}>En savoir plus</Text>
        </TouchableOpacity>

        {/* ── Centre de Rappels ODR ── */}
        {activeODRs.length > 0 && (
          <View style={s.section}>
            <View style={s.odrCentreHeader}>
              <Text style={s.sectionTitle}>Rappels ODR</Text>
              <View style={s.odrCentrePill}>
                <Text style={s.odrCentrePillText}>{activeODRs.length} actif{activeODRs.length > 1 ? 's' : ''}</Text>
              </View>
            </View>
            <Text style={s.sectionSub}>Remboursements à déclencher avant expiration</Text>
            {activeODRs.map(({ item, odr, daysLeft, barPct, urgency }) => {
              const barColor = urgency === 'critical' ? Colors.orange
                : urgency === 'urgent' ? Colors.gold
                : Colors.neonGreen;
              const daysText = daysLeft < 1
                ? "Expire aujourd'hui !"
                : daysLeft < 2
                ? '1 jour restant'
                : `${Math.floor(daysLeft)} jours restants`;
              return (
                <View
                  key={item.optimization.id}
                  style={[s.odrCard, urgency === 'critical' && s.odrCardCritical, urgency === 'urgent' && s.odrCardUrgent]}
                >
                  <View style={s.odrCardTop}>
                    <Text style={s.odrCardEmoji}>{item.optimization.emoji}</Text>
                    <View style={{ flex: 1 }}>
                      <Text style={s.odrCardName} numberOfLines={1}>{item.optimization.name}</Text>
                      <Text style={s.odrCardSource}>{odr.source}</Text>
                    </View>
                    <View style={s.odrCardRight}>
                      <Text style={[s.odrCardCashback, { color: barColor }]}>+{odr.cashback.toFixed(2)} €</Text>
                      <Text style={[s.odrCardDays, { color: barColor }]}>{daysText}</Text>
                    </View>
                  </View>
                  <View style={s.odrBar}>
                    <View style={[s.odrBarFill, { width: `${barPct}%`, backgroundColor: barColor }]} />
                  </View>
                </View>
              );
            })}
          </View>
        )}

        {/* ── Boutons d'action ── */}
        <View style={s.actionsRow}>
          <TouchableOpacity
            style={[s.actionBtn, availableCashback >= 20 && s.actionBtnActive]}
            onPress={handleTransfer}
          >
            <ArrowUpCircle size={24}
              color={availableCashback >= 20 ? Colors.background : Colors.textMuted} strokeWidth={2} />
            <Text style={[s.actionBtnText, availableCashback >= 20 && s.actionBtnTextActive]}>
              Virement
            </Text>
            <Text style={[s.actionBtnSub, availableCashback >= 20 && s.actionBtnSubActive]}>
              Seuil 20 €
            </Text>
          </TouchableOpacity>

          <TouchableOpacity style={s.actionBtn} onPress={handleGiftCard}>
            <Gift size={24} color={Colors.electricBlue} strokeWidth={2} />
            <Text style={[s.actionBtnText, { color: Colors.electricBlue }]}>Carte cadeau</Text>
            <Text style={s.actionBtnSub}>Dès 10 €</Text>
          </TouchableOpacity>
        </View>

        {/* ── Barre progression vers seuil ── */}
        {availableCashback < 20 && (
          <View style={s.thresholdBar}>
            <View style={s.thresholdInfo}>
              <Text style={s.thresholdLabel}>Progression vers 20 €</Text>
              <Text style={s.thresholdAmount}>{availableCashback.toFixed(2)} € / 20 €</Text>
            </View>
            <View style={s.progressTrack}>
              <View style={[s.progressFill, { width: `${Math.round((availableCashback / 20) * 100)}%` }]} />
            </View>
            <Text style={s.thresholdMissing}>
              Il vous manque {(20 - availableCashback).toFixed(2)} € pour demander un virement
            </Text>
          </View>
        )}

        {/* ── Cashback panier en cours ── */}
        {pendingByApp.length > 0 && (
          <View style={s.section}>
            <Text style={s.sectionTitle}>Cashback panier en cours</Text>
            <Text style={s.sectionSub}>
              {userBasket.length} produit{userBasket.length > 1 ? 's' : ''} sélectionné{userBasket.length > 1 ? 's' : ''} · {totalBasketCashback.toFixed(2)} € à récupérer
            </Text>
            {pendingByApp.map(app => (
              <View key={app.label} style={s.appCard}>
                <View style={[s.appDot, { backgroundColor: app.color }]} />
                <View style={{ flex: 1 }}>
                  <Text style={s.appLabel}>{app.label}</Text>
                  <Text style={s.appCount}>{app.count} offre{app.count > 1 ? 's' : ''}</Text>
                </View>
                <Text style={[s.appAmount, { color: app.color }]}>+{app.amount.toFixed(2)} €</Text>
              </View>
            ))}
          </View>
        )}

        {/* ── Répartition par enseigne ── */}
        {storeBreakdown.length > 0 && (
          <View style={s.section}>
            <Text style={s.sectionTitle}>Répartition par enseigne</Text>
            <Text style={s.sectionSub}>Meilleur prix produit par produit</Text>
            {storeBreakdown.map(({ storeId, savings, cashback, items }) => {
              const info = STORES_CONFIG[storeId];
              return (
                <View key={storeId} style={[s.storeCard, { borderLeftColor: info.color }]}>
                  <Text style={s.storeCardEmoji}>{info.emoji}</Text>
                  <View style={{ flex: 1 }}>
                    <Text style={s.storeCardLabel}>{info.label}</Text>
                    <Text style={s.storeCardCount}>{items} article{items > 1 ? 's' : ''}</Text>
                  </View>
                  <View style={s.storeCardRight}>
                    {savings > 0 && (
                      <View style={s.storeStatRow}>
                        <Tag size={11} color={Colors.neonGreen} strokeWidth={2} />
                        <Text style={s.storeStatSavings}>-{savings.toFixed(2)} €</Text>
                      </View>
                    )}
                    {cashback > 0 && (
                      <View style={s.storeStatRow}>
                        <Smartphone size={11} color={Colors.gold} strokeWidth={2} />
                        <Text style={s.storeStatCashback}>+{cashback.toFixed(2)} € CB</Text>
                      </View>
                    )}
                  </View>
                </View>
              );
            })}
          </View>
        )}

        {/* ── Économies cumulées ── */}
        <View style={s.section}>
          <Text style={s.sectionTitle}>Économies du mois</Text>
          <View style={s.monthlyCard}>
            <View style={s.monthlyHeader}>
              <View>
                <Text style={s.monthlyAmount}>{totalSavings.toFixed(2)} €</Text>
                <Text style={s.monthlyLabel}>économisés en avril 2026</Text>
              </View>
              <Text style={s.monthlyPct}>{monthlyProgress.toFixed(0)} %</Text>
            </View>
            <View style={s.progressTrack}>
              <View style={[s.progressFillGreen, { width: `${Math.round(monthlyProgress)}%` }]} />
            </View>
            <View style={s.milestones}>
              {[20, 50, 100].map(m => (
                <View key={m} style={s.milestone}>
                  <View style={[s.milestoneDot, totalSavings >= m && s.milestoneDotDone]} />
                  <Text style={[s.milestoneLabel, totalSavings >= m && s.milestoneLabelDone]}>{m} €</Text>
                </View>
              ))}
            </View>
          </View>
        </View>

        {/* ── Badges ── */}
        <View style={s.section}>
          <Text style={s.sectionTitle}>Badges de Chasseur</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}
            style={{ marginHorizontal: -Spacing.lg, paddingLeft: Spacing.lg }}>
            {HUNTER_BADGES.map(badge => {
              const unlocked = totalSavings >= badge.threshold;
              const BadgeIcon = BADGE_ICONS[badge.icon] ?? Target;
              return (
                <View key={badge.id} style={[s.badgeCard, !unlocked && s.badgeCardLocked]}>
                  <View style={[s.badgeCardIcon, { backgroundColor: (unlocked ? badge.color : Colors.textMuted) + '20', opacity: unlocked ? 1 : 0.5 }]}>
                    {unlocked
                      ? <BadgeIcon size={24} color={badge.color} strokeWidth={1.5} />
                      : <Lock size={20} color={Colors.textMuted} strokeWidth={2} />
                    }
                  </View>
                  <Text style={[s.badgeCardName, { color: unlocked ? badge.color : Colors.textMuted }]}>
                    {badge.name}
                  </Text>
                  <Text style={s.badgeCardThreshold}>
                    {unlocked ? '✓ Débloqué' : `${badge.threshold} €`}
                  </Text>
                </View>
              );
            })}
          </ScrollView>

          {nextBadge && (() => {
            const NextIcon = BADGE_ICONS[nextBadge.icon] ?? Target;
            return (
            <View style={s.nextBadgeCard}>
              <View style={[s.nextBadgeIconWrap, { backgroundColor: nextBadge.color + '18' }]}>
                <NextIcon size={20} color={nextBadge.color} strokeWidth={1.5} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={s.nextBadgeTitle}>Prochain badge : {nextBadge.name}</Text>
                <Text style={s.nextBadgeSub}>
                  Encore {(nextBadge.threshold - totalSavings).toFixed(2)} € d'économies à réaliser
                </Text>
              </View>
            </View>
            );
          })()}
        </View>

        {/* ── Historique ── */}
        <View style={s.section}>
          <Text style={s.sectionTitle}>Historique</Text>
          {TRANSACTIONS.map(tx => (
            <View key={tx.id} style={s.txItem}>
              <View style={[s.txDot, { backgroundColor: tx.out ? Colors.orange : Colors.neonGreen }]} />
              <View style={{ flex: 1 }}>
                <Text style={s.txLabel}>{tx.label}</Text>
                <Text style={s.txDate}>{tx.date}</Text>
              </View>
              <Text style={[s.txAmount, tx.out ? s.txOut : s.txIn]}>
                {tx.amount > 0 ? '+' : ''}{tx.amount.toFixed(2)} €
              </Text>
            </View>
          ))}
        </View>

      </ScrollView>
      <TransparencyModal visible={transparencyVisible} onClose={() => setTransparencyVisible(false)} />
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  root:   { flex: 1, backgroundColor: Colors.background },
  scroll: { padding: Spacing.lg, paddingBottom: 100 },

  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingTop: Spacing.lg, marginBottom: Spacing.xl,
  },
  title: { ...Typography.h2, color: Colors.white },
  badgeChip: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    borderWidth: 1, borderRadius: Radius.full, paddingHorizontal: 12, paddingVertical: 6,
  },
  badgeChipLabel: { ...Typography.smallBold },

  balanceCard: {
    backgroundColor: Colors.card, borderRadius: Radius.xl, padding: Spacing.xl,
    alignItems: 'center', borderWidth: 1, borderColor: Colors.neonGreen + '44', marginBottom: Spacing.lg,
  },
  balanceLabel:  { ...Typography.body, color: Colors.textSecondary, marginBottom: Spacing.sm },
  balanceAmount: { fontSize: 52, fontWeight: '900', color: Colors.neonGreen, letterSpacing: -2 },
  pendingRow:    { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: Spacing.sm },
  pendingText:   { ...Typography.small, color: Colors.gold },

  certBanner: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 6,
    backgroundColor: Colors.neonGreen + '0D',
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: Colors.neonGreen + '25',
    padding: Spacing.md,
    marginBottom: Spacing.md,
    flexWrap: 'wrap',
  },
  certBannerText: { ...Typography.tiny, color: Colors.textSecondary, flex: 1, lineHeight: 16 },
  certBannerLink: { ...Typography.tiny, color: Colors.electricBlue, fontWeight: '700', textDecorationLine: 'underline' },

  // ── Centre de Rappels ODR ─────────────────────────────────
  odrCentreHeader: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, marginBottom: 4 },
  odrCentrePill: {
    backgroundColor: Colors.neonGreen + '22',
    borderRadius: Radius.full,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  odrCentrePillText: { fontSize: 11, fontWeight: '700', color: Colors.neonGreen },

  odrCard: {
    backgroundColor: Colors.card,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
    padding: Spacing.md,
    marginBottom: Spacing.sm,
  },
  odrCardCritical: { borderColor: Colors.orange + '66' },
  odrCardUrgent:   { borderColor: Colors.gold + '55' },
  odrCardTop: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md, marginBottom: 10 },
  odrCardEmoji:    { fontSize: 24 },
  odrCardName:     { ...Typography.bodyBold, color: Colors.white },
  odrCardSource:   { ...Typography.tiny, color: Colors.textMuted, marginTop: 2 },
  odrCardRight:    { alignItems: 'flex-end' },
  odrCardCashback: { ...Typography.bodyBold, fontSize: 16 },
  odrCardDays:     { ...Typography.tiny, fontWeight: '700', marginTop: 2 },
  odrBar: {
    height: 4,
    backgroundColor: Colors.cardBorder,
    borderRadius: 2,
    overflow: 'hidden',
  },
  odrBarFill: { height: '100%', borderRadius: 2 },

  actionsRow: { flexDirection: 'row', gap: Spacing.md, marginBottom: Spacing.lg },
  actionBtn: {
    flex: 1, backgroundColor: Colors.card, borderRadius: Radius.lg,
    padding: Spacing.lg, alignItems: 'center', gap: Spacing.sm,
    borderWidth: 1, borderColor: Colors.cardBorder,
  },
  actionBtnActive:     { backgroundColor: Colors.neonGreen, borderColor: Colors.neonGreen },
  actionBtnText:       { ...Typography.bodyBold, color: Colors.textMuted },
  actionBtnTextActive: { color: Colors.background },
  actionBtnSub:        { ...Typography.tiny, color: Colors.textMuted },
  actionBtnSubActive:  { color: Colors.background + 'CC' },

  thresholdBar: {
    backgroundColor: Colors.card, borderRadius: Radius.lg,
    padding: Spacing.lg, marginBottom: Spacing.xl, borderWidth: 1, borderColor: Colors.cardBorder,
  },
  thresholdInfo:    { flexDirection: 'row', justifyContent: 'space-between', marginBottom: Spacing.sm },
  thresholdLabel:   { ...Typography.small, color: Colors.textSecondary },
  thresholdAmount:  { ...Typography.smallBold, color: Colors.white },
  thresholdMissing: { ...Typography.tiny, color: Colors.textMuted, marginTop: Spacing.sm },

  progressTrack:     { height: 6, backgroundColor: Colors.cardBorder, borderRadius: 3, overflow: 'hidden' },
  progressFill:      { height: '100%', backgroundColor: Colors.electricBlue, borderRadius: 3 },
  progressFillGreen: { height: '100%', backgroundColor: Colors.neonGreen, borderRadius: 3 },

  section:     { marginBottom: Spacing.xl },
  sectionTitle: { ...Typography.bodyBold, color: Colors.white, marginBottom: 4 },
  sectionSub:   { ...Typography.small, color: Colors.textMuted, marginBottom: Spacing.md },

  appCard: {
    flexDirection: 'row', alignItems: 'center', gap: Spacing.md,
    backgroundColor: Colors.card, borderRadius: Radius.md,
    padding: Spacing.md, marginBottom: Spacing.sm,
    borderWidth: 1, borderColor: Colors.cardBorder,
  },
  appDot:    { width: 10, height: 10, borderRadius: 5 },
  appLabel:  { ...Typography.bodyBold, color: Colors.white },
  appCount:  { ...Typography.tiny, color: Colors.textMuted },
  appAmount: { fontSize: 15, fontWeight: '700' },

  storeCard: {
    flexDirection: 'row', alignItems: 'center', gap: Spacing.md,
    backgroundColor: Colors.card, borderRadius: Radius.md,
    padding: Spacing.md, marginBottom: Spacing.sm,
    borderWidth: 1, borderColor: Colors.cardBorder,
    borderLeftWidth: 3,
  },
  storeCardEmoji: { fontSize: 20 },
  storeCardLabel: { ...Typography.bodyBold, color: Colors.white },
  storeCardCount: { ...Typography.tiny, color: Colors.textMuted },
  storeCardRight: { alignItems: 'flex-end', gap: 3 },
  storeStatRow:   { flexDirection: 'row', alignItems: 'center', gap: 4 },
  storeStatSavings:  { fontSize: 13, fontWeight: '700', color: Colors.neonGreen },
  storeStatCashback: { fontSize: 12, fontWeight: '600', color: Colors.gold },

  monthlyCard: {
    backgroundColor: Colors.card, borderRadius: Radius.lg,
    padding: Spacing.lg, borderWidth: 1, borderColor: Colors.cardBorder,
  },
  monthlyHeader: {
    flexDirection: 'row', justifyContent: 'space-between',
    alignItems: 'flex-start', marginBottom: Spacing.md,
  },
  monthlyAmount: { fontSize: 28, fontWeight: '800', color: Colors.neonGreen },
  monthlyLabel:  { ...Typography.small, color: Colors.textSecondary, marginTop: 2 },
  monthlyPct:    { fontSize: 28, fontWeight: '800', color: Colors.electricBlue },
  milestones:    { flexDirection: 'row', justifyContent: 'space-around', marginTop: Spacing.md },
  milestone:         { alignItems: 'center', gap: 4 },
  milestoneDot:      { width: 8, height: 8, borderRadius: 4, backgroundColor: Colors.cardBorder },
  milestoneDotDone:  { backgroundColor: Colors.neonGreen },
  milestoneLabel:    { ...Typography.tiny, color: Colors.textMuted },
  milestoneLabelDone:{ color: Colors.neonGreen },

  badgeCard: {
    width: 110, backgroundColor: Colors.card, borderRadius: Radius.lg,
    padding: Spacing.md, alignItems: 'center', marginRight: Spacing.md,
    borderWidth: 1, borderColor: Colors.cardBorder, gap: Spacing.sm,
  },
  badgeCardLocked:    { opacity: 0.5 },
  badgeCardIcon:      { width: 52, height: 52, borderRadius: 26, alignItems: 'center', justifyContent: 'center', marginBottom: 4 },
  badgeCardName:      { ...Typography.tiny, textAlign: 'center', fontWeight: '700' },
  badgeCardThreshold: { ...Typography.tiny, color: Colors.textMuted },

  nextBadgeCard: {
    flexDirection: 'row', alignItems: 'center', gap: Spacing.md,
    backgroundColor: Colors.electricBlue + '15', borderRadius: Radius.lg,
    padding: Spacing.md, borderWidth: 1, borderColor: Colors.electricBlue + '33', marginTop: Spacing.md,
  },
  nextBadgeIconWrap: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  nextBadgeTitle: { ...Typography.bodyBold, color: Colors.electricBlue },
  nextBadgeSub:   { ...Typography.small, color: Colors.textSecondary, marginTop: 2 },

  txItem: {
    flexDirection: 'row', alignItems: 'center', gap: Spacing.md,
    paddingVertical: Spacing.md, borderBottomWidth: 1, borderBottomColor: Colors.cardBorder,
  },
  txDot:   { width: 10, height: 10, borderRadius: 5, flexShrink: 0 },
  txLabel: { ...Typography.bodyBold, color: Colors.white },
  txDate:  { ...Typography.small, color: Colors.textMuted },
  txAmount:{ ...Typography.bodyBold, fontSize: 15 },
  txIn:    { color: Colors.neonGreen },
  txOut:   { color: Colors.orange },
});
