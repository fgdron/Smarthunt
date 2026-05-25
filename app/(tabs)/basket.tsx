/**
 * Écran principal — Panier SmartHunt
 *
 * L'utilisateur importe une capture d'écran de son app magasin habituelle.
 * On parse les produits via Claude Vision, il valide, puis on optimise.
 */

import { useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  Image, ActivityIndicator, Alert,
} from 'react-native';
import { useRouter } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ShoppingCart, Camera, Sparkles, Trash2, Plus, Minus } from 'lucide-react-native';
import { Colors } from '@/constants/theme';
import { useSmartHuntStore } from '@/store/useSmartHuntStore';
import { API_URL } from '@/services/api';

export default function BasketScreen() {
  const router = useRouter();
  const { importedBasket, setImportedBasket, clearImportedBasket } = useSmartHuntStore();
  const [loading, setLoading] = useState(false);
  const [screenshot, setScreenshot] = useState<string | null>(null);

  // ── Importe et parse la capture d'écran ──────────────────────────────────
  async function handleImport() {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      Alert.alert('Permission requise', 'Autorise l\'accès à la galerie dans les réglages.');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      base64:     true,
      quality:    0.7,           // compresse pour réduire la taille
      allowsEditing: false,
    });

    if (result.canceled || !result.assets[0]) return;

    const asset    = result.assets[0];
    const base64   = asset.base64;
    const mimeType = asset.mimeType ?? 'image/jpeg';

    if (!base64) {
      Alert.alert('Erreur', 'Impossible de lire l\'image.');
      return;
    }

    setScreenshot(asset.uri);
    setLoading(true);

    try {
      const res = await fetch(`${API_URL}/v1/basket/parse-screenshot`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ image: base64, mimeType }),
      });

      if (!res.ok) throw new Error(`HTTP ${res.status}`);

      const data = await res.json() as { products: import('@/store/useSmartHuntStore').ParsedProduct[] };

      if (!data.products || data.products.length === 0) {
        Alert.alert('Aucun produit détecté', 'Essaie avec une capture plus nette, ou dans une meilleure lumière.');
        return;
      }

      setImportedBasket(data.products);
    } catch (err) {
      Alert.alert('Erreur', 'Impossible d\'analyser la capture. Vérifie ta connexion.');
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  // ── Modifie la quantité d'un produit ─────────────────────────────────────
  function updateQty(index: number, delta: number) {
    const updated = importedBasket.map((p, i) => {
      if (i !== index) return p;
      const qty        = Math.max(1, p.quantity + delta);
      return { ...p, quantity: qty, total_price: qty * p.unit_price };
    });
    setImportedBasket(updated);
  }

  function removeItem(index: number) {
    setImportedBasket(importedBasket.filter((_, i) => i !== index));
  }

  const basketTotal = importedBasket.reduce((s, p) => s + p.total_price, 0);

  // ─── UI ─────────────────────────────────────────────────────────────────────

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>

        {/* Header */}
        <View style={styles.header}>
          <ShoppingCart size={24} color={Colors.neonGreen} strokeWidth={2} />
          <Text style={styles.title}>Mon Panier</Text>
        </View>

        {/* État vide */}
        {importedBasket.length === 0 && !loading && (
          <View style={styles.emptyState}>
            <Text style={styles.emptyEmoji}>🛒</Text>
            <Text style={styles.emptyTitle}>Importe ton panier</Text>
            <Text style={styles.emptySubtitle}>
              Fais une capture d'écran de ton panier dans l'appli
              Leclerc, Carrefour ou Intermarché, puis importe-la ici.
            </Text>

            {/* Preview screenshot si chargement */}
            {screenshot && loading && (
              <Image source={{ uri: screenshot }} style={styles.screenshotPreview} />
            )}
          </View>
        )}

        {/* Chargement */}
        {loading && (
          <View style={styles.loadingBox}>
            <ActivityIndicator size="large" color={Colors.neonGreen} />
            <Text style={styles.loadingText}>Claude analyse ta capture…</Text>
          </View>
        )}

        {/* Liste produits */}
        {importedBasket.length > 0 && !loading && (
          <>
            <View style={styles.productList}>
              {importedBasket.map((product, i) => (
                <View key={i} style={styles.productCard}>
                  <View style={styles.productInfo}>
                    <Text style={styles.productName} numberOfLines={2}>
                      {product.brand ? `${product.brand} — ` : ''}{product.name}
                    </Text>
                    <Text style={styles.productMeta}>
                      {product.unit} · {product.unit_price.toFixed(2)} €/unité
                    </Text>
                  </View>

                  <View style={styles.productRight}>
                    <View style={styles.qtyRow}>
                      <TouchableOpacity
                        style={styles.qtyBtn}
                        onPress={() => updateQty(i, -1)}
                      >
                        <Minus size={14} color={Colors.textMuted} />
                      </TouchableOpacity>
                      <Text style={styles.qtyText}>{product.quantity}</Text>
                      <TouchableOpacity
                        style={styles.qtyBtn}
                        onPress={() => updateQty(i, +1)}
                      >
                        <Plus size={14} color={Colors.textMuted} />
                      </TouchableOpacity>
                    </View>
                    <Text style={styles.productTotal}>
                      {product.total_price.toFixed(2)} €
                    </Text>
                    <TouchableOpacity onPress={() => removeItem(i)}>
                      <Trash2 size={16} color={Colors.danger ?? '#FF4444'} />
                    </TouchableOpacity>
                  </View>
                </View>
              ))}
            </View>

            {/* Total + CTA optimiser */}
            <View style={styles.footer}>
              <View style={styles.totalRow}>
                <Text style={styles.totalLabel}>Total panier actuel</Text>
                <Text style={styles.totalAmount}>{basketTotal.toFixed(2)} €</Text>
              </View>

              <TouchableOpacity
                style={styles.optimizeBtn}
                onPress={() => router.push('/optimize-results')}
              >
                <Sparkles size={20} color={Colors.background} strokeWidth={2} />
                <Text style={styles.optimizeBtnText}>Optimiser mon panier</Text>
              </TouchableOpacity>

              <TouchableOpacity style={styles.resetBtn} onPress={clearImportedBasket}>
                <Text style={styles.resetBtnText}>Recommencer avec un nouveau panier</Text>
              </TouchableOpacity>
            </View>
          </>
        )}

      </ScrollView>

      {/* Bouton import flottant */}
      {!loading && (
        <TouchableOpacity style={styles.importBtn} onPress={handleImport}>
          <Camera size={22} color={Colors.background} strokeWidth={2} />
          <Text style={styles.importBtnText}>
            {importedBasket.length === 0 ? 'Importer une capture d\'écran' : 'Changer de capture'}
          </Text>
        </TouchableOpacity>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container:         { flex: 1, backgroundColor: Colors.background },
  scroll:            { padding: 20, paddingBottom: 120 },

  header:            { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 28 },
  title:             { fontSize: 22, fontWeight: '700', color: Colors.text },

  emptyState:        { alignItems: 'center', paddingTop: 40, gap: 12 },
  emptyEmoji:        { fontSize: 56 },
  emptyTitle:        { fontSize: 20, fontWeight: '700', color: Colors.text },
  emptySubtitle:     { fontSize: 14, color: Colors.textMuted, textAlign: 'center', lineHeight: 20, paddingHorizontal: 20 },

  screenshotPreview: { width: '100%', height: 200, borderRadius: 12, marginTop: 16, opacity: 0.5 },

  loadingBox:        { alignItems: 'center', paddingTop: 40, gap: 16 },
  loadingText:       { fontSize: 15, color: Colors.textMuted },

  productList:       { gap: 10 },
  productCard:       {
    backgroundColor: Colors.surface,
    borderRadius:    12,
    padding:         14,
    flexDirection:   'row',
    alignItems:      'center',
    borderWidth:     1,
    borderColor:     Colors.cardBorder,
  },
  productInfo:       { flex: 1, gap: 4 },
  productName:       { fontSize: 14, fontWeight: '600', color: Colors.text },
  productMeta:       { fontSize: 12, color: Colors.textMuted },
  productRight:      { alignItems: 'flex-end', gap: 6 },
  qtyRow:            { flexDirection: 'row', alignItems: 'center', gap: 10 },
  qtyBtn:            {
    width: 26, height: 26, borderRadius: 13,
    backgroundColor: Colors.cardBorder,
    alignItems: 'center', justifyContent: 'center',
  },
  qtyText:           { fontSize: 15, fontWeight: '700', color: Colors.text, minWidth: 20, textAlign: 'center' },
  productTotal:      { fontSize: 15, fontWeight: '700', color: Colors.neonGreen },

  footer:            { marginTop: 28, gap: 12 },
  totalRow:          { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 8 },
  totalLabel:        { fontSize: 15, color: Colors.textMuted },
  totalAmount:       { fontSize: 20, fontWeight: '800', color: Colors.text },

  optimizeBtn:       {
    backgroundColor: Colors.neonGreen,
    borderRadius:    14,
    padding:         16,
    flexDirection:   'row',
    alignItems:      'center',
    justifyContent:  'center',
    gap:             10,
  },
  optimizeBtnText:   { fontSize: 16, fontWeight: '700', color: Colors.background },

  resetBtn:          { alignItems: 'center', paddingVertical: 8 },
  resetBtnText:      { fontSize: 13, color: Colors.textMuted },

  importBtn:         {
    position:        'absolute',
    bottom:          28,
    left:            20,
    right:           20,
    backgroundColor: Colors.electricBlue,
    borderRadius:    14,
    padding:         16,
    flexDirection:   'row',
    alignItems:      'center',
    justifyContent:  'center',
    gap:             10,
  },
  importBtnText:     { fontSize: 15, fontWeight: '700', color: '#fff' },
});
