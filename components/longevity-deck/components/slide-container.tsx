import React, { FC, PropsWithChildren, use } from "react";
import Animated, { Extrapolation } from "react-native-reanimated";
import { interpolate, useAnimatedStyle } from "react-native-reanimated";
import { AnimatedIndexContext } from "../lib/animated-index-context";

// longevity-deck-onboarding-animation 🔽

type Props = {
  index: number;
};

/**
 * Wrapper component that fades slides in/out based on scroll position.
 * Uses a 1-slide-wide window (index ± 0.5) for smooth crossfade transitions.
 * Interpolation: [index-0.5, index, index+0.5] → [0, 1, 0] opacity
 * CLAMP ensures opacity stays within [0, 1] bounds.
 */
export const SlideContainer: FC<PropsWithChildren<Props>> = ({ children, index }) => {
  const { activeIndex } = use(AnimatedIndexContext);

  const rContainerStyle = useAnimatedStyle(() => {
    const opacity = interpolate(
      activeIndex.get(),
      [index - 0.5, index, index + 0.5],
      [0, 1, 0],
      Extrapolation.CLAMP
    );

    return {
      opacity,
    };
  });

  return (
    <Animated.View className="flex-1" style={rContainerStyle}>
      {children}
    </Animated.View>
  );
};

// longevity-deck-onboarding-animation 🔼
