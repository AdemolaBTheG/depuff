import { Stack } from 'expo-router'
import React from 'react'

export default function OnboardingLayout() {
    return (
        <Stack>
            <Stack.Screen name="index" options={{ headerShown: false }} />
            <Stack.Screen name="goal" options={{ headerShown: false }} />
            <Stack.Screen name="frequency" options={{ headerShown: false }} />
            <Stack.Screen name="trigger" options={{ headerShown: false }} />
            <Stack.Screen name="hydration-goal" options={{ headerShown: false }} />
            <Stack.Screen name="sodium-goal" options={{ headerShown: false }} />
            <Stack.Screen name="commitment" options={{ headerShown: false }} />
        </Stack>
    )
}
