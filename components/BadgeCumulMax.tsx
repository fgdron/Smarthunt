import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Colors, Radius, Typography } from '@/constants/theme';

interface Props {
  label?: string;
  variant?: 'cumulmax' | 'promo' | 'urgent' | 'free';
}

const VARIANTS = {
  cumulmax: { bg: Colors.neonGreen, text: Colors.background, label: 'CUMUL MAX' },
  promo: { bg: Colors.electricBlue, text: Colors.white, label: 'PROMO' },
  urgent: { bg: Colors.orange, text: Colors.white, label: 'EXPIRE BIENTÔT' },
  free: { bg: Colors.gold, text: Colors.background, label: 'PRESQUE GRATUIT' },
};

export default function BadgeCumulMax({ label, variant = 'cumulmax' }: Props) {
  const v = VARIANTS[variant];
  return (
    <View style={[styles.badge, { backgroundColor: v.bg }]}>
      <Text style={[styles.label, { color: v.text }]}>{label || v.label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: Radius.sm,
    alignSelf: 'flex-start',
  },
  label: {
    ...Typography.tiny,
    letterSpacing: 0.5,
  },
});
