import { getEnv } from '../env';

type ChatContent =
  | string
  | Array<
      | { type: 'text'; text: string }
      | { type: 'image_url'; image_url: { url: string } }
    >;

interface ChatCompletionResponse {
  choices?: Array<{
    message?: {
      content?: unknown;
    };
  }>;
  error?: {
    message?: string;
  };
}

export interface ParsedIngredient {
  name: string;
  expiryDays: number;
}

export interface ConsumptionImageAnalysis {
  consumedRatio: number;
  remainingRatio: number;
}

export interface MealPhotoAnalysis {
  foodName: string;
  isUnhealthy: boolean;
  isRecommendedRecipe: boolean;
  reason: string;
}

export class LlmError extends Error {
  constructor(
    message: string,
    readonly code: string,
    readonly details?: unknown
  ) {
    super(message);
    this.name = 'LlmError';
  }
}

const DEFAULT_MODEL = 'google/gemini-flash-1.5';
const DEFAULT_TIMEOUT_MS = 20_000;
const OPENROUTER_URL = 'https://openrouter.ai/api/v1/chat/completions';

const getModel = () => getEnv('OPENROUTER_MODEL') ?? DEFAULT_MODEL;

const getTimeoutMs = () => {
  const parsed = Number(getEnv('OPENROUTER_TIMEOUT_MS'));
  return Number.isFinite(parsed) && parsed > 0 ? parsed : DEFAULT_TIMEOUT_MS;
};

const compact = (value: unknown) => String(value ?? '').trim();

const clamp01 = (value: unknown) => {
  const number = Number(value);
  if (!Number.isFinite(number)) {
    throw new LlmError('LLM returned a non-numeric ratio.', 'LLM_SCHEMA_ERROR', value);
  }

  return Math.max(0, Math.min(1, number));
};

const asDataImageUrl = (base64Image: string) => {
  const trimmed = base64Image.trim();
  if (trimmed.startsWith('data:image/')) return trimmed;

  return `data:image/jpeg;base64,${trimmed}`;
};

const extractTextContent = (payload: ChatCompletionResponse) => {
  const content = payload.choices?.[0]?.message?.content;
  if (typeof content === 'string') return content;
  if (Array.isArray(content)) {
    return content
      .map((part) => typeof part === 'object' && part && 'text' in part ? compact(part.text) : '')
      .filter(Boolean)
      .join('\n');
  }

  throw new LlmError('LLM response did not include text content.', 'LLM_EMPTY_RESPONSE', payload);
};

const stripJsonFence = (value: string) =>
  value
    .trim()
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/\s*```$/i, '')
    .trim();

const pickJsonCandidate = (value: string) => {
  const cleaned = stripJsonFence(value);
  const objectStart = cleaned.indexOf('{');
  const arrayStart = cleaned.indexOf('[');
  const starts = [objectStart, arrayStart].filter((index) => index >= 0);
  if (starts.length === 0) return cleaned;

  const start = Math.min(...starts);
  const opener = cleaned[start];
  const closer = opener === '[' ? ']' : '}';
  const end = cleaned.lastIndexOf(closer);

  return end > start ? cleaned.slice(start, end + 1) : cleaned;
};

const parseJson = (value: string) => {
  const candidate = pickJsonCandidate(value);
  try {
    return JSON.parse(candidate) as unknown;
  } catch (error) {
    throw new LlmError('LLM returned invalid JSON.', 'LLM_JSON_PARSE_ERROR', {
      content: value.slice(0, 500),
      error
    });
  }
};

const requestJson = async (content: ChatContent) => {
  const apiKey = getEnv('OPENROUTER_API_KEY');
  if (!apiKey) {
    throw new LlmError('OPENROUTER_API_KEY is not configured.', 'LLM_CONFIG_ERROR');
  }

  const timeout = getTimeoutMs();
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeout);

  try {
    const response = await fetch(OPENROUTER_URL, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': getEnv('WEB_ORIGIN')?.split(',')[0] ?? 'https://greeney.life',
        'X-Title': 'MealPlanner API'
      },
      body: JSON.stringify({
        model: getModel(),
        temperature: 0.1,
        response_format: { type: 'json_object' },
        messages: [
          {
            role: 'system',
            content: 'Return only valid JSON. Do not include markdown fences, comments, or extra prose.'
          },
          {
            role: 'user',
            content
          }
        ]
      }),
      signal: controller.signal
    });

    const text = await response.text();
    let payload: ChatCompletionResponse;
    try {
      payload = text ? JSON.parse(text) as ChatCompletionResponse : {};
    } catch {
      payload = {};
    }

    if (!response.ok) {
      throw new LlmError('LLM provider request failed.', 'LLM_PROVIDER_ERROR', {
        status: response.status,
        message: payload.error?.message ?? text.slice(0, 500)
      });
    }

    return parseJson(extractTextContent(payload));
  } catch (error) {
    if (error instanceof LlmError) throw error;
    if (error instanceof DOMException && error.name === 'AbortError') {
      throw new LlmError('LLM provider request timed out.', 'LLM_TIMEOUT', { timeout });
    }

    throw new LlmError('LLM provider request failed.', 'LLM_REQUEST_ERROR', error);
  } finally {
    clearTimeout(timer);
  }
};

const ensureRecord = (value: unknown) => {
  if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }

  throw new LlmError('LLM returned an unexpected JSON shape.', 'LLM_SCHEMA_ERROR', value);
};

const normalizeIngredient = (value: unknown): ParsedIngredient => {
  const item = ensureRecord(value);
  const name = compact(item.name);
  const expiryDays = Math.ceil(Number(item.expiryDays ?? item.expiry_days ?? item.days));

  if (!name || !Number.isFinite(expiryDays) || expiryDays < 0) {
    throw new LlmError('LLM returned an invalid ingredient item.', 'LLM_SCHEMA_ERROR', item);
  }

  return {
    name,
    expiryDays: Math.min(expiryDays, 3650)
  };
};

export const parseIngredientsFromScan = async (
  type: 'OCR' | 'VOICE',
  payload: string
): Promise<ParsedIngredient[]> => {
  const instruction = type === 'OCR'
    ? 'Extract food product names and estimated expiry days from this receipt OCR text.'
    : 'Extract food product names and estimated expiry days from this voice transcript.';

  const result = await requestJson(`${instruction}

