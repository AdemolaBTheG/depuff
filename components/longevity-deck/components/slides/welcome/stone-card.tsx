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

export const StoneCard: FC<SlideItemProps> = ({ index }) => {
  const { width: screenWidth } = useWindowDimensions();

  const { activeIndex } = use(AnimatedIndexContext);

  const rContainerStyle = useAnimatedStyle(() => {
    /**
     * translateX: Slides card left (off-screen) when scrolling to next slide.
     * Interpolation: [index, index+1] → [0, -screenWidth]
     * Moves card exactly one screen width to the left.
     */
    const translateX = interpolate(
      activeIndex.get(),
      [index, index + 1],
      [0, -screenWidth],
      Extrapolation.CLAMP
    );
    /**
     * rotate: Straightens card from 8° tilt to 0° as slide becomes active.
     * Interpolation: [index, index+0.5] → [8deg, 0deg]
     * Creates subtle "cards settling" effect during slide transition.
     */
    const rotate = interpolate(
      activeIndex.get(),
      [index, index + 0.5],
      [8, 0],
      Extrapolation.CLAMP
    );
    /**
     * scale: Slightly shrinks card (1 → 0.97) as slide becomes active.
     * Interpolation: [index, index+0.5] → [1, 0.97]
     * Adds depth perception - cards appear to move backward when inactive.
     */
    const scale = interpolate(
      activeIndex.get(),
      [index, index + 0.5],
      [1, 0.97],
      Extrapolation.CLAMP
    );

    return {
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
      className="absolute top-[22%] left-[63%] w-[38%] aspect-[1/1.2] rounded-3xl items-center justify-center gap-10 bg-stone-300"
    >
      <View className="size-20 rounded-full bg-stone-400" />
      <View className="h-5 w-20 rounded-full bg-neutral-200" />
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  borderCurve: {
    borderCurve: "continuous",
  },
});

// longevity-deck-onboarding-animation 🔼
