import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import zustandStorage from "./storage";




interface OnboardingState {
  hasSeenStoreReview: boolean;
  isOnboardingCompleted: boolean;
  quizAnswers: Record<string, string>;
  setHasSeenStoreReview: (value: boolean) => void;
  setOnboardingCompleted: (completed: boolean) => void;
  setQuizAnswer: (questionId: string, answerId: string) => void;
  clearQuizAnswers: () => void;
}

export const useOnboardingStore = create<OnboardingState>()(
  persist(
    (set) => ({
      hasSeenStoreReview: false,
      isOnboardingCompleted: false,
      quizAnswers: {},

      setHasSeenStoreReview: (value) => set({ hasSeenStoreReview: value }),
      setOnboardingCompleted: (completed) =>
        set({ isOnboardingCompleted: completed }),
      setQuizAnswer: (questionId, answerId) =>
        set((state) => ({
          quizAnswers: {
            ...state.quizAnswers,
            [questionId]: answerId,
          },
        })),
      clearQuizAnswers: () => set({ quizAnswers: {} }),
    }),
    {
      name: "onboarding-storage",
      storage: createJSONStorage(() => zustandStorage),
    }
  )
);
