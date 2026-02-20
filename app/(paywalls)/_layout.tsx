import { Stack } from 'expo-router'
import React from 'react'

export default function PaywallLayout() {
  return (
    <Stack>
        <Stack.Screen name="index" options={{ headerShown: false }} />
        <Stack.Screen name="offeringPaywall" options={{ headerShown: false }} />
        <Stack.Screen name="onboardingPaywall" options={{ headerShown: false }} />
    </Stack>
  )
}