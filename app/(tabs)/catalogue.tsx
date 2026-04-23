import React, { useState, useCallback, useRef, useMemo, useEffect } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet,
  ScrollView, FlatList, Animated,
  Modal, TextInput, KeyboardAvoidingView, Platform,
  useWindowDimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ChevronRight, Trash2, Plus, X, CheckCircle, ShieldCheck, Bookmark, Save, Layers, ArrowLeft, ArrowRight } from 'lucide-react-native';
import { useRouter } from 'expo-router';
import { Colors, Radius, Spacing } from '@/constants/theme';
import {
  CATEGORY_META, SUBCATEGORY_META, CategoryMeta, SubcategoryMeta,
  ProductGroup, SegmentType,
  getProductsBySubcategory, categoryProductCount, subcategoryProductCount,
} from '@/data/productsDB';
import { useSmartHuntStore, SavedList } from '@/store/useSmartHuntStore';
import { getBestNetPrice, checkBioSwitch } from '@/engine/netPrice';
import { getSmartNudges, SmartNudge } from '@/engine/nudges';
import { showAlert } from '@/utils/alert';
import { ReliabilityBadge } from '@/components/ReliabilityBadge';
import TransparencyModal from '@/components/TransparencyModal';
import TutorialTooltip from '@/components/TutorialTooltip';
import { useTutorial } from '@/hooks/useTutorial';

// ─── Vue active ─────────────────────────────────────────────
type ViewState =
  | { screen: 'categories' }
  | { screen: 'subcategories'; cat: CategoryMeta }
  | { screen: 'products'; cat: CategoryMeta; sub: SubcategoryMeta };

// ─── Labels sélecteurs ─────────────────────────────────────
const SEGMENT_LABELS: Record<SegmentType, string> = {
  mdd:    'MDD',
  leader: 'Leader',
  bio:    'Bio',
};

// ─────────────────────────────────────────────────────────────
// Grille des catégories
// ─────────────────────────────────────────────────────────────
function CategoryGrid({
  onSelect,
  basketCounts,
}: {
  onSelect: (cat: CategoryMeta) => void;
  basketCounts: Record<string, number>;
}) {
  const { width } = useWindowDimensions();
  // 3 colonnes avec gaps — taille calculée dynamiquement
  const COLS = 3;
  const GAP  = 10;
  const PAD  = Spacing.md;
  const cardW = Math.floor((width - PAD * 2 - GAP * (COLS - 1)) / COLS);

  return (
    <ScrollView
      contentContainerStyle={[s.gridWrap, { padding: PAD, gap: GAP, paddingBottom: 120 }]}
      showsVerticalScrollIndicator={false}
    >
      {CATEGORY_META.map(cat => {
        const inBasket = basketCounts[cat.slug] ?? 0;
        const active   = inBasket > 0;
        return (
          <TouchableOpacity
            key={cat.slug}
            style={[
              s.catCard,
              { width: cardW },
              active && { borderColor: cat.color, borderWidth: 1.5, backgroundColor: cat.color + '10' },
            ]}
            onPress={() => onSelect(cat)}
            activeOpacity={0.75}
          >
            {/* Cercle teinté autour de l'emoji */}
            <View style={[s.catIconCircle, { backgroundColor: cat.color + '20' }]}>
              <Text style={s.catEmoji}>{cat.emoji}</Text>
            </View>

            <Text style={s.catLabel} numberOfLines={1}>{cat.label}</Text>

            {/* Badge panier — remplace le compteur produits */}
            {active && (
              <View style={[s.catBadge, { backgroundColor: cat.color }]}>
                <Text style={s.catBadgeText}>{inBasket}</Text>
              </View>
            )}
          </TouchableOpacity>
        );
      })}
    </ScrollView>
  );
}

// ─────────────────────────────────────────────────────────────
// Liste des sous-catégories
// ─────────────────────────────────────────────────────────────
function SubcategoryList({
  cat,
  onSelect,
  basketCounts,
}: {
  cat: CategoryMeta;
  onSelect: (sub: SubcategoryMeta) => void;
  basketCounts: Record<string, number>;
}) {
  const { width } = useWindowDimensions();
  const subs = SUBCATEGORY_META.filter(s => s.categorySlug === cat.slug);

  // Chips 2 colonnes calculées dynamiquement
  const COLS = 2;
  const GAP  = 8;
  const PAD  = Spacing.lg;
  const chipW = Math.floor((width - PAD * 2 - GAP) / COLS);

  return (
    <ScrollView
      contentContainerStyle={s.subGridWrap}
      showsVerticalScrollIndicator={false}
    >
      <View style={[s.subChipsGrid, { gap: GAP, padding: PAD, paddingBottom: 120 }]}>
        {subs.map(sub => {
          const count    = subcategoryProductCount(cat.slug, sub.slug);
          const inBasket = basketCounts[sub.slug] ?? 0;
          const active   = inBasket > 0;
          return (
            <TouchableOpacity
              key={sub.slug}
              style={[
                s.subChip,
                { width: chipW },
                active && { borderColor: cat.color, backgroundColor: cat.color + '10' },
              ]}
              onPress={() => onSelect(sub)}
              activeOpacity={0.75}
            >
              {/* Emoji dans mini cercle teinté */}
              <View style={[s.subChipIcon, { backgroundColor: active ? cat.color + '25' : Colors.surface }]}>
                <Text style={s.subEmoji}>{sub.emoji}</Text>
              </View>

              <View style={{ flex: 1, minWidth: 0 }}>
                <Text style={s.subLabel} numberOfLines={1}>{sub.label}</Text>
                <Text style={s.subCount}>{count} produit{count > 1 ? 's' : ''}</Text>
              </View>

              {active && (
                <View style={[s.subBadge, { backgroundColor: cat.color }]}>
                  <Text style={s.subBadgeText}>{inBasket}</Text>
                </View>
              )}
            </TouchableOpacity>
          );
        })}
      </View>
    </ScrollView>
  );
}

