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
     * translateX: Card enters from right (1/3 screen width), centers, then exits left.
     * Interpolation: [index-0.5, index, index+1] → [screenWidth/3, 0, -screenWidth]
     * Starts mid-transition from previous slide for smooth entrance.
     */
    const translateX = interpolate(
      activeIndex.get(),
      [index - 0.5, index, index + 1],
      [screenWidth / 3, 0, -screenWidth],
      Extrapolation.CLAMP
    );
    /**
     * rotate: Card tilts from 0° to -4° then back to 0°.
     * Interpolation: [index-1, index, index+0.5] → [0deg, -4deg, 0deg]
     * Creates subtle "card settling" effect as slide becomes active.
     */
    const rotate = interpolate(
      activeIndex.get(),
      [index - 1, index, index + 0.5],
      [0, -4, 0],
      Extrapolation.CLAMP
    );
    /**
     * scale: Dramatic size change from 150% down to 100%, then slightly shrinks.
     * Interpolation: [index-1, index, index+0.5] → [1.5, 1, 0.98]
     * Card starts large (zoom effect) then scales to normal size.
     */
    const scale = interpolate(
      activeIndex.get(),
      [index - 1, index, index + 0.5],
      [1.5, 1, 0.98],
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
