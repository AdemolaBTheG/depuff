import { Theme } from '@/constants/Theme';
import { useSubscription } from '@/context/SubscriptionContext';
import { isLiquidGlassAvailable } from 'expo-glass-effect';
import { Stack, useRouter } from 'expo-router';
import React from 'react';
import { useTranslation } from 'react-i18next';
import { PlatformColor } from 'react-native';

export default function HomeLayout() {
  const router = useRouter();
  const { t } = useTranslation();
  const { isPro } = useSubscription();
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
          unstable_headerRightItems: () => {
            const items: any[] = [
              {
                type: 'button',
                variant:'prominent',
                label: t('scan.title', { defaultValue: 'Scan' }),
                icon: { type: 'sfSymbol', name: 'camera' },
                tintColor: Theme.colors.accent,
                sharesBackground: false,
                onPress: () => router.push('/(scan)' as never),
              },
            ];
            
            if (!isPro) {
              items.unshift({
                type: 'button',
                variant:'prominent',
                label: t('paywall.pro', { defaultValue: 'PRO' }),
                icon: { type: 'sfSymbol', name: 'sparkles' },
                tintColor: '#F59E0B',
                sharesBackground: false,
                onPress: () => router.push('/(paywalls)' as never),
              });
            }
            
            return items;
          },
        }}
      />
    </Stack>
  );
}
