import { isLiquidGlassAvailable } from 'expo-glass-effect';
import { Stack } from 'expo-router';
import React from 'react';
import { PlatformColor } from 'react-native';
export default function ScanLayout() {
  return <Stack>
    <Stack.Screen name="index" options={{ headerShown: true ,headerTransparent: isLiquidGlassAvailable(), headerStyle: { backgroundColor: isLiquidGlassAvailable() ? 'transparent' : '#F2F2F7' }, contentStyle: { backgroundColor:  PlatformColor('systemGroupedBackground')  }}} />
  </Stack>;
}
