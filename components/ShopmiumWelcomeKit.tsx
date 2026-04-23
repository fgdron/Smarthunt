import React from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet,
  Modal, Linking, Platform, Clipboard,
} from 'react-native';
import { Copy, Gift } from 'lucide-react-native';
import { Colors, Spacing, Radius, Typography } from '@/constants/theme';
import { useSmartHuntStore } from '@/store/useSmartHuntStore';
import { showAlert } from '@/utils/alert';

const REFERRAL_CODE = 'SMARTHUNT';
const SHOPMIUM_STORE_URL = Platform.OS === 'ios'
  ? 'https://apps.apple.com/fr/app/shopmium/id506023626'
  : 'https://play.google.com/store/apps/details?id=com.shopmium';

interface Props {
  visible: boolean;
  productName: string;
  cashbackAmount: number;
  onClose: () => void;
}

export default function ShopmiumWelcomeKit({ visible, productName, cashbackAmount, onClose }: Props) {
  const { setHasShopmium } = useSmartHuntStore();

  const handleDownload = async () => {
    if (Platform.OS === 'web') {
      await navigator.clipboard.writeText(REFERRAL_CODE).catch(() => {});
      showAlert(
        'Copié !',
        `Le code "${REFERRAL_CODE}" est copié. Vous allez être redirigé vers Shopmium.`,
        [{ text: 'OK', onPress: () => Linking.openURL(SHOPMIUM_STORE_URL) }]
      );
    } else {
      Clipboard.setString(REFERRAL_CODE);
      showAlert(
        'Copié !',
        `Le code "${REFERRAL_CODE}" est copié dans votre presse-papier. Collez-le lors de l'inscription Shopmium.`,
        [{ text: 'OK', onPress: () => Linking.openURL(SHOPMIUM_STORE_URL) }]
      );
    }
    setHasShopmium(false);
    onClose();
  };

  const handleAlreadyHave = () => {
    setHasShopmium(true);
    onClose();
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={styles.sheet}>
          <View style={styles.handle} />

          <View style={styles.freeProductBadge}>
            <Text style={styles.freeProductEmoji}>🎁</Text>
            <Text style={styles.freeProductText}>1 produit 100% remboursé offert</Text>
          </View>

          <Text style={styles.title}>Double tes gains avec Shopmium !</Text>

          <Text style={styles.body}>
            Pour récupérer tes{' '}
            <Text style={styles.highlight}>{cashbackAmount.toFixed(2)}€</Text>
            {' '}sur <Text style={styles.productName}>{productName}</Text>, tu as besoin de l'application Shopmium — notre partenaire de confiance.
          </Text>

          <View style={styles.offerBox}>
            <View style={styles.offerHeader}>
              <Gift size={18} color={Colors.neonGreen} strokeWidth={2} />
              <Text style={styles.offerTitle}>Offre de bienvenue exclusive</Text>
            </View>
            <Text style={styles.offerText}>
              Inscris-toi avec notre code parrainage et reçois un produit{' '}
              <Text style={styles.highlight}>100% remboursé</Text> dès ton premier achat !
            </Text>
            <View style={styles.codeBox}>
              <Text style={styles.codeLabel}>Code parrainage</Text>
              <Text style={styles.code}>{REFERRAL_CODE}</Text>
            </View>
          </View>

          <TouchableOpacity style={styles.primaryBtn} onPress={handleDownload}>
            <Copy size={18} color={Colors.background} strokeWidth={2} />
            <Text style={styles.primaryBtnText}>Copier le code et télécharger Shopmium</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.secondaryBtn} onPress={handleAlreadyHave}>
            <Text style={styles.secondaryBtnText}>J'ai déjà Shopmium, ne plus afficher</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.75)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: Colors.surface,
    borderTopLeftRadius: Radius.xl,
    borderTopRightRadius: Radius.xl,
    padding: Spacing.xl,
    paddingBottom: 40,
    borderTopWidth: 1,
    borderColor: Colors.neonGreen + '44',
  },
  handle: {
    width: 40,
    height: 4,
    backgroundColor: Colors.textMuted,
    borderRadius: 2,
    alignSelf: 'center',
    marginBottom: Spacing.xl,
  },
  freeProductBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    backgroundColor: Colors.neonGreen + '20',
    borderRadius: Radius.full,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.sm,
    alignSelf: 'flex-start',
    marginBottom: Spacing.lg,
  },
  freeProductEmoji: { fontSize: 18 },
  freeProductText: { ...Typography.smallBold, color: Colors.neonGreen },

  title: { ...Typography.h2, color: Colors.white, marginBottom: Spacing.md },
  body: { ...Typography.body, color: Colors.textSecondary, lineHeight: 22, marginBottom: Spacing.lg },
  highlight: { color: Colors.neonGreen, fontWeight: '700' },
  productName: { color: Colors.white, fontWeight: '600' },

  offerBox: {
    backgroundColor: Colors.card,
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: Colors.neonGreen + '33',
    padding: Spacing.lg,
    marginBottom: Spacing.xl,
  },
  offerHeader: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, marginBottom: Spacing.sm },
  offerTitle: { ...Typography.bodyBold, color: Colors.neonGreen },
  offerText: { ...Typography.body, color: Colors.textSecondary, lineHeight: 22, marginBottom: Spacing.lg },
  codeBox: {
    backgroundColor: Colors.background,
    borderRadius: Radius.md,
    padding: Spacing.md,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Colors.neonGreen + '55',
    borderStyle: 'dashed',
  },
  codeLabel: { ...Typography.tiny, color: Colors.textMuted, marginBottom: 4 },
  code: { fontSize: 28, fontWeight: '900', color: Colors.neonGreen, letterSpacing: 4 },

  primaryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
    backgroundColor: Colors.neonGreen,
    borderRadius: Radius.lg,
    padding: Spacing.lg,
    marginBottom: Spacing.md,
  },
  primaryBtnText: { ...Typography.bodyBold, color: Colors.background, fontSize: 15 },
  secondaryBtn: { alignItems: 'center', padding: Spacing.md },
  secondaryBtnText: { ...Typography.body, color: Colors.textMuted, textDecorationLine: 'underline' },
});
