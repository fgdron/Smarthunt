import React, { useState } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet,
  ScrollView, Linking, Platform, Share,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { ArrowLeft, Share2, Calendar, Bookmark, Zap } from 'lucide-react-native';
import { Colors, Spacing, Radius, Typography } from '@/constants/theme';
import { MOCK_OPTIMIZATIONS } from '@/data/mockData';
import { useSmartHuntStore } from '@/store/useSmartHuntStore';
import PriceCalculator from '@/components/PriceCalculator';
import ShopmiumWelcomeKit from '@/components/ShopmiumWelcomeKit';
import StoreTag from '@/components/StoreTag';
import BadgeCumulMax from '@/components/BadgeCumulMax';
import { showAlert } from '@/utils/alert';

const SHOPMIUM_DEEPLINK = 'shopmium://';
const SHOPMIUM_STORE_URL = Platform.OS === 'ios'
  ? 'https://apps.apple.com/fr/app/shopmium/id506023626'
  : 'https://play.google.com/store/apps/details?id=com.shopmium';

export default function ProductDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { addToHunt, isInHunt, hasShopmium } = useSmartHuntStore();
  const [showWelcomeKit, setShowWelcomeKit] = useState(false);

  const item = MOCK_OPTIMIZATIONS.find(o => o.id === id);
  if (!item) return null;

  const inHunt = isInHunt(item.id);

  const handleActivateShopmium = async () => {
    if (hasShopmium === null) {
      setShowWelcomeKit(true);
      return;
    }
    if (hasShopmium) {
      try {
        const supported = Platform.OS !== 'web' && await Linking.canOpenURL(SHOPMIUM_DEEPLINK);
        if (supported) {
          await Linking.openURL(SHOPMIUM_DEEPLINK);
        } else {
          await Linking.openURL(SHOPMIUM_STORE_URL);
        }
      } catch {
        await Linking.openURL(SHOPMIUM_STORE_URL);
      }
    } else {
      setShowWelcomeKit(true);
    }
  };

  const handleShare = async () => {
    const msg = `SmartHunt — ${item.name}\nPrix normal : ${item.basePrice.toFixed(2)}€ → Prix net final : ${item.finalPrice.toFixed(2)}€ (-${item.savingsPercent}%)\nChez ${item.bestStore}`;
    if (Platform.OS === 'web') {
      if (navigator.share) {
        await navigator.share({ text: msg });
      } else {
        await navigator.clipboard.writeText(msg);
        showAlert('Copié !', 'Le lien a été copié dans votre presse-papier.');
      }
    } else {
      await Share.share({ message: msg });
    }
  };

  const storeColors: Record<string, string> = {
    Leclerc: '#0055A4',
    Carrefour: '#004B98',
    'Intermarché': '#E20613',
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>

        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
            <ArrowLeft size={22} color={Colors.white} strokeWidth={2} />
          </TouchableOpacity>
          <TouchableOpacity style={styles.shareBtn} onPress={handleShare}>
            <Share2 size={22} color={Colors.white} strokeWidth={2} />
          </TouchableOpacity>
        </View>

        {/* Product Hero */}
        <View style={styles.heroCard}>
          <Text style={styles.heroEmoji}>{item.emoji}</Text>
          <View style={styles.heroBadges}>
            {item.tags.slice(0, 2).map(tag => (
              <BadgeCumulMax
                key={tag}
                label={tag}
                variant={tag === 'CUMUL MAX' ? 'cumulmax' : tag.includes('GRATUIT') ? 'free' : 'urgent'}
              />
            ))}
          </View>
          <Text style={styles.heroTitle}>{item.name}</Text>
          <Text style={styles.heroBrand}>{item.brand}</Text>
          <View style={styles.validityRow}>
            <Calendar size={13} color={Colors.textMuted} strokeWidth={2} />
            <Text style={styles.validity}>
              Valable chez {item.bestStore} jusqu'au {item.odr?.expiresAt
                ? new Date(item.odr.expiresAt).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long' })
                : '30 avril'}
            </Text>
          </View>
        </View>

        {/* Price Calculator */}
        <PriceCalculator item={item} />

        {/* Prix par enseigne */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Prix dans les enseignes</Text>
          {item.stores.map(store => (
            <View key={store.name} style={[
              styles.storeRow,
              store.name === item.bestStore && styles.storeRowBest,
            ]}>
              <View style={styles.storeLeft}>
                <View style={[styles.storeDot, { backgroundColor: storeColors[store.name] || Colors.textMuted }]} />
                <Text style={styles.storeName}>{store.name}</Text>
                {store.name === item.bestStore && (
                  <View style={styles.bestBadge}>
                    <Text style={styles.bestBadgeText}>MEILLEUR PRIX</Text>
                  </View>
                )}
              </View>
              <View style={styles.storePrices}>
                {store.promoLabel && (
                  <Text style={styles.storePromoLabel}>{store.promoLabel}</Text>
                )}
                {store.promoPrice ? (
                  <View style={styles.storePriceRow}>
                    <Text style={styles.storeBasePrice}>{store.basePrice.toFixed(2)}€</Text>
                    <Text style={styles.storePromoPrice}>{store.promoPrice.toFixed(2)}€</Text>
                  </View>
                ) : (
                  <Text style={styles.storePriceOnly}>{store.basePrice.toFixed(2)}€</Text>
                )}
              </View>
            </View>
          ))}
        </View>

        {/* Comment obtenir */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Comment l'obtenir ?</Text>
          {(
            [
              { Icon: Bookmark, text: `Ajoute "${item.name}" à ta liste SmartHunt` },
              { Icon: Share2, text: `Achète le produit chez ${item.bestStore}` },
              { Icon: Calendar, text: 'Scanne ton ticket ici pour valider ton gain SmartHunt' },
              { Icon: Zap, text: `Récupère tes ${item.odr?.cashback.toFixed(2) ?? '?'}€ sur l'application partenaire` },
            ]
          ).map(({ Icon, text }, i) => (
            <View key={i} style={styles.stepRow}>
              <View style={styles.stepNumber}>
                <Text style={styles.stepNumberText}>{i + 1}</Text>
              </View>
              <Icon size={18} color={Colors.electricBlue} strokeWidth={2} />
              <Text style={styles.stepText}>{text}</Text>
            </View>
          ))}
        </View>

      </ScrollView>

      {/* CTA Buttons */}
      <View style={styles.ctaBar}>
        <TouchableOpacity
          style={[styles.ctaSecondary, inHunt && styles.ctaSecondaryDone]}
          onPress={() => {
            addToHunt(item);
            showAlert('Ajouté !', `"${item.name}" est dans ta liste de chasse.`);
          }}
        >
          <Bookmark
            size={20}
            color={inHunt ? Colors.background : Colors.electricBlue}
            strokeWidth={2}
          />
          <Text style={[styles.ctaSecondaryText, inHunt && styles.ctaSecondaryTextDone]}>
            {inHunt ? 'Dans ma liste' : 'Ajouter à ma liste'}
          </Text>
        </TouchableOpacity>

        {item.odr && (
          <TouchableOpacity style={styles.ctaPrimary} onPress={handleActivateShopmium}>
            <Zap size={20} color={Colors.background} strokeWidth={2} />
            <Text style={styles.ctaPrimaryText}>
              Activer le remboursement {'\n'}
              <Text style={styles.ctaPrimarySubtext}>(via {item.odr.source})</Text>
            </Text>
          </TouchableOpacity>
        )}
      </View>

      <ShopmiumWelcomeKit
        visible={showWelcomeKit}
        productName={item.name}
        cashbackAmount={item.odr?.cashback || 0}
        onClose={() => setShowWelcomeKit(false)}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  scroll: { padding: Spacing.lg, paddingBottom: 160 },

  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: Spacing.lg },
  backBtn: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: Colors.card, alignItems: 'center', justifyContent: 'center',
  },
  shareBtn: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: Colors.card, alignItems: 'center', justifyContent: 'center',
  },

  heroCard: {
    backgroundColor: Colors.card,
    borderRadius: Radius.xl,
    padding: Spacing.xl,
    alignItems: 'center',
    marginBottom: Spacing.lg,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
  },
  heroEmoji: { fontSize: 72, marginBottom: Spacing.md },
  heroBadges: { flexDirection: 'row', gap: Spacing.sm, marginBottom: Spacing.md },
  heroTitle: { ...Typography.h2, color: Colors.white, textAlign: 'center', marginBottom: 4 },
  heroBrand: { ...Typography.body, color: Colors.textSecondary, marginBottom: Spacing.sm },
  validityRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  validity: { ...Typography.small, color: Colors.textMuted },

  section: { marginBottom: Spacing.xl },
  sectionTitle: { ...Typography.h3, color: Colors.white, marginBottom: Spacing.md },

  storeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: Colors.card,
    borderRadius: Radius.md,
    padding: Spacing.md,
    marginBottom: Spacing.sm,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
  },
  storeRowBest: { borderColor: Colors.neonGreen + '55' },
  storeLeft: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, flex: 1 },
  storeDot: { width: 10, height: 10, borderRadius: 5 },
  storeName: { ...Typography.bodyBold, color: Colors.white },
  bestBadge: {
    backgroundColor: Colors.neonGreen + '22',
    borderRadius: Radius.full,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  bestBadgeText: { ...Typography.tiny, color: Colors.neonGreen, fontWeight: '700' },
  storePrices: { alignItems: 'flex-end' },
  storePromoLabel: { ...Typography.tiny, color: Colors.orange, marginBottom: 2 },
  storePriceRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  storeBasePrice: { ...Typography.small, color: Colors.textMuted, textDecorationLine: 'line-through' },
  storePromoPrice: { ...Typography.bodyBold, color: Colors.electricBlue },
  storePriceOnly: { ...Typography.bodyBold, color: Colors.textSecondary },

  stepRow: { flexDirection: 'row', alignItems: 'flex-start', gap: Spacing.md, marginBottom: Spacing.md },
  stepNumber: {
    width: 24, height: 24, borderRadius: 12,
    backgroundColor: Colors.electricBlue + '22',
    alignItems: 'center', justifyContent: 'center',
    flexShrink: 0, marginTop: 1,
  },
  stepNumberText: { ...Typography.smallBold, color: Colors.electricBlue },
  stepText: { ...Typography.body, color: Colors.textSecondary, flex: 1, lineHeight: 22 },

  ctaBar: {
    position: 'absolute',
    bottom: 0, left: 0, right: 0,
    backgroundColor: Colors.surface,
    borderTopWidth: 1,
    borderTopColor: Colors.cardBorder,
    padding: Spacing.lg,
    paddingBottom: 32,
    gap: Spacing.md,
  },
  ctaSecondary: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
    borderWidth: 1.5,
    borderColor: Colors.electricBlue,
    borderRadius: Radius.lg,
    padding: Spacing.md,
  },
  ctaSecondaryDone: { backgroundColor: Colors.electricBlue, borderColor: Colors.electricBlue },
  ctaSecondaryText: { ...Typography.bodyBold, color: Colors.electricBlue },
  ctaSecondaryTextDone: { color: Colors.white },
  ctaPrimary: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
    backgroundColor: Colors.neonGreen,
    borderRadius: Radius.lg,
    padding: Spacing.md,
  },
  ctaPrimaryText: { ...Typography.bodyBold, color: Colors.background, textAlign: 'center' },
  ctaPrimarySubtext: { fontWeight: '400', fontSize: 12 },
});
