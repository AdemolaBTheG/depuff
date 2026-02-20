import { router } from 'expo-router';
import React from 'react';
import { View } from 'react-native';
import RevenueCatUI from 'react-native-purchases-ui';

export default function PaywallScreen() {
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
