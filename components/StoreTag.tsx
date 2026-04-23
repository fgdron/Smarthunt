import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Colors, Radius, Typography } from '@/constants/theme';

const STORE_COLORS: Record<string, string> = {
  Leclerc: '#0055A4',
  Carrefour: '#004B98',
  Intermarché: '#E20613',
};

interface Props {
  name: string;
}

export default function StoreTag({ name }: Props) {
  const color = STORE_COLORS[name] || Colors.electricBlue;
  return (
    <View style={[styles.tag, { borderColor: color }]}>
      <Text style={[styles.name, { color }]}>{name}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  tag: {
    borderWidth: 1,
    borderRadius: Radius.sm,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  name: {
    ...Typography.tiny,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
});
