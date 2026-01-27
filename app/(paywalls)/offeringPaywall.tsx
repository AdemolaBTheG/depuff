import { useSubscription } from "@/context/SubscriptionContext";
import { Redirect, router } from "expo-router";
import { usePostHog } from 'posthog-react-native';
import React, { useEffect } from "react";
import { ActivityIndicator, View } from "react-native";
import Purchases, { PurchasesOffering } from "react-native-purchases";
import RevenueCatUI from "react-native-purchases-ui";
export default function Paywall() {
    const posthog = usePostHog();
    const [promoOffering, setPromoOffering] =
        React.useState<PurchasesOffering | null>(null);
    const { isPro } = useSubscription();

    useEffect(() => {
        posthog?.capture('Paywall Viewed', { source: 'onboarding' });
    }, [posthog]);

    useEffect(() => {
        const fetchOfferings = async () => {
            try {
                const offerings = await Purchases.getOfferings();
                if (
                    offerings.current !== null &&
                    offerings.current.availablePackages.length !== 0
                ) {
                    // Display packages for sale
                    setPromoOffering(offerings.all?.Offer);
                }
            } catch (e) {
                console.error("Error fetching offerings", e);
            }
        };
        fetchOfferings();
    }, []);

    if (isPro) {
        return <Redirect href="/(tabs)/(discover)" />;
    }

    return (
        <View style={{ flex: 1 }}>
            {promoOffering ? (
                <RevenueCatUI.Paywall
                    options={{
                        offering: promoOffering,
                    }}
                    onDismiss={() => {
                        posthog?.capture('Paywall Dismissed');
                        router.replace("/(tabs)/(discover)");
                    }}
                    onPurchaseCompleted={async () => {
                        router.replace("/(tabs)/(discover)");
                    }}
                />
            ) : (
                <ActivityIndicator
                    size="large"
                    color="#14b8a6"
                    style={{ flex: 1, justifyContent: "center", alignItems: "center" }}
                />
            )}
        </View>
    );
}
