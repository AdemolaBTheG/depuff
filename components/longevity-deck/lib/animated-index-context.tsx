// longevity-deck-onboarding-animation 🔽

import { createContext } from "react";
import { SharedValue } from "react-native-reanimated";

/**
 * Context type for sharing the active slide index across animation components.
 * activeIndex is a SharedValue that tracks the current slide (0-4) and enables
 * synchronized animations across all child components without prop drilling.
 */
type AnimatedIndexContextType = {
  activeIndex: SharedValue<number>;
};

export const AnimatedIndexContext = createContext<AnimatedIndexContextType>(
  {} as AnimatedIndexContextType
);

// longevity-deck-onboarding-animation 🔼
