import { FC, useState } from 'react';
import { StyleSheet, Text } from 'react-native';
import Animated, {
  LinearTransition,
  useAnimatedReaction,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withTiming,
} from 'react-native-reanimated';

import { useDigitalCounter } from '@/lib/digital-counter-context';
import { WheelDirection } from '@/lib/types/daily-steps';

import { AnimatedDigit } from './animated-digit';
import { ScaleContainer } from './scale-container';
import { TranslateContainer } from './translate-container';

const FONT_SIZE = 44;
const FONT_WEIGHT: '700' = '700';
const WHEEL_ENTER_DURATION = 160;
const WHEEL_EXIT_DELAY = 160;
const WHEEL_EXIT_DURATION = 140;

type DigitalWheelProps = {
  index: number;
};

export const DigitalWheel: FC<DigitalWheelProps> = ({ index: wheelIndex }) => {
  const [digitWidths, setDigitWidths] = useState<number[]>([]);
  const { counter, currentWheelDigits, previousWheelDigits, direction } = useDigitalCounter();

  const currentIndex = useSharedValue(0);
  const previousIndex = useSharedValue(0);
  const wheelDirection = useSharedValue<WheelDirection>('increase');

  useAnimatedReaction(
    () => currentWheelDigits.get(),
    (nextDigits) => {
      currentIndex.set(nextDigits[wheelIndex]);
      previousIndex.set(previousWheelDigits.get()[wheelIndex]);

      const isDigitsDifferent = nextDigits[wheelIndex] !== previousWheelDigits.get()[wheelIndex];
      wheelDirection.set(isDigitsDifferent ? direction.get() : 'idle');
    }
  );

  const rContainerStyle = useAnimatedStyle(() => {
    const maxWidth = Math.max(...digitWidths, 0);
    const wheelIndexWithMarginRight = counter.get() > 9999 ? 1 : 0;
    const isVisible = wheelIndex + 1 <= counter.get().toString().length;
    const targetMarginRight = isVisible && wheelIndex === wheelIndexWithMarginRight ? 12 : 0;

    if (maxWidth === 0) {
      return {
        opacity: 0,
        width: 0,
        marginRight: 0,
      };
    }

    if (!isVisible) {
      return {
        opacity: withDelay(WHEEL_EXIT_DELAY, withTiming(0, { duration: WHEEL_EXIT_DURATION })),
        width: withDelay(WHEEL_EXIT_DELAY, withTiming(0, { duration: WHEEL_EXIT_DURATION })),
        marginRight: withTiming(0, { duration: WHEEL_EXIT_DURATION }),
      };
    }

    return {
      opacity: withTiming(1, { duration: WHEEL_ENTER_DURATION }),
      width: withTiming(maxWidth, { duration: WHEEL_ENTER_DURATION }),
      marginRight: withTiming(targetMarginRight, { duration: WHEEL_ENTER_DURATION }),
    };
  });

  return (
    <>
      <Animated.View
        layout={LinearTransition.springify()}
        style={[styles.wheelContainer, rContainerStyle, { height: FONT_SIZE, transform: [{ translateX: -4 * wheelIndex }] }]}
      >
        {Array.from({ length: 10 }, (_, index) => (
          <TranslateContainer
            key={index}
            index={index}
            currentIndex={currentIndex}
            previousIndex={previousIndex}
            wheelDirection={wheelDirection}
            fontSize={FONT_SIZE}
            digitWidth={digitWidths[index] ?? 0}
          >
            <ScaleContainer
              index={index}
              currentIndex={currentIndex}
              previousIndex={previousIndex}
              wheelDirection={wheelDirection}
            >
              <AnimatedDigit
                index={index}
                fontSize={FONT_SIZE}
                fontWeight={Number(FONT_WEIGHT)}
                digitWidth={digitWidths[index] ?? 0}
                currentIndex={currentIndex}
                previousIndex={previousIndex}
                wheelDirection={wheelDirection}
              />
            </ScaleContainer>
          </TranslateContainer>
        ))}
      </Animated.View>

      {Array.from({ length: 10 }, (_, index) => (
        <Text
          key={index}
          style={styles.measurementDigit}
          onTextLayout={({ nativeEvent }) => {
            const width = Math.round(nativeEvent.lines[0]?.width ?? 0);
            setDigitWidths((previous) => {
              const next = [...previous];
              next[index] = width;
              return next;
            });
          }}
          pointerEvents="none"
        >
          {index}
        </Text>
      ))}
    </>
  );
};

const styles = StyleSheet.create({
  wheelContainer: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  measurementDigit: {
    position: 'absolute',
    opacity: 0,
    color: '#0F172A',
    fontSize: FONT_SIZE,
    fontWeight: FONT_WEIGHT,
  },
});
