import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Spacing, Radius, Typography } from '@/constants/theme';
import { Optimization } from '@/data/mockData';

interface Props {
  item: Optimization;
}

export default function PriceCalculator({ item }: Props) {
  const directDiscount = item.basePrice - item.promoPrice;
  const odrDiscount = item.odr?.cashback || 0;

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Ionicons name="calculator" size={16} color={Colors.neonGreen} />
        <Text style={styles.headerText}>Le Calculateur de Vérité</Text>
      </View>

      <View style={styles.row}>
        <Text style={styles.label}>Prix affiché {item.bestStore}</Text>
        <Text style={styles.priceBase}>{item.basePrice.toFixed(2)} €</Text>
      </View>

      <View style={styles.separator} />

      <View style={styles.row}>
        <View style={styles.labelRow}>
          <View style={[styles.dot, { backgroundColor: Colors.danger }]} />
          <Text style={styles.label}>Remise immédiate catalogue</Text>
        </View>
        <Text style={styles.priceDiscount}>- {directDiscount.toFixed(2)} €</Text>
      </View>

      {item.odr && (
        <View style={styles.row}>
          <View style={styles.labelRow}>
            <View style={[styles.dot, { backgroundColor: Colors.electricBlue }]} />
            <Text style={styles.label}>Offre de remboursement ({item.odr.source})</Text>
          </View>
          <Text style={styles.priceOdr}>- {odrDiscount.toFixed(2)} €</Text>
        </View>
      )}

      <View style={styles.totalRow}>
        <Text style={styles.totalLabel}>Ton prix de revient net</Text>
        <Text style={[
          styles.totalPrice,
          item.finalPrice < 1 && styles.totalPriceFree,
        ]}>
          {item.finalPrice.toFixed(2)} €
        </Text>
      </View>

      <View style={styles.savingsSummary}>
        <Ionicons name="trending-down" size={14} color={Colors.neonGreen} />
        <Text style={styles.savingsText}>
          Tu économises <Text style={styles.savingsAmount}>{item.savings.toFixed(2)} €</Text> soit{' '}
          <Text style={styles.savingsAmount}>{item.savingsPercent}%</Text> du prix normal
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: Colors.card,
    borderRadius: Radius.lg,
    borderWidth: 1.5,
    borderColor: Colors.neonGreen + '55',
    padding: Spacing.lg,
    marginBottom: Spacing.lg,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    marginBottom: Spacing.lg,
  },
  headerText: { ...Typography.bodyBold, color: Colors.neonGreen },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.md,
  },
  labelRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, flex: 1 },
  dot: { width: 8, height: 8, borderRadius: 4 },
  label: { ...Typography.body, color: Colors.textSecondary, flex: 1 },
  priceBase: { ...Typography.bodyBold, color: Colors.textSecondary, textDecorationLine: 'line-through' },
  priceDiscount: { ...Typography.bodyBold, color: Colors.danger },
  priceOdr: { ...Typography.bodyBold, color: Colors.electricBlue },
  separator: { height: 1, backgroundColor: Colors.cardBorder, marginBottom: Spacing.md },
  totalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: Colors.neonGreen + '33',
    paddingTop: Spacing.md,
    marginTop: Spacing.sm,
    marginBottom: Spacing.md,
  },
  totalLabel: { ...Typography.h3, color: Colors.white },
  totalPrice: { fontSize: 28, fontWeight: '900', color: Colors.neonGreen },
  totalPriceFree: { color: Colors.gold },
  savingsSummary: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: Colors.neonGreen + '12',
    borderRadius: Radius.sm,
    padding: Spacing.sm,
  },
  savingsText: { ...Typography.small, color: Colors.textSecondary, flex: 1 },
  savingsAmount: { color: Colors.neonGreen, fontWeight: '700' },
});
