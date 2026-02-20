import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';

import { GoogleGenAI } from '@google/genai';
import express, { type NextFunction, type Request, type Response } from 'express';
import sharp from 'sharp';

type FaceRequestBody = {
  image_base64?: string;
  timestamp?: string;
  locale?: string;
  metadata?: {
    is_morning?: boolean;
    last_water_intake_ml?: number;
  };
};

type FoodRequestBody = {
  image_base64?: string;
  timestamp?: string;
  locale?: string;
};

type SupportedLocale = 'en' | 'es' | 'fr' | 'de' | 'ja' | 'zh' | 'it' | 'nl' | 'pt';
type RoutineProtocol = 'lymphatic_deep_drainage' | 'standard_drainage' | 'quick_sculpt';
type WeekdayVariant = 'reset' | 'boost' | 'sculpt' | 'release' | 'balance' | 'deep' | 'restore';
type ActionableStep = {
  id: string;
  text: string;
  completed: boolean;
};

const PORT = Number(process.env.PORT ?? 8080);
const GEMINI_API_KEY = process.env.GEMINI_API_KEY ?? '';
const FACE_MODEL = process.env.GEMINI_FACE_MODEL ?? 'gemini-2.5-flash';
const FOOD_MODEL = process.env.GEMINI_FOOD_MODEL ?? 'gemini-2.5-flash';
const MIN_RESPONSE_DELAY_MS = Number(process.env.MIN_RESPONSE_DELAY_MS ?? 1500);
const TMP_SCAN_DIR = process.env.TMP_SCAN_DIR ?? '/tmp/scans';
const CLEANUP_INTERVAL_MS = 10 * 60 * 1000;
const BRIDGE_API_TOKEN = (process.env.BRIDGE_API_TOKEN ?? '').trim();
const ROUTINE_CDN_BASE_URL = process.env.ROUTINE_CDN_BASE_URL ?? 'https://cdn.yourdomain.com/routines';
const SUPPORTED_LOCALES: readonly SupportedLocale[] = [
  'en',
  'es',
  'fr',
  'de',
  'ja',
  'zh',
  'it',
  'nl',
  'pt',
];
const DEFAULT_LOCALE = normalizeLocale(process.env.DEFAULT_LOCALE) ?? 'en';

const MODEL_LANGUAGE_LABELS: Record<SupportedLocale, string> = {
  en: 'English',
  es: 'Spanish',
  fr: 'French',
  de: 'German',
  ja: 'Japanese',
  zh: 'Simplified Chinese',
  it: 'Italian',
  nl: 'Dutch',
  pt: 'Portuguese',
};

const ROUTINE_PROTOCOL_TITLES: Record<SupportedLocale, Record<RoutineProtocol, string>> = {
  en: {
    lymphatic_deep_drainage: 'Lymphatic Deep Drainage',
    standard_drainage: 'Standard Drainage',
    quick_sculpt: 'Quick Sculpt',
  },
  es: {
    lymphatic_deep_drainage: 'Drenaje Linfatico Profundo',
    standard_drainage: 'Drenaje Estandar',
    quick_sculpt: 'Esculpido Rapido',
  },
  fr: {
    lymphatic_deep_drainage: 'Drainage Lymphatique Profond',
    standard_drainage: 'Drainage Standard',
    quick_sculpt: 'Sculpture Rapide',
  },
  de: {
    lymphatic_deep_drainage: 'Tiefe Lymphdrainage',
    standard_drainage: 'Standarddrainage',
    quick_sculpt: 'Schnelles Sculpting',
  },
  ja: {
    lymphatic_deep_drainage: 'リンパディープドレナージュ',
    standard_drainage: '標準ドレナージュ',
    quick_sculpt: 'クイックスカルプト',
  },
  zh: {
    lymphatic_deep_drainage: '深层淋巴引流',
    standard_drainage: '标准引流',
    quick_sculpt: '快速塑形',
  },
  it: {
    lymphatic_deep_drainage: 'Drenaggio Linfatico Profondo',
    standard_drainage: 'Drenaggio Standard',
    quick_sculpt: 'Quick Sculpt',
  },
  nl: {
    lymphatic_deep_drainage: 'Diepe Lymfedrainage',
    standard_drainage: 'Standaard Drainage',
    quick_sculpt: 'Quick Sculpt',
  },
  pt: {
    lymphatic_deep_drainage: 'Drenagem Linfatica Profunda',
    standard_drainage: 'Drenagem Padrao',
    quick_sculpt: 'Quick Sculpt',
  },
};

