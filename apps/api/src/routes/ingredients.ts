import { Elysia } from 'elysia';
import type { CreateIngredientDto, Ingredient, IngredientSummary } from '@mealplanner/shared';
import { supabase } from '../supabase';
import { authMiddleware } from '../middleware/auth';
import { fetchIngredientCatalog, getIngredientCatalogItem } from '../services/ingredientCatalog';
import { ingredientSchemas } from '../schemas';
import { daysUntil, parseMonthRange } from '../lib/dates';
import { assertQuantityRange, type IngredientRow, toIngredient } from '../lib/ingredients';
import { fail, ok } from '../lib/responses';

const withCatalog = async (ingredient: Ingredient): Promise<IngredientSummary> => ({
  ...ingredient,
  item: await getIngredientCatalogItem(ingredient.itemCode)
});

const ensureQuantityRange = (
  set: { status?: unknown },
  totalQuantity: number | undefined,
  remainingQuantity: number | undefined
) => {
  if (assertQuantityRange(totalQuantity, remainingQuantity)) return undefined;

  return fail(
    set,
    400,
    'INVALID_QUANTITY_RANGE',
    'remainingQuantity must be less than or equal to totalQuantity.'
  );
};

const getOwnedIngredient = async (userId: string, ingredientId: string) => {
  const { data, error } = await supabase
    .from('ingredients')
    .select('*')
    .eq('id', ingredientId)
    .eq('user_id', userId)
    .maybeSingle();

  return { data: data as IngredientRow | null, error };
};

