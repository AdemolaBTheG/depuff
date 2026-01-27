import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import zustandStorage from "./storage";




interface OnboardingState {
  // onboarding flags
  hasSeenStoreReview: boolean;
  isOnboardingCompleted: boolean;






  setHasSeenStoreReview: (value: boolean) => void;
  setOnboardingCompleted: (completed: boolean) => void;


  // helper to clear data after onboarding
}

export const useOnboardingStore = create<OnboardingState>()(
  persist(
    (set) => ({
      // flags
      hasSeenStoreReview: false,
      isOnboardingCompleted: false,
      treat: null,
      userSettings: {
        quitDate: null,
        cigarettesPerDay: 0,
        cigsPerPack: 20,
        costPerPack: 0,
        currencySymbol: "$",
      },

      // flag setters
      setHasSeenStoreReview: (value) => set({ hasSeenStoreReview: value }),
      setOnboardingCompleted: (completed) =>
        set({ isOnboardingCompleted: completed }),



    }),
    {
      name: "onboarding-storage",
      storage: createJSONStorage(() => zustandStorage),
    }
  )
);
