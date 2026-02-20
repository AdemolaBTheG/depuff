import { FC } from "react";
import { View } from "react-native";
import Animated, { interpolateColor, SharedValue, useAnimatedStyle } from "react-native-reanimated";

// longevity-deck-onboarding-animation 🔽

interface DotProps {
  index: number;
  activeIndex: SharedValue<number>;
}

/**
 * Individual pagination dot that transitions color based on proximity to active slide.
 * Interpolation: [index-1, index, index+1] → [gray, white, gray]
 * Creates smooth color fade for dots adjacent to active slide.
 */
const Dot: FC<DotProps> = ({ index, activeIndex }) => {
  const animatedStyle = useAnimatedStyle(() => {
    return {
      backgroundColor: interpolateColor(
        activeIndex.get(),
        [index - 1, index, index + 1],
        ["#6f6f6f", "#ffffff", "#6f6f6f"]
      ),
    };
  });

  return <Animated.View className="size-2 rounded-full" style={animatedStyle} />;
};

interface PaginationDotsProps {
  numberOfDots: number;
  activeIndex: SharedValue<number>;
}

export const PaginationDots: FC<PaginationDotsProps> = ({ numberOfDots, activeIndex }) => {
  return (
    <View className="flex-row items-center justify-center gap-2">
      {Array.from({ length: numberOfDots }, (_, index) => (
        <Dot key={index} index={index} activeIndex={activeIndex} />
      ))}
    </View>
  );
};

// longevity-deck-onboarding-animation 🔼
