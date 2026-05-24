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
      /*이메일 회원가입*/
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

      /*이메일 로그인*/
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

      /*로그아웃*/
      .post('/logout', async () => {
        const { error } = await supabase.auth.signOut();
        if (error) return { success: false, error: error.message };
        return { success: true };
      })

      /*전화번호로 OTP 발송*/
      .post('/phone', async ({ body }) => {
        const { phone } = body;
        const { error } = await supabase.auth.signInWithOtp({ phone });
        if (error) return { success: false, error: error.message };
        return { success: true, message: 'OTP가 발송됐어요.' };
      }, {
        body: t.Object({
          phone: t.String() // 예: +821012345678
        })
      })

      /*OTP 인증*/
      .post('/verify-otp', async ({ body }) => {
        const { phone, token } = body;
        const { data, error } = await supabase.auth.verifyOtp({
          phone,
          token,
          type: 'sms'
        });
        if (error) return { success: false, error: error.message };
        return { success: true, data };
      }, {
        body: t.Object({
          phone: t.String(),
          token: t.String() // 예: 123456
        })
      })

      /*Google 소셜 로그인*/
      .post('/google', async () => {
        const { data, error } = await supabase.auth.signInWithOAuth({
          provider: 'google',
          options: { redirectTo: 'http://localhost:5173' }
        });
        if (error) return { success: false, error: error.message };
        return { success: true, data };
      })

      /*Apple 소셜 로그인*/
      .post('/apple', async () => {
        const { data, error } = await supabase.auth.signInWithOAuth({
          provider: 'apple',
          options: { redirectTo: 'http://localhost:5173' }
        });
        if (error) return { success: false, error: error.message };
        return { success: true, data };
      })
  )

  //ingredients
  .use(authMiddleware) // 인증 미들웨어 전체 적용
  .group('/api/ingredients', (api) =>
    api
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

      /*식재료 수동 등록 (슬라이더 양 입력)*/
      .post('/', async ({ body, user, set }) => {
        const { name, quantity, expired_at } = body;

        // 음수 방지
        if (quantity < 0.1) {
          set.status = 400;
          return { success: false, error: '수량은 0.1 이상이어야 해요.' };
        }

        const { data, error } = await supabase
          .from('ingredients')
          .insert([{
            name,
            quantity,
            expired_at,
            is_consumed: false,
            user_id: user.id
          }])
          .select();

        if (error) return { success: false, error: error.message };
        return { success: true, data };
      }, {
        body: t.Object({
          name: t.String(),
          quantity: t.Number({ minimum: 0.1 }),
          expired_at: t.String()
        })
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

        // DB에 저장 (본인 user_id 포함, 기본 수량 1)
        const rows = ingredients.map((item: { name: string; expiryDays: number }) => ({
          name: item.name,
          quantity: 1, // 영수증/음성 입력 시 기본값
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

        // 식재료 소비 상태 (본인 식재료만 소비 처리)
        const { error: ingredientError } = await supabase
          .from('ingredients')
          .update({ is_consumed: true })
          .eq('id', ingredient_id)
          .eq('user_id', user.id); // 본인 식재료만 소비 처리

        if (ingredientError) return { success: false, error: ingredientError.message };

        // 에코 절약 통계
        const { error: logError } = await supabase
          .from('eco_savings_logs')
          .insert([
            { saved_money, carbon_reduced, user_id: user.id } // 본인 로그로 저장
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

      /*식재료 단건 상세 조회*/
      .get('/:id', async ({ params, user }) => {
        const { data, error } = await supabase
          .from('ingredients')
          .select('*')
          .eq('id', params.id)
          .eq('user_id', user.id) // 본인 식재료만 조회
          .single();

        if (error) return { success: false, error: error.message };
        return { success: true, data };
      })

      /*캘린더 - 월별 식재료 소비기한 상태 조회*/
      .get('/calendar', async ({ query, user }) => {
        const { month } = query; // 예: 2026-05

        const startDate = new Date(`${month}-01`).toISOString();
        const endDate = new Date(new Date(`${month}-01`).setMonth(
          new Date(`${month}-01`).getMonth() + 1
        )).toISOString();

        const { data, error } = await supabase
          .from('ingredients')
          .select('name, expired_at, is_consumed')
          .eq('user_id', user.id) // 본인 식재료만 조회
          .gte('expired_at', startDate)
          .lt('expired_at', endDate)
          .order('expired_at', { ascending: true });

        if (error) return { success: false, error: error.message };

        // 날짜별로 상태 분류
        const calendar = data.map(item => {
          const daysLeft = Math.ceil(
            (new Date(item.expired_at).getTime() - Date.now()) / 86400000
          );
          return {
            name: item.name,
            expired_at: item.expired_at,
            is_consumed: item.is_consumed,
            // 2일 이내: 빨강, 7일 이내: 노랑, 그 이상: 초록
            status: daysLeft <= 2 ? 'red' : daysLeft <= 7 ? 'yellow' : 'green'
          };
        });

        return { success: true, data: calendar };
      }, {
        query: t.Object({
          month: t.String() // 2026-05 형식
        })
      })

      /*부족 재료 마켓 링크 생성*/
      .get('/shop-links', async ({ query }) => {
        const { name } = query;
        const encoded = encodeURIComponent(name);

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
  )

  //recipes
  .group('/api/recipes', (api) =>
    api
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
      /*누적 절약 수치 계산*/
      .get('/stats', async ({ user }) => {
        const { data, error } = await supabase
          .from('eco_savings_logs')
          .select('saved_money, carbon_reduced')
          .eq('user_id', user.id); // 본인 로그만 조회

        if (error) return { success: false, error: error.message };

        const totalMoney = data.reduce((acc, cur) => acc + cur.saved_money, 0);
        const totalCarbon = data.reduce((acc, cur) => acc + cur.carbon_reduced, 0);

        return {
          success: true,
          total_saved_money: totalMoney,
          total_carbon_reduced: totalCarbon
        };
      })

      /*이번 달 식비 현황*/
      .get('/monthly', async ({ query, user }) => {
        const { month } = query; // 예: 2026-05

        const startDate = new Date(`${month}-01`).toISOString();
        const endDate = new Date(new Date(`${month}-01`).setMonth(
          new Date(`${month}-01`).getMonth() + 1
        )).toISOString();

        // 이번 달 에코 절약 로그 조회
        const { data: logs, error: logError } = await supabase
          .from('eco_savings_logs')
          .select('saved_money, carbon_reduced, created_at')
          .eq('user_id', user.id)
          .gte('created_at', startDate)
          .lt('created_at', endDate);

        if (logError) return { success: false, error: logError.message };

        // 이번 달 소비 완료된 식재료 수 조회
        const { data: consumed, error: consumedError } = await supabase
          .from('ingredients')
          .select('id')
          .eq('user_id', user.id)
          .eq('is_consumed', true)
          .gte('created_at', startDate)
          .lt('created_at', endDate);

        if (consumedError) return { success: false, error: consumedError.message };

        const totalSavedMoney = logs.reduce((acc, cur) => acc + cur.saved_money, 0);
        const totalCarbon = logs.reduce((acc, cur) => acc + cur.carbon_reduced, 0);

        return {
          success: true,
          data: {
            total_saved_money: totalSavedMoney,  // 이번 달 절약 금액
            total_carbon_reduced: totalCarbon,   // 탄소 절감량
            consumed_count: consumed.length,     // 소비 완료 식재료 수
            waste_prevented: consumed.length     // 폐기 방지 건수
          }
        };
      }, {
        query: t.Object({
          month: t.String() // 2026-05 형식
        })
      })
  )

  .listen(3000);

console.log(`http://localhost:3000`);