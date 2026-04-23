import React, { useState } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet,
  ScrollView,
} from 'react-native';
import { showAlert } from '@/utils/alert';
import TutorialTooltip from '@/components/TutorialTooltip';
import { useTutorial } from '@/hooks/useTutorial';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Clock, Camera, Search, CheckCircle, ScanLine, Zap, List, Wallet, FileText } from 'lucide-react-native';
import { Colors, Spacing, Radius, Typography } from '@/constants/theme';
import { useSmartHuntStore } from '@/store/useSmartHuntStore';

type ScanStep = 'idle' | 'scanning' | 'processing' | 'results';

interface DetectedItem {
  ean: string;
  name: string;
  price: number;
  matched: boolean;
  huntItemId?: string;
  cashback?: number;
  cashbackSource?: string;
}

const MOCK_OCR_RESULTS: DetectedItem[] = [
  { ean: '3045320094084', name: 'NUTELLA 825G', price: 3.95, matched: true, huntItemId: '001', cashback: 2.00, cashbackSource: 'Shopmium' },
  { ean: '8000500310427', name: 'BARILLA SPAG N5 500G', price: 1.07, matched: true, huntItemId: '007', cashback: 0.80, cashbackSource: 'Shopmium' },
  { ean: '3017750313053', name: 'EVIAN 6X1L', price: 3.49, matched: false },
];

const DAY_MS = 24 * 60 * 60 * 1000;

