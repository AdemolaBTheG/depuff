import { syncHydrationWidgetSnapshot } from '@/services/hydration-widget';
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

    const configurePurchases = async () => {
      if (Platform.OS === 'ios' && rc_apple_api_key) {
        Purchases.configure({ apiKey: 'test_wQPfxhLUBqJNosuiPjgOdJYhNrG' });
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

    const syncIdsToRevenueCat = async () => {
      try {
        const onesignalId = await OneSignal.User.getOnesignalId();
        if (onesignalId) {
          await Purchases.setAttributes({ $onesignalUserId: onesignalId });
          await Purchases.syncAttributesAndOfferingsIfNeeded?.();
        }
      } catch (e) {
        console.warn('Initial OneSignal -> RevenueCat sync failed', e);
      }
    };

    const attachObserver = () => {
      userObserver = OneSignal.User.addEventListener('change', async (user) => {
        try {
          const onesignalId = user.current?.onesignalId;
          if (onesignalId) {
            await Purchases.setAttributes({ $onesignalUserId: onesignalId });
            await Purchases.syncAttributesAndOfferingsIfNeeded?.();
          }
        } catch (e) {
          console.warn('OneSignal -> RevenueCat sync failed', e);
        }
      });
    };

    (async () => {
      try {
        await initializeDb();
        try {
          await syncHydrationWidgetSnapshot();
        } catch (widgetError) {
          console.warn('Hydration widget sync failed during init', widgetError);
        }
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
