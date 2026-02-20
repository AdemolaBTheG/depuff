import React, { FC, use } from "react";
import { useWindowDimensions, View, StyleSheet } from "react-native";
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

export const BlueCard: FC<SlideItemProps> = ({ index }) => {
  const { width: screenWidth } = useWindowDimensions();

  const { activeIndex } = use(AnimatedIndexContext);

  const rContainerStyle = useAnimatedStyle(() => {
    /**
     * opacity: Fades card in/out based on slide proximity.
     * Interpolation: [index-0.5, index, index+1] → [0, 1, 0]
     * Creates crossfade effect - card appears as slide becomes active.
     */
    const opacity = interpolate(
      activeIndex.get(),
      [index - 0.5, index, index + 1],
      [0, 1, 0],
      Extrapolation.CLAMP
    );

    /**
     * translateX: Card enters from left (-50% screen width), centers, then exits left.
     * Interpolation: [index-1, index, index+1] → [-screenWidth*0.5, 0, -screenWidth]
     * Starts partially off-screen to the left for smooth entry.
     */
    const translateX = interpolate(
      activeIndex.get(),
      [index - 1, index, index + 1],
      [-screenWidth * 0.5, 0, -screenWidth],
      Extrapolation.CLAMP
    );
    /**
     * rotate: Card tilts from -2° to -4° then straightens to 0°.
     * Interpolation: [index-0.5, index, index+0.5] → [-2deg, -4deg, 0deg]
     * More dynamic rotation pattern for visual interest.
     */
    const rotate = interpolate(
      activeIndex.get(),
      [index - 0.5, index, index + 0.5],
      [-2, -4, 0],
      Extrapolation.CLAMP
    );
    /**
     * scale: Slightly shrinks card (1 → 0.98) as slide becomes active.
     * Interpolation: [index, index+0.5] → [1, 0.98]
     */
    const scale = interpolate(
      activeIndex.get(),
      [index, index + 0.5],
      [1, 0.98],
      Extrapolation.CLAMP
    );

    return {
      opacity: withSpring(opacity, BASE_SPRING_CONFIG),
      transform: [
        { translateX: withSpring(translateX, BASE_SPRING_CONFIG) },
        { rotate: withSpring(`${rotate}deg`, BASE_SPRING_CONFIG) },
        { scale: withSpring(scale, BASE_SPRING_CONFIG) },
      ],
    };
  });

  return (
    <Animated.View
      style={[rContainerStyle, styles.borderCurve]}
      className="absolute top-[25%] left-[15%] w-[42%] aspect-[1/1.2] rounded-3xl items-center justify-center gap-10 bg-blue-500"
    >
      <View className="size-20 rounded-full bg-stone-200" />
      <View className="h-5 w-20 rounded-full bg-neutral-200/25" />
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  borderCurve: {
    borderCurve: "continuous",
  },
});

// longevity-deck-onboarding-animation 🔼
