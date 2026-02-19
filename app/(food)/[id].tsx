import { foodLogs } from '@/db/schema';
import { useDbStore } from '@/stores/dbStore';
import { useQuery } from '@tanstack/react-query';
import { eq } from 'drizzle-orm';
import { Image } from 'expo-image';
import { Stack, useLocalSearchParams } from 'expo-router';
import React, { useMemo } from 'react';
import { PlatformColor, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

type FoodLogDetail = {
  id: number;
  foodName: string;
  sodiumEstimateMg: number;
  bloatRiskLevel: string | null;
  aiReasoning: string | null;
  localImageUri: string | null;
  createdAt: string | null;
};

function formatRiskLabel(value: string | null): string {
  if (!value) return 'Unknown';
  return value
    .replace(/[_-]/g, ' ')
    .toLowerCase()
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function formatLoggedAt(value: string | null): string {
  if (!value) return 'Unknown time';
  const normalized = value.includes('T') ? value : value.replace(' ', 'T');
  const parsed = new Date(normalized);
  if (Number.isNaN(parsed.getTime())) return 'Unknown time';
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  }).format(parsed);
}

export default function FoodLogDetailScreen() {
  const { id } = useLocalSearchParams<{ id?: string | string[] }>();
  const insets = useSafeAreaInsets();
  const db = useDbStore((state) => state.db);

  const foodId = useMemo(() => {
    const raw = Array.isArray(id) ? id[0] : id;
    const parsed = Number(raw);
    return Number.isFinite(parsed) ? parsed : null;
  }, [id]);

  const foodLogQuery = useQuery({
    enabled: Boolean(db) && foodId !== null,
    queryKey: ['food-log', foodId],
    queryFn: async (): Promise<FoodLogDetail | null> => {
      if (!db || foodId === null) return null;
      const [row] = await db
        .select({
          id: foodLogs.id,
          foodName: foodLogs.foodName,
          sodiumEstimateMg: foodLogs.sodiumEstimateMg,
          bloatRiskLevel: foodLogs.bloatRiskLevel,
          aiReasoning: foodLogs.aiReasoning,
          localImageUri: foodLogs.localImageUri,
          createdAt: foodLogs.createdAt,
        })
        .from(foodLogs)
        .where(eq(foodLogs.id, foodId))
        .limit(1);

      if (!row) return null;
      return {
        id: row.id,
        foodName: row.foodName ?? 'Unnamed food',
        sodiumEstimateMg: row.sodiumEstimateMg ?? 0,
        bloatRiskLevel: row.bloatRiskLevel ?? null,
        aiReasoning: row.aiReasoning ?? null,
        localImageUri: row.localImageUri ?? null,
        createdAt: row.createdAt ?? null,
      };
    },
  });

  const foodLog = foodLogQuery.data;

  return (
    <ScrollView
      contentInsetAdjustmentBehavior="automatic"
      style={styles.container}
      contentContainerStyle={styles.contentContainer}
    >
      <Stack.Screen 
        options={{ 
          title: foodLog?.foodName ?? 'Entry Details', 
          headerTransparent: true,
          headerShadowVisible: false,
        }} 
      />

      {foodId === null ? (
        <View style={styles.emptyStateCard}>
          <Text selectable style={styles.emptyStateTitle}>
            Invalid Record
          </Text>
          <Text selectable style={styles.emptyStateSecondary}>
            This dietary entry could not be retrieved.
          </Text>
        </View>
      ) : foodLogQuery.isLoading ? (
        <View style={styles.emptyStateCard}>
          <Text selectable style={styles.emptyStateSecondary}>
            Loading entry details...
          </Text>
        </View>
      ) : !foodLog ? (
        <View style={styles.emptyStateCard}>
          <Text selectable style={styles.emptyStateTitle}>
            Record Unavailable
          </Text>
          <Text selectable style={styles.emptyStateSecondary}>
            This entry may have been deleted or moved.
          </Text>
        </View>
      ) : (
        <>
          {foodLog.localImageUri ? (
            <View style={styles.imageCard}>
              <Image 
                source={foodLog.localImageUri} 
                style={styles.image} 
                contentFit="cover" 
                transition={200} 
              />
            </View>
          ) : null}

          <View style={styles.detailGroup}>
          
            <View style={styles.detailRow}>
              <Text selectable style={styles.label}>
                LOGGED
              </Text>
              <Text selectable style={styles.secondaryValue}>
                {formatLoggedAt(foodLog.createdAt)}
              </Text>
            </View>
          </View>

          <View style={styles.metaGrid}>
            <View style={styles.metricCard}>
              <Text selectable style={styles.label}>
                SODIUM ESTIMATE
              </Text>
              <Text selectable style={styles.metricValue}>
                {foodLog.sodiumEstimateMg.toLocaleString()} <Text style={styles.metricUnit}>mg</Text>
              </Text>
            </View>
            <View style={styles.metricCard}>
              <Text selectable style={styles.label}>
                BLOAT RISK
              </Text>
              <Text selectable style={styles.metricValue}>
                {formatRiskLabel(foodLog.bloatRiskLevel)}
              </Text>
            </View>
          </View>

          {foodLog.aiReasoning ? (
            <View style={styles.insightCard}>
              <Text selectable style={styles.label}>
                ANALYSIS
              </Text>
              <Text selectable style={styles.insightText}>
                {foodLog.aiReasoning}
              </Text>
            </View>
          ) : null}
        </>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: PlatformColor('systemGroupedBackground'),
  },
  contentContainer: {
    paddingHorizontal: 16,
    paddingTop: 16,
    gap: 16,
  },
  imageCard: {
    borderRadius: 20,
    borderCurve: 'continuous',
    backgroundColor: PlatformColor('secondarySystemGroupedBackground'),
    overflow: 'hidden',
  },
  image: {
    width: '100%',
    aspectRatio: 1, // 1:1 perfect square creates a more editorial, curated look
  },
  detailGroup: {
    backgroundColor: PlatformColor('secondarySystemGroupedBackground'),
    borderRadius: 20,
    borderCurve: 'continuous',
    overflow: 'hidden',
  },
  detailRow: {
    paddingHorizontal: 20,
    paddingVertical: 16,
    gap: 4,
  },
  separator: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: PlatformColor('separator'),
    marginLeft: 20, // Align divider to text, standard iOS behavior
  },
  metaGrid: {
    flexDirection: 'row',
    gap: 16,
  },
  metricCard: {
    flex: 1,
    backgroundColor: PlatformColor('secondarySystemGroupedBackground'),
    borderRadius: 20,
    borderCurve: 'continuous',
    paddingHorizontal: 20,
    paddingVertical: 18,
    gap: 8,
  },
  insightCard: {
    backgroundColor: PlatformColor('secondarySystemGroupedBackground'),
    borderRadius: 20,
    borderCurve: 'continuous',
    paddingHorizontal: 20,
    paddingVertical: 20,
    gap: 10,
  },
  label: {
    fontSize: 12,
    fontWeight: '600',
    color: PlatformColor('tertiaryLabel'),
    letterSpacing: 0.8,
  },
  primaryValue: {
    fontSize: 18,
    fontWeight: '600',
    color: PlatformColor('label'),
    letterSpacing: -0.4,
  },
  secondaryValue: {
    fontSize: 15,
    fontWeight: '500',
    color: PlatformColor('label'),
  },
  metricValue: {
    fontSize: 22,
    fontWeight: '700',
    color: PlatformColor('label'),
    letterSpacing: -0.6,
  },
  metricUnit: {
    fontSize: 15,
    fontWeight: '500',
    color: PlatformColor('secondaryLabel'),
    letterSpacing: 0,
  },
  insightText: {
    fontSize: 16,
    fontWeight: '400',
    color: PlatformColor('label'),
    lineHeight: 24, // High readability line-height for analysis text
  },
  emptyStateCard: {
    backgroundColor: PlatformColor('secondarySystemGroupedBackground'),
    borderRadius: 20,
    borderCurve: 'continuous',
    padding: 32,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  emptyStateTitle: {
    fontSize: 17,
    fontWeight: '600',
    color: PlatformColor('label'),
    letterSpacing: -0.3,
  },
  emptyStateSecondary: {
    fontSize: 15,
    fontWeight: '400',
    color: PlatformColor('secondaryLabel'),
    textAlign: 'center',
  },
});