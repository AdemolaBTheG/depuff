import { dailyLogs, faceScans, foodLogs, type ActionItem } from '@/db/schema';
import { useDbStore } from '@/stores/dbStore';
import { useSettingsStore } from '@/stores/settingsStore';
import { useQuery } from '@tanstack/react-query';
import { desc, eq, sql } from 'drizzle-orm';

export type DayProgressState = 'empty' | 'partial' | 'complete';

export type DayStatus = {
  date: string;
  hasScan: boolean;
  hasWaterIntake: boolean;
  routineCompleted: boolean;
  protocolTasksComplete: boolean;
  progressPercent: 0 | 50 | 100;
  state: DayProgressState;
  actionableSteps: ActionItem[] | null;
};

export type DayBalance = {
  date: string;
  waterIntakeMl: number;
  waterGoalMl: number;
  sodiumMg: number;
  sodiumGoalMg: number;
  sodiumLevel: 'low' | 'high';
};

export type DayFoodEntry = {
  id: number;
  foodName: string;
  sodiumEstimateMg: number;
  bloatRiskLevel: string | null;
  aiReasoning: string | null;
  localImageUri: string | null;
  createdAt: string | null;
};

export function toDailyDate(input = new Date()): string {
  return input.toISOString().slice(0, 10);
}

function toProgressState(params: {
  hasScan: boolean;
  protocolTasksComplete: boolean;
}): DayProgressState {
  if (!params.hasScan) return 'empty';
  return params.protocolTasksComplete ? 'complete' : 'partial';
}

async function fetchDayStatus(date: string): Promise<DayStatus> {
  const db = useDbStore.getState().db;
  if (!db) {
    throw new Error('Database is not initialized');
  }

  const [scanRow] = await db
    .select({ id: faceScans.id })
    .from(faceScans)
    .where(sql`substr(${faceScans.createdAt}, 1, 10) = ${date}`)
    .limit(1);

  const [dailyRow] = await db
    .select({
      waterIntake: dailyLogs.waterIntake,
      routineCompleted: dailyLogs.routineCompleted,
      actionableSteps: dailyLogs.actionableSteps,
    })
    .from(dailyLogs)
    .where(eq(dailyLogs.date, date))
    .limit(1);

  const hasScan = Boolean(scanRow?.id);
  const water = dailyRow?.waterIntake ?? 0;
  const hasWaterIntake = water > 0;
  const routineCompleted = Boolean(dailyRow?.routineCompleted);
  const protocolTasksComplete = hasWaterIntake && routineCompleted;

  const progressPercent = (hasScan ? 50 : 0) + (protocolTasksComplete ? 50 : 0);

  return {
    date,
    hasScan,
    hasWaterIntake,
    routineCompleted,
    protocolTasksComplete,
    progressPercent: progressPercent as 0 | 50 | 100,
    state: toProgressState({ hasScan, protocolTasksComplete }),
    actionableSteps: dailyRow?.actionableSteps ?? null,
  };
}

export function useDayStatus(date = toDailyDate()) {
  const db = useDbStore((state) => state.db);

  return useQuery({
    enabled: Boolean(db),
    queryKey: ['day-status', date],
    queryFn: () => fetchDayStatus(date),
    staleTime: 60_000,
  });
}

export async function getDayStatus(date = toDailyDate()): Promise<DayStatus> {
  return fetchDayStatus(date);
}

async function fetchDayBalance(date: string): Promise<DayBalance> {
  const db = useDbStore.getState().db;
  if (!db) {
    throw new Error('Database is not initialized');
  }

  const [dailyRow] = await db
    .select({
      waterIntake: dailyLogs.waterIntake,
    })
    .from(dailyLogs)
    .where(eq(dailyLogs.date, date))
    .limit(1);

  const [sodiumRow] = await db
    .select({
      totalSodium: sql<number>`coalesce(sum(${foodLogs.sodiumEstimateMg}), 0)`,
    })
    .from(foodLogs)
    .where(eq(foodLogs.logDate, date));

  const { waterGoalMl, sodiumGoalMg } = useSettingsStore.getState();
  const waterIntakeMl = dailyRow?.waterIntake ?? 0;
  const sodiumMg = sodiumRow?.totalSodium ?? 0;

  return {
    date,
    waterIntakeMl,
    waterGoalMl,
    sodiumMg,
    sodiumGoalMg,
    sodiumLevel: sodiumMg >= sodiumGoalMg ? 'high' : 'low',
  };
}

export function useDayBalance(date = toDailyDate()) {
  const db = useDbStore((state) => state.db);

  return useQuery({
    enabled: Boolean(db),
    queryKey: ['day-balance', date],
    queryFn: () => fetchDayBalance(date),
    staleTime: 60_000,
  });
}

export async function getDayBalance(date = toDailyDate()): Promise<DayBalance> {
  return fetchDayBalance(date);
}

async function fetchDayRecentFoods(date: string, limit: number): Promise<DayFoodEntry[]> {
  const db = useDbStore.getState().db;
  if (!db) {
    throw new Error('Database is not initialized');
  }

  const safeLimit = Math.max(1, Math.round(limit));
  const rows = await db
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
    .where(eq(foodLogs.logDate, date))
    .orderBy(desc(foodLogs.createdAt), desc(foodLogs.id))
    .limit(safeLimit);

  return rows.map((row) => ({
    id: row.id,
    foodName: row.foodName ?? 'Unnamed food',
    sodiumEstimateMg: row.sodiumEstimateMg ?? 0,
    bloatRiskLevel: row.bloatRiskLevel ?? null,
    aiReasoning: row.aiReasoning ?? null,
    localImageUri: row.localImageUri ?? null,
    createdAt: row.createdAt ?? null,
  }));
}

export function useDayRecentFoods(date = toDailyDate(), limit = 3) {
  const db = useDbStore((state) => state.db);
  const safeLimit = Math.max(1, Math.round(limit));

  return useQuery({
    enabled: Boolean(db),
    queryKey: ['day-foods', date, safeLimit],
    queryFn: () => fetchDayRecentFoods(date, safeLimit),
    staleTime: 60_000,
  });
}
