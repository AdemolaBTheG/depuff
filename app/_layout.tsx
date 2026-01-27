import { useDbStore } from "@/stores/dbStore";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Stack } from "expo-router";
import { useEffect } from "react";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { KeyboardProvider } from "react-native-keyboard-controller";
import "../global.css";

const queryClient = new QueryClient();

export default function RootLayout() {

  const { db, initializeDb, isLoading } = useDbStore();


  useEffect(() => {
    initializeDb({ name: "smoking.db" });
  }, [initializeDb]);

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <QueryClientProvider client={queryClient}>
        <KeyboardProvider>
          <Stack>
            <Stack.Screen name="index" options={{ headerShown: false }} />
            <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
            <Stack.Screen name="(settings)" options={{ headerShown: false }} />
            <Stack.Screen name="(onboarding)" options={{ headerShown: false }} />
          </Stack>
        </KeyboardProvider>
      </QueryClientProvider>
    </GestureHandlerRootView>


  );
}
