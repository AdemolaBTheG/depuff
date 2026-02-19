import { FC, useMemo } from 'react';
import { Blur, Canvas, Group, Paint, Paragraph, Skia } from '@shopify/react-native-skia';
import {
  useDerivedValue,
  SharedValue,
  withSequence,
  withTiming,
  withSpring,
  interpolate,
  Extrapolation,
} from 'react-native-reanimated';
import { Platform } from 'react-native';

import { SPRING_CONFIG_WITH_OVERSHOOT } from '@/lib/constants/daily-steps';
import { WheelDirection } from '@/lib/types/daily-steps';

// daily-steps-counter-animation 🔽

// Platform-specific blur intensity: iOS handles higher blur values better
// Creates motion blur effect during digit transitions for smoother visual feedback
const MAX_BLUR_INTENSITY = Platform.OS === "ios" ? 7.5 : 5;

type AnimatedDigitProps = {
  index: number;
  fontSize: number;
  fontWeight: number;
  digitWidth: number;
  currentIndex: SharedValue<number>;
  previousIndex: SharedValue<number>;
  wheelDirection: SharedValue<WheelDirection>;
};

export const AnimatedDigit: FC<AnimatedDigitProps> = ({
  index,
  fontSize,
  fontWeight,
  digitWidth,
  currentIndex,
  previousIndex,
  wheelDirection,
}) => {
  // Skia Paragraph: pre-renders digit text for efficient blur application
  // Memoized to avoid recreating on every render (only changes when props change)
  const paragraph = useMemo(() => {
    return Skia.ParagraphBuilder.Make()
      .pushStyle({
        color: Skia.Color('#0F172A'),
        fontSize,
        fontStyle: {
          weight: fontWeight,
        },
      })
      .addText(index.toString())
      .build();
  }, [index, fontSize, fontWeight]);

  // Derived values track digit state to optimize worklet performance
  const isCurrentDigit = useDerivedValue(() => {
    return currentIndex.get() === index;
  });

  const isPreviousDigit = useDerivedValue(() => {
    return previousIndex.get() === index;
  });

  // Animation progress drives blur intensity: 0 = blurred, 1 = sharp
  // Current digit: springs from blurred (0) to sharp (1)
  // Previous digit: springs from sharp (1) to blurred (0)
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

  // Blur interpolation: maps progress [0, 1] to blur [MAX_BLUR_INTENSITY, 0]
  // Input range: 0 (start transition) to 1 (end transition)
  // Output range: MAX_BLUR_INTENSITY (blurred) to 0 (sharp)
  // CLAMP prevents values outside [0, 1] range
  // Creates motion blur effect: digits start blurred, become sharp as they settle
  const blurIntensity = useDerivedValue(() => {
    if (wheelDirection.get() === "idle") {
      return 0;
    }

    return interpolate(
      animatedProgress.get(),
      [0, 1],
      [MAX_BLUR_INTENSITY, 0],
      Extrapolation.CLAMP,
    );
  });

  // Skia Canvas renders digit with animated blur effect
  // Paint layer applies blur filter to entire Group
  // y offset (fontSize * 0.05) aligns text baseline with container
  return (
    <Canvas style={{ flex: 1 }}>
      <Group
        layer={
          <Paint>
            <Blur blur={blurIntensity} />
          </Paint>
        }
      >
        <Paragraph paragraph={paragraph} x={0} y={fontSize * 0.05} width={digitWidth} />
      </Group>
    </Canvas>
  );
};

// daily-steps-counter-animation 🔼
