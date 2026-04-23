import React from 'react';
import {
  Modal, View, Text, TouchableOpacity, StyleSheet,
  ScrollView, Platform,
} from 'react-native';
import { Tag, Calculator, RefreshCw, ShieldCheck, AlertCircle, CheckCircle, Check, LucideIcon } from 'lucide-react-native';
import { Colors, Spacing, Radius, Typography } from '@/constants/theme';

interface Props {
  visible: boolean;
  onClose: () => void;
}

const SECTIONS: Array<{ Icon: LucideIcon; color: string; title: string; body: string }> = [
  {
    Icon: Tag,
    color: Colors.neonGreen,
    title: 'Prix barrés honnêtes',
    body: 'Les prix de référence affichés correspondent aux prix normaux relevés sur les drives officiels des enseignes (Leclerc, Carrefour, Intermarché). Ils ne sont jamais majorés artificiellement pour gonfler l\'économie affichée.',
  },
  {
    Icon: Calculator,
    color: Colors.electricBlue,
    title: 'Calcul Net-Net transparent',
    body: 'L\'économie totale intègre les promotions en caisse ET les remboursements différés (ODR / cashback). Chaque composante est détaillée séparément dans la vue Stratégie pour que vous puissiez vérifier le calcul.',
  },
  {
    Icon: RefreshCw,
    color: '#A855F7',
    title: 'Fraîcheur des données',
    body: 'Les prix et promotions sont mis à jour manuellement à chaque campagne promotionnelle (hebdomadaire). La date de dernière mise à jour est visible en bas de chaque liste produits.',
  },
  {
    Icon: ShieldCheck,
    color: Colors.gold,
    title: 'Indépendance totale',
    body: 'SmartHunt ne perçoit aucune rémunération des marques ou enseignes pour mettre en avant leurs produits. Les recommandations sont uniquement guidées par le meilleur rapport qualité/prix pour vous.',
  },
  {
    Icon: AlertCircle,
    color: Colors.orange,
    title: 'Limites & conditions',
    body: 'Les offres de remboursement (ODR) sont soumises aux conditions des applications partenaires (Shopmium, Quoty…). SmartHunt ne peut pas garantir leur disponibilité au moment de votre achat. Vérifiez toujours l\'offre dans l\'application concernée avant de faire vos courses.',
  },
];

export default function TransparencyModal({ visible, onClose }: Props) {
  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <View style={styles.sheet}>

          {/* Handle bar */}
          <View style={styles.handle} />

          {/* Header */}
          <View style={styles.header}>
            <View style={styles.headerIcon}>
              <ShieldCheck size={22} color={Colors.neonGreen} strokeWidth={2} />
            </View>
            <View style={styles.headerTexts}>
              <Text style={styles.headerTitle}>Charte de Transparence</Text>
              <Text style={styles.headerSub}>Notre engagement envers vous</Text>
            </View>
          </View>

          <View style={styles.divider} />

          {/* Content */}
          <ScrollView
            contentContainerStyle={styles.content}
            showsVerticalScrollIndicator={false}
          >
            <Text style={styles.intro}>
              SmartHunt s'engage à vous fournir des informations fiables et vérifiables.
              Voici comment nous calculons et présentons les économies.
            </Text>

            {SECTIONS.map((sec, i) => (
              <View key={i} style={styles.section}>
                <View style={[styles.sectionIconBox, { backgroundColor: sec.color + '18' }]}>
                  <sec.Icon size={18} color={sec.color} strokeWidth={2} />
                </View>
                <View style={styles.sectionBody}>
                  <Text style={styles.sectionTitle}>{sec.title}</Text>
                  <Text style={styles.sectionText}>{sec.body}</Text>
                </View>
              </View>
            ))}

            <View style={styles.certRow}>
              <CheckCircle size={14} color={Colors.neonGreen} strokeWidth={2} />
              <Text style={styles.certText}>
                Certifié SmartHunt — Version 1.1 · Avril 2026
              </Text>
            </View>
          </ScrollView>

          {/* CTA */}
          <View style={styles.footer}>
            <TouchableOpacity style={styles.cta} onPress={onClose} activeOpacity={0.85}>
              <Check size={18} color={Colors.background} strokeWidth={2} />
              <Text style={styles.ctaText}>J'ai compris</Text>
            </TouchableOpacity>
          </View>

        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: Colors.surface,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: '88%',
    paddingBottom: Platform.OS === 'ios' ? 34 : 16,
  },
  handle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: Colors.cardBorder,
    alignSelf: 'center',
    marginTop: 10,
    marginBottom: 4,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    paddingHorizontal: Spacing.xl,
    paddingTop: Spacing.lg,
    paddingBottom: Spacing.md,
  },
  headerIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: Colors.neonGreen + '18',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTexts: { flex: 1 },
  headerTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: Colors.white,
    letterSpacing: -0.3,
  },
  headerSub: {
    ...Typography.small,
    color: Colors.textSecondary,
    marginTop: 2,
  },
  divider: {
    height: 1,
    backgroundColor: Colors.cardBorder,
    marginHorizontal: Spacing.xl,
  },
  content: {
    paddingHorizontal: Spacing.xl,
    paddingTop: Spacing.lg,
    paddingBottom: Spacing.md,
  },
  intro: {
    ...Typography.body,
    color: Colors.textSecondary,
    lineHeight: 22,
    marginBottom: Spacing.xl,
  },
  section: {
    flexDirection: 'row',
    gap: Spacing.md,
    marginBottom: Spacing.lg,
  },
  sectionIconBox: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
    marginTop: 2,
  },
  sectionBody: { flex: 1 },
  sectionTitle: {
    ...Typography.bodyBold,
    color: Colors.white,
    marginBottom: 4,
  },
  sectionText: {
    ...Typography.small,
    color: Colors.textSecondary,
    lineHeight: 20,
  },
  certRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: Spacing.md,
    paddingTop: Spacing.md,
    borderTopWidth: 1,
    borderTopColor: Colors.cardBorder,
  },
  certText: {
    ...Typography.tiny,
    color: Colors.textMuted,
    fontWeight: '600',
  },
  footer: {
    paddingHorizontal: Spacing.xl,
    paddingTop: Spacing.md,
    borderTopWidth: 1,
    borderTopColor: Colors.cardBorder,
  },
  cta: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
    backgroundColor: Colors.neonGreen,
    borderRadius: Radius.lg,
    paddingVertical: 14,
  },
  ctaText: {
    ...Typography.bodyBold,
    color: Colors.background,
    fontSize: 16,
  },
});
