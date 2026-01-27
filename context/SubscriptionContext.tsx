import React, { createContext, FC, ReactNode, useContext } from 'react';


interface SubscriptionContextType {

    isPro: boolean;
    isLoading: boolean;
    setIsPro: (isPro: boolean) => void;
}


const SubscriptionContext = createContext<SubscriptionContextType | undefined>(undefined);


interface SubscriptionProviderProps {
    children: ReactNode;
    value: SubscriptionContextType;
}

export const SubscriptionProvider: FC<SubscriptionProviderProps> = ({ children, value }) => {
    return (
        <SubscriptionContext.Provider value={value}>
            {children}
        </SubscriptionContext.Provider>
    )
}

export const useSubscription = (): SubscriptionContextType => {
    const context = useContext(SubscriptionContext);

    // Ensure the hook is used within the Provider
    if (context === undefined) {
        throw new Error('useSubscription must be used within a SubscriptionProvider');
    }

    return context;
};
