import React, { useRef, useState } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet,
  Animated, Platform, Linking, TextInput, KeyboardAvoidingView,
  ScrollView, useWindowDimensions, NativeSyntheticEvent, NativeScrollEvent,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { CheckCircle, Info, Bell, User, ArrowRight, Download, MousePointer2, Target, Lightbulb, Rocket, type LucideIcon } from 'lucide-react-native';
import { useRouter } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Colors, Spacing, Radius, Typography } from '@/constants/theme';
import { requestPermissionIfNeeded } from '@/services/notifications';
import { useSmartHuntStore } from '@/store/useSmartHuntStore';

export const ONBOARDED_KEY = 'smarthunt_onboarded';

type Phase       = 'slides' | 'personalization' | 'shopmium';
type NotifStatus = 'idle' | 'granted' | 'denied';

const SHOPMIUM_URL = Platform.OS === 'ios'
  ? 'https://apps.apple.com/fr/app/shopmium/id506023626'
  : 'https://play.google.com/store/apps/details?id=com.shopmium';

const GOAL_PRESETS = [50, 100, 150, 200] as const;

// ─── Contenu des slides ──────────────────────────────────────────────────────
interface Slide {
  key: string; icon: LucideIcon; accent: string; badge: string;
  title: string; subtitle: string; body: string;
}

const SLIDES: Slide[] = [
  {
    key: 's1', icon: Target, accent: Colors.neonGreen, badge: 'BIENVENUE',
    title: 'Bienvenue sur\nSmartHunt',
    subtitle: 'L\'app qui calcule votre vraie économie avant d\'acheter.',
    body: 'Fini les faux bons plans. SmartHunt combine promotions en caisse et remboursements ODR pour afficher le prix réel final — avant même de passer en caisse.',
  },
  {
    key: 's2', icon: Lightbulb, accent: Colors.electricBlue, badge: 'CALCUL NET-NET',
    title: 'Ce que vous payez\nvraiment',
    subtitle: 'Promo + cashback + coupon = prix net final.',
    body: 'SmartHunt agrège toutes les remises disponibles — promotions en caisse, Shopmium, Quoty, Coupon Network — et vous donne le prix réel en un coup d\'œil.',
  },
  {
    key: 's3', icon: Bell, accent: Colors.gold, badge: 'RAPPELS AUTOMATIQUES',
    title: 'Plus jamais un\ncashback oublié',
    subtitle: 'Scannez votre ticket, SmartHunt fait le reste.',
    body: 'Notre IA lit votre ticket de caisse, identifie vos achats et active automatiquement vos remboursements. Rappels push avant expiration inclus.',
  },
  {
    key: 's4', icon: Rocket, accent: Colors.neonGreen, badge: 'C\'EST PARTI',
    title: 'Prêt à\nchasser ?',
    subtitle: 'Votre première économie vous attend.',
    body: 'Parcourez le catalogue, composez votre panier intelligent, comparez les stratégies d\'achat. Économisez en toute transparence, sans effort.',
  },
];

// ─── Bouton permission notifications (slide 3) ───────────────────────────────
function NotifPermButton({ status, onPress }: { status: NotifStatus; onPress: () => void }) {
  if (status === 'granted') {
    return (
      <View style={nb.success}>
        <CheckCircle size={18} color={Colors.neonGreen} strokeWidth={2} />
        <Text style={nb.successText}>Rappels activés — merci ✓</Text>
      </View>
    );
  }
  if (status === 'denied') {
    return (
      <View style={nb.denied}>
        <Info size={15} color={Colors.textMuted} strokeWidth={2} />
        <Text style={nb.deniedText}>Vous pourrez les activer dans les Réglages.</Text>
      </View>
    );
  }
  return (
    <TouchableOpacity style={nb.btn} onPress={onPress} activeOpacity={0.85}>
      <Bell size={18} color={Colors.gold} strokeWidth={2} />
      <Text style={nb.btnText}>Activer les rappels</Text>
    </TouchableOpacity>
  );
}

