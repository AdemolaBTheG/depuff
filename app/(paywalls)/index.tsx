import { useSubscription } from '@/context/SubscriptionContext';
import { Redirect, router } from 'expo-router';
import React from 'react';
import { View } from 'react-native';
import RevenueCatUI from 'react-native-purchases-ui';

export default function Paywall() {
    const { isPro } = useSubscription();

    if (isPro) {
      return <Redirect href="/(tabs)/(home)" />;
    }

    return (
        <View style={{ flex: 1 }}>
             <RevenueCatUI.Paywall
               onDismiss={() => {
                 if (router.canGoBack()) {
                   router.back();
                 } else {
                   router.replace('/(tabs)/(home)');
                 }
               }}
               onPurchaseCompleted={() => {
                 router.replace('/(tabs)/(home)');
               }}
               onRestoreCompleted={() => {
                 router.replace('/(tabs)/(home)');
               }}
             />
           </View>
    );
}
