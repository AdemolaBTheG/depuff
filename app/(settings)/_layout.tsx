import { Stack, useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';

export default function SettingsLayout() {
  const router = useRouter();
  const { t } = useTranslation();

  return (
    <Stack
      screenOptions={{
        headerTransparent: true,
        headerShadowVisible: false,
        unstable_headerLeftItems: () => [
          {
            type: 'button',
            label: t('common.back', { defaultValue: 'Back' }),
            icon: { type: 'sfSymbol', name: 'chevron.backward' },
            onPress: () => router.back(),
          },
        ],
      }}
    >
      <Stack.Screen
        name="index"
        options={{ title: t('settings.title', { defaultValue: 'Settings' }) }}
      />
    </Stack>
    )
}
