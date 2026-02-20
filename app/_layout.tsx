import { SubscriptionProvider } from '@/context/SubscriptionContext';
import { useAppInitialization } from '@/hooks/useAppInitialization';
import '@/i18n';
import { useSubscriptionStatus } from '@/hooks/useSubscriptionStatus';
import { HapticProvider } from '@renegades/react-native-tickle';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Stack, useGlobalSearchParams, usePathname } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect, useRef } from 'react';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { KeyboardProvider } from 'react-native-keyboard-controller';
import { enableScreens } from 'react-native-screens';
import { PostHogProvider } from 'posthog-react-native';
import { posthog } from '../src/config/posthog';
import '../global.css';

const queryClient = new QueryClient();

enableScreens();
SplashScreen.preventAutoHideAsync().catch(() => {});
SplashScreen.setOptions({
  duration: 1000,
  fade: true,
});

export default function RootLayout() {
  const { isReady } = useAppInitialization();
  const subscription = useSubscriptionStatus();
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
}
