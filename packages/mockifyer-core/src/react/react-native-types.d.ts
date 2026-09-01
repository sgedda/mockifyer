/**
 * Minimal React Native types for compiling `.native.tsx` without a full RN install.
 * Runtime uses the app's `react-native` peer dependency.
 */
declare module 'react-native' {
  import type { ComponentType, ReactNode } from 'react';

  export interface ViewProps {
    style?: unknown;
    children?: ReactNode;
  }

  export interface TextProps {
    style?: unknown;
    children?: ReactNode;
  }

  export interface ScrollViewProps {
    style?: unknown;
    contentContainerStyle?: unknown;
    children?: ReactNode;
  }

  export interface PressableProps {
    style?: unknown;
    onPress?: () => void;
    accessibilityRole?: string;
    children?: ReactNode;
  }

  export const View: ComponentType<ViewProps>;
  export const Text: ComponentType<TextProps>;
  export const ScrollView: ComponentType<ScrollViewProps>;
  export const Pressable: ComponentType<PressableProps>;

  export const StyleSheet: {
    create<T extends Record<string, unknown>>(styles: T): T;
  };
}
