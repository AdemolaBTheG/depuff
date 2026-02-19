import type { AnalyzeFoodResponse } from '@/services/bridge-api';
import { create } from 'zustand';

export type PendingFoodAnalysis = {
  imageUri: string;
  capturedAt: string;
  result: AnalyzeFoodResponse;
};

type FoodAnalysisStoreState = {
  pendingAnalysis: PendingFoodAnalysis | null;
  setPendingAnalysis: (pending: PendingFoodAnalysis) => void;
  clearPendingAnalysis: () => void;
};

export const useFoodAnalysisStore = create<FoodAnalysisStoreState>((set) => ({
  pendingAnalysis: null,
  setPendingAnalysis: (pending) => set({ pendingAnalysis: pending }),
  clearPendingAnalysis: () => set({ pendingAnalysis: null }),
}));
