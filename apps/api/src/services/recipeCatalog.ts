import type { Recipe } from '@mealplanner/shared';

type FoodSafetyRecipeRow = Record<string, string | undefined>;

interface FoodSafetyRecipeResponse {
  COOKRCP01?: {
    total_count?: string;
    row?: FoodSafetyRecipeRow[];
    RESULT?: {
      CODE?: string;
      MSG?: string;
    };
  };
}

const DEFAULT_BASE_URL = 'https://openapi.foodsafetykorea.go.kr/api';

const compact = (value: unknown) => String(value ?? '').trim();

const toNumber = (value: unknown) => {
  const parsed = Number(String(value ?? '').replace(/,/g, ''));
  return Number.isFinite(parsed) ? parsed : undefined;
};

const normalizeManual = (step: string) => step.replace(/[a-z]$/i, '').trim();

export class RecipeCatalogError extends Error {
  constructor(message: string, readonly details?: unknown) {
    super(message);
  }
}

const normalizeRecipe = (row: FoodSafetyRecipeRow): Recipe => {
  const steps = Array.from({ length: 20 }, (_, index) => {
    const suffix = String(index + 1).padStart(2, '0');
    const description = compact(row[`MANUAL${suffix}`]);
    if (!description) return undefined;

    return {
      order: index + 1,
      description: normalizeManual(description),
      imageUrl: compact(row[`MANUAL_IMG${suffix}`]) || undefined
    };
  }).filter((step): step is NonNullable<typeof step> => Boolean(step));

  const ingredientText = compact(row.RCP_PARTS_DTLS);

  return {
    id: compact(row.RCP_SEQ),
    name: compact(row.RCP_NM),
    ingredientText,
    ingredientNames: extractIngredientNames(ingredientText),
    cookingMethod: compact(row.RCP_WAY2) || undefined,
    dishType: compact(row.RCP_PAT2) || undefined,
    hashTag: compact(row.HASH_TAG) || undefined,
    imageUrl: compact(row.ATT_FILE_NO_MK) || undefined,
    thumbnailUrl: compact(row.ATT_FILE_NO_MAIN) || undefined,
    tip: compact(row.RCP_NA_TIP) || undefined,
    nutrition: {
      calories: toNumber(row.INFO_ENG),
      carbohydrate: toNumber(row.INFO_CAR),
      protein: toNumber(row.INFO_PRO),
      fat: toNumber(row.INFO_FAT),
      sodium: toNumber(row.INFO_NA),
      weight: toNumber(row.INFO_WGT)
    },
    steps
  };
};

export const extractIngredientNames = (ingredientText: string) => {
  const stopWords = new Set([
    '고명',
    '소스',
    '양념',
    '양념장',
    '드레싱',
    '물',
    '소금',
    '식초',
    '후추',
    '약간',
    '재료',
    '준비'
  ]);

  const names = ingredientText
    .replace(/[·&]/g, '\n')
    .split(/[\n,]/)
    .map((part) =>
      part
        .replace(/\([^)]*\)/g, '')
        .replace(/[0-9./×~\-]+/g, ' ')
        .replace(/\b(g|kg|ml|l|개|컵|큰술|작은술|줄기|마리|모|봉지|쪽|cm)\b/gi, ' ')
        .trim()
        .split(/\s+/)[0]
    )
    .map((name) => name.replace(/[^\p{L}]/gu, '').trim())
    .filter((name) => name.length >= 2 && !stopWords.has(name));

  return [...new Set(names)];
};

export const fetchRecipePage = async (start = 1, end = 1000) => {
  const key = Bun.env.RECIPE_API_KEY;
  if (!key) {
    throw new RecipeCatalogError('RECIPE_API_KEY is not configured');
  }

  const baseUrl = (Bun.env.RECIPE_API_BASE_URL || DEFAULT_BASE_URL).replace(/\/$/, '');
  const url = `${baseUrl}/${key}/COOKRCP01/json/${start}/${end}`;
  const response = await fetch(url);
  if (!response.ok) {
    throw new RecipeCatalogError(`Recipe API request failed: ${response.status}`);
  }

  const payload = (await response.json()) as FoodSafetyRecipeResponse;
  const result = payload.COOKRCP01?.RESULT;
  if (result?.CODE && result.CODE !== 'INFO-000') {
    throw new RecipeCatalogError(result.MSG || 'Recipe API returned an error', result);
  }

  return {
    items: (payload.COOKRCP01?.row ?? []).map(normalizeRecipe),
    totalCount: toNumber(payload.COOKRCP01?.total_count) ?? payload.COOKRCP01?.row?.length ?? 0
  };
};

export const fetchRecipes = async (start = 1, end = 1000) => {
  const page = await fetchRecipePage(start, end);
  return page.items;
};