Return this exact JSON shape:
{"items":[{"name":"ingredient name","expiryDays":3}]}

Rules:
- name must be a concise Korean or product name.
- expiryDays is the number of days from today until the item should expire.
- If no valid food item is found, return {"items":[]}.

Input:
${payload}`);

  const record = ensureRecord(result);
  const items = Array.isArray(record.items) ? record.items : Array.isArray(result) ? result : undefined;
  if (!items) {
    throw new LlmError('LLM ingredient response is missing items.', 'LLM_SCHEMA_ERROR', result);
  }

  return items.map(normalizeIngredient);
};

export const analyzeConsumptionImage = async (
  base64Image: string
): Promise<ConsumptionImageAnalysis> => {
  const result = await requestJson([
    {
      type: 'image_url',
      image_url: { url: asDataImageUrl(base64Image) }
    },
    {
      type: 'text',
      text: `Analyze how much of the food ingredient has been consumed.

Return this exact JSON shape:
{"consumed_ratio":0.7,"remaining_ratio":0.3}

Rules:
- Ratios must be numbers from 0 to 1.
- consumed_ratio + remaining_ratio should be close to 1.
- If uncertain, make a conservative visual estimate.`
    }
  ]);

  const record = ensureRecord(result);
  let consumedRatio = clamp01(record.consumed_ratio ?? record.consumedRatio);
  let remainingRatio = clamp01(record.remaining_ratio ?? record.remainingRatio);
  const total = consumedRatio + remainingRatio;

  if (total > 0) {
    consumedRatio /= total;
    remainingRatio /= total;
  }

  return { consumedRatio, remainingRatio };
};

export const analyzeMealPhoto = async (
  base64Image: string,
  recommendedRecipeName?: string
): Promise<MealPhotoAnalysis> => {
  const result = await requestJson([
    {
      type: 'image_url',
      image_url: { url: asDataImageUrl(base64Image) }
    },
    {
      type: 'text',
      text: `Analyze the meal photo for Greeney's character HP system.

Return this exact JSON shape:
{"food_name":"food name","is_unhealthy":false,"is_recommended_recipe":false,"reason":"short reason"}

Rules:
- is_unhealthy is true for fast food, fried junk food, candy/snacks, soda, or clearly unhealthy meals.
- is_recommended_recipe is true only when the photo appears to match this recommended recipe: "${recommendedRecipeName ?? ''}".
- If no recommended recipe was provided, is_recommended_recipe must be false.
- If is_unhealthy is true, is_recommended_recipe must be false.
- reason must be one short Korean sentence.`
    }
  ]);

  const record = ensureRecord(result);
  const foodName = compact(record.food_name ?? record.foodName);
  const isUnhealthy = Boolean(record.is_unhealthy ?? record.isUnhealthy);
  const isRecommendedRecipe = isUnhealthy
    ? false
    : Boolean(record.is_recommended_recipe ?? record.isRecommendedRecipe);
  const reason = compact(record.reason);

  if (!foodName || !reason) {
    throw new LlmError('LLM meal response is missing required fields.', 'LLM_SCHEMA_ERROR', result);
  }

  return {
    foodName,
    isUnhealthy,
    isRecommendedRecipe,
    reason
  };
};
