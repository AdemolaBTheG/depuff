import { SubscriptionProvider } from '@/context/SubscriptionContext';
import { useAppInitialization } from '@/hooks/useAppInitialization';
import { useSubscriptionStatus } from '@/hooks/useSubscriptionStatus';
import { HapticProvider } from '@renegades/react-native-tickle';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect } from 'react';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { KeyboardProvider } from 'react-native-keyboard-controller';
import { enableScreens } from 'react-native-screens';
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

  useEffect(() => {
    if (isReady) {
      SplashScreen.hide();
    }
  }, [isReady]);

  if (!isReady) return null;

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
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
    </GestureHandlerRootView>
  );
}
