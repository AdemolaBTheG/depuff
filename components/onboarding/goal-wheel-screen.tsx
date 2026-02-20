import { Theme } from '@/constants/Theme';
import { useOnboardingStore } from '@/stores/onboardingStore';
import { WheelPicker } from '@/components/wheel-picker';
import { Button as AndroidButton } from '@expo/ui/jetpack-compose';
import { Button, Host, Text as IOSText } from '@expo/ui/swift-ui';
import {
  buttonStyle,
  controlSize,
  font,
  frame,
  padding,
  tint,
} from '@expo/ui/swift-ui/modifiers';
import { isLiquidGlassAvailable } from 'expo-glass-effect';
import * as Haptics from 'expo-haptics';
import { router } from 'expo-router';
import { usePostHog } from 'posthog-react-native';
import { useMemo, useRef } from 'react';
import { StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export type GoalWheelScreenConfig = {
  questionId: string;
  title: string;
  subtitle: string;
  unit: string;
  minimum: number;
  maximum: number;
  step: number;
  stepIndex: number;
  totalSteps: number;
  ctaLabel: string;
  nextRoute: string;
  defaultValue: number;
  shouldCompleteOnContinue?: boolean;
  onSave: (value: number) => void;
};

function clampAndSnap(value: number, minimum: number, maximum: number, step: number) {
  const bounded = Math.min(maximum, Math.max(minimum, value));
  const snapped = minimum + Math.round((bounded - minimum) / step) * step;
  return Math.min(maximum, Math.max(minimum, snapped));
}

export default function GoalWheelScreenView({ config }: { config: GoalWheelScreenConfig }) {
  const { width } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const isIOS = process.env.EXPO_OS === 'ios';
  const { t } = useTranslation();
  const posthog = usePostHog();
  const { setQuizAnswer, setOnboardingCompleted } = useOnboardingStore();

  const startingValue = useMemo(
    () => clampAndSnap(config.defaultValue, config.minimum, config.maximum, config.step),
    [config.defaultValue, config.maximum, config.minimum, config.step]
  );
  const selectedValueRef = useRef(startingValue);
  const progress = (config.stepIndex + 1) / config.totalSteps;

  function handleContinue() {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

    config.onSave(selectedValueRef.current);
    setQuizAnswer(config.questionId, String(selectedValueRef.current));

    if (config.shouldCompleteOnContinue) {
      setOnboardingCompleted(true);
    }

    posthog?.capture('Onboarding Goal Selected', {
      question: config.questionId,
      value: selectedValueRef.current,
      unit: config.unit,
    });

    router.push(config.nextRoute as any);
  }

  return (
    <View style={[styles.container, { paddingTop: insets.top + 24 }]}>
      <View style={styles.progressTrack}>
        <View style={[styles.progressFill, { width: `${Math.round(progress * 100)}%` }]} />
      </View>

      <Text selectable style={styles.title}>
        {t(config.title)}
      </Text>
      <Text selectable style={styles.subtitle}>
        {t(config.subtitle)}
      </Text>

      <View style={styles.valueWrap}>
        <WheelPicker
          value={startingValue}
          min={config.minimum}
          max={config.maximum}
          step={config.step}
          onValueChange={(value) => {
            selectedValueRef.current = value;
          }}
          indicatorColor={Theme.colors.accent}
          lineColor="rgba(0,0,0,0.24)"
          bigLineColor="rgba(0,0,0,0.44)"
          scrollableAreaHeight={180}
          textDigitWidth={36}
          textDigitHeight={56}
          fontSize={48}
          boundaryGradientColor="#F2F2F7"
        />
        <Text selectable style={styles.unitLabel}>
          {t(config.unit)}
        </Text>
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
            onPress={handleContinue}
            modifiers={[
              buttonStyle(isLiquidGlassAvailable() ? 'glassProminent' : 'borderedProminent'),
              tint(Theme.colors.accent),
              controlSize('regular'),
            ]}>
            <IOSText
              modifiers={[
                font({ size: 17, weight: 'medium' }),
                padding({ horizontal: 12, vertical: 6 }),
                frame({ width: width * 0.8 }),
              ]}>
              {t(config.ctaLabel)}
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
          <AndroidButton onPress={handleContinue} color={Theme.colors.accent}>
            {t(config.ctaLabel)}
          </AndroidButton>
        </View>
      )}
    </View>
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
  subtitle: {
    marginTop: 8,
    fontSize: 15,
    lineHeight: 21,
    color: 'rgba(0,0,0,0.6)',
    textAlign: 'center',
  },
  title: {
    marginTop: 48,
    fontSize: 30,
    lineHeight: 36,
    fontWeight: '600',
    textAlign: 'center',
    color: '#000000',
  },
  unitLabel: {
    marginTop: 8,
    fontSize: 16,
    color: 'rgba(0,0,0,0.6)',
    fontWeight: '600',
  },
  valueWrap: {
    width: '100%',
    marginTop: 44,
    alignItems: 'center',
  },
});
