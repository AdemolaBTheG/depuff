import React, { FC } from "react";
import { HbotText } from "./hbot-text";
import { BlueCard } from "./blue-card";
import { StoneCard } from "./stone-card";
import { SlideContainer } from "../../slide-container";

// longevity-deck-onboarding-animation 🔽

const SLIDE_INDEX = 3;

export const Share: FC = () => {
  return (
    <SlideContainer index={SLIDE_INDEX}>
      <StoneCard index={SLIDE_INDEX} />
      <BlueCard index={SLIDE_INDEX} />
      <HbotText index={SLIDE_INDEX} />
    </SlideContainer>
  );
};

// longevity-deck-onboarding-animation 🔼
