import { isLiquidGlassAvailable } from 'expo-glass-effect';
import { Stack } from 'expo-router';
import React from 'react';
import { PlatformColor } from 'react-native';

export default function FoodLayout() {
  return (
    <Stack>
      <Stack.Screen name="index" options={{ title: 'Log Food' }} />
      <Stack.Screen name="result" options={{ title: 'Food Result',headerTransparent:isLiquidGlassAvailable(),headerStyle:{
        backgroundColor: isLiquidGlassAvailable() ? 'transparent' : '#F2F2F7'
      },contentStyle:{
        backgroundColor: PlatformColor('secondarySystemGroupedBackground')
      } }} />
      <Stack.Screen name="[id]" options={{ title: 'Food Log',headerTransparent:isLiquidGlassAvailable(),headerStyle:{
        backgroundColor: isLiquidGlassAvailable() ? 'transparent' : '#F2F2F7'
      },contentStyle:{
        backgroundColor: PlatformColor('secondarySystemGroupedBackground')
      } }} />
      <Stack.Screen name="all" options={{ title: 'All Logged Foods',headerTransparent:isLiquidGlassAvailable(),headerStyle:{
        backgroundColor: isLiquidGlassAvailable() ? 'transparent' : '#F2F2F7'
      },contentStyle:{
        backgroundColor: PlatformColor('secondarySystemGroupedBackground')
      } }} />
    </Stack>
  );
}
