/**
 * Écran de signalement de promo communautaire.
 *
 * Reçoit en paramètres de navigation :
 *   - ean         : code-barre scanné (obligatoire)
 *   - productName : nom du produit résolu (optionnel, affichage)
 *   - storeId     : enseigne pré-sélectionnée (optionnel)
 *
 * Usage (depuis scan.tsx) :
 *   router.push({ pathname: '/report-promo', params: { ean, productName } });
 */

import React, { useState } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView,
  TextInput, ActivityIndicator, KeyboardAvoidingView, Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import {
  ArrowLeft, Tag, Package, CheckCircle, ChevronDown,
} from 'lucide-react-native';
import { Colors, Spacing, Radius, Typography } from '@/constants/theme';
import { ALL_STORE_IDS, STORES_CONFIG } from '@/data/productsDB';
import {
  reportPromo, invalidatePromosCache,
  type PromoType, type StockLevel,
} from '@/services/communityApi';

// ─── Types locaux ─────────────────────────────────────────────────────────────

type Step = 'form' | 'sending' | 'success' | 'error';

interface FormState {
  storeId:     string;
  promoType:   PromoType;
  promoValue:  string;
  promoLabel:  string;
  stockLevel:  StockLevel;
  unitsApprox: string;
  validUntil:  string;
}

// ─── Constantes ───────────────────────────────────────────────────────────────

const PROMO_TYPES: { value: PromoType; label: string; example: string }[] = [
  { value: 'percent',   label: '% de réduction',  example: 'ex : 30 pour -30%' },
  { value: 'immediate', label: 'Remise immédiate', example: 'ex : 1.50 pour -1.50€' },
  { value: 'volume',    label: 'Offre volume',     example: 'ex : 3 pour "3 achetés"' },
  { value: 'bundle',    label: 'Lot / bundle',     example: 'ex : 2 pour "lot de 2"' },
];

const STOCK_LEVELS: { value: StockLevel; label: string; emoji: string; color: string }[] = [
  { value: 'low',    label: 'Peu (< 5)',   emoji: '🔴', color: Colors.danger },
  { value: 'medium', label: 'Moyen',       emoji: '🟡', color: Colors.gold },
  { value: 'high',   label: 'Beaucoup',    emoji: '🟢', color: Colors.neonGreen },
];

// ─── Composant ────────────────────────────────────────────────────────────────