// ─────────────────────────────────────────────────────────────
// Ligne produit avec sélecteur 3-way
// ─────────────────────────────────────────────────────────────
function ProductRow({
  group,
  catColor,
  nudge,
}: {
  group: ProductGroup;
  catColor: string;
  nudge?: SmartNudge;
}) {
  const { addToBasket, removeFromBasket, updateBasketQty, isInBasket, getBasketType, getBasketQty } = useSmartHuntStore();
  const inBasket = isInBasket(group.groupId);
  const activeType = getBasketType(group.groupId);
  const qty = getBasketQty(group.groupId);

  const availableTypes = (['mdd', 'leader', 'bio'] as SegmentType[]).filter(t => !!group.variants[t]);

  // Animation: scale pulse + brief checkmark on add
  const scaleAnims = useRef<Partial<Record<SegmentType, Animated.Value>>>({}).current;
  availableTypes.forEach(t => { if (!scaleAnims[t]) scaleAnims[t] = new Animated.Value(1); });
  const [justAdded, setJustAdded] = useState<SegmentType | null>(null);
  const justAddedTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handlePress = useCallback((type: SegmentType) => {
    if (inBasket && activeType === type) {
      removeFromBasket(group.groupId);
    } else {
      addToBasket(group, type);
      // Scale pulse
      const anim = scaleAnims[type]!;
      Animated.sequence([
        Animated.timing(anim, { toValue: 1.14, duration: 110, useNativeDriver: true }),
        Animated.spring(anim, { toValue: 1, friction: 5, tension: 200, useNativeDriver: true }),
      ]).start();
      // Checkmark flash
      if (justAddedTimer.current) clearTimeout(justAddedTimer.current);
      setJustAdded(type);
      justAddedTimer.current = setTimeout(() => setJustAdded(null), 750);
    }
  }, [inBasket, activeType]);

  // Bio-switch check (only when in basket and not already bio)
  const bioSwitch = inBasket && activeType && activeType !== 'bio'
    ? checkBioSwitch(group, activeType, 'leclerc')
    : null;

  // Active variant for reliability badge
  const activeVariant = inBasket && activeType ? group.variants[activeType] : null;

  return (
    <View style={[s.productCard, inBasket && { borderColor: catColor + '70', backgroundColor: catColor + '08' }]}>
      {/* En-tête produit */}
      <View style={s.productHeader}>
        <Text style={s.productEmoji}>{group.emoji}</Text>
        <View style={{ flex: 1 }}>
          <Text style={[s.productName, inBasket && { color: Colors.white }]} numberOfLines={2}>
            {group.genericName}
          </Text>
          {inBasket && activeType && (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 3, flexWrap: 'wrap' }}>
              <Text style={[s.productSelected, { color: catColor }]}>
                ✓ {group.variants[activeType]?.brand} · {group.variants[activeType]?.basePrice.toFixed(2)} €
              </Text>
              {activeVariant && (
                <ReliabilityBadge lastVerified={activeVariant.last_verified} />
              )}
            </View>
          )}
        </View>
        {inBasket && (
          <View style={s.qtyControls}>
            <TouchableOpacity
              style={s.qtyBtn}
              onPress={() => qty <= 1 ? removeFromBasket(group.groupId) : updateBasketQty(group.groupId, qty - 1)}
            >
              {qty <= 1
                ? <Trash2 size={14} color={Colors.orange} strokeWidth={2} />
                : <X size={14} color={Colors.textSecondary} strokeWidth={2} />
              }
            </TouchableOpacity>
            <Text style={s.qtyValue}>{qty}</Text>
            <TouchableOpacity
              style={s.qtyBtn}
              onPress={() => updateBasketQty(group.groupId, qty + 1)}
            >
              <Plus size={14} color={Colors.neonGreen} strokeWidth={2} />
            </TouchableOpacity>
          </View>
        )}
      </View>

      {/* Sélecteurs MDD / Leader / Bio */}
      <View style={s.segmentRow}>
        {availableTypes.map(type => {
          const v = group.variants[type]!;
          const isActive = inBasket && activeType === type;
          const segColor = type === 'bio' ? '#00CC6A' : type === 'leader' ? Colors.electricBlue : '#FFD700';
          const netResult = v.catalogue_promo || v.cashback_app
            ? getBestNetPrice(v, 'leclerc')
            : null;

          const isJustAdded = justAdded === type;

          return (
            <Animated.View
              key={type}
              style={[s.segBtnWrap, { transform: [{ scale: scaleAnims[type] ?? 1 }] }]}
            >
              <TouchableOpacity
                style={[
                  s.segBtn,
                  { borderColor: segColor + '55' },
                  isActive && { backgroundColor: segColor, borderColor: segColor },
                ]}
                onPress={() => handlePress(type)}
                activeOpacity={0.75}
              >
                <Text style={[s.segBtnType, isActive && { color: Colors.background }]}>
                  {SEGMENT_LABELS[type]}
                </Text>
                {netResult && netResult.totalSaving > 0 ? (
                  <>
                    <Text style={[s.segBtnPrice, isActive && { color: Colors.background + 'CC' }, s.segBtnPriceStrike]}>
                      {v.basePrice.toFixed(2)} €
                    </Text>
                    <Text style={[s.segBtnNetPrice, isActive ? { color: Colors.background } : { color: '#00CC6A' }]}>
                      {netResult.netPrice.toFixed(2)} €
                    </Text>
                  </>
                ) : (
                  <Text style={[s.segBtnPrice, isActive && { color: Colors.background + 'CC' }]}>
                    {v.basePrice.toFixed(2)} €
                  </Text>
                )}
                <Text style={[s.segBtnBrand, isActive && { color: Colors.background + '99' }]} numberOfLines={1}>
                  {v.brand}
                </Text>
                {netResult && netResult.totalSaving > 0 && (
                  <View style={[s.promoBadge, isActive && { backgroundColor: Colors.background + '30' }]}>
                    <Text style={s.promoBadgeText}>-{netResult.totalSaving.toFixed(2)}€</Text>
                  </View>
                )}
              </TouchableOpacity>
              {/* Checkmark flash overlay */}
              {isJustAdded && (
                <View style={[s.checkOverlay, { backgroundColor: segColor }]}>
                  <CheckCircle size={22} color={Colors.background} strokeWidth={2} />
                </View>
              )}
            </Animated.View>
          );
        })}
      </View>

      {/* Prix par enseigne — top 4 les moins chers parmi les disponibles */}
      {inBasket && activeType && (() => {
        const v = group.variants[activeType]!;
        const allChips = (['leclerc', 'superu', 'carrefour', 'intermarche', 'auchan', 'monoprix', 'lidl', 'aldi'] as const)
          .map(storeId => {
            const rawPrice = v.prices[storeId];
            if (rawPrice === undefined) return null;
            const netResult = getBestNetPrice(v, storeId);
            return { storeId, rawPrice, netPrice: netResult?.netPrice ?? rawPrice, netResult };
          })
          .filter((c): c is NonNullable<typeof c> => c !== null)
          .sort((a, b) => a.netPrice - b.netPrice);

        const topChips = allChips.slice(0, 4);
        const cheapestNetPrice = topChips[0]?.netPrice;

        return (
          <View style={s.storePricesRow}>
            {topChips.map(({ storeId, rawPrice, netPrice, netResult }) => {
              const isCheapest = netPrice === cheapestNetPrice;
              const hasDiscount = (netResult?.totalSaving ?? 0) > 0;
              const chipLabel = { leclerc: 'Leclerc', superu: 'Super U', carrefour: 'Carrefour', intermarche: 'Intermar.', auchan: 'Auchan', monoprix: 'Monoprix', lidl: 'Lidl', aldi: 'Aldi' }[storeId];
              return (
                <View key={storeId} style={[s.storeChip, isCheapest && { backgroundColor: catColor + '20', borderColor: catColor + '60' }]}>
                  <Text style={[s.storeChipLabel, isCheapest && { color: catColor }]}>{chipLabel}</Text>
                  {hasDiscount ? (
                    <>
                      <Text style={s.storeChipPriceStrike}>{rawPrice.toFixed(2)} €</Text>
                      <Text style={[s.storeChipPrice, { color: '#00CC6A', fontWeight: '800' }]}>
                        {netPrice.toFixed(2)} €
                      </Text>
                    </>
                  ) : (
                    <Text style={[s.storeChipPrice, isCheapest && { color: catColor, fontWeight: '800' }]}>
                      {rawPrice.toFixed(2)} €
                    </Text>
                  )}
                  {isCheapest && <Text style={[s.storeChipStar, { color: catColor }]}>★</Text>}
                </View>
              );
            })}
            {allChips.length > 4 && (
              <View style={[s.storeChip, { justifyContent: 'center' }]}>
                <Text style={s.storeChipLabel}>+{allChips.length - 4}</Text>
              </View>
            )}
          </View>
        );
      })()}

      {/* Bio-Switch label */}
      {bioSwitch?.available && (
        <View style={s.bioSwitchBadge}>
          <Text style={s.bioSwitchText}>{bioSwitch.label}</Text>
        </View>
      )}

      {/* SmartNudge — opportunité de volume */}
      {nudge && (
        <View style={s.nudgeBanner}>
          <Text style={s.nudgeText}>
            💡 +1 article → <Text style={s.nudgeSaving}>-{nudge.savingDelta.toFixed(2)} €</Text>
            {' '}({nudge.dropPct}% sur le prix unitaire)
          </Text>
          <TouchableOpacity
            style={s.nudgeApplyBtn}
            onPress={() => updateBasketQty(group.groupId, nudge.suggestedQty)}
          >
            <Text style={s.nudgeApplyText}>Appliquer</Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}

// ─────────────────────────────────────────────────────────────
// Toast de confirmation
// ─────────────────────────────────────────────────────────────
function ToastBanner({ message }: { message: string }) {
  const opacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    opacity.setValue(0);
    Animated.sequence([
      Animated.timing(opacity, { toValue: 1, duration: 180, useNativeDriver: true }),
      Animated.delay(1800),
      Animated.timing(opacity, { toValue: 0, duration: 280, useNativeDriver: true }),
    ]).start();
  }, [opacity]);

  return (
    <Animated.View style={[s.toast, { opacity }]} pointerEvents="none">
      <CheckCircle size={15} color={Colors.background} strokeWidth={2} />
      <Text style={s.toastText}>{message}</Text>
    </Animated.View>
  );
}

