import React, { FC, use } from "react";
import { useWindowDimensions } from "react-native";
import { SlideTextContainer } from "../../slide-text-container";
import { AnimatedIndexContext } from "../../../lib/animated-index-context";
import { Extrapolation, interpolate, useAnimatedStyle, withSpring } from "react-native-reanimated";
import { BASE_SPRING_CONFIG } from "../../../lib/constants";
import { SlideItemProps } from "../../../lib/types";

// longevity-deck-onboarding-animation 🔽

export const HbotText: FC<SlideItemProps> = ({ index }) => {
  const { width: screenWidth } = useWindowDimensions();

  const { activeIndex } = use(AnimatedIndexContext);

  const rContainerStyle = useAnimatedStyle(() => {
    /**
     * translateX: Text enters from far right (150% screen width), centers, then exits left.
     * Interpolation: [index-1, index, index+1] → [screenWidth*1.5, 0, -screenWidth]
     * Starts off-screen to the right for dramatic entrance effect.
     */
    const translateX = interpolate(
      activeIndex.get(),
      [index - 1, index, index + 1],
      [screenWidth * 1.5, 0, -screenWidth],
      Extrapolation.CLAMP
    );

    return {
      transform: [{ translateX: withSpring(translateX, BASE_SPRING_CONFIG) }],
    };
  });

  return (
    <SlideTextContainer
      style={rContainerStyle}
      className="absolute top-[75%] left-[20%] max-w-[250px]"
      textClassName="text-center"
    >
      I'm doing HBOT therapy with Longevity Deck. Check it out!
    </SlideTextContainer>
  );
};

// longevity-deck-onboarding-animation 🔼
