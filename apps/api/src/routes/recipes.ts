import { Elysia, t } from 'elysia';
import { supabase } from '../supabase';
import { authMiddleware } from '../middleware/auth';

// 식품안전처 COOKRCP01 API 호출
const fetchRecipesByIngredient = async (ingredientName: string, start = 1, end = 100) => {
  const key = Bun.env.FOODSAFETY_API_KEY;
  const url = `http://openapi.foodsafetykorea.go.kr/api/${key}/COOKRCP01/json/${start}/${end}/RCP_PARTS_DTLS=${encodeURIComponent(ingredientName)}`;
  const res = await fetch(url);
  const data = await res.json();
  return data?.COOKRCP01?.row || [];
};

// 조리 순서 파싱 (MANUAL01~20)
const parseManuals = (row: any): string[] => {
  const steps: string[] = [];
  for (let i = 1; i <= 20; i++) {
    const key = `MANUAL${String(i).padStart(2, '0')}`;
    if (row[key] && row[key].trim()) steps.push(row[key].trim());
  }
  return steps;
};

export const recipeRoutes = new Elysia({ prefix: '/api/recipes' })
  .use(authMiddleware)

  /*유통기한 임박 재료 기반 레시피 추천 (식품안전처 API)*/
  .get('/recommend', async ({ user }) => {
    // 유통기한 임박 재료 조회 (본인 식재료만)
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

    // 사용자 선호 식단 조회
    const { data: prefs } = await supabase
      .from('user_preferences')
      .select('*')
      .eq('user_id', user.id)
      .maybeSingle();

    const targetCalories = 2100; // KDRIs 성인 평균 권장 칼로리
    const targetCarbs    = 289;  // KDRIs 성인 평균 탄수화물 (g)
    const targetProtein  = 60;   // KDRIs 성인 평균 단백질 (g)
    const targetFat      = 58;   // KDRIs 칼로리의 25% 기준 지방 (g)
    // 출처: 보건복지부·한국영양학회, 2020 한국인 영양소 섭취기준(KDRIs)
    // https://www.kns.or.kr/FileRoom/FileRoom_view.asp?idx=108&BoardID=Kdr
    const healthCondition = prefs?.health_condition ?? '일반';

    // 1끼 기준 영양소 목표
    const mealCalories = Math.round(targetCalories / 3);
    const mealCarbs = Math.round(targetCarbs / 3);
    const mealProtein = Math.round(targetProtein / 3);
    const mealFat = Math.round(targetFat / 3);

    // 재료별 레시피 검색 (유통기한 임박 순)
    const allRecipes: any[] = [];
    for (const ingredient of ingredients) {
      const rows = await fetchRecipesByIngredient(ingredient.name);
      allRecipes.push(...rows);
    }

    // 중복 제거
    const uniqueRecipes = Array.from(
      new Map(allRecipes.map(r => [r.RCP_SEQ, r])).values()
    );

    // 영양소 범위 필터링
    // 출처: 보건복지부·한국영양학회, 2020 한국인 영양소 섭취기준(KDRIs)
    // https://www.kns.or.kr/FileRoom/FileRoom_view.asp?idx=108&BoardID=Kdr
    const filtered = uniqueRecipes.filter(r => {
      const cal = Number(r.INFO_ENG) || 0;
      const car = Number(r.INFO_CAR) || 0;
      const pro = Number(r.INFO_PRO) || 0;
      const fat = Number(r.INFO_FAT) || 0;

      // 칼로리 ±20% 허용 (KDRIs 권고 허용 오차)
      if (cal > 0 && (cal < mealCalories * 0.8 || cal > mealCalories * 1.2)) return false;

      // 탄수화물 목표치 120% 이하 (KDRIs)
      if (car > 0 && car > mealCarbs * 1.2) return false;

      // 단백질 목표치 80% 이상 (KDRIs 권장섭취량)
      if (pro > 0 && pro < mealProtein * 0.8) return false;

      // 지방 목표치 120% 이하 (KDRIs)
      if (fat > 0 && fat > mealFat * 1.2) return false;

      // 비건: 축산물/수산물 재료 포함 제외
      if (healthCondition === '비건') {
        const parts = r.RCP_PARTS_DTLS?.toLowerCase() || '';
        const animalKeywords = ['고기', '소고기', '돼지', '닭', '육류', '새우', '생선', '달걀', '계란', '우유', '버터', '치즈'];
        if (animalKeywords.some(k => parts.includes(k))) return false;
      }

      // 저염식: 나트륨 667mg 이하 (KDRIs 1일 2,000mg ÷ 3끼)
      if (healthCondition === '저염식') {
        const na = Number(r.INFO_NA) || 0;
        if (na > 667) return false;
      }

      // 다이어트: 단백질 목표치 80% 이상, 칼로리 목표치 이하
      if (healthCondition === '다이어트') {
        if (pro > 0 && pro < mealProtein * 0.8) return false;
        if (cal > mealCalories) return false;
      }

      return true;
    });

    // 칼로리 기준 정렬 후 상위 3개
    const sorted = filtered
      .sort((a, b) => {
        const aCal = Math.abs(Number(a.INFO_ENG) - mealCalories);
        const bCal = Math.abs(Number(b.INFO_ENG) - mealCalories);
        return aCal - bCal;
      })
      .slice(0, 3);

    // 응답 포맷 정리
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

    // 필터링 결과 없으면 전체에서 상위 3개 반환
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