import { dailyLogs, faceScans } from '@/db/schema';
import { analyzeFace, type AnalyzeFaceResponse, type BridgeRoutineProtocol } from '@/services/bridge-api';
import { useDbStore } from '@/stores/dbStore';

export type ScanRoutineKey = BridgeRoutineProtocol;

export type ScanResultPayload = AnalyzeFaceResponse;

export type SubmitScanParams = {
  imageUri: string;
  createdAt?: string;
  locale?: 'en' | 'es' | 'fr' | 'de' | 'ja' | 'zh';
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
  if (score > 70) return 'lymphatic_deep_drainage';
  if (score < 30) return 'quick_sculpt';
  return 'standard_drainage';
}

export async function submitScanForAnalysis(
  params: SubmitScanParams
): Promise<ScanResultPayload | null> {
  return analyzeFace({
    imageUri: params.imageUri,
    timestamp: params.createdAt ?? new Date().toISOString(),
    locale: params.locale ?? 'en',
  });
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
    feedback: result.analysis_summary ?? result.status,
    flaggedAreas: result.focus_areas ? JSON.stringify(result.focus_areas) : null,
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
