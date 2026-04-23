import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

interface Props {
  lastVerified: number;  // timestamp ms
}

export function ReliabilityBadge({ lastVerified }: Props) {
  const minutesAgo = Math.floor((Date.now() - lastVerified) / 60000);

  let color: string;
  let label: string;

  if (minutesAgo < 15) {
    color = '#22C55E';
    label = `Prix vérifiés il y a ${minutesAgo} min`;
  } else if (minutesAgo < 60) {
    color = '#F59E0B';
    label = `Prix vérifiés il y a ${minutesAgo} min`;
  } else {
    const h = Math.floor(minutesAgo / 60);
    color = '#EF4444';
    label = `Prix vérifiés il y a ${h}h`;
  }

  return (
    <View style={[styles.badge, { borderColor: color }]}>
      <View style={[styles.dot, { backgroundColor: color }]} />
      <Text style={[styles.text, { color }]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 10,
    borderWidth: 1,
  },
  dot: {
    width: 5,
    height: 5,
    borderRadius: 3,
  },
  text: {
    fontSize: 10,
    fontWeight: '500',
  },
});
