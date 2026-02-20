import { dailyLogs } from '@/db/schema';
import { useDbStore } from '@/stores/dbStore';
import { useSettingsStore } from '@/stores/settingsStore';
import {
  HYDRATION_WIDGET_NAME,
  type HydrationWidgetProps,
  registerHydrationWidgetLayout,
} from '@/widgets/hydration-flush-widget';
import { eq } from 'drizzle-orm';
import { Platform } from 'react-native';

function toDailyDate(input = new Date()): string {
  return input.toISOString().slice(0, 10);
}

function clamp01(value: number): number {
  return Math.min(1, Math.max(0, value));
}

function createWidgetPayload(intakeMl: number, goalMl: number): HydrationWidgetProps {
  const safeGoalMl = Math.max(1, Math.round(goalMl));
  const safeIntakeMl = Math.max(0, Math.round(intakeMl));
  const progress = clamp01(safeIntakeMl / safeGoalMl);

  return {
    intakeMl: safeIntakeMl,
    goalMl: safeGoalMl,
    progress,
    remainingMl: Math.max(0, safeGoalMl - safeIntakeMl),
  };
}

async function readTodayHydrationIntake(): Promise<number> {
  const db = useDbStore.getState().db;
  if (!db) return 0;

  const [row] = await db
    .select({ waterIntake: dailyLogs.waterIntake })
    .from(dailyLogs)
    .where(eq(dailyLogs.date, toDailyDate(new Date())))
    .limit(1);

  return row?.waterIntake ?? 0;
}

export async function syncHydrationWidgetSnapshot(): Promise<void> {
  if (Platform.OS !== 'ios') return;

  const [intakeMl, waterGoalMl] = await Promise.all([
    readTodayHydrationIntake(),
    Promise.resolve(useSettingsStore.getState().waterGoalMl),
  ]);

  await registerHydrationWidgetLayout();
  const { updateWidgetSnapshot } = await import('expo-widgets');
  updateWidgetSnapshot(HYDRATION_WIDGET_NAME, createWidgetPayload(intakeMl, waterGoalMl));
}
