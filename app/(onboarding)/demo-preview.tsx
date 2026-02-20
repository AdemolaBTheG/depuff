import { Theme } from '@/constants/Theme';
import { Button as AndroidButton } from '@expo/ui/jetpack-compose';
import { Button, Host, Text as IOSText } from '@expo/ui/swift-ui';
import { buttonStyle, controlSize, disabled, font, frame, padding, tint } from '@expo/ui/swift-ui/modifiers';
import { MaterialIcons } from '@expo/vector-icons';
import { isLiquidGlassAvailable } from 'expo-glass-effect';
import * as Haptics from 'expo-haptics';
import { Image } from 'expo-image';
import { Stack, router, useLocalSearchParams } from 'expo-router';
import { SymbolView } from 'expo-symbols';
import { usePostHog } from 'posthog-react-native';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Platform, ScrollView, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import Animated, {
  Easing,
  FadeIn,
  FadeInDown,
  FadeInUp,
  FadeOut,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { useTranslation } from 'react-i18next';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const TOTAL_STEPS = 10;
const STEP_INDEX = 7;

type DemoPreviewParams = {
  imageUri?: string | string[];
};

type PlanStep = {
  icon: string;
  androidIcon: keyof typeof MaterialIcons.glyphMap;
  color: string;
  labelKey: string;
};
const MOCK_TREND = [78, 72, 68, 63, 58, 54, 49];

function firstParamValue(value?: string | string[]): string | undefined {
  if (!value) return undefined;
  return Array.isArray(value) ? value[0] : value;
}

export default function OnboardingDemoPreviewScreen() {
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const { t } = useTranslation();
  const posthog = usePostHog();
  const params = useLocalSearchParams<DemoPreviewParams>();
  const imageUri = useMemo(() => firstParamValue(params.imageUri), [params.imageUri]);
  const progress = useMemo(() => (STEP_INDEX + 1) / TOTAL_STEPS, []);
  const planSteps: PlanStep[] = useMemo(
    () => [
      {
        icon: 'face.smiling',
        androidIcon: 'face',
        color: Theme.colors.accent,
        labelKey: 'onboarding.demoPreview.steps.contours',
      },
      {
        icon: 'drop.fill',
        androidIcon: 'water-drop',
        color: '#3B82F6',
        labelKey: 'onboarding.demoPreview.steps.zones',
      },
      {
        icon: 'chart.line.uptrend.xyaxis',
        androidIcon: 'query-stats',
        color: '#F59E0B',
        labelKey: 'onboarding.demoPreview.steps.profile',
      },
      {
        icon: 'sparkles',
        androidIcon: 'auto-awesome',
        color: '#22C55E',
        labelKey: 'onboarding.demoPreview.steps.plan',
      },
    ],
    []
  );
  const hotspots = useMemo(
    () => [
      t('onboarding.demoPreview.hotspots.underEye'),
      t('onboarding.demoPreview.hotspots.midFace'),
      t('onboarding.demoPreview.hotspots.jawline'),
    ],
    [t]
  );
  const actionItems = useMemo(
    () => [
      t('onboarding.demoPreview.actions.hydration'),
      t('onboarding.demoPreview.actions.sodium'),
      t('onboarding.demoPreview.actions.walk'),
    ],
    [t]
  );

  const [phase, setPhase] = useState<'building' | 'ready'>('building');
  const [completedSteps, setCompletedSteps] = useState(0);
  const progressValue = useSharedValue(0);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const finishTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isIOS = process.env.EXPO_OS === 'ios';
  const reduceMotion = useReducedMotion();

  useEffect(() => {
    let next = 0;
    intervalRef.current = setInterval(() => {
      next += 1;
      setCompletedSteps(next);
      progressValue.value = withTiming(next / planSteps.length, {
        duration: 500,
        easing: Easing.out(Easing.cubic),
      });

      if (isIOS) {
        void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      }

      if (next >= planSteps.length) {
        if (intervalRef.current) {
          clearInterval(intervalRef.current);
          intervalRef.current = null;
        }
        finishTimeoutRef.current = setTimeout(() => {
          if (isIOS) {
            void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
          }
          setPhase('ready');
          posthog?.capture('Onboarding Demo Preview Ready');
        }, 420);
      }
    }, 760);

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
      if (finishTimeoutRef.current) {
        clearTimeout(finishTimeoutRef.current);
      }
    };
  }, [isIOS, planSteps.length, posthog, progressValue]);

  const loadingBarStyle = useAnimatedStyle(() => ({
    width: `${progressValue.value * 100}%`,
  }));

  const handleUnlock = () => {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    posthog?.capture('Onboarding Demo Unlock Pressed');
    router.push('/(onboarding)/notifications');
  };

  return (
    <View style={styles.container}>
      <Stack.Screen options={{ headerShown: false }} />

      <ScrollView
        contentInsetAdjustmentBehavior="automatic"
        contentContainerStyle={[styles.content, { paddingTop: insets.top + 16, paddingBottom: insets.bottom + 110 }]}>
        <Animated.View entering={reduceMotion ? undefined : FadeIn.duration(300)} style={styles.progressTrack}>
          <View style={[styles.progressFill, { width: `${Math.round(progress * 100)}%` }]} />
        </Animated.View>

        <Animated.Text
          entering={reduceMotion ? undefined : FadeInUp.duration(350).delay(40)}
          selectable
          style={styles.title}>
          {phase === 'building'
            ? t('onboarding.demoPreview.titleBuilding')
            : t('onboarding.demoPreview.titleReady')}
        </Animated.Text>
        <Animated.Text
          entering={reduceMotion ? undefined : FadeInUp.duration(350).delay(80)}
          selectable
          style={styles.subtitle}>
          {phase === 'building'
            ? t('onboarding.demoPreview.subtitleBuilding')
            : t('onboarding.demoPreview.subtitleReady')}
        </Animated.Text>

        <Animated.View entering={reduceMotion ? undefined : FadeInUp.duration(320).delay(120)} style={styles.previewBadge}>
          <Text selectable style={styles.previewBadgeText}>
            {t('onboarding.demoPreview.badge')}
          </Text>
        </Animated.View>

        {imageUri ? (
          <Animated.View entering={reduceMotion ? undefined : FadeInDown.duration(380).delay(160)}>
            <Image source={{ uri: imageUri }} contentFit="cover" transition={180} style={styles.previewImage} />
          </Animated.View>
        ) : (
          <Animated.View entering={reduceMotion ? undefined : FadeInDown.duration(380).delay(160)} style={styles.previewFallback}>
            <Text selectable style={styles.previewFallbackText}>
              {t('onboarding.demoPreview.imageUnavailable')}
            </Text>
          </Animated.View>
        )}

        {phase === 'building' ? (
          <Animated.View
            entering={reduceMotion ? undefined : FadeInDown.duration(360).delay(200)}
            exiting={reduceMotion ? undefined : FadeOut.duration(220)}
            style={styles.card}>
            <View style={styles.buildingHeaderRow}>
              <Text selectable style={styles.cardTitle}>
                {t('onboarding.demoPreview.generating')}
              </Text>
            </View>
            <View style={styles.loadingBarTrack}>
              <Animated.View style={[styles.loadingBarFill, loadingBarStyle]} />
            </View>
            <View style={styles.stepsList}>
              {planSteps.map((step, index) => {
                const isDone = index < completedSteps;
                const isCurrent = index === completedSteps;
                const iconColor = isDone ? '#FFFFFF' : isCurrent ? step.color : 'rgba(0,0,0,0.34)';
                return (
                  <Animated.View
                    key={step.labelKey}
                    entering={
                      reduceMotion ? undefined : FadeInDown.duration(280).delay(240 + index * 90)
                    }
                    style={styles.stepRow}>
                    <View
                      style={[
                        styles.stepIconContainer,
                        {
                          backgroundColor: isDone
                            ? step.color
                            : isCurrent
                              ? `${step.color}24`
                              : 'rgba(0,0,0,0.06)',
                        },
                      ]}>
                      {Platform.OS === 'ios' ? (
                        <SymbolView name={{ ios: (isDone ? 'checkmark' : step.icon) as any, android: 'circle' }} size={16} tintColor={iconColor} />
                      ) : (
                        <MaterialIcons
                          name={isDone ? 'check' : step.androidIcon}
                          size={18}
                          color={iconColor}
                        />
                      )}
                    </View>
                    <Text
                      selectable
                      style={[
                        styles.stepLabel,
                        isDone ? styles.stepLabelDone : null,
                        isCurrent ? styles.stepLabelCurrent : null,
                      ]}>
                      {t(step.labelKey)}
                    </Text>
                    {isDone ? (
                      Platform.OS === 'ios' ? (
                        <SymbolView name={{ ios: 'checkmark.circle.fill', android: 'check_circle' }} size={18} tintColor={step.color} />
                      ) : (
                        <MaterialIcons name="check-circle" size={20} color={step.color} />
                      )
                    ) : (
                      <View style={styles.stepTrailingSpacer} />
                    )}
                  </Animated.View>
                );
              })}
            </View>
          </Animated.View>
        ) : (
          <Animated.View
            entering={reduceMotion ? undefined : FadeIn.duration(260)}
            style={styles.readyBlock}>
            <Animated.View
              entering={reduceMotion ? undefined : FadeInUp.duration(340).delay(70)}
              style={styles.card}>
              <Text selectable style={styles.cardTitle}>
                {t('onboarding.demoPreview.hotspotsTitle')}
              </Text>
              <View style={styles.chipRow}>
                {hotspots.map((spot) => (
                  <View key={spot} style={styles.chip}>
                    <Text selectable style={styles.chipText}>
                      {spot}
                    </Text>
                  </View>
                ))}
              </View>
            </Animated.View>

            <Animated.View
              entering={reduceMotion ? undefined : FadeInUp.duration(340).delay(140)}
              style={styles.card}>
              <Text selectable style={styles.cardTitle}>
                {t('onboarding.demoPreview.actionTitle')}
              </Text>
              <View style={styles.actionList}>
                {actionItems.map((item) => (
                  <Text key={item} selectable style={styles.actionText}>
                    - {item}
                  </Text>
                ))}
              </View>
            </Animated.View>

            <Animated.View
              entering={reduceMotion ? undefined : FadeInUp.duration(340).delay(220)}
              style={styles.card}>
              <Text selectable style={styles.cardTitle}>
                {t('onboarding.demoPreview.trendTitle')}
              </Text>
              <View style={styles.trendRow}>
                {MOCK_TREND.map((value, index) => (
                  <View key={index.toString()} style={styles.trendBarWrap}>
                    <View style={[styles.trendBar, { height: `${Math.max(22, value)}%` }]} />
                    <Text selectable style={styles.trendLabel}>
                      D{index + 1}
                    </Text>
                  </View>
                ))}
              </View>
            </Animated.View>
          </Animated.View>
        )}
      </ScrollView>

      {process.env.EXPO_OS === 'ios' ? (
        <View style={[styles.iosCtaWrap, { bottom: insets.bottom + 12 }]}>
          <Host matchContents useViewportSizeMeasurement>
            <Button
              onPress={handleUnlock}
              modifiers={[
                buttonStyle(isLiquidGlassAvailable() ? 'glassProminent' : 'borderedProminent'),
                tint(Theme.colors.accent),
                controlSize('regular'),
                disabled(phase === 'building'),
              ]}>
              <IOSText
                modifiers={[
                  font({ size: 17, weight: 'medium' }),
                  padding({ horizontal: 12, vertical: 6 }),
                  frame({ width: width * 0.88 }),
                ]}>
                {phase === 'building'
                  ? t('onboarding.demoPreview.buildingCta')
                  : t('common.continue')}
              </IOSText>
            </Button>
          </Host>
        </View>
      ) : (
        <View style={[styles.androidCtaWrap, { paddingBottom: insets.bottom + 12 }]}>
          <AndroidButton color={Theme.colors.accent} onPress={handleUnlock} disabled={phase === 'building'}>
            {phase === 'building'
              ? t('onboarding.demoPreview.buildingCta')
              : t('common.continue')}
          </AndroidButton>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  actionList: {
    gap: 8,
  },
  actionText: {
    color: 'rgba(0,0,0,0.8)',
    fontSize: 15,
    lineHeight: 20,
    fontWeight: '500',
  },
  androidCtaWrap: {
    position: 'absolute',
    left: 16,
    right: 16,
    bottom: 0,
    gap: 8,
  },
  buildingHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    borderCurve: 'continuous',
    padding: 16,
    gap: 10,
    boxShadow: '0 8px 24px rgba(0,0,0,0.06)',
  },
  cardTitle: {
    color: '#000000',
    fontSize: 16,
    fontWeight: '700',
  },
  chip: {
    borderRadius: 999,
    borderCurve: 'continuous',
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: `${Theme.colors.accent}1F`,
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  chipText: {
    color: Theme.colors.accent,
    fontSize: 13,
    fontWeight: '600',
  },
  container: {
    flex: 1,
    backgroundColor: '#F2F2F7',
  },
  content: {
    paddingHorizontal: 16,
    gap: 14,
  },
  loadingBarFill: {
    height: '100%',
    backgroundColor: Theme.colors.accent,
  },
  loadingBarTrack: {
    marginTop: 4,
    height: 6,
    borderRadius: 999,
    borderCurve: 'continuous',
    backgroundColor: 'rgba(0,0,0,0.08)',
    overflow: 'hidden',
  },
  iosCtaWrap: {
    position: 'absolute',
    left: 16,
    right: 16,
    gap: 10,
    alignItems: 'center',
  },
  previewBadge: {
    alignSelf: 'flex-start',
    borderRadius: 999,
    borderCurve: 'continuous',
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: 'rgba(0,0,0,0.08)',
  },
  previewBadgeText: {
    fontSize: 12,
    color: 'rgba(0,0,0,0.66)',
    fontWeight: '600',
  },
  previewFallback: {
    width: '100%',
    aspectRatio: 1,
    borderRadius: 24,
    borderCurve: 'continuous',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.08)',
  },
  previewFallbackText: {
    color: 'rgba(0,0,0,0.52)',
    fontWeight: '600',
  },
  previewImage: {
    width: '100%',
    aspectRatio: 1,
    borderRadius: 24,
    borderCurve: 'continuous',
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
  readyBlock: {
    gap: 14,
  },
  stepIconContainer: {
    width: 34,
    height: 34,
    borderRadius: 10,
    borderCurve: 'continuous',
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepLabel: {
    flex: 1,
    fontSize: 14,
    color: 'rgba(0,0,0,0.42)',
    fontWeight: '500',
  },
  stepLabelCurrent: {
    color: '#000000',
    fontWeight: '600',
  },
  stepLabelDone: {
    color: 'rgba(0,0,0,0.8)',
  },
  stepRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  stepsList: {
    marginTop: 4,
    gap: 10,
  },
  stepTrailingSpacer: {
    width: 18,
    height: 18,
  },
  subtitle: {
    marginTop: -4,
    fontSize: 15,
    lineHeight: 21,
    color: 'rgba(0,0,0,0.6)',
  },
  title: {
    marginTop: 24,
    fontSize: 30,
    lineHeight: 36,
    fontWeight: '600',
    color: '#000000',
  },
  trendBar: {
    width: 20,
    borderRadius: 8,
    borderCurve: 'continuous',
    backgroundColor: Theme.colors.accent,
  },
  trendBarWrap: {
    width: 28,
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: 6,
  },
  trendLabel: {
    fontSize: 11,
    color: 'rgba(0,0,0,0.52)',
    fontVariant: ['tabular-nums'],
  },
  trendRow: {
    height: 120,
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    gap: 8,
  },
});
