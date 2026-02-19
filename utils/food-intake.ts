import { dailyLogs, foodLogs } from '@/db/schema';
import { toDailyDate } from '@/hooks/useDayStatus';
import type { PendingFoodAnalysis } from '@/stores/foodAnalysisStore';
import { useDbStore } from '@/stores/dbStore';

type PersistFoodResult = {
  logDate: string;
};

export async function persistConfirmedFoodAnalysis(
  pendingAnalysis: PendingFoodAnalysis
): Promise<PersistFoodResult> {
  const db = useDbStore.getState().db;
  if (!db) {
    throw new Error('Database is not initialized');
  }

  const logDate = toDailyDate(new Date(pendingAnalysis.capturedAt));

  await db
    .insert(dailyLogs)
    .values({
      date: logDate,
    })
    .onConflictDoNothing();

  await db.insert(foodLogs).values({
    logDate,
    createdAt: pendingAnalysis.capturedAt,
    foodName: pendingAnalysis.result.food_name,
    sodiumEstimateMg: pendingAnalysis.result.sodium_mg,
    bloatRiskLevel: pendingAnalysis.result.bloat_risk,
    aiReasoning: pendingAnalysis.result.counter_measure,
    localImageUri: pendingAnalysis.imageUri,
  });

  return { logDate };
}