const ROUTINE_VARIANT_TITLES: Record<SupportedLocale, Record<WeekdayVariant, string>> = {
  en: {
    reset: 'Reset',
    boost: 'Boost',
    sculpt: 'Sculpt',
    release: 'Release',
    balance: 'Balance',
    deep: 'Deep',
    restore: 'Restore',
  },
  es: {
    reset: 'Reinicio',
    boost: 'Impulso',
    sculpt: 'Esculpir',
    release: 'Liberacion',
    balance: 'Balance',
    deep: 'Profundo',
    restore: 'Restaurar',
  },
  fr: {
    reset: 'Reinitialisation',
    boost: 'Boost',
    sculpt: 'Sculpter',
    release: 'Relacher',
    balance: 'Equilibre',
    deep: 'Profond',
    restore: 'Restaurer',
  },
  de: {
    reset: 'Reset',
    boost: 'Boost',
    sculpt: 'Formen',
    release: 'Entlasten',
    balance: 'Balance',
    deep: 'Tief',
    restore: 'Wiederherstellen',
  },
  ja: {
    reset: 'リセット',
    boost: 'ブースト',
    sculpt: 'スカルプト',
    release: 'リリース',
    balance: 'バランス',
    deep: 'ディープ',
    restore: 'リストア',
  },
  zh: {
    reset: '重置',
    boost: '增强',
    sculpt: '塑形',
    release: '释放',
    balance: '平衡',
    deep: '深层',
    restore: '修复',
  },
  it: {
    reset: 'Reset',
    boost: 'Boost',
    sculpt: 'Scolpisci',
    release: 'Rilascio',
    balance: 'Bilanciamento',
    deep: 'Profondo',
    restore: 'Ripristino',
  },
  nl: {
    reset: 'Reset',
    boost: 'Boost',
    sculpt: 'Sculpt',
    release: 'Release',
    balance: 'Balans',
    deep: 'Diep',
    restore: 'Herstel',
  },
  pt: {
    reset: 'Reset',
    boost: 'Boost',
    sculpt: 'Esculpir',
    release: 'Liberacao',
    balance: 'Equilibrio',
    deep: 'Profundo',
    restore: 'Restaurar',
  },
};

const FACE_SYSTEM_INSTRUCTION = [
  'You are a professional medical aesthetician specializing in edema and lymphatic health.',
  'Analyze the provided facial image for early signs of fluid retention and facial fullness.',
  'Pay attention to key indicators such as:',
  '- Periorbital puffiness (smoothness vs. sharp eye creases).',
  '- Jawline definition (shadow contrast on the mandible).',
  '- Asymmetry indicating sleep-side fluid pooling.',
  '- General facial edema or mid-face tissue swelling.',
  "Return only a JSON object with keys: 'score' (0-100), 'focus_areas' (array), 'summary' (1 sentence), 'actionable_steps' (array of 3-5 short practical actions).",
].join('\n');

const FOOD_SYSTEM_INSTRUCTION = [
  'You are a nutrition assistant focused on sodium-related fluid retention.',
  'Analyze the provided food image and estimate sodium impact.',
  "Return only JSON with keys: food_name (string), sodium_mg (integer), bloat_risk ('low'|'moderate'|'high'|'extreme'), counter_measure (string).",
  'Do not include markdown or extra text.',
].join('\n');

if (!GEMINI_API_KEY) {
  throw new Error('Missing GEMINI_API_KEY');
}

if (!BRIDGE_API_TOKEN) {
  throw new Error('Missing BRIDGE_API_TOKEN');
}

const gemini = new GoogleGenAI({ apiKey: GEMINI_API_KEY });

const app = express();

app.set('trust proxy', true);
app.use(express.json({ limit: '16mb' }));

