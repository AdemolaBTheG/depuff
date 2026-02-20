import { Theme } from '@/constants/Theme';
import { isLiquidGlassAvailable } from 'expo-glass-effect';
import { Stack, useRouter } from 'expo-router';
import React from 'react';
import { PlatformColor } from 'react-native';
import { useTranslation } from 'react-i18next';

export default function HomeLayout() {
  const router = useRouter();
  const { t } = useTranslation();
  return (
    <Stack>
      <Stack.Screen
        name="index"
        options={{
          headerTransparent: isLiquidGlassAvailable(),
          headerStyle: {
            backgroundColor: isLiquidGlassAvailable() ? 'transparent' : '#F2F2F7',
          },
          headerShown: true,
          contentStyle: {
            backgroundColor: PlatformColor('systemGroupedBackground'),
          },
          title: t('home.title', { defaultValue: 'Home' }),
          unstable_headerLeftItems: () => [
            {
              type: 'button',
              label: t('settings.title', { defaultValue: 'Settings' }),
              icon: { type: 'sfSymbol', name: 'gearshape' },
              
              onPress: () => router.push('/(settings)' as never),
            },
          ],
          unstable_headerRightItems: () => [
            {
              type: 'button',
              label: t('scan.title', { defaultValue: 'Scan' }),
              icon: { type: 'sfSymbol', name: 'camera' },
              tintColor: Theme.colors.accent,
              onPress: () => router.push('/(scan)' as never),
            },
          ],
        }}
      />
    </Stack>
  );
}
