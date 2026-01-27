import { useEffect, useState } from 'react';
import Purchases, { CustomerInfo } from 'react-native-purchases';
import { ENTITLEMENT_ID } from '../constants/Subscriptions';

interface SubscriptionStatus {
  isPro: boolean;
  isLoading: boolean;
  setIsPro: (isPro: boolean) => void;
}

export function useSubscriptionStatus(): SubscriptionStatus {
  const [isPro, setIsPro] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  const handleCustomerInfo = (customerInfo: CustomerInfo) => {
    const isProActive = !!customerInfo.entitlements.active[ENTITLEMENT_ID];

    setIsPro(isProActive);
    setIsLoading(false); // Set loading to false after fetching customer info
  };

  useEffect(() => {
    Purchases.addCustomerInfoUpdateListener(handleCustomerInfo);

    const fetchInitalStatus = async () => {
      setIsLoading(true); // Set loading to true while fetching
      try {
        const customerInfo = await Purchases.getCustomerInfo();
        handleCustomerInfo(customerInfo);
      } catch (error) {
        console.error('Failed to fetch customer info:', error);
        setIsPro(false); // Default to false on error
        setIsLoading(false); // Set loading to false on error
      }
    };
    fetchInitalStatus();

    return () => {
      Purchases.removeCustomerInfoUpdateListener(handleCustomerInfo);
    };
  }, []);

  return { setIsPro, isPro, isLoading };
}
