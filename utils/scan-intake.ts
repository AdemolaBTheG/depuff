import { dailyLogs, faceScans, type ActionItem } from '@/db/schema';
import {
  analyzeFace,
  type AnalyzeFaceResponse,
  type BridgeLocale,
  type BridgeRoutineProtocol,
} from '@/services/bridge-api';
import { useDbStore } from '@/stores/dbStore';
import { File } from 'expo-file-system';
import { and, eq } from 'drizzle-orm';

export type ScanRoutineKey = BridgeRoutineProtocol;

export type ScanResultPayload = AnalyzeFaceResponse;

export type SubmitScanParams = {
  imageUri: string;
  createdAt?: string;
  locale?: BridgeLocale;
};

export type PersistScanParams = {
  imageUri: string;
  createdAt?: string;
  result: ScanResultPayload;
};

function toDailyDate(input = new Date()): string {
  return input.toISOString().slice(0, 10);
}

function normalizeActionableSteps(steps: ActionItem[] | undefined): ActionItem[] {
  if (!Array.isArray(steps)) return [];

  return steps
    .map((item, index) => {
      const text = String(item?.text ?? '').trim();
      if (!text) return null;
      const id =
        typeof item?.id === 'string' && item.id.trim().length > 0 ? item.id.trim() : `step-${index + 1}`;
      return {
        id,
        text,
        completed: Boolean(item?.completed),
      } satisfies ActionItem;
    })
    .filter((item): item is ActionItem => Boolean(item))
    .slice(0, 8);
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
      actionableSteps: normalizeActionableSteps(result.actionable_steps),
    })
    .onConflictDoUpdate({
      target: dailyLogs.date,
      set: {
        dailyBloatScore: result.score,
        actionableSteps: normalizeActionableSteps(result.actionable_steps),
      },
    });
}

type DeleteScanParams = {
  imageUri?: string;
  createdAt?: string;
};

function normalizeFileUri(uri: string): string {
  return uri.startsWith('file://') ? uri : `file://${uri}`;
}

async function tryDeleteLocalImage(imageUri?: string): Promise<void> {
  if (!imageUri) return;
  try {
    const file = new File(normalizeFileUri(imageUri));
    if (file.exists) {
      file.delete();
    }
  } catch {
    // ignore file deletion errors so DB cleanup can still proceed
  }
}

export async function deletePersistedScan({ imageUri, createdAt }: DeleteScanParams): Promise<void> {
  const db = useDbStore.getState().db;
  if (!db) {
    throw new Error('Database is not initialized');
  }

  if (imageUri && createdAt) {
    await db
      .delete(faceScans)
      .where(and(eq(faceScans.localImageUri, imageUri), eq(faceScans.createdAt, createdAt)));
  } else if (imageUri) {
    await db.delete(faceScans).where(eq(faceScans.localImageUri, imageUri));
  } else if (createdAt) {
    await db.delete(faceScans).where(eq(faceScans.createdAt, createdAt));
  } else {
    throw new Error('Either imageUri or createdAt is required to delete scan');
  }

  await tryDeleteLocalImage(imageUri);
}
