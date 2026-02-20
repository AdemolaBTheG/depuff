import zustandStorage from '@/stores/storage';
import { useEffect, useState } from 'react';
import Purchases, { CustomerInfo } from 'react-native-purchases';
import { ENTITLEMENT_ID } from '../constants/Subscriptions';

interface SubscriptionStatus {
  isPro: boolean;
  isLoading: boolean;
  setIsPro: (isPro: boolean) => void;
}

const SUBSCRIPTION_CACHE_KEY = 'subscription-status-cache-v1';
type CachedSubscriptionStatus = {
  isPro: boolean;
};

function readCachedSubscriptionStatus(): CachedSubscriptionStatus | null {
  const raw = zustandStorage.getItem(SUBSCRIPTION_CACHE_KEY);
  if (!raw || typeof raw !== 'string') return null;

  try {
    const parsed = JSON.parse(raw) as Partial<CachedSubscriptionStatus>;
    if (typeof parsed.isPro !== 'boolean') return null;
    return {
      isPro: parsed.isPro,
    };
  } catch {
    return null;
  }
}

function writeCachedSubscriptionStatus(isPro: boolean) {
  const payload: CachedSubscriptionStatus = {
    isPro,
  };
  zustandStorage.setItem(SUBSCRIPTION_CACHE_KEY, JSON.stringify(payload));
}

export function useSubscriptionStatus(): SubscriptionStatus {
  const cachedStatus = readCachedSubscriptionStatus();
  const [isPro, setIsProState] = useState(cachedStatus?.isPro ?? false);
  const [isLoading, setIsLoading] = useState(!cachedStatus);

  const applyCustomerInfo = (customerInfo: CustomerInfo) => {
    const isProActive = !!customerInfo.entitlements.active[ENTITLEMENT_ID];
    setIsProState(isProActive);
    writeCachedSubscriptionStatus(isProActive);
    setIsLoading(false);
  };

  const setIsPro = (nextIsPro: boolean) => {
    setIsProState(nextIsPro);
    writeCachedSubscriptionStatus(nextIsPro);
  };

  useEffect(() => {
    let isMounted = true;
    const handleCustomerInfoUpdate = (customerInfo: CustomerInfo) => {
      if (!isMounted) return;
      applyCustomerInfo(customerInfo);
    };

    Purchases.addCustomerInfoUpdateListener(handleCustomerInfoUpdate);

    const fetchInitialStatus = async () => {
      try {
        const customerInfo = await Purchases.getCustomerInfo();
        if (!isMounted) return;
        applyCustomerInfo(customerInfo);
      } catch (error) {
        console.error('Failed to fetch customer info:', error);
        if (isMounted) setIsLoading(false);
      }
    };
    void fetchInitialStatus();

    return () => {
      isMounted = false;
      Purchases.removeCustomerInfoUpdateListener(handleCustomerInfoUpdate);
    };
  }, []);

  return { setIsPro, isPro, isLoading };
}
