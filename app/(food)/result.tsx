import { useFoodAnalysisStore } from '@/stores/foodAnalysisStore';
import { Theme } from '@/constants/Theme';
import type { DayFoodEntry } from '@/hooks/useDayStatus';
import { persistConfirmedFoodAnalysis } from '@/utils/food-intake';
import { hapticError, hapticImpact, hapticSelection, hapticSuccess } from '@/utils/haptics';
import { Button as AndroidButton, Host as AndroidHost } from '@expo/ui/jetpack-compose';
import { Button as IOSButton, Host as IOSHost, HStack as IOSHStack, Spacer as IOSSpacer } from '@expo/ui/swift-ui';
import { buttonStyle, controlSize, disabled as iosDisabled, tint } from '@expo/ui/swift-ui/modifiers';
import { Canvas, RoundedRect } from '@shopify/react-native-skia';
import { useQueryClient } from '@tanstack/react-query';
import { Image } from 'expo-image';
import { isLiquidGlassAvailable } from 'expo-glass-effect';
import { Stack, useRouter } from 'expo-router';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { interpolateColor, useDerivedValue, useSharedValue, withTiming } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { usePostHog } from 'posthog-react-native';

type BloatRiskLevel = 'low' | 'moderate' | 'high' | 'extreme';

function riskToColor(risk: BloatRiskLevel): string {
  switch (risk) {
    case 'low':
      return 'rgba(34, 197, 94, 1)';
    case 'moderate':
      return 'rgba(245, 158, 11, 1)';
    case 'high':
      return 'rgba(249, 115, 22, 1)';
    case 'extreme':
      return 'rgba(239, 68, 68, 1)';
    default:
      return 'rgba(15, 23, 42, 1)';
  }
}

function riskToProgress(risk: BloatRiskLevel): number {
  switch (risk) {
    case 'low':
      return 0.2;
    case 'moderate':
      return 0.45;
    case 'high':
      return 0.75;
    case 'extreme':
      return 1;
    default:
      return 0;
  }
}

type BloatRiskProgressBarProps = {
  risk: BloatRiskLevel;
};

function BloatRiskProgressBar({ risk }: BloatRiskProgressBarProps) {
  const [barWidth, setBarWidth] = useState(0);
  const progress = useSharedValue(riskToProgress(risk));
  const height = 10;

  useEffect(() => {
    progress.value = withTiming(riskToProgress(risk), { duration: 320 });
  }, [progress, risk]);

  const fillWidth = useDerivedValue(() => progress.value * barWidth, [barWidth]);
  const fillColor = useDerivedValue(
    () =>
      interpolateColor(
        progress.value,
        [0, 0.33, 0.66, 1],
        ['rgba(34, 197, 94, 1)', 'rgba(245, 158, 11, 1)', 'rgba(249, 115, 22, 1)', 'rgba(239, 68, 68, 1)']
      ),
    []
  );

  return (
    <View
      onLayout={(event) => {
        const nextWidth = Math.round(event.nativeEvent.layout.width);
        if (nextWidth !== barWidth) {
          setBarWidth(nextWidth);
        }
      }}
      style={{ height }}
    >
      {barWidth > 0 ? (
        <Canvas style={{ width: barWidth, height }}>
          <RoundedRect x={0} y={0} width={barWidth} height={height} r={height / 2} color="rgba(0,0,0,0.08)" />
          <RoundedRect x={0} y={0} width={fillWidth} height={height} r={height / 2} color={fillColor} />
        </Canvas>
      ) : null}
    </View>
  );
}

