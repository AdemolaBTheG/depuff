import { File } from 'expo-file-system';

export type BridgeLocale = 'en' | 'es' | 'fr' | 'de' | 'ja' | 'zh';
export type BridgeRetentionStatus = 'low_retention' | 'moderate_retention' | 'high_retention';
export type BridgeRoutineProtocol =
  | 'lymphatic_deep_drainage'
  | 'standard_drainage'
  | 'quick_sculpt';
export type BridgeRoutineVariant =
  | 'reset'
  | 'boost'
  | 'sculpt'
  | 'release'
  | 'balance'
  | 'deep'
  | 'restore';
export type BridgeFoodRisk = 'low' | 'moderate' | 'high' | 'extreme';
export type BridgeActionItem = {
  id: string;
  text: string;
  completed: boolean;
};

export type AnalyzeFaceParams = {
  imageUri?: string;
  imageBase64?: string;
  timestamp?: string;
  locale?: BridgeLocale;
  metadata?: {
    is_morning?: boolean;
    last_water_intake_ml?: number;
  };
  authToken?: string;
};

export type AnalyzeFaceResponse = {
  locale: BridgeLocale;
  score: number;
  status: BridgeRetentionStatus;
  focus_areas: string[];
  analysis_summary: string;
  suggested_protocol: BridgeRoutineProtocol;
  actionable_steps: BridgeActionItem[];
};

export type AnalyzeFoodParams = {
  imageUri?: string;
  imageBase64?: string;
  timestamp?: string;
  locale?: BridgeLocale;
  authToken?: string;
};

export type AnalyzeFoodResponse = {
  locale: BridgeLocale;
  food_name: string;
  sodium_mg: number;
  bloat_risk: BridgeFoodRisk;
  counter_measure: string;
};

export type DailyRoutineParams = {
  averageScore: number;
  locale?: BridgeLocale;
  authToken?: string;
};

export type DailyRoutineResponse = {
  date: string;
  locale: BridgeLocale;
  average_score: number;
  protocol: BridgeRoutineProtocol;
  variant: BridgeRoutineVariant;
  title: string;
  duration_minutes: number;
  video_url: string;
};

export class BridgeApiError extends Error {
  status: number;
  body?: unknown;

  constructor(message: string, status: number, body?: unknown) {
    super(message);
    this.name = 'BridgeApiError';
    this.status = status;
    this.body = body;
  }
}

const DEFAULT_LOCALE: BridgeLocale = 'en';

function getApiBaseUrl(): string {
  const raw = process.env.EXPO_PUBLIC_BRIDGE_API_URL;
  if (!raw) {
    throw new Error('Missing EXPO_PUBLIC_BRIDGE_API_URL');
  }
  return raw.replace(/\/+$/, '');
}

function getAuthToken(overrideToken?: string): string {
  const token = overrideToken ?? process.env.EXPO_PUBLIC_BRIDGE_API_TOKEN;
  if (!token) {
    throw new Error('Missing bridge auth token. Set EXPO_PUBLIC_BRIDGE_API_TOKEN or pass authToken.');
  }
  return token;
}

function clampScore(value: number): number {
  return Math.min(100, Math.max(0, Math.round(value)));
}

function normalizeLocale(locale?: BridgeLocale): BridgeLocale {
  return locale ?? DEFAULT_LOCALE;
}

function normalizeImageUri(uri: string): string {
  return uri.startsWith('file://') ? uri : `file://${uri}`;
}

