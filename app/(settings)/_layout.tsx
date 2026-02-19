import { Stack, useRouter } from 'expo-router';

export default function SettingsLayout() {
  const router = useRouter();

  return (
    <Stack
      screenOptions={{
        headerTransparent: true,
        headerShadowVisible: false,
        unstable_headerLeftItems: () => [
          {
            type: 'button',
            label: 'Back',
            icon: { type: 'sfSymbol', name: 'chevron.backward' },
            onPress: () => router.back(),
          },
        ],
      }}
    >
      <Stack.Screen name="index" options={{ title: 'Settings' }} />
    </Stack>
    )
}