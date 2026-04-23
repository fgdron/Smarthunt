import React, { useMemo } from 'react';
import {
  View, Text, FlatList, TouchableOpacity,
  StyleSheet,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Check, X, BarChart2, ScanLine, Crosshair } from 'lucide-react-native';
import { Colors, Spacing, Radius, Typography } from '@/constants/theme';
import { useSmartHuntStore } from '@/store/useSmartHuntStore';
import { showAlert } from '@/utils/alert';
import StoreTag from '@/components/StoreTag';
import BadgeCumulMax from '@/components/BadgeCumulMax';

const STORE_ORDER = ['Leclerc', 'Carrefour', 'Intermarché'];

export default function HuntScreen() {
  const router = useRouter();
  const { huntList, removeFromHunt, markPurchased } = useSmartHuntStore();

  const byStore = useMemo(() => {
    const groups: Record<string, typeof huntList> = {};
    for (const item of huntList) {
      const store = item.optimization.bestStore;
      if (!groups[store]) groups[store] = [];
      groups[store].push(item);
    }
    return STORE_ORDER
      .filter(s => groups[s])
      .map(store => ({ store, items: groups[store] }));
  }, [huntList]);

  const totalCaisse = huntList.reduce((s, i) => s + i.optimization.promoPrice, 0);
  const totalOdr = huntList.reduce((s, i) => s + (i.optimization.odr?.cashback || 0), 0);
  const totalFinal = huntList.reduce((s, i) => s + i.optimization.finalPrice, 0);

  const handleRemove = (id: string, name: string) => {
    showAlert(
      'Retirer de la liste',
      `Retirer "${name}" de votre liste de chasse ?`,
      [
        { text: 'Annuler', style: 'cancel' },
        { text: 'Retirer', style: 'destructive', onPress: () => removeFromHunt(id) },
      ]
    );
  };

  if (huntList.length === 0) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.header}>
          <Text style={styles.title}>Ma Chasse en cours</Text>
        </View>
        <View style={styles.emptyState}>
          <View style={styles.emptyIcon}>
            <Crosshair size={64} color={Colors.neonGreen} strokeWidth={1.5} />
          </View>
          <Text style={styles.emptyTitle}>Votre liste est vide</Text>
          <Text style={styles.emptySubtitle}>
            Ajoutez des optimisations depuis le Dashboard pour construire votre liste de chasse.
          </Text>
          <TouchableOpacity style={styles.emptyBtn} onPress={() => router.push('/')}>
            <Text style={styles.emptyBtnText}>Voir les offres</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <View>
          <Text style={styles.title}>Ma Chasse en cours</Text>
          <Text style={styles.subtitle}>
            {huntList.length} produit{huntList.length > 1 ? 's' : ''} · {byStore.length} enseigne{byStore.length > 1 ? 's' : ''}
          </Text>
        </View>
      </View>

      <FlatList
        data={byStore}
        keyExtractor={item => item.store}
        contentContainerStyle={styles.list}
        showsVerticalScrollIndicator={false}
        renderItem={({ item: group }) => (
          <View style={styles.storeGroup}>
            <View style={styles.storeGroupHeader}>
              <StoreTag name={group.store} />
              <Text style={styles.storeCount}>{group.items.length} article{group.items.length > 1 ? 's' : ''}</Text>
            </View>

            {group.items.map(({ optimization, purchased }) => (
              <TouchableOpacity
                key={optimization.id}
                style={[styles.huntItem, purchased && styles.huntItemDone]}
                onPress={() => router.push(`/product/${optimization.id}`)}
                activeOpacity={0.85}
              >
                <TouchableOpacity
                  style={[styles.checkbox, purchased && styles.checkboxChecked]}
                  onPress={() => markPurchased(optimization.id)}
                >
                  {purchased && <Check size={14} color={Colors.background} strokeWidth={2.5} />}
                </TouchableOpacity>

                <Text style={styles.itemEmoji}>{optimization.emoji}</Text>

                <View style={styles.itemText}>
                  <Text style={[styles.itemName, purchased && styles.itemNameDone]} numberOfLines={1}>
                    {optimization.name}
                  </Text>
                  <Text style={styles.itemNetLabel}>
                    Prix Net : <Text style={styles.itemNetPrice}>{optimization.finalPrice.toFixed(2)} €</Text>
                  </Text>
                  {optimization.odr && !purchased && (
                    <Text style={styles.itemOdr}>
                      Remb. {optimization.odr.source} à activer
                    </Text>
                  )}
                </View>

                {optimization.isCumulMax && !purchased && (
                  <BadgeCumulMax variant="cumulmax" />
                )}

                <TouchableOpacity
                  style={styles.removeBtn}
                  onPress={() => handleRemove(optimization.id, optimization.name)}
                >
                  <X size={16} color={Colors.textMuted} strokeWidth={2} />
                </TouchableOpacity>
              </TouchableOpacity>
            ))}
          </View>
        )}
      />

      {/* Barre de résumé fixe */}
      <View style={styles.summaryBar}>
        <View style={styles.summaryRow}>
          <View style={styles.summaryCol}>
            <Text style={styles.summaryLabel}>Total en caisse</Text>
            <Text style={styles.summaryValue}>{totalCaisse.toFixed(2)} €</Text>
          </View>
          <View style={styles.summarySep} />
          <View style={styles.summaryCol}>
            <Text style={styles.summaryLabel}>À récupérer après</Text>
            <Text style={[styles.summaryValue, { color: Colors.electricBlue }]}>- {totalOdr.toFixed(2)} €</Text>
          </View>
          <View style={styles.summarySep} />
          <View style={styles.summaryCol}>
            <Text style={styles.summaryLabel}>Revient réel</Text>
            <Text style={[styles.summaryValue, { color: Colors.neonGreen }]}>{totalFinal.toFixed(2)} €</Text>
          </View>
        </View>

        <View style={{ flexDirection: 'row', gap: Spacing.sm }}>
          <TouchableOpacity
            style={[styles.scanBtn, { flex: 1, backgroundColor: Colors.electricBlue }]}
            onPress={() => router.push('/basket-summary')}
          >
            <BarChart2 size={18} color={Colors.background} strokeWidth={2} />
            <Text style={styles.scanBtnText}>Comparer les enseignes</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.scanBtn, { flex: 1 }]}
            onPress={() => router.push('/scan')}
          >
            <ScanLine size={18} color={Colors.background} strokeWidth={2} />
            <Text style={styles.scanBtnText}>Scanner mon ticket</Text>
          </TouchableOpacity>
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  header: { padding: Spacing.lg, paddingTop: Spacing.xl },
  title: { ...Typography.h2, color: Colors.white },
  subtitle: { ...Typography.small, color: Colors.textSecondary, marginTop: 2 },
  list: { paddingHorizontal: Spacing.lg, paddingBottom: 200 },

  storeGroup: { marginBottom: Spacing.xl },
  storeGroupHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: Spacing.md },
  storeCount: { ...Typography.small, color: Colors.textMuted },

  huntItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.card,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
    padding: Spacing.md,
    marginBottom: Spacing.sm,
    gap: Spacing.md,
  },
  huntItemDone: { opacity: 0.5, borderColor: Colors.neonGreen + '44' },
  checkbox: {
    width: 22, height: 22, borderRadius: 6,
    borderWidth: 2, borderColor: Colors.textMuted,
    alignItems: 'center', justifyContent: 'center',
    flexShrink: 0,
  },
  checkboxChecked: { backgroundColor: Colors.neonGreen, borderColor: Colors.neonGreen },
  itemEmoji: { fontSize: 24, width: 32, textAlign: 'center' },
  itemText: { flex: 1 },
  itemName: { ...Typography.bodyBold, color: Colors.white, marginBottom: 2 },
  itemNameDone: { textDecorationLine: 'line-through', color: Colors.textMuted },
  itemNetLabel: { ...Typography.small, color: Colors.textSecondary },
  itemNetPrice: { color: Colors.neonGreen, fontWeight: '700' },
  itemOdr: { ...Typography.tiny, color: Colors.electricBlue, marginTop: 3 },
  removeBtn: { padding: 4 },

  emptyState: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: Spacing.xxl },
  emptyIcon: { marginBottom: Spacing.lg },
  emptyTitle: { ...Typography.h3, color: Colors.white, marginBottom: Spacing.sm },
  emptySubtitle: { ...Typography.body, color: Colors.textSecondary, textAlign: 'center', lineHeight: 22, marginBottom: Spacing.xl },
  emptyBtn: { backgroundColor: Colors.neonGreen, borderRadius: Radius.lg, paddingHorizontal: Spacing.xl, paddingVertical: Spacing.md },
  emptyBtnText: { ...Typography.bodyBold, color: Colors.background },

  summaryBar: {
    position: 'absolute',
    bottom: 0, left: 0, right: 0,
    backgroundColor: Colors.surface,
    borderTopWidth: 1,
    borderTopColor: Colors.cardBorder,
    padding: Spacing.lg,
    paddingBottom: 32,
  },
  summaryRow: { flexDirection: 'row', alignItems: 'center', marginBottom: Spacing.md },
  summaryCol: { flex: 1, alignItems: 'center' },
  summarySep: { width: 1, height: 32, backgroundColor: Colors.cardBorder },
  summaryLabel: { ...Typography.tiny, color: Colors.textMuted, marginBottom: 3 },
  summaryValue: { fontSize: 16, fontWeight: '800', color: Colors.white },
  scanBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
    backgroundColor: Colors.neonGreen,
    borderRadius: Radius.lg,
    padding: Spacing.md,
  },
  scanBtnText: { ...Typography.bodyBold, color: Colors.background, fontSize: 16 },
});