app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
  next();
});

app.get('/health', (_req, res) => {
  res.json({
    ok: true,
    auth_mode: 'bridge_token',
    default_locale: DEFAULT_LOCALE,
    supported_locales: SUPPORTED_LOCALES,
    uptime_seconds: Math.floor(process.uptime()),
  });
});

app.use('/v1', authGuard);

app.post('/v1/analyze/face', async (req: Request, res: Response) => {
  const startedAt = Date.now();
  try {
    const body = req.body as FaceRequestBody;
    const locale = resolveRequestLocale(req, body.locale);
    const languageLabel = MODEL_LANGUAGE_LABELS[locale];
    if (!body.image_base64) {
      await respondWithDelay(startedAt, res, 400, { error: 'image_base64 is required' });
      return;
    }

    const originalImage = decodeBase64Image(body.image_base64);
    const prepared = await preprocessAndStoreTempImage(originalImage, 'face');

    const userPrompt = [
      'Analyze this morning facial scan for fluid retention cues.',
      `timestamp: ${body.timestamp ?? new Date().toISOString()}`,
      `is_morning: ${String(body.metadata?.is_morning ?? true)}`,
      `last_water_intake_ml: ${String(body.metadata?.last_water_intake_ml ?? 0)}`,
      `Write 'summary' in ${languageLabel}.`,
      `Write 'actionable_steps' in ${languageLabel}.`,
      "Keep 'focus_areas' canonical short English labels (for stable app mapping).",
      `Output JSON only: {"score":number,"focus_areas":string[],"summary":string,"actionable_steps":string[]}`,
    ].join('\n');

    const modelPayload = await callGeminiJson({
      model: FACE_MODEL,
      systemInstruction: FACE_SYSTEM_INSTRUCTION,
      userPrompt,
      imageBase64: prepared.base64,
      imageMimeType: prepared.mimeType,
    });

    const score = clampInt(Number(modelPayload.score ?? 0), 0, 100);
    const focusAreas = sanitizeStringArray(modelPayload.focus_areas);
    const summary = String(modelPayload.summary ?? 'Facial fluid retention pattern analyzed.');
    const status = scoreToStatus(score);
    const suggestedProtocol = scoreToProtocol(score);
    const actionableSteps = buildActionItems(
      sanitizeStringArray(modelPayload.actionable_steps),
      score,
      locale
    );

    await respondWithDelay(startedAt, res, 200, {
      locale,
      score,
      status,
      focus_areas: focusAreas,
      analysis_summary: summary,
      suggested_protocol: suggestedProtocol,
      actionable_steps: actionableSteps,
    });
  } catch (error) {
    await respondWithDelay(startedAt, res, 500, {
      error: error instanceof Error ? error.message : 'Face analysis failed',
    });
  }
});

app.post('/v1/analyze/food', async (req: Request, res: Response) => {
  const startedAt = Date.now();
  try {
    const body = req.body as FoodRequestBody;
    const locale = resolveRequestLocale(req, body.locale);
    const languageLabel = MODEL_LANGUAGE_LABELS[locale];
    if (!body.image_base64) {
      await respondWithDelay(startedAt, res, 400, { error: 'image_base64 is required' });
      return;
    }

    const originalImage = decodeBase64Image(body.image_base64);
    const prepared = await preprocessAndStoreTempImage(originalImage, 'food');

    const userPrompt = [
      'Identify the dish and estimate sodium exposure.',
      `timestamp: ${body.timestamp ?? new Date().toISOString()}`,
      `Write 'food_name' and 'counter_measure' in ${languageLabel}.`,
      "Return 'bloat_risk' strictly in English enum: low|moderate|high|extreme.",
      "Output JSON only: {\"food_name\":string,\"sodium_mg\":number,\"bloat_risk\":\"low|moderate|high|extreme\",\"counter_measure\":string}",
    ].join('\n');

    const modelPayload = await callGeminiJson({
      model: FOOD_MODEL,
      systemInstruction: FOOD_SYSTEM_INSTRUCTION,
      userPrompt,
      imageBase64: prepared.base64,
      imageMimeType: prepared.mimeType,
    });

    const sodiumMg = Math.max(0, Math.round(Number(modelPayload.sodium_mg ?? 0)));
    const bloatRisk = sanitizeRiskLevel(modelPayload.bloat_risk);

    await respondWithDelay(startedAt, res, 200, {
      locale,
      food_name: String(modelPayload.food_name ?? 'Unknown meal'),
      sodium_mg: sodiumMg,
      bloat_risk: bloatRisk,
      counter_measure: String(
        modelPayload.counter_measure ?? 'Drink 500-750ml water and avoid extra sodium for 6 hours.'
      ),
    });
  } catch (error) {
    await respondWithDelay(startedAt, res, 500, {
      error: error instanceof Error ? error.message : 'Food analysis failed',
    });
  }
});

