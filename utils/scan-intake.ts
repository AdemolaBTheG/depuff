import { dailyLogs, faceScans } from '@/db/schema';
import { useDbStore } from '@/stores/dbStore';

export type ScanRoutineKey = 'quick_sculpt' | 'standard_drainage' | 'deep_tissue_drainage';

export type ScanResultPayload = {
  score: number;
  primary_zone: string;
  severity: 'low' | 'moderate' | 'high';
  feedback?: string;
  flagged_areas?: string[];
};

export type SubmitScanParams = {
  imageUri: string;
  createdAt?: string;
};

export type PersistScanParams = {
  imageUri: string;
  createdAt?: string;
  result: ScanResultPayload;
};

function toDailyDate(input = new Date()): string {
  return input.toISOString().slice(0, 10);
}

export function selectRoutineFromScore(score: number): ScanRoutineKey {
  if (score > 70) return 'deep_tissue_drainage';
  if (score < 30) return 'quick_sculpt';
  return 'standard_drainage';
}

export async function submitScanForAnalysis(
  params: SubmitScanParams
): Promise<ScanResultPayload | null> {
  const endpoint = process.env.EXPO_PUBLIC_SCAN_API_URL;
  if (!endpoint) return null;

  const response = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      imageUri: params.imageUri,
      createdAt: params.createdAt ?? new Date().toISOString(),
    }),
  });

  if (!response.ok) {
    throw new Error(`Scan intake failed (${response.status})`);
  }

  return (await response.json()) as ScanResultPayload;
}

export async function persistScanResult({
  imageUri,
  createdAt = new Date().toISOString(),
  result,
}: PersistScanParams): Promise<void> {
  const db = useDbStore.getState().db;
  if (!db) {
    throw new Error('Database is not initialized');
  }

  const dailyDate = toDailyDate(new Date(createdAt));

  await db.insert(faceScans).values({
    createdAt,
    score: result.score,
    feedback: result.feedback ?? `${result.primary_zone} - ${result.severity}`,
    flaggedAreas: result.flagged_areas ? JSON.stringify(result.flagged_areas) : null,
    localImageUri: imageUri,
  });

  await db
    .insert(dailyLogs)
    .values({
      date: dailyDate,
      dailyBloatScore: result.score,
    })
    .onConflictDoUpdate({
      target: dailyLogs.date,
      set: {
        dailyBloatScore: result.score,
      },
    });
}
