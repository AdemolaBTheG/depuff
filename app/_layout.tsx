import { SubscriptionProvider } from '@/context/SubscriptionContext';
import { useAppInitialization } from '@/hooks/useAppInitialization';
import '@/i18n';
import { useSubscriptionStatus } from '@/hooks/useSubscriptionStatus';
import { HapticProvider } from '@renegades/react-native-tickle';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import * as QuickActions from 'expo-quick-actions';
import { RouterAction, useQuickActionRouting } from 'expo-quick-actions/router';
import { Stack, useGlobalSearchParams, usePathname } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect, useRef } from 'react';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { KeyboardProvider } from 'react-native-keyboard-controller';
import { Platform } from 'react-native';
import { enableScreens } from 'react-native-screens';
import { useTranslation } from 'react-i18next';
import { PostHogProvider } from 'posthog-react-native';
import { posthog } from '../src/config/posthog';
import '../global.css';
import * as Sentry from '@sentry/react-native';

Sentry.init({
  dsn: 'https://d63ec639d9022fe557c7174c38d849e7@o4509184946536448.ingest.de.sentry.io/4510920452931664',

  // Adds more context data to events (IP address, cookies, user, etc.)
  // For more information, visit: https://docs.sentry.io/platforms/react-native/data-management/data-collected/
  sendDefaultPii: true,

  // Enable Logs
  enableLogs: false,

  // uncomment the line below to enable Spotlight (https://spotlightjs.com)
  // spotlight: __DEV__,
});

const queryClient = new QueryClient();

enableScreens();
SplashScreen.preventAutoHideAsync().catch(() => {});
SplashScreen.setOptions({
  duration: 1000,
  fade: true,
});

export default Sentry.wrap(function RootLayout() {
  const { isReady } = useAppInitialization();
  const subscription = useSubscriptionStatus();
  const { t } = useTranslation();
  const pathname = usePathname();
  const params = useGlobalSearchParams();
  const previousPathname = useRef<string | undefined>(undefined);

  useEffect(() => {
    if (isReady) {
      SplashScreen.hide();
    }
  }, [isReady]);

  // Manual screen tracking for Expo Router
  // @see https://posthog.com/docs/libraries/react-native#screen-tracking
  useEffect(() => {
    if (previousPathname.current !== pathname) {
      posthog.screen(pathname, {
        previous_screen: previousPathname.current ?? null,
        ...params,
      });
      previousPathname.current = pathname;
    }
  }, [pathname, params]);

  useEffect(() => {
    if (Platform.OS !== 'ios' && Platform.OS !== 'android') {
      return;
    }

    const items: RouterAction[] = [
      {
        id: 'home',
        title: t('quick_actions.home_title', { defaultValue: 'Home' }),
        subtitle: t('quick_actions.home_subtitle', { defaultValue: "Open today's dashboard" }),
        icon: Platform.OS === 'ios' ? 'symbol:house.fill' : undefined,
        params: { href: '/(tabs)/(home)' },
      },
      {
        id: 'scan',
        title: t('quick_actions.scan_title', { defaultValue: 'Face Scan' }),
        subtitle: t('quick_actions.scan_subtitle', { defaultValue: 'Start your morning scan' }),
        icon: Platform.OS === 'ios' ? 'symbol:camera.fill' : undefined,
        params: { href: '/(scan)' },
      },
      {
        id: 'food',
        title: t('quick_actions.food_title', { defaultValue: 'Log Food' }),
        subtitle: t('quick_actions.food_subtitle', { defaultValue: 'Capture meal sodium fast' }),
        icon: Platform.OS === 'ios' ? 'symbol:fork.knife' : undefined,
        params: { href: '/(food)' },
      },
    ];

    if (!subscription.isPro) {
      items.push({
        id: 'offer',
        title: t('quick_actions.offer_title', { defaultValue: 'Upgrade' }),
        subtitle: t('quick_actions.offer_subtitle', { defaultValue: 'Unlock unlimited scans' }),
        icon: Platform.OS === 'ios' ? 'symbol:crown.fill' : undefined,
        params: { href: '/paywall' },
      });
    }

    void QuickActions.setItems(items).catch(() => {});
  }, [subscription.isPro, t]);

  useQuickActionRouting();

  if (!isReady) return null;

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <PostHogProvider
        client={posthog}
        autocapture={{
          captureScreens: false, // Manual screen tracking via Expo Router
          captureTouches: true,
          propsToCapture: ['testID'],
          maxElementsCaptured: 20,
        }}
      >
      <SubscriptionProvider value={subscription}>
        <QueryClientProvider client={queryClient}>
          <KeyboardProvider>
            <HapticProvider>
              <Stack>
                <Stack.Screen name="index" options={{ headerShown: false }} />
                <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
                <Stack.Screen
                  name="(scan)"
                  options={{ headerShown: false, presentation: 'fullScreenModal' }}
                />
                <Stack.Screen name="(food)" options={{ headerShown: false,presentation:'modal' }} />
                <Stack.Screen name="(paywalls)" options={{ headerShown: false, presentation: 'fullScreenModal' }} />
                <Stack.Screen name="log"   options={{
          presentation: 'formSheet',
          headerTransparent: true,
          contentStyle: { backgroundColor: 'transparent' },
          sheetGrabberVisible: true,
          title: '',
        }}/>
                <Stack.Screen name="(settings)" options={{ headerShown: false }} />
                <Stack.Screen name="(onboarding)" options={{ headerShown: false }} />
              </Stack>
            </HapticProvider>
          </KeyboardProvider>
        </QueryClientProvider>
      </SubscriptionProvider>
      </PostHogProvider>
    </GestureHandlerRootView>
  );
});