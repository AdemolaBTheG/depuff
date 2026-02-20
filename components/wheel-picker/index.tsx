import { StyleSheet, View } from 'react-native';

import { useCallback, useEffect, useMemo, useState } from 'react';

import { MaterialCommunityIcons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { PressableScale } from 'pressto';
import {
  useDerivedValue,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';

import { AnimatedCount } from './components/animated-count/animated-count';
import { DraggableSlider } from './components/draggable-slider';

type WheelPickerProps = {
  value: number;
  min: number;
  max: number;
  step?: number;
  onValueChange?: (value: number) => void;
  indicatorColor?: string;
  lineColor?: string;
  bigLineColor?: string;
  showExpandToggle?: boolean;
  scrollableAreaHeight?: number;
  textDigitWidth?: number;
  textDigitHeight?: number;
  fontSize?: number;
  textColor?: string;
  gradientAccentColor?: string;
};

const DEFAULT_STEP = 100;
const DEFAULT_SCROLL_HEIGHT = 150;

function clampToRange(value: number, min: number, max: number) {
  'worklet';
  return Math.min(max, Math.max(min, value));
}

function snapToStep(value: number, min: number, max: number, step: number) {
  'worklet';
  const bounded = clampToRange(value, min, max);
  const snapped = min + Math.round((bounded - min) / step) * step;
  return clampToRange(snapped, min, max);
}

export const WheelPicker = ({
  value,
  min,
  max,
  step = DEFAULT_STEP,
  onValueChange,
  indicatorColor = '#22d3ee',
  lineColor = 'rgba(0,0,0,0.24)',
  bigLineColor = 'rgba(0,0,0,0.44)',
  showExpandToggle = false,
  scrollableAreaHeight = DEFAULT_SCROLL_HEIGHT,
  textDigitWidth = 34,
  textDigitHeight = 56,
  fontSize = 46,
  textColor = '#000000',
  gradientAccentColor = '#FFFFFF',
}: WheelPickerProps) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const safeStep = Math.max(1, step);
  const range = Math.max(1, max - min);
  const linesAmount = Math.max(1, Math.round(range / safeStep));
  const maxDigits = Math.max(String(Math.abs(min)).length, String(Math.abs(max)).length);

  const initialValue = useMemo(
    () => snapToStep(value, min, max, safeStep),
    [max, min, safeStep, value]
  );

  const selectedValue = useSharedValue(initialValue);
  const previousLineIndex = useSharedValue(-1);
  const indicatorColorSv = useSharedValue(indicatorColor);

  useEffect(() => {
    indicatorColorSv.value = indicatorColor;
  }, [indicatorColor, indicatorColorSv]);

  useEffect(() => {
    selectedValue.value = initialValue;
  }, [initialValue, selectedValue]);

  const sendValueChange = useCallback(
    (next: number) => {
      onValueChange?.(next);
    },
    [onValueChange]
  );

  const triggerSelectionHaptic = useCallback(() => {
    void Haptics.selectionAsync();
  }, []);

  const animatedSpacePerLine = useDerivedValue<number>(() => {
    return withSpring(isExpanded ? 50 : 20, {
      dampingRatio: 1,
      duration: 500,
    });
  }, [isExpanded]);

  const animatedNumber = useDerivedValue(() => {
    return selectedValue.value;
  }, [selectedValue]);

  const initialProgress = (initialValue - min) / range;

  return (
    <View style={styles.container}>
      <AnimatedCount
        count={animatedNumber}
        maxDigits={maxDigits}
        textDigitWidth={textDigitWidth}
        textDigitHeight={textDigitHeight}
        fontSize={fontSize}
        color={textColor}
        gradientAccentColor={gradientAccentColor}
      />
      <DraggableSlider
        scrollableAreaHeight={scrollableAreaHeight}
        spacePerLine={animatedSpacePerLine}
        showBoundaryGradient
        bigLineIndexOffset={5}
        snapEach={1}
        linesAmount={linesAmount}
        maxLineHeight={22}
        minLineHeight={10}
        lineColor={lineColor}
        bigLineColor={bigLineColor}
        indicatorColor={indicatorColorSv}
        initialProgress={initialProgress}
        onProgressChange={(sliderProgress) => {
          'worklet';
          if (sliderProgress < 0) {
            return;
          }

          const boundedProgress = Math.min(1, Math.max(0, sliderProgress));
          const rawValue = min + boundedProgress * range;
          const nextValue = snapToStep(rawValue, min, max, safeStep);
          const lineIndex = Math.round((nextValue - min) / safeStep);

          if (nextValue !== selectedValue.value) {
            selectedValue.value = nextValue;
            scheduleOnRN(sendValueChange, nextValue);
          }

          if (lineIndex !== previousLineIndex.value) {
            previousLineIndex.value = lineIndex;
            scheduleOnRN(triggerSelectionHaptic);
          }
        }}
      />
      {showExpandToggle ? (
        <PressableScale
          style={styles.button}
          onPress={() => {
            setIsExpanded((prev) => !prev);
          }}>
          <MaterialCommunityIcons
            name={!isExpanded ? 'arrow-expand' : 'arrow-collapse'}
            size={26}
            color="white"
          />
        </PressableScale>
      ) : null}
    </View>
  );
};

const styles = StyleSheet.create({
  button: {
    alignItems: 'center',
    aspectRatio: 1,
    backgroundColor: '#111111',
    borderRadius: 32,
    bottom: -6,
    height: 54,
    justifyContent: 'center',
    position: 'absolute',
    right: 6,
  },
  container: {
    alignItems: 'center',
    width: '100%',
  },
});