function sanitizeActionItems(input: unknown): BridgeActionItem[] {
  if (!Array.isArray(input)) return [];

  const items = input
    .map((item, index) => {
      if (typeof item === 'string') {
        const text = item.trim();
        if (!text) return null;
        return {
          id: `step-${index + 1}`,
          text,
          completed: false,
        } satisfies BridgeActionItem;
      }

      if (typeof item === 'object' && item !== null) {
        const record = item as {
          id?: unknown;
          text?: unknown;
          completed?: unknown;
        };
        const text = typeof record.text === 'string' ? record.text.trim() : '';
        if (!text) return null;

        const id =
          typeof record.id === 'string' && record.id.trim()
            ? record.id.trim()
            : `step-${index + 1}`;

        return {
          id,
          text,
          completed: typeof record.completed === 'boolean' ? record.completed : false,
        } satisfies BridgeActionItem;
      }

      return null;
    })
    .filter((item): item is BridgeActionItem => Boolean(item))
    .slice(0, 8);

  return items;
}

async function imageToBase64(imageUri: string): Promise<string> {
  const normalizedUri = normalizeImageUri(imageUri);
  return new File(normalizedUri).base64();
}

async function resolveImageBase64(params: {
  imageBase64?: string;
  imageUri?: string;
}): Promise<string> {
  if (params.imageBase64?.trim()) return params.imageBase64;
  if (!params.imageUri) {
    throw new Error('Either imageBase64 or imageUri is required');
  }
  return imageToBase64(params.imageUri);
}

async function parseErrorBody(response: Response): Promise<unknown> {
  const text = await response.text();
  if (!text) return undefined;
  try {
    return JSON.parse(text) as unknown;
  } catch {
    return text;
  }
}

async function requestBridge<T>(
  path: string,
  init: RequestInit,
  authToken?: string
): Promise<T> {
  const baseUrl = getApiBaseUrl();
  const token = getAuthToken(authToken);
  const response = await fetch(`${baseUrl}${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
      ...(init.headers ?? {}),
    },
  });

  if (!response.ok) {
    const errorBody = await parseErrorBody(response);
    throw new BridgeApiError(`Bridge request failed (${response.status})`, response.status, errorBody);
  }

  return (await response.json()) as T;
}

export async function analyzeFace(params: AnalyzeFaceParams): Promise<AnalyzeFaceResponse> {
  const image_base64 = await resolveImageBase64(params);
  const response = await requestBridge<AnalyzeFaceResponse>(
    '/v1/analyze/face',
    {
      method: 'POST',
      body: JSON.stringify({
        image_base64,
        timestamp: params.timestamp ?? new Date().toISOString(),
        locale: normalizeLocale(params.locale),
        metadata: params.metadata ?? {
          is_morning: true,
          last_water_intake_ml: 0,
        },
      }),
    },
    params.authToken
  );

  console.log("=== RAW FACE API RESPONSE ===", JSON.stringify(response, null, 2));

  return {
    ...response,
    locale: normalizeLocale(response.locale),
    score: clampScore(response.score),
    focus_areas: Array.isArray(response.focus_areas) ? response.focus_areas : [],
    actionable_steps: sanitizeActionItems(response.actionable_steps),
  };
}

export async function analyzeFood(params: AnalyzeFoodParams): Promise<AnalyzeFoodResponse> {
  const image_base64 = await resolveImageBase64(params);
  const response = await requestBridge<AnalyzeFoodResponse>(
    '/v1/analyze/food',
    {
      method: 'POST',
      body: JSON.stringify({
        image_base64,
        timestamp: params.timestamp ?? new Date().toISOString(),
        locale: normalizeLocale(params.locale),
      }),
    },
    params.authToken
  );

  return {
    ...response,
    locale: normalizeLocale(response.locale),
    sodium_mg: Math.max(0, Math.round(response.sodium_mg ?? 0)),
  };
}

export async function getDailyRoutine(params: DailyRoutineParams): Promise<DailyRoutineResponse> {
  const score = clampScore(params.averageScore);
  const locale = normalizeLocale(params.locale);
  const query = new URLSearchParams({
    average_score: String(score),
    locale,
  });

  const response = await requestBridge<DailyRoutineResponse>(
    `/v1/routines/daily?${query.toString()}`,
    {
      method: 'GET',
    },
    params.authToken
  );

  return {
    ...response,
    locale: normalizeLocale(response.locale),
    average_score: clampScore(response.average_score),
  };
}
