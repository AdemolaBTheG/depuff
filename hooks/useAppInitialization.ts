import { posthog } from '@/src/config/posthog';
import { useDbStore } from '@/stores/dbStore';
import { useEffect, useState } from 'react';
import { Platform } from 'react-native';
import { OneSignal } from 'react-native-onesignal';
import Purchases from 'react-native-purchases';

const rc_apple_api_key = process.env.EXPO_PUBLIC_RC_APPLE_API_KEY || '';
const onesignal_app_id = process.env.EXPO_PUBLIC_ONESIGNAL_APP_ID || '';

export function useAppInitialization() {
  const [isReady, setIsReady] = useState(false);
  const { initializeDb } = useDbStore();

  useEffect(() => {
    let userObserver: any | null = null;
    let isMounted = true;

    const getPostHogDistinctId = async (): Promise<string | null> => {
      await posthog.ready();
      const distinctId = posthog.getDistinctId()?.trim();
      return distinctId ? distinctId : null;
    };

    const configurePurchases = async () => {
      if (Platform.OS === 'ios' && rc_apple_api_key) {
        Purchases.configure({
          apiKey: rc_apple_api_key,
        });
        const configured = await Purchases.isConfigured();
        if (configured) {
          await Purchases.enableAdServicesAttributionTokenCollection();
        }
      }
    };

    const initOneSignal = async () => {
      if (onesignal_app_id) {
        OneSignal.initialize(onesignal_app_id);
      }
    };

    const syncSubscriberAttributesToRevenueCat = async (onesignalId?: string | null) => {
      try {
        if (!(await Purchases.isConfigured())) return;

        const posthogDistinctId = await getPostHogDistinctId();
        const attributes: Record<string, string | null> = {};

        if (onesignalId) {
          attributes.$onesignalUserId = onesignalId;
        }

        if (posthogDistinctId) {
          // Required by RevenueCat -> PostHog integration to map subscription events to the correct PostHog user.
          attributes.$posthogUserId = posthogDistinctId;
        }

        if (Object.keys(attributes).length === 0) return;

        await Purchases.setAttributes(attributes);
        await Purchases.syncAttributesAndOfferingsIfNeeded?.();
      } catch (e) {
        console.warn('RevenueCat subscriber attribute sync failed', e);
      }
    };

    const syncIdsToRevenueCat = async () => {
      try {
        const onesignalId = onesignal_app_id
          ? await OneSignal.User.getOnesignalId()
          : null;
        await syncSubscriberAttributesToRevenueCat(onesignalId);
      } catch (e) {
        console.warn('Initial OneSignal -> RevenueCat sync failed', e);
        await syncSubscriberAttributesToRevenueCat();
      }
    };

    const attachObserver = () => {
      if (!onesignal_app_id) return;
      userObserver = OneSignal.User.addEventListener('change', async (user) => {
        try {
          await syncSubscriberAttributesToRevenueCat(user.current?.onesignalId ?? null);
        } catch (e) {
          console.warn('OneSignal -> RevenueCat sync failed', e);
        }
      });
    };

    (async () => {
      try {
        await initializeDb();
        await configurePurchases();
        await initOneSignal();
        await syncIdsToRevenueCat();
        attachObserver();
      } catch (error) {
        console.warn('App initialization failed', error);
      } finally {
        if (isMounted) {
          setIsReady(true);
        }
      }
    })();

    return () => {
      isMounted = false;
      if (userObserver) {
        OneSignal.User.removeEventListener?.('change', userObserver);
      }
    };
  }, [initializeDb]);

  return { isReady };
}