app.get('/v1/routines/daily', async (req: Request, res: Response) => {
  const startedAt = Date.now();
  try {
    const locale = resolveRequestLocale(req, req.query.locale);
    const avgScoreInput = Number(req.query.average_score ?? req.query.avg_score ?? 50);
    const averageScore = Number.isFinite(avgScoreInput) ? clampInt(avgScoreInput, 0, 100) : 50;
    const routine = buildDailyRoutine(averageScore, new Date(), locale);

    await respondWithDelay(startedAt, res, 200, routine);
  } catch (error) {
    await respondWithDelay(startedAt, res, 500, {
      error: error instanceof Error ? error.message : 'Routine lookup failed',
    });
  }
});

app.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
  const message = err instanceof Error ? err.message : 'Unknown server error';
  res.status(500).json({ error: message });
});

void ensureTmpDirectory();
startTempCleanupJob();

app.listen(PORT, () => {
  console.log(`AI bridge listening on :${PORT} (auth_mode=bridge_token)`);
});

async function authGuard(req: Request, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization ?? '';
  const [scheme, token] = authHeader.split(' ');

  if (scheme !== 'Bearer' || !token) {
    res.status(401).json({ error: 'Missing or invalid Bearer token' });
    return;
  }

  if (!secureEquals(token, BRIDGE_API_TOKEN)) {
    res.status(401).json({ error: 'Invalid bridge token' });
    return;
  }

  next();
}

function secureEquals(candidate: string, expected: string): boolean {
  const candidateBuffer = Buffer.from(candidate);
  const expectedBuffer = Buffer.from(expected);
  if (candidateBuffer.length !== expectedBuffer.length) return false;
  return crypto.timingSafeEqual(candidateBuffer, expectedBuffer);
}

function decodeBase64Image(raw: string): Buffer {
  const normalized = raw.includes(',') ? raw.slice(raw.indexOf(',') + 1) : raw;
  if (!normalized.trim()) {
    throw new Error('image_base64 is empty');
  }
  return Buffer.from(normalized, 'base64');
}

async function preprocessAndStoreTempImage(
  inputBuffer: Buffer,
  prefix: string
): Promise<{ base64: string; mimeType: 'image/jpeg' }> {
  const outputBuffer = await sharp(inputBuffer)
    .rotate()
    .resize({
      width: 1600,
      height: 1600,
      fit: 'inside',
      withoutEnlargement: true,
    })
    .jpeg({
      quality: 82,
      mozjpeg: true,
      force: true,
    })
    .toBuffer();

  const filename = `${prefix}-${Date.now()}-${crypto.randomUUID()}.jpg`;
  const fullPath = path.join(TMP_SCAN_DIR, filename);
  await fs.writeFile(fullPath, outputBuffer);

  return {
    base64: outputBuffer.toString('base64'),
    mimeType: 'image/jpeg',
  };
}

async function callGeminiJson(input: {
  model: string;
  systemInstruction: string;
  userPrompt: string;
  imageBase64: string;
  imageMimeType: string;
}): Promise<Record<string, unknown>> {
  const response = await gemini.models.generateContent({
    model: input.model,
    contents: [
      {
        role: 'user',
        parts: [
          { text: input.userPrompt },
          {
            inlineData: {
              mimeType: input.imageMimeType,
              data: input.imageBase64,
            },
          },
        ],
      },
    ],
    config: {
      systemInstruction: input.systemInstruction,
      responseMimeType: 'application/json',
    },
  });

  const text = extractModelText(response);
  return parseJsonFromModel(text);
}

