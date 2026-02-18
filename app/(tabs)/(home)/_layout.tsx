import { Theme } from '@/constants/Theme';
import { Stack, useRouter } from 'expo-router';
import React from 'react';

export default function HomeLayout() {
  const router = useRouter();

  return (
    <Stack>
      <Stack.Screen
        name="index"
        options={{
          headerShown: true,
          title: 'Home',
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
