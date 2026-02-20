import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import zustandStorage from './storage';

interface SettingsState {
  waterGoalMl: number;
  sodiumGoalMg: number;
  setWaterGoalMl: (val: number) => void;
  setSodiumGoalMg: (val: number) => void;
  resetToDefaults: () => void;
}

const DEFAULT_WATER_GOAL = 2500;
const DEFAULT_SODIUM_GOAL = 2300;

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set) => ({
      waterGoalMl: DEFAULT_WATER_GOAL,
      sodiumGoalMg: DEFAULT_SODIUM_GOAL,

      setWaterGoalMl: (val) => set({ waterGoalMl: val }),
      setSodiumGoalMg: (val) => set({ sodiumGoalMg: val }),

      resetToDefaults: () =>
        set({
          waterGoalMl: DEFAULT_WATER_GOAL,
          sodiumGoalMg: DEFAULT_SODIUM_GOAL,
        }),
    }),
    {
      name: 'settings-storage',
      storage: createJSONStorage(() => zustandStorage),
    }
  )
);
