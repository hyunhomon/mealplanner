import { Elysia, t } from 'elysia';
import type { Ingredient, Recipe, RecipeRecommendation } from '@mealplanner/shared';
import { supabase } from '../supabase';
import { authMiddleware } from '../middleware/auth';
import { getIngredientCatalogItem } from '../services/ingredientCatalog';
import { fetchRecipes } from '../services/recipeCatalog';

type IngredientRow = {
  id: string;
  user_id: string;
  item_code: string;
  expires_at?: string;
  expired_at?: string;
  total_quantity?: number;
  quantity?: number;
  remaining_quantity?: number;
  created_at: string;
  updated_at?: string;
};

const toIngredient = (row: IngredientRow): Ingredient => ({
  id: row.id,
  userId: row.user_id,
  itemCode: row.item_code,
  expiresAt: row.expires_at ?? row.expired_at ?? '',
  totalQuantity: Number(row.total_quantity ?? row.quantity ?? 1),
  remainingQuantity: Number(row.remaining_quantity ?? row.quantity ?? 1),
  createdAt: row.created_at,
  updatedAt: row.updated_at ?? row.created_at
});

const compact = (value: unknown) => String(value ?? '').trim();

const fail = (set: any, status: number, code: string, message: string, details?: unknown) => {
  set.status = status;
  return { success: false, error: { code, message, details } };
};

const includesKorean = (text: string, needle: string) =>
  text.toLocaleLowerCase('ko-KR').includes(needle.toLocaleLowerCase('ko-KR'));

const daysUntil = (date: string) => Math.ceil((new Date(date).getTime() - Date.now()) / 86400000);

const scoreRecipe = (
  recipe: Recipe,
  ingredients: Ingredient[],
  ingredientNamesById: Map<string, string>,
  expiringWithinDays: number
): RecipeRecommendation | undefined => {
  const searchable = `${recipe.name}\n${recipe.ingredientText}\n${recipe.ingredientNames.join('\n')}`;
  const matched = ingredients.filter((ingredient) => {
    const name = ingredientNamesById.get(ingredient.id);
    return name ? includesKorean(searchable, name) : false;
  });

  if (matched.length === 0) return undefined;

  const matchedNames = matched
    .map((ingredient) => ingredientNamesById.get(ingredient.id))
    .filter((name): name is string => Boolean(name));
  const missingIngredientNames = recipe.ingredientNames.filter(
    (name) => !matchedNames.some((matchedName) => includesKorean(name, matchedName) || includesKorean(matchedName, name))
  );
  const matchScore = matched.length / Math.max(recipe.ingredientNames.length || matched.length, 1);
  const expiringSoonScore = matched.filter((ingredient) => daysUntil(ingredient.expiresAt) <= expiringWithinDays).length / matched.length;
  const score = matchScore * 0.8 + expiringSoonScore * 0.2;

  return {
    recipe,
    matchedIngredientIds: matched.map((ingredient) => ingredient.id),
    matchedIngredientNames: [...new Set(matchedNames)],
    missingIngredientNames,
    matchScore,
    expiringSoonScore,
    score
  };
};

export const recipeRoutes = new Elysia({ prefix: '/api/recipes' })
  .use(authMiddleware)

  .get('/', async ({ query, set }) => {
    try {
      const page = Number(query.page ?? 1);
      const pageSize = Number(query.pageSize ?? 50);
      const start = (page - 1) * pageSize + 1;
      const recipes = await fetchRecipes(start, start + pageSize - 1);
      return {
        success: true,
        data: {
          items: recipes,
          page,
          pageSize,
          totalCount: recipes.length
        }
      };
    } catch (error) {
      return fail(set, 502, 'RECIPE_API_ERROR', 'Failed to fetch recipes.', error);
    }
  }, {
    query: t.Object({
      page: t.Optional(t.Numeric()),
      pageSize: t.Optional(t.Numeric())
    })
  })

  .get('/recommend', async (ctx: any) => {
    const { query, user, set } = ctx;
    const limit = Number(query.limit ?? 10);
    const maxMissingIngredients = Number(query.maxMissingIngredients ?? 8);
    const expiringWithinDays = Number(query.expiringWithinDays ?? 3);

    const { data, error } = await supabase
      .from('ingredients')
      .select('*')
      .eq('user_id', user.id)
      .eq('is_consumed', false)
      .order('expired_at', { ascending: true });

    if (error) return fail(set, 500, 'INGREDIENT_LIST_FAILED', error.message);

    const ingredients = ((data ?? []) as IngredientRow[]).map(toIngredient);
    if (ingredients.length === 0) return { success: true, data: [] };

    try {
      const catalogItems = await Promise.all(
        ingredients.map(async (ingredient) => ({
          ingredient,
          item: await getIngredientCatalogItem(ingredient.itemCode)
        }))
      );
      const ingredientNamesById = new Map(
        catalogItems
          .map(({ ingredient, item }) => [ingredient.id, compact(item?.name)] as const)
          .filter(([, name]) => Boolean(name))
      );

      const recipes = await fetchRecipes(1, Number(Bun.env.RECIPE_RECOMMENDATION_SCAN_LIMIT ?? 1000));
      const recommendations = recipes
        .map((recipe) => scoreRecipe(recipe, ingredients, ingredientNamesById, expiringWithinDays))
        .filter((item): item is RecipeRecommendation => Boolean(item))
        .filter((item) => item.missingIngredientNames.length <= maxMissingIngredients)
        .sort((a, b) => b.score - a.score)
        .slice(0, limit);

      return { success: true, data: recommendations };
    } catch (error) {
      return fail(set, 502, 'RECIPE_API_ERROR', 'Failed to recommend recipes.', error);
    }
  }, {
    query: t.Object({
      limit: t.Optional(t.Numeric()),
      maxMissingIngredients: t.Optional(t.Numeric()),
      expiringWithinDays: t.Optional(t.Numeric())
    })
  });
