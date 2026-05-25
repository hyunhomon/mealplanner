import { Elysia, t } from 'elysia';
import { supabase } from '../supabase';
import { getUser } from '../lib/getUser';

const fetchRecipesByIngredient = async (ingredientName: string, start = 1, end = 100) => {
  const key = Bun.env.FOODSAFETY_API_KEY;
  const url = `http://openapi.foodsafetykorea.go.kr/api/${key}/COOKRCP01/json/${start}/${end}/RCP_PARTS_DTLS=${encodeURIComponent(ingredientName)}`;
  const res = await fetch(url);
  const data = await res.json();
  return data?.COOKRCP01?.row || [];
};

const parseManuals = (row: any): string[] => {
  const steps: string[] = [];
  for (let i = 1; i <= 20; i++) {
    const key = `MANUAL${String(i).padStart(2, '0')}`;
    if (row[key] && row[key].trim()) steps.push(row[key].trim());
  }
  return steps;
};

export const recipeRoutes = new Elysia({ prefix: '/api/recipes' })

  /*유통기한 임박 재료 기반 레시피 추천 (식품안전처 API)*/
  .get('/recommend', async ({ headers }) => {
    const user = await getUser(headers);
    if (!user) return { success: false, error: 'Unauthorized' };

    const { data: ingredients, error } = await supabase
      .from('ingredients')
      .select('*')
      .eq('is_consumed', false)
      .eq('user_id', user.id)
      .order('expired_at', { ascending: true })
      .limit(5);

    if (error) return { success: false, error: error.message };
    if (!ingredients || ingredients.length === 0)
      return { success: true, data: [] };

    const { data: prefs } = await supabase
      .from('user_preferences')
      .select('*')
      .eq('user_id', user.id)
      .maybeSingle();

    const targetCalories = 2100;
    const targetCarbs    = 289;
    const targetProtein  = 60;
    const targetFat      = 58;
    const healthCondition = prefs?.health_condition ?? '일반';

    const mealCalories = Math.round(targetCalories / 3);
    const mealCarbs = Math.round(targetCarbs / 3);
    const mealProtein = Math.round(targetProtein / 3);
    const mealFat = Math.round(targetFat / 3);

    const allRecipes: any[] = [];
    for (const ingredient of ingredients) {
      const rows = await fetchRecipesByIngredient(ingredient.name);
      allRecipes.push(...rows);
    }

    const uniqueRecipes = Array.from(
      new Map(allRecipes.map(r => [r.RCP_SEQ, r])).values()
    );

    const filtered = uniqueRecipes.filter(r => {
      const cal = Number(r.INFO_ENG) || 0;
      const car = Number(r.INFO_CAR) || 0;
      const pro = Number(r.INFO_PRO) || 0;
      const fat = Number(r.INFO_FAT) || 0;

      if (cal > 0 && (cal < mealCalories * 0.8 || cal > mealCalories * 1.2)) return false;
      if (car > 0 && car > mealCarbs * 1.2) return false;
      if (pro > 0 && pro < mealProtein * 0.8) return false;
      if (fat > 0 && fat > mealFat * 1.2) return false;

      if (healthCondition === '비건') {
        const parts = r.RCP_PARTS_DTLS?.toLowerCase() || '';
        const animalKeywords = ['고기', '소고기', '돼지', '닭', '육류', '새우', '생선', '달걀', '계란', '우유', '버터', '치즈'];
        if (animalKeywords.some(k => parts.includes(k))) return false;
      }

      if (healthCondition === '저염식') {
        const na = Number(r.INFO_NA) || 0;
        if (na > 667) return false;
      }

      if (healthCondition === '다이어트') {
        if (pro > 0 && pro < mealProtein * 0.8) return false;
        if (cal > mealCalories) return false;
      }

      return true;
    });

    const sorted = filtered
      .sort((a, b) => {
        const aCal = Math.abs(Number(a.INFO_ENG) - mealCalories);
        const bCal = Math.abs(Number(b.INFO_ENG) - mealCalories);
        return aCal - bCal;
      })
      .slice(0, 3);

    const result = sorted.map(r => ({
      name: r.RCP_NM,
      category: r.RCP_PAT2,
      method: r.RCP_WAY2,
      ingredients: r.RCP_PARTS_DTLS,
      steps: parseManuals(r),
      image: r.ATT_FILE_NO_MAIN || null,
      nutrition: {
        calories: Number(r.INFO_ENG) || 0,
        carbs_g: Number(r.INFO_CAR) || 0,
        protein_g: Number(r.INFO_PRO) || 0,
        fat_g: Number(r.INFO_FAT) || 0,
        sodium_mg: Number(r.INFO_NA) || 0
      }
    }));

    if (result.length === 0) {
      const fallback = uniqueRecipes.slice(0, 3).map(r => ({
        name: r.RCP_NM,
        category: r.RCP_PAT2,
        method: r.RCP_WAY2,
        ingredients: r.RCP_PARTS_DTLS,
        steps: parseManuals(r),
        image: r.ATT_FILE_NO_MAIN || null,
        nutrition: {
          calories: Number(r.INFO_ENG) || 0,
          carbs_g: Number(r.INFO_CAR) || 0,
          protein_g: Number(r.INFO_PRO) || 0,
          fat_g: Number(r.INFO_FAT) || 0,
          sodium_mg: Number(r.INFO_NA) || 0
        }
      }));
      return { success: true, data: fallback, filtered: false };
    }

    return { success: true, data: result, filtered: true };
  })

  /*레시피 검색 (재료명으로 직접 검색)*/
  .get('/search', async ({ query }) => {
    const { name, start, end } = query;
    const rows = await fetchRecipesByIngredient(name, Number(start) || 1, Number(end) || 10);

    const result = rows.map((r: any) => ({
      name: r.RCP_NM,
      category: r.RCP_PAT2,
      method: r.RCP_WAY2,
      ingredients: r.RCP_PARTS_DTLS,
      steps: parseManuals(r),
      image: r.ATT_FILE_NO_MAIN || null,
      nutrition: {
        calories: Number(r.INFO_ENG) || 0,
        carbs_g: Number(r.INFO_CAR) || 0,
        protein_g: Number(r.INFO_PRO) || 0,
        fat_g: Number(r.INFO_FAT) || 0,
        sodium_mg: Number(r.INFO_NA) || 0
      }
    }));

    return { success: true, count: result.length, data: result };
  }, {
    query: t.Object({
      name: t.String(),
      start: t.Optional(t.String()),
      end: t.Optional(t.String())
    })
  });