export default function FoodResultScreen() {
  const router = useRouter();
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const posthog = usePostHog();
  const queryClient = useQueryClient();
  const pendingAnalysis = useFoodAnalysisStore((state) => state.pendingAnalysis);
  const clearPendingAnalysis = useFoodAnalysisStore((state) => state.clearPendingAnalysis);
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const riskColor = useMemo(() => {
    if (!pendingAnalysis) return 'rgba(15, 23, 42, 1)';
    return riskToColor(pendingAnalysis.result.bloat_risk);
  }, [pendingAnalysis]);

  const canConfirm = useMemo(() => Boolean(pendingAnalysis) && !isSaving, [isSaving, pendingAnalysis]);

  const handleConfirm = useCallback(async () => {
    if (!pendingAnalysis || isSaving) return;

    setIsSaving(true);
    setSaveError(null);
    hapticImpact('light');

    try {
      const { logDate } = await persistConfirmedFoodAnalysis(pendingAnalysis);
      const optimisticFoodEntry: DayFoodEntry = {
        id: -Date.now(),
        foodName: pendingAnalysis.result.food_name,
        sodiumEstimateMg: pendingAnalysis.result.sodium_mg,
        bloatRiskLevel: pendingAnalysis.result.bloat_risk,
        aiReasoning: pendingAnalysis.result.counter_measure,
        localImageUri: pendingAnalysis.imageUri,
        createdAt: pendingAnalysis.capturedAt,
      };

      queryClient.setQueryData<DayFoodEntry[]>(['day-foods', logDate, 3], (current) => {
        const existing = current ?? [];
        const deduped = existing.filter(
          (item) =>
            !(
              item.createdAt === optimisticFoodEntry.createdAt &&
              item.foodName === optimisticFoodEntry.foodName &&
              item.sodiumEstimateMg === optimisticFoodEntry.sodiumEstimateMg
            )
        );
        return [optimisticFoodEntry, ...deduped].slice(0, 3);
      });

      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['day-balance', logDate] }),
        queryClient.invalidateQueries({ queryKey: ['day-status', logDate] }),
        queryClient.invalidateQueries({ queryKey: ['day-foods', logDate] }),
      ]);
      posthog?.capture('Food Log Confirmed', {
        food_name: pendingAnalysis.result.food_name,
        sodium_mg: pendingAnalysis.result.sodium_mg,
        bloat_risk: pendingAnalysis.result.bloat_risk,
      });
      clearPendingAnalysis();
      hapticSuccess();
      router.back();
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : t('food.errors.saveFailed', { defaultValue: 'Failed to save food log.' });
      posthog?.capture('Food Log Save Failed', {
        error_message: message,
      });
      setSaveError(message);
      hapticError();
    } finally {
      setIsSaving(false);
    }
  }, [clearPendingAnalysis, isSaving, pendingAnalysis, posthog, queryClient, router, t]);

  const handleCancel = useCallback(() => {
    hapticSelection();
    clearPendingAnalysis();
    router.replace('/(food)' as never);
  }, [clearPendingAnalysis, router]);

  return (
    <ScrollView
      contentInsetAdjustmentBehavior="automatic"
      style={styles.container}
      contentContainerStyle={{
        paddingHorizontal: 20,
        paddingTop: 16,
        paddingBottom: insets.bottom + 24,
        gap: 24,
      }}
    >
      <Stack.Screen options={{ title: pendingAnalysis?.result.food_name, headerShown: true, headerShadowVisible: false }} />

      {!pendingAnalysis ? (
        <View style={styles.emptyState}>
          <Text selectable style={styles.emptyTitle}>
            {t('food.noPendingScan', { defaultValue: 'No Pending Scan' })}
          </Text>
          <Text selectable style={styles.emptySecondary}>
            {t('food.captureBeforeResult', {
              defaultValue: 'Capture and analyze a food image first.',
            })}
          </Text>
        </View>
      ) : (
        <>
          {/* 1. Image Anchor */}
          <View style={styles.imageCard}>
            <Image source={{ uri: pendingAnalysis.imageUri }} style={styles.image} contentFit="cover" />
          </View>

          {/* 2. Hero Data Section */}
          <View style={styles.heroSection}>
       
            <View style={styles.heroSodiumContainer}>
              <Text selectable style={styles.heroSodiumValue}>
                {pendingAnalysis.result.sodium_mg.toLocaleString()}
              </Text>
              <Text selectable style={styles.heroSodiumUnit}>
                mg
              </Text>
            </View>
            <Text selectable style={styles.heroLabel}>
              {t('food.sodiumEstimate', { defaultValue: 'Estimated Sodium' }).toUpperCase()}
            </Text>
          </View>

          {/* 3. Insight Cards */}
          <View style={styles.insightsContainer}>
            <View style={styles.card}>
              <View style={styles.cardHeader}>
                <Text selectable style={styles.label}>
                  {t('food.bloatRisk', { defaultValue: 'Bloat Risk' }).toUpperCase()}
                </Text>
                <View style={[styles.badge, { backgroundColor: riskColor.replace(', 1)', ', 0.14)') }]}>
                  <Text selectable style={[styles.badgeText, { color: riskColor }]}>
                    {pendingAnalysis.result.bloat_risk.toUpperCase()}
                  </Text>
                </View>
              </View>
              <BloatRiskProgressBar risk={pendingAnalysis.result.bloat_risk} />
            </View>

            <View style={styles.card}>
              <Text selectable style={styles.label}>
                {t('food.counterMeasure', { defaultValue: 'Counter Measure' }).toUpperCase()}
              </Text>
              <Text selectable style={styles.secondary}>
                {pendingAnalysis.result.counter_measure}
              </Text>
            </View>
          </View>

          {saveError ? (
            <Text selectable style={styles.errorText}>
              {saveError}
            </Text>
          ) : null}

          {/* 4. Action Footer */}
          <View style={styles.resultActionsContainer}>
            {process.env.EXPO_OS === 'ios' ? (
              <IOSHost style={styles.iosActionsHost} matchContents useViewportSizeMeasurement>
                <IOSHStack spacing={12}>
                  <IOSButton
                    label={t('scan.newScan', { defaultValue: 'New Scan' })}
                    systemImage="camera.viewfinder"
                    role="cancel"
                    onPress={handleCancel}
                    modifiers={[
                      iosDisabled(isSaving),
                      controlSize('large'),
                      tint('#475569'),
                      buttonStyle(isLiquidGlassAvailable() ? 'glass' : 'bordered'),
                    ]}
                  />
                  <IOSSpacer />
                  <IOSButton
                    label={
                      isSaving
                        ? t('common.saving', { defaultValue: 'Saving...' })
                        : t('common.done', { defaultValue: 'Done' })
                    }
                    systemImage="checkmark"
                    onPress={() => void handleConfirm()}
                    modifiers={[
                      iosDisabled(!canConfirm),
                      buttonStyle(isLiquidGlassAvailable() ? 'glassProminent' : 'borderedProminent'),
                      tint(Theme.colors.accent),
                      controlSize('large'),
                    ]}
                  />
                </IOSHStack>
              </IOSHost>
            ) : process.env.EXPO_OS === 'android' ? (
              <View style={styles.actionsRow}>
                <AndroidHost style={styles.nativeActionItem}>
                  <AndroidButton onPress={handleCancel} variant="borderless" disabled={isSaving}>
                    {t('scan.newScan', { defaultValue: 'New Scan' })}
                  </AndroidButton>
                </AndroidHost>
                <AndroidHost style={styles.nativeActionItem}>
                  <AndroidButton onPress={() => void handleConfirm()} disabled={!canConfirm}>
                    {isSaving
                      ? t('common.saving', { defaultValue: 'Saving...' })
                      : t('common.done', { defaultValue: 'Done' })}
                  </AndroidButton>
                </AndroidHost>
              </View>
            ) : (
              <View style={styles.actionsRow}>
                <Pressable style={[styles.actionButton, styles.secondaryButton]} onPress={handleCancel}>
                  <Text selectable style={styles.secondaryButtonLabel}>
                    {t('scan.newScan', { defaultValue: 'New Scan' })}
                  </Text>
                </Pressable>
                <Pressable
                  style={[styles.actionButton, styles.primaryButton, !canConfirm ? styles.disabledButton : null]}
                  onPress={() => void handleConfirm()}
                  disabled={!canConfirm}
                >
                  <Text selectable style={styles.primaryButtonLabel}>
                    {isSaving
                      ? t('common.saving', { defaultValue: 'Saving...' })
                      : t('common.done', { defaultValue: 'Done' })}
                  </Text>
                </Pressable>
              </View>
            )}
          </View>
        </>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    // backgroundColor removed completely to let the system theme provide depth
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: 'rgba(0,0,0,0.9)',
    marginBottom: 8,
  },
  emptySecondary: {
    fontSize: 15,
    color: 'rgba(0,0,0,0.5)',
  },
  imageCard: {
    borderRadius: 24,
    borderCurve: 'continuous',
    overflow: 'hidden',
    backgroundColor: 'white',
  },
  image: {
    width: '100%',
    aspectRatio: 1,
  },
  heroSection: {
    alignItems: 'center',
    gap: 4,
  },
  heroFoodName: {
    fontSize: 14,
    fontWeight: '600',
    color: 'rgba(0,0,0,0.4)',
    marginBottom: 4,
  },
  heroSodiumContainer: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'center',
    gap: 4,
  },
  heroSodiumValue: {
    fontSize: 56,
    fontWeight: '800',
    color: '#000000',
    letterSpacing: -1.5,
    fontVariant: ['tabular-nums'],
  },
  heroSodiumUnit: {
    fontSize: 24,
    fontWeight: '700',
    color: 'rgba(34, 211, 238, 1)', // Cyan accent
  },
  heroLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: 'rgba(0,0,0,0.3)',
    letterSpacing: 0.5,
    marginTop: 2,
  },
  insightsContainer: {
    gap: 12,
  },
  card: {
    borderRadius: 20,
    borderCurve: 'continuous',
    backgroundColor: 'white',
    padding: 18,
    gap: 8,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  badge: {
    backgroundColor: 'rgba(34, 211, 238, 0.15)', // Light Cyan tint
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
  },
  badgeText: {
    color: '#0891B2', // Darker Cyan for contrast
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  label: {
    fontSize: 12,
    fontWeight: '700',
    color: 'rgba(0,0,0,0.4)',
    letterSpacing: 0.2,
  },
  secondary: {
    fontSize: 15,
    fontWeight: '500',
    color: 'rgba(0,0,0,0.8)',
    lineHeight: 22,
  },
  errorText: {
    alignSelf: 'center',
    color: '#EF4444',
    fontSize: 13,
    fontWeight: '600',
    borderRadius: 12,
    borderCurve: 'continuous',
    backgroundColor: '#FEF2F2',
    paddingHorizontal: 12,
    paddingVertical: 8,
    overflow: 'hidden',
  },
  actionsRow: {
    flexDirection: 'row',
    gap: 12,
  },
  resultActionsContainer: {
    width: '100%',
    marginTop: 8,
  },
  iosActionsHost: {
    width: '100%',
  },
  nativeActionItem: {
    flex: 1,
  },
  actionButton: {
    minHeight: 56,
    borderRadius: 16,
    borderCurve: 'continuous',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 16,
  },
  primaryButton: {
    flex: 2,
    backgroundColor: 'rgba(34, 211, 238, 1)', // Solid Cyan
  },
  secondaryButton: {
    flex: 1,
    backgroundColor: 'white',
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.08)',
  },
  primaryButtonLabel: {
    color: '#000000',
    fontSize: 16,
    fontWeight: '700',
  },
  secondaryButtonLabel: {
    color: 'rgba(0,0,0,0.6)',
    fontSize: 16,
    fontWeight: '600',
  },
  disabledButton: {
    opacity: 0.5,
  },
});
