import React from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
  type ViewStyle,
} from 'react-native';
import { colors, radii, spacing } from '../theme/tokens';

export function Screen({
  children,
  style,
}: {
  children: React.ReactNode;
  style?: ViewStyle;
}) {
  return <View style={[styles.screen, style]}>{children}</View>;
}

export function BrandMark() {
  return (
    <View style={styles.brandRow}>
      <View style={styles.brandDot} />
      <Text style={styles.brand}>Wanderweird</Text>
    </View>
  );
}

export function Title({ children }: { children: React.ReactNode }) {
  return <Text style={styles.title}>{children}</Text>;
}

export function Subtitle({ children }: { children: React.ReactNode }) {
  return <Text style={styles.subtitle}>{children}</Text>;
}

export function Button({
  label,
  onPress,
  variant = 'primary',
  disabled,
  testID,
}: {
  label: string;
  onPress: () => void;
  variant?: 'primary' | 'ghost' | 'coral';
  disabled?: boolean;
  testID?: string;
}) {
  return (
    <Pressable
      testID={testID}
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) => [
        styles.button,
        variant === 'ghost' && styles.buttonGhost,
        variant === 'coral' && styles.buttonCoral,
        (pressed || disabled) && { opacity: 0.7 },
      ]}
    >
      <Text
        style={[
          styles.buttonLabel,
          variant === 'ghost' && styles.buttonLabelGhost,
        ]}
      >
        {label}
      </Text>
    </Pressable>
  );
}

export function LoadingBlock({ label = 'Loading…' }: { label?: string }) {
  return (
    <View style={styles.loading}>
      <ActivityIndicator color={colors.seafoam} />
      <Text style={styles.loadingLabel}>{label}</Text>
    </View>
  );
}

export function Chip({ label, tone = 'mist' }: { label: string; tone?: 'mist' | 'seafoam' | 'coral' | 'amber' }) {
  const background =
    tone === 'seafoam'
      ? 'rgba(61,220,151,0.18)'
      : tone === 'coral'
        ? 'rgba(255,92,77,0.18)'
        : tone === 'amber'
          ? 'rgba(240,180,41,0.18)'
          : 'rgba(255,255,255,0.08)';
  const color =
    tone === 'seafoam'
      ? colors.seafoam
      : tone === 'coral'
        ? colors.coral
        : tone === 'amber'
          ? colors.amber
          : colors.foam;

  return (
    <View style={[styles.chip, { backgroundColor: background }]}>
      <Text style={[styles.chipLabel, { color }]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.ink,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
  },
  brandRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  brandDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: colors.coral,
  },
  brand: {
    fontFamily: 'Syne_700Bold',
    fontSize: 18,
    color: colors.foam,
    letterSpacing: 0.4,
  },
  title: {
    fontFamily: 'Syne_700Bold',
    fontSize: 34,
    lineHeight: 38,
    color: colors.white,
    marginBottom: spacing.sm,
  },
  subtitle: {
    fontFamily: 'DMSans_400Regular',
    fontSize: 16,
    lineHeight: 24,
    color: colors.slate,
    marginBottom: spacing.lg,
  },
  button: {
    backgroundColor: colors.seafoam,
    borderRadius: radii.md,
    paddingVertical: 14,
    paddingHorizontal: spacing.lg,
    alignItems: 'center',
  },
  buttonGhost: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: 'rgba(232,244,242,0.22)',
  },
  buttonCoral: {
    backgroundColor: colors.coral,
  },
  buttonLabel: {
    fontFamily: 'DMSans_700Bold',
    fontSize: 16,
    color: colors.ink,
  },
  buttonLabelGhost: {
    color: colors.foam,
  },
  loading: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
  },
  loadingLabel: {
    fontFamily: 'DMSans_400Regular',
    color: colors.slate,
  },
  chip: {
    alignSelf: 'flex-start',
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  chipLabel: {
    fontFamily: 'DMSans_500Medium',
    fontSize: 12,
  },
});
