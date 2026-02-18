import { NativeTabTrigger, NativeTabs } from 'expo-router/unstable-native-tabs'
import { Theme } from '@/constants/Theme'

export default function TabsLayout() {
    return (
        <NativeTabs tintColor={Theme.colors.accent}>
            <NativeTabTrigger name="(home)">
                <NativeTabTrigger.Label>Home</NativeTabTrigger.Label>
                <NativeTabTrigger.Icon sf={{ default: 'house', selected: 'house.fill' }} />
            </NativeTabTrigger>

            <NativeTabTrigger name="(progress)">
                <NativeTabTrigger.Label>Progress</NativeTabTrigger.Label>
                <NativeTabTrigger.Icon sf={{ default: 'chart.bar', selected: 'chart.bar.fill' }} />
            </NativeTabTrigger>
        </NativeTabs>
    )
}
