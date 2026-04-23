/**
 * OfflineBanner — indicateur de fraîcheur des données
 *
 * Visible quand dbStatus est :
 *   'stale'   → cache trop vieux (>7j), pas de réseau
 *   'offline' → aucun cache disponible, données statiques locales
 *
 * Se masque automatiquement si l'état repasse à 'fresh' ou 'cached'.
 * L'utilisateur peut aussi le fermer manuellement.
 */
import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Animated, Platform } from 'react-native';
import { WifiOff, X, RefreshCw } from 'lucide-react-native';
import { Colors, Spacing, Typography, Radius } from '@/constants/theme';
import { useSmartHuntStore } from '@/store/useSmartHuntStore';
import { formatDataAge } from '@/services/api';

export default function OfflineBanner() {
  const dbStatus      = useSmartHuntStore(s => s.dbStatus);
  const dbLastFetched = useSmartHuntStore(s => s.dbLastFetched);
  const initProductDB = useSmartHuntStore(s => s.initProductDB);

  const [dismissed, setDismissed]   = useState(false);
  const [retrying, setRetrying]     = useState(false);

  // Visible uniquement pour les états dégradés
  const shouldShow = !dismissed && (dbStatus === 'stale' || dbStatus === 'offline');
  if (!shouldShow) return null;

  const isOffline   = dbStatus === 'offline';
  const accentColor = isOffline ? Colors.danger : Colors.gold;

  const ageLabel = dbLastFetched
    ? `Mis à jour il y a ${formatDataAge(dbLastFetched)}`
    : 'Données locales (hors connexion)';

  const handleRetry = async () => {
    setRetrying(true);
    try {
      await initProductDB();
    } finally {
      setRetrying(false);
    }
  };

  return (
    <View style={[styles.banner, { borderLeftColor: accentColor }]}>
      {/* Icône + texte */}
      <View style={[styles.iconWrap, { backgroundColor: accentColor + '20' }]}>
        <WifiOff size={14} color={accentColor} strokeWidth={2} />
      </View>

      <View style={styles.textWrap}>
        <Text style={[styles.title, { color: accentColor }]}>
          {isOffline ? 'Mode hors-ligne' : 'Données anciennes'}
        </Text>
        <Text style={styles.sub}>{ageLabel}</Text>
      </View>

      {/* Retry */}
      <TouchableOpacity
        style={styles.retryBtn}
        onPress={handleRetry}
        disabled={retrying}
        activeOpacity={0.7}
      >
        <RefreshCw
          size={13}
          color={accentColor}
          strokeWidth={2}
          style={retrying ? styles.spinning : undefined}
        />
      </TouchableOpacity>

      {/* Fermer */}
      <TouchableOpacity
        style={styles.closeBtn}
        onPress={() => setDismissed(true)}
        activeOpacity={0.7}
      >
        <X size={14} color={Colors.textMuted} strokeWidth={2} />
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    backgroundColor: Colors.surface,
    borderLeftWidth: 3,
    borderBottomWidth: 1,
    borderBottomColor: Colors.cardBorder,
    paddingHorizontal: Spacing.lg,
    paddingVertical: 10,
    // Léger shadow sur iOS
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.15,
        shadowRadius: 2,
      },
    }),
  },
  iconWrap: {
    width: 26, height: 26,
    borderRadius: Radius.full,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  textWrap: { flex: 1 },
  title: {
    fontSize: 12, fontWeight: '700',
    letterSpacing: 0.2,
  },
  sub: {
    ...Typography.tiny,
    color: Colors.textMuted,
    marginTop: 1,
  },
  retryBtn: {
    padding: 6,
    borderRadius: Radius.full,
  },
  closeBtn: {
    padding: 4,
    borderRadius: Radius.full,
  },
  // Rotation CSS non disponible en RN natif sans Reanimated ;
  // on garde l'icône statique et on la réaffiche après le retry.
  spinning: {
    opacity: 0.5,
  },
});
