import { foodLogs } from '@/db/schema';
import { useDbStore } from '@/stores/dbStore';
import { hapticSelection } from '@/utils/haptics';
import { Ionicons } from '@expo/vector-icons';
import { useQuery } from '@tanstack/react-query';
import { desc } from 'drizzle-orm';
import { Image } from 'expo-image';
import { Link, Stack, useLocalSearchParams } from 'expo-router';
import { PressableScale } from 'pressto';
import React, { useMemo, useState } from 'react';
import { FlatList, PlatformColor, StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
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

function formatRiskLabel(value: string | null, unknownLabel: string): string {
  if (!value) return unknownLabel;
  return value
    .replace(/[_-]/g, ' ')
    .toLowerCase()
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function formatLoggedAt(createdAt: string | null, logDate: string, locale: string): string {
  if (!createdAt) return logDate;
  const normalized = createdAt.includes('T') ? createdAt : createdAt.replace(' ', 'T');
  const parsed = new Date(normalized);
  if (Number.isNaN(parsed.getTime())) return logDate;
  return new Intl.DateTimeFormat(locale, {
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
  const { t, i18n } = useTranslation();
  const db = useDbStore((state) => state.db);
  const { food } = useLocalSearchParams<{ food?: string | string[] }>();
  const [searchQuery, setSearchQuery] = useState('');

  const filteredFoodName = useMemo(() => {
    const raw = Array.isArray(food) ? food[0] : food;
    const trimmed = raw?.trim();
    return trimmed ? trimmed : null;
  }, [food]);

  const normalizedFoodFilter = useMemo(() => {
    // Both header search string AND deep link route props are joined as filter criteria
    const activeFilter = searchQuery || filteredFoodName;
    return activeFilter ? normalizeFoodFilter(activeFilter) : null;
  }, [filteredFoodName, searchQuery]);

  const allFoodLogsQuery = useQuery({
    enabled: Boolean(db),
    queryKey: ['food-logs-all', normalizedFoodFilter, i18n.language],
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
        foodName: row.foodName ?? t('food.unnamedFood', { defaultValue: 'Unnamed food' }),
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

  return (
    <>
      <Stack.Screen 
        options={{ 
          title: filteredFoodName ?? t('food.allLoggedFoods', { defaultValue: 'All Logged Foods' }), 
          headerShadowVisible: false,
          headerSearchBarOptions: {
            placeholder: t('food.searchPlaceholder', { defaultValue: 'Search logged foods' }),
            hideWhenScrolling: false,
            onChangeText: (e) => setSearchQuery(e.nativeEvent.text),
            onCancelButtonPress: () => setSearchQuery(''),
          }
        }} 
      />
        <FlatList
        data={logs}
        keyExtractor={(item) => String(item.id)}
        renderItem={({ item, index }) => (
          <React.Fragment key={item.id}>
            {index > 0 && <View style={styles.rowSeparator} />}
            <Link href={`../${item.id}` as never} asChild>
              <PressableScale 
                onPress={hapticSelection} 
                style={StyleSheet.flatten([
                  styles.listItem,
                  index === 0 && styles.listFirstItem,
                  index === logs.length - 1 && styles.listLastItem
                ])}
              >
                <View style={styles.row}>
                  <View style={styles.mainRow}>
                    {item.localImageUri ? (
                      <Image source={item.localImageUri} style={styles.thumb} contentFit="cover" transition={140} />
                    ) : (
                      <View style={styles.thumbFallback}>
                        <Ionicons name="image-outline" size={18} color="rgba(15, 23, 42, 0.36)" />
                      </View>
                    )}
                    <View style={styles.content}>
                      <View style={styles.header}>
                        <Text selectable numberOfLines={1} style={styles.foodName}>
                          {item.foodName}
                        </Text>
                        <View style={styles.headerRight}>
                          <Text selectable style={styles.timeText}>
                            {formatLoggedAt(item.createdAt, item.logDate, i18n.language)}
                          </Text>
                          <Ionicons name="chevron-forward" size={17} color={PlatformColor('tertiaryLabel')} />
                        </View>
                      </View>
                      <View style={styles.metaRow}>
                        <Text selectable style={styles.metaPill}>
                          {item.sodiumEstimateMg.toLocaleString()} mg
                        </Text>
                        <Text selectable style={styles.riskText}>
                          {formatRiskLabel(
                            item.bloatRiskLevel,
                            t('common.unknown', { defaultValue: 'Unknown' })
                          )}
                        </Text>
                      </View>
                    </View>
                  </View>
                  {item.aiReasoning ? (
                    <Text selectable numberOfLines={2} style={styles.reasonText}>
                      {item.aiReasoning}
                    </Text>
                  ) : null}
                </View>
              </PressableScale>
            </Link>
          </React.Fragment>
        )}
        ItemSeparatorComponent={null}
      
        ListEmptyComponent={
          <View style={styles.emptyCard}>
            <Text selectable style={styles.emptyTitle}>
              {normalizedFoodFilter
                ? t('food.noLogsFoundFor', {
                    defaultValue: `No logs found for "${searchQuery || filteredFoodName}"`,
                    value: searchQuery || filteredFoodName,
                  })
                : t('food.noLogsYet', { defaultValue: 'No food logs yet' })}
            </Text>
            <Text selectable style={styles.emptyText}>
              {normalizedFoodFilter
                ? t('food.tryAnotherSearch', {
                    defaultValue: 'Try searching for another food or clearing the filter.',
                  })
                : t('food.captureFirstMeal', {
                    defaultValue: 'Capture your first meal to start tracking sodium and bloat risk.',
                  })}
            </Text>
          </View>
        }
        contentInsetAdjustmentBehavior="automatic"
        style={styles.listContainer}
        contentContainerStyle={{
          paddingBottom: insets.bottom + 24,
        }}
      />
    </>
  );
}

const styles = StyleSheet.create({

  listContainer: {
    paddingHorizontal: 16,
    paddingTop: 16,
  },
  summaryHeader: {
    gap: 3,
    marginBottom: 12,
    paddingLeft: 4,
  },
  summaryFilterText: {
    fontSize: 12,
    fontWeight: '600',
    color: PlatformColor('secondaryLabel'),
  },
  summaryText: {
    fontSize: 16,
    fontWeight: '700',
    color: PlatformColor('label'),
    fontVariant: ['tabular-nums'],
  },
  emptyCard: {
    borderRadius: 20,
    borderCurve: 'continuous',
    backgroundColor: PlatformColor('secondarySystemGroupedBackground'),
    paddingHorizontal: 16,
    paddingVertical: 16,
    gap: 12,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: PlatformColor('label'),
  },
  emptyText: {
    fontSize: 14,
    fontWeight: '500',
    color: PlatformColor('secondaryLabel'),
    lineHeight: 18,
  },
  listItem: {
    backgroundColor: PlatformColor('secondarySystemGroupedBackground'),
  },
  listFirstItem: {
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    borderCurve: 'continuous',
    overflow: 'hidden',
  },
  listLastItem: {
    borderBottomLeftRadius: 20,
    borderBottomRightRadius: 20,
    borderCurve: 'continuous',
    overflow: 'hidden',
  },
  row: {
    paddingHorizontal: 16,
    paddingVertical: 14,
    gap: 8,
  },
  listBackground: {
    borderRadius: 20,
    borderCurve: 'continuous',
    backgroundColor: PlatformColor('secondarySystemGroupedBackground'),
    overflow: 'hidden',
  },
  rowSeparator: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: PlatformColor('separator'),
    marginLeft: 74,
  },
  mainRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
  },
  thumb: {
    width: 48,
    height: 48,
    borderRadius: 12,
    borderCurve: 'continuous',
    backgroundColor: 'rgba(15, 23, 42, 0.08)',
  },
  thumbFallback: {
    width: 48,
    height: 48,
    borderRadius: 12,
    borderCurve: 'continuous',
    backgroundColor: 'rgba(15, 23, 42, 0.08)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  content: {
    flex: 1,
    gap: 6,
    minWidth: 0,
    justifyContent: 'center',
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
    gap: 6,
    flexShrink: 0,
  },
  foodName: {
    flex: 1,
    minWidth: 0,
    flexShrink: 1,
    fontSize: 16,
    fontWeight: '600',
    color: PlatformColor('label'),
  },
  timeText: {
    fontSize: 13,
    fontWeight: '500',
    color: PlatformColor('secondaryLabel'),
    fontVariant: ['tabular-nums'],
    minWidth: 62,
    textAlign: 'right',
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  metaPill: {
    fontSize: 12,
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
  riskText: {
    fontSize: 12,
    fontWeight: '700',
    color: PlatformColor('secondaryLabel'),
    letterSpacing: 0.2,
  },
  reasonText: {
    fontSize: 13,
    fontWeight: '400',
    color: PlatformColor('secondaryLabel'),
    lineHeight: 18,
  },
});