const nb = StyleSheet.create({
  btn: {
    flexDirection: 'row', alignItems: 'center', gap: Spacing.sm,
    borderWidth: 1.5, borderColor: Colors.gold, borderRadius: Radius.lg,
    paddingHorizontal: Spacing.lg, paddingVertical: 12,
    marginTop: Spacing.xl, alignSelf: 'center',
  },
  btnText:     { ...Typography.bodyBold, color: Colors.gold },
  success:     { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, marginTop: Spacing.xl, alignSelf: 'center' },
  successText: { ...Typography.bodyBold, color: Colors.neonGreen },
  denied:      { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: Spacing.xl, alignSelf: 'center', paddingHorizontal: Spacing.lg },
  deniedText:  { ...Typography.small, color: Colors.textMuted, textAlign: 'center', flex: 1 },
});

// ─── Composant slide ─────────────────────────────────────────────────────────
function SlideView({ slide, children }: { slide: Slide; children?: React.ReactNode }) {
  return (
    <View style={sld.root}>
      <View style={sld.emojiWrap}>
        <View style={[sld.emojiRing, { borderColor: slide.accent + '30' }]}>
          <View style={[sld.emojiInner, { backgroundColor: slide.accent + '18' }]}>
            <slide.icon size={64} color={slide.accent} strokeWidth={1.5} />
          </View>
        </View>
      </View>
      <View style={[sld.badge, { borderColor: slide.accent + '50', backgroundColor: slide.accent + '12' }]}>
        <Text style={[sld.badgeText, { color: slide.accent }]}>{slide.badge}</Text>
      </View>
      <Text style={sld.title}>{slide.title}</Text>
      <Text style={[sld.subtitle, { color: slide.accent }]}>{slide.subtitle}</Text>
      <Text style={sld.body}>{slide.body}</Text>
      {children}
    </View>
  );
}

const sld = StyleSheet.create({
  root:      { flex: 1, alignItems: 'center', paddingHorizontal: Spacing.xl + 4, paddingTop: Spacing.xl },
  emojiWrap: { marginBottom: Spacing.xl, alignItems: 'center', justifyContent: 'center' },
  emojiRing: { width: 180, height: 180, borderRadius: 90, borderWidth: 1.5, alignItems: 'center', justifyContent: 'center' },
  emojiInner:{ width: 140, height: 140, borderRadius: 70, alignItems: 'center', justifyContent: 'center' },
  badge:     { borderRadius: Radius.full, borderWidth: 1, paddingHorizontal: 12, paddingVertical: 4, marginBottom: Spacing.lg },
  badgeText: { fontSize: 10, fontWeight: '800', letterSpacing: 1.5 },
  title:     { fontSize: 34, fontWeight: '900', color: Colors.white, textAlign: 'center', letterSpacing: -0.8, lineHeight: 40, marginBottom: Spacing.md },
  subtitle:  { fontSize: 15, fontWeight: '600', textAlign: 'center', marginBottom: Spacing.lg },
  body:      { ...Typography.body, color: Colors.textSecondary, textAlign: 'center', lineHeight: 24 },
});

