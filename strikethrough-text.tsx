import { FC, useEffect, useState } from 'react';
import { StyleSheet, Text, TextProps, View } from 'react-native';
import Animated, {
    Extrapolation,
    interpolate,
    SharedValue,
    useAnimatedStyle,
    useSharedValue,
    withTiming,
} from 'react-native-reanimated';
import { cn } from './components/cn';

type TextLineMetrics = {
  width: number;
  height: number;
  y: number;
};

type StrikethroughLineProps = {
  lineMetrics: TextLineMetrics;
  progressRange: number[];
  strikethroughProgress: SharedValue<number>;
  strikethroughColor: string;
};

const StrikethroughLine: FC<StrikethroughLineProps> = ({
  lineMetrics,
  progressRange,
  strikethroughProgress,
  strikethroughColor,
}) => {
  const strikethroughLineStyle = useAnimatedStyle(() => {
    return {
      width: interpolate(
        strikethroughProgress.get(),
        progressRange,
        [0, lineMetrics.width],
        Extrapolation.CLAMP
      ),
    };
  });

  return (
    <Animated.View
      style={[
        {
          top: lineMetrics.y + lineMetrics.height / 2,
        },
        strikethroughLineStyle,
      ]}
      className={cn('absolute left-0 h-[2px]', strikethroughColor)}
    />
  );
};

type StrikethroughTextProps = TextProps & {
  isSelected: boolean;
  animationDuration?: number;
  strikethroughColor?: string;
  selectedTextClassName?: string;
};

const StrikethroughText: FC<StrikethroughTextProps> = ({
  isSelected,
  animationDuration = 200,
  strikethroughColor = 'bg-red-500',
  selectedTextClassName,
  className,
  onTextLayout,
  children,
  ...textProps
}) => {
  const [textLineMetrics, setTextLineMetrics] = useState<TextLineMetrics[]>([]);
  const strikethroughProgress = useSharedValue(0);

  const totalTextWidth = textLineMetrics.reduce((acc, line) => acc + line.width, 0);

  const calculateLineProgressRanges = (
    lines: TextLineMetrics[],
    totalWidth: number
  ): number[][] => {
    if (lines.length === 0 || totalWidth <= 0) {
      return [];
    }

    const ranges: number[][] = [];
    let start = 0;
    for (let i = 0; i < lines.length; i += 1) {
      const end = start + lines[i].width / totalWidth;
      if (i === lines.length - 1) {
        ranges.push([start, 1]);
      } else {
        ranges.push([start, end]);
      }
      start = end;
    }
    return ranges;
  };

  const lineProgressRanges = calculateLineProgressRanges(textLineMetrics, totalTextWidth);

  useEffect(() => {
    if (isSelected) {
      strikethroughProgress.set(withTiming(1, { duration: animationDuration }));
    } else {
      strikethroughProgress.set(withTiming(0, { duration: animationDuration }));
    }
  }, [isSelected, animationDuration, strikethroughProgress]);

  const handleTextLayout = (event: Parameters<NonNullable<TextProps['onTextLayout']>>[0]) => {
    setTextLineMetrics(
      event.nativeEvent.lines.map((line) => ({
        width: line.width,
        height: line.height,
        y: line.y,
      }))
    );

    if (onTextLayout) {
      onTextLayout(event);
    }
  };

  return (
    <View style={styles.container}>
      <Text
        {...textProps}
        style={[styles.text, textProps.style]}
        className={cn(className, isSelected && selectedTextClassName)}
        onTextLayout={handleTextLayout}
      >
        {children}
      </Text>
      {textLineMetrics.map((lineMetrics, index) => {
        if (index >= lineProgressRanges.length) {
          return null;
        }

        return (
          <StrikethroughLine
            key={index}
            lineMetrics={lineMetrics}
            progressRange={lineProgressRanges[index]}
            strikethroughProgress={strikethroughProgress}
            strikethroughColor={strikethroughColor}
          />
        );
      })}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    position: 'relative',
    width: '100%',
    minWidth: 0,
    flexShrink: 1,
    alignSelf: 'stretch',
    overflow: 'hidden',
  },
  text: {
    width: '100%',
    maxWidth: '100%',
    minWidth: 0,
    flexShrink: 1,
    flexWrap: 'wrap',
    alignSelf: 'stretch',
  },
});

export default StrikethroughText;
