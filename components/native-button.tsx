import { Theme } from '@/constants/Theme';
import { Host as AndroidHost, Button as AndroidNativeButton } from '@expo/ui/jetpack-compose';
import { Host as IOSHost, Button as IOSNativeButton } from '@expo/ui/swift-ui';
import React from 'react';
import { Pressable, StyleSheet, Text } from 'react-native';
import type { SFSymbol } from 'sf-symbols-typescript';

type NativeButtonRole = 'default' | 'cancel' | 'destructive';
type NativeButtonKind = 'primary' | 'secondary';

type Props = {
  label: string;
  onPress?: () => void;
  disabled?: boolean;
  role?: NativeButtonRole;
  kind?: NativeButtonKind;
  systemImage?: SFSymbol;
};

export function NativeButton({
  label,
  onPress,
  disabled = false,
  role = 'default',
  kind = 'primary',
  systemImage,
}: Props) {
  if (process.env.EXPO_OS === 'ios') {
    return (
      <IOSHost style={styles.nativeHost}>
        <IOSNativeButton
          label={label}
          role={role}
          systemImage={systemImage}
          onPress={disabled ? undefined : onPress}
        />
      </IOSHost>
    );
  }

  if (process.env.EXPO_OS === 'android') {
    const variant = kind === 'secondary' || role === 'cancel' ? 'borderless' : 'default';
    return (
      <AndroidHost style={styles.nativeHost}>
        <AndroidNativeButton onPress={onPress} disabled={disabled} variant={variant}>
          {label}
        </AndroidNativeButton>
      </AndroidHost>
    );
  }

  return (
    <Pressable
      disabled={disabled}
      onPress={onPress}
      style={[
        styles.fallbackButton,
        kind === 'secondary' || role === 'cancel' ? styles.secondaryButton : styles.primaryButton,
        role === 'destructive' ? styles.destructiveButton : null,
        disabled ? styles.disabledButton : null,
      ]}
    >
      <Text
        style={[
          styles.fallbackLabel,
          kind === 'secondary' || role === 'cancel' ? styles.secondaryLabel : styles.primaryLabel,
        ]}
      >
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  nativeHost: {
    width: '100%',
  },
  fallbackButton: {
    minHeight: 44,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderWidth: 1,
  },
  primaryButton: {
    backgroundColor: Theme.colors.accent,
    borderColor: Theme.colors.accent,
  },
  secondaryButton: {
    backgroundColor: Theme.colors.glass1,
    borderColor: Theme.colors.border,
  },
  destructiveButton: {
    backgroundColor: Theme.colors.danger,
    borderColor: Theme.colors.danger,
  },
  disabledButton: {
    opacity: 0.6,
  },
  fallbackLabel: {
    fontSize: 15,
    fontWeight: '700',
  },
  primaryLabel: {
    color: Theme.colors.foundation,
  },
  secondaryLabel: {
    color: Theme.colors.textPrimary,
  },
});
