import { Theme } from '@/constants/Theme';
import { useOnboardingStore } from '@/stores/onboardingStore';
import { Button as AndroidButton } from '@expo/ui/jetpack-compose';
import { Button, Host, Text as IOSText } from '@expo/ui/swift-ui';
import {
  buttonStyle,
  controlSize,
  disabled,
  font,
  frame,
  padding,
  tint,
} from '@expo/ui/swift-ui/modifiers';
import { isLiquidGlassAvailable } from 'expo-glass-effect';
import * as Haptics from 'expo-haptics';
import { router } from 'expo-router';
import { SymbolView } from 'expo-symbols';
import { usePostHog } from 'posthog-react-native';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import Animated, {
  interpolateColor,
  useAnimatedReaction,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const TOTAL_STEPS = 6;
const AnimatedPressable = Animated.createAnimatedComponent(Pressable);
const SELECTED_ANSWER_BG = `${Theme.colors.accent}26`;

export type QuizOption = {
  id: string;
  label: string;
  icon: string;
};

export type QuizScreenConfig = {
  questionId: string;
  title: string;
  subtitle: string;
  options: QuizOption[];
  step: number;
  ctaLabel: string;
  nextRoute: string;
  shouldCompleteOnContinue?: boolean;
};

export default function QuizScreenView({ config }: { config: QuizScreenConfig }) {
  const { width } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const isIOS = process.env.EXPO_OS === 'ios';
  const posthog = usePostHog();
  const [selected, setSelected] = useState<string | null>(null);
  const { setQuizAnswer, setOnboardingCompleted } = useOnboardingStore();
  const progress = (config.step + 1) / TOTAL_STEPS;

  function handleSelect(optionId: string) {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    posthog?.capture('Onboarding Quiz Option Selected', {
      question: config.questionId,
      option: optionId,
    });
    setSelected(optionId);
  }

  function handleContinue() {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    if (!selected) return;
    setQuizAnswer(config.questionId, selected);
    if (config.shouldCompleteOnContinue) {
      setOnboardingCompleted(true);
    }
    posthog?.capture('Onboarding Quiz Continued', {
      question: config.questionId,
      answer: selected,
    });
    router.push(config.nextRoute as any);
  }

  return (
    <View style={[styles.container, { paddingTop: insets.top + 24 }]}>
      <View style={styles.progressTrack}>
        <View style={[styles.progressFill, { width: `${Math.round(progress * 100)}%` }]} />
      </View>

      <Text selectable style={styles.title}>
        {config.title}
      </Text>
      <Text selectable style={styles.subtitle}>
        {config.subtitle}
      </Text>

      <View style={styles.optionsContainer}>
        {config.options.map((option) => (
          <AnswerCard
            key={option.id}
            option={option}
            isSelected={selected === option.id}
            onPress={handleSelect}
          />
        ))}
      </View>

      {isIOS ? (
        <Host
          matchContents
          useViewportSizeMeasurement
          style={{
            position: 'absolute',
            bottom: insets.bottom + 12,
            alignSelf: 'center',
          }}>
          <Button
            onPress={() => handleContinue()}
            modifiers={[
              buttonStyle(isLiquidGlassAvailable() ? 'glassProminent' : 'borderedProminent'),
              tint(Theme.colors.accent),
              disabled(selected === null),
              controlSize('regular'),
            ]}>
            <IOSText
              modifiers={[
                font({ size: 17, weight: 'medium' }),
                padding({ horizontal: 12, vertical: 6 }),
                frame({ width: width * 0.8 }),
              ]}>
              {config.ctaLabel}
            </IOSText>
          </Button>
        </Host>
      ) : (
        <View
          style={{
            width: width * 0.8,
            position: 'absolute',
            bottom: insets.bottom + 12,
            alignSelf: 'center',
          }}>
          <AndroidButton
            onPress={() => handleContinue()}
            disabled={selected === null}
            color={Theme.colors.accent}>
            {config.ctaLabel}
          </AndroidButton>
        </View>
      )}
    </View>
  );
}

function AnswerCard({
  option,
  isSelected,
  onPress,
}: {
  option: QuizOption;
  isSelected: boolean;
  onPress: (id: string) => void;
}) {
  const scale = useSharedValue(1);
  const focused = useSharedValue(0);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
    borderColor: interpolateColor(focused.value, [0, 1], ['#fff', Theme.colors.accent]),
    backgroundColor: interpolateColor(focused.value, [0, 1], ['#ffffff', SELECTED_ANSWER_BG]),
  }));

  useAnimatedReaction(
    () => focused.value,
    () => {
      if (isSelected) {
        focused.value = withTiming(1);
      } else {
        focused.value = withTiming(0);
      }
    },
  );

  function onPressIn() {
    scale.value = withTiming(0.95);
  }

  function onPressOut() {
    scale.value = withTiming(1);
    onPress(option.id);
  }

  return (
    <AnimatedPressable
      onPressIn={() => onPressIn()}
      onPressOut={() => onPressOut()}
      style={[styles.answerCard, animatedStyle]}>
      <View style={[styles.answerIconWrap, { backgroundColor: isSelected ? Theme.colors.accent : `${Theme.colors.accent}18` }]}>
        <SymbolView
          name={{ ios: option.icon as any, android: 'circle' }}
          size={22}
          tintColor={isSelected ? '#FFFFFF' : Theme.colors.accent}
        />
      </View>
      <Text
        selectable
        style={[styles.answerLabel, { color: isSelected ? Theme.colors.accent : '#000' }]}>
        {option.label}
      </Text>
      {isSelected && (
        <SymbolView
          name={{ ios: 'checkmark.circle.fill', android: 'check_circle' }}
          size={22}
          tintColor={Theme.colors.accent}
        />
      )}
    </AnimatedPressable>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    paddingHorizontal: 16,
  },
  progressTrack: {
    width: '100%',
    height: 8,
    borderRadius: 999,
    borderCurve: 'continuous',
    backgroundColor: 'rgba(0,0,0,0.08)',
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: Theme.colors.accent,
  },
  title: {
    marginTop: 48,
    fontSize: 30,
    lineHeight: 36,
    fontWeight: '600',
    textAlign: 'center',
    color: '#000000',
  },
  subtitle: {
    marginTop: 8,
    fontSize: 15,
    lineHeight: 21,
    color: 'rgba(0,0,0,0.6)',
    textAlign: 'center',
  },
  optionsContainer: {
    width: '100%',
    marginTop: 40,
    gap: 16,
  },
  answerCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    width: '100%',
    borderWidth: 2,
    borderRadius: 16,
    borderCurve: 'continuous',
    minHeight: 56,
  },
  answerIconWrap: {
    width: 44,
    height: 44,
    borderRadius: 12,
    borderCurve: 'continuous',
    alignItems: 'center',
    justifyContent: 'center',
  },
  answerLabel: {
    flex: 1,
    fontSize: 16,
    fontWeight: '600',
  },
});
