import { useSubscription } from '@/context/SubscriptionContext';
import { Redirect, router } from 'expo-router';
import { usePostHog } from 'posthog-react-native';
import React from 'react';
import { View } from 'react-native';
import RevenueCatUI from 'react-native-purchases-ui';

export default function Paywall() {
    const posthog = usePostHog();
    const { isPro } = useSubscription();

    if (isPro) {
      return <Redirect href="/(tabs)/(home)" />;
    }

    return (
        <View style={{ flex: 1 }}>
            <RevenueCatUI.Paywall
                onDismiss={() => {
                    posthog?.capture('Dismissed paywall');
                    router.replace('/offeringPaywall');
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
