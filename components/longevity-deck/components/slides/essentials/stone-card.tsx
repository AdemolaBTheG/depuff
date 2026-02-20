import React, { FC, use } from "react";
import { useWindowDimensions, StyleSheet } from "react-native";
import { AnimatedIndexContext } from "../../../lib/animated-index-context";
import Animated, {
  useAnimatedStyle,
  interpolate,
  Extrapolation,
  withSpring,
} from "react-native-reanimated";
import { BASE_SPRING_CONFIG } from "../../../lib/constants";
import { SlideItemProps } from "../../../lib/types";

// longevity-deck-onboarding-animation 🔽

export const StoneCard: FC<SlideItemProps> = ({ index }) => {
  const { width: screenWidth } = useWindowDimensions();

  const { activeIndex } = use(AnimatedIndexContext);

  const rContainerStyle = useAnimatedStyle(() => {
    /**
     * translateX: Slides card left (off-screen) when scrolling to next slide.
     * Interpolation: [index, index+1] → [0, -screenWidth]
     */
    const translateX = interpolate(
      activeIndex.get(),
      [index, index + 1],
      [0, -screenWidth],
      Extrapolation.CLAMP
    );
    /**
     * scale: Slightly shrinks card (1 → 0.98) when slide becomes inactive.
     * Interpolation: [index, index-0.5] → [1, 0.98]
     * Note: Uses index-0.5 (past) instead of index+0.5 (future) - scales down when leaving.
     */
    const scale = interpolate(
      activeIndex.get(),
      [index, index - 0.5],
      [1, 0.98],
      Extrapolation.CLAMP
    );

    return {
      transform: [
        { translateX: withSpring(translateX, BASE_SPRING_CONFIG) },
        { scale: withSpring(scale, BASE_SPRING_CONFIG) },
      ],
    };
  });

  return (
    <Animated.View
      style={[rContainerStyle, styles.borderCurve]}
      className="absolute top-[37%] left-[63%] w-[30%] aspect-[1/1.2] rounded-3xl items-center justify-center gap-10 bg-orange-300"
    />
  );
};

const styles = StyleSheet.create({
  borderCurve: {
    borderCurve: "continuous",
  },
});

// longevity-deck-onboarding-animation 🔼
