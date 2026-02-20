import React, { FC, use } from "react";
import { useWindowDimensions } from "react-native";
import { SlideTextContainer } from "../../slide-text-container";
import { Extrapolation, interpolate, useAnimatedStyle, withSpring } from "react-native-reanimated";
import { BASE_SPRING_CONFIG } from "../../../lib/constants";
import { AnimatedIndexContext } from "../../../lib/animated-index-context";
import { SlideItemProps } from "../../../lib/types";

// longevity-deck-onboarding-animation 🔽

export const PodcastsText: FC<SlideItemProps> = ({ index }) => {
  const { width: screenWidth } = useWindowDimensions();

  const { activeIndex } = use(AnimatedIndexContext);

  const rContainerStyle = useAnimatedStyle(() => {
    /**
     * translateX: Text enters from right, centers, then exits left.
     * Interpolation: [index-1, index, index+1] → [screenWidth*0.75, 0, -screenWidth]
     * Starts 75% screen width to the right, creating staggered entry effect.
     */
    const translateX = interpolate(
      activeIndex.get(),
      [index - 1, index, index + 1],
      [screenWidth * 0.75, 0, -screenWidth],
      Extrapolation.CLAMP
    );

    return {
      transform: [{ translateX: withSpring(translateX, BASE_SPRING_CONFIG) }],
    };
  });

  return (
    <SlideTextContainer
      style={rContainerStyle}
      className="absolute top-[80%] left-[20%] max-w-[250px]"
      textClassName="text-center"
    >
      Scanned 17 podcasts, 12 blogs and 5 scientific publications.
    </SlideTextContainer>
  );
};

// longevity-deck-onboarding-animation 🔼
