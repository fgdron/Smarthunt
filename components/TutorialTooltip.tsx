import React, { useEffect, useRef } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Animated } from 'react-native';
import { Check, LucideIcon } from 'lucide-react-native';
import { Colors, Spacing, Radius, Typography } from '@/constants/theme';

interface Props {
  visible: boolean;
  icon: LucideIcon;
  title: string;
  body: string;
  onDismiss: () => void;
}

export default function TutorialTooltip({ visible, icon: Icon, title, body, onDismiss }: Props) {
  const opacity    = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(16)).current;

  useEffect(() => {
    if (visible) {
      Animated.parallel([
        Animated.timing(opacity,    { toValue: 1, duration: 280, useNativeDriver: true }),
        Animated.timing(translateY, { toValue: 0, duration: 280, useNativeDriver: true }),
      ]).start();
    } else {
      Animated.parallel([
        Animated.timing(opacity,    { toValue: 0, duration: 180, useNativeDriver: true }),
        Animated.timing(translateY, { toValue: 16, duration: 180, useNativeDriver: true }),
      ]).start();
    }
  }, [visible, opacity, translateY]);

  if (!visible) return null;

  return (
    <Animated.View style={[styles.overlay, { opacity }]}>
      <Animated.View style={[styles.card, { transform: [{ translateY }] }]}>

        {/* Icône */}
        <View style={styles.iconWrap}>
          <Icon size={26} color={Colors.electricBlue} strokeWidth={2} />
        </View>

        {/* Textes */}
        <Text style={styles.title}>{title}</Text>
        <Text style={styles.body}>{body}</Text>

        {/* CTA */}
        <TouchableOpacity style={styles.cta} onPress={onDismiss} activeOpacity={0.85}>
          <Check size={16} color={Colors.background} strokeWidth={2} />
          <Text style={styles.ctaText}>J'ai compris</Text>
        </TouchableOpacity>

      </Animated.View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.72)',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 100,
    paddingHorizontal: Spacing.xl,
  },
  card: {
    backgroundColor: Colors.surface,
    borderRadius: Radius.xl,
    borderWidth: 1,
    borderColor: Colors.electricBlue + '40',
    padding: Spacing.xl,
    alignItems: 'center',
    width: '100%',
  },
  iconWrap: {
    width: 56, height: 56, borderRadius: 28,
    backgroundColor: Colors.electricBlue + '18',
    alignItems: 'center', justifyContent: 'center',
    marginBottom: Spacing.lg,
  },
  title: {
    ...Typography.h3,
    color: Colors.white,
    textAlign: 'center',
    marginBottom: Spacing.md,
  },
  body: {
    ...Typography.body,
    color: Colors.textSecondary,
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: Spacing.xl,
  },
  cta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    backgroundColor: Colors.electricBlue,
    borderRadius: Radius.lg,
    paddingVertical: 12,
    paddingHorizontal: Spacing.xl,
  },
  ctaText: { ...Typography.bodyBold, color: Colors.background },
});
