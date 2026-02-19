import { Stack } from 'expo-router';
import React from 'react';

export default function FoodLayout() {
  return (
    <Stack>
      <Stack.Screen name="index" options={{ title: 'Log Food' }} />
      <Stack.Screen name="result" options={{ title: 'Food Result' }} />
      <Stack.Screen name="[id]" options={{ title: 'Food Log' }} />
      <Stack.Screen name="all" options={{ title: 'All Logged Foods', }} />
    </Stack>
  );
}
