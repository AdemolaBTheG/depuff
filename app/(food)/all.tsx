import { foodLogs } from '@/db/schema';
import { useDbStore } from '@/stores/dbStore';
import { hapticSelection } from '@/utils/haptics';
import { desc } from 'drizzle-orm';
import { useQuery } from '@tanstack/react-query';
import { Image } from 'expo-image';
import { Link, Stack, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { PressableScale } from 'pressto';
import React, { useMemo } from 'react';
import { FlatList, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

type FoodLogListItem = {
  id: number;
  foodName: string;
  sodiumEstimateMg: number;
  bloatRiskLevel: string | null;
  aiReasoning: string | null;
  localImageUri: string | null;
  createdAt: string | null;
  logDate: string;
};

function formatRiskLabel(value: string | null): string {
  if (!value) return 'Unknown';
  return value
    .replace(/[_-]/g, ' ')
    .toLowerCase()
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function formatLoggedAt(createdAt: string | null, logDate: string): string {
  if (!createdAt) return logDate;
  const normalized = createdAt.includes('T') ? createdAt : createdAt.replace(' ', 'T');
  const parsed = new Date(normalized);
  if (Number.isNaN(parsed.getTime())) return logDate;
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  }).format(parsed);
}

function normalizeFoodFilter(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, ' ');
}

export default function AllFoodLogsScreen() {
  const insets = useSafeAreaInsets();
  const db = useDbStore((state) => state.db);
  const { food } = useLocalSearchParams<{ food?: string | string[] }>();
  const filteredFoodName = useMemo(() => {
    const raw = Array.isArray(food) ? food[0] : food;
    const trimmed = raw?.trim();
    return trimmed ? trimmed : null;
  }, [food]);
  const normalizedFoodFilter = useMemo(
    () => (filteredFoodName ? normalizeFoodFilter(filteredFoodName) : null),
    [filteredFoodName]
  );

  const allFoodLogsQuery = useQuery({
    enabled: Boolean(db),
    queryKey: ['food-logs-all', normalizedFoodFilter],
    queryFn: async (): Promise<FoodLogListItem[]> => {
      if (!db) return [];
      const rows = await db
        .select({
          id: foodLogs.id,
          foodName: foodLogs.foodName,
          sodiumEstimateMg: foodLogs.sodiumEstimateMg,
          bloatRiskLevel: foodLogs.bloatRiskLevel,
          aiReasoning: foodLogs.aiReasoning,
          localImageUri: foodLogs.localImageUri,
          createdAt: foodLogs.createdAt,
          logDate: foodLogs.logDate,
        })
        .from(foodLogs)
        .orderBy(desc(foodLogs.createdAt), desc(foodLogs.id));

      const mappedRows = rows.map((row) => ({
        id: row.id,
        foodName: row.foodName ?? 'Unnamed food',
        sodiumEstimateMg: row.sodiumEstimateMg ?? 0,
        bloatRiskLevel: row.bloatRiskLevel ?? null,
        aiReasoning: row.aiReasoning ?? null,
        localImageUri: row.localImageUri ?? null,
        createdAt: row.createdAt ?? null,
        logDate: row.logDate,
      }));

      if (!normalizedFoodFilter) {
        return mappedRows;
      }

      return mappedRows.filter((row) => normalizeFoodFilter(row.foodName) === normalizedFoodFilter);
    },
  });

  const logs = allFoodLogsQuery.data ?? [];
  const totalLogs = logs.length;

  return (
    <>
      <Stack.Screen options={{ title: filteredFoodName ?? 'All Logged Foods', headerShadowVisible: false }} />
      <FlatList
        data={logs}
        keyExtractor={(item) => String(item.id)}
        renderItem={({ item }) => (
          <Link href={`../${item.id}` as never} asChild>
            <PressableScale onPress={hapticSelection} style={styles.row}>
              <View style={styles.mainRow}>
                {item.localImageUri ? (
                  <Image source={item.localImageUri} style={styles.thumb} contentFit="cover" transition={140} />
                ) : (
                  <View style={styles.thumbFallback} />
                )}
                <View style={styles.content}>
                  <View style={styles.header}>
                    <Text selectable numberOfLines={1} style={styles.foodName}>
                      {item.foodName}
                    </Text>
                    <View style={styles.headerRight}>
                      <Text selectable style={styles.timeText}>
                        {formatLoggedAt(item.createdAt, item.logDate)}
                      </Text>
                      <Ionicons name="chevron-forward" size={17} color="rgba(15, 23, 42, 0.32)" />
                    </View>
                  </View>
                  <View style={styles.metaRow}>
                    <Text selectable style={styles.metaPill}>
                      {item.sodiumEstimateMg.toLocaleString()} mg
                    </Text>
                    <Text selectable style={styles.riskText}>
                      {formatRiskLabel(item.bloatRiskLevel)}
                    </Text>
                  </View>
                </View>
              </View>
              {item.aiReasoning ? (
                <Text selectable numberOfLines={2} style={styles.reasonText}>
                  {item.aiReasoning}
                </Text>
              ) : null}
            </PressableScale>
          </Link>
        )}
        ItemSeparatorComponent={() => <View style={styles.rowSeparator} />}
        ListHeaderComponent={
          <View style={styles.summaryHeader}>
            {filteredFoodName ? (
              <Text selectable style={styles.summaryFilterText}>
                Filter: {filteredFoodName}
              </Text>
            ) : null}
            <Text selectable style={styles.summaryText}>
              {totalLogs} logged item{totalLogs === 1 ? '' : 's'}
            </Text>
          </View>
        }
        ListEmptyComponent={
          <View style={styles.emptyCard}>
            <Text selectable style={styles.emptyTitle}>
              {filteredFoodName ? `No logs for ${filteredFoodName}` : 'No food logs yet'}
            </Text>
            <Text selectable style={styles.emptyText}>
              {filteredFoodName
                ? 'Try another food from Top Foods or clear the filter from Progress.'
                : 'Capture your first meal to start tracking sodium and bloat risk.'}
            </Text>
          </View>
        }
        contentInsetAdjustmentBehavior="automatic"
        contentContainerStyle={{
          paddingHorizontal: 16,
          paddingTop: 12,
          paddingBottom: insets.bottom + 24,
          flexGrow: 1,
        }}
      />
    </>
  );
}

