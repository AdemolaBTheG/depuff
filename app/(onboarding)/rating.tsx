import { Theme } from '@/constants/Theme';
import { askForReview } from '@/utils/review';
import { useOnboardingStore } from '@/stores/onboardingStore';
import { Button as AndroidButton } from '@expo/ui/jetpack-compose';
import { Button, Host, Text as IOSText } from '@expo/ui/swift-ui';
import { buttonStyle, controlSize, font, frame, padding, tint } from '@expo/ui/swift-ui/modifiers';
import { isLiquidGlassAvailable } from 'expo-glass-effect';
import * as Haptics from 'expo-haptics';
import { Stack, router } from 'expo-router';
import LottieView from 'lottie-react-native';
import { usePostHog } from 'posthog-react-native';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Platform, Pressable, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const TOTAL_STEPS = 10;
const STEP_INDEX = 9;
const RATING_ANIMATION = require('../../assets/animations/rating.json');

export default function OnboardingRatingScreen() {
  const { width } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const { t } = useTranslation();
  const posthog = usePostHog();
  const isIOS = Platform.OS === 'ios';
  const [didTapRate, setDidTapRate] = useState(false);
  const progress = (STEP_INDEX + 1) / TOTAL_STEPS;
  const { setHasSeenStoreReview, setOnboardingCompleted } = useOnboardingStore();

  const goToPaywall = () => {
    setOnboardingCompleted(true);
    router.replace('/(paywalls)/onboardingPaywall');
  };

  const handleRateNow = async () => {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setDidTapRate(true);
    const requested = await askForReview();
    posthog?.capture('Onboarding Rating Prompt', {
      action: 'rate_now',
      requested,
    });
    setHasSeenStoreReview(true);
  };

  const handleSecondaryAction = () => {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    posthog?.capture('Onboarding Rating Prompt', {
      action: didTapRate ? 'continue_after_rate' : 'skip',
    });
    setHasSeenStoreReview(true);
    goToPaywall();
  };

  return (
    <View style={styles.container}>
      <Stack.Screen options={{ headerShown: false }} />

      <View style={[styles.content, { paddingTop: insets.top + 24 }]}>
        <View style={styles.progressTrack}>
          <View style={[styles.progressFill, { width: `${Math.round(progress * 100)}%` }]} />
        </View>

        <Text selectable style={styles.title}>
          {t('onboarding.rating.title')}
        </Text>
        <Text selectable style={styles.subtitle}>
          {t('onboarding.rating.subtitle')}
        </Text>

        <LottieView
          autoPlay
          loop
          source={RATING_ANIMATION}
          style={{
            width: Math.min(width * 0.9, 360),
            height: Math.min(width * 0.9, 360),
            marginTop: 20,
          }}
        />
      </View>

      {isIOS ? (
        <Host
          matchContents
          useViewportSizeMeasurement
          style={[styles.iosPrimaryWrap, { bottom: insets.bottom + 12 }]}>
          <Button
            onPress={handleRateNow}
            modifiers={[
              buttonStyle(isLiquidGlassAvailable() ? 'glassProminent' : 'borderedProminent'),
              tint(Theme.colors.accent),
              controlSize('regular'),
            ]}>
            <IOSText
              modifiers={[
                font({ size: 17, weight: 'medium' }),
                padding({ horizontal: 12, vertical: 6 }),
                frame({ width: width * 0.84 }),
              ]}>
              {t('onboarding.rating.cta_rate')}
            </IOSText>
          </Button>
        </Host>
      ) : (
        <View style={[styles.androidPrimaryWrap, { width: width * 0.84, bottom: insets.bottom + 12 }]}>
          <AndroidButton onPress={handleRateNow} color={Theme.colors.accent}>
            {t('onboarding.rating.cta_rate')}
          </AndroidButton>
        </View>
      )}

      <Pressable
        onPress={handleSecondaryAction}
        hitSlop={8}
        style={[
          styles.secondaryActionWrap,
          { bottom: insets.bottom + (isIOS ? 84 : 72) },
        ]}>
        <Text selectable style={styles.secondaryActionLabel}>
          {didTapRate ? t('common.continue') : t('onboarding.rating.cta_skip')}
        </Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  androidPrimaryWrap: {
    position: 'absolute',
    alignSelf: 'center',
  },
  container: {
    flex: 1,
    backgroundColor: '#F2F2F7',
  },
  content: {
    flex: 1,
    alignItems: 'center',
    paddingHorizontal: 16,
  },
  iosPrimaryWrap: {
    position: 'absolute',
    alignSelf: 'center',
  },
  progressFill: {
    height: '100%',
    backgroundColor: Theme.colors.accent,
  },
  progressTrack: {
    width: '100%',
    height: 8,
    borderRadius: 999,
    borderCurve: 'continuous',
    backgroundColor: 'rgba(0,0,0,0.08)',
    overflow: 'hidden',
  },
  secondaryActionLabel: {
    color: 'rgba(0,0,0,0.56)',
    fontSize: 16,
    fontWeight: '500',
  },
  secondaryActionWrap: {
    position: 'absolute',
    alignSelf: 'center',
    paddingHorizontal: 10,
    paddingVertical: 8,
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
    color: '#000000',
    textAlign: 'center',
  },
});
