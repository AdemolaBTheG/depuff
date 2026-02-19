import { CounterControls } from '@/components/daily-steps/counter-controls';
import { DigitalCounter } from '@/components/daily-steps/digital-counter';
import { dailyLogs, faceScans } from '@/db/schema';
import {
  getDayStatus,
  toDailyDate,
  useDayBalance,
  useDayRecentFoods,
  type DayBalance,
  type DayProgressState,
} from '@/hooks/useDayStatus';
import { DigitalCounterProvider } from '@/lib/digital-counter-context';
import { useDbStore } from '@/stores/dbStore';
import { hapticSelection } from '@/utils/haptics';
import {
  Button as IOSButton,
  Host as IOSHost,
} from '@expo/ui/swift-ui';
import { buttonStyle, controlSize, tint } from '@expo/ui/swift-ui/modifiers';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { Canvas, Group, Path, RoundedRect, Skia } from '@shopify/react-native-skia';
import { useQueries, useQuery, useQueryClient } from '@tanstack/react-query';
import { desc, eq, sql } from 'drizzle-orm';
import { Image } from 'expo-image';
import { Link, useRouter } from 'expo-router';
import { PressableScale } from 'pressto';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ScrollView, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { interpolateColor, useDerivedValue, useSharedValue, withTiming } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
const DAYS_TO_SHOW = 7;
const WATER_STEP_ML = 250;
const SCAN_RING_SIZE = 98;
const SCAN_RING_STROKE = 10;

