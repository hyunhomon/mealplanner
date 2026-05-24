import { Elysia, t } from 'elysia';
import { cors } from '@elysiajs/cors';
import { supabase } from './supabase';

// 인증 미들웨어
const authMiddleware = new Elysia()
  .derive(async ({ headers, set }) => {
    const token = headers['authorization']?.replace('Bearer ', '');
    if (!token) {
      set.status = 401;
      throw new Error('Unauthorized');
    }

    const { data: { user }, error } = await supabase.auth.getUser(token);
    if (error || !user) {
      set.status = 401;
      throw new Error('Unauthorized');
    }

    return { user };
  });

const app = new Elysia()
  .use(cors({
    origin: ['http://localhost:5173'] // 프론트 개발 포트만 허용
  }))
  .get('/', () => 'MealPlanner API Server is Running')

  //로그인, 회원가입
  .group('/auth', (api) =>
    api
      .post('/signup', async ({ body }) => {
        const { email, password } = body;
        const { data, error } = await supabase.auth.signUp({ email, password });
        if (error) return { success: false, error: error.message };
        return { success: true, data };
      }, {
        body: t.Object({
          email: t.String(),
          password: t.String()
        })
      })

      .post('/login', async ({ body }) => {
        const { email, password } = body;
        const { data, error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) return { success: false, error: error.message };
        return { success: true, data };
      }, {
        body: t.Object({
          email: t.String(),
          password: t.String()
        })
      })

      .post('/logout', async ({ headers }) => {
        const { error } = await supabase.auth.signOut();
        if (error) return { success: false, error: error.message };
        return { success: true };
      })
  )

  //ingredients
  .group('/api/ingredients', (api) =>
    api
      .use(authMiddleware) // 인증 추가
      /*미소비 식재료 목록 조회*/
      .get('/', async ({ user }) => {
        const { data, error } = await supabase
          .from('ingredients')
          .select('*')
          .eq('is_consumed', false)
          .eq('user_id', user.id) // 본인 식재료만 조회
          .order('expired_at', { ascending: true });

        if (error) return { success: false, error: error.message };
        return { success: true, data };
      })

      /*영수증 OCR 및 음성 데이터 텍스트 인식*/
      .post('/parse-scan', async ({ body, user }) => {
        const { type, payload } = body;

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
                content: type === 'OCR'
                  ? `영수증 내용에서 식품명과 표준 소비기한(일수)을 JSON 배열로만 반환해줘. 예시: [{"name":"두부","expiryDays":3}]\n${payload}`
                  : `다음 텍스트에서 식품명과 표준 소비기한(일수)을 JSON 배열로만 반환해줘. 예시: [{"name":"두부","expiryDays":3}]\n${payload}`
              }
            ]
          })
        });

        const result = await response.json();
        // LLM이 마크다운으로 감싸서 반환할 경우 제거 후 파싱
        const cleaned = result.choices[0].message.content.replace(/```json|```/g, '').trim();
        const ingredients = JSON.parse(cleaned);

        // DB에 저장 (본인 user_id 포함)
        const rows = ingredients.map((item: { name: string; expiryDays: number }) => ({
          name: item.name,
          expired_at: new Date(Date.now() + item.expiryDays * 86400000).toISOString(),
          is_consumed: false,
          user_id: user.id // 본인 식재료로 저장
        }));

        const { data, error } = await supabase
          .from('ingredients')
          .insert(rows)
          .select();

        if (error) return { success: false, error: error.message };
        return { success: true, data };
      }, {
        body: t.Object({
          type: t.String({ enum: ['OCR', 'VOICE'] }),
          payload: t.String()
        })
      })

      /*식재료 소비 및 환경절약 처리*/
      .post('/consume', async ({ body, user }) => {
        const { ingredient_id, saved_money, carbon_reduced } = body;

        //식재료 소비 상태 (본인 식재료만 소비 처리)
        const { error: ingredientError } = await supabase
          .from('ingredients')
          .update({ is_consumed: true })
          .eq('id', ingredient_id)
          .eq('user_id', user.id); // 본인 식재료만 소비 처리

        if (ingredientError) return { success: false, error: ingredientError.message };

        //에코 절약 통계 (savd_money: DB 컬럼명 오타로 인해 savd_money 사용)
        const { error: logError } = await supabase
          .from('eco_savings_logs')
          .insert([
            { savd_money: saved_money, carbon_reduced, user_id: user.id } // 본인 로그로 저장
          ]);

        if (logError) return { success: false, error: logError.message };

        return { success: true, message: 'Success' };
      }, {
        body: t.Object({
          ingredient_id: t.String(),
          saved_money: t.Number(),
          carbon_reduced: t.Number()
        })
      })
  )

  //recipes
  .group('/api/recipes', (api) =>
    api
      .use(authMiddleware)
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
                content: `다음 재료로 만들 수 있는 레시피 3개를 JSON 배열로만 반환해줘. 예시: [{"name":"두부김치","ingredients":["두부","김치"],"steps":["1. 두부를 썬다","2. 볶는다"]}]\n재료: ${ingredientList}`
              }
            ]
          })
        });

        const result = await response.json();
        // LLM이 마크다운으로 감싸서 반환할 경우 제거 후 파싱
        const cleaned = result.choices[0].message.content.replace(/```json|```/g, '').trim();
        const recipes = JSON.parse(cleaned);

        return { success: true, data: recipes };
      })
  )

  //reports
  .group('/api/reports', (api) =>
    api
      .use(authMiddleware) // 인증 추가
      /*누적 절약 수치 계산*/
      .get('/stats', async ({ user }) => {
        //(savd_money: DB 컬럼명 오타로 인해 savd_money 사용)
        const { data, error } = await supabase
          .from('eco_savings_logs')
          .select('savd_money, carbon_reduced')
          .eq('user_id', user.id); // 본인 로그만 조회

        if (error) return { success: false, error: error.message };
        //(savd_money: DB 컬럼명 오타로 인해 savd_money 사용)
        const totalMoney = data.reduce((acc, cur) => acc + cur.savd_money, 0);
        const totalCarbon = data.reduce((acc, cur) => acc + cur.carbon_reduced, 0);

        return {
          success: true,
          total_saved_money: totalMoney,
          total_carbon_reduced: totalCarbon
        };
      })
  )

  .listen(3000);

console.log(`http://localhost:3000`);