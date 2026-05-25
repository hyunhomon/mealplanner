import { Elysia, t } from 'elysia';
import { supabase } from '../supabase';
import { authMiddleware } from '../middleware/auth';
import { getItemCode } from '../lib/itemCodes';

// 💡 실시간 kg당 단가 API 규격과 동기화하기 위한 자취생 표준 중량 환산 매퍼
const INGREDIENT_WEIGHTS_KG: Record<string, number> = {
  '대파': 0.5,  // 1단 = 0.5kg
  '양파': 0.2,  // 1개 = 0.2kg
  '두부': 0.3,  // 1모 = 0.3kg
  '배추': 2.0,  // 1통 = 2.0kg
  '계란': 0.06, // 1알 = 0.06kg
  '기타': 0.2   // 기본 미지정 품목 0.2kg 상정
};

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

    const itemInfo = getItemCode(name); // 품목코드 자동 매핑

    const { data, error } = await supabase
    .from('ingredients')
    .insert([{
        name,
        quantity,
        expired_at,
        is_consumed: false,
        user_id: user.id,
        item_cd: itemInfo?.item_cd || null,
        ctgry_cd: itemInfo?.ctgry_cd || null,
        ctgry_nm: itemInfo?.ctgry_nm || null
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
    const rows = ingredients.map((item: { name: string; expiryDays: number }) => {
    const itemInfo = getItemCode(item.name); // 품목코드 자동 매핑
    return {
        name: item.name,
        quantity: 1,
        expired_at: new Date(Date.now() + item.expiryDays * 86400000).toISOString(),
        is_consumed: false,
        user_id: user.id,
        item_cd: itemInfo?.item_cd || null,    // 품목코드
        ctgry_cd: itemInfo?.ctgry_cd || null,  // 부류코드
        ctgry_nm: itemInfo?.ctgry_nm || null   // 부류명
    };
    });

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

  /* 식재료 직접 수동 소비 및 실시간 시세 계산 처리 */
  .post('/consume', async ({ body, user }) => {
    const { ingredient_id, carbon_reduced } = body;
    const API_KEY = Bun.env.FOODSAFETY_API_KEY;

    // 1. 소비하려는 식재료 조회
    const { data: ingredient, error: findError } = await supabase
      .from('ingredients')
      .select('*')
      .eq('id', ingredient_id)
      .eq('user_id', user.id)
      .single();

    if (findError || !ingredient) return { success: false, error: '식재료를 찾을 수 없습니다.' };

    // 2. [수정] 수량을 공공 표준 kg 단위로 환산
    const ingredientName = ingredient.name || '기타';
    const unitWeightKg = INGREDIENT_WEIGHTS_KG[ingredientName] || INGREDIENT_WEIGHTS_KG['기타'];
    const consumedWeightKg = unitWeightKg * (ingredient.quantity || 1);

    // 3. [수정] 외부 API 연동 실시간 소매 시세 조회 (원/kg 단위)
    let currentKgPrice = 5000; 
    try {
      const atUrl = `http://apis.data.go.kr/B552895/greenPrclnInfo/getGreenPrclnList?serviceKey=${API_KEY}&pageNo=1&numOfRows=3&_type=json&itemNm=${encodeURIComponent(ingredientName)}`;
      const atRes = await fetch(atUrl);
      if (atRes.ok) {
        const atJson = await atRes.json();
        const atItems = atJson.response?.body?.items?.item as any[];
        if (atItems && atItems.length > 0) {
          const sum = atItems.reduce((acc, cur) => acc + parseFloat(cur.kgPrcln || '0'), 0);
          currentKgPrice = sum / atItems.length;
        }
      }
    } catch (e) {
      console.error("소비 가격 조회 실패 -> 기본 단가 방어 적용");
    }

    const calculated_saved_money = Math.round(consumedWeightKg * currentKgPrice);

    // 식재료 소비 상태 (본인 식재료만 소비 처리)
    const { error: ingredientError } = await supabase
      .from('ingredients')
      .update({ is_consumed: true })
      .eq('id', ingredient_id)
      .eq('user_id', user.id); 

    if (ingredientError) return { success: false, error: ingredientError.message };

    // 에코 절약 통계 (실시간 계산값 주입)
    const { error: logError } = await supabase
      .from('eco_savings_logs')
      .insert([
        { saved_money: calculated_saved_money, carbon_reduced, user_id: user.id } 
      ]);

    if (logError) return { success: false, error: logError.message };

    // 식재료 소비 시 캐릭터 먹이 주기 자동 연동
    await supabase
    .from('user_character')
    .select('hp, stage')
    .eq('user_id', user.id)
    .single()
    .then(async ({ data }) => {
        if (!data || data.stage === 'dead') return;
        const newHp = Math.min(100, data.hp + 10);
        const newStage = data.stage === 'egg' ? 'healthy'
        : newHp >= 80 ? 'happy'
        : newHp >= 40 ? 'healthy'
        : 'weak';
        await supabase
        .from('user_character')
        .update({ hp: newHp, stage: newStage, last_fed_at: new Date().toISOString(), updated_at: new Date().toISOString() })
        .eq('user_id', user.id);
    });

    return { success: true, message: 'Success', saved_money: calculated_saved_money };
  }, {
    body: t.Object({
      ingredient_id: t.String(),
      carbon_reduced: t.Number()
    })
  })

  /*소비 완료 이미지 분석*/
  .post('/consume-image', async ({ body, user }) => {
    const { ingredient_id, image } = body;
    const API_KEY = Bun.env.FOODSAFETY_API_KEY;

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
      .select('name, quantity')
      .eq('id', ingredient_id)
      .eq('user_id', user.id) // 본인 식재료만
      .single();

    if (fetchError || !ingredient) return { success: false, error: fetchError.message };

    const consumed_quantity = ingredient.quantity * consumed_ratio;
    const remaining_quantity = ingredient.quantity * remaining_ratio;

    // 💡 [수정] 고정 수식(* 500)을 걷어내고 실시간 수량-중량 매퍼 및 공공 시세 단가 연동
    const ingredientName = ingredient.name || '기타';
    const unitWeightKg = INGREDIENT_WEIGHTS_KG[ingredientName] || INGREDIENT_WEIGHTS_KG['기타'];
    const consumedWeightKg = unitWeightKg * consumed_quantity;

    let currentKgPrice = 5000; 
    try {
      const atUrl = `http://apis.data.go.kr/B552895/greenPrclnInfo/getGreenPrclnList?serviceKey=${API_KEY}&pageNo=1&numOfRows=3&_type=json&itemNm=${encodeURIComponent(ingredientName)}`;
      const atRes = await fetch(atUrl);
      if (atRes.ok) {
        const atJson = await atRes.json();
        const atItems = atJson.response?.body?.items?.item as any[];
        if (atItems && atItems.length > 0) {
          const sum = atItems.reduce((acc, cur) => acc + parseFloat(cur.kgPrcln || '0'), 0);
          currentKgPrice = sum / atItems.length;
        }
      }
    } catch (e) {
      console.error("이미지 기반 시세 연산 실패 -> 방어 기본가 처리");
    }

    const saved_money = Math.round(consumedWeightKg * currentKgPrice);

    // 탄소 절감량 계산 (소비량 기준 기존 수식 유지 요청 반영)
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

    // 에코 절약 통계 저장 (실시간 saved_money 데이터 반영)
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
        saved_money,         // [수정] 실시간 계산된 진짜 절약 비용
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