type WeekItem = {
  date: string;
  dayLetter: string;
  progressPercent: 0 | 50 | 100;
  state: DayProgressState;
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

function dayLetterFromDate(date: string): string {
  const label = new Intl.DateTimeFormat('en-US', { weekday: 'short' }).format(new Date(date));
  return label.slice(0, 1).toUpperCase();
}

function formatFoodLogTime(createdAt: string | null): string {
  if (!createdAt) return 'Unknown time';
  const normalized = createdAt.includes('T') ? createdAt : createdAt.replace(' ', 'T');
  const parsed = new Date(normalized);
  if (Number.isNaN(parsed.getTime())) return 'Unknown time';
  return new Intl.DateTimeFormat('en-US', {
    hour: 'numeric',
    minute: '2-digit',
  }).format(parsed);
}

function formatRiskLabel(value: string | null): string {
  if (!value) return 'Unknown';
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

function formatScanLoggedTime(value: string | null): string {
  if (!value) return 'Unknown time';
  const normalized = value.includes('T') ? value : value.replace(' ', 'T');
  const parsed = new Date(normalized);
  if (Number.isNaN(parsed.getTime())) return 'Unknown time';
  const dayKey = toDailyDate(parsed);
  const todayKey = toDailyDate(new Date());
  const dayLabel =
    dayKey === todayKey
      ? 'Today'
      : new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric' }).format(parsed);
  const timeLabel = new Intl.DateTimeFormat('en-US', { hour: 'numeric', minute: '2-digit' }).format(parsed);
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

function DayProgressCircle({ progressPercent, selected, size }: DayProgressCircleProps) {
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
}

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

function ScanScoreRing({ score }: { score: number }) {
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
}

export default function HomeIndex() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const queryClient = useQueryClient();
  const db = useDbStore((state) => state.db);
  const { width } = useWindowDimensions();
  const recentDates = useMemo(() => buildRecentDates(DAYS_TO_SHOW), []);
  const [selectedDate, setSelectedDate] = useState(recentDates[recentDates.length - 1]);

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

  const dayQueries = useQueries({
    queries: recentDates.map((date) => ({
      enabled: Boolean(db),
      queryKey: ['day-status', date],
      queryFn: () => getDayStatus(date),
    })),
  });
  const dayBalanceQuery = useDayBalance(selectedDate);
  const dayRecentFoodsQuery = useDayRecentFoods(selectedDate, 3);

  useFocusEffect(
    useCallback(() => {
      void queryClient.invalidateQueries({ queryKey: ['day-status'] });
    }, [queryClient])
  );

  const weekItems = useMemo<WeekItem[]>(
    () =>
      recentDates.map((date, index) => {
        const query = dayQueries[index];
        const progress = query.data?.progressPercent ?? 0;
        const state = query.data?.state ?? 'empty';

        return {
          date,
          dayLetter: dayLetterFromDate(date),
          progressPercent: progress,
          state,
        };
      }),
    [dayQueries, recentDates]
  );
  const selectedDayIndex = useMemo(
    () => recentDates.findIndex((date) => date === selectedDate),
    [recentDates, selectedDate]
  );
  const hasScanForSelectedDay = Boolean(dayQueries[selectedDayIndex]?.data?.hasScan);
  const selectedDayScanSummaryQuery = useQuery({
    enabled: Boolean(db) && hasScanForSelectedDay,
    queryKey: ['home-selected-day-scan-summary', selectedDate],
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
  const waterGoalMl = dayBalanceQuery.data?.waterGoalMl ?? 2500;
  const sodiumMg = dayBalanceQuery.data?.sodiumMg ?? 0;
  const sodiumGoalMg = dayBalanceQuery.data?.sodiumGoalMg ?? 2300;
  const recentFoods = dayRecentFoodsQuery.data ?? [];
  const hydrationProgress = useMemo(
    () => clamp01(waterIntakeMl / Math.max(waterGoalMl, 1)),
    [waterGoalMl, waterIntakeMl]
  );
  const sodiumProgress = useMemo(
    () => clamp01(sodiumMg / Math.max(sodiumGoalMg, 1)),
    [sodiumGoalMg, sodiumMg]
  );
  const scanLoggedTimeLabel = useMemo(
    () => formatScanLoggedTime(selectedDayScanSummary?.createdAt ?? null),
    [selectedDayScanSummary?.createdAt]
  );
  const scanDeltaLabel = useMemo(() => {
    const delta = selectedDayScanSummary?.deltaVsYesterday;
    if (delta === null || delta === undefined) return null;
    const sign = delta >= 0 ? '+' : '-';
    return `${sign}${Math.abs(Math.round(delta))} vs yesterday`;
  }, [selectedDayScanSummary?.deltaVsYesterday]);
  const scanFeedback = selectedDayScanSummary?.feedback?.trim() ?? '';
  const scanFocusAreas = useMemo(
    () => parseFlaggedAreas(selectedDayScanSummary?.flaggedAreas ?? null).map(formatFocusAreaTag),
    [selectedDayScanSummary?.flaggedAreas]
  );
  const visibleScanFocusAreas = scanFocusAreas.slice(0, 2);
  const hiddenScanFocusAreaCount = Math.max(0, scanFocusAreas.length - visibleScanFocusAreas.length);

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
    } catch (error) {
      if (previousBalance) {
        queryClient.setQueryData(queryKey, previousBalance);
      }
      console.warn('Failed to update hydration', error);
    }
  }, [db, queryClient, selectedDate]);

  return (
    <ScrollView
      contentInsetAdjustmentBehavior="automatic"
      style={styles.container}
      contentContainerStyle={{
        paddingTop: 16,
        paddingBottom: insets.bottom + 24,
        paddingHorizontal: 16,
        gap: 18,
      }}
    >
      <View style={styles.weekRow}>
        {weekItems.map((item) => {
          const isSelected = item.date === selectedDate;
          return (
            <PressableScale
              key={item.date}
              onPress={() => handleSelectDate(item.date)}
              style={styles.dayPressable}
            >
              <DayProgressCircle
                progressPercent={item.progressPercent}
                selected={isSelected}
                size={circleSize}
              />
              <Text selectable style={[styles.dayLabel, isSelected ? styles.dayLabelSelected : null]}>
                {item.dayLetter}
              </Text>
            </PressableScale>
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
                {selectedDayScanSummaryQuery.isLoading ? 'Loading scan...' : scanLoggedTimeLabel}
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
                {scanDeltaLabel ?? 'No previous baseline'}
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
                <ScanScoreRing score={selectedDayScanSummary?.score ?? 0} />
                <Text selectable style={styles.scanScoreCaption}>
                  Bloat score
                </Text>
              </View>
            </View>

            <Text selectable numberOfLines={2} style={styles.scanFeedbackText}>
              {scanFeedback || 'No analysis summary available for this scan yet.'}
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
                  label="View Report"
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
                  label="Retake"
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
              Daily Morning Scan
            </Text>
            <Text selectable style={styles.scanEmptyDescription}>
              No scan yet for this day. Scan your face to start your morning routine.
            </Text>
            <View style={styles.scanEmptyStatusPill}>
              <Text selectable style={styles.scanEmptyStatusText}>
                NO SCAN YET
              </Text>
            </View>
            <IOSHost style={styles.scanButtonHost} matchContents useViewportSizeMeasurement>
              <IOSButton
                label="Start Scan"
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
      <View style={{ flexDirection: 'column', width: '100%', gap: 8, alignItems: 'stretch', justifyContent: 'center' }}>
        <View
          style={{
            flex: 1,
            borderRadius: 16,
            borderCurve: 'continuous',
            paddingHorizontal: 12,
            paddingVertical: 16,
            backgroundColor: 'white',
            gap: 8,
          }}
        >
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
              <Ionicons name="water" size={18} color="rgba(0,0,0,0.3)" />
              <Text selectable style={{ fontSize: 12, fontWeight: '600', color: 'rgba(0,0,0,0.38)' }}>
                HYDRATION
              </Text>
            </View>
            <Text selectable style={styles.stepHint}>
              {WATER_STEP_ML}ml step
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
            Target {waterGoalMl.toLocaleString()} ml
          </Text>
        </View>

        <View
          style={{
            flex: 1,
            borderRadius: 16,
            borderCurve: 'continuous',
            paddingHorizontal: 12,
            paddingVertical: 16,
            backgroundColor: 'white',
            gap: 8,
          }}
        >
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
              <Ionicons name="flash" size={18} color="rgba(0,0,0,0.3)" />
              <Text selectable style={{ fontSize: 12, fontWeight: '600', color: 'rgba(0,0,0,0.38)' }}>
                SODIUM
              </Text>
            </View>
            <IOSHost matchContents useViewportSizeMeasurement>
              <IOSButton
                label="Log Food"
                systemImage="fork.knife"
                onPress={handleLogFood}
                modifiers={[
                  controlSize('regular'),
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
            Last 3 logged foods
          </Text>
          <Link href="/(food)/all" asChild>
            <PressableScale onPress={hapticSelection} style={styles.recentFoodsHeaderAction}>
              <Ionicons name="chevron-forward" size={19} color="rgba(0, 0, 0, 0.78)" />
            </PressableScale>
          </Link>
        </View>
        {recentFoods.length === 0 ? (
          <View style={styles.recentFoodCardEmpty}>
            <Text selectable style={styles.recentFoodsEmpty}>
              No foods logged for this day.
            </Text>
            {process.env.EXPO_OS === 'ios' ? (
              <IOSHost style={styles.recentFoodEmptyActionHost} matchContents useViewportSizeMeasurement>
                <IOSButton
                  label="Log Food"
                  systemImage="fork.knife"
                  onPress={handleLogFood}
                  modifiers={[
                    controlSize('regular'),
                    tint('rgba(34, 211, 238, 1)'),
                    buttonStyle('borderedProminent'),
                  ]}
                />
              </IOSHost>
            ) : (
              <PressableScale onPress={handleLogFood} style={styles.recentFoodEmptyActionFallback}>
                <Text selectable style={styles.recentFoodEmptyActionFallbackLabel}>
                  Log Food
                </Text>
              </PressableScale>
            )}
          </View>
        ) : (
          <View style={styles.recentFoodsList}>
            {recentFoods.map((food) => (
              <Link key={food.id} href={`/(food)/${food.id}` as never} asChild>
                <PressableScale onPress={hapticSelection} style={styles.recentFoodRow}>
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
                            {formatFoodLogTime(food.createdAt)}
                          </Text>
                          <Ionicons
                            name="chevron-forward"
                            size={17}
                            color="rgba(15, 23, 42, 0.32)"
                          />
                        </View>
                      </View>
                      <View style={styles.recentFoodMetaRow}>
                        <Text selectable style={styles.recentFoodMetaPill}>
                          {food.sodiumEstimateMg.toLocaleString()} mg
                        </Text>
                        <Text selectable style={styles.recentFoodRisk}>
                          {formatRiskLabel(food.bloatRiskLevel)}
                        </Text>
                      </View>
                    </View>
                  </View>
                  {food.aiReasoning ? (
                    <Text selectable numberOfLines={2} style={styles.recentFoodReason}>
                      {food.aiReasoning}
                    </Text>
                  ) : null}
                </PressableScale>
              </Link>
            ))}
          </View>
        )}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
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
    color: '#6B7280',
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 0.6,
  },
  dayLabelSelected: {
    color: '#111827',
  },
  stepHint: {
    fontSize: 11,
    fontWeight: '600',
    color: 'rgba(15, 23, 42, 0.45)',
  },
  scanCard: {
    borderRadius: 20,
    borderCurve: 'continuous',
    paddingHorizontal: 16,
    paddingVertical: 14,
    alignItems: 'stretch',
    justifyContent: 'center',
    gap: 8,
  },
  scanCardEmpty: {
    borderWidth: 1.5,
    borderStyle: 'dashed',
    borderColor: 'rgba(15, 23, 42, 0.18)',
    backgroundColor: 'rgba(255, 255, 255, 0.72)',
  },
  scanCardComplete: {
    backgroundColor: 'white',
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
    fontSize: 20,
    fontWeight: '700',
    color: 'rgba(15, 23, 42, 0.92)',
  },
  scanEmptyDescription: {
    fontSize: 14,
    fontWeight: '500',
    color: 'rgba(15, 23, 42, 0.6)',
    textAlign: 'center',
    lineHeight: 20,
  },
  scanEmptyStatusPill: {
    borderRadius: 999,
    borderCurve: 'continuous',
    paddingHorizontal: 10,
    paddingVertical: 4,
    backgroundColor: 'rgba(148, 163, 184, 0.16)',
  },
  scanEmptyStatusText: {
    fontSize: 11,
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
    fontSize: 11,
    fontWeight: '600',
    color: 'rgba(15, 23, 42, 0.55)',
    fontVariant: ['tabular-nums'],
  },
  scanMetaTopSecondary: {
    fontSize: 11,
    fontWeight: '700',
    color: 'rgba(15, 23, 42, 0.52)',
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
    fontSize: 28,
    fontWeight: '800',
    color: 'rgba(15, 23, 42, 0.9)',
    fontVariant: ['tabular-nums'],
  },
  scanScoreCaption: {
    fontSize: 11,
    fontWeight: '600',
    color: 'rgba(15, 23, 42, 0.46)',
  },
  scanTrendTextBetter: {
    color: 'rgba(21, 128, 61, 0.92)',
  },
  scanTrendTextWorse: {
    color: 'rgba(185, 28, 28, 0.92)',
  },
  scanFeedbackText: {
    fontSize: 13,
    fontWeight: '500',
    color: 'rgba(15, 23, 42, 0.67)',
    lineHeight: 18,
  },
  scanFocusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 6,
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
    marginTop: 2,
  },
  scanActionButtonHost: {
    flex: 1,
  },
  hydrationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  metricTargetLine: {
    fontSize: 13,
    fontWeight: '600',
    color: 'rgba(15, 23, 42, 0.42)',
  },
  metricValue: {
    fontSize: 18,
    fontWeight: '700',
    color: 'rgba(15, 23, 42, 0.92)',
  },
  metricTarget: {
    fontSize: 14,
    fontWeight: '600',
    color: 'rgba(15, 23, 42, 0.42)',
  },
  recentFoodCardsSection: {
    gap: 8,
  },
  recentFoodsHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
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
    fontSize: 15,
    fontWeight: '700',
    color: 'rgba(0, 0, 0, 0.9)',
  },
  recentFoodCardEmpty: {
    borderRadius: 14,
    borderCurve: 'continuous',
    backgroundColor: 'white',
    paddingHorizontal: 12,
    paddingVertical: 12,
    gap: 10,
  },
  recentFoodsEmpty: {
    fontSize: 13,
    fontWeight: '500',
    color: 'rgba(15, 23, 42, 0.45)',
  },
  recentFoodEmptyActionHost: {
    alignSelf: 'flex-start',
  },
  recentFoodEmptyActionFallback: {
    alignSelf: 'flex-start',
    borderRadius: 999,
    borderCurve: 'continuous',
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: 'rgba(34, 211, 238, 0.15)',
  },
  recentFoodEmptyActionFallbackLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: 'rgba(34, 211, 238, 1)',
  },
  recentFoodsList: {
    gap: 8,
  },
  recentFoodRow: {
    borderRadius: 14,
    borderCurve: 'continuous',
    backgroundColor: 'white',
    paddingHorizontal: 12,
    paddingVertical: 12,
    gap: 6,
  },
  recentFoodMainRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
  },
  recentFoodThumb: {
    width: 48,
    height: 48,
    borderRadius: 10,
    borderCurve: 'continuous',
    backgroundColor: 'rgba(15, 23, 42, 0.08)',
  },
  recentFoodThumbFallback: {
    width: 48,
    height: 48,
    borderRadius: 10,
    borderCurve: 'continuous',
    backgroundColor: 'rgba(15, 23, 42, 0.08)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  recentFoodContent: {
    flex: 1,
    gap: 5,
    minWidth: 0,
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
    gap: 4,
    flexShrink: 0,
  },
  recentFoodName: {
    flex: 1,
    minWidth: 0,
    flexShrink: 1,
    fontSize: 14,
    fontWeight: '600',
    color: 'rgba(15, 23, 42, 0.78)',
  },
  recentFoodTime: {
    fontSize: 11,
    fontWeight: '600',
    color: 'rgba(15, 23, 42, 0.48)',
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
    fontSize: 12,
    fontWeight: '700',
    color: 'rgba(15, 23, 42, 0.64)',
    backgroundColor: 'rgba(15, 23, 42, 0.08)',
    borderRadius: 999,
    borderCurve: 'continuous',
    paddingHorizontal: 8,
    paddingVertical: 3,
    overflow: 'hidden',
    fontVariant: ['tabular-nums'],
  },
  recentFoodRisk: {
    fontSize: 11,
    fontWeight: '700',
    color: 'rgba(15, 23, 42, 0.54)',
    letterSpacing: 0.2,
  },
  recentFoodReason: {
    fontSize: 12,
    fontWeight: '500',
    color: 'rgba(15, 23, 42, 0.56)',
    lineHeight: 18,
  },
});
