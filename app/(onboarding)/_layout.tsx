import { Stack } from 'expo-router'
import React from 'react'
import { PlatformColor } from 'react-native'

export default function OnboardingLayout() {
    return (
        <Stack screenOptions={{
            contentStyle:{
                backgroundColor: PlatformColor('systemGroupedBackground')
            }
        }}>
            <Stack.Screen name="index" options={{ headerShown: false }} />
            <Stack.Screen name="goal" options={{ headerShown: false }} />
            <Stack.Screen name="frequency" options={{ headerShown: false }} />
            <Stack.Screen name="trigger" options={{ headerShown: false }} />
            <Stack.Screen name="hydration-goal" options={{ headerShown: false }} />
            <Stack.Screen name="sodium-goal" options={{ headerShown: false }} />
            <Stack.Screen name="commitment" options={{ headerShown: false }} />
            <Stack.Screen name="demo-scan" options={{ headerShown: false }} />
            <Stack.Screen name="demo-preview" options={{ headerShown: false }} />
            <Stack.Screen name="notifications" options={{ headerShown: false }} />
            <Stack.Screen name="rating" options={{ headerShown: false }} />
        </Stack>
    )
}
