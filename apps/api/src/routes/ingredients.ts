import { Elysia, t } from 'elysia';
import type { CreateIngredientDto, Ingredient, IngredientSummary } from '@mealplanner/shared';
import { supabase } from '../supabase';
import { authMiddleware } from '../middleware/auth';
import { fetchIngredientCatalog, getIngredientCatalogItem } from '../services/ingredientCatalog';

type IngredientRow = {
  id: string;
  user_id: string;
  item_code: string;
  expires_at?: string;
  expired_at?: string;
  total_quantity?: number;
  quantity?: number;
  remaining_quantity?: number;
  is_consumed?: boolean;
  created_at: string;
  updated_at?: string;
};

const toIngredient = (row: IngredientRow): Ingredient => {
  const totalQuantity = Number(row.total_quantity ?? row.quantity ?? 1);
  const remainingQuantity = Number(row.remaining_quantity ?? (row.is_consumed ? 0 : totalQuantity));

  return {
    id: row.id,
    userId: row.user_id,
    itemCode: row.item_code,
    expiresAt: row.expires_at ?? row.expired_at ?? '',
    totalQuantity,
    remainingQuantity,
    createdAt: row.created_at,
    updatedAt: row.updated_at ?? row.created_at
  };
};

const withCatalog = async (ingredient: Ingredient): Promise<IngredientSummary> => ({
  ...ingredient,
  item: await getIngredientCatalogItem(ingredient.itemCode)
});

const fail = (set: any, status: number, code: string, message: string, details?: unknown) => {
  set.status = status;
  return { success: false, error: { code, message, details } };
};

const validateQuantity = (set: any, value: number) => {
  if (value < 0) {
    return fail(set, 400, 'INVALID_QUANTITY', 'Quantity must be greater than or equal to 0.');
  }
};