function extractModelText(response: unknown): string {
  const candidateText = (response as {
    candidates?: Array<{
      content?: {
        parts?: Array<{
          text?: string;
        }>;
      };
    }>;
  })?.candidates?.[0]?.content?.parts?.[0]?.text;

  const textField = (response as { text?: unknown }).text;
  const text =
    typeof textField === 'string'
      ? textField
      : typeof textField === 'function'
        ? textField()
        : candidateText;

  if (typeof text !== 'string' || !text.trim()) {
    throw new Error('Gemini returned an empty response');
  }
  return text;
}

function parseJsonFromModel(text: string): Record<string, unknown> {
  const trimmed = text.trim();

  try {
    return JSON.parse(trimmed) as Record<string, unknown>;
  } catch {
    const cleaned = trimmed
      .replace(/^```json/i, '')
      .replace(/^```/i, '')
      .replace(/```$/i, '')
      .trim();

    try {
      return JSON.parse(cleaned) as Record<string, unknown>;
    } catch {
      const match = cleaned.match(/\{[\s\S]*\}/);
      if (!match) throw new Error('Model response is not valid JSON');
      return JSON.parse(match[0]) as Record<string, unknown>;
    }
  }
}

function scoreToStatus(score: number): 'low_retention' | 'moderate_retention' | 'high_retention' {
  if (score >= 70) return 'high_retention';
  if (score >= 40) return 'moderate_retention';
  return 'low_retention';
}

function scoreToProtocol(score: number): string {
  if (score >= 70) return 'lymphatic_deep_drainage';
  if (score >= 40) return 'standard_drainage';
  return 'quick_sculpt';
}

function sanitizeStringArray(input: unknown): string[] {
  if (!Array.isArray(input)) return [];
  return input
    .map((item) => String(item).trim())
    .filter(Boolean)
    .slice(0, 8);
}

function buildActionItems(
  rawSteps: string[],
  score: number,
  locale: SupportedLocale
): ActionableStep[] {
  const dedupedSteps = [...new Set(rawSteps.map((item) => item.trim()).filter(Boolean))].slice(0, 5);
  const steps = dedupedSteps.length > 0 ? dedupedSteps : getFallbackActionTexts(score, locale);

  return steps.map((text, index) => {
    const hash = crypto.createHash('sha1').update(`${text}-${index}`).digest('hex').slice(0, 10);
    return {
      id: `scan-step-${hash}`,
      text,
      completed: false,
    };
  });
}

function getFallbackActionTexts(score: number, locale: SupportedLocale): string[] {
  const fallbackByLocale: Record<SupportedLocale, string[]> = {
    en: [
      'Drink 500ml of water in the next 30 minutes.',
      'Do a 5-minute gentle lymphatic sweep around eyes and jawline.',
      'Keep sodium low for your next meal.',
    ],
    es: [
      'Bebe 500ml de agua en los próximos 30 minutos.',
      'Haz un drenaje linfático suave de 5 minutos en ojos y mandíbula.',
      'Mantén bajo el sodio en tu próxima comida.',
    ],
    fr: [
      "Bois 500ml d'eau dans les 30 prochaines minutes.",
      'Fais 5 minutes de drainage lymphatique doux autour des yeux et de la mâchoire.',
      'Limite le sodium pour ton prochain repas.',
    ],
    de: [
      'Trinke in den nächsten 30 Minuten 500ml Wasser.',
      'Mache 5 Minuten sanfte Lymphmassage um Augen und Kiefer.',
      'Halte Natrium bei der nächsten Mahlzeit niedrig.',
    ],
    ja: [
      '30分以内に500mlの水を飲んでください。',
      '目元とあご周りを5分間やさしくリンパケアしてください。',
      '次の食事は塩分を控えてください。',
    ],
    zh: [
      '请在30分钟内喝500ml水。',
      '对眼周和下颌进行5分钟轻柔淋巴按摩。',
      '下一餐尽量控制盐分摄入。',
    ],
    it: [
      'Bevi 500ml di acqua nei prossimi 30 minuti.',
      'Esegui 5 minuti di drenaggio linfatico delicato su occhi e mandibola.',
      'Mantieni basso il sodio nel prossimo pasto.',
    ],
    nl: [
      'Drink 500ml water in de komende 30 minuten.',
      'Doe 5 minuten zachte lymfedrainage rond ogen en kaaklijn.',
      'Houd natrium laag bij je volgende maaltijd.',
    ],
    pt: [
      'Beba 500ml de agua nos proximos 30 minutos.',
      'Faca 5 minutos de drenagem linfatica suave na regiao dos olhos e mandibula.',
      'Mantenha baixo o sodio na proxima refeicao.',
    ],
  };

  const base = [...fallbackByLocale[locale]];
  if (score >= 70) {
    base.unshift(
      locale === 'en'
        ? 'Use your deep drainage routine today.'
        : locale === 'es'
          ? 'Haz tu rutina de drenaje profundo hoy.'
          : locale === 'fr'
            ? "Fais ta routine de drainage profond aujourd'hui."
            : locale === 'de'
              ? 'Nutze heute deine tiefe Drainage-Routine.'
              : locale === 'it'
                ? 'Fai oggi la tua routine di drenaggio profondo.'
                : locale === 'nl'
                  ? 'Gebruik vandaag je diepe drainageroutine.'
                  : locale === 'pt'
                    ? 'Use hoje sua rotina de drenagem profunda.'
              : locale === 'ja'
                ? '今日はディープドレナージュルーティンを行ってください。'
                : '今天请执行深层引流方案。'
    );
  } else if (score < 30) {
    base.unshift(
      locale === 'en'
        ? 'Use your quick sculpt routine today.'
        : locale === 'es'
          ? 'Haz tu rutina rápida de sculpt hoy.'
          : locale === 'fr'
            ? "Fais ta routine quick sculpt aujourd'hui."
            : locale === 'de'
              ? 'Nutze heute deine Quick-Sculpt-Routine.'
              : locale === 'it'
                ? 'Fai oggi la tua routine quick sculpt.'
                : locale === 'nl'
                  ? 'Gebruik vandaag je quick sculpt-routine.'
                  : locale === 'pt'
                    ? 'Use hoje sua rotina quick sculpt.'
              : locale === 'ja'
                ? '今日はクイックスカルプトルーティンを行ってください。'
                : '今天请执行快速塑形方案。'
    );
  }

  return base.slice(0, 5);
}

function sanitizeRiskLevel(input: unknown): 'low' | 'moderate' | 'high' | 'extreme' {
  const value = String(input ?? '')
    .toLowerCase()
    .trim();
  if (value === 'extreme') return 'extreme';
  if (value === 'high') return 'high';
  if (value === 'moderate') return 'moderate';
  return 'low';
}

function resolveRequestLocale(req: Request, explicitLocale: unknown): SupportedLocale {
  if (typeof explicitLocale === 'string') {
    const normalized = normalizeLocale(explicitLocale);
    if (normalized) return normalized;
  }

  const fromHeader = parseAcceptLanguage(req.headers['accept-language']);
  return fromHeader ?? DEFAULT_LOCALE;
}

function parseAcceptLanguage(
  headerValue: string | string[] | undefined
): SupportedLocale | null {
  const header = Array.isArray(headerValue) ? headerValue.join(',') : headerValue;
  if (!header) return null;

  const parsed = header
    .split(',')
    .map((part) => part.trim())
    .filter(Boolean)
    .map((part) => {
      const [rawTag, ...params] = part.split(';').map((piece) => piece.trim());
      const qValue = params.find((param) => param.startsWith('q='));
      const q = qValue ? Number(qValue.slice(2)) : 1;
      return {
        tag: rawTag,
        q: Number.isFinite(q) ? q : 1,
      };
    })
    .sort((a, b) => b.q - a.q);

  for (const item of parsed) {
    const normalized = normalizeLocale(item.tag);
    if (normalized) return normalized;
  }

  return null;
}

function normalizeLocale(input: string | undefined): SupportedLocale | null {
  if (!input) return null;
  const normalized = input.toLowerCase().replace(/_/g, '-').trim();
  if (!normalized) return null;

  const aliases: Record<string, SupportedLocale> = {
    jp: 'ja',
    ja: 'ja',
    'ja-jp': 'ja',
    en: 'en',
    'en-us': 'en',
    'en-gb': 'en',
    es: 'es',
    'es-es': 'es',
    'es-mx': 'es',
    fr: 'fr',
    'fr-fr': 'fr',
    de: 'de',
    'de-de': 'de',
    it: 'it',
    'it-it': 'it',
    nl: 'nl',
    'nl-nl': 'nl',
    'nl-be': 'nl',
    pt: 'pt',
    'pt-br': 'pt',
    'pt-pt': 'pt',
    zh: 'zh',
    'zh-cn': 'zh',
    'zh-sg': 'zh',
    'zh-hans': 'zh',
    'zh-tw': 'zh',
    'zh-hk': 'zh',
    'zh-hant': 'zh',
  };

  const exact = aliases[normalized];
  if (exact) return exact;

  const base = normalized.split('-')[0];
  return SUPPORTED_LOCALES.includes(base as SupportedLocale) ? (base as SupportedLocale) : null;
}

function clampInt(value: number, min: number, max: number): number {
  const rounded = Math.round(value);
  return Math.min(max, Math.max(min, rounded));
}

async function respondWithDelay(
  startedAt: number,
  res: Response,
  status: number,
  body: Record<string, unknown>
): Promise<void> {
  const elapsed = Date.now() - startedAt;
  const remaining = MIN_RESPONSE_DELAY_MS - elapsed;
  if (remaining > 0) {
    await sleep(remaining);
  }
  res.status(status).json(body);
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function buildDailyRoutine(averageScore: number, now: Date, locale: SupportedLocale): {
  date: string;
  locale: SupportedLocale;
  average_score: number;
  protocol: RoutineProtocol;
  variant: WeekdayVariant;
  title: string;
  duration_minutes: number;
  video_url: string;
} {
  const weekday = now.getUTCDay();
  const date = now.toISOString().slice(0, 10);

  const protocol: RoutineProtocol =
    averageScore >= 70
      ? 'lymphatic_deep_drainage'
      : averageScore >= 40
        ? 'standard_drainage'
        : 'quick_sculpt';

  const weekdayVariants: readonly WeekdayVariant[] = [
    'reset',
    'boost',
    'sculpt',
    'release',
    'balance',
    'deep',
    'restore',
  ];
  const weekdayVariant = weekdayVariants[weekday] ?? 'reset';

  const durationMinutes = protocol === 'lymphatic_deep_drainage' ? 12 : protocol === 'standard_drainage' ? 9 : 6;
  const protocolTitle = ROUTINE_PROTOCOL_TITLES[locale][protocol];
  const variantTitle = ROUTINE_VARIANT_TITLES[locale][weekdayVariant];

  return {
    date,
    locale,
    average_score: averageScore,
    protocol,
    variant: weekdayVariant,
    title: `${protocolTitle} - ${variantTitle}`,
    duration_minutes: durationMinutes,
    video_url: `${ROUTINE_CDN_BASE_URL}/${protocol}/${weekdayVariant}.mp4`,
  };
}

async function ensureTmpDirectory(): Promise<void> {
  await fs.mkdir(TMP_SCAN_DIR, { recursive: true });
}

function startTempCleanupJob(): void {
  const interval = setInterval(async () => {
    try {
      const entries = await fs.readdir(TMP_SCAN_DIR, { withFileTypes: true });
      const cutoff = Date.now() - CLEANUP_INTERVAL_MS;
      await Promise.all(
        entries
          .filter((entry) => entry.isFile())
          .map(async (entry) => {
            const fullPath = path.join(TMP_SCAN_DIR, entry.name);
            const stats = await fs.stat(fullPath);
            if (stats.mtimeMs <= cutoff) {
              await fs.unlink(fullPath);
            }
          })
      );
    } catch (error) {
      console.error('Temp scan cleanup failed:', error);
    }
  }, CLEANUP_INTERVAL_MS);

  interval.unref();
}
