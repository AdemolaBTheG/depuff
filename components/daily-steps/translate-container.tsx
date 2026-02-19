import React, { FC, PropsWithChildren } from 'react';
import Animated, {
  SharedValue,
  useAnimatedStyle,
  useDerivedValue,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';

import { SPRING_CONFIG, SPRING_CONFIG_WITH_OVERSHOOT } from '@/lib/constants/daily-steps';
import { WheelDirection } from '@/lib/types/daily-steps';

// daily-steps-counter-animation 🔽

// Maximum rotation angle for 3D perspective effect during digit transitions
// Creates a "flip" illusion as digits rotate around X-axis
const ANGLE = 30;

type Props = {
  index: number;
  previousIndex: SharedValue<number>;
  currentIndex: SharedValue<number>;
  wheelDirection: SharedValue<WheelDirection>;
  fontSize: number;
  digitWidth: number;
};

export const TranslateContainer: FC<PropsWithChildren<Props>> = ({
  children,
  index,
  currentIndex,
  previousIndex,
  wheelDirection,
  fontSize,
  digitWidth,
}) => {
  // Calculate vertical translation distance based on font size
  // Used to create smooth vertical movement during digit transitions
  const translateDistance = fontSize / 1.75;

  // Fade in/out opacity animation synchronized with digit transitions
  // Current digit fades in, previous digit fades out using spring physics
  const opacity = useDerivedValue(() => {
    const isCurrentDigit = currentIndex.get() === index;
    const isPreviousDigit = previousIndex.get() === index;

    if (isCurrentDigit) {
      return withSpring(1, SPRING_CONFIG_WITH_OVERSHOOT);
    }

    if (isPreviousDigit) {
      return withSpring(0, SPRING_CONFIG_WITH_OVERSHOOT);
    }

    return 0;
  });

  // Vertical translation animation creates sliding effect during digit changes
  // Current digit: starts offset, springs to center (0)
  // Previous digit: springs from center to opposite offset
  // Uses sequence with instant timing (duration: 0) to set initial position before spring
  const translateY = useDerivedValue(() => {
    const isCurrentDigit = currentIndex.get() === index;
    const isPreviousDigit = previousIndex.get() === index;

    if (isCurrentDigit) {
      if (wheelDirection.get() === "increase") {
        // Increase: digit slides up from below, then springs to center
        return withSequence(
          withTiming(translateDistance, { duration: 0 }),
          withSpring(0, SPRING_CONFIG),
        );
      }

      if (wheelDirection.get() === "decrease") {
        // Decrease: digit slides down from above, then springs to center
        return withSequence(
          withTiming(-translateDistance, { duration: 0 }),
          withSpring(0, SPRING_CONFIG),
        );
      }
    }

    if (isPreviousDigit) {
      if (wheelDirection.get() === "increase") {
        // Previous digit exits upward
        return withSpring(-translateDistance, SPRING_CONFIG);
      }

      if (wheelDirection.get() === "decrease") {
        // Previous digit exits downward
        return withSpring(translateDistance, SPRING_CONFIG);
      }
    }

    // Idle or non-active digits maintain their position
    return wheelDirection.get() === "idle"
      ? withSpring(0, SPRING_CONFIG)
      : wheelDirection.get() === "increase"
        ? translateDistance
        : -translateDistance;
  });

  // 3D rotation around X-axis creates "flip card" effect during transitions
  // Rotation range: 0-360 degrees, with ANGLE offset for perspective depth
  // Current digit rotates from offset to full rotation (0 or 360)
  // Previous digit rotates from center to offset angle
  const angle = useDerivedValue(() => {
    const isCurrentDigit = currentIndex.get() === index;
    const isPreviousDigit = previousIndex.get() === index;

    if (isCurrentDigit) {
      if (wheelDirection.get() === "increase") {
        // Increase: rotate from 330° to 360° (full forward flip)
        return withSequence(
          withTiming(360 - ANGLE, { duration: 0 }),
          withSpring(360, SPRING_CONFIG),
        );
      }

      if (wheelDirection.get() === "decrease") {
        // Decrease: rotate from 30° to 0° (full backward flip)
        return withSequence(withTiming(ANGLE, { duration: 0 }), withSpring(0, SPRING_CONFIG));
      }
    }

    if (isPreviousDigit) {
      if (wheelDirection.get() === "increase") {
        // Previous digit flips backward to 30° angle
        return withSequence(withTiming(0, { duration: 0 }), withSpring(ANGLE, SPRING_CONFIG));
      }

      if (wheelDirection.get() === "decrease") {
        // Previous digit flips forward to 330° angle
        return withSequence(
          withTiming(360, { duration: 0 }),
          withSpring(360 - ANGLE, SPRING_CONFIG),
        );
      }
    }

    return 0;
  });

  // Combined animated style: opacity fade + vertical translation + 3D rotation
  // Perspective: 500px creates depth for 3D rotation effect (lower = more dramatic)
  // All transforms work together to create smooth digit transition animation
  const rTranslateYContainerStyle = useAnimatedStyle(() => {
    return {
      opacity: opacity.get(),
      transform: [
        {
          perspective: 500,
        },
        {
          translateY: translateY.get(),
        },
        {
          rotateX: `${angle.get()}deg`,
        },
      ],
    };
  });

  // Animated.View enables Reanimated animations on this container
  // Absolute positioning allows all 10 digit containers to stack and animate independently
  return (
    <Animated.View style={[{ position: 'absolute' }, rTranslateYContainerStyle, { height: fontSize, width: digitWidth }]}>
      {children}
    </Animated.View>
  );
};

// daily-steps-counter-animation 🔼
