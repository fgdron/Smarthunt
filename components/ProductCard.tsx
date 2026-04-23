import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Image } from 'react-native';
import { ChevronRight, Bookmark, ShoppingBag, ScanLine } from 'lucide-react-native';
import { Colors, Spacing, Radius, Typography } from '@/constants/theme';
import BadgeCumulMax from './BadgeCumulMax';
import StoreTag from './StoreTag';
import { Optimization } from '@/data/mockData';
import { useSmartHuntStore } from '@/store/useSmartHuntStore';
import { PROVIDER_META, type ExternalCashbackOffer } from '@/engine/matchOffers';

// ─── Miniature produit ────────────────────────────────────────────────────────

/**
 * Affiche l'image distante si `imageUrl` est fourni,
 * avec fallback automatique sur l'emoji en cas d'erreur de chargement.
 */
function ProductThumbnail({ emoji, imageUrl }: { emoji: string; imageUrl?: string }) {
  const [imgError, setImgError] = useState(false);

  if (imageUrl && !imgError) {
    return (
      <View style={styles.thumbBox}>
        <Image
          source={{ uri: imageUrl }}
          style={styles.thumbImage}
          resizeMode="contain"
          onError={() => setImgError(true)}
        />
      </View>
    );
  }

  // Fallback : emoji produit ou icône générique
  return (
    <View style={styles.thumbBox}>
      {emoji
        ? <Text style={styles.thumbEmoji}>{emoji}</Text>
        : <ShoppingBag size={22} color={Colors.textMuted} strokeWidth={1.5} />
      }
    </View>
  );
}

// ─── Carte produit ────────────────────────────────────────────────────────────

interface Props {
  item: Optimization;
  /** URL d'image distante (Drive / CDN). Si absent ou en erreur, fallback sur emoji. */
  imageUrl?: string;
  /** Offre de remboursement externe trouvée par le Matchmaker ODR. */
  externalOffer?: ExternalCashbackOffer;
  onPress?: () => void;
}

