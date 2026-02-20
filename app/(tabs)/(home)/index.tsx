import { AIChecklist } from '@/components/ai-checklist';
import { CounterControls } from '@/components/daily-steps/counter-controls';
import { DigitalCounter } from '@/components/daily-steps/digital-counter';
import { PAYWALL_ROUTE } from '@/constants/gating';
import { useSubscription } from '@/context/SubscriptionContext';
import { dailyLogs, faceScans } from '@/db/schema';
import {
  getDayStatus,
  toDailyDate,
  useDayBalance,
  useDayRecentFoods,
  type DayBalance,
  type DayFoodEntry,
  type DayStatus
} from '@/hooks/useDayStatus';
import { DigitalCounterProvider } from '@/lib/digital-counter-context';
import { useDbStore } from '@/stores/dbStore';
import { useSettingsStore } from '@/stores/settingsStore';
import { hapticSelection, hapticSuccess } from '@/utils/haptics';
import {
  Button as IOSButton,
  Host as IOSHost,
} from '@expo/ui/swift-ui';
import { buttonStyle, controlSize, tint } from '@expo/ui/swift-ui/modifiers';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { Canvas, Group, Path, RoundedRect, Skia } from '@shopify/react-native-skia';
import { useQueries, useQuery, useQueryClient } from '@tanstack/react-query';
import * as Burnt from 'burnt';
import { desc, eq, sql } from 'drizzle-orm';
import { Image } from 'expo-image';
import { Link, useRouter } from 'expo-router';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { PlatformColor, Pressable, ScrollView, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { interpolateColor, useDerivedValue, useSharedValue, withTiming } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const DAYS_TO_SHOW = 7;
const WATER_STEP_ML = 250;
const SCAN_RING_SIZE = 98;
const SCAN_RING_STROKE = 10;
const EMPTY_ACTIONABLE_STEPS: { id: string; text: string; completed: boolean }[] = [];
const EMPTY_RECENT_FOODS: DayFoodEntry[] = [];

type WeekItem = {
  date: string;
  dayLetter: string;
  progressPercent: 0 | 50 | 100;
};
type ProgressColorStop = [number, string];
type ScanSummary = {
  createdAt: string;
  score: number;
  feedback: string | null;
  flaggedAreas: string | null;
  localImageUri: string | null;
  deltaVsYesterday: number | null;
};

const HYDRATION_COLOR_STOPS: ProgressColorStop[] = [
  [0, '#67E8F9'],
  [1, '#06B6D4'],
];

const SODIUM_COLOR_STOPS: ProgressColorStop[] = [
  [0, '#22C55E'],
  [0.75, '#F59E0B'],
  [1, '#EF4444'],
];

function clamp01(value: number): number {
  return Math.min(1, Math.max(0, value));
}

function buildRecentDates(days: number): string[] {
  const today = new Date();
  const items: string[] = [];
  for (let i = days - 1; i >= 0; i -= 1) {
    const date = new Date(today);
    date.setDate(today.getDate() - i);
    items.push(toDailyDate(date));
  }
  return items;
}

function dayLetterFromDate(date: string, locale: string): string {
  const label = new Intl.DateTimeFormat(locale, { weekday: 'short' }).format(new Date(date));
  return label.slice(0, 1).toUpperCase();
}

function formatFoodLogTime(createdAt: string | null, locale: string, unknownTimeLabel: string): string {
  if (!createdAt) return unknownTimeLabel;
  const normalized = createdAt.includes('T') ? createdAt : createdAt.replace(' ', 'T');
  const parsed = new Date(normalized);
  if (Number.isNaN(parsed.getTime())) return unknownTimeLabel;
  return new Intl.DateTimeFormat(locale, {
    hour: 'numeric',
    minute: '2-digit',
  }).format(parsed);
}

function formatRiskLabel(value: string | null, unknownLabel: string): string {
  if (!value) return unknownLabel;
  return value
    .replace(/[_-]/g, ' ')
    .toLowerCase()
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function shiftDate(dateKey: string, offsetDays: number): string {
  const parsed = new Date(`${dateKey}T00:00:00`);
  if (Number.isNaN(parsed.getTime())) return dateKey;
  parsed.setDate(parsed.getDate() + offsetDays);
  return toDailyDate(parsed);
}

function formatScanLoggedTime(
  value: string | null,
  locale: string,
  unknownTimeLabel: string,
  todayLabel: string
): string {
  if (!value) return unknownTimeLabel;
  const normalized = value.includes('T') ? value : value.replace(' ', 'T');
  const parsed = new Date(normalized);
  if (Number.isNaN(parsed.getTime())) return unknownTimeLabel;
  const dayKey = toDailyDate(parsed);
  const todayKey = toDailyDate(new Date());
  const dayLabel =
    dayKey === todayKey
      ? todayLabel
      : new Intl.DateTimeFormat(locale, { month: 'short', day: 'numeric' }).format(parsed);
  const timeLabel = new Intl.DateTimeFormat(locale, { hour: 'numeric', minute: '2-digit' }).format(parsed);
  return `${dayLabel}, ${timeLabel}`;
}

function parseFlaggedAreas(value: string | null): string[] {
  if (!value) return [];
  try {
    const parsed = JSON.parse(value) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((item): item is string => typeof item === 'string' && item.trim().length > 0);
  } catch {
    return [];
  }
}

function formatFocusAreaTag(value: string): string {
  return value
    .replace(/[_-]/g, ' ')
    .trim()
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

type DayProgressCircleProps = {
  progressPercent: number;
  selected: boolean;
  size: number;
};

const DayProgressCircle = React.memo(function DayProgressCircle({
  progressPercent,
  selected,
  size,
}: DayProgressCircleProps) {
  const strokeWidth = selected ? 6.4 : 5.4;
  const progress = useSharedValue(0);

  useEffect(() => {
    progress.value = withTiming(progressPercent / 100, { duration: 260 });
  }, [progress, progressPercent]);

  const ringColor = useDerivedValue(() =>
    interpolateColor(progress.value, [0, 0.5, 1], ['#D1D5DB', '#67E8F9', '#06B6D4'])
  );
  const ringProgress = useDerivedValue(() => progress.value);
  const trackColor = selected ? '#DDE7EF' : '#E5E7EB';

  const circlePath = useMemo(() => {
    const radius = (size - strokeWidth) / 2;
    const path = Skia.Path.Make();
    path.addCircle(size / 2, size / 2, radius);
    return path;
  }, [size, strokeWidth]);

  return (
    <Canvas style={{ width: size, height: size }}>
      <Group origin={{ x: size / 2, y: size / 2 }} transform={[{ rotate: -Math.PI / 2 }]}>
        <Path
          path={circlePath}
          style="stroke"
          strokeWidth={strokeWidth}
          color={trackColor}
          strokeCap="round"
        />
        <Path
          path={circlePath}
          style="stroke"
          strokeWidth={strokeWidth}
          color={ringColor}
          start={0}
          end={ringProgress}
          strokeCap="round"
        />
      </Group>
    </Canvas>
  );
});

type MetricProgressBarProps = {
  progress: number;
  trackColor: string;
  colorStops: ProgressColorStop[];
  height?: number;
};

function MetricProgressBar({
  progress,
  trackColor,
  colorStops,
  height = 8,
}: MetricProgressBarProps) {
  const [barWidth, setBarWidth] = useState(0);
  const animatedProgress = useSharedValue(clamp01(progress));
  const stopPositions = useMemo(() => colorStops.map((stop) => stop[0]), [colorStops]);
  const stopColors = useMemo(() => colorStops.map((stop) => stop[1]), [colorStops]);

  useEffect(() => {
    animatedProgress.value = withTiming(clamp01(progress), { duration: 320 });
  }, [animatedProgress, progress]);

  const fillWidth = useDerivedValue(() => animatedProgress.value * barWidth, [barWidth]);
  const fillColor = useDerivedValue(
    () => interpolateColor(animatedProgress.value, stopPositions, stopColors),
    [stopColors, stopPositions]
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
          <RoundedRect x={0} y={0} width={barWidth} height={height} r={height / 2} color={trackColor} />
          <RoundedRect x={0} y={0} width={fillWidth} height={height} r={height / 2} color={fillColor} />
        </Canvas>
      ) : null}
    </View>
  );
}

const ScanScoreRing = React.memo(function ScanScoreRing({ score }: { score: number }) {
  const clampedScore = Math.max(0, Math.min(100, Math.round(score)));
  const progress = useSharedValue(0);

  useEffect(() => {
    progress.value = withTiming(clampedScore / 100, { duration: 520 });
  }, [clampedScore, progress]);

  const ringProgress = useDerivedValue(() => progress.value);
  const ringColor = useDerivedValue(() =>
    interpolateColor(progress.value, [0, 0.5, 1], ['#22C55E', '#F59E0B', '#EF4444'])
  );

  const circlePath = useMemo(() => {
    const radius = (SCAN_RING_SIZE - SCAN_RING_STROKE) / 2;
    const path = Skia.Path.Make();
    path.addCircle(SCAN_RING_SIZE / 2, SCAN_RING_SIZE / 2, radius);
    return path;
  }, []);

  return (
    <View style={styles.scanRingWrap}>
      <Canvas style={styles.scanRingCanvas}>
        <Group origin={{ x: SCAN_RING_SIZE / 2, y: SCAN_RING_SIZE / 2 }} transform={[{ rotate: -Math.PI / 2 }]}>
          <Path
            path={circlePath}
            style="stroke"
            strokeWidth={SCAN_RING_STROKE}
            color="rgba(15, 23, 42, 0.12)"
            strokeCap="round"
          />
          <Path
            path={circlePath}
            style="stroke"
            strokeWidth={SCAN_RING_STROKE}
            color={ringColor}
            start={0}
            end={ringProgress}
            strokeCap="round"
          />
        </Group>
      </Canvas>
      <View style={styles.scanRingCenter}>
        <Text selectable style={styles.scanRingScore}>
          {clampedScore}
        </Text>
      </View>
    </View>
  );
});

type WeekDayButtonProps = {
  date: string;
  dayLetter: string;
  progressPercent: 0 | 50 | 100;
  selected: boolean;
  size: number;
  onSelectDate: (date: string) => void;
};

const WeekDayButton = React.memo(function WeekDayButton({
  date,
  dayLetter,
  progressPercent,
  selected,
  size,
  onSelectDate,
}: WeekDayButtonProps) {
  return (
    <Pressable onPress={() => onSelectDate(date)} style={styles.dayPressable}>
      <DayProgressCircle progressPercent={progressPercent} selected={selected} size={size} />
      <Text selectable style={[styles.dayLabel, selected ? styles.dayLabelSelected : null]}>
        {dayLetter}
      </Text>
    </Pressable>
  );
});

type RecentFoodListItemProps = {
  food: DayFoodEntry;
  showSeparator: boolean;
};

const RecentFoodListItem = React.memo(function RecentFoodListItem({
  food,
  showSeparator,
}: RecentFoodListItemProps) {
  const { t, i18n } = useTranslation();
  return (
    <React.Fragment>
      {showSeparator ? <View style={styles.recentFoodSeparator} /> : null}
      <Link href={`/(food)/${food.id}` as never} asChild>
        <Pressable onPress={hapticSelection} style={styles.recentFoodRow}>
          <View style={styles.recentFoodMainRow}>
            {food.localImageUri ? (
              <Image
                source={food.localImageUri}
                style={styles.recentFoodThumb}
                contentFit="cover"
                transition={150}
              />
            ) : (
              <View style={styles.recentFoodThumbFallback}>
                <Ionicons name="image-outline" size={18} color="rgba(15, 23, 42, 0.36)" />
              </View>
            )}
            <View style={styles.recentFoodContent}>
              <View style={styles.recentFoodHeader}>
                <Text selectable numberOfLines={1} style={styles.recentFoodName}>
                  {food.foodName}
                </Text>
                <View style={styles.recentFoodHeaderRight}>
                  <Text selectable style={styles.recentFoodTime}>
                    {formatFoodLogTime(
                      food.createdAt,
                      i18n.language,
                      t('common.unknownTime', { defaultValue: 'Unknown time' })
                    )}
                  </Text>
                  <Ionicons name="chevron-forward" size={17} color={PlatformColor('tertiaryLabel')} />
                </View>
              </View>
              <View style={styles.recentFoodMetaRow}>
                <Text selectable style={styles.recentFoodMetaPill}>
                  {food.sodiumEstimateMg.toLocaleString()} mg
                </Text>
                <Text selectable style={styles.recentFoodRisk}>
                  {formatRiskLabel(
                    food.bloatRiskLevel,
                    t('common.unknown', { defaultValue: 'Unknown' })
                  )}
                </Text>
              </View>
            </View>
          </View>
          {food.aiReasoning ? (
            <Text selectable numberOfLines={2} style={styles.recentFoodReason}>
              {food.aiReasoning}
            </Text>
          ) : null}
        </Pressable>
      </Link>
    </React.Fragment>
  );
});

export default function HomeIndex() {
  const router = useRouter();
  const { t, i18n } = useTranslation();
  const { isPro } = useSubscription();
  const insets = useSafeAreaInsets();
  const queryClient = useQueryClient();
  const db = useDbStore((state) => state.db);
  const waterGoalMl = useSettingsStore((state) => state.waterGoalMl);
  const sodiumGoalMg = useSettingsStore((state) => state.sodiumGoalMg);
  const { width } = useWindowDimensions();
  const recentDates = useMemo(() => buildRecentDates(DAYS_TO_SHOW), []);
  const [selectedDate, setSelectedDate] = useState(recentDates[recentDates.length - 1]);
  const celebratedHydrationDatesRef = useRef<Set<string>>(new Set());
  const celebratedActionPlanDatesRef = useRef<Set<string>>(new Set());

  const circleSize = useMemo(() => {
    const innerWidth = Math.max(width - 40, 280);
    return Math.max(44, Math.min(58, (innerWidth - (DAYS_TO_SHOW - 1) * 8) / DAYS_TO_SHOW));
  }, [width]);

  const handleSelectDate = useCallback((date: string) => {
    hapticSelection();
    setSelectedDate(date);
  }, []);

  const handleOpenScan = useCallback(() => {
    hapticSelection();
    router.push('/(scan)' as never);
  }, [router]);

  const handleLogFood = useCallback(() => {
    hapticSelection();
    router.push('/(food)' as never);
  }, [router]);
  const showHydrationGoalToast = useCallback(() => {
    hapticSuccess();
    Burnt.toast({
      title: t('home.hydrationGoalReachedTitle', { defaultValue: 'Hydration Goal Reached' }),
      message: t('home.hydrationGoalReachedMessage', {
        defaultValue: 'You hit your daily water target.',
      }),
      preset: 'done',
      haptic: 'none',
      from: 'bottom',
      duration: 3,
    });
  }, [t]);
  const showActionPlanToast = useCallback(() => {
    hapticSuccess();
    Burnt.toast({
      title: t('home.actionPlanCompleteTitle', { defaultValue: 'Action Plan Complete' }),
      message: t('home.actionPlanCompleteMessage', {
        defaultValue: 'All daily action items are done.',
      }),
      preset: 'done',
      haptic: 'none',
      from: 'bottom',
      duration: 3,
    });
  }, [t]);
  const handleOpenChecklistUpgrade = useCallback(() => {
    hapticSelection();
    router.push(PAYWALL_ROUTE as never);
  }, [router]);

  const dayQueries = useQueries({
    queries: recentDates.map((date) => ({
      enabled: Boolean(db),
      queryKey: ['day-status', date],
      queryFn: () => getDayStatus(date),
      staleTime: 60_000,
      notifyOnChangeProps: ['data'],
    })),
  });
  const dayBalanceQuery = useDayBalance(selectedDate);
  const dayRecentFoodsQuery = useDayRecentFoods(selectedDate, 3);

  useFocusEffect(
    useCallback(() => {
      const todayKey = toDailyDate(new Date());
      const datesToRefresh = selectedDate === todayKey ? [selectedDate] : [selectedDate, todayKey];
      datesToRefresh.forEach((date) => {
        void queryClient.invalidateQueries({ queryKey: ['day-status', date], exact: true });
        void queryClient.invalidateQueries({ queryKey: ['day-balance', date], exact: true });
        void queryClient.invalidateQueries({ queryKey: ['day-foods', date], exact: false });
      });
    }, [queryClient, selectedDate])
  );

  const weekItems = useMemo<WeekItem[]>(
    () =>
      recentDates.map((date, index) => {
        const query = dayQueries[index];
        const progress = query.data?.progressPercent ?? 0;

        return {
          date,
          dayLetter: dayLetterFromDate(date, i18n.language),
          progressPercent: progress,
        };
      }),
    [dayQueries, i18n.language, recentDates]
  );
  const selectedDayIndex = useMemo(
    () => recentDates.findIndex((date) => date === selectedDate),
    [recentDates, selectedDate]
  );
  const hasScanForSelectedDay = Boolean(dayQueries[selectedDayIndex]?.data?.hasScan);
  const selectedDayScanSummaryQuery = useQuery({
    enabled: Boolean(db) && hasScanForSelectedDay,
    queryKey: ['home-selected-day-scan-summary', selectedDate],
    staleTime: 60_000,
    queryFn: async (): Promise<ScanSummary | null> => {
      if (!db) return null;

      const [latestScan] = await db
        .select({
          createdAt: faceScans.createdAt,
          score: faceScans.score,
          feedback: faceScans.feedback,
          flaggedAreas: faceScans.flaggedAreas,
          localImageUri: faceScans.localImageUri,
        })
        .from(faceScans)
        .where(sql`substr(${faceScans.createdAt}, 1, 10) = ${selectedDate}`)
        .orderBy(desc(faceScans.createdAt), desc(faceScans.id))
        .limit(1);

      if (!latestScan) return null;

      const previousDate = shiftDate(selectedDate, -1);
      const [selectedDaily] = await db
        .select({ dailyBloatScore: dailyLogs.dailyBloatScore })
        .from(dailyLogs)
        .where(eq(dailyLogs.date, selectedDate))
        .limit(1);
      const [previousDaily] = await db
        .select({ dailyBloatScore: dailyLogs.dailyBloatScore })
        .from(dailyLogs)
        .where(eq(dailyLogs.date, previousDate))
        .limit(1);

      const currentScore = selectedDaily?.dailyBloatScore ?? latestScan.score;
      const previousScore = previousDaily?.dailyBloatScore ?? null;
      const deltaVsYesterday = previousScore === null ? null : currentScore - previousScore;

      return {
        ...latestScan,
        deltaVsYesterday,
      };
    },
  });
  const selectedDayScanSummary = selectedDayScanSummaryQuery.data;

  const waterIntakeMl = dayBalanceQuery.data?.waterIntakeMl ?? 0;
  const sodiumMg = dayBalanceQuery.data?.sodiumMg ?? 0;
  const recentFoods = dayRecentFoodsQuery.data ?? EMPTY_RECENT_FOODS;
  const actionableSteps = dayQueries[selectedDayIndex]?.data?.actionableSteps ?? EMPTY_ACTIONABLE_STEPS;
  const areAllActionItemsCompleted = actionableSteps.length > 0 && actionableSteps.every((step) => step.completed);

  const hydrationProgress = useMemo(
    () => clamp01(waterIntakeMl / Math.max(waterGoalMl, 1)),
    [waterGoalMl, waterIntakeMl]
  );
  const sodiumProgress = useMemo(
    () => clamp01(sodiumMg / Math.max(sodiumGoalMg, 1)),
    [sodiumGoalMg, sodiumMg]
  );
  const scanLoggedTimeLabel = useMemo(
    () =>
      formatScanLoggedTime(
        selectedDayScanSummary?.createdAt ?? null,
        i18n.language,
        t('common.unknownTime', { defaultValue: 'Unknown time' }),
        t('common.today', { defaultValue: 'Today' })
      ),
    [i18n.language, selectedDayScanSummary?.createdAt, t]
  );
  const scanDeltaLabel = useMemo(() => {
    const delta = selectedDayScanSummary?.deltaVsYesterday;
    if (delta === null || delta === undefined) return null;
    const sign = delta >= 0 ? '+' : '-';
    return t('home.scanDeltaVsYesterday', {
      defaultValue: `${sign}${Math.abs(Math.round(delta))} vs yesterday`,
      sign,
      value: Math.abs(Math.round(delta)),
    });
  }, [selectedDayScanSummary?.deltaVsYesterday, t]);
  const scanFeedback = selectedDayScanSummary?.feedback?.trim() ?? '';
  const scanFocusAreas = useMemo(
    () => parseFlaggedAreas(selectedDayScanSummary?.flaggedAreas ?? null).map(formatFocusAreaTag),
    [selectedDayScanSummary?.flaggedAreas]
  );
  const visibleScanFocusAreas = scanFocusAreas.slice(0, 2);
  const hiddenScanFocusAreaCount = Math.max(0, scanFocusAreas.length - visibleScanFocusAreas.length);

  useEffect(() => {
    if (waterIntakeMl >= waterGoalMl) {
      celebratedHydrationDatesRef.current.add(selectedDate);
    }
  }, [selectedDate, waterGoalMl, waterIntakeMl]);

  useEffect(() => {
    if (areAllActionItemsCompleted) {
      celebratedActionPlanDatesRef.current.add(selectedDate);
    }
  }, [areAllActionItemsCompleted, selectedDate]);

  const handleOpenScanResult = useCallback(() => {
    if (!selectedDayScanSummary) return;
    hapticSelection();
    router.push({
      pathname: '/(scan)/result',
      params: {
        imageUri: selectedDayScanSummary.localImageUri ?? undefined,
        capturedAt: selectedDayScanSummary.createdAt,
      },
    } as never);
  }, [router, selectedDayScanSummary]);

  const handleSetWaterIntake = useCallback(async (nextWaterIntake: number) => {
    if (!db) return;
    hapticSelection();
    const safeIntake = Math.max(0, Math.round(nextWaterIntake));
    const queryKey = ['day-balance', selectedDate] as const;
    const previousBalance = queryClient.getQueryData<DayBalance>(queryKey);
    const previousIntake = previousBalance?.waterIntakeMl ?? waterIntakeMl;
    const shouldCelebrateHydration =
      previousIntake < waterGoalMl &&
      safeIntake >= waterGoalMl &&
      !celebratedHydrationDatesRef.current.has(selectedDate);

    queryClient.setQueryData<DayBalance>(queryKey, (current) =>
      current ? { ...current, waterIntakeMl: safeIntake } : current
    );

    try {
      await db
        .insert(dailyLogs)
        .values({
          date: selectedDate,
          waterIntake: safeIntake,
        })
        .onConflictDoUpdate({
          target: dailyLogs.date,
          set: {
            waterIntake: safeIntake,
          },
        });

      await queryClient.invalidateQueries({ queryKey: ['day-status', selectedDate] });
      await queryClient.invalidateQueries({ queryKey: ['day-balance', selectedDate] });
      if (shouldCelebrateHydration) {
        celebratedHydrationDatesRef.current.add(selectedDate);
        showHydrationGoalToast();
      }
    } catch (error) {
      if (previousBalance) {
        queryClient.setQueryData(queryKey, previousBalance);
      }
      console.warn('Failed to update hydration', error);
    }
  }, [db, queryClient, selectedDate, showHydrationGoalToast, waterGoalMl, waterIntakeMl]);
  const handleToggleActionItem = useCallback(async (id: string, currentCompleted: boolean) => {
    if (!db) return;
    const nextCompleted = !currentCompleted;
    
    const queryKey = ['day-status', selectedDate] as const;
    const previousStatus = queryClient.getQueryData<DayStatus>(queryKey);
    
    // Optimistically update React Query cache so the UI animations are instant
    queryClient.setQueryData<DayStatus>(queryKey, (old) => {
      if (!old || !old.actionableSteps) return old;
      return {
        ...old,
        actionableSteps: old.actionableSteps.map(step => 
          step.id === id ? { ...step, completed: nextCompleted } : step
        )
      };
    });

    try {
      if (!previousStatus?.actionableSteps) return;
      const newSteps = previousStatus.actionableSteps.map(step => 
          step.id === id ? { ...step, completed: nextCompleted } : step
      );
      const wasCompleteBefore =
        previousStatus.actionableSteps.length > 0 &&
        previousStatus.actionableSteps.every((step) => step.completed);
      const isCompleteNow = newSteps.length > 0 && newSteps.every((step) => step.completed);
      const shouldCelebrateActionPlan =
        isCompleteNow &&
        !wasCompleteBefore &&
        !celebratedActionPlanDatesRef.current.has(selectedDate);
      
      await db.update(dailyLogs)
        .set({ actionableSteps: newSteps })
        .where(eq(dailyLogs.date, selectedDate));
      if (shouldCelebrateActionPlan) {
        celebratedActionPlanDatesRef.current.add(selectedDate);
        showActionPlanToast();
      }
    } catch (error) {
      if (previousStatus) {
        queryClient.setQueryData(queryKey, previousStatus);
      }
      console.warn('Failed to update action item', error);
    }
  }, [db, queryClient, selectedDate, showActionPlanToast]);

  const scrollContentStyle = useMemo(
    () => [styles.contentContainer, { paddingBottom: insets.bottom + 24 }],
    [insets.bottom]
  );

  return (
      <ScrollView
        contentInsetAdjustmentBehavior="automatic"
        removeClippedSubviews
        contentContainerStyle={scrollContentStyle}
      >
      <View style={styles.weekRow}>
        {weekItems.map((item) => {
          return (
            <WeekDayButton
              key={item.date}
              date={item.date}
              dayLetter={item.dayLetter}
              progressPercent={item.progressPercent}
              selected={item.date === selectedDate}
              size={circleSize}
              onSelectDate={handleSelectDate}
            />
          );
        })}
      </View>
      <View
        style={[
          styles.scanCard,
          hasScanForSelectedDay ? styles.scanCardComplete : styles.scanCardEmpty,
        ]}
      >
        {hasScanForSelectedDay ? (
          <View style={styles.scanSummaryContent}>
            <View style={styles.scanMetaTopRow}>
                <Text selectable style={styles.scanMetaTopPrimary}>
                {selectedDayScanSummaryQuery.isLoading
                  ? t('home.loadingScan', { defaultValue: 'Loading scan...' })
                  : scanLoggedTimeLabel}
              </Text>
              <Text
                selectable
                style={[
                  styles.scanMetaTopSecondary,
                  scanDeltaLabel
                    ? (selectedDayScanSummary?.deltaVsYesterday ?? 0) > 0
                      ? styles.scanTrendTextWorse
                      : styles.scanTrendTextBetter
                    : null,
                ]}
              >
                {scanDeltaLabel ??
                  t('home.noPreviousBaseline', { defaultValue: 'No previous baseline' })}
              </Text>
            </View>

            <View style={styles.scanSummaryTopRow}>
              {selectedDayScanSummary?.localImageUri ? (
                <Image
                  source={selectedDayScanSummary.localImageUri}
                  style={styles.scanSummaryImage}
                  contentFit="cover"
                  transition={140}
                />
              ) : (
                <View style={styles.scanSummaryImageFallback}>
                  <Ionicons name="scan" size={28} color="rgba(15, 23, 42, 0.34)" />
                </View>
              )}
              <View style={styles.scanRingStack}>
                <ScanScoreRing
                  score={selectedDayScanSummary?.score ?? 0}
                />
                <Text selectable style={styles.scanScoreCaption}>
                  {t('home.bloatScore', { defaultValue: 'Bloat score' })}
                </Text>
              </View>
            </View>

            <Text selectable numberOfLines={2} style={styles.scanFeedbackText}>
              {scanFeedback ||
                t('home.noScanSummaryYet', {
                  defaultValue: 'No analysis summary available for this scan yet.',
                })}
            </Text>

            {visibleScanFocusAreas.length > 0 ? (
              <View style={styles.scanFocusRow}>
                {visibleScanFocusAreas.map((area) => (
                  <View key={area} style={styles.scanFocusChip}>
                    <Text selectable style={styles.scanFocusChipText}>
                      {area}
                    </Text>
                  </View>
                ))}
                {hiddenScanFocusAreaCount > 0 ? (
                  <View style={styles.scanFocusChip}>
                    <Text selectable style={styles.scanFocusChipText}>
                      +{hiddenScanFocusAreaCount}
                    </Text>
                  </View>
                ) : null}
              </View>
            ) : null}

            <View style={styles.scanActionRow}>
              <IOSHost style={styles.scanActionButtonHost} matchContents useViewportSizeMeasurement>
                <IOSButton
                  label={t('scan.viewReport', { defaultValue: 'View Report' })}
                  systemImage="doc.text.magnifyingglass"
                  onPress={handleOpenScanResult}
                  modifiers={[
                    controlSize('regular'),
                    tint('rgba(15, 23, 42, 0.12)'),
                    buttonStyle('glassProminent'),
                  ]}
                />
              </IOSHost>
              <IOSHost style={styles.scanActionButtonHost} matchContents useViewportSizeMeasurement>
                <IOSButton
                  label={t('common.retake', { defaultValue: 'Retake' })}
                  systemImage="arrow.trianglehead.clockwise"
                  onPress={handleOpenScan}
                  modifiers={[
                    controlSize('regular'),
                    tint('rgba(45, 212, 191, 1)'),
                    buttonStyle('glassProminent'),
                  ]}
                />
              </IOSHost>
            </View>
          </View>
        ) : (
          <View style={styles.scanEmptyState}>
            <View style={styles.scanEmptyIconWrap}>
              <Ionicons name="scan" size={44} color="rgba(15, 23, 42, 0.45)" />
            </View>
            <Text selectable style={styles.scanEmptyTitle}>
              {t('home.dailyMorningScan', { defaultValue: 'Daily Morning Scan' })}
            </Text>
            <Text selectable style={styles.scanEmptyDescription}>
              {t('home.noScanForDay', {
                defaultValue: 'No scan yet for this day. Scan your face to start your morning routine.',
              })}
            </Text>
            <View style={styles.scanEmptyStatusPill}>
              <Text selectable style={styles.scanEmptyStatusText}>
                {t('home.noScanYet', { defaultValue: 'No scan yet' }).toUpperCase()}
              </Text>
            </View>
            <IOSHost style={styles.scanButtonHost} matchContents useViewportSizeMeasurement>
              <IOSButton
                label={t('scan.startScan', { defaultValue: 'Start Scan' })}
                systemImage="camera.viewfinder"
                onPress={handleOpenScan}
                modifiers={[
                  controlSize('large'),
                  tint('rgba(34, 211, 238, 1)'),
                  buttonStyle('borderedProminent'),
                ]}
              />
            </IOSHost>
          </View>
        )}
      </View>

      {isPro ? (
        <AIChecklist items={actionableSteps} onToggleItem={handleToggleActionItem} />
      ) : (
        <View style={styles.checklistLockedCard}>
          <View style={styles.checklistLockedHeader}>
            <Text selectable style={styles.checklistLockedTitle}>
              {t('home.aiActionPlan', { defaultValue: 'AI Action Plan' })}
            </Text>
            <Text selectable style={styles.checklistLockedBadge}>
              PRO
            </Text>
          </View>
          <Text selectable style={styles.checklistLockedText}>
            {t('home.checklistProOnly', {
              defaultValue: 'Personalized daily action steps are available on Pro.',
            })}
          </Text>
          {process.env.EXPO_OS === 'ios' ? (
            <IOSHost matchContents useViewportSizeMeasurement>
              <IOSButton
                label={t('common.unlockPro', { defaultValue: 'Unlock Pro' })}
                systemImage="sparkles"
                onPress={handleOpenChecklistUpgrade}
                modifiers={[
                  controlSize('regular'),
                  tint('rgba(34, 211, 238, 1)'),
                  buttonStyle('borderedProminent'),
                ]}
              />
            </IOSHost>
          ) : (
            <Pressable onPress={handleOpenChecklistUpgrade} style={styles.checklistLockedButtonFallback}>
              <Text selectable style={styles.checklistLockedButtonFallbackLabel}>
                {t('common.unlockPro', { defaultValue: 'Unlock Pro' })}
              </Text>
            </Pressable>
          )}
        </View>
      )}

      <View style={styles.metricsStack}>
        <View style={styles.metricCard}>
          <View style={styles.metricHeaderRow}>
            <View style={styles.metricHeaderLeft}>
              <Ionicons name="water" size={18} color={PlatformColor('tertiaryLabel')} />
              <Text selectable style={styles.metricHeaderLabel}>
                {t('home.hydration', { defaultValue: 'Hydration' }).toUpperCase()}
              </Text>
            </View>
            <Text selectable style={styles.stepHint}>
              {t('home.stepMl', { defaultValue: `${WATER_STEP_ML}ml step`, value: WATER_STEP_ML })}
            </Text>
          </View>

          <DigitalCounterProvider
            value={waterIntakeMl}
            min={0}
            max={9999}
            step={WATER_STEP_ML}
            onChange={(nextValue) => void handleSetWaterIntake(nextValue)}
          >
            <View style={styles.hydrationRow}>
              <DigitalCounter />
              <CounterControls />
            </View>
          </DigitalCounterProvider>
          <MetricProgressBar
            progress={hydrationProgress}
            trackColor="rgba(15, 23, 42, 0.08)"
            colorStops={HYDRATION_COLOR_STOPS}
          />
          <Text selectable style={styles.metricTargetLine}>
            {t('home.targetMl', {
              defaultValue: `Target ${waterGoalMl.toLocaleString()} ml`,
              value: waterGoalMl.toLocaleString(),
            })}
          </Text>
        </View>

        <View style={styles.metricCard}>
          <View style={styles.metricHeaderRow}>
            <View style={styles.metricHeaderLeft}>
              <Ionicons name="flash" size={18} color={PlatformColor('tertiaryLabel')} />
              <Text selectable style={styles.metricHeaderLabel}>
                {t('home.sodium', { defaultValue: 'Sodium' }).toUpperCase()}
              </Text>
            </View>
            <IOSHost style={styles.metricLogFoodHost} matchContents useViewportSizeMeasurement>
              <IOSButton
                label={t('food.logFood', { defaultValue: 'Log Food' })}
                systemImage="fork.knife"
                onPress={handleLogFood}
                modifiers={[
                  controlSize('small'),
                  tint('rgba(34, 211, 238, 1)'),
                  buttonStyle('borderedProminent'),
                ]}
              />
            </IOSHost>
          </View>
          <Text selectable style={styles.metricValue}>
            {sodiumMg.toLocaleString()}
            <Text style={styles.metricTarget}> / {sodiumGoalMg.toLocaleString()} mg</Text>
          </Text>
          <MetricProgressBar
            progress={sodiumProgress}
            trackColor="rgba(15, 23, 42, 0.08)"
            colorStops={SODIUM_COLOR_STOPS}
          />
        </View>
      </View>

      <View style={styles.recentFoodCardsSection}>
        <View style={styles.recentFoodsHeader}>
          <Text selectable style={styles.recentFoodsTitle}>
            {t('home.lastThreeFoods', { defaultValue: 'Last 3 logged foods' })}
          </Text>
          <Link href="/(food)/all" asChild>
            <Pressable onPress={hapticSelection} style={styles.recentFoodsHeaderAction}>
              <Ionicons name="chevron-forward" size={24} color={PlatformColor('secondaryLabel')} />
            </Pressable>
          </Link>
        </View>
        {recentFoods.length === 0 ? (
          <View style={styles.recentFoodCardEmpty}>
            <View style={styles.recentFoodEmptyIconWrap}>
              <Ionicons name="fast-food-outline" size={32} color="rgba(15, 23, 42, 0.45)" />
            </View>
            <Text selectable style={styles.recentFoodEmptyTitle}>
              {t('home.noFoodsLoggedTitle', { defaultValue: 'No Meals Logged' })}
            </Text>
            <Text selectable style={styles.recentFoodEmptyDescription}>
              {t('home.noFoodsLoggedDesc', { defaultValue: 'Log your meals to track your sodium and hydration more accurately.' })}
            </Text>
            {process.env.EXPO_OS === 'ios' ? (
              <IOSHost style={{ width: '100%' }} matchContents useViewportSizeMeasurement>
                <IOSButton
                  label={t('food.logFood', { defaultValue: 'Log Food' })}
                  systemImage="plus"
                  onPress={handleLogFood}
                  modifiers={[
                    controlSize('large'),
                    tint('rgba(34, 211, 238, 1)'),
                    buttonStyle('borderedProminent'),
                  ]}
                />
              </IOSHost>
            ) : (
              <Pressable onPress={handleLogFood} style={styles.recentFoodEmptyActionFallback}>
                <Text selectable style={styles.recentFoodEmptyActionFallbackLabel}>
                  {t('food.logFood', { defaultValue: 'Log Food' })}
                </Text>
              </Pressable>
            )}
          </View>
        ) : (
          <View style={styles.recentFoodsList}>
            {recentFoods.map((food, index) => (
              <RecentFoodListItem
                key={food.id}
                food={food}
                showSeparator={index > 0}
              />
            ))}
          </View>
        )}
      </View>
      </ScrollView>
  );
}

const styles = StyleSheet.create({
 

  contentContainer: {
    paddingTop: 16,
    paddingHorizontal: 16,
    gap: 18,
  },
  weekRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
  },
  dayPressable: {
    flex: 1,
    alignItems: 'center',
    gap: 8,
  },
  dayLabel: {
    color: PlatformColor('secondaryLabel'),
    fontSize: 13,
    fontWeight: '600',
    letterSpacing: 0.2,
  },
  dayLabelSelected: {
    color: PlatformColor('label'),
  },
  stepHint: {
    fontSize: 13,
    fontWeight: '600',
    color: PlatformColor('tertiaryLabel'),
  },
  scanCard: {
    borderRadius: 20,
    borderCurve: 'continuous',
    paddingHorizontal: 16,
    paddingVertical: 16,
    alignItems: 'stretch',
    justifyContent: 'center',
    gap: 12,
  },
  scanCardEmpty: {
    borderWidth: 1.5,
    borderStyle: 'dashed',
    borderColor: 'rgba(15, 23, 42, 0.18)',
    backgroundColor: 'rgba(255, 255, 255, 0.4)',
  },
  scanCardComplete: {
    backgroundColor: PlatformColor('secondarySystemGroupedBackground'),
  },
  scanButtonHost: {
    width: '100%',
  },
  scanEmptyState: {
    width: '100%',
    alignItems: 'center',
    gap: 10,
  },
  scanEmptyIconWrap: {
    width: 72,
    height: 72,
    borderRadius: 999,
    borderCurve: 'continuous',
    backgroundColor: 'rgba(148, 163, 184, 0.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  scanEmptyTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: PlatformColor('label'),
    letterSpacing: 0.35,
  },
  scanEmptyDescription: {
    fontSize: 15,
    fontWeight: '500',
    color: PlatformColor('secondaryLabel'),
    textAlign: 'center',
    lineHeight: 22,
  },
  scanEmptyStatusPill: {
    borderRadius: 999,
    borderCurve: 'continuous',
    paddingHorizontal: 10,
    paddingVertical: 4,
    backgroundColor: 'rgba(148, 163, 184, 0.16)',
  },
  scanEmptyStatusText: {
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.5,
    color: 'rgba(51, 65, 85, 0.75)',
  },
  scanSummaryContent: {
    width: '100%',
    gap: 8,
  },
  scanMetaTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  scanMetaTopPrimary: {
    flex: 1,
    minWidth: 0,
    fontSize: 13,
    fontWeight: '600',
    color: PlatformColor('secondaryLabel'),
    fontVariant: ['tabular-nums'],
  },
  scanMetaTopSecondary: {
    fontSize: 13,
    fontWeight: '700',
    color: PlatformColor('tertiaryLabel'),
    fontVariant: ['tabular-nums'],
  },
  scanSummaryTopRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    gap: 10,
  },
  scanSummaryImage: {
    width: 124,
    height: 124,
    borderRadius: 12,
    borderCurve: 'continuous',
    backgroundColor: 'rgba(15, 23, 42, 0.08)',
  },
  scanSummaryImageFallback: {
    width: 124,
    height: 124,
    borderRadius: 12,
    borderCurve: 'continuous',
    backgroundColor: 'rgba(15, 23, 42, 0.08)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  scanRingStack: {
    alignItems: 'center',
    gap: 3,
  },
  scanRingWrap: {
    width: SCAN_RING_SIZE,
    height: SCAN_RING_SIZE,
  },
  scanRingCanvas: {
    width: SCAN_RING_SIZE,
    height: SCAN_RING_SIZE,
  },
  scanRingCenter: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scanRingScore: {
    fontSize: 34,
    fontWeight: '800',
    color: PlatformColor('label'),
    fontVariant: ['tabular-nums'],
  },
  scanScoreCaption: {
    fontSize: 13,
    fontWeight: '600',
    color: PlatformColor('secondaryLabel'),
  },
  scanTrendTextBetter: {
    color: PlatformColor('systemGreen'),
  },
  scanTrendTextWorse: {
    color: PlatformColor('systemRed'),
  },
  scanFeedbackText: {
    fontSize: 15,
    fontWeight: '500',
    color: PlatformColor('secondaryLabel'),
    lineHeight: 20,
    marginTop: 4,
  },
  scanFocusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 4,
  },
  scanFocusChip: {
    borderRadius: 999,
    borderCurve: 'continuous',
    backgroundColor: 'rgba(45, 212, 191, 0.14)',
    paddingHorizontal: 9,
    paddingVertical: 4,
  },
  scanFocusChipText: {
    fontSize: 11,
    fontWeight: '700',
    color: 'rgba(13, 148, 136, 0.95)',
  },
  scanActionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 6,
  },
  scanActionButtonHost: {
    flex: 1,
  },
  checklistLockedCard: {
    borderRadius: 20,
    borderCurve: 'continuous',
    paddingHorizontal: 16,
    paddingVertical: 16,
    gap: 10,
    backgroundColor: PlatformColor('secondarySystemGroupedBackground'),
  },
  checklistLockedHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  checklistLockedTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: PlatformColor('label'),
  },
  checklistLockedBadge: {
    fontSize: 12,
    fontWeight: '700',
    color: 'rgba(8, 145, 178, 1)',
    backgroundColor: 'rgba(34, 211, 238, 0.18)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 999,
    borderCurve: 'continuous',
    overflow: 'hidden',
  },
  checklistLockedText: {
    fontSize: 14,
    fontWeight: '500',
    color: PlatformColor('secondaryLabel'),
    lineHeight: 20,
  },
  checklistLockedButtonFallback: {
    alignSelf: 'flex-start',
    borderRadius: 999,
    borderCurve: 'continuous',
    backgroundColor: 'rgba(34, 211, 238, 1)',
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  checklistLockedButtonFallbackLabel: {
    fontSize: 13,
    fontWeight: '700',
    color: 'white',
  },
  metricsStack: {
    flexDirection: 'column', 
    width: '100%', 
    gap: 16, 
    alignItems: 'stretch', 
    justifyContent: 'center'
  },
  metricCard: {
    flex: 1,
    borderRadius: 20,
    borderCurve: 'continuous',
    paddingHorizontal: 16,
    paddingVertical: 16,
    backgroundColor: PlatformColor('secondarySystemGroupedBackground'),
    gap: 12,
  },
  metricHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  metricHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  metricHeaderLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: PlatformColor('tertiaryLabel'),
    letterSpacing: 0.5,
  },
  metricLogFoodHost: {
    alignSelf: 'center',
  },
  hydrationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  metricTargetLine: {
    fontSize: 15,
    fontWeight: '600',
    color: PlatformColor('secondaryLabel'),
    fontVariant: ['tabular-nums'],
  },
  metricValue: {
    fontSize: 28,
    fontWeight: '700',
    color: PlatformColor('label'),
    fontVariant: ['tabular-nums'],
  },
  metricTarget: {
    fontSize: 17,
    fontWeight: '600',
    color: PlatformColor('secondaryLabel'),
    fontVariant: ['tabular-nums'],
  },
  recentFoodCardsSection: {
    gap: 12,
  },
  recentFoodsHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingLeft: 4, 
  },
  recentFoodsHeaderAction: {
    width: 30,
    height: 30,
    borderRadius: 999,
    borderCurve: 'continuous',
    alignItems: 'center',
    justifyContent: 'center',
  },
  recentFoodsTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: PlatformColor('label'),
    letterSpacing: 0.35,
  },
  recentFoodCardEmpty: {
    borderRadius: 20,
    borderCurve: 'continuous',
    borderWidth: 1.5,
    borderStyle: 'dashed',
    borderColor: 'rgba(15, 23, 42, 0.18)',
    backgroundColor: 'rgba(255, 255, 255, 0.4)',
    paddingHorizontal: 20,
    paddingVertical: 24,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
  },
  recentFoodEmptyIconWrap: {
    width: 64,
    height: 64,
    borderRadius: 999,
    borderCurve: 'continuous',
    backgroundColor: 'rgba(148, 163, 184, 0.12)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  recentFoodEmptyTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: PlatformColor('label'),
    letterSpacing: 0.35,
    textAlign: 'center',
  },
  recentFoodEmptyDescription: {
    fontSize: 15,
    fontWeight: '500',
    color: PlatformColor('secondaryLabel'),
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 6,
  },
  recentFoodEmptyActionFallback: {
    alignSelf: 'stretch',
    borderRadius: 14,
    borderCurve: 'continuous',
    paddingHorizontal: 12,
    paddingVertical: 14,
    backgroundColor: 'rgba(34, 211, 238, 1)',
    alignItems: 'center',
  },
  recentFoodEmptyActionFallbackLabel: {
    fontSize: 16,
    fontWeight: '700',
    color: 'white',
  },
  recentFoodsList: {
    borderRadius: 20,
    borderCurve: 'continuous',
    backgroundColor: PlatformColor('secondarySystemGroupedBackground'),
    overflow: 'hidden',
  },
  recentFoodListItem: {
    backgroundColor: PlatformColor('secondarySystemGroupedBackground'),
  },
  recentFoodRow: {
    paddingHorizontal: 16,
    paddingVertical: 14,
    gap: 8,
  },
  recentFoodSeparator: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: PlatformColor('separator'),
    marginLeft: 74,
  },
  recentFoodMainRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
  },
  recentFoodThumb: {
    width: 48,
    height: 48,
    borderRadius: 12,
    borderCurve: 'continuous',
    backgroundColor: 'rgba(15, 23, 42, 0.08)',
  },
  recentFoodThumbFallback: {
    width: 48,
    height: 48,
    borderRadius: 12,
    borderCurve: 'continuous',
    backgroundColor: 'rgba(15, 23, 42, 0.08)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  recentFoodContent: {
    flex: 1,
    gap: 6,
    minWidth: 0,
    justifyContent: 'center',
  },
  recentFoodHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  recentFoodHeaderRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flexShrink: 0,
  },
  recentFoodName: {
    flex: 1,
    minWidth: 0,
    flexShrink: 1,
    fontSize: 17,
    fontWeight: '600',
    color: PlatformColor('label'),
  },
  recentFoodTime: {
    fontSize: 15,
    fontWeight: '500',
    color: PlatformColor('secondaryLabel'),
    fontVariant: ['tabular-nums'],
    minWidth: 62,
    textAlign: 'right',
  },
  recentFoodMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  recentFoodMetaPill: {
    fontSize: 13,
    fontWeight: '600',
    color: PlatformColor('secondaryLabel'),
    backgroundColor: PlatformColor('tertiarySystemGroupedBackground'),
    borderRadius: 999,
    borderCurve: 'continuous',
    paddingHorizontal: 8,
    paddingVertical: 3,
    overflow: 'hidden',
    fontVariant: ['tabular-nums'],
  },
  recentFoodRisk: {
    fontSize: 13,
    fontWeight: '700',
    color: PlatformColor('secondaryLabel'),
    letterSpacing: 0.2,
  },
  recentFoodReason: {
    fontSize: 15,
    fontWeight: '400',
    color: PlatformColor('secondaryLabel'),
    lineHeight: 20,
  },
});
