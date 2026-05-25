import type { IngredientCatalogItem, IngredientCatalogSearchParams } from '@mealplanner/shared';

interface EcoFriendlyPriceRow {
  exmn_ymd?: string;
  ctgry_nm?: string;
  item_cd?: string;
  item_nm?: string;
  vrty_nm?: string;
  grd_nm?: string;
  sgg_nm?: string;
  unit?: string;
  unit_sz?: string;
  mrkt_nm?: string;
  exmn_dd_prc?: string;
  exmn_dd_cnvs_prc?: string;
}

interface EcoFriendlyPriceResponse {
  response?: {
    header?: {
      resultCode?: string;
      resultMsg?: string;
    };
    body?: {
      items?: {
        item?: EcoFriendlyPriceRow | EcoFriendlyPriceRow[];
      };
      pageNo?: number;
      numOfRows?: number;
      totalCount?: number;
    };
  };
}

const DEFAULT_BASE_URL = 'https://api.agromarket.kr/api/ecoFriendly/v1/price';
const DEFAULT_LOOKBACK_DAYS = 210;

const compact = (value: unknown) => String(value ?? '').trim();

const toNumber = (value: unknown) => {
  const parsed = Number(String(value ?? '').replace(/,/g, ''));
  return Number.isFinite(parsed) ? parsed : undefined;
};

const formatDate = (date: Date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}${month}${day}`;
};

const normalizeRow = (row: EcoFriendlyPriceRow): IngredientCatalogItem => ({
  itemCode: compact(row.item_cd),
  name: compact(row.item_nm),
  variety: compact(row.vrty_nm) || undefined,
  category: compact(row.ctgry_nm) || undefined,
  unit: compact(row.unit) || undefined,
  unitSize: compact(row.unit_sz) || undefined,
  grade: compact(row.grd_nm) || undefined,
  market: compact(row.mrkt_nm) || undefined,
  region: compact(row.sgg_nm) || undefined,
  surveyedAt: compact(row.exmn_ymd) || undefined,
  price: toNumber(row.exmn_dd_prc),
  convertedPrice: toNumber(row.exmn_dd_cnvs_prc)
});

const uniqueByItemCode = (items: IngredientCatalogItem[]) => {
  const map = new Map<string, IngredientCatalogItem>();
  for (const item of items) {
    if (!item.itemCode || map.has(item.itemCode)) continue;
    map.set(item.itemCode, item);
  }
  return [...map.values()];
};

export class IngredientCatalogError extends Error {
  constructor(message: string, readonly details?: unknown) {
    super(message);
  }
}

export const fetchIngredientCatalog = async (
  params: IngredientCatalogSearchParams = {}
) => {
  const serviceKey = Bun.env.INGREDIENT_API_KEY;
  if (!serviceKey) {
    throw new IngredientCatalogError('INGREDIENT_API_KEY is not configured');
  }

  const page = params.page ?? 1;
  const pageSize = Math.min(params.pageSize ?? 1000, 1000);
  const to = new Date();
  const from = new Date(to);
  from.setDate(to.getDate() - DEFAULT_LOOKBACK_DAYS);

  const url = new URL(Bun.env.INGREDIENT_API_BASE_URL || DEFAULT_BASE_URL);
  url.searchParams.set('serviceKey', serviceKey);
  url.searchParams.set('pageNo', String(page));
  url.searchParams.set('numOfRows', String(pageSize));
  url.searchParams.set('returnType', 'JSON');
  url.searchParams.set('cond[exmn_ymd::GTE]', Bun.env.INGREDIENT_API_FROM_DATE || formatDate(from));
  url.searchParams.set('cond[exmn_ymd::LTE]', Bun.env.INGREDIENT_API_TO_DATE || formatDate(to));
  if (params.itemCode) url.searchParams.set('cond[item_cd::EQ]', params.itemCode);

  const response = await fetch(url);
  if (!response.ok) {
    throw new IngredientCatalogError(`Ingredient API request failed: ${response.status}`);
  }

  const payload = (await response.json()) as EcoFriendlyPriceResponse;
  const header = payload.response?.header;
  if (header?.resultCode && header.resultCode !== '0') {
    throw new IngredientCatalogError(header.resultMsg || 'Ingredient API returned an error', header);
  }

  const rawItems = payload.response?.body?.items?.item ?? [];
  const rows = Array.isArray(rawItems) ? rawItems : [rawItems];
  const normalized = uniqueByItemCode(rows.map(normalizeRow));
  const query = compact(params.query).toLocaleLowerCase('ko-KR');
  const items = query
    ? normalized.filter((item) =>
        [item.name, item.variety, item.category].some((value) =>
          compact(value).toLocaleLowerCase('ko-KR').includes(query)
        )
      )
    : normalized;

  return {
    items,
    page,
    pageSize,
    totalCount: payload.response?.body?.totalCount ?? items.length
  };
};

export const getIngredientCatalogItem = async (itemCode: string) => {
  const page = await fetchIngredientCatalog({ itemCode, pageSize: 1000 });
  return page.items.find((item) => item.itemCode === itemCode) ?? page.items[0];
};