export const ingredientRoutes = new Elysia({ prefix: '/api/ingredients', tags: ['Ingredients'] })
  .use(authMiddleware)

  .get('/catalog', async ({ query, set }) => {
    try {
      const page = await fetchIngredientCatalog({
        query: query.query,
        itemCode: query.itemCode,
        page: query.page,
        pageSize: query.pageSize
      });

      return ok(page);
    } catch (error) {
      return fail(set, 502, 'INGREDIENT_API_ERROR', 'Failed to fetch ingredient catalog.', error);
    }
  }, {
    query: ingredientSchemas.catalogQuery,
    detail: {
      tags: ['Ingredients'],
      summary: 'Search the ingredient catalog',
      description: 'Looks up normalized ingredient and price metadata from the external agromarket API.'
    }
  })

  .get('/catalog/:itemCode', async ({ params, set }) => {
    try {
      const item = await getIngredientCatalogItem(params.itemCode);
      if (!item) return fail(set, 404, 'CATALOG_ITEM_NOT_FOUND', 'Ingredient catalog item not found.');

      return ok(item);
    } catch (error) {
      return fail(set, 502, 'INGREDIENT_API_ERROR', 'Failed to fetch ingredient catalog item.', error);
    }
  }, {
    detail: {
      tags: ['Ingredients'],
      summary: 'Get one catalog item by item code'
    }
  })

  .get('/', async (ctx: any) => {
    const { query, user, set } = ctx;
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
    const result = query.includeCatalog
      ? await Promise.all(ingredients.map(withCatalog))
      : ingredients;

    return ok(result);
  }, {
    query: ingredientSchemas.listQuery,
    detail: {
      tags: ['Ingredients'],
      summary: 'List active user ingredients'
    }
  })

  .post('/', async (ctx: any) => {
    const { body, user, set } = ctx;
    const dto = body as CreateIngredientDto;
    const remainingQuantity = dto.remainingQuantity ?? dto.totalQuantity;
    const quantityError = ensureQuantityRange(set, dto.totalQuantity, remainingQuantity);
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
    return ok(toIngredient(data as IngredientRow));
  }, {
    body: ingredientSchemas.createBody,
    detail: {
      tags: ['Ingredients'],
      summary: 'Create a user ingredient'
    }
  })

  .patch('/:id', async (ctx: any) => {
    const { params, body, user, set } = ctx;
    const existing = await getOwnedIngredient(user.id, params.id);
    if (existing.error) return fail(set, 500, 'INGREDIENT_LOOKUP_FAILED', existing.error.message);
    if (!existing.data) return fail(set, 404, 'INGREDIENT_NOT_FOUND', 'Ingredient not found.');

    const current = toIngredient(existing.data);
    const nextTotalQuantity = body.totalQuantity ?? current.totalQuantity;
    const nextRemainingQuantity = body.remainingQuantity ?? current.remainingQuantity;
    const quantityError = ensureQuantityRange(set, nextTotalQuantity, nextRemainingQuantity);
    if (quantityError) return quantityError;

    const patch: Record<string, unknown> = {};
    if (body.expiresAt !== undefined) patch.expired_at = body.expiresAt;
    if (body.totalQuantity !== undefined) patch.quantity = body.totalQuantity;
    if (body.remainingQuantity !== undefined) patch.remaining_quantity = body.remainingQuantity;

    // Consumption state is derived from remaining quantity so clients only send one source of truth.
    patch.is_consumed = nextRemainingQuantity <= 0;

    const { data, error } = await supabase
      .from('ingredients')
      .update(patch)
      .eq('id', params.id)
      .eq('user_id', user.id)
      .select()
      .single();

    if (error) return fail(set, 500, 'INGREDIENT_UPDATE_FAILED', error.message);
    return ok(toIngredient(data as IngredientRow));
  }, {
    body: ingredientSchemas.updateBody,
    detail: {
      tags: ['Ingredients'],
      summary: 'Update a user ingredient'
    }
  })

  .post('/:id/consume', async (ctx: any) => {
    const { params, body, user, set } = ctx;
    const existing = await getOwnedIngredient(user.id, params.id);
    if (existing.error) return fail(set, 500, 'INGREDIENT_LOOKUP_FAILED', existing.error.message);
    if (!existing.data) return fail(set, 404, 'INGREDIENT_NOT_FOUND', 'Ingredient not found.');

    const current = toIngredient(existing.data);
    const quantityError = ensureQuantityRange(set, current.totalQuantity, body.remainingQuantity);
    if (quantityError) return quantityError;

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
    return ok(toIngredient(data as IngredientRow));
  }, {
    body: ingredientSchemas.consumeBody,
    detail: {
      tags: ['Ingredients'],
      summary: 'Set the remaining quantity after consumption'
    }
  })

  .get('/calendar', async (ctx: any) => {
    const { query, user, set } = ctx;
    const range = parseMonthRange(query.month);
    if (!range) return fail(set, 400, 'INVALID_MONTH', 'month must use YYYY-MM format.');

    const { data, error } = await supabase
      .from('ingredients')
      .select('*')
      .eq('user_id', user.id)
      .gte('expired_at', range.startIso)
      .lt('expired_at', range.endIso)
      .order('expired_at', { ascending: true });

    if (error) return fail(set, 500, 'INGREDIENT_CALENDAR_FAILED', error.message);

    const calendar = ((data ?? []) as IngredientRow[]).map((row) => {
      const ingredient = toIngredient(row);
      const daysLeft = daysUntil(ingredient.expiresAt);

      return {
        id: ingredient.id,
        itemCode: ingredient.itemCode,
        expiresAt: ingredient.expiresAt,
        remainingQuantity: ingredient.remainingQuantity,
        status: daysLeft <= 2 ? 'red' : daysLeft <= 7 ? 'yellow' : 'green'
      };
    });

    return ok(calendar);
  }, {
    query: ingredientSchemas.calendarQuery,
    detail: {
      tags: ['Ingredients'],
      summary: 'List ingredients expiring in a calendar month'
    }
  })

  .get('/shop-links', async ({ query }) => {
    const encoded = encodeURIComponent(query.name);
    return ok({
      coupang: `https://www.coupang.com/np/search?q=${encoded}`,
      naver: `https://search.shopping.naver.com/search/all?query=${encoded}`,
      kurly: `https://www.kurly.com/search?sword=${encoded}`,
      ssg: `https://www.ssg.com/search.ssg?query=${encoded}`
    });
  }, {
    query: ingredientSchemas.shopLinksQuery,
    detail: {
      tags: ['Ingredients'],
      summary: 'Create shopping search links for an ingredient name'
    }
  })

  .get('/:id', async (ctx: any) => {
    const { params, query, user, set } = ctx;
    const { data, error } = await supabase
      .from('ingredients')
      .select('*')
      .eq('id', params.id)
      .eq('user_id', user.id)
      .maybeSingle();

    if (error) return fail(set, 500, 'INGREDIENT_LOOKUP_FAILED', error.message);
    if (!data) return fail(set, 404, 'INGREDIENT_NOT_FOUND', 'Ingredient not found.');

    const ingredient = toIngredient(data as IngredientRow);
    const result = query.includeCatalog ? await withCatalog(ingredient) : ingredient;
    return ok(result);
  }, {
    query: ingredientSchemas.detailQuery,
    detail: {
      tags: ['Ingredients'],
      summary: 'Get one user ingredient'
    }
  });
