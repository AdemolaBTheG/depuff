import Shimmer from '@/components/shimmer';
import { PAYWALL_ROUTE, FREE_MAX_ANALYTICS_RANGE_DAYS } from '@/constants/gating';
import { useSubscription } from '@/context/SubscriptionContext';
import { dailyLogs, faceScans, foodLogs } from '@/db/schema';
import { useDbStore } from '@/stores/dbStore';
import { useSettingsStore } from '@/stores/settingsStore';
import { hapticSelection } from '@/utils/haptics';
import { Chart, Host as IOSHost, Picker as IOSPicker, Text as IOSText, type ChartDataPoint } from '@expo/ui/swift-ui';
import { pickerStyle, tag } from '@expo/ui/swift-ui/modifiers';
import { Ionicons } from '@expo/vector-icons';
import { useQuery } from '@tanstack/react-query';
import { desc, sql } from 'drizzle-orm';
import { Link, useRouter } from 'expo-router';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';

const RANGE_OPTIONS = [7, 30, 90] as const;

type RangeDays = (typeof RANGE_OPTIONS)[number];

type BloatTrendStats = {
  points: ChartDataPoint[];
  averageCurrent: number | null;
  averagePrevious: number | null;
  deltaPercent: number | null;
  sampleCount: number;
};

type SodiumTrendStats = {
  points: ChartDataPoint[];
  averageMg: number;
  maxMg: number;
  daysOverGoal: number;
  loggedDays: number;
};

type HydrationTrendStats = {
  points: ChartDataPoint[];
  averageMl: number;
  maxMl: number;
  daysHitGoal: number;
  loggedDays: number;
};

type RiskMixStats = {
  points: ChartDataPoint[];
  safeCount: number;
  cautionCount: number;
  dangerCount: number;
  unknownCount: number;
  totalMeals: number;
};

type TopFoodItem = {
  key: string;
  foodName: string;
  count: number;
  avgSodiumMg: number;
  dominantRisk: 'safe' | 'caution' | 'danger' | 'unknown';
};

type TopFoodsStats = {
  items: TopFoodItem[];
  totalMeals: number;
};