// ─────────────────────────────────────────────────────────────
// Modale — Sauvegarder une liste
// ─────────────────────────────────────────────────────────────
function SaveListModal({
  visible,
  onClose,
  onSave,
}: {
  visible: boolean;
  onClose: () => void;
  onSave: (name: string) => void;
}) {
  const [name, setName] = useState('');
  const handleSave = () => {
    if (!name.trim()) return;
    onSave(name.trim());
    setName('');
    onClose();
  };
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={s.modalOverlay}
      >
        <View style={s.modalCard}>
          <Text style={s.modalTitle}>Nommer la liste</Text>
          <TextInput
            style={s.modalInput}
            value={name}
            onChangeText={setName}
            placeholder="Ex : Courses du weekend"
            placeholderTextColor={Colors.textMuted}
            autoFocus
            returnKeyType="done"
            onSubmitEditing={handleSave}
          />
          <View style={s.modalBtns}>
            <TouchableOpacity style={s.modalBtnCancel} onPress={onClose}>
              <Text style={s.modalBtnCancelText}>Annuler</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[s.modalBtnConfirm, !name.trim() && { opacity: 0.4 }]}
              onPress={handleSave}
              disabled={!name.trim()}
            >
              <Text style={s.modalBtnConfirmText}>Sauvegarder</Text>
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