const styles = StyleSheet.create({
  summaryHeader: {
    gap: 3,
    marginBottom: 12,
  },
  summaryFilterText: {
    fontSize: 12,
    fontWeight: '600',
    color: 'rgba(15, 23, 42, 0.48)',
  },
  summaryText: {
    fontSize: 13,
    fontWeight: '600',
    color: 'rgba(15, 23, 42, 0.6)',
    fontVariant: ['tabular-nums'],
  },
  emptyCard: {
    borderRadius: 14,
    borderCurve: 'continuous',
    backgroundColor: 'white',
    paddingHorizontal: 12,
    paddingVertical: 12,
    gap: 6,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: 'rgba(15, 23, 42, 0.88)',
  },
  emptyText: {
    fontSize: 13,
    fontWeight: '500',
    color: 'rgba(15, 23, 42, 0.58)',
    lineHeight: 18,
  },
  row: {
    borderRadius: 14,
    borderCurve: 'continuous',
    backgroundColor: 'white',
    paddingHorizontal: 12,
    paddingVertical: 12,
    gap: 6,
  },
  rowSeparator: {
    height: 8,
  },
  mainRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
  },
  thumb: {
    width: 48,
    height: 48,
    borderRadius: 10,
    borderCurve: 'continuous',
    backgroundColor: 'rgba(15, 23, 42, 0.08)',
  },
  thumbFallback: {
    width: 48,
    height: 48,
    borderRadius: 10,
    borderCurve: 'continuous',
    backgroundColor: 'rgba(15, 23, 42, 0.08)',
  },
  content: {
    flex: 1,
    gap: 5,
    minWidth: 0,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    flexShrink: 0,
  },
  foodName: {
    flex: 1,
    minWidth: 0,
    flexShrink: 1,
    fontSize: 14,
    fontWeight: '600',
    color: 'rgba(15, 23, 42, 0.78)',
  },
  timeText: {
    fontSize: 11,
    fontWeight: '600',
    color: 'rgba(15, 23, 42, 0.48)',
    fontVariant: ['tabular-nums'],
    minWidth: 86,
    textAlign: 'right',
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  metaPill: {
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
  riskText: {
    fontSize: 11,
    fontWeight: '700',
    color: 'rgba(15, 23, 42, 0.54)',
    letterSpacing: 0.2,
  },
  reasonText: {
    fontSize: 12,
    fontWeight: '500',
    color: 'rgba(15, 23, 42, 0.56)',
    lineHeight: 18,
  },
});