export default function ProductCard({ item, imageUrl, externalOffer, onPress }: Props) {
  const { addToHunt, removeFromHunt, isInHunt } = useSmartHuntStore();
  const inHunt = isInHunt(item.id);

  const handleHunt = () => {
    if (inHunt) removeFromHunt(item.id);
    else addToHunt(item);
  };

  const getTagVariant = (tag: string): 'cumulmax' | 'promo' | 'urgent' | 'free' => {
    if (tag === 'CUMUL MAX')       return 'cumulmax';
    if (tag.includes('GRATUIT'))   return 'free';
    if (tag.includes('Expire'))    return 'urgent';
    return 'promo';
  };

  return (
    <TouchableOpacity style={styles.card} onPress={onPress} activeOpacity={0.85}>

      {/* ── Ligne haute ── */}
      <View style={styles.topRow}>
        <ProductThumbnail emoji={item.emoji} imageUrl={imageUrl} />

        <View style={styles.info}>
          <Text style={styles.brand}>{item.brand}</Text>
          <Text style={styles.name} numberOfLines={2}>{item.name}</Text>
          <View style={styles.tagsRow}>
            {item.tags.slice(0, 2).map(tag => (
              <BadgeCumulMax key={tag} label={tag} variant={getTagVariant(tag)} />
            ))}
          </View>
        </View>

        <View style={styles.savingsBlock}>
          <Text style={styles.savingsPercent}>-{item.savingsPercent}%</Text>
          <Text style={styles.savingsLabel}>économie</Text>
        </View>
      </View>

      <View style={styles.divider} />

      {/* ── Ligne prix ── */}
      <View style={styles.priceRow}>
        <View style={styles.priceCol}>
          <Text style={styles.priceLabel}>Prix normal</Text>
          <Text style={styles.priceBase}>{item.basePrice.toFixed(2)}€</Text>
        </View>
        <ChevronRight size={14} color={Colors.textMuted} strokeWidth={2} />
        <View style={styles.priceCol}>
          <Text style={styles.priceLabel}>Après promo</Text>
          <Text style={styles.promoPrice}>{item.promoPrice.toFixed(2)}€</Text>
        </View>
        {item.odr && (
          <>
            <ChevronRight size={14} color={Colors.textMuted} strokeWidth={2} />
            <View style={styles.priceCol}>
              <Text style={styles.priceLabel}>Prix final</Text>
              <Text style={[styles.finalPrice, item.finalPrice < 0.50 && styles.finalPriceFree]}>
                {item.finalPrice.toFixed(2)}€
              </Text>
            </View>
          </>
        )}
      </View>

      {/* ── Ligne ODR ── */}
      {item.odr && (
        <View style={styles.odrRow}>
          <View style={[styles.odrDot, { backgroundColor: item.odr.logoColor }]} />
          <Text style={styles.odrText}>
            Remboursement {item.odr.source} : -{item.odr.cashback.toFixed(2)}€
          </Text>
        </View>
      )}

      {/* ── Badge ODR externe (Matchmaker V2) ── */}
      {externalOffer && (() => {
        const meta = PROVIDER_META[externalOffer.provider];
        return (
          <View style={[styles.odrExtRow, { borderColor: meta.color + '44', backgroundColor: meta.color + '10' }]}>
            {/* Pastille provider */}
            <View style={[styles.odrProviderDot, { backgroundColor: meta.color }]} />
            <View style={{ flex: 1 }}>
              <Text style={[styles.odrExtLabel, { color: meta.color }]}>
                {meta.label} — -{externalOffer.amount.toFixed(2)} €
              </Text>
              <Text style={styles.odrExtSub}>{externalOffer.label}</Text>
            </View>
            {/* Mention scan obligatoire */}
            <View style={styles.scanBadge}>
              <ScanLine size={10} color={Colors.textMuted} strokeWidth={2} />
              <Text style={styles.scanBadgeText}>Scan ticket requis</Text>
            </View>
          </View>
        );
      })()}

      {/* ── Ligne basse ── */}
      <View style={styles.bottomRow}>
        <StoreTag name={item.bestStore} />
        <TouchableOpacity
          style={[styles.huntBtn, inHunt && styles.huntBtnActive]}
          onPress={handleHunt}
          activeOpacity={0.8}
        >
          <Bookmark
            size={14}
            color={inHunt ? Colors.background : Colors.neonGreen}
            fill={inHunt ? Colors.background : 'transparent'}
            strokeWidth={2}
          />
          <Text style={[styles.huntBtnText, inHunt && styles.huntBtnTextActive]}>
            {inHunt ? 'Dans ma liste' : 'Ajouter'}
          </Text>
        </TouchableOpacity>
      </View>

    </TouchableOpacity>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  card: {
    backgroundColor: Colors.card,
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
    padding: Spacing.lg,
    marginBottom: Spacing.md,
  },

  // Miniature
  thumbBox: {
    width: 48, height: 48,
    borderRadius: Radius.md,
    backgroundColor: Colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    flexShrink: 0,
  },
  thumbImage: { width: 48, height: 48 },
  thumbEmoji: { fontSize: 26 },

  // Ligne haute
  topRow:        { flexDirection: 'row', alignItems: 'flex-start', gap: Spacing.md },
  info:          { flex: 1 },
  brand:         { ...Typography.tiny, color: Colors.textSecondary, textTransform: 'uppercase', letterSpacing: 0.5 },
  name:          { ...Typography.bodyBold, color: Colors.white, marginTop: 1, lineHeight: 20 },
  tagsRow:       { flexDirection: 'row', flexWrap: 'wrap', gap: 4, marginTop: 6 },
  savingsBlock:  { alignItems: 'center' },
  savingsPercent:{ fontSize: 22, fontWeight: '800', color: Colors.neonGreen, lineHeight: 26 },
  savingsLabel:  { ...Typography.tiny, color: Colors.neonGreenDim },

  // Prix
  divider:    { height: 1, backgroundColor: Colors.cardBorder, marginVertical: Spacing.md },
  priceRow:   { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 4 },
  priceCol:   { alignItems: 'center', flex: 1 },
  priceLabel: { ...Typography.tiny, color: Colors.textMuted, marginBottom: 2 },
  priceBase:  { ...Typography.small, color: Colors.textSecondary, textDecorationLine: 'line-through' },
  promoPrice: { ...Typography.bodyBold, color: Colors.electricBlue },
  finalPrice: { ...Typography.bodyBold, color: Colors.neonGreen, fontSize: 17 },
  finalPriceFree: { color: Colors.gold, fontSize: 18, fontWeight: '800' },

  // ODR statique
  odrRow:  { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 8 },
  odrDot:  { width: 8, height: 8, borderRadius: 4 },
  odrText: { ...Typography.small, color: Colors.textSecondary },

  // ODR externe (Matchmaker V2)
  odrExtRow: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    borderWidth: 1, borderRadius: Radius.md,
    padding: Spacing.sm, marginTop: 10,
  },
  odrProviderDot: { width: 8, height: 8, borderRadius: 4, flexShrink: 0 },
  odrExtLabel:    { fontSize: 12, fontWeight: '700' },
  odrExtSub:      { ...Typography.tiny, color: Colors.textMuted, marginTop: 1 },
  scanBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 3,
    backgroundColor: Colors.surface,
    borderRadius: Radius.full,
    paddingHorizontal: 6, paddingVertical: 3,
    flexShrink: 0,
  },
  scanBadgeText: { fontSize: 9, fontWeight: '600', color: Colors.textMuted },

  // Bas de carte
  bottomRow: {
    flexDirection: 'row', alignItems: 'center',
    justifyContent: 'space-between', marginTop: Spacing.md,
  },
  huntBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    borderWidth: 1, borderColor: Colors.neonGreen,
    borderRadius: Radius.full, paddingHorizontal: 12, paddingVertical: 6,
  },
  huntBtnActive:     { backgroundColor: Colors.neonGreen },
  huntBtnText:       { ...Typography.smallBold, color: Colors.neonGreen },
  huntBtnTextActive: { color: Colors.background },
});
