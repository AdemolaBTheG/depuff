import React, { FC, use } from "react";
import { useWindowDimensions } from "react-native";
import { SlideTextContainer } from "../../slide-text-container";
import { AnimatedIndexContext } from "../../../lib/animated-index-context";
import { Extrapolation, interpolate, useAnimatedStyle, withSpring } from "react-native-reanimated";
import { BASE_SPRING_CONFIG } from "../../../lib/constants";
import { SlideItemProps } from "../../../lib/types";

// longevity-deck-onboarding-animation 🔽

export const EightyThreeIsBetterText: FC<SlideItemProps> = ({ index }) => {
  const { width: screenWidth } = useWindowDimensions();

  const { activeIndex } = use(AnimatedIndexContext);

  const rContainerStyle = useAnimatedStyle(() => {
    /**
     * translateX: Slides text left (off-screen) when scrolling to next slide.
     * Interpolation: [index, index+1] → [0, -screenWidth]
     */
    const translateX = interpolate(
      activeIndex.get(),
      [index, index + 1],
      [0, -screenWidth],
      Extrapolation.CLAMP
    );

    return {
      transform: [{ translateX: withSpring(translateX, BASE_SPRING_CONFIG) }],
    };
  });

  return (
    <SlideTextContainer style={rContainerStyle} className="absolute top-[78%] left-[46%]">
      83° is better
    </SlideTextContainer>
  );
};

// longevity-deck-onboarding-animation 🔼