// ─────────────────────────────────────────────────────────────
// Modale — Bibliothèque de listes
// ─────────────────────────────────────────────────────────────
function ListsModal({
  visible,
  onClose,
  lists,
  onLoad,
  onDelete,
}: {
  visible: boolean;
  onClose: () => void;
  lists: SavedList[];
  onLoad: (id: string) => void;
  onDelete: (id: string) => void;
}) {
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={s.modalOverlay}>
        <View style={[s.modalCard, { maxHeight: '72%' }]}>
          <View style={s.modalHeaderRow}>
            <Text style={s.modalTitle}>Mes Listes</Text>
            <TouchableOpacity onPress={onClose}>
              <X size={22} color={Colors.textMuted} strokeWidth={2} />
            </TouchableOpacity>
          </View>

          {lists.length === 0 ? (
            <View style={{ paddingVertical: 32, alignItems: 'center' }}>
              <Text style={{ fontSize: 32 }}>🗂️</Text>
              <Text style={[s.modalTitle, { fontSize: 14, marginTop: 8, color: Colors.textSecondary }]}>
                Aucune liste sauvegardée
              </Text>
              <Text style={{ color: Colors.textMuted, fontSize: 12, marginTop: 4, textAlign: 'center' }}>
                Composez un panier et appuyez sur{'\n'}"Sauvegarder" pour créer votre première liste.
              </Text>
            </View>
          ) : (
            <ScrollView showsVerticalScrollIndicator={false} style={{ marginTop: 8 }}>
              {lists.map((list, idx) => (
                <TouchableOpacity
                  key={list.id}
                  style={[s.listRow, idx === lists.length - 1 && { borderBottomWidth: 0 }]}
                  onPress={() => onLoad(list.id)}
                  activeOpacity={0.75}
                >
                  <View style={s.listRowIcon}>
                    <Layers size={18} color={Colors.neonGreen} strokeWidth={2} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={s.listRowName}>{list.name}</Text>
                    <Text style={s.listRowMeta}>
                      {list.items.reduce((s, i) => s + i.qty, 0)} article{list.items.reduce((s, i) => s + i.qty, 0) > 1 ? 's' : ''}
                      {' · '}{list.items.length} produit{list.items.length > 1 ? 's' : ''}
                      {' · '}{new Date(list.createdAt).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })}
                    </Text>
                  </View>
                  <TouchableOpacity
                    style={s.listRowDelete}
                    onPress={() => onDelete(list.id)}
                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                  >
                    <Trash2 size={16} color={Colors.orange} strokeWidth={2} />
                  </TouchableOpacity>
                </TouchableOpacity>
              ))}
            </ScrollView>
          )}
        </View>
      </View>
    </Modal>
  );
}