export const ingredientRoutes = new Elysia({ prefix: '/api/ingredients' })
  .use(authMiddleware)

  .get('/catalog', async ({ query, set }) => {
    try {
      const page = await fetchIngredientCatalog({
        query: query.query,
        itemCode: query.itemCode,
        page: query.page ? Number(query.page) : undefined,
        pageSize: query.pageSize ? Number(query.pageSize) : undefined
      });

      return { success: true, data: page };
    } catch (error) {
      return fail(set, 502, 'INGREDIENT_API_ERROR', 'Failed to fetch ingredient catalog.', error);
    }
  }, {
    query: t.Object({
      query: t.Optional(t.String()),
      itemCode: t.Optional(t.String()),
      page: t.Optional(t.Numeric()),
      pageSize: t.Optional(t.Numeric())
    })
  })

  .get('/catalog/:itemCode', async ({ params, set }) => {
    try {
      const item = await getIngredientCatalogItem(params.itemCode);
      if (!item) return fail(set, 404, 'CATALOG_ITEM_NOT_FOUND', 'Ingredient catalog item not found.');
      return { success: true, data: item };
    } catch (error) {
      return fail(set, 502, 'INGREDIENT_API_ERROR', 'Failed to fetch ingredient catalog item.', error);
    }
  })

  .get('/', async (ctx: any) => {
    const { query, user, set } = ctx;
    const includeCatalog = query.includeCatalog === 'true';
    let request = supabase
      .from('ingredients')
      .select('*')
      .eq('user_id', user.id)
      .eq('is_consumed', false)
      .order('expired_at', { ascending: true });

    if (query.expiringBefore) {
      request = request.lte('expired_at', query.expiringBefore);
    }

    const { data, error } = await request;
    if (error) return fail(set, 500, 'INGREDIENT_LIST_FAILED', error.message);

    const ingredients = ((data ?? []) as IngredientRow[]).map(toIngredient);
    const result = includeCatalog
      ? await Promise.all(ingredients.map(withCatalog))
      : ingredients;

    return { success: true, data: result };
  }, {
    query: t.Object({
      includeCatalog: t.Optional(t.String()),
      expiringBefore: t.Optional(t.String())
    })
  })

  .post('/', async (ctx: any) => {
    const { body, user, set } = ctx;
    const dto = body as CreateIngredientDto;
    const remainingQuantity = dto.remainingQuantity ?? dto.totalQuantity;
    const quantityError = validateQuantity(set, dto.totalQuantity) ?? validateQuantity(set, remainingQuantity);
    if (quantityError) return quantityError;

    const { data, error } = await supabase
      .from('ingredients')
      .insert([{
        item_code: dto.itemCode,
        expired_at: dto.expiresAt,
        quantity: dto.totalQuantity,
        remaining_quantity: remainingQuantity,
        is_consumed: remainingQuantity <= 0,
        user_id: user.id
      }])
      .select()
      .single();

    if (error) return fail(set, 500, 'INGREDIENT_CREATE_FAILED', error.message);
    return { success: true, data: toIngredient(data as IngredientRow) };
  }, {
    body: t.Object({
      itemCode: t.String(),
      expiresAt: t.String(),
      totalQuantity: t.Number({ minimum: 0 }),
      remainingQuantity: t.Optional(t.Number({ minimum: 0 }))
    })
  })

  .patch('/:id', async (ctx: any) => {
    const { params, body, user, set } = ctx;
    const patch: Record<string, unknown> = {};
    if (body.expiresAt !== undefined) patch.expired_at = body.expiresAt;
    if (body.totalQuantity !== undefined) patch.quantity = body.totalQuantity;
    if (body.remainingQuantity !== undefined) patch.remaining_quantity = body.remainingQuantity;
    if (body.remainingQuantity !== undefined) patch.is_consumed = body.remainingQuantity <= 0;

    const { data, error } = await supabase
      .from('ingredients')
      .update(patch)
      .eq('id', params.id)
      .eq('user_id', user.id)
      .select()
      .single();

    if (error) return fail(set, 500, 'INGREDIENT_UPDATE_FAILED', error.message);
    return { success: true, data: toIngredient(data as IngredientRow) };
  }, {
    body: t.Object({
      expiresAt: t.Optional(t.String()),
      totalQuantity: t.Optional(t.Number({ minimum: 0 })),
      remainingQuantity: t.Optional(t.Number({ minimum: 0 }))
    })
  })

  .post('/:id/consume', async (ctx: any) => {
    const { params, body, user, set } = ctx;
    const { data, error } = await supabase
      .from('ingredients')
      .update({
        remaining_quantity: body.remainingQuantity,
        is_consumed: body.remainingQuantity <= 0
      })
      .eq('id', params.id)
      .eq('user_id', user.id)
      .select()
      .single();

    if (error) return fail(set, 500, 'INGREDIENT_CONSUME_FAILED', error.message);
    return { success: true, data: toIngredient(data as IngredientRow) };
  }, {
    body: t.Object({
      remainingQuantity: t.Number({ minimum: 0 })
    })
  })

  .get('/calendar', async (ctx: any) => {
    const { query, user, set } = ctx;
    const startDate = new Date(`${query.month}-01`).toISOString();
    const end = new Date(`${query.month}-01`);
    end.setMonth(end.getMonth() + 1);

    const { data, error } = await supabase
      .from('ingredients')
      .select('*')
      .eq('user_id', user.id)
      .gte('expired_at', startDate)
      .lt('expired_at', end.toISOString())
      .order('expired_at', { ascending: true });

    if (error) return fail(set, 500, 'INGREDIENT_CALENDAR_FAILED', error.message);

    const calendar = ((data ?? []) as IngredientRow[]).map((row) => {
      const ingredient = toIngredient(row);
      const daysLeft = Math.ceil((new Date(ingredient.expiresAt).getTime() - Date.now()) / 86400000);
      return {
        id: ingredient.id,
        itemCode: ingredient.itemCode,
        expiresAt: ingredient.expiresAt,
        remainingQuantity: ingredient.remainingQuantity,
        status: daysLeft <= 2 ? 'red' : daysLeft <= 7 ? 'yellow' : 'green'
      };
    });

    return { success: true, data: calendar };
  }, {
    query: t.Object({
      month: t.String()
    })
  })

  .get('/shop-links', async ({ query }) => {
    const encoded = encodeURIComponent(query.name);
    return {
      success: true,
      data: {
        coupang: `https://www.coupang.com/np/search?q=${encoded}`,
        naver: `https://search.shopping.naver.com/search/all?query=${encoded}`,
        kurly: `https://www.kurly.com/search?sword=${encoded}`,
        ssg: `https://www.ssg.com/search.ssg?query=${encoded}`
      }
    };
  }, {
    query: t.Object({
      name: t.String()
    })
  })

  .get('/:id', async (ctx: any) => {
    const { params, query, user, set } = ctx;
    const { data, error } = await supabase
      .from('ingredients')
      .select('*')
      .eq('id', params.id)
      .eq('user_id', user.id)
      .single();

    if (error) return fail(set, 404, 'INGREDIENT_NOT_FOUND', error.message);

    const ingredient = toIngredient(data as IngredientRow);
    const result = query.includeCatalog === 'true' ? await withCatalog(ingredient) : ingredient;
    return { success: true, data: result };
  }, {
    query: t.Object({
      includeCatalog: t.Optional(t.String())
    })
  });
