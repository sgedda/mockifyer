import React from 'react';
import { StyleSheet, View } from 'react-native';
import { colors } from '../theme/tokens';

/**
 * Soft layered atmosphere without depending on expo-linear-gradient.
 * Keeps the first viewport feeling like one composition.
 */
export function LinearGradientish({ children }: { children: React.ReactNode }) {
  return (
    <View style={styles.root}>
      <View style={styles.blobTop} />
      <View style={styles.blobSide} />
      <View style={styles.blobBottom} />
      <View style={styles.content}>{children}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.ink,
    overflow: 'hidden',
  },
  blobTop: {
    position: 'absolute',
    top: -80,
    left: -40,
    width: 280,
    height: 280,
    borderRadius: 140,
    backgroundColor: 'rgba(61,220,151,0.16)',
  },
  blobSide: {
    position: 'absolute',
    top: 180,
    right: -100,
    width: 260,
    height: 260,
    borderRadius: 130,
    backgroundColor: 'rgba(255,92,77,0.14)',
  },
  blobBottom: {
    position: 'absolute',
    bottom: -60,
    left: 40,
    width: 220,
    height: 220,
    borderRadius: 110,
    backgroundColor: 'rgba(240,180,41,0.1)',
  },
  content: {
    flex: 1,
  },
});
