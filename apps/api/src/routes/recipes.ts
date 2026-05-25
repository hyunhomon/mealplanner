import { Elysia } from 'elysia';
import type { Ingredient, Recipe, RecipeRecommendation } from '@mealplanner/shared';
import { supabase } from '../supabase';
import { authMiddleware } from '../middleware/auth';
import { getIngredientCatalogItem } from '../services/ingredientCatalog';
import { fetchRecipePage, fetchRecipes } from '../services/recipeCatalog';
import { recipeSchemas } from '../schemas';
import { daysUntil } from '../lib/dates';
import { type IngredientRow, toIngredient } from '../lib/ingredients';
import { fail, ok } from '../lib/responses';
import { getEnv } from '../env';

const compact = (value: unknown) => String(value ?? '').trim();

const includesKorean = (text: string, needle: string) =>
  text.toLocaleLowerCase('ko-KR').includes(needle.toLocaleLowerCase('ko-KR'));

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

  // Current recommendation is intentionally simple: mostly ingredient match, with a small boost for expiring food.
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

export const recipeRoutes = new Elysia({ prefix: '/api/recipes', tags: ['Recipes'] })
  .use(authMiddleware)

  .get('/', async ({ query, set }) => {
    try {
      const page = query.page ?? 1;
      const pageSize = query.pageSize ?? 50;
      const start = (page - 1) * pageSize + 1;
      const recipePage = await fetchRecipePage(start, start + pageSize - 1);

      return ok({
        items: recipePage.items,
        page,
        pageSize,
        totalCount: recipePage.totalCount
      });
    } catch (error) {
      return fail(set, 502, 'RECIPE_API_ERROR', 'Failed to fetch recipes.', error);
    }
  }, {
    query: recipeSchemas.listQuery,
    detail: {
      tags: ['Recipes'],
      summary: 'List recipes from the public recipe catalog',
      description: 'Proxies the Food Safety Korea recipe API and normalizes its field names.'
    }
  })

  .get('/recommend', async (ctx: any) => {
    const { query, user, set } = ctx;
    const limit = query.limit ?? 10;
    const maxMissingIngredients = query.maxMissingIngredients ?? 8;
    const expiringWithinDays = query.expiringWithinDays ?? 3;

    const { data, error } = await supabase
      .from('ingredients')
      .select('*')
      .eq('user_id', user.id)
      .eq('is_consumed', false)
      .order('expired_at', { ascending: true });

    if (error) return fail(set, 500, 'INGREDIENT_LIST_FAILED', error.message);

    const ingredients = ((data ?? []) as IngredientRow[]).map(toIngredient);
    if (ingredients.length === 0) return ok([]);

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

      const scanLimit = Number(getEnv('RECIPE_RECOMMENDATION_SCAN_LIMIT') ?? 1000);
      const recipes = await fetchRecipes(1, scanLimit);
      const recommendations = recipes
        .map((recipe) => scoreRecipe(recipe, ingredients, ingredientNamesById, expiringWithinDays))
        .filter((item): item is RecipeRecommendation => Boolean(item))
        .filter((item) => item.missingIngredientNames.length <= maxMissingIngredients)
        .sort((a, b) => b.score - a.score)
        .slice(0, limit);

      return ok(recommendations);
    } catch (error) {
      return fail(set, 502, 'RECIPE_API_ERROR', 'Failed to recommend recipes.', error);
    }
  }, {
    query: recipeSchemas.recommendationQuery,
    detail: {
      tags: ['Recipes'],
      summary: 'Recommend recipes from active user ingredients'
    }
  });
