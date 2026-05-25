import { Elysia } from 'elysia';
import { supabase } from '../supabase';
import { authMiddleware } from '../middleware/auth';

export const recipeRoutes = new Elysia({ prefix: '/api/recipes' })
  .use(authMiddleware)

  /*유통기한 임박 재료 기반 레시피 추천*/
  .get('/recommend', async ({ user }) => {
    // 유통기한 임박 재료 조회 (본인 식재료만)
    const { data: ingredients, error } = await supabase
      .from('ingredients')
      .select('*')
      .eq('is_consumed', false)
      .eq('user_id', user.id) // 본인 식재료만 조회
      .order('expired_at', { ascending: true })
      .limit(5);

    if (error) return { success: false, error: error.message };
    if (!ingredients || ingredients.length === 0)
      return { success: true, data: [] };

    const ingredientList = ingredients.map(i => i.name).join(', ');

    // user_preferences 테이블에서 선호 식단 꺼내기
    const { data: preferenceData } = await supabase
      .from('user_preferences')
      .select('health_condition')
      .eq('user_id', user.id)
      .maybeSingle();

    const userDiet = preferenceData?.health_condition || '일반';

    let dietPrompt = '';
    switch (userDiet) {
      case '비건':
        dietPrompt = `사용자의 식단 선호도가 [비건]이므로, 고기, 생선, 우유, 달걀 등 모든 동물성 재료를 완전히 제외한 100% 식물성 비건 레시피로만 구성해줘.`;
        break;
      case '다이어트':
        dietPrompt = `사용자의 식단 선호도가 [다이어트/체중감량]이므로, 칼로리가 낮고 단백질 비율이 높은 헬스 식단 위주로 구성해줘.`;
        break;
      case '저염식':
        dietPrompt = `사용자의 식단 선호도가 [저염식]이므로, 소금이나 간장 사용을 최소화한 싱겁고 담백한 건강식 레시피로 구성해줘.`;
        break;
      default:
        dietPrompt = `가장 대중적이고 맛있는 일반 레시피로 구성해줘.`;
    }

    const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${Bun.env.OPENROUTER_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: 'google/gemini-flash-1.5',
        messages: [
          {
            role: 'user',
            content: `다음 재료로 만들 수 있는 레시피 3개를 JSON 배열로만 반환해줘. ${dietPrompt} 예시: [{"name":"두부김치","ingredients":["두부","김치"],"steps":["1. 두부를 썬다","2. 볶는다"]}]\n재료: ${ingredientList}`
          }
        ]
      })
    });

    const result = await response.json();
    // LLM이 마크다운으로 감싸서 반환할 경우 제거 후 파싱
    const cleaned = result.choices[0].message.content.replace(/```json|```/g, '').trim();
    const recipes = JSON.parse(cleaned);

    return { success: true, data: recipes };
  });