// ─────────────────────────────────────────────────────────────
// ÉCRAN PRINCIPAL
// ─────────────────────────────────────────────────────────────
export default function CatalogueScreen() {
  const router = useRouter();
  const {
    userBasket, saveListType, savedListType,
    clearBasket, saveList, loadList, deleteList, savedLists,
    updateBasketQty,
  } = useSmartHuntStore();

  const [view, setView] = useState<ViewState>({ screen: 'categories' });
  const [saveModalVisible, setSaveModalVisible]       = useState(false);
  const [listsModalVisible, setListsModalVisible]     = useState(false);
  const [toast, setToast] = useState<{ id: number; msg: string } | null>(null);
  const [transparencyVisible, setTransparencyVisible] = useState(false);
  const { seen: tutorialSeen, markSeen: markTutorialSeen } = useTutorial('catalogue_products');

  const showToast = useCallback((msg: string) => {
    setToast({ id: Date.now(), msg });
  }, []);

  // ── SmartNudges — recalcul à chaque changement du panier ──
  const nudges       = useMemo(() => getSmartNudges(userBasket), [userBasket]);
  const nudgeByGroup = useMemo(
    () => Object.fromEntries(nudges.map(n => [n.groupId, n])),
    [nudges],
  );

  // Compter les articles dans le panier par catégorie et sous-catégorie
  const basketCounts = userBasket.reduce<Record<string, number>>((acc, item) => {
    acc[item.group.categorySlug] = (acc[item.group.categorySlug] ?? 0) + 1;
    acc[item.group.subcategorySlug] = (acc[item.group.subcategorySlug] ?? 0) + 1;
    return acc;
  }, {});

  const totalInBasket = userBasket.length;
  const totalUnits = userBasket.reduce((s, i) => s + i.qty, 0);
  const hasMultipleQty = totalUnits > totalInBasket;

  const totalBasketPrice = userBasket.reduce((s, i) => s + i.variant.basePrice * i.qty, 0);

  const goBack = () => {
    if (view.screen === 'products') setView({ screen: 'subcategories', cat: view.cat });
    else if (view.screen === 'subcategories') setView({ screen: 'categories' });
  };

  const handleCalculate = () => router.push('/strategy');

  const handleReset = () => {
    if (userBasket.length === 0) return;
    showAlert(
      'Vider le panier',
      `Supprimer les ${totalInBasket} produit${totalInBasket > 1 ? 's' : ''} du panier ?`,
      [
        { text: 'Annuler', style: 'cancel' },
        { text: 'Vider', style: 'destructive', onPress: clearBasket },
      ],
    );
  };

  const handleSaveList = (name: string) => {
    saveList(name);
    showToast(`"${name}" enregistrée !`);
  };

  const handleLoadList = (id: string) => {
    setListsModalVisible(false);
    const list = savedLists.find(l => l.id === id);
    if (!list) return;
    if (userBasket.length > 0) {
      showAlert(
        'Charger la liste',
        `Remplacer le panier actuel par "${list.name}" ?`,
        [
          { text: 'Annuler', style: 'cancel' },
          { text: 'Charger', onPress: () => loadList(id) },
        ],
      );
    } else {
      loadList(id);
    }
  };

  const handleDeleteList = (id: string) => {
    const list = savedLists.find(l => l.id === id);
    if (!list) return;
    showAlert(
      'Supprimer la liste',
      `Supprimer définitivement "${list.name}" ?`,
      [
        { text: 'Annuler', style: 'cancel' },
        { text: 'Supprimer', style: 'destructive', onPress: () => deleteList(id) },
      ],
    );
  };

  // ── Breadcrumb ─────────────────────────────────────────────
  const renderBreadcrumb = () => (
    <View style={s.breadcrumb}>
      <TouchableOpacity onPress={() => setView({ screen: 'categories' })}>
        <Text style={[s.breadItem, view.screen === 'categories' && s.breadActive]}>Courses</Text>
      </TouchableOpacity>
      {view.screen !== 'categories' && (
        <>
          <ChevronRight size={11} color={Colors.textMuted} strokeWidth={2} />
          <TouchableOpacity onPress={() => view.screen === 'products' ? setView({ screen: 'subcategories', cat: view.cat }) : undefined}>
            <Text style={[s.breadItem, view.screen === 'subcategories' && s.breadActive]}>
              {view.cat.label}
            </Text>
          </TouchableOpacity>
        </>
      )}
      {view.screen === 'products' && (
        <>
          <ChevronRight size={11} color={Colors.textMuted} strokeWidth={2} />
          <Text style={s.breadActive}>{view.sub.label}</Text>
        </>
      )}
    </View>
  );

  // ── Contenu central ────────────────────────────────────────
  const renderContent = () => {
    if (view.screen === 'categories') {
      return (
        <CategoryGrid
          basketCounts={basketCounts}
          onSelect={cat => setView({ screen: 'subcategories', cat })}
        />
      );
    }
    if (view.screen === 'subcategories') {
      return (
        <SubcategoryList
          cat={view.cat}
          basketCounts={basketCounts}
          onSelect={sub => setView({ screen: 'products', cat: view.cat, sub })}
        />
      );
    }
    // products
    const products = getProductsBySubcategory(view.cat.slug, view.sub.slug);
    const today = new Date().toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' });
    return (
      <FlatList
        data={products}
        keyExtractor={p => p.groupId}
        contentContainerStyle={{ padding: Spacing.lg, paddingBottom: 140 }}
        showsVerticalScrollIndicator={false}
        renderItem={({ item }) => (
          <ProductRow group={item} catColor={view.cat.color} nudge={nudgeByGroup[item.groupId]} />
        )}
        ListEmptyComponent={
          <View style={{ alignItems: 'center', padding: 40 }}>
            <Text style={{ color: Colors.textMuted, fontSize: 14 }}>Aucun produit dans cette sous-catégorie.</Text>
          </View>
        }
        ListFooterComponent={
          products.length > 0 ? (
            <TouchableOpacity
              style={s.trustBanner}
              onPress={() => setTransparencyVisible(true)}
              activeOpacity={0.7}
            >
              <ShieldCheck size={13} color={Colors.textMuted} strokeWidth={2} />
              <Text style={s.trustBannerText}>
                Prix relevés via Drives officiels · Mis à jour le {today}
              </Text>
              <Text style={s.trustBannerLink}>En savoir plus</Text>
            </TouchableOpacity>
          ) : null
        }
      />
    );
  };

  return (
    <SafeAreaView style={s.root} edges={['top']}>

      {/* Header */}
      <View style={s.header}>
        {view.screen !== 'categories' ? (
          <TouchableOpacity style={s.backBtn} onPress={goBack}>
            <ArrowLeft size={20} color={Colors.white} strokeWidth={2} />
          </TouchableOpacity>
        ) : (
          <View style={{ width: 40 }} />
        )}

        <View style={{ flex: 1 }}>
          <Text style={s.headerTitle}>Mes Courses</Text>
          {renderBreadcrumb()}
        </View>

        {/* Sauvegarder Liste Type */}
        {totalInBasket > 0 && (
          <TouchableOpacity style={s.saveBtn} onPress={saveListType}>
            <Bookmark size={18} color={Colors.electricBlue} strokeWidth={2} />
          </TouchableOpacity>
        )}
      </View>

      {/* Toolbar listes */}
      <View style={s.toolbar}>
        {totalInBasket > 0 && (
          <>
            <TouchableOpacity style={s.toolbarBtn} onPress={handleReset}>
              <Trash2 size={14} color={Colors.orange} strokeWidth={2} />
              <Text style={[s.toolbarBtnText, { color: Colors.orange }]}>Vider</Text>
            </TouchableOpacity>
            <View style={s.toolbarDivider} />
            <TouchableOpacity style={s.toolbarBtn} onPress={() => setSaveModalVisible(true)}>
              <Save size={14} color={Colors.electricBlue} strokeWidth={2} />
              <Text style={[s.toolbarBtnText, { color: Colors.electricBlue }]}>Sauvegarder</Text>
            </TouchableOpacity>
            <View style={s.toolbarDivider} />
          </>
        )}
        <TouchableOpacity style={s.toolbarBtn} onPress={() => setListsModalVisible(true)}>
          <Layers size={14} color={Colors.neonGreen} strokeWidth={2} />
          <Text style={[s.toolbarBtnText, { color: Colors.neonGreen }]}>
            Mes Listes{savedLists.length > 0 ? ` (${savedLists.length})` : ''}
          </Text>
        </TouchableOpacity>
        {nudges.length > 0 && (
          <>
            <View style={{ flex: 1 }} />
            <View style={s.nudgePill}>
              <Text style={s.nudgePillText}>💡 {nudges.length} conseil{nudges.length > 1 ? 's' : ''}</Text>
            </View>
          </>
        )}
      </View>

      {/* Contenu */}
      <View style={{ flex: 1 }}>
        {renderContent()}
      </View>

      {/* Barre flottante */}
      {totalInBasket > 0 && (
        <View style={s.floatingBar}>
          <View style={{ flex: 1 }}>
            <Text style={s.floatingCount}>
              {totalInBasket} produit{totalInBasket > 1 ? 's' : ''}
              {hasMultipleQty ? ` · ${totalUnits} articles` : ''} · {totalBasketPrice.toFixed(2)} €
            </Text>
            <Text style={s.floatingHint}>
              {savedListType.length > 0 ? 'Liste Type sauvegardée' : 'Appuie sur le signet pour sauvegarder ta Liste Type'}
            </Text>
          </View>
          <TouchableOpacity style={s.floatingCta} onPress={handleCalculate} activeOpacity={0.85}>
            <Text style={s.floatingCtaText}>Stratégie</Text>
            <ArrowRight size={18} color={Colors.background} strokeWidth={2} />
          </TouchableOpacity>
        </View>
      )}
      {/* Toast de confirmation */}
      {toast && <ToastBanner key={toast.id} message={toast.msg} />}

      {/* Modales */}
      <SaveListModal
        visible={saveModalVisible}
        onClose={() => setSaveModalVisible(false)}
        onSave={handleSaveList}
      />
      <ListsModal
        visible={listsModalVisible}
        onClose={() => setListsModalVisible(false)}
        lists={savedLists}
        onLoad={handleLoadList}
        onDelete={handleDeleteList}
      />
      <TransparencyModal visible={transparencyVisible} onClose={() => setTransparencyVisible(false)} />

      <TutorialTooltip
        visible={view.screen === 'products' && tutorialSeen === false}
        icon={Layers}
        title="Les segments de produits"
        body={"MDD : marque distributeur, le prix le plus bas.\nLeader : grande marque nationale.\nBio : produits biologiques certifiés."}
        onDismiss={markTutorialSeen}
      />
    </SafeAreaView>
  );
}