export default function ReportPromoScreen() {
  const router = useRouter();
  const { ean = '', productName = '', storeId: initStoreId = '' } =
    useLocalSearchParams<{ ean: string; productName: string; storeId: string }>();

  const [step, setStep]       = useState<Step>('form');
  const [errorMsg, setErrorMsg] = useState('');
  const [form, setForm]       = useState<FormState>({
    storeId:     initStoreId || ALL_STORE_IDS[0],
    promoType:   'percent',
    promoValue:  '',
    promoLabel:  '',
    stockLevel:  'medium',
    unitsApprox: '',
    validUntil:  '',
  });

  const set = (key: keyof FormState) => (val: string) =>
    setForm(f => ({ ...f, [key]: val }));

  // ── Validation ─────────────────────────────────────────────────────────────

  const isValid =
    form.storeId.length > 0 &&
    form.promoValue.length > 0 &&
    !isNaN(Number(form.promoValue)) &&
    Number(form.promoValue) > 0 &&
    form.promoLabel.trim().length > 0;

  // ── Envoi ──────────────────────────────────────────────────────────────────

  const handleSubmit = async () => {
    if (!isValid) return;
    setStep('sending');
    try {
      await reportPromo({
        ean,
        storeId:     form.storeId,
        promoType:   form.promoType,
        promoValue:  Number(form.promoValue),
        promoLabel:  form.promoLabel.trim(),
        stockLevel:  form.stockLevel,
        unitsApprox: form.unitsApprox ? Number(form.unitsApprox) : undefined,
        validUntil:  form.validUntil || undefined,
      });
      await invalidatePromosCache();
      setStep('success');
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Erreur inconnue');
      setStep('error');
    }
  };

  // ── Rendu selon step ───────────────────────────────────────────────────────

  if (step === 'sending') {
    return (
      <SafeAreaView style={s.container}>
        <View style={s.center}>
          <ActivityIndicator size="large" color={Colors.neonGreen} />
          <Text style={s.sendingText}>Envoi en cours...</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (step === 'success') {
    return (
      <SafeAreaView style={s.container}>
        <View style={s.center}>
          <View style={s.successIcon}>
            <CheckCircle size={56} color={Colors.neonGreen} strokeWidth={2} />
          </View>
          <Text style={s.successTitle}>Merci ! 🎉</Text>
          <Text style={s.successSub}>
            Ta promo est en attente de validation par la communauté.
            Elle sera visible dès 3 confirmations.
          </Text>
          <TouchableOpacity style={s.successBtn} onPress={() => router.back()}>
            <Text style={s.successBtnText}>Retour au scan</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  if (step === 'error') {
    return (
      <SafeAreaView style={s.container}>
        <View style={s.center}>
          <Text style={s.errorTitle}>Échec de l'envoi</Text>
          <Text style={s.errorSub}>{errorMsg}</Text>
          <TouchableOpacity style={s.retryBtn} onPress={() => setStep('form')}>
            <Text style={s.retryBtnText}>Réessayer</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  // ── Formulaire principal ───────────────────────────────────────────────────

  const currentPromoType = PROMO_TYPES.find(t => t.value === form.promoType)!;

  return (
    <SafeAreaView style={s.container} edges={['top']}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        {/* Header */}
        <View style={s.header}>
          <TouchableOpacity style={s.backBtn} onPress={() => router.back()}>
            <ArrowLeft size={22} color={Colors.white} strokeWidth={2} />
          </TouchableOpacity>
          <Text style={s.headerTitle}>Signaler une promo</Text>
          <View style={{ width: 40 }} />
        </View>

        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={s.scroll}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* Produit scanné */}
          <View style={s.productCard}>
            <View style={s.productIconWrap}>
              <Package size={22} color={Colors.electricBlue} strokeWidth={2} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={s.productLabel}>Produit scanné</Text>
              <Text style={s.productName} numberOfLines={1}>
                {productName || 'Produit inconnu'}
              </Text>
              <Text style={s.productEan}>EAN {ean}</Text>
            </View>
          </View>

          {/* ── Section 1 : Enseigne ─────────────────────────────────── */}
          <Text style={s.sectionTitle}>Dans quel magasin ?</Text>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={s.storeRow}
          >
            {ALL_STORE_IDS.map(id => {
              const info     = STORES_CONFIG[id];
              const selected = form.storeId === id;
              return (
                <TouchableOpacity
                  key={id}
                  style={[s.storeChip, selected && { borderColor: info.color, backgroundColor: info.color + '22' }]}
                  onPress={() => set('storeId')(id)}
                >
                  <Text style={s.storeEmoji}>{info.emoji}</Text>
                  <Text style={[s.storeLabel, selected && { color: Colors.white }]}>
                    {info.shortLabel}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>

          {/* ── Section 2 : Type de promo ────────────────────────────── */}
          <Text style={s.sectionTitle}>Type de promotion</Text>
          <View style={s.promoTypeGrid}>
            {PROMO_TYPES.map(t => {
              const selected = form.promoType === t.value;
              return (
                <TouchableOpacity
                  key={t.value}
                  style={[s.promoTypeBtn, selected && s.promoTypeBtnSelected]}
                  onPress={() => set('promoType')(t.value)}
                >
                  <Tag
                    size={14}
                    color={selected ? Colors.background : Colors.textSecondary}
                    strokeWidth={2}
                  />
                  <Text style={[s.promoTypeBtnText, selected && s.promoTypeBtnTextSelected]}>
                    {t.label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>

          {/* ── Section 3 : Valeur ───────────────────────────────────── */}
          <Text style={s.sectionTitle}>
            Valeur · <Text style={s.sectionHint}>{currentPromoType.example}</Text>
          </Text>
          <TextInput
            style={s.input}
            placeholder="ex : 30"
            placeholderTextColor={Colors.textMuted}
            keyboardType="decimal-pad"
            value={form.promoValue}
            onChangeText={set('promoValue')}
          />

          {/* ── Section 4 : Label affiché ────────────────────────────── */}
          <Text style={s.sectionTitle}>
            Label vu sur l'étiquette · <Text style={s.sectionHint}>tel quel</Text>
          </Text>
          <TextInput
            style={s.input}
            placeholder='ex : "30% de réduction immédiate"'
            placeholderTextColor={Colors.textMuted}
            value={form.promoLabel}
            onChangeText={set('promoLabel')}
            maxLength={200}
          />

          {/* ── Section 5 : Stock ────────────────────────────────────── */}
          <Text style={s.sectionTitle}>Stock estimé</Text>
          <View style={s.stockRow}>
            {STOCK_LEVELS.map(lvl => {
              const selected = form.stockLevel === lvl.value;
              return (
                <TouchableOpacity
                  key={lvl.value}
                  style={[s.stockBtn, selected && { borderColor: lvl.color, backgroundColor: lvl.color + '22' }]}
                  onPress={() => set('stockLevel')(lvl.value)}
                >
                  <Text style={s.stockEmoji}>{lvl.emoji}</Text>
                  <Text style={[s.stockLabel, selected && { color: Colors.white }]}>
                    {lvl.label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>

          {/* ── Section 6 (optionnel) : Nb d'unités ─────────────────── */}
          <Text style={s.sectionTitle}>
            Nb d'unités <Text style={s.optional}>(optionnel)</Text>
          </Text>
          <TextInput
            style={s.input}
            placeholder="ex : 8"
            placeholderTextColor={Colors.textMuted}
            keyboardType="number-pad"
            value={form.unitsApprox}
            onChangeText={set('unitsApprox')}
          />

          {/* ── Section 7 (optionnel) : Date de fin ─────────────────── */}
          <Text style={s.sectionTitle}>
            Date de fin <Text style={s.optional}>(optionnel · format AAAA-MM-JJ)</Text>
          </Text>
          <TextInput
            style={s.input}
            placeholder="ex : 2026-05-15"
            placeholderTextColor={Colors.textMuted}
            value={form.validUntil}
            onChangeText={set('validUntil')}
            maxLength={10}
          />

          {/* ── Bouton envoi ──────────────────────────────────────────── */}
          <TouchableOpacity
            style={[s.submitBtn, !isValid && s.submitBtnDisabled]}
            onPress={handleSubmit}
            disabled={!isValid}
            activeOpacity={0.85}
          >
            <CheckCircle size={18} color={Colors.background} strokeWidth={2.5} />
            <Text style={s.submitBtnText}>Envoyer le signalement</Text>
          </TouchableOpacity>

          <Text style={s.disclaimer}>
            La promo sera visible après 3 confirmations de la communauté.
            Elle expire automatiquement dans 48h.
          </Text>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  scroll:    { padding: Spacing.lg, paddingBottom: 40 },
  center:    { flex: 1, alignItems: 'center', justifyContent: 'center', padding: Spacing.xl },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: Colors.cardBorder,
  },
  backBtn:     { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { ...Typography.h3, color: Colors.white },

  // Produit
  productCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    backgroundColor: Colors.card,
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: Colors.electricBlue + '44',
    padding: Spacing.md,
    marginBottom: Spacing.xl,
  },
  productIconWrap: {
    width: 44, height: 44, borderRadius: 22,
    backgroundColor: Colors.electricBlue + '22',
    alignItems: 'center', justifyContent: 'center',
  },
  productLabel: { ...Typography.tiny, color: Colors.textMuted, marginBottom: 2 },
  productName:  { ...Typography.bodyBold, color: Colors.white },
  productEan:   { ...Typography.small, color: Colors.textMuted, marginTop: 2 },

  // Sections
  sectionTitle: { ...Typography.bodyBold, color: Colors.white, marginBottom: Spacing.sm },
  sectionHint:  { ...Typography.small, color: Colors.textMuted, fontWeight: '400' },
  optional:     { ...Typography.small, color: Colors.textMuted, fontWeight: '400' },

  // Enseigne
  storeRow:  { gap: Spacing.sm, paddingBottom: Spacing.lg },
  storeChip: {
    flexDirection: 'row', alignItems: 'center', gap: Spacing.xs,
    borderWidth: 1, borderColor: Colors.cardBorder,
    borderRadius: Radius.full, paddingHorizontal: Spacing.md, paddingVertical: 8,
    backgroundColor: Colors.card,
  },
  storeEmoji: { fontSize: 16 },
  storeLabel: { ...Typography.smallBold, color: Colors.textSecondary },

  // Type promo
  promoTypeGrid: {
    flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm, marginBottom: Spacing.xl,
  },
  promoTypeBtn: {
    flexDirection: 'row', alignItems: 'center', gap: Spacing.xs,
    borderWidth: 1, borderColor: Colors.cardBorder,
    borderRadius: Radius.md, paddingHorizontal: Spacing.md, paddingVertical: 10,
    backgroundColor: Colors.card,
  },
  promoTypeBtnSelected: {
    backgroundColor: Colors.neonGreen, borderColor: Colors.neonGreen,
  },
  promoTypeBtnText:         { ...Typography.smallBold, color: Colors.textSecondary },
  promoTypeBtnTextSelected: { color: Colors.background },

  // Input
  input: {
    backgroundColor: Colors.card,
    borderWidth: 1, borderColor: Colors.cardBorder,
    borderRadius: Radius.md,
    paddingHorizontal: Spacing.md, paddingVertical: 14,
    color: Colors.white,
    fontSize: 15,
    marginBottom: Spacing.xl,
  },

  // Stock
  stockRow: {
    flexDirection: 'row', gap: Spacing.sm, marginBottom: Spacing.xl,
  },
  stockBtn: {
    flex: 1, alignItems: 'center', gap: 4,
    borderWidth: 1, borderColor: Colors.cardBorder,
    borderRadius: Radius.md, paddingVertical: Spacing.md,
    backgroundColor: Colors.card,
  },
  stockEmoji: { fontSize: 20 },
  stockLabel: { ...Typography.smallBold, color: Colors.textSecondary },

  // Submit
  submitBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: Spacing.sm, backgroundColor: Colors.neonGreen,
    borderRadius: Radius.lg, paddingVertical: Spacing.lg,
    marginTop: Spacing.md, marginBottom: Spacing.md,
  },
  submitBtnDisabled: { opacity: 0.4 },
  submitBtnText:     { ...Typography.bodyBold, color: Colors.background, fontSize: 16 },
  disclaimer: {
    ...Typography.small, color: Colors.textMuted, textAlign: 'center', lineHeight: 18,
  },

  // Success
  successIcon:    { marginBottom: Spacing.xl },
  successTitle:   { ...Typography.h2, color: Colors.white, marginBottom: Spacing.md },
  successSub:     { ...Typography.body, color: Colors.textSecondary, textAlign: 'center', lineHeight: 22, marginBottom: Spacing.xl },
  successBtn:     { backgroundColor: Colors.neonGreen, borderRadius: Radius.lg, paddingVertical: Spacing.md, paddingHorizontal: Spacing.xxl },
  successBtnText: { ...Typography.bodyBold, color: Colors.background },

  // Error
  errorTitle:   { ...Typography.h3, color: Colors.danger, marginBottom: Spacing.md },
  errorSub:     { ...Typography.body, color: Colors.textSecondary, textAlign: 'center', marginBottom: Spacing.xl },
  retryBtn:     { borderWidth: 1, borderColor: Colors.cardBorder, borderRadius: Radius.lg, paddingVertical: Spacing.md, paddingHorizontal: Spacing.xxl },
  retryBtnText: { ...Typography.bodyBold, color: Colors.white },

  // Sending
  sendingText: { ...Typography.body, color: Colors.textSecondary, marginTop: Spacing.lg },
});
