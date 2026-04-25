/**
 * CommunityPromoBadge — affiche les promos signalées par la communauté
 * pour un produit donné (par EAN).
 *
 * Deux modes :
 *  - compact : une seule promo (la meilleure), inline dans ProductCard
 *  - full    : toutes les promos avec boutons de vote, pour la fiche produit
 *
 * Usage :
 *   <CommunityPromoBadge ean="3033490004743" mode="compact" />
 *   <CommunityPromoBadge ean="3033490004743" mode="full" />
 */

import React, { useEffect, useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, ActivityIndicator,
} from 'react-native';
import { ThumbsUp, ThumbsDown, Users, Tag } from 'lucide-react-native';
import { Colors, Spacing, Radius, Typography } from '@/constants/theme';
import { STORES_CONFIG } from '@/data/productsDB';
import {
  fetchPromosByEan, votePromo,
  formatPromoValue, promoAge, stockLevelEmoji,
  type CommunityPromo,
} from '@/services/communityApi';

// ─── Props ────────────────────────────────────────────────────────────────────

interface Props {
  ean:  string;
  mode?: 'compact' | 'full';
}

// ─── Composant ────────────────────────────────────────────────────────────────

export default function CommunityPromoBadge({ ean, mode = 'compact' }: Props) {
  const [promos,  setPromos]  = useState<CommunityPromo[]>([]);
  const [loading, setLoading] = useState(true);
  const [voted,   setVoted]   = useState<Record<string, 'up' | 'down'>>({});
  const [voting,  setVoting]  = useState<string | null>(null);

  // ── Fetch au montage ───────────────────────────────────────────────────────

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await fetchPromosByEan(ean);
      // Trie : confirmed en premier, puis par upvotes
      const sorted = [...data].sort((a, b) => {
        if (a.status === 'confirmed' && b.status !== 'confirmed') return -1;
        if (b.status === 'confirmed' && a.status !== 'confirmed') return  1;
        return b.upvotes - a.upvotes;
      });
      setPromos(sorted);
    } catch {
      // Erreur silencieuse — le badge ne s'affiche simplement pas
    } finally {
      setLoading(false);
    }
  }, [ean]);

  useEffect(() => { load(); }, [load]);

  // ── Vote ───────────────────────────────────────────────────────────────────

  const handleVote = async (promoId: string, vote: 'up' | 'down') => {
    if (voted[promoId] || voting === promoId) return;
    setVoting(promoId);
    try {
      const result = await votePromo(promoId, vote);
      setVoted(v => ({ ...v, [promoId]: vote }));
      // Mise à jour optimiste des compteurs
      setPromos(prev => prev.map(p =>
        p.id === promoId
          ? { ...p, upvotes: result.upvotes, downvotes: result.downvotes, status: result.status }
          : p,
      ));
    } catch (err) {
      if (err instanceof Error && err.message === 'already_voted') {
        setVoted(v => ({ ...v, [promoId]: vote }));
      }
    } finally {
      setVoting(null);
    }
  };

  // ── Pas de données ─────────────────────────────────────────────────────────

  if (loading) {
    if (mode === 'compact') return null; // pas de spinner inline
    return (
      <View style={s.loadingWrap}>
        <ActivityIndicator size="small" color={Colors.textMuted} />
      </View>
    );
  }

  const visiblePromos = promos.filter(p => p.status !== 'rejected' && p.status !== 'expired');
  if (visiblePromos.length === 0) return null;

  // ── Mode compact (1 seule promo, sans vote) ────────────────────────────────

  if (mode === 'compact') {
    const best = visiblePromos[0];
    const store = STORES_CONFIG[best.storeId as keyof typeof STORES_CONFIG];
    return (
      <View style={s.compactWrap}>
        <Tag size={12} color={Colors.gold} strokeWidth={2} />
        <Text style={s.compactText} numberOfLines={1}>
          <Text style={s.compactValue}>{formatPromoValue(best.promoType, best.promoValue)}</Text>
          {store ? ` · ${store.emoji} ${store.shortLabel}` : ''}
          {best.status === 'pending' ? ' · en attente' : ''}
        </Text>
        <View style={s.compactVotes}>
          <Users size={10} color={Colors.textMuted} strokeWidth={2} />
          <Text style={s.compactVotesText}>{best.upvotes}</Text>
        </View>
      </View>
    );
  }

  // ── Mode full (toutes les promos + vote) ───────────────────────────────────

  return (
    <View style={s.fullWrap}>
      <View style={s.fullHeader}>
        <Users size={14} color={Colors.gold} strokeWidth={2} />
        <Text style={s.fullHeaderText}>
          Promos signalées par la communauté ({visiblePromos.length})
        </Text>
      </View>

      {visiblePromos.map(promo => {
        const store       = STORES_CONFIG[promo.storeId as keyof typeof STORES_CONFIG];
        const myVote      = voted[promo.id];
        const isVoting    = voting === promo.id;
        const isConfirmed = promo.status === 'confirmed';

        return (
          <View
            key={promo.id}
            style={[s.promoRow, isConfirmed && s.promoRowConfirmed]}
          >
            {/* Infos promo */}
            <View style={s.promoInfo}>
              <View style={s.promoTopLine}>
                <Text style={s.promoValue}>
                  {formatPromoValue(promo.promoType, promo.promoValue)}
                </Text>
                {isConfirmed && (
                  <View style={s.confirmedBadge}>
                    <Text style={s.confirmedText}>✓ confirmé</Text>
                  </View>
                )}
              </View>

              <Text style={s.promoLabel} numberOfLines={1}>{promo.promoLabel}</Text>

              <View style={s.promoMeta}>
                {store && (
                  <Text style={s.promoMetaText}>
                    {store.emoji} {store.shortLabel}
                  </Text>
                )}
                <Text style={s.promoMetaText}>
                  {stockLevelEmoji(promo.stockLevel)} stock{promo.unitsApprox ? ` ≈${promo.unitsApprox}` : ''}
                </Text>
                <Text style={s.promoMetaText}>{promoAge(promo.createdAt)}</Text>
              </View>
            </View>

            {/* Boutons vote */}
            <View style={s.voteWrap}>
              {isVoting ? (
                <ActivityIndicator size="small" color={Colors.textMuted} />
              ) : (
                <>
                  <TouchableOpacity
                    style={[s.voteBtn, myVote === 'up' && s.voteBtnUpActive]}
                    onPress={() => handleVote(promo.id, 'up')}
                    disabled={!!myVote}
                  >
                    <ThumbsUp
                      size={14}
                      color={myVote === 'up' ? Colors.background : Colors.neonGreen}
                      strokeWidth={2}
                    />
                    <Text style={[s.voteBtnText, myVote === 'up' && s.voteBtnTextActive]}>
                      {promo.upvotes}
                    </Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[s.voteBtn, myVote === 'down' && s.voteBtnDownActive]}
                    onPress={() => handleVote(promo.id, 'down')}
                    disabled={!!myVote}
                  >
                    <ThumbsDown
                      size={14}
                      color={myVote === 'down' ? Colors.background : Colors.danger}
                      strokeWidth={2}
                    />
                    <Text style={[s.voteBtnText, myVote === 'down' && s.voteBtnTextActive]}>
                      {promo.downvotes}
                    </Text>
                  </TouchableOpacity>
                </>
              )}
            </View>
          </View>
        );
      })}
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  loadingWrap: { padding: Spacing.md, alignItems: 'center' },

  // Compact
  compactWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
    backgroundColor: Colors.gold + '12',
    borderRadius: Radius.sm,
    borderWidth: 1,
    borderColor: Colors.gold + '30',
    paddingHorizontal: Spacing.sm,
    paddingVertical: 5,
    marginTop: Spacing.sm,
  },
  compactText:       { ...Typography.small, color: Colors.gold, flex: 1 },
  compactValue:      { fontWeight: '700' },
  compactVotes:      { flexDirection: 'row', alignItems: 'center', gap: 3 },
  compactVotesText:  { ...Typography.tiny, color: Colors.textMuted },

  // Full
  fullWrap: {
    marginTop: Spacing.md,
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: Colors.gold + '30',
    overflow: 'hidden',
  },
  fullHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
    backgroundColor: Colors.gold + '12',
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
  },
  fullHeaderText: { ...Typography.smallBold, color: Colors.gold },

  promoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: Spacing.md,
    borderTopWidth: 1,
    borderTopColor: Colors.cardBorder,
    gap: Spacing.md,
  },
  promoRowConfirmed: { backgroundColor: Colors.neonGreen + '08' },

  promoInfo:    { flex: 1 },
  promoTopLine: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, marginBottom: 3 },
  promoValue:   { ...Typography.bodyBold, color: Colors.white },

  confirmedBadge: {
    backgroundColor: Colors.neonGreen + '22',
    borderRadius: Radius.full,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  confirmedText: { ...Typography.tiny, color: Colors.neonGreen },

  promoLabel:    { ...Typography.small, color: Colors.textSecondary, marginBottom: 4 },
  promoMeta:     { flexDirection: 'row', gap: Spacing.sm, flexWrap: 'wrap' },
  promoMetaText: { ...Typography.tiny, color: Colors.textMuted },

  // Vote
  voteWrap: { alignItems: 'center', gap: Spacing.xs },
  voteBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
    borderRadius: Radius.full,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 5,
    backgroundColor: Colors.card,
    minWidth: 44,
    justifyContent: 'center',
  },
  voteBtnUpActive:   { backgroundColor: Colors.neonGreen, borderColor: Colors.neonGreen },
  voteBtnDownActive: { backgroundColor: Colors.danger,    borderColor: Colors.danger },
  voteBtnText:       { ...Typography.tiny, color: Colors.textSecondary },
  voteBtnTextActive: { color: Colors.background },
});
