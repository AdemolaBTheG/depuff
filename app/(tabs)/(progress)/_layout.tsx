import { isLiquidGlassAvailable } from 'expo-glass-effect'
import { Stack } from 'expo-router'
import { PlatformColor } from 'react-native'

export default function ProgressLayout() {
    return (
        <Stack>
            <Stack.Screen name="index" options={{ headerShown: true ,headerTitle:'Progress',headerTransparent: isLiquidGlassAvailable(), headerStyle: { backgroundColor: isLiquidGlassAvailable() ? 'transparent' : '#F2F2F7' }, contentStyle: { backgroundColor:  PlatformColor('systemGroupedBackground')  }}} />
        </Stack>
    )
}