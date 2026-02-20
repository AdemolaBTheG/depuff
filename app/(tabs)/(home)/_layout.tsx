import { Theme } from '@/constants/Theme';
import { isLiquidGlassAvailable } from 'expo-glass-effect';
import { Stack, useRouter } from 'expo-router';
import React from 'react';
import { Platform, PlatformColor } from 'react-native';

export default function HomeLayout() {
  const router = useRouter();
 const groupedBackgroundColor =
  Platform.OS === 'ios' ? PlatformColor('systemGroupedBackground') : '#F2F2F7';
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
          title: 'Home',
          unstable_headerLeftItems: () => [
            {
              type: 'button',
              label: 'Settings',
              icon: { type: 'sfSymbol', name: 'gearshape' },
              
              onPress: () => router.push('/(settings)' as never),
            },
          ],
          unstable_headerRightItems: () => [
            {
              type: 'button',
              label: 'Scan',
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
