import React, { useEffect, useState } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Wallet, ShoppingCart, Bookmark, ArrowRight, PlayCircle, ScanLine } from 'lucide-react-native';
import { useRouter } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Colors, Radius, Spacing, Typography } from '@/constants/theme';
import { useSmartHuntStore } from '@/store/useSmartHuntStore';
import { ONBOARDED_KEY } from '@/app/onboarding';

export default function DashboardScreen() {
  const router = useRouter();
  const { availableCashback, savedListType, loadListType, userName } = useSmartHuntStore();
  const [ready, setReady] = useState(false);

  // ── First-launch guard ──────────────────────────────────────
  useEffect(() => {
    AsyncStorage.getItem(ONBOARDED_KEY).then(val => {
      if (!val) {
        router.replace('/onboarding');
      } else {
        setReady(true);
      }
    }).catch(() => setReady(true)); // En cas d'erreur, afficher l'app
  }, []);

  // Splash minimaliste pendant la vérification
  if (!ready) {
    return (
      <View style={s.splash}>
        <Text style={s.splashTitle}>SmartHunt</Text>
      </View>
    );
  }

  const handleStart = () => {
    router.push('/(tabs)/catalogue');
  };

  const handleLoadListType = () => {
    loadListType();
    router.push('/(tabs)/catalogue');
  };

  return (
    <SafeAreaView style={s.root} edges={['top']}>
      <View style={s.inner}>

        {/* Logo / titre */}
        <View style={s.logoBlock}>
          <Text style={s.logoTitle}>SmartHunt</Text>
          {userName && userName !== 'Alex' ? (
            <Text style={s.logoSub}>Bonjour {userName}</Text>
          ) : (
            <Text style={s.logoSub}>Calculateur de Prix Net</Text>
          )}
        </View>

        {/* Cagnotte */}
        <View style={s.cagnotteChip}>
          <Wallet size={18} color={Colors.neonGreen} strokeWidth={2} />
          <View>
            <Text style={s.cagnotteLabel}>Cagnotte disponible</Text>
            <Text style={s.cagnotteAmount}>{availableCashback.toFixed(2)} €</Text>
          </View>
        </View>

        {/* Bouton principal */}
        <TouchableOpacity style={s.mainCta} onPress={handleStart} activeOpacity={0.85}>
          <ShoppingCart size={26} color={Colors.background} strokeWidth={2} />
          <Text style={s.mainCtaText}>Démarrer mes courses</Text>
        </TouchableOpacity>

        <Text style={s.mainCtaSub}>
          Sélectionne tes produits · compare les stratégies · économise
        </Text>

        {/* Charger Liste Type */}
        {savedListType.length > 0 && (
          <TouchableOpacity style={s.listTypeBtn} onPress={handleLoadListType} activeOpacity={0.8}>
            <Bookmark size={16} color={Colors.electricBlue} strokeWidth={2} />
            <Text style={s.listTypeBtnText}>
              Charger ma Liste Type ({savedListType.length} produit{savedListType.length > 1 ? 's' : ''})
            </Text>
            <ArrowRight size={14} color={Colors.electricBlue} strokeWidth={2} />
          </TouchableOpacity>
        )}

        {/* Spacer */}
        <View style={{ flex: 1 }} />

        {/* Revoir l'intro */}
        <TouchableOpacity
          style={s.introBtn}
          onPress={() => router.push('/onboarding')}
          activeOpacity={0.7}
        >
          <PlayCircle size={15} color={Colors.textMuted} strokeWidth={2} />
          <Text style={s.introBtnText}>Revoir l'introduction</Text>
        </TouchableOpacity>

        {/* Footer info */}
        <View style={s.footerRow}>
          <TouchableOpacity style={s.footerBtn} onPress={() => router.push('/(tabs)/scan')}>
            <ScanLine size={20} color={Colors.textSecondary} strokeWidth={2} />
            <Text style={s.footerBtnText}>Scanner un ticket</Text>
          </TouchableOpacity>
          <View style={s.footerDivider} />
          <TouchableOpacity style={s.footerBtn} onPress={() => router.push('/(tabs)/wallet')}>
            <Wallet size={20} color={Colors.textSecondary} strokeWidth={2} />
            <Text style={s.footerBtnText}>Ma cagnotte</Text>
          </TouchableOpacity>
        </View>

      </View>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.background },
  inner: { flex: 1, paddingHorizontal: Spacing.xl, paddingTop: Spacing.xl * 2, paddingBottom: Spacing.xl, alignItems: 'center' },

  logoBlock: { alignItems: 'center', marginBottom: Spacing.xl * 2 },
  logoTitle: { fontSize: 36, fontWeight: '900', color: Colors.white, letterSpacing: -1 },
  logoSub: { fontSize: 13, color: Colors.textSecondary, marginTop: 4 },

  cagnotteChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: Colors.card,
    borderWidth: 1,
    borderColor: Colors.neonGreen + '40',
    borderRadius: Radius.lg,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    marginBottom: Spacing.xl * 2,
    alignSelf: 'stretch',
  },
  cagnotteLabel: { fontSize: 12, color: Colors.textSecondary },
  cagnotteAmount: { fontSize: 24, fontWeight: '900', color: Colors.neonGreen },

  mainCta: {
    backgroundColor: Colors.neonGreen,
    borderRadius: Radius.xl,
    paddingVertical: 20,
    paddingHorizontal: Spacing.xl,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    alignSelf: 'stretch',
    shadowColor: Colors.neonGreen,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 8,
  },
  mainCtaText: { fontSize: 20, fontWeight: '900', color: Colors.background },
  mainCtaSub: { fontSize: 12, color: Colors.textMuted, textAlign: 'center', marginTop: Spacing.md, marginBottom: Spacing.xl },

  listTypeBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderWidth: 1,
    borderColor: Colors.electricBlue + '50',
    borderRadius: Radius.lg,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    backgroundColor: Colors.electricBlue + '10',
    alignSelf: 'stretch',
  },
  listTypeBtnText: { flex: 1, color: Colors.electricBlue, fontSize: 14, fontWeight: '600' },

  footerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.card,
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
    alignSelf: 'stretch',
    overflow: 'hidden',
  },
  footerBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: Spacing.md },
  footerBtnText: { fontSize: 13, color: Colors.textSecondary, fontWeight: '600' },
  footerDivider: { width: 1, height: 24, backgroundColor: Colors.cardBorder },

  introBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: Spacing.sm,
    marginBottom: Spacing.sm,
  },
  introBtnText: { ...Typography.small, color: Colors.textMuted },

  // ── Splash first-launch ───────────────────────────────────
  splash: {
    flex: 1,
    backgroundColor: Colors.background,
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.md,
  },
  splashTitle: { fontSize: 32, fontWeight: '900', color: Colors.white, letterSpacing: -1 },
});
