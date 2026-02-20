import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import zustandStorage from "./storage";




interface OnboardingState {
  hasSeenStoreReview: boolean;
  isOnboardingCompleted: boolean;
  setHasSeenStoreReview: (value: boolean) => void;
  setOnboardingCompleted: (completed: boolean) => void;
}

export const useOnboardingStore = create<OnboardingState>()(
  persist(
    (set) => ({
      hasSeenStoreReview: false,
      isOnboardingCompleted: false,

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
