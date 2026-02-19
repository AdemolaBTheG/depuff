import React, { FC, PropsWithChildren } from 'react';
import Animated, {
  Extrapolation,
  interpolate,
  SharedValue,
  useAnimatedStyle,
  useDerivedValue,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';

import { SPRING_CONFIG_WITH_OVERSHOOT } from '@/lib/constants/daily-steps';
import { WheelDirection } from '@/lib/types/daily-steps';

// daily-steps-counter-animation 🔽

// Minimum scale value during transition creates "zoom in" effect
// Digits scale from 50% to 100% as they become active
const MIN_SCALE = 0.5;

type Props = {
  index: number;
  currentIndex: SharedValue<number>;
  previousIndex: SharedValue<number>;
  wheelDirection: SharedValue<WheelDirection>;
};

export const ScaleContainer: FC<PropsWithChildren<Props>> = ({
  children,
  index,
  currentIndex,
  previousIndex,
  wheelDirection,
}) => {
  // Derived values track digit state to avoid recalculations in worklets
  const isCurrentDigit = useDerivedValue(() => {
    return currentIndex.get() === index;
  });

  const isPreviousDigit = useDerivedValue(() => {
    return previousIndex.get() === index;
  });

  // Animation progress: 0 = start of transition, 1 = fully transitioned
  // Current digit: springs from 0 to 1 (with overshoot for bounce effect)
  // Previous digit: springs from 1 to 0 (fades out)
  // Instant timing (duration: 0) resets to 0 before spring animation starts
  const animatedProgress = useDerivedValue(() => {
    if (isCurrentDigit.get()) {
      return withSequence(
        withTiming(0, { duration: 0 }),
        withSpring(1, SPRING_CONFIG_WITH_OVERSHOOT),
      );
    }

    if (isPreviousDigit.get()) {
      return withSpring(0, SPRING_CONFIG_WITH_OVERSHOOT);
    }

    return 0;
  });

  // Scale interpolation: maps progress [0, 1] to scale [MIN_SCALE, 1]
  // Input range: 0 (start) to 1 (end)
  // Output range: MIN_SCALE (0.5) to 1 (full size)
  // CLAMP prevents values outside [0, 1] range
  // Only applies scale during active transitions (not idle)
  const rScaleStyle = useAnimatedStyle(() => {
    if (wheelDirection.get() === "idle") {
      // Idle state: no transforms, digits at full scale
      return {
        transform: [
          {
            scale: 1,
          },
          {
            rotateX: "0deg",
          },
        ],
      };
    }

    return {
      transform: [
        {
          scale: interpolate(animatedProgress.get(), [0, 1], [MIN_SCALE, 1], Extrapolation.CLAMP),
        },
      ],
    };
  });

  return (
    <Animated.View style={[{ flex: 1 }, rScaleStyle]}>
      {children}
    </Animated.View>
  );
};

// daily-steps-counter-animation 🔼
