import { Elysia, t } from 'elysia';
import { supabase } from '../supabase';
import { authMiddleware } from '../middleware/auth';

export const ingredientRoutes = new Elysia({ prefix: '/api/ingredients' })
  .use(authMiddleware)

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

  /*소비 완료 이미지 분석*/
  .post('/consume-image', async ({ body, user }) => {
    const { ingredient_id, image } = body;

    // LLM Vision으로 소비량/남은 양 분석
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
            content: [
              {
                type: 'image_url',
                image_url: { url: `data:image/jpeg;base64,${image}` }
              },
              {
                type: 'text',
                text: '이 요리 사진을 보고 소비된 양(0~1 사이 비율)과 남은 양(0~1 사이 비율)을 JSON으로만 반환해줘. 예시: {"consumed_ratio":0.7,"remaining_ratio":0.3}'
              }
            ]
          }
        ]
      })
    });

    const result = await response.json();
    // LLM이 마크다운으로 감싸서 반환할 경우 제거 후 파싱
    const cleaned = result.choices[0].message.content.replace(/```json|```/g, '').trim();
    const { consumed_ratio, remaining_ratio } = JSON.parse(cleaned);

    // 현재 식재료 조회
    const { data: ingredient, error: fetchError } = await supabase
      .from('ingredients')
      .select('quantity')
      .eq('id', ingredient_id)
      .eq('user_id', user.id) // 본인 식재료만
      .single();

    if (fetchError) return { success: false, error: fetchError.message };

    const consumed_quantity = ingredient.quantity * consumed_ratio;
    const remaining_quantity = ingredient.quantity * remaining_ratio;

    // 절약 비용 계산 (소비량 기준 100g당 500원 가정)
    const saved_money = Math.round(consumed_quantity * 500);

    // 탄소 절감량 계산 (소비량 기준 1g당 0.0025kg CO₂)
    const carbon_reduced = consumed_quantity * 0.0025;

    // 식재료 상태 업데이트
    const { error: updateError } = await supabase
      .from('ingredients')
      .update({
        remaining_quantity,
        is_consumed: remaining_quantity < 0.1 // 거의 없으면 소비 완료
      })
      .eq('id', ingredient_id)
      .eq('user_id', user.id); // 본인 식재료만

    if (updateError) return { success: false, error: updateError.message };

    // 에코 절약 통계 저장
    const { error: logError } = await supabase
      .from('eco_savings_logs')
      .insert([
        { saved_money, carbon_reduced, user_id: user.id }
      ]);

    if (logError) return { success: false, error: logError.message };

    return {
      success: true,
      data: {
        consumed_quantity,   // 소비된 양
        remaining_quantity,  // 남은 양
        saved_money,         // 절약 비용
        carbon_reduced       // 탄소 절감량
      }
    };
  }, {
    body: t.Object({
      ingredient_id: t.String(),
      image: t.String() // base64 인코딩된 이미지
    })
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
  });