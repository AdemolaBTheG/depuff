import React, { FC } from "react";
import { AttentionText } from "./attention-text";
import { BlueCard } from "./blue-card";
import { StoneCard } from "./stone-card";
import { SlideContainer } from "../../slide-container";

// longevity-deck-onboarding-animation 🔽

const SLIDE_INDEX = 4;

export const NotMedicalAdvice: FC = () => {
  return (
    <SlideContainer index={SLIDE_INDEX}>
      <StoneCard index={SLIDE_INDEX} />
      <BlueCard index={SLIDE_INDEX} />
      <AttentionText index={SLIDE_INDEX} />
    </SlideContainer>
  );
};

// longevity-deck-onboarding-animation 🔼