// ─────────────────────────────────────────────────────────────
// Styles
// ─────────────────────────────────────────────────────────────
const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.background },

  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: Spacing.lg, paddingTop: Spacing.md, paddingBottom: Spacing.sm, gap: 10 },
  backBtn: { width: 40, height: 40, backgroundColor: Colors.card, borderRadius: Radius.full, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { fontSize: 18, fontWeight: '800', color: Colors.white },
  saveBtn: { width: 40, height: 40, backgroundColor: Colors.electricBlue + '15', borderRadius: Radius.full, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: Colors.electricBlue + '40' },

  breadcrumb: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 2, flexWrap: 'wrap' },
  breadItem: { fontSize: 11, color: Colors.textMuted },
  breadActive: { fontSize: 11, color: Colors.white, fontWeight: '600' },

  // ── Grille catégories ─────────────────────────────────────
  // ── Catégories — grille 3 colonnes ───────────────────────
  gridWrap: { flexDirection: 'row', flexWrap: 'wrap' },
  catCard: {
    backgroundColor: Colors.card,
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.sm,
    alignItems: 'center',
    gap: 6,
    position: 'relative',
  },
  catIconCircle: {
    width: 44, height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  catEmoji: { fontSize: 22 },
  catLabel: { fontSize: 11, fontWeight: '700', color: Colors.white, textAlign: 'center' },
  catBadge: {
    position: 'absolute', top: 6, right: 6,
    borderRadius: Radius.full, minWidth: 18, height: 18,
    alignItems: 'center', justifyContent: 'center', paddingHorizontal: 3,
  },
  catBadgeText: { fontSize: 9, fontWeight: '800', color: Colors.background },

  // ── Sous-catégories — chips 2 colonnes ───────────────────
  subGridWrap: {},
  subChipsGrid: { flexDirection: 'row', flexWrap: 'wrap' },
  subChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: Colors.card,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
    paddingVertical: 10,
    paddingHorizontal: Spacing.sm,
  },
  subChipIcon: {
    width: 32, height: 32,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  subEmoji: { fontSize: 17 },
  subLabel: { fontSize: 12, fontWeight: '600', color: Colors.white },
  subCount: { fontSize: 10, color: Colors.textMuted, marginTop: 1 },
  subBadge: { borderRadius: Radius.full, minWidth: 18, height: 18, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 3, flexShrink: 0 },
  subBadgeText: { fontSize: 9, fontWeight: '800', color: Colors.background },

  // ── Produit ───────────────────────────────────────────────
  productCard: {
    backgroundColor: Colors.card, borderRadius: Radius.lg,
    borderWidth: 1, borderColor: Colors.cardBorder,
    padding: Spacing.md, marginBottom: Spacing.sm,
  },
  productHeader: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, marginBottom: 10 },
  productEmoji: { fontSize: 28, width: 36 },
  productName: { fontSize: 14, fontWeight: '600', color: Colors.textSecondary, lineHeight: 20 },
  productSelected: { fontSize: 12, fontWeight: '600', marginTop: 3 },

  // Sélecteur quantité
  qtyControls: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: Colors.surface, borderRadius: Radius.sm,
    borderWidth: 1, borderColor: Colors.cardBorder, padding: 3,
  },
  qtyBtn: {
    width: 26, height: 26, borderRadius: Radius.sm,
    backgroundColor: Colors.card, alignItems: 'center', justifyContent: 'center',
  },
  qtyValue: {
    minWidth: 22, textAlign: 'center',
    fontSize: 14, fontWeight: '800', color: Colors.white,
  },

  // Sélecteurs 3-way
  segmentRow: { flexDirection: 'row', gap: 6 },
  segBtnWrap: { flex: 1, position: 'relative' },
  segBtn: {
    flex: 1, borderWidth: 1, borderRadius: Radius.sm,
    paddingVertical: 8, paddingHorizontal: 4, alignItems: 'center',
  },
  checkOverlay: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: Radius.sm,
    alignItems: 'center', justifyContent: 'center',
    opacity: 0.92,
  },
  segBtnType: { fontSize: 11, fontWeight: '800', color: Colors.white, letterSpacing: 0.3 },
  segBtnPrice: { fontSize: 13, fontWeight: '900', color: Colors.white, marginTop: 2 },
  segBtnPriceStrike: { textDecorationLine: 'line-through', fontSize: 10, fontWeight: '500', color: Colors.textMuted },
  segBtnNetPrice: { fontSize: 13, fontWeight: '900', marginTop: 1 },
  segBtnBrand: { fontSize: 9, color: Colors.textMuted, marginTop: 1, textAlign: 'center' },
  promoBadge: { backgroundColor: '#00CC6A30', borderRadius: 4, paddingHorizontal: 4, paddingVertical: 1, marginTop: 2 },
  promoBadgeText: { fontSize: 9, fontWeight: '800', color: '#00CC6A' },

  // Prix par enseigne
  storePricesRow: { flexDirection: 'row', gap: 4, marginTop: 8 },
  storeChip: { flex: 1, backgroundColor: Colors.surface, borderWidth: 1, borderColor: Colors.cardBorder, borderRadius: Radius.sm, padding: 6, alignItems: 'center' },
  storeChipLabel: { fontSize: 9, color: Colors.textMuted, fontWeight: '600' },
  storeChipPrice: { fontSize: 12, color: Colors.white, fontWeight: '600', marginTop: 1 },
  storeChipPriceStrike: { fontSize: 9, color: Colors.textMuted, textDecorationLine: 'line-through' },
  storeChipStar: { fontSize: 10, marginTop: 1 },

  // Bio-switch
  bioSwitchBadge: { marginTop: 8, backgroundColor: '#00CC6A15', borderRadius: Radius.sm, paddingVertical: 5, paddingHorizontal: 10, borderWidth: 1, borderColor: '#00CC6A40', alignSelf: 'flex-start' },
  bioSwitchText: { fontSize: 11, color: '#00CC6A', fontWeight: '700' },

  // ── Toolbar ───────────────────────────────────────────────
  toolbar: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: Colors.surface,
    borderBottomWidth: 1, borderBottomColor: Colors.cardBorder,
    paddingHorizontal: Spacing.md, paddingVertical: 7,
    gap: 2,
  },
  toolbarBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 8, paddingVertical: 4 },
  toolbarBtnText: { fontSize: 12, fontWeight: '700', color: Colors.textSecondary },
  toolbarDivider: { width: 1, height: 14, backgroundColor: Colors.cardBorder, marginHorizontal: 2 },
  nudgePill: {
    backgroundColor: Colors.gold + '22', borderRadius: Radius.full,
    paddingHorizontal: 8, paddingVertical: 3,
    borderWidth: 1, borderColor: Colors.gold + '44',
  },
  nudgePillText: { fontSize: 11, fontWeight: '700', color: Colors.gold },

  // ── SmartNudge banner ─────────────────────────────────────
  nudgeBanner: {
    marginTop: 8, flexDirection: 'row', alignItems: 'center',
    backgroundColor: Colors.gold + '15', borderRadius: Radius.sm,
    paddingVertical: 7, paddingHorizontal: 10,
    borderWidth: 1, borderColor: Colors.gold + '40', gap: 8,
  },
  nudgeText: { flex: 1, fontSize: 11, color: Colors.gold, lineHeight: 16 },
  nudgeSaving: { fontWeight: '800', color: Colors.gold },
  nudgeApplyBtn: {
    backgroundColor: Colors.gold, borderRadius: Radius.sm,
    paddingHorizontal: 10, paddingVertical: 4,
  },
  nudgeApplyText: { fontSize: 11, fontWeight: '800', color: Colors.background },

  // ── Modales communes ──────────────────────────────────────
  modalOverlay: {
    flex: 1, backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'center', alignItems: 'center', padding: Spacing.lg,
  },
  modalCard: {
    width: '100%', backgroundColor: Colors.card,
    borderRadius: Radius.xl, padding: Spacing.xl,
    borderWidth: 1, borderColor: Colors.cardBorder,
  },
  modalHeaderRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: Spacing.md },
  modalTitle: { fontSize: 16, fontWeight: '800', color: Colors.white },
  modalInput: {
    backgroundColor: Colors.surface, borderRadius: Radius.md,
    borderWidth: 1, borderColor: Colors.cardBorder,
    paddingHorizontal: 14, paddingVertical: 12,
    color: Colors.white, fontSize: 15, marginTop: Spacing.md, marginBottom: Spacing.lg,
  },
  modalBtns: { flexDirection: 'row', gap: Spacing.md },
  modalBtnCancel: {
    flex: 1, borderRadius: Radius.md, borderWidth: 1, borderColor: Colors.cardBorder,
    paddingVertical: 12, alignItems: 'center',
  },
  modalBtnCancelText: { color: Colors.textSecondary, fontWeight: '700', fontSize: 14 },
  modalBtnConfirm: {
    flex: 1, backgroundColor: Colors.neonGreen, borderRadius: Radius.md,
    paddingVertical: 12, alignItems: 'center',
  },
  modalBtnConfirmText: { color: Colors.background, fontWeight: '800', fontSize: 14 },

  // ── Liste sauvegardée (row) ───────────────────────────────
  listRow: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: Colors.cardBorder,
  },
  listRowIcon: {
    width: 36, height: 36, borderRadius: Radius.sm,
    backgroundColor: Colors.neonGreen + '18', alignItems: 'center', justifyContent: 'center',
  },
  listRowName: { fontSize: 14, fontWeight: '700', color: Colors.white },
  listRowMeta: { fontSize: 11, color: Colors.textMuted, marginTop: 2 },
  listRowDelete: { padding: 6 },

  // ── Toast ─────────────────────────────────────────────────
  toast: {
    position: 'absolute', bottom: 110, alignSelf: 'center',
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: Colors.neonGreen, borderRadius: Radius.full,
    paddingHorizontal: 18, paddingVertical: 10,
    shadowColor: '#000', shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25, shadowRadius: 8, elevation: 8,
  },
  toastText: { fontSize: 13, fontWeight: '700', color: Colors.background },

  // ── Bandeau de confiance ──────────────────────────────────
  trustBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingVertical: Spacing.lg,
    paddingHorizontal: 4,
    flexWrap: 'wrap',
  },
  trustBannerText: { fontSize: 11, color: Colors.textMuted, flex: 1 },
  trustBannerLink: { fontSize: 11, color: Colors.electricBlue, fontWeight: '600', textDecorationLine: 'underline' },

  // ── Barre flottante ───────────────────────────────────────
  floatingBar: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    backgroundColor: Colors.surface, borderTopWidth: 1, borderTopColor: Colors.cardBorder,
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: Spacing.lg, paddingTop: Spacing.md, paddingBottom: 32, gap: 12,
  },
  floatingCount: { fontSize: 15, fontWeight: '800', color: Colors.white },
  floatingHint: { fontSize: 11, color: Colors.textMuted, marginTop: 2 },
  floatingCta: {
    backgroundColor: Colors.neonGreen, borderRadius: Radius.lg,
    paddingVertical: Spacing.md, paddingHorizontal: Spacing.lg,
    flexDirection: 'row', alignItems: 'center', gap: 8,
  },
  floatingCtaText: { fontSize: 14, fontWeight: '800', color: Colors.background },
});
