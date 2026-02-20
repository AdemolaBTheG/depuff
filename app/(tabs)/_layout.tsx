import { Theme } from '@/constants/Theme'
import { NativeTabTrigger, NativeTabs } from 'expo-router/unstable-native-tabs'
import { useTranslation } from 'react-i18next';

export default function TabsLayout() {
    const { t } = useTranslation();
    return (
        <NativeTabs tintColor={Theme.colors.accent}>
            <NativeTabTrigger name="(home)">
                <NativeTabTrigger.Label>{t('home.title', { defaultValue: 'Home' })}</NativeTabTrigger.Label>
                <NativeTabTrigger.Icon sf={{ default: 'house', selected: 'house.fill' }} />
            </NativeTabTrigger>

            <NativeTabTrigger name="(progress)">
                <NativeTabTrigger.Label>{t('progress.title', { defaultValue: 'Progress' })}</NativeTabTrigger.Label>
                <NativeTabTrigger.Icon sf={{ default: 'chart.bar', selected: 'chart.bar.fill' }} />
            </NativeTabTrigger>
        </NativeTabs>
    )
}
