import React, { FC, use } from "react";
import { useWindowDimensions } from "react-native";
import { SlideTextContainer } from "../../slide-text-container";
import { AnimatedIndexContext } from "../../../lib/animated-index-context";
import { Extrapolation, interpolate, useAnimatedStyle, withSpring } from "react-native-reanimated";
import { BASE_SPRING_CONFIG } from "../../../lib/constants";
import { SlideItemProps } from "../../../lib/types";

// longevity-deck-onboarding-animation 🔽

export const UpdatedTodayText: FC<SlideItemProps> = ({ index }) => {
  const { width: screenWidth } = useWindowDimensions();

  const { activeIndex } = use(AnimatedIndexContext);

  const rContainerStyle = useAnimatedStyle(() => {
    /**
     * translateX: Text enters from right, centers, then exits left.
     * Interpolation: [index-1, index, index+1] → [screenWidth*0.25, 0, -screenWidth]
     * Starts 25% screen width to the right for subtle entry effect.
     */
    const translateX = interpolate(
      activeIndex.get(),
      [index - 1, index, index + 1],
      [screenWidth * 0.25, 0, -screenWidth],
      Extrapolation.CLAMP
    );

    return {
      transform: [{ translateX: withSpring(translateX, BASE_SPRING_CONFIG) }],
    };
  });

  return (
    <SlideTextContainer style={rContainerStyle} className="absolute -top-[5%] left-[10%]">
      ⏰ Updated today
    </SlideTextContainer>
  );
};

// longevity-deck-onboarding-animation 🔼