// ─── Slide personnalisation ──────────────────────────────────────────────────
function PersonalizationSlide({
  name, goal, onNameChange, onGoalChange,
}: {
  name: string;
  goal: number;
  onNameChange: (v: string) => void;
  onGoalChange: (v: number) => void;
}) {
  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <View style={ps.root}>
        {/* Icône */}
        <View style={ps.emojiWrap}>
          <View style={ps.emojiRing}>
            <View style={ps.emojiInner} />
          </View>
        </View>

        {/* Badge + titres */}
        <View style={ps.badge}>
          <Text style={ps.badgeText}>PRESQUE PRÊT</Text>
        </View>
        <Text style={ps.title}>Personnalisez{'\n'}votre expérience</Text>
        <Text style={ps.subtitle}>Deux petites questions, et c'est parti.</Text>

        {/* Champ prénom */}
        <View style={ps.field}>
          <Text style={ps.fieldLabel}>Votre prénom</Text>
          <View style={ps.inputWrap}>
            <User size={16} color={Colors.textMuted} strokeWidth={2} />
            <TextInput
              style={ps.input}
              value={name}
              onChangeText={onNameChange}
              placeholder="Ex : François"
              placeholderTextColor={Colors.textMuted}
              autoFocus
              autoCorrect={false}
              returnKeyType="done"
              maxLength={30}
            />
          </View>
        </View>

        {/* Objectif mensuel */}
        <View style={ps.field}>
          <Text style={ps.fieldLabel}>Objectif d'économies mensuel</Text>
          <View style={ps.presets}>
            {GOAL_PRESETS.map(g => (
              <TouchableOpacity
                key={g}
                style={[ps.preset, goal === g && ps.presetActive]}
                onPress={() => onGoalChange(g)}
                activeOpacity={0.8}
              >
                <Text style={[ps.presetText, goal === g && ps.presetTextActive]}>
                  {g} €
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}

const ps = StyleSheet.create({
  root:          { flex: 1, alignItems: 'center', paddingHorizontal: Spacing.xl + 4, paddingTop: Spacing.xl },
  emojiWrap:     { marginBottom: Spacing.lg, alignItems: 'center' },
  emojiRing:     { width: 140, height: 140, borderRadius: 70, borderWidth: 1.5, borderColor: Colors.neonGreen + '30', alignItems: 'center', justifyContent: 'center' },
  emojiInner:    { width: 108, height: 108, borderRadius: 54, backgroundColor: Colors.neonGreen + '15', alignItems: 'center', justifyContent: 'center' },
  badge:         { borderRadius: Radius.full, borderWidth: 1, borderColor: Colors.neonGreen + '50', backgroundColor: Colors.neonGreen + '12', paddingHorizontal: 12, paddingVertical: 4, marginBottom: Spacing.md },
  badgeText:     { fontSize: 10, fontWeight: '800', letterSpacing: 1.5, color: Colors.neonGreen },
  title:         { fontSize: 28, fontWeight: '900', color: Colors.white, textAlign: 'center', letterSpacing: -0.5, lineHeight: 34, marginBottom: Spacing.sm },
  subtitle:      { ...Typography.body, color: Colors.textSecondary, textAlign: 'center', marginBottom: Spacing.xl },
  field:         { alignSelf: 'stretch', marginBottom: Spacing.lg },
  fieldLabel:    { ...Typography.smallBold, color: Colors.textSecondary, marginBottom: Spacing.sm, textTransform: 'uppercase', letterSpacing: 0.5 },
  inputWrap:     { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, backgroundColor: Colors.card, borderRadius: Radius.md, borderWidth: 1.5, borderColor: Colors.neonGreen + '40', paddingHorizontal: Spacing.md, paddingVertical: 14 },
  input:         { flex: 1, fontSize: 16, fontWeight: '600', color: Colors.white },
  presets:       { flexDirection: 'row', gap: Spacing.sm },
  preset:        { flex: 1, alignItems: 'center', paddingVertical: 14, borderRadius: Radius.md, borderWidth: 1.5, borderColor: Colors.cardBorder, backgroundColor: Colors.card },
  presetActive:  { borderColor: Colors.neonGreen, backgroundColor: Colors.neonGreen + '18' },
  presetText:    { fontSize: 15, fontWeight: '700', color: Colors.textSecondary },
  presetTextActive: { color: Colors.neonGreen },
});

// ─── Étape Shopmium ──────────────────────────────────────────────────────────
function ShopmiumSetup({ onChoice }: { onChoice: (choice: 'yes' | 'download' | 'skip') => void }) {
  return (
    <View style={sh.root}>
      <View style={sh.iconRing}>
        <View style={sh.iconInner}>
          <Text style={sh.iconEmoji}>📱</Text>
        </View>
      </View>
      <View style={sh.badge}>
        <Text style={sh.badgeText}>OPTIONNEL</Text>
      </View>
      <Text style={sh.title}>Une dernière{'\n'}chose…</Text>
      <Text style={sh.subtitle}>Avez-vous l'application Shopmium ?</Text>
      <Text style={sh.body}>
        Shopmium est notre partenaire principal pour les cashbacks ODR.
        La connecter maintenant vous fera gagner du temps sur vos premiers achats.
      </Text>
      <View style={sh.btns}>
        <TouchableOpacity style={[sh.btn, sh.btnYes]} onPress={() => onChoice('yes')} activeOpacity={0.85}>
          <CheckCircle size={20} color={Colors.background} strokeWidth={2} />
          <Text style={sh.btnYesText}>Oui, j'ai déjà Shopmium</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[sh.btn, sh.btnDownload]} onPress={() => onChoice('download')} activeOpacity={0.85}>
          <Download size={20} color={Colors.electricBlue} strokeWidth={2} />
          <Text style={sh.btnDownloadText}>Je la télécharge maintenant</Text>
        </TouchableOpacity>
        <TouchableOpacity style={sh.btnSkip} onPress={() => onChoice('skip')} activeOpacity={0.6}>
          <Text style={sh.btnSkipText}>Peut-être plus tard</Text>
          <ArrowRight size={13} color={Colors.textMuted} strokeWidth={2} />
        </TouchableOpacity>
      </View>
    </View>
  );
}

const sh = StyleSheet.create({
  root:            { flex: 1, alignItems: 'center', paddingHorizontal: Spacing.xl + 4, paddingTop: Spacing.xl },
  iconRing:        { width: 160, height: 160, borderRadius: 80, borderWidth: 1.5, borderColor: Colors.neonGreen + '30', alignItems: 'center', justifyContent: 'center', marginBottom: Spacing.xl },
  iconInner:       { width: 124, height: 124, borderRadius: 62, backgroundColor: Colors.neonGreen + '18', alignItems: 'center', justifyContent: 'center' },
  iconEmoji:       { fontSize: 64 },
  badge:           { borderRadius: Radius.full, borderWidth: 1, borderColor: Colors.neonGreen + '50', backgroundColor: Colors.neonGreen + '12', paddingHorizontal: 12, paddingVertical: 4, marginBottom: Spacing.lg },
  badgeText:       { fontSize: 10, fontWeight: '800', letterSpacing: 1.5, color: Colors.neonGreen },
  title:           { fontSize: 34, fontWeight: '900', color: Colors.white, textAlign: 'center', letterSpacing: -0.8, lineHeight: 40, marginBottom: Spacing.md },
  subtitle:        { fontSize: 15, fontWeight: '600', color: Colors.neonGreen, textAlign: 'center', marginBottom: Spacing.lg },
  body:            { ...Typography.body, color: Colors.textSecondary, textAlign: 'center', lineHeight: 24, marginBottom: Spacing.xl },
  btns:            { alignSelf: 'stretch', gap: Spacing.md },
  btn:             { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: Spacing.sm, borderRadius: Radius.lg, paddingVertical: 16 },
  btnYes:          { backgroundColor: Colors.neonGreen },
  btnYesText:      { fontSize: 16, fontWeight: '800', color: Colors.background },
  btnDownload:     { borderWidth: 1.5, borderColor: Colors.electricBlue, backgroundColor: Colors.electricBlue + '10' },
  btnDownloadText: { fontSize: 15, fontWeight: '600', color: Colors.electricBlue },
  btnSkip:         { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4, paddingVertical: Spacing.sm },
  btnSkipText:     { ...Typography.small, color: Colors.textMuted },
});

// ─── Écran principal ─────────────────────────────────────────────────────────
export default function OnboardingScreen() {
  const router         = useRouter();
  const setHasShopmium = useSmartHuntStore(s => s.setHasShopmium);
  const setUserName    = useSmartHuntStore(s => s.setUserName);
  const setMonthlyGoal = useSmartHuntStore(s => s.setMonthlyGoal);

  const { width } = useWindowDimensions();
  const scrollRef = useRef<ScrollView>(null);

  const [current,     setCurrent]     = useState(0);
  const [phase,       setPhase]       = useState<Phase>('slides');
  const [notifStatus, setNotifStatus] = useState<NotifStatus>('idle');
  const [userName,    setUserNameLocal]    = useState('');
  const [monthlyGoal, setMonthlyGoalLocal] = useState(100);
  const opacity = useRef(new Animated.Value(1)).current;

  const isLast = current === SLIDES.length - 1;
  const accent = SLIDES[current].accent;

  // ── Transition fade — utilisée uniquement pour les changements de phase ──────
  const fadeTransition = (callback: () => void) => {
    Animated.timing(opacity, { toValue: 0, duration: 160, useNativeDriver: true })
      .start(() => {
        callback();
        Animated.timing(opacity, { toValue: 1, duration: 220, useNativeDriver: true }).start();
      });
  };

  // ── Navigation slides — scroll natif ─────────────────────────────────────────
  const goTo = (idx: number) => {
    scrollRef.current?.scrollTo({ x: idx * width, animated: true });
    setCurrent(idx); // mise à jour optimiste (onMomentumScrollEnd confirme pour le swipe)
  };

  const handleScrollEnd = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const newIndex = Math.round(e.nativeEvent.contentOffset.x / width);
    setCurrent(newIndex);
  };

  const goToPersonalize  = () => fadeTransition(() => setPhase('personalization'));
  const goToShopmium     = () => fadeTransition(() => setPhase('shopmium'));

  const complete = async () => {
    await AsyncStorage.setItem(ONBOARDED_KEY, '1');
    router.replace('/(tabs)');
  };

  // ── Notifications (slide 3) ───────────────────────────────
  const handleNotifRequest = async () => {
    const granted = await requestPermissionIfNeeded();
    setNotifStatus(granted ? 'granted' : 'denied');
    setTimeout(() => goTo(current + 1), 900);
  };

  // ── Navigation slides ─────────────────────────────────────
  const next = () => { isLast ? goToPersonalize() : goTo(current + 1); };
  const skip = () => goTo(SLIDES.length - 1);

  // ── Validation personnalisation → Shopmium ────────────────
  const handlePersonalizationNext = () => {
    if (userName.trim()) setUserName(userName.trim());
    setMonthlyGoal(monthlyGoal);
    goToShopmium();
  };

  // ── Choix Shopmium → complete ─────────────────────────────
  const handleShopmiumChoice = async (choice: 'yes' | 'download' | 'skip') => {
    if (choice === 'yes') {
      setHasShopmium(true);
    } else if (choice === 'download') {
      Linking.openURL(SHOPMIUM_URL).catch(() => {});
    }
    await complete();
  };

  return (
    <SafeAreaView style={s.root} edges={['top', 'bottom']}>

      {/* Bouton Passer — masqué sur le dernier slide et hors phase slides */}
      {!isLast && phase === 'slides' && (
        <TouchableOpacity style={s.skipBtn} onPress={skip} activeOpacity={0.7}>
          <Text style={s.skipText}>Passer</Text>
        </TouchableOpacity>
      )}

      {/* Contenu avec transition fade pour les changements de phase */}
      <Animated.View style={[{ flex: 1 }, { opacity }]}>

        {/* ── Slides : ScrollView horizontal natif ── */}
        {phase === 'slides' && (
          <ScrollView
            ref={scrollRef}
            horizontal
            pagingEnabled
            showsHorizontalScrollIndicator={false}
            scrollEventThrottle={16}
            onMomentumScrollEnd={handleScrollEnd}
            style={{ flex: 1 }}
            contentContainerStyle={{ alignItems: 'stretch' }}
          >
            {SLIDES.map((slide, idx) => (
              <View key={slide.key} style={{ width, flex: 1 }}>
                <SlideView slide={slide}>
                  {idx === 2 && (
                    <NotifPermButton status={notifStatus} onPress={handleNotifRequest} />
                  )}
                </SlideView>
              </View>
            ))}
          </ScrollView>
        )}

        {phase === 'personalization' && (
          <PersonalizationSlide
            name={userName}
            goal={monthlyGoal}
            onNameChange={setUserNameLocal}
            onGoalChange={setMonthlyGoalLocal}
          />
        )}
        {phase === 'shopmium' && (
          <ShopmiumSetup onChoice={handleShopmiumChoice} />
        )}
      </Animated.View>

      {/* Footer slides — dots + CTA */}
      {phase === 'slides' && (
        <View style={s.footer}>
          {/* Dots — tapables pour navigation directe */}
          <View style={s.dots}>
            {SLIDES.map((_, i) => (
              <TouchableOpacity
                key={i}
                onPress={() => goTo(i)}
                activeOpacity={0.7}
                hitSlop={{ top: 8, bottom: 8, left: 6, right: 6 }}
              >
                <View
                  style={[
                    s.dot,
                    i === current
                      ? [s.dotActive, { backgroundColor: accent, width: 24 }]
                      : s.dotInactive,
                  ]}
                />
              </TouchableOpacity>
            ))}
          </View>
          <TouchableOpacity
            style={[s.cta, { backgroundColor: accent, shadowColor: accent }]}
            onPress={next}
            activeOpacity={0.85}
          >
            {isLast ? (
              <>
                <User size={22} color={Colors.background} strokeWidth={2} />
                <Text style={s.ctaText}>Personnaliser</Text>
              </>
            ) : (
              <>
                <Text style={s.ctaText}>Suivant</Text>
                <ArrowRight size={20} color={Colors.background} strokeWidth={2} />
              </>
            )}
          </TouchableOpacity>
          {/* Hint swipe — visible uniquement sur slide 1 */}
          {current === 0 && (
            <View style={s.swipeHint}>
              <MousePointer2 size={13} color={Colors.textMuted} strokeWidth={2} />
              <Text style={s.swipeHintText}>Glissez pour naviguer</Text>
            </View>
          )}
        </View>
      )}

      {/* Footer personnalisation — CTA + Passer */}
      {phase === 'personalization' && (
        <View style={s.footer}>
          <TouchableOpacity
            style={[s.cta, {
              backgroundColor: userName.trim().length >= 2 ? Colors.neonGreen : Colors.card,
              shadowColor: Colors.neonGreen,
              opacity: userName.trim().length >= 2 ? 1 : 0.5,
            }]}
            onPress={handlePersonalizationNext}
            activeOpacity={0.85}
            disabled={userName.trim().length < 2}
          >
            <Text style={[s.ctaText, { color: userName.trim().length >= 2 ? Colors.background : Colors.textMuted }]}>
              Continuer
            </Text>
            <ArrowRight size={20} color={userName.trim().length >= 2 ? Colors.background : Colors.textMuted} strokeWidth={2} />
          </TouchableOpacity>
          <TouchableOpacity style={s.backBtn} onPress={goToShopmium}>
            <Text style={s.backText}>Passer cette étape</Text>
          </TouchableOpacity>
        </View>
      )}

    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.background },
  skipBtn: {
    position: 'absolute', top: Platform.OS === 'ios' ? 54 : 20, right: Spacing.lg, zIndex: 10,
    paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm,
    borderRadius: Radius.full, backgroundColor: Colors.card, borderWidth: 1, borderColor: Colors.cardBorder,
  },
  skipText:    { ...Typography.smallBold, color: Colors.textSecondary },
  footer:      { paddingHorizontal: Spacing.xl, paddingBottom: Spacing.xl, gap: Spacing.md, alignItems: 'center' },
  dots:        { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: Spacing.sm },
  dot:         { height: 6, borderRadius: 3 },
  dotActive:   { height: 6, borderRadius: 3 },
  dotInactive: { width: 6, backgroundColor: Colors.cardBorder },
  cta: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: Spacing.sm, borderRadius: Radius.xl, paddingVertical: 18, alignSelf: 'stretch',
    shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.35, shadowRadius: 14, elevation: 8,
  },
  ctaText:      { fontSize: 18, fontWeight: '800', color: Colors.background },
  backBtn:      { flexDirection: 'row', alignItems: 'center', gap: 4, paddingVertical: Spacing.sm },
  backText:     { ...Typography.small, color: Colors.textMuted },
  swipeHint:    { flexDirection: 'row', alignItems: 'center', gap: 5 },
  swipeHintText:{ ...Typography.small, color: Colors.textMuted },
});