function toDateKey(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function getDateKeyFromTimestamp(value: string | null): string | null {
  if (!value) return null;
  const keyFromSlice = value.slice(0, 10);
  if (/^\d{4}-\d{2}-\d{2}$/.test(keyFromSlice)) return keyFromSlice;

  const normalized = value.includes('T') ? value : value.replace(' ', 'T');
  const parsed = new Date(normalized);
  if (Number.isNaN(parsed.getTime())) return null;
  return toDateKey(parsed);
}

function buildRangeKeys(days: number, offsetDays = 0): string[] {
  const now = new Date();
  const keys: string[] = [];
  for (let i = days - 1; i >= 0; i -= 1) {
    const date = new Date(now);
    date.setDate(now.getDate() - i - offsetDays);
    keys.push(toDateKey(date));
  }
  return keys;
}

function average(values: number[]): number | null {
  if (values.length === 0) return null;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function formatAxisLabel(dateKey: string, range: RangeDays, locale: string): string {
  const parsed = new Date(`${dateKey}T00:00:00`);
  if (Number.isNaN(parsed.getTime())) return dateKey;
  if (range === 7) {
    return new Intl.DateTimeFormat(locale, { weekday: 'short' }).format(parsed);
  }
  return new Intl.DateTimeFormat(locale, { month: 'short', day: 'numeric' }).format(parsed);
}

function normalizeRiskLevel(value: string | null): 'safe' | 'caution' | 'danger' | 'unknown' {
  if (!value) return 'unknown';
  const normalized = value.trim().toLowerCase();

  if (normalized === 'safe' || normalized === 'low') return 'safe';
  if (normalized === 'caution' || normalized === 'warning' || normalized === 'moderate') return 'caution';
  if (normalized === 'danger' || normalized === 'high' || normalized === 'extreme') return 'danger';
  return 'unknown';
}

function formatPercent(count: number, total: number): string {
  if (total <= 0) return '0%';
  return `${Math.round((count / total) * 100)}%`;
}

function formatCompactNumber(value: number, locale: string): string {
  return new Intl.NumberFormat(locale, {
    notation: 'compact',
    maximumFractionDigits: 1,
  }).format(value);
}

function formatRiskLabel(
  value: 'safe' | 'caution' | 'danger' | 'unknown',
  unknownLabel = 'Unknown'
): string {
  if (value === 'unknown') return unknownLabel;
  return value.charAt(0).toUpperCase() + value.slice(1);
}

function normalizeFoodKey(value: string | null, fallbackName = 'Unnamed food'): string {
  const cleaned = (value ?? fallbackName).trim();
  if (!cleaned) return 'unnamed food';
  return cleaned.toLowerCase().replace(/\s+/g, ' ');
}

function resolveDominantRisk(counts: Record<'safe' | 'caution' | 'danger' | 'unknown', number>) {
  const order: ('danger' | 'caution' | 'safe' | 'unknown')[] = ['danger', 'caution', 'safe', 'unknown'];
  let best: 'safe' | 'caution' | 'danger' | 'unknown' = 'unknown';
  let bestCount = -1;

  for (const key of order) {
    const value = counts[key];
    if (value > bestCount) {
      best = key;
      bestCount = value;
    }
  }

  return best;
}

async function fetchBloatTrend(range: RangeDays, locale: string): Promise<BloatTrendStats> {
  const db = useDbStore.getState().db;
  if (!db) {
    throw new Error('Database is not initialized');
  }

  const rows = await db
    .select({
      createdAt: faceScans.createdAt,
      score: faceScans.score,
    })
    .from(faceScans)
    .orderBy(desc(faceScans.createdAt), desc(faceScans.id));

  const scoreByDay = new Map<string, number[]>();
  for (const row of rows) {
    const key = getDateKeyFromTimestamp(row.createdAt);
    if (!key) continue;
    const score = row.score ?? 0;
    const dayScores = scoreByDay.get(key) ?? [];
    dayScores.push(score);
    scoreByDay.set(key, dayScores);
  }

  const dayAverages = new Map<string, number>();
  scoreByDay.forEach((scores, key) => {
    const avg = average(scores);
    if (avg !== null) {
      dayAverages.set(key, avg);
    }
  });

  const currentKeys = buildRangeKeys(range);
  const previousKeys = buildRangeKeys(range, range);
  const currentValues = currentKeys.map((key) => dayAverages.get(key)).filter((value): value is number => value !== undefined);
  const previousValues = previousKeys
    .map((key) => dayAverages.get(key))
    .filter((value): value is number => value !== undefined);

  const averageCurrent = average(currentValues);
  const averagePrevious = average(previousValues);
  const deltaPercent =
    averageCurrent !== null && averagePrevious !== null && averagePrevious > 0
      ? ((averageCurrent - averagePrevious) / averagePrevious) * 100
      : null;

  const points: ChartDataPoint[] = currentKeys
    .filter((key) => dayAverages.has(key))
    .map((key) => ({
      x: formatAxisLabel(key, range, locale),
      y: Number(dayAverages.get(key)?.toFixed(1) ?? 0),
    }));

  return {
    points,
    averageCurrent,
    averagePrevious,
    deltaPercent,
    sampleCount: currentValues.length,
  };
}

async function fetchSodiumTrend(
  range: RangeDays,
  sodiumGoalMg: number,
  locale: string
): Promise<SodiumTrendStats> {
  const db = useDbStore.getState().db;
  if (!db) {
    throw new Error('Database is not initialized');
  }

  const rows = await db
    .select({
      logDate: foodLogs.logDate,
      totalMg: sql<number>`coalesce(sum(${foodLogs.sodiumEstimateMg}), 0)`,
    })
    .from(foodLogs)
    .groupBy(foodLogs.logDate)
    .orderBy(desc(foodLogs.logDate));

  const sodiumByDay = new Map<string, number>();
  for (const row of rows) {
    sodiumByDay.set(row.logDate, row.totalMg ?? 0);
  }

  const currentKeys = buildRangeKeys(range);
  const values = currentKeys.map((key) => sodiumByDay.get(key) ?? 0);
  const averageMg = values.length > 0 ? values.reduce((sum, value) => sum + value, 0) / values.length : 0;
  const maxMg = values.length > 0 ? Math.max(...values) : 0;
  const daysOverGoal = values.filter((value) => value >= sodiumGoalMg).length;
  const loggedDays = values.filter((value) => value > 0).length;

  const points: ChartDataPoint[] = currentKeys.map((key) => ({
    x: formatAxisLabel(key, range, locale),
    y: Math.round(sodiumByDay.get(key) ?? 0),
  }));

  return {
    points,
    averageMg,
    maxMg,
    daysOverGoal,
    loggedDays,
  };
}

async function fetchHydrationTrend(
  range: RangeDays,
  waterGoalMl: number,
  locale: string
): Promise<HydrationTrendStats> {
  const db = useDbStore.getState().db;
  if (!db) {
    throw new Error('Database is not initialized');
  }

  const rows = await db
    .select({
      date: dailyLogs.date,
      waterIntake: dailyLogs.waterIntake,
    })
    .from(dailyLogs)
    .orderBy(desc(dailyLogs.date));

  const hydrationByDay = new Map<string, number>();
  for (const row of rows) {
    hydrationByDay.set(row.date, row.waterIntake ?? 0);
  }

  const currentKeys = buildRangeKeys(range);
  const values = currentKeys.map((key) => hydrationByDay.get(key) ?? 0);
  const averageMl = values.length > 0 ? values.reduce((sum, value) => sum + value, 0) / values.length : 0;
  const maxMl = values.length > 0 ? Math.max(...values) : 0;
  const daysHitGoal = values.filter((value) => value >= waterGoalMl).length;
  const loggedDays = values.filter((value) => value > 0).length;

  const points: ChartDataPoint[] = currentKeys.map((key) => ({
    x: formatAxisLabel(key, range, locale),
    y: Math.round(hydrationByDay.get(key) ?? 0),
  }));

  return {
    points,
    averageMl,
    maxMl,
    daysHitGoal,
    loggedDays,
  };
}

async function fetchRiskMix(range: RangeDays): Promise<RiskMixStats> {
  const db = useDbStore.getState().db;
  if (!db) {
    throw new Error('Database is not initialized');
  }

  const rows = await db
    .select({
      logDate: foodLogs.logDate,
      bloatRiskLevel: foodLogs.bloatRiskLevel,
    })
    .from(foodLogs)
    .orderBy(desc(foodLogs.logDate), desc(foodLogs.id));

  const keySet = new Set(buildRangeKeys(range));

  let safeCount = 0;
  let cautionCount = 0;
  let dangerCount = 0;
  let unknownCount = 0;

  for (const row of rows) {
    if (!keySet.has(row.logDate)) continue;

    const risk = normalizeRiskLevel(row.bloatRiskLevel);
    if (risk === 'safe') safeCount += 1;
    else if (risk === 'caution') cautionCount += 1;
    else if (risk === 'danger') dangerCount += 1;
    else unknownCount += 1;
  }

  const totalMeals = safeCount + cautionCount + dangerCount + unknownCount;

  const points: ChartDataPoint[] = [
    { x: 'Safe', y: safeCount, color: 'rgba(34, 197, 94, 0.9)' },
    { x: 'Caution', y: cautionCount, color: 'rgba(245, 158, 11, 0.9)' },
    { x: 'Danger', y: dangerCount, color: 'rgba(239, 68, 68, 0.9)' },
  ];

  return {
    points,
    safeCount,
    cautionCount,
    dangerCount,
    unknownCount,
    totalMeals,
  };
}

async function fetchTopFoods(range: RangeDays, unnamedFoodLabel: string): Promise<TopFoodsStats> {
  const db = useDbStore.getState().db;
  if (!db) {
    throw new Error('Database is not initialized');
  }

  const rows = await db
    .select({
      logDate: foodLogs.logDate,
      foodName: foodLogs.foodName,
      sodiumEstimateMg: foodLogs.sodiumEstimateMg,
      bloatRiskLevel: foodLogs.bloatRiskLevel,
    })
    .from(foodLogs)
    .orderBy(desc(foodLogs.logDate), desc(foodLogs.id));

  const keySet = new Set(buildRangeKeys(range));
  const foodMap = new Map<
    string,
    {
      key: string;
      foodName: string;
      count: number;
      totalSodium: number;
      riskCounts: Record<'safe' | 'caution' | 'danger' | 'unknown', number>;
    }
  >();

  let totalMeals = 0;

  for (const row of rows) {
    if (!keySet.has(row.logDate)) continue;
    totalMeals += 1;

    const key = normalizeFoodKey(row.foodName, unnamedFoodLabel);
    const displayName = (row.foodName ?? unnamedFoodLabel).trim() || unnamedFoodLabel;
    const risk = normalizeRiskLevel(row.bloatRiskLevel);
    const sodium = row.sodiumEstimateMg ?? 0;

    const current =
      foodMap.get(key) ??
      {
        key,
        foodName: displayName,
        count: 0,
        totalSodium: 0,
        riskCounts: { safe: 0, caution: 0, danger: 0, unknown: 0 },
      };

    current.count += 1;
    current.totalSodium += sodium;
    current.riskCounts[risk] += 1;
    foodMap.set(key, current);
  }

  const items = Array.from(foodMap.values())
    .map<TopFoodItem>((entry) => ({
      key: entry.key,
      foodName: entry.foodName,
      count: entry.count,
      avgSodiumMg: entry.count > 0 ? entry.totalSodium / entry.count : 0,
      dominantRisk: resolveDominantRisk(entry.riskCounts),
    }))
    .sort((a, b) => b.count - a.count || b.avgSodiumMg - a.avgSodiumMg)
    .slice(0, 3);

  return { items, totalMeals };
}

export default function ProgressIndex() {
  const router = useRouter();
  const { t, i18n } = useTranslation();
  const { isPro } = useSubscription();
  const db = useDbStore((state) => state.db);
  const { waterGoalMl, sodiumGoalMg } = useSettingsStore();
  const [rangeIndex, setRangeIndex] = useState(0);
  const range = RANGE_OPTIONS[rangeIndex];

  useEffect(() => {
    if (!isPro && range > FREE_MAX_ANALYTICS_RANGE_DAYS) {
      setRangeIndex(0);
    }
  }, [isPro, range]);

  const handleRangeChange = useCallback(
    (nextIndex: number) => {
      hapticSelection();
      const nextRange = RANGE_OPTIONS[nextIndex];
      if (!isPro && nextRange > FREE_MAX_ANALYTICS_RANGE_DAYS) {
        router.push(PAYWALL_ROUTE as never);
        setRangeIndex(0);
        return;
      }
      setRangeIndex(nextIndex);
    },
    [isPro, router]
  );

  const handleOpenPaywall = useCallback(() => {
    hapticSelection();
    router.push(PAYWALL_ROUTE as never);
  }, [router]);

  const trendQuery = useQuery({
    enabled: Boolean(db),
    queryKey: ['progress-bloat-trend', range, i18n.language],
    queryFn: () => fetchBloatTrend(range, i18n.language),
  });
  const sodiumQuery = useQuery({
    enabled: Boolean(db),
    queryKey: ['progress-sodium-trend', range, sodiumGoalMg, i18n.language],
    queryFn: () => fetchSodiumTrend(range, sodiumGoalMg, i18n.language),
  });
  const hydrationQuery = useQuery({
    enabled: Boolean(db),
    queryKey: ['progress-hydration-trend', range, waterGoalMl, i18n.language],
    queryFn: () => fetchHydrationTrend(range, waterGoalMl, i18n.language),
  });
  const riskMixQuery = useQuery({
    enabled: Boolean(db) && isPro,
    queryKey: ['progress-risk-mix', range],
    queryFn: () => fetchRiskMix(range),
  });
  const topFoodsQuery = useQuery({
    enabled: Boolean(db) && isPro,
    queryKey: ['progress-top-foods', range, i18n.language],
    queryFn: () =>
      fetchTopFoods(range, t('food.unnamedFood', { defaultValue: 'Unnamed food' })),
  });

  const trend = trendQuery.data;
  const averageCurrentLabel =
    trend?.averageCurrent !== null && trend?.averageCurrent !== undefined
      ? Math.round(trend.averageCurrent).toString()
      : '--';
  const deltaLabel = useMemo(() => {
    const value = trend?.deltaPercent ?? null;
    if (value === null) {
      return t('progress.noPreviousComparison', {
        defaultValue: 'No previous period comparison yet',
      });
    }
    const rounded = Math.abs(value).toFixed(1);
    return t('progress.deltaVsPrevious', {
      defaultValue: `${value > 0 ? '+' : '-'}${rounded}% vs previous period`,
      sign: value > 0 ? '+' : '-',
      value: rounded,
    });
  }, [t, trend?.deltaPercent]);
  const deltaPositive = (trend?.deltaPercent ?? 0) > 0;
  const referenceLines =
    trend?.averageCurrent !== null && trend?.averageCurrent !== undefined
      ? [{ x: 'Average', y: Number(trend.averageCurrent.toFixed(1)), color: 'rgba(15, 23, 42, 0.45)' }]
      : [];

  const fallbackBars = useMemo(() => {
    if (!trend || trend.points.length === 0) return [];
    const maxValue = Math.max(...trend.points.map((point) => point.y), 1);
    return trend.points.map((point) => ({
      label: String(point.x),
      height: (point.y / maxValue) * 80,
    }));
  }, [trend]);
  const sodium = sodiumQuery.data;
  const sodiumReferenceLines = [{ x: 'Goal', y: sodiumGoalMg, color: 'rgba(239, 68, 68, 0.9)' }];
  const sodiumFallbackBars = useMemo(() => {
    if (!sodium || sodium.points.length === 0) return [];
    const maxValue = Math.max(sodiumGoalMg, ...sodium.points.map((point) => point.y), 1);
    return sodium.points.map((point) => ({
      label: String(point.x),
      height: (point.y / maxValue) * 76,
    }));
  }, [sodium, sodiumGoalMg]);
  const hydration = hydrationQuery.data;
  const hydrationReferenceLines = [{ x: 'Goal', y: waterGoalMl, color: 'rgba(34, 211, 238, 0.95)' }];
  const hydrationFallbackBars = useMemo(() => {
    if (!hydration || hydration.points.length === 0) return [];
    const maxValue = Math.max(waterGoalMl, ...hydration.points.map((point) => point.y), 1);
    return hydration.points.map((point) => ({
      label: String(point.x),
      height: (point.y / maxValue) * 76,
    }));
  }, [hydration, waterGoalMl]);
  const riskMix = riskMixQuery.data;
  const riskMixFallbackBars = useMemo(() => {
    if (!riskMix || riskMix.points.length === 0) return [];
    const maxValue = Math.max(...riskMix.points.map((point) => point.y), 1);
    return riskMix.points.map((point) => ({
      label: String(point.x),
      height: (point.y / maxValue) * 76,
      color: point.color ?? 'rgba(15, 23, 42, 0.6)',
    }));
  }, [riskMix]);
  const topFoods = topFoodsQuery.data;
  const avgSodiumLabel =
    sodium && sodium.loggedDays > 0 ? formatCompactNumber(Math.round(sodium.averageMg), i18n.language) : '--';
  const hydrationHitRateLabel =
    hydration ? `${Math.round((hydration.daysHitGoal / Math.max(range, 1)) * 100)}%` : '--';

  const renderChartLoadingState = () => (
    <View style={styles.emptyChartState}>
      <Shimmer style={styles.chartLoadingShimmer}>
        <Shimmer.Overlay width="42%" duration={1250} repeatDelay={100}>
          <View style={styles.loadingShimmerTrack}>
            <View style={styles.loadingShimmerEdge} />
            <View style={styles.loadingShimmerCenter} />
            <View style={styles.loadingShimmerEdge} />
          </View>
        </Shimmer.Overlay>
        <View style={styles.chartLoadingBody}>
          <View style={styles.chartLoadingLine} />
          <View style={styles.chartLoadingBars}>
            <View style={[styles.chartLoadingBar, styles.chartLoadingBarSm]} />
            <View style={[styles.chartLoadingBar, styles.chartLoadingBarMd]} />
            <View style={[styles.chartLoadingBar, styles.chartLoadingBarLg]} />
            <View style={[styles.chartLoadingBar, styles.chartLoadingBarMd]} />
            <View style={[styles.chartLoadingBar, styles.chartLoadingBarSm]} />
            <View style={[styles.chartLoadingBar, styles.chartLoadingBarXs]} />
          </View>
        </View>
      </Shimmer>
    </View>
  );

  const renderTopFoodsLoadingState = () => (
    <View style={styles.topFoodsLoadingState}>
      <Shimmer style={styles.topFoodsLoadingShimmer}>
        <Shimmer.Overlay width="42%" duration={1250} repeatDelay={100}>
          <View style={styles.loadingShimmerTrack}>
            <View style={styles.loadingShimmerEdge} />
            <View style={styles.loadingShimmerCenter} />
            <View style={styles.loadingShimmerEdge} />
          </View>
        </Shimmer.Overlay>
        <View style={styles.topFoodsLoadingBody}>
          <View style={styles.topFoodsLoadingRow}>
            <View style={styles.topFoodsLoadingTitle} />
            <View style={styles.topFoodsLoadingBadge} />
            <View style={styles.topFoodsLoadingMeta} />
          </View>
          <View style={styles.topFoodsLoadingDivider} />
          <View style={styles.topFoodsLoadingRow}>
            <View style={[styles.topFoodsLoadingTitle, styles.topFoodsLoadingTitleAlt]} />
            <View style={styles.topFoodsLoadingBadge} />
            <View style={[styles.topFoodsLoadingMeta, styles.topFoodsLoadingMetaAlt]} />
          </View>
          <View style={styles.topFoodsLoadingDivider} />
          <View style={styles.topFoodsLoadingRow}>
            <View style={[styles.topFoodsLoadingTitle, styles.topFoodsLoadingTitleLast]} />
            <View style={styles.topFoodsLoadingBadge} />
            <View style={[styles.topFoodsLoadingMeta, styles.topFoodsLoadingMetaLast]} />
          </View>
        </View>
      </Shimmer>
    </View>
  );

  return (
    <ScrollView
      contentInsetAdjustmentBehavior="automatic"
      style={styles.container}
      contentContainerStyle={styles.contentContainer}
    >
      <View style={styles.globalRangeRow}>
        <View style={styles.globalRangeTitleRow}>
          <Text selectable style={styles.globalRangeLabel}>
            {t('progress.range', { defaultValue: 'Range' })}
          </Text>
          {!isPro ? (
            <Text selectable style={styles.globalRangeLimitLabel}>
              {t('progress.freeLimit7d', { defaultValue: 'Free: 7D' })}
            </Text>
          ) : null}
        </View>
        {process.env.EXPO_OS === 'ios' ? (
          <IOSHost style={styles.rangePickerHost} matchContents useViewportSizeMeasurement>
            <IOSPicker
              selection={rangeIndex}
              onSelectionChange={handleRangeChange}
              modifiers={[pickerStyle('segmented')]}
            >
              {RANGE_OPTIONS.map((option, index) => (
                <IOSText key={option} modifiers={[tag(index)]}>
                  {`${option}D`}
                </IOSText>
              ))}
            </IOSPicker>
          </IOSHost>
        ) : (
          <View style={styles.rangeFallbackRow}>
            {RANGE_OPTIONS.map((option, index) => (
              <Pressable
                key={option}
                onPress={() => handleRangeChange(index)}
                style={[styles.rangeFallbackChip, index === rangeIndex ? styles.rangeFallbackChipActive : null]}
              >
                <Text
                  selectable
                  style={[
                    styles.rangeFallbackChipText,
                    index === rangeIndex ? styles.rangeFallbackChipTextActive : null,
                  ]}
                >
                  {`${option}D`}
                </Text>
              </Pressable>
            ))}
          </View>
        )}
      </View>

      <View style={styles.kpiStrip}>
        <View style={styles.kpiCell}>
          <View style={styles.kpiItem}>
            <View style={styles.kpiHeaderRow}>
              <View style={[styles.kpiIconWrap, styles.kpiIconWrapBloat]}>
                <Ionicons name="analytics" size={12} color="rgba(14, 116, 144, 1)" />
              </View>
              <Text selectable allowFontScaling={false} numberOfLines={1} ellipsizeMode="tail" style={styles.kpiLabel}>
                {t('progress.kpi.bloat', { defaultValue: 'Bloat' })}
              </Text>
            </View>
            <Text
              selectable
              allowFontScaling={false}
              numberOfLines={1}
              adjustsFontSizeToFit
              minimumFontScale={0.78}
              style={styles.kpiValue}
            >
              {averageCurrentLabel}
            </Text>
          </View>
        </View>
        <View style={styles.kpiCell}>
          <View style={styles.kpiItem}>
            <View style={styles.kpiHeaderRow}>
              <View style={[styles.kpiIconWrap, styles.kpiIconWrapSodium]}>
                <Ionicons name="flash" size={12} color="rgba(194, 65, 12, 1)" />
              </View>
              <Text selectable allowFontScaling={false} numberOfLines={1} ellipsizeMode="tail" style={styles.kpiLabel}>
                {t('progress.kpi.sodium', { defaultValue: 'Sodium' })}
              </Text>
            </View>
            <Text
              selectable
              allowFontScaling={false}
              numberOfLines={1}
              adjustsFontSizeToFit
              minimumFontScale={0.78}
              style={styles.kpiValue}
            >
              {avgSodiumLabel}
            </Text>
          </View>
        </View>
        <View style={styles.kpiCell}>
          <View style={styles.kpiItem}>
            <View style={styles.kpiHeaderRow}>
              <View style={[styles.kpiIconWrap, styles.kpiIconWrapHydration]}>
                <Ionicons name="water" size={12} color="rgba(30, 64, 175, 1)" />
              </View>
              <Text selectable allowFontScaling={false} numberOfLines={1} ellipsizeMode="tail" style={styles.kpiLabel}>
                {t('progress.kpi.hydration', { defaultValue: 'Hydration' })}
              </Text>
            </View>
            <Text
              selectable
              allowFontScaling={false}
              numberOfLines={1}
              adjustsFontSizeToFit
              minimumFontScale={0.78}
              style={styles.kpiValue}
            >
              {hydrationHitRateLabel}
            </Text>
          </View>
        </View>
      </View>

      <View style={styles.card}>
        <Text selectable style={styles.cardTitle}>
          {t('progress.bloatTrend', { defaultValue: 'Bloat Trend' })}
        </Text>

        <View style={styles.metricRow}>
          <View style={styles.metricValueRow}>
            <Text selectable style={styles.metricValue}>
              {averageCurrentLabel}
            </Text>
            <Text selectable style={styles.metricSuffix}>
              {t('progress.avgShort', { defaultValue: 'avg' })}
            </Text>
          </View>
          <View style={styles.metricMetaStack}>
            <Text selectable style={[styles.deltaText, deltaPositive ? styles.deltaPositive : styles.deltaNegative]}>
              {deltaLabel}
            </Text>
            <Text selectable style={styles.sampleHint}>
              {t('progress.scanDays', {
                defaultValue: `${trend?.sampleCount ?? 0} scan day${trend?.sampleCount === 1 ? '' : 's'}`,
                count: trend?.sampleCount ?? 0,
              })}
            </Text>
          </View>
        </View>

        <View style={styles.chartContainer}>
          {trendQuery.isLoading ? (
            renderChartLoadingState()
          ) : (trend?.points.length ?? 0) < 2 ? (
            <View style={styles.emptyChartState}>
              <Text selectable style={styles.emptyChartText}>
                {t('progress.needTwoScanDays', { defaultValue: 'Need 2 scan days for trend.' })}
              </Text>
            </View>
          ) : process.env.EXPO_OS === 'ios' ? (
            <IOSHost style={styles.chartHost}>
              <Chart
                style={styles.chart}
                data={trend?.points ?? []}
                type="line"
                showGrid
                animate
                showLegend={false}
                referenceLines={referenceLines}
                lineStyle={{
                  width: 2.5,
                  pointStyle: 'circle',
                  pointSize: 5,
                  color: 'rgba(34, 211, 238, 1)',
                }}
                ruleStyle={{
                  color: 'rgba(15, 23, 42, 0.45)',
                  lineWidth: 1,
                  dashArray: [4, 4],
                }}
              />
            </IOSHost>
          ) : (
            <View style={styles.fallbackChart}>
              {fallbackBars.map((bar) => (
                <View key={bar.label} style={styles.fallbackBarItem}>
                  <View style={[styles.fallbackBar, { height: bar.height }]} />
                  <Text selectable style={styles.fallbackBarLabel}>
                    {bar.label}
                  </Text>
                </View>
              ))}
            </View>
          )}
        </View>
      </View>

      <View style={styles.card}>
        <Text selectable style={styles.cardTitle}>
          {t('progress.dailySodium', { defaultValue: 'Daily Sodium' })}
        </Text>

        <View style={styles.statChipsRow}>
          <View style={styles.statChip}>
            <Text selectable style={styles.statChipLabel}>
              {t('progress.avg', { defaultValue: 'Avg' })}
            </Text>
            <Text selectable numberOfLines={1} style={styles.statChipValue}>
              {Math.round(sodium?.averageMg ?? 0).toLocaleString()} mg
            </Text>
          </View>
          <View style={styles.statChip}>
            <Text selectable style={styles.statChipLabel}>
              {t('progress.overGoal', { defaultValue: 'Over Goal' })}
            </Text>
            <Text selectable numberOfLines={1} style={styles.statChipValue}>
              {sodium?.daysOverGoal ?? 0}d
            </Text>
          </View>
          <View style={styles.statChip}>
            <Text selectable style={styles.statChipLabel}>
              {t('progress.max', { defaultValue: 'Max' })}
            </Text>
            <Text selectable numberOfLines={1} style={styles.statChipValue}>
              {Math.round(sodium?.maxMg ?? 0).toLocaleString()} mg
            </Text>
          </View>
        </View>
        <Text selectable style={styles.sampleHint}>
          {t('progress.loggedDays', {
            defaultValue: `${sodium?.loggedDays ?? 0} logged day${sodium?.loggedDays === 1 ? '' : 's'}`,
            count: sodium?.loggedDays ?? 0,
          })}
        </Text>

        <View style={styles.chartContainer}>
          {sodiumQuery.isLoading ? (
            renderChartLoadingState()
          ) : (sodium?.loggedDays ?? 0) === 0 ? (
            <View style={styles.emptyChartState}>
              <Text selectable style={styles.emptyChartText}>
                {t('progress.noSodiumLogs', { defaultValue: 'No sodium logs for this range.' })}
              </Text>
            </View>
          ) : process.env.EXPO_OS === 'ios' ? (
            <IOSHost style={styles.chartHost}>
              <Chart
                style={styles.chart}
                data={sodium?.points ?? []}
                type="bar"
                showGrid
                animate
                showLegend={false}
                referenceLines={sodiumReferenceLines}
                barStyle={{
                  cornerRadius: 5,
                  width: range === 7 ? 20 : range === 30 ? 10 : 6,
                }}
                ruleStyle={{
                  color: 'rgba(239, 68, 68, 0.9)',
                  lineWidth: 1.2,
                  dashArray: [3, 3],
                }}
              />
            </IOSHost>
          ) : (
            <View style={styles.fallbackChart}>
              {sodiumFallbackBars.map((bar) => (
                <View key={bar.label} style={styles.fallbackBarItem}>
                  <View style={[styles.fallbackBar, { height: bar.height, backgroundColor: 'rgba(59, 130, 246, 0.7)' }]} />
                  <Text selectable style={styles.fallbackBarLabel}>
                    {bar.label}
                  </Text>
                </View>
              ))}
            </View>
          )}
        </View>
      </View>

      <View style={styles.card}>
        <Text selectable style={styles.cardTitle}>
          {t('progress.hydrationAdherence', { defaultValue: 'Hydration Adherence' })}
        </Text>

        <View style={styles.statChipsRow}>
          <View style={styles.statChip}>
            <Text selectable style={styles.statChipLabel}>
              {t('progress.avg', { defaultValue: 'Avg' })}
            </Text>
            <Text selectable numberOfLines={1} style={styles.statChipValue}>
              {Math.round(hydration?.averageMl ?? 0).toLocaleString()} ml
            </Text>
          </View>
          <View style={styles.statChip}>
            <Text selectable style={styles.statChipLabel}>
              {t('progress.hitGoal', { defaultValue: 'Hit Goal' })}
            </Text>
            <Text selectable numberOfLines={1} style={styles.statChipValue}>
              {hydration?.daysHitGoal ?? 0}d
            </Text>
          </View>
          <View style={styles.statChip}>
            <Text selectable style={styles.statChipLabel}>
              {t('progress.max', { defaultValue: 'Max' })}
            </Text>
            <Text selectable numberOfLines={1} style={styles.statChipValue}>
              {Math.round(hydration?.maxMl ?? 0).toLocaleString()} ml
            </Text>
          </View>
        </View>
        <Text selectable style={styles.sampleHint}>
          {t('progress.loggedDays', {
            defaultValue: `${hydration?.loggedDays ?? 0} logged day${hydration?.loggedDays === 1 ? '' : 's'}`,
            count: hydration?.loggedDays ?? 0,
          })}
        </Text>

        <View style={styles.chartContainer}>
          {hydrationQuery.isLoading ? (
            renderChartLoadingState()
          ) : (hydration?.loggedDays ?? 0) === 0 ? (
            <View style={styles.emptyChartState}>
              <Text selectable style={styles.emptyChartText}>
                {t('progress.noHydrationLogs', {
                  defaultValue: 'No hydration logs for this range.',
                })}
              </Text>
            </View>
          ) : process.env.EXPO_OS === 'ios' ? (
            <IOSHost style={styles.chartHost}>
              <Chart
                style={styles.chart}
                data={hydration?.points ?? []}
                type="bar"
                showGrid
                animate
                showLegend={false}
                referenceLines={hydrationReferenceLines}
                barStyle={{
                  cornerRadius: 5,
                  width: range === 7 ? 20 : range === 30 ? 10 : 6,
                }}
                ruleStyle={{
                  color: 'rgba(34, 211, 238, 0.95)',
                  lineWidth: 1.2,
                  dashArray: [3, 3],
                }}
              />
            </IOSHost>
          ) : (
            <View style={styles.fallbackChart}>
              {hydrationFallbackBars.map((bar) => (
                <View key={bar.label} style={styles.fallbackBarItem}>
                  <View style={[styles.fallbackBar, { height: bar.height, backgroundColor: 'rgba(34, 211, 238, 0.72)' }]} />
                  <Text selectable style={styles.fallbackBarLabel}>
                    {bar.label}
                  </Text>
                </View>
              ))}
            </View>
          )}
        </View>
      </View>

      {isPro ? (
        <View style={styles.card}>
          <Text selectable style={styles.cardTitle}>
            {t('progress.riskMix', { defaultValue: 'Risk Mix' })}
          </Text>

          <View style={styles.statChipsRow}>
            <View style={styles.statChip}>
              <Text selectable style={styles.statChipLabel}>
                {t('progress.safe', { defaultValue: 'Safe' })}
              </Text>
              <Text selectable numberOfLines={1} style={styles.statChipValue}>
                {formatPercent(riskMix?.safeCount ?? 0, riskMix?.totalMeals ?? 0)}
              </Text>
            </View>
            <View style={styles.statChip}>
              <Text selectable style={styles.statChipLabel}>
                {t('progress.caution', { defaultValue: 'Caution' })}
              </Text>
              <Text selectable numberOfLines={1} style={styles.statChipValue}>
                {formatPercent(riskMix?.cautionCount ?? 0, riskMix?.totalMeals ?? 0)}
              </Text>
            </View>
            <View style={styles.statChip}>
              <Text selectable style={styles.statChipLabel}>
                {t('progress.danger', { defaultValue: 'Danger' })}
              </Text>
              <Text selectable numberOfLines={1} style={styles.statChipValue}>
                {formatPercent(riskMix?.dangerCount ?? 0, riskMix?.totalMeals ?? 0)}
              </Text>
            </View>
          </View>
          <Text selectable style={styles.sampleHint}>
            {t('progress.loggedMeals', {
              defaultValue: `${riskMix?.totalMeals ?? 0} logged meal${riskMix?.totalMeals === 1 ? '' : 's'}`,
              count: riskMix?.totalMeals ?? 0,
            })}
            {(riskMix?.unknownCount ?? 0) > 0
              ? t('progress.unknownCount', {
                  defaultValue: ` (${riskMix?.unknownCount} unknown)`,
                  count: riskMix?.unknownCount ?? 0,
                })
              : ''}
          </Text>

          <View style={styles.chartContainer}>
            {riskMixQuery.isLoading ? (
              renderChartLoadingState()
            ) : (riskMix?.totalMeals ?? 0) === 0 ? (
              <View style={styles.emptyChartState}>
                <Text selectable style={styles.emptyChartText}>
                  {t('progress.noRiskData', { defaultValue: 'No risk data for this range.' })}
                </Text>
              </View>
            ) : process.env.EXPO_OS === 'ios' ? (
              <IOSHost style={styles.chartHost}>
                <Chart
                  style={styles.chart}
                  data={riskMix?.points ?? []}
                  type="bar"
                  showGrid
                  animate
                  showLegend={false}
                  barStyle={{
                    cornerRadius: 5,
                    width: 34,
                  }}
                />
              </IOSHost>
            ) : (
              <View style={styles.fallbackChart}>
                {riskMixFallbackBars.map((bar) => (
                  <View key={bar.label} style={styles.fallbackBarItem}>
                    <View style={[styles.fallbackBar, { height: bar.height, backgroundColor: bar.color }]} />
                    <Text selectable style={styles.fallbackBarLabel}>
                      {bar.label}
                    </Text>
                  </View>
                ))}
              </View>
            )}
          </View>
        </View>
      ) : (
        <View style={[styles.card, styles.lockedInsightCard]}>
          <View style={styles.lockedInsightHeader}>
            <Text selectable style={styles.cardTitle}>
              {t('progress.riskMix', { defaultValue: 'Risk Mix' })}
            </Text>
            <Text selectable style={styles.lockedInsightBadge}>
              PRO
            </Text>
          </View>
          <Text selectable style={styles.lockedInsightText}>
            {t('progress.unlockRiskMixInsight', {
              defaultValue: 'Unlock risk distribution trends over longer windows.',
            })}
          </Text>
          <Pressable style={styles.lockedInsightButton} onPress={handleOpenPaywall}>
            <Text selectable style={styles.lockedInsightButtonLabel}>
              {t('common.unlockPro', { defaultValue: 'Unlock Pro' })}
            </Text>
          </Pressable>
        </View>
      )}

      {isPro ? (
        <View style={styles.card}>
          <Text selectable style={styles.cardTitle}>
            {t('progress.topThreeFoods', { defaultValue: 'Top 3 Foods' })}
          </Text>
          <Text selectable style={styles.sampleHint}>
            {t('progress.loggedMeals', {
              defaultValue: `${topFoods?.totalMeals ?? 0} logged meal${topFoods?.totalMeals === 1 ? '' : 's'}`,
              count: topFoods?.totalMeals ?? 0,
            })}
          </Text>

          {topFoodsQuery.isLoading ? (
            renderTopFoodsLoadingState()
          ) : (topFoods?.items.length ?? 0) === 0 ? (
            <View style={styles.emptyChartState}>
              <Text selectable style={styles.emptyChartText}>
                {t('progress.noFoodLogs', { defaultValue: 'No food logs for this range.' })}
              </Text>
            </View>
          ) : (
            <View style={styles.topFoodsList}>
              {topFoods?.items.map((item, index) => (
                <Link key={item.key} href={`/(food)/all?food=${encodeURIComponent(item.foodName)}` as never} asChild>
                  <Pressable
                    onPress={hapticSelection}
                    style={index < topFoods.items.length - 1 ? styles.topFoodRowWithSeparator : styles.topFoodRow}
                  >
                    <View style={styles.topFoodRowMain}>
                      <Text selectable numberOfLines={1} style={styles.topFoodName}>
                        {item.foodName}
                      </Text>
                      <View style={styles.topFoodRowMainRight}>
                        <Text selectable style={styles.topFoodCount}>
                          {item.count}x
                        </Text>
                        <Ionicons name="chevron-forward" size={15} color="rgba(15, 23, 42, 0.32)" />
                      </View>
                    </View>
                    <Text selectable style={styles.topFoodMeta}>
                      {t('progress.topFoodMeta', {
                        defaultValue: `Avg ${Math.round(item.avgSodiumMg).toLocaleString()} mg / ${formatRiskLabel(item.dominantRisk, t('common.unknown', { defaultValue: 'Unknown' }))}`,
                        avg: Math.round(item.avgSodiumMg).toLocaleString(),
                        risk: formatRiskLabel(
                          item.dominantRisk,
                          t('common.unknown', { defaultValue: 'Unknown' })
                        ),
                      })}
                    </Text>
                  </Pressable>
                </Link>
              ))}
            </View>
          )}
        </View>
      ) : (
        <View style={[styles.card, styles.lockedInsightCard]}>
          <View style={styles.lockedInsightHeader}>
            <Text selectable style={styles.cardTitle}>
              {t('progress.topThreeFoods', { defaultValue: 'Top 3 Foods' })}
            </Text>
            <Text selectable style={styles.lockedInsightBadge}>
              PRO
            </Text>
          </View>
          <Text selectable style={styles.lockedInsightText}>
            {t('progress.unlockTopFoodsInsight', {
              defaultValue: 'See your top sodium contributors and drill into history.',
            })}
          </Text>
          <Pressable style={styles.lockedInsightButton} onPress={handleOpenPaywall}>
            <Text selectable style={styles.lockedInsightButtonLabel}>
              {t('common.unlockPro', { defaultValue: 'Unlock Pro' })}
            </Text>
          </Pressable>
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  contentContainer: {
    paddingHorizontal: 12,
    paddingTop: 10,
    paddingBottom: 14,
    gap: 8,
  },
  card: {
    borderRadius: 16,
    borderCurve: 'continuous',
    backgroundColor: 'white',
    paddingHorizontal: 12,
    paddingVertical: 10,
    gap: 6,
  },
  globalRangeRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 8,
  },
  globalRangeTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  globalRangeLabel: {
    fontSize: 13,
    fontWeight: '700',
    color: 'rgba(0, 0, 0, 0.72)',
    letterSpacing: 0.2,
  },
  globalRangeLimitLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: 'rgba(8, 145, 178, 1)',
    backgroundColor: 'rgba(34, 211, 238, 0.18)',
    borderRadius: 999,
    borderCurve: 'continuous',
    paddingHorizontal: 7,
    paddingVertical: 3,
    overflow: 'hidden',
  },
  lockedInsightCard: {
    gap: 10,
  },
  lockedInsightHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  lockedInsightBadge: {
    fontSize: 11,
    fontWeight: '700',
    color: 'rgba(8, 145, 178, 1)',
    backgroundColor: 'rgba(34, 211, 238, 0.18)',
    borderRadius: 999,
    borderCurve: 'continuous',
    paddingHorizontal: 8,
    paddingVertical: 4,
    overflow: 'hidden',
  },
  lockedInsightText: {
    fontSize: 14,
    fontWeight: '500',
    color: 'rgba(0, 0, 0, 0.62)',
    lineHeight: 20,
  },
  lockedInsightButton: {
    alignSelf: 'flex-start',
    borderRadius: 999,
    borderCurve: 'continuous',
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: 'rgba(34, 211, 238, 1)',
  },
  lockedInsightButtonLabel: {
    fontSize: 13,
    fontWeight: '700',
    color: 'white',
  },
  kpiStrip: {
    flexDirection: 'row',
    alignItems: 'stretch',
    gap: 6,
  },
  kpiCell: {
    flex: 1,
    flexBasis: 0,
    minWidth: 0,
  },
  kpiItem: {
    gap: 3,
    borderRadius: 12,
    borderCurve: 'continuous',
    backgroundColor: 'white',
    paddingHorizontal: 7,
    paddingVertical: 10,
    minWidth: 0,
    width: '100%',
  },
  kpiHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    minWidth: 0,
  },
  kpiIconWrap: {
    width: 20,
    height: 20,
    borderRadius: 999,
    borderCurve: 'continuous',
    alignItems: 'center',
    justifyContent: 'center',
  },
  kpiIconWrapBloat: {
    backgroundColor: 'rgba(34, 211, 238, 0.2)',
  },
  kpiIconWrapSodium: {
    backgroundColor: 'rgba(251, 146, 60, 0.2)',
  },
  kpiIconWrapHydration: {
    backgroundColor: 'rgba(96, 165, 250, 0.2)',
  },
  kpiLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: 'rgba(0, 0, 0, 0.5)',
    flex: 1,
    minWidth: 0,
    letterSpacing: 0.3,
  },
  kpiValue: {
    fontSize: 17,
    fontWeight: '700',
    color: 'rgba(0, 0, 0, 0.86)',
    fontVariant: ['tabular-nums'],
    minWidth: 0,
    flexShrink: 1,
  },
  cardTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: 'rgba(0, 0, 0, 0.9)',
    letterSpacing: 0.35,
  },
  rangePickerHost: {
    minWidth: 140,
  },
  rangeFallbackRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  rangeFallbackChip: {
    borderRadius: 999,
    borderCurve: 'continuous',
    paddingHorizontal: 8,
    paddingVertical: 4,
    backgroundColor: 'rgba(15, 23, 42, 0.08)',
  },
  rangeFallbackChipActive: {
    backgroundColor: 'rgba(34, 211, 238, 0.2)',
  },
  rangeFallbackChipText: {
    fontSize: 13,
    fontWeight: '600',
    color: 'rgba(15, 23, 42, 0.58)',
  },
  rangeFallbackChipTextActive: {
    color: 'rgba(2, 132, 199, 1)',
  },
  metricValueRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 6,
  },
  metricRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
  },
  metricValue: {
    fontSize: 34,
    fontWeight: '800',
    color: 'rgba(0, 0, 0, 0.92)',
    fontVariant: ['tabular-nums'],
  },
  metricSuffix: {
    fontSize: 15,
    fontWeight: '600',
    color: 'rgba(0, 0, 0, 0.5)',
  },
  metricMetaStack: {
    flex: 1,
    alignItems: 'flex-end',
    gap: 2,
  },
  deltaText: {
    fontSize: 15,
    fontWeight: '600',
    textAlign: 'right',
  },
  deltaPositive: {
    color: 'rgba(220, 38, 38, 0.9)',
  },
  deltaNegative: {
    color: 'rgba(22, 163, 74, 0.9)',
  },
  sampleHint: {
    fontSize: 11,
    fontWeight: '500',
    color: 'rgba(0, 0, 0, 0.45)',
  },
  statChipsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  statChip: {
    flex: 1,
    minWidth: 0,
    borderRadius: 10,
    borderCurve: 'continuous',
    backgroundColor: 'rgba(15, 23, 42, 0.04)',
    paddingHorizontal: 8,
    paddingVertical: 6,
    gap: 2,
  },
  statChipLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: 'rgba(0, 0, 0, 0.48)',
  },
  statChipValue: {
    fontSize: 15,
    fontWeight: '700',
    color: 'rgba(0, 0, 0, 0.74)',
    fontVariant: ['tabular-nums'],
  },
  chartContainer: {
    height: 172,
    borderRadius: 12,
    borderCurve: 'continuous',
    backgroundColor: 'rgba(15, 23, 42, 0.04)',
    padding: 8,
  },
  chartHost: {
    flex: 1,
  },
  chart: {
    flex: 1,
  },
  chartLoadingShimmer: {
    width: '100%',
    height: '100%',
    borderRadius: 10,
    borderCurve: 'continuous',
    overflow: 'hidden',
  },
  loadingShimmerTrack: {
    flex: 1,
    flexDirection: 'row',
  },
  loadingShimmerEdge: {
    flex: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
  },
  loadingShimmerCenter: {
    flex: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.26)',
  },
  chartLoadingBody: {
    ...StyleSheet.absoluteFillObject,
    paddingHorizontal: 8,
    paddingVertical: 8,
    gap: 10,
  },
  chartLoadingLine: {
    width: '34%',
    height: 10,
    borderRadius: 999,
    borderCurve: 'continuous',
    backgroundColor: 'rgba(15, 23, 42, 0.14)',
  },
  chartLoadingBars: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 6,
  },
  chartLoadingBar: {
    flex: 1,
    borderRadius: 8,
    borderCurve: 'continuous',
    backgroundColor: 'rgba(15, 23, 42, 0.16)',
    minHeight: 14,
  },
  chartLoadingBarXs: {
    height: 22,
  },
  chartLoadingBarSm: {
    height: 34,
  },
  chartLoadingBarMd: {
    height: 54,
  },
  chartLoadingBarLg: {
    height: 76,
  },
  emptyChartState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 12,
  },
  emptyChartText: {
    fontSize: 14,
    fontWeight: '500',
    textAlign: 'center',
    color: 'rgba(0, 0, 0, 0.48)',
  },
  fallbackChart: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    gap: 8,
    paddingHorizontal: 4,
  },
  fallbackBarItem: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: 4,
  },
  fallbackBar: {
    width: '80%',
    borderRadius: 8,
    borderCurve: 'continuous',
    backgroundColor: 'rgba(34, 211, 238, 0.72)',
    minHeight: 4,
  },
  fallbackBarLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: 'rgba(0, 0, 0, 0.5)',
  },
  topFoodsList: {
    borderRadius: 10,
    borderCurve: 'continuous',
    backgroundColor: 'rgba(15, 23, 42, 0.04)',
    overflow: 'hidden',
  },
  topFoodsLoadingState: {
    borderRadius: 10,
    borderCurve: 'continuous',
    backgroundColor: 'rgba(15, 23, 42, 0.04)',
    overflow: 'hidden',
  },
  topFoodsLoadingShimmer: {
    width: '100%',
    minHeight: 112,
    overflow: 'hidden',
  },
  topFoodsLoadingBody: {
    ...StyleSheet.absoluteFillObject,
    paddingHorizontal: 10,
    paddingVertical: 8,
    gap: 6,
  },
  topFoodsLoadingRow: {
    gap: 5,
  },
  topFoodsLoadingTitle: {
    width: '58%',
    height: 12,
    borderRadius: 999,
    borderCurve: 'continuous',
    backgroundColor: 'rgba(15, 23, 42, 0.14)',
  },
  topFoodsLoadingTitleAlt: {
    width: '52%',
  },
  topFoodsLoadingTitleLast: {
    width: '47%',
  },
  topFoodsLoadingBadge: {
    width: '14%',
    height: 10,
    borderRadius: 999,
    borderCurve: 'continuous',
    backgroundColor: 'rgba(15, 23, 42, 0.11)',
  },
  topFoodsLoadingMeta: {
    width: '74%',
    height: 10,
    borderRadius: 999,
    borderCurve: 'continuous',
    backgroundColor: 'rgba(15, 23, 42, 0.1)',
  },
  topFoodsLoadingMetaAlt: {
    width: '68%',
  },
  topFoodsLoadingMetaLast: {
    width: '62%',
  },
  topFoodsLoadingDivider: {
    height: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.08)',
  },
  topFoodRow: {
    paddingHorizontal: 10,
    paddingVertical: 8,
    gap: 2,
  },
  topFoodRowWithSeparator: {
    paddingHorizontal: 10,
    paddingVertical: 8,
    gap: 2,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(15, 23, 42, 0.07)',
  },
  topFoodRowMain: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  topFoodRowMainRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    flexShrink: 0,
  },
  topFoodName: {
    flex: 1,
    fontSize: 15,
    fontWeight: '600',
    color: 'rgba(0, 0, 0, 0.82)',
  },
  topFoodCount: {
    fontSize: 13,
    fontWeight: '700',
    color: 'rgba(0, 0, 0, 0.55)',
    fontVariant: ['tabular-nums'],
  },
  topFoodMeta: {
    fontSize: 12,
    fontWeight: '500',
    color: 'rgba(0, 0, 0, 0.58)',
    fontVariant: ['tabular-nums'],
  },
});