export default function ScanScreen() {
  const { huntList, claimCashback, userBasket, lastScanAt, recordScan } = useSmartHuntStore();
  const { seen: tutorialSeen, markSeen: markTutorialSeen } = useTutorial('scanner');
  const [step, setStep] = useState<ScanStep>('idle');
  const [results, setResults] = useState<DetectedItem[]>([]);

  // Calcul relance : panier non-vide ET (jamais scanné OU > 7 jours)
  const daysSinceScan = lastScanAt ? (Date.now() - lastScanAt) / DAY_MS : Infinity;
  const showRelance   = userBasket.length > 0 && daysSinceScan > 7;
  const unclaimedCb   = huntList
    .filter(i => i.optimization.odr && !i.cashbackClaimed)
    .reduce((s, i) => s + (i.optimization.odr?.cashback ?? 0), 0);

  const handleScan = () => {
    showAlert(
      'Scanner le ticket',
      'Choisissez comment importer votre ticket de caisse.',
      [
        { text: 'Annuler', style: 'cancel' },
        { text: 'Appareil photo', onPress: simulateScan },
        { text: 'Galerie photo', onPress: simulateScan },
      ]
    );
  };

  const simulateScan = () => {
    setStep('scanning');
    setTimeout(() => {
      setStep('processing');
      setTimeout(() => {
        setResults(MOCK_OCR_RESULTS);
        setStep('results');
      }, 2000);
    }, 1500);
  };

  const handleClaimAll = () => {
    const matched = results.filter(r => r.matched && r.huntItemId);
    matched.forEach(item => {
      if (item.huntItemId) claimCashback(item.huntItemId);
    });
    recordScan(); // Enregistre la date du scan pour les rappels
    showAlert(
      'Activés !',
      `${matched.length} demande${matched.length > 1 ? 's' : ''} de remboursement envoyée${matched.length > 1 ? 's' : ''}. Vous serez crédité dans 3-5 jours ouvrés.`,
      [{ text: 'Super !', onPress: () => setStep('idle') }]
    );
  };

  const handleReset = () => {
    setStep('idle');
    setResults([]);
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <Text style={styles.title}>Scanner un Ticket</Text>
          <Text style={styles.subtitle}>Confirmez vos achats et activez vos remboursements</Text>
        </View>

        {step === 'idle' && (
          <>
            {/* ── Bannière de relance ── */}
            {showRelance && (
              <View style={styles.relanceBanner}>
                <View style={styles.relanceBannerTop}>
                  <Clock size={18} color={Colors.gold} strokeWidth={2} />
                  <Text style={styles.relanceTitle}>
                    {daysSinceScan === Infinity
                      ? 'Vous n\'avez pas encore scanné de ticket'
                      : `Dernier scan il y a ${Math.floor(daysSinceScan)} jours`}
                  </Text>
                </View>
                <Text style={styles.relanceSub}>
                  {unclaimedCb > 0
                    ? `${userBasket.length} produit${userBasket.length > 1 ? 's' : ''} dans votre panier · ${unclaimedCb.toFixed(2)} € de cashback à activer`
                    : `${userBasket.length} produit${userBasket.length > 1 ? 's' : ''} dans votre panier à valider`}
                </Text>
                <TouchableOpacity style={styles.relanceBtn} onPress={handleScan}>
                  <Camera size={15} color={Colors.background} strokeWidth={2} />
                  <Text style={styles.relanceBtnText}>Scanner maintenant</Text>
                </TouchableOpacity>
              </View>
            )}

            <TouchableOpacity style={styles.scanCta} onPress={handleScan} activeOpacity={0.85}>
              <View style={styles.scanIconRing}>
                <View style={styles.scanIconInner}>
                  <FileText size={44} color={Colors.neonGreen} strokeWidth={2} />
                </View>
              </View>
              <Text style={styles.scanCtaTitle}>Photographier mon ticket</Text>
              <Text style={styles.scanCtaSubtitle}>
                Notre IA lit votre ticket et associe automatiquement les achats à votre liste de chasse.
              </Text>
            </TouchableOpacity>

            <View style={styles.howSection}>
              <Text style={styles.howTitle}>Comment ça marche ?</Text>
              {(
                [
                  { Icon: Camera, step: '1', text: 'Photographiez votre ticket de caisse entier' },
                  { Icon: Search, step: '2', text: 'L\'IA détecte les produits de votre liste de chasse' },
                  { Icon: CheckCircle, step: '3', text: 'Les remboursements ODR sont activés automatiquement' },
                  { Icon: Wallet, step: '4', text: 'Votre cagnotte est créditée sous 3-5 jours' },
                ]
              ).map(({ Icon, step: s, text }) => (
                <View key={s} style={styles.howItem}>
                  <View style={styles.howNumber}>
                    <Text style={styles.howNumberText}>{s}</Text>
                  </View>
                  <Icon size={20} color={Colors.electricBlue} strokeWidth={2} style={styles.howIcon} />
                  <Text style={styles.howText}>{text}</Text>
                </View>
              ))}
            </View>

            {huntList.length > 0 && (
              <View style={styles.reminderCard}>
                <Text style={styles.reminderTitle}>
                  {huntList.length} produit{huntList.length > 1 ? 's' : ''} dans votre liste
                </Text>
                <Text style={styles.reminderText}>
                  Scannez votre ticket après vos achats pour activer les remboursements.
                </Text>
              </View>
            )}
          </>
        )}

        {step === 'scanning' && (
          <View style={styles.processingState}>
            <View style={styles.scanAnimation}>
              <ScanLine size={80} color={Colors.neonGreen} strokeWidth={2} />
            </View>
            <Text style={styles.processingTitle}>Scan en cours...</Text>
            <Text style={styles.processingSubtitle}>Positionnez votre ticket dans la zone de scan</Text>
          </View>
        )}

        {step === 'processing' && (
          <View style={styles.processingState}>
            <View style={styles.aiAnimation}>
              <Zap size={60} color={Colors.electricBlue} strokeWidth={2} />
            </View>
            <Text style={styles.processingTitle}>Analyse IA en cours...</Text>
            <Text style={styles.processingSubtitle}>Détection des produits et correspondances ODR</Text>
            <View style={styles.progressBar}>
              <View style={styles.progressFill} />
            </View>
          </View>
        )}

        {step === 'results' && (
          <>
            <View style={styles.resultsHeader}>
              <View style={styles.resultsIcon}>
                <CheckCircle size={32} color={Colors.neonGreen} strokeWidth={2} />
              </View>
              <View>
                <Text style={styles.resultsTitle}>Ticket analysé !</Text>
                <Text style={styles.resultsSubtitle}>
                  {results.filter(r => r.matched).length} correspondance{results.filter(r => r.matched).length > 1 ? 's' : ''} trouvée{results.filter(r => r.matched).length > 1 ? 's' : ''}
                </Text>
              </View>
            </View>

            {results.map((item, idx) => (
              <View key={idx} style={[styles.resultItem, item.matched && styles.resultItemMatched]}>
                <View style={styles.resultLeft}>
                  <View style={[styles.resultDot, { backgroundColor: item.matched ? Colors.neonGreen : Colors.textMuted }]} />
                  <View>
                    <Text style={styles.resultName}>{item.name}</Text>
                    <Text style={styles.resultPrice}>{item.price.toFixed(2)}€</Text>
                  </View>
                </View>
                {item.matched && item.cashback ? (
                  <View style={styles.resultCashback}>
                    <Text style={styles.resultCashbackSource}>{item.cashbackSource}</Text>
                    <Text style={styles.resultCashbackAmount}>+{item.cashback.toFixed(2)}€</Text>
                  </View>
                ) : (
                  <Text style={styles.resultNoMatch}>Non répertorié</Text>
                )}
              </View>
            ))}

            <View style={styles.resultsSummary}>
              <Text style={styles.resultsSummaryLabel}>Total remboursements à activer</Text>
              <Text style={styles.resultsSummaryAmount}>
                +{results.reduce((s, r) => s + (r.cashback || 0), 0).toFixed(2)}€
              </Text>
            </View>

            <TouchableOpacity style={styles.claimBtn} onPress={handleClaimAll}>
              <Zap size={18} color={Colors.background} strokeWidth={2} />
              <Text style={styles.claimBtnText}>Activer tous les remboursements</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.resetBtn} onPress={handleReset}>
              <Text style={styles.resetBtnText}>Scanner un autre ticket</Text>
            </TouchableOpacity>
          </>
        )}
      </ScrollView>

      <TutorialTooltip
        visible={tutorialSeen === false}
        icon={ScanLine}
        title="Comment scanner votre ticket"
        body={"Photographiez le ticket en entier dans un endroit bien éclairé.\nNotre IA détecte automatiquement tous les produits et les associe à votre liste."}
        onDismiss={markTutorialSeen}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  scroll: { padding: Spacing.lg, paddingBottom: 100 },
  header: { paddingTop: Spacing.lg, marginBottom: Spacing.xl },
  title: { ...Typography.h2, color: Colors.white },
  subtitle: { ...Typography.body, color: Colors.textSecondary, marginTop: 4 },

  relanceBanner: {
    backgroundColor: Colors.gold + '15',
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: Colors.gold + '40',
    padding: Spacing.lg,
    marginBottom: Spacing.lg,
  },
  relanceBannerTop: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, marginBottom: 4 },
  relanceTitle: { ...Typography.bodyBold, color: Colors.gold, flex: 1 },
  relanceSub: { ...Typography.small, color: Colors.textSecondary, marginBottom: Spacing.md, lineHeight: 20 },
  relanceBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
    backgroundColor: Colors.gold,
    borderRadius: Radius.md,
    paddingVertical: 10,
  },
  relanceBtnText: { ...Typography.bodyBold, color: Colors.background, fontSize: 14 },

  scanCta: {
    backgroundColor: Colors.card,
    borderRadius: Radius.xl,
    borderWidth: 2,
    borderColor: Colors.neonGreen + '44',
    borderStyle: 'dashed',
    padding: Spacing.xxl,
    alignItems: 'center',
    marginBottom: Spacing.xl,
  },
  scanIconRing: {
    width: 120,
    height: 120,
    borderRadius: 60,
    borderWidth: 2,
    borderColor: Colors.neonGreen + '33',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.lg,
  },
  scanIconInner: {
    width: 90,
    height: 90,
    borderRadius: 45,
    backgroundColor: Colors.neonGreen + '15',
    alignItems: 'center',
    justifyContent: 'center',
  },
  scanCtaTitle: { ...Typography.h3, color: Colors.white, marginBottom: Spacing.sm },
  scanCtaSubtitle: { ...Typography.body, color: Colors.textSecondary, textAlign: 'center', lineHeight: 22 },

  howSection: { marginBottom: Spacing.xl },
  howTitle: { ...Typography.bodyBold, color: Colors.white, marginBottom: Spacing.md },
  howItem: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md, marginBottom: Spacing.md },
  howNumber: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: Colors.electricBlue + '22',
    alignItems: 'center',
    justifyContent: 'center',
  },
  howNumberText: { ...Typography.smallBold, color: Colors.electricBlue },
  howIcon: { width: 24, alignItems: 'center' },
  howText: { ...Typography.body, color: Colors.textSecondary, flex: 1 },

  reminderCard: {
    backgroundColor: Colors.electricBlue + '15',
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: Colors.electricBlue + '33',
    padding: Spacing.lg,
  },
  reminderTitle: { ...Typography.bodyBold, color: Colors.electricBlue, marginBottom: 4 },
  reminderText: { ...Typography.small, color: Colors.textSecondary },

  processingState: { alignItems: 'center', paddingVertical: Spacing.xxl * 2 },
  scanAnimation: {
    width: 140,
    height: 140,
    borderRadius: 70,
    backgroundColor: Colors.neonGreen + '15',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.xl,
  },
  aiAnimation: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: Colors.electricBlue + '15',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.xl,
  },
  processingTitle: { ...Typography.h3, color: Colors.white, marginBottom: Spacing.sm },
  processingSubtitle: { ...Typography.body, color: Colors.textSecondary, textAlign: 'center' },
  progressBar: {
    width: 200,
    height: 4,
    backgroundColor: Colors.cardBorder,
    borderRadius: 2,
    marginTop: Spacing.xl,
    overflow: 'hidden',
  },
  progressFill: { width: '70%', height: '100%', backgroundColor: Colors.electricBlue, borderRadius: 2 },

  resultsHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    marginBottom: Spacing.lg,
  },
  resultsIcon: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: Colors.neonGreen + '15',
    alignItems: 'center',
    justifyContent: 'center',
  },
  resultsTitle: { ...Typography.h3, color: Colors.white },
  resultsSubtitle: { ...Typography.small, color: Colors.textSecondary },

  resultItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: Colors.card,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
    padding: Spacing.md,
    marginBottom: Spacing.sm,
  },
  resultItemMatched: { borderColor: Colors.neonGreen + '44' },
  resultLeft: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md, flex: 1 },
  resultDot: { width: 10, height: 10, borderRadius: 5 },
  resultName: { ...Typography.bodyBold, color: Colors.white },
  resultPrice: { ...Typography.small, color: Colors.textSecondary },
  resultCashback: { alignItems: 'flex-end' },
  resultCashbackSource: { ...Typography.tiny, color: Colors.textMuted },
  resultCashbackAmount: { ...Typography.bodyBold, color: Colors.neonGreen },
  resultNoMatch: { ...Typography.small, color: Colors.textMuted },

  resultsSummary: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: Colors.neonGreen + '15',
    borderRadius: Radius.lg,
    padding: Spacing.lg,
    marginTop: Spacing.md,
    marginBottom: Spacing.xl,
    borderWidth: 1,
    borderColor: Colors.neonGreen + '33',
  },
  resultsSummaryLabel: { ...Typography.bodyBold, color: Colors.white },
  resultsSummaryAmount: { fontSize: 22, fontWeight: '800', color: Colors.neonGreen },

  claimBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
    backgroundColor: Colors.neonGreen,
    borderRadius: Radius.lg,
    padding: Spacing.lg,
    marginBottom: Spacing.md,
  },
  claimBtnText: { ...Typography.bodyBold, color: Colors.background, fontSize: 16 },
  resetBtn: { alignItems: 'center', padding: Spacing.md },
  resetBtnText: { ...Typography.bodyBold, color: Colors.textSecondary },
});
