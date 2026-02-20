import { isLiquidGlassAvailable } from 'expo-glass-effect';
import { Stack } from 'expo-router';
import React from 'react';
import { PlatformColor } from 'react-native';
import { useTranslation } from 'react-i18next';

export default function FoodLayout() {
  const { t } = useTranslation();
  return (
    <Stack>
      <Stack.Screen
        name="index"
        options={{ title: t('food.logFood', { defaultValue: 'Log Food' }) }}
      />
      <Stack.Screen
        name="result"
        options={{ title: t('food.resultTitle', { defaultValue: 'Food Result' }),headerTransparent:isLiquidGlassAvailable(),headerStyle:{
        backgroundColor: isLiquidGlassAvailable() ? 'transparent' : '#F2F2F7'
      },contentStyle:{
        backgroundColor: PlatformColor('secondarySystemGroupedBackground')
      } }} />
      <Stack.Screen name="[id]" options={{ title: t('food.foodLog', { defaultValue: 'Food Log' }),headerTransparent:isLiquidGlassAvailable(),headerStyle:{
        backgroundColor: isLiquidGlassAvailable() ? 'transparent' : '#F2F2F7'
      },contentStyle:{
        backgroundColor: PlatformColor('secondarySystemGroupedBackground')
      } }} />
      <Stack.Screen name="all" options={{ title: t('food.allLoggedFoods', { defaultValue: 'All Logged Foods' }),headerTransparent:isLiquidGlassAvailable(),headerStyle:{
        backgroundColor: isLiquidGlassAvailable() ? 'transparent' : '#F2F2F7'
      },contentStyle:{
        backgroundColor: PlatformColor('secondarySystemGroupedBackground')
      } }} />
    </Stack>
  );
}
