import React, { FC } from "react";
import { View } from "react-native";
import { StoneCard } from "./stone-card";
import { FivePerWeekText } from "./five-per-week-text";
import { EightyThreeIsBetterText } from "./eighty-three-is-better";
import { OnceAWeekText } from "./once-a-week-text";
import { HundredTenIsBetterText } from "./hundred-ten-is-better-text";
import { SlideContainer } from "../../slide-container";

// longevity-deck-onboarding-animation 🔽

const SLIDE_INDEX = 1;

export const Essentials: FC = () => {
  return (
    <SlideContainer index={SLIDE_INDEX}>
      <FivePerWeekText index={SLIDE_INDEX} />
      <OnceAWeekText index={SLIDE_INDEX} />
      <HundredTenIsBetterText index={SLIDE_INDEX} />
      <StoneCard index={SLIDE_INDEX} />
      <EightyThreeIsBetterText index={SLIDE_INDEX} />
    </SlideContainer>
  );
};

// longevity-deck-onboarding-animation 🔼
