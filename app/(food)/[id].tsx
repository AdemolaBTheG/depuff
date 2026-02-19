import { foodLogs } from '@/db/schema';
import { useDbStore } from '@/stores/dbStore';
import { eq } from 'drizzle-orm';
import { useQuery } from '@tanstack/react-query';
import { Image } from 'expo-image';
import { Stack, useLocalSearchParams } from 'expo-router';
import React, { useMemo } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
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
      contentContainerStyle={{
        paddingHorizontal: 16,
        paddingTop: 12,
        paddingBottom: insets.bottom + 24,
        gap: 12,
      }}
    >
      <Stack.Screen options={{ title: foodLog?.foodName ?? 'Food Log', headerShadowVisible: false }} />

      {foodId === null ? (
        <View style={styles.card}>
          <Text selectable style={styles.title}>
            Invalid food log
          </Text>
          <Text selectable style={styles.secondary}>
            This entry could not be opened.
          </Text>
        </View>
      ) : foodLogQuery.isLoading ? (
        <View style={styles.card}>
          <Text selectable style={styles.secondary}>
            Loading food details...
          </Text>
        </View>
      ) : !foodLog ? (
        <View style={styles.card}>
          <Text selectable style={styles.title}>
            Food log not found
          </Text>
          <Text selectable style={styles.secondary}>
            This entry may have been removed.
          </Text>
        </View>
      ) : (
        <>
          {foodLog.localImageUri ? (
            <View style={styles.imageCard}>
              <Image source={foodLog.localImageUri} style={styles.image} contentFit="cover" transition={180} />
            </View>
          ) : null}

          <View style={styles.card}>
            <Text selectable style={styles.label}>
              Food
            </Text>
            <Text selectable style={styles.value}>
              {foodLog.foodName}
            </Text>
          </View>

          <View style={styles.metaGrid}>
            <View style={styles.card}>
              <Text selectable style={styles.label}>
                Sodium
              </Text>
              <Text selectable style={styles.value}>
                {foodLog.sodiumEstimateMg.toLocaleString()} mg
              </Text>
            </View>
            <View style={styles.card}>
              <Text selectable style={styles.label}>
                Risk
              </Text>
              <Text selectable style={styles.value}>
                {formatRiskLabel(foodLog.bloatRiskLevel)}
              </Text>
            </View>
          </View>

          <View style={styles.card}>
            <Text selectable style={styles.label}>
              Logged
            </Text>
            <Text selectable style={styles.secondary}>
              {formatLoggedAt(foodLog.createdAt)}
            </Text>
          </View>

          {foodLog.aiReasoning ? (
            <View style={styles.card}>
              <Text selectable style={styles.label}>
                Insight
              </Text>
              <Text selectable style={styles.secondary}>
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
  imageCard: {
    borderRadius: 18,
    borderCurve: 'continuous',
    overflow: 'hidden',
    backgroundColor: 'rgba(15, 23, 42, 0.06)',
  },
  image: {
    width: '100%',
    aspectRatio: 1.12,
  },
  metaGrid: {
    flexDirection: 'row',
    gap: 10,
  },
  card: {
    flex: 1,
    borderRadius: 16,
    borderCurve: 'continuous',
    backgroundColor: 'white',
    paddingHorizontal: 12,
    paddingVertical: 12,
    gap: 4,
  },
  title: {
    fontSize: 17,
    fontWeight: '700',
    color: 'rgba(15, 23, 42, 0.92)',
  },
  label: {
    fontSize: 12,
    fontWeight: '600',
    color: 'rgba(15, 23, 42, 0.5)',
  },
  value: {
    fontSize: 17,
    fontWeight: '700',
    color: 'rgba(15, 23, 42, 0.9)',
    fontVariant: ['tabular-nums'],
  },
  secondary: {
    fontSize: 14,
    fontWeight: '500',
    color: 'rgba(15, 23, 42, 0.62)',
    lineHeight: 20,
  },
});
