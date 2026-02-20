import { Theme } from '@/constants/Theme';
import { Button as AndroidButton } from '@expo/ui/jetpack-compose';
import { Button, Host, Text as IOSText } from '@expo/ui/swift-ui';
import { buttonStyle, controlSize, font, frame, padding, tint } from '@expo/ui/swift-ui/modifiers';
import { isLiquidGlassAvailable } from 'expo-glass-effect';
import * as Haptics from 'expo-haptics';
import { Image } from 'expo-image';
import { Stack, router } from 'expo-router';
import { usePostHog } from 'posthog-react-native';
import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { OneSignal } from 'react-native-onesignal';
import Animated, {
  FadeIn,
  interpolate,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const TOTAL_STEPS = 10;
const STEP_INDEX = 8;
const CARD_COUNT = 3;
const APP_ICON = require('../../assets/images/depuff.icon/Assets/ChatGPT Image 20. Feb. 2026, 21_20_00.png');
const ITEM_BODY_KEYS = [
  'onboarding.notifications.item_0',
  'onboarding.notifications.item_1',
  'onboarding.notifications.item_2',
] as const;

const AnimatedView = Animated.createAnimatedComponent(View);

export default function OnboardingNotificationsScreen() {
  const { width } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const posthog = usePostHog();
  const { t } = useTranslation();
  const progress = (STEP_INDEX + 1) / TOTAL_STEPS;
  const isIOS = process.env.EXPO_OS === 'ios';

  const handleContinue = async () => {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    posthog?.capture('Onboarding Notifications Permission Requested');
    try {
      const granted = await OneSignal.Notifications.requestPermission(false);
      posthog?.capture('Onboarding Notifications Permission Result', {
        granted,
      });
    } catch (error) {
      posthog?.capture('Onboarding Notifications Permission Result', {
        granted: false,
        error_message: error instanceof Error ? error.message : 'unknown_error',
      });
      console.warn('Notification permission prompt failed', error);
    }
    router.push('/(onboarding)/rating');
  };

  return (
    <View style={styles.container}>
      <Stack.Screen options={{ headerShown: false }} />

      <View style={[styles.content, { paddingTop: insets.top + 24 }]}>
        <AnimatedView entering={FadeIn.duration(260)} style={styles.progressTrack}>
          <View style={[styles.progressFill, { width: `${Math.round(progress * 100)}%` }]} />
        </AnimatedView>

        <Text selectable style={styles.title}>
          {t('onboarding.notifications.title')}
        </Text>
        <Text selectable style={styles.subtitle}>
          {t('onboarding.notifications.subtitle')}
        </Text>

        <View style={styles.stackArea}>
          {Array.from({ length: CARD_COUNT }).map((_, index) => (
            <NotificationCard key={index.toString()} index={index} />
          ))}
        </View>
      </View>

      {isIOS ? (
        <Host
          matchContents
          useViewportSizeMeasurement
          style={{
            position: 'absolute',
            bottom: insets.bottom + 12,
            alignSelf: 'center',
          }}
        >
          <Button
            onPress={handleContinue}
            modifiers={[
              buttonStyle(isLiquidGlassAvailable() ? 'glassProminent' : 'borderedProminent'),
              tint(Theme.colors.accent),
              controlSize('regular'),
            ]}
          >
            <IOSText
              modifiers={[
                font({ size: 17, weight: 'medium' }),
                padding({ horizontal: 12, vertical: 6 }),
                frame({ width: width * 0.84 }),
              ]}
            >
              {t('common.continue')}
            </IOSText>
          </Button>
        </Host>
      ) : (
        <View
          style={{
            width: width * 0.84,
            position: 'absolute',
            bottom: insets.bottom + 12,
            alignSelf: 'center',
          }}
        >
          <AndroidButton onPress={handleContinue} color={Theme.colors.accent}>
            {t('common.continue')}
          </AndroidButton>
        </View>
      )}
    </View>
  );
}

function NotificationCard({ index }: { index: number }) {
  const { t } = useTranslation();
  const progress = useSharedValue(0);

  const animatedStyle = useAnimatedStyle(() => {
    return {
      opacity: progress.value,
      transform: [
        {
          translateY: interpolate(progress.value, [0, 1], [24, index * 20]),
        },
        {
          scale: interpolate(progress.value, [0, 1], [0.96, 1 - index * 0.04]),
        },
      ],
    };
  }, [index]);

  useEffect(() => {
    progress.value = withDelay(
      index * 500,
      withTiming(1, { duration: 420 }, (finished) => {
        'worklet';
        if (finished) {
          runOnJS(Haptics.impactAsync)(Haptics.ImpactFeedbackStyle.Medium);
        }
      })
    );
  }, [index, progress]);

  const timeLabel =
    index === 0
      ? t('onboarding.notifications.time_5m')
      : index === 1
        ? t('onboarding.notifications.time_2m')
        : t('onboarding.notifications.time_now');

  return (
    <AnimatedView style={[styles.card, animatedStyle]}>
      <Image source={APP_ICON} style={styles.icon} contentFit="cover" />
      <View style={styles.cardContent}>
        <View style={styles.cardHeaderRow}>
          <Text selectable numberOfLines={1} style={styles.cardTitle}>
            {t('onboarding.notifications.item_title')}
          </Text>
          <Text selectable style={styles.cardTime}>
            {timeLabel}
          </Text>
        </View>
        <Text selectable numberOfLines={3} style={styles.cardBody}>
          {t(ITEM_BODY_KEYS[index])}
        </Text>
      </View>
    </AnimatedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F2F2F7',
  },
  content: {
    flex: 1,
    paddingHorizontal: 16,
    alignItems: 'center',
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
    color: '#000000',
    textAlign: 'center',
  },
  subtitle: {
    marginTop: 8,
    fontSize: 15,
    lineHeight: 21,
    color: 'rgba(0,0,0,0.6)',
    textAlign: 'center',
  },
  stackArea: {
    marginTop: 54,
    width: '100%',
    height: 220,
    alignItems: 'center',
    justifyContent: 'flex-start',
  },
  card: {
    position: 'absolute',
    width: '96%',
    flexDirection: 'row',
    gap: 12,
    borderRadius: 20,
    borderCurve: 'continuous',
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 14,
    paddingVertical: 12,
    boxShadow: '0 8px 24px rgba(0,0,0,0.08)',
  },
  icon: {
    width: 44,
    height: 44,
    borderRadius: 12,
    borderCurve: 'continuous',
    backgroundColor: `${Theme.colors.accent}22`,
  },
  cardContent: {
    flex: 1,
    gap: 4,
  },
  cardHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
  },
  cardTitle: {
    flex: 1,
    minWidth: 0,
    fontSize: 15,
    fontWeight: '700',
    color: '#000000',
  },
  cardTime: {
    fontSize: 12,
    fontWeight: '600',
    color: 'rgba(0,0,0,0.46)',
  },
  cardBody: {
    fontSize: 13,
    lineHeight: 18,
    color: 'rgba(0,0,0,0.72)',
    flexShrink: 1,
  },
});
