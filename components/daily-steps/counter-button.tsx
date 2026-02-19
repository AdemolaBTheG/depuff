import { FC, ReactNode } from 'react';
import { Pressable, StyleSheet } from 'react-native';
import Animated, {
  Extrapolation,
  interpolate,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';

const HIGHLIGHT_ANIMATION_DURATION = 150;
const MIN_SCALE = 0.9;
const MAX_SCALE = 1.05;

type CounterButtonProps = {
  onPress: () => void;
  icon: ReactNode;
};

export const CounterButton: FC<CounterButtonProps> = ({ onPress, icon }) => {
  const pressProgress = useSharedValue(0);

  const overlayStyle = useAnimatedStyle(() => {
    const scale = interpolate(
      pressProgress.get(),
      [0, 1],
      [MIN_SCALE, MAX_SCALE],
      Extrapolation.CLAMP
    );

    return {
      opacity: pressProgress.get(),
      transform: [{ scale }],
    };
  });

  const handlePressIn = () => {
    pressProgress.set(withTiming(1, { duration: HIGHLIGHT_ANIMATION_DURATION }));
  };

  const handlePressOut = () => {
    pressProgress.set(withTiming(0, { duration: HIGHLIGHT_ANIMATION_DURATION }));
  };

  return (
    <Pressable onPress={onPress} onPressIn={handlePressIn} onPressOut={handlePressOut} style={styles.button}>
      <Animated.View style={[styles.overlay, overlayStyle]} />
      {icon}
    </Pressable>
  );
};

const styles = StyleSheet.create({
  button: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: 12,
    borderCurve: 'continuous',
    backgroundColor: 'rgba(2, 132, 199, 0.16)',
  },
});
