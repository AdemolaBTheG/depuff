import { router } from 'expo-router';
import { usePostHog } from 'posthog-react-native';
import React from 'react';
import { View } from 'react-native';
import RevenueCatUI from 'react-native-purchases-ui';

export default function Paywall() {
    const posthog = usePostHog();
    return (
        <View style={{ flex: 1 }}>
            <RevenueCatUI.Paywall
                onDismiss={() => {
                    posthog?.capture('Dismissed paywall');
                    router.replace('/paywall');
                }}
                onPurchaseCompleted={() => {
                    posthog?.capture('Completed purchase');
                    router.replace('/(tabs)/(home)');
                }}
                onRestoreCompleted={() => {
                    posthog?.capture('Completed restore');
                    router.replace('/(tabs)/(home)');
                }}
            />
        </View>
    );
}
