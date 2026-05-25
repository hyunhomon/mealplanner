import { Elysia, t } from 'elysia';
import { supabase } from '../supabase';
import { authMiddleware } from '../middleware/auth';
import { getItemCode } from '../lib/itemCodes';
import { getEnv } from '../env';
import { fail } from '../lib/responses';
import {
  LlmError,
  analyzeConsumptionImage,
  parseIngredientsFromScan
} from '../services/llm';

const INGREDIENT_WEIGHTS_KG: Record<string, number> = {
  '\uB300\uD30C': 0.5,
  '\uC591\uD30C': 0.2,
  '\uB450\uBD80': 0.3,
  '\uBC30\uCD94': 2.0,
  '\uACC4\uB780': 0.06,
  default: 0.2
};

const foodSafetyApiKey = () => getEnv('FOODSAFETY_API_KEY') ?? getEnv('INGREDIENT_API_KEY');

const failLlm = (set: { status?: unknown }, error: unknown) => {
  if (error instanceof LlmError && error.code === 'LLM_CONFIG_ERROR') {
    return fail(set, 500, error.code, error.message);
  }

  if (error instanceof LlmError) {
    return fail(set, 502, error.code, error.message, error.details);
  }

  return fail(set, 502, 'LLM_ANALYSIS_FAILED', 'Failed to analyze the request with LLM.', error);
};

export const ingredientRoutes = new Elysia({ prefix: '/api/ingredients' })
  .use(authMiddleware)

  /*미소비 식재료 목록 조회*/
  .get('/', async ({ user }: any) => {
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
  .post('/', async ({ body, user, set }: any) => {
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

  /*Parse receipt OCR or voice text*/
  .post('/parse-scan', async ({ body, user, set }: any) => {
    const { type, payload } = body;

    let ingredients;
    try {
      ingredients = await parseIngredientsFromScan(type, payload);
    } catch (error) {
      return failLlm(set, error);
    }

    if (ingredients.length === 0) {
      return { success: true, data: [] };
    }

    const rows = ingredients.map((item) => {
      const itemInfo = getItemCode(item.name);
      return {
        name: item.name,
        quantity: 1,
        expired_at: new Date(Date.now() + item.expiryDays * 86400000).toISOString(),
        is_consumed: false,
        user_id: user.id,
        item_cd: itemInfo?.item_cd || null,
        ctgry_cd: itemInfo?.ctgry_cd || null,
        ctgry_nm: itemInfo?.ctgry_nm || null
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
  .post('/consume', async ({ body, user }: any) => {
    const { ingredient_id, carbon_reduced } = body;
    const API_KEY = foodSafetyApiKey();

    // 1. 소비하려는 식재료 조회
    const { data: ingredient, error: findError } = await supabase
      .from('ingredients')
      .select('*')
      .eq('id', ingredient_id)
      .eq('user_id', user.id)
      .single();

    if (findError || !ingredient) return { success: false, error: '식재료를 찾을 수 없습니다.' };

    // 2. [수정] 수량을 공공 표준 kg 단위로 환산
    const ingredientName = ingredient.name || 'default';
    const unitWeightKg = INGREDIENT_WEIGHTS_KG[ingredientName] || INGREDIENT_WEIGHTS_KG.default;
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

  /*Analyze consumed ingredient image*/
  .post('/consume-image', async ({ body, user, set }: any) => {
    const { ingredient_id, image } = body;
    const API_KEY = foodSafetyApiKey();

    const { data: ingredient, error: fetchError } = await supabase
      .from('ingredients')
      .select('name, quantity')
      .eq('id', ingredient_id)
      .eq('user_id', user.id)
      .single();

    if (fetchError || !ingredient) return { success: false, error: fetchError.message };

    let analysis;
    try {
      analysis = await analyzeConsumptionImage(image);
    } catch (error) {
      return failLlm(set, error);
    }

    const consumed_quantity = ingredient.quantity * analysis.consumedRatio;
    const remaining_quantity = ingredient.quantity * analysis.remainingRatio;
    const ingredientName = ingredient.name || 'default';
    const unitWeightKg = INGREDIENT_WEIGHTS_KG[ingredientName] || INGREDIENT_WEIGHTS_KG.default;
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
      console.error('Image price lookup failed; using fallback price.');
    }

    const saved_money = Math.round(consumedWeightKg * currentKgPrice);
    const carbon_reduced = consumed_quantity * 0.0025;

    const { error: updateError } = await supabase
      .from('ingredients')
      .update({
        remaining_quantity,
        is_consumed: remaining_quantity < 0.1
      })
      .eq('id', ingredient_id)
      .eq('user_id', user.id);

    if (updateError) return { success: false, error: updateError.message };

    const { error: logError } = await supabase
      .from('eco_savings_logs')
      .insert([
        { saved_money, carbon_reduced, user_id: user.id }
      ]);

    if (logError) return { success: false, error: logError.message };

    return {
      success: true,
      data: {
        consumed_quantity,
        remaining_quantity,
        saved_money,
        carbon_reduced
      }
    };
  }, {
    body: t.Object({
      ingredient_id: t.String(),
      image: t.String()
    })
  })
  /*캘린더 - 월별 식재료 소비기한 상태 조회*/
  .get('/calendar', async ({ query, user }: any) => {
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
  .get('/:id', async ({ params, user }: any) => {
    const { data, error } = await supabase
      .from('ingredients')
      .select('*')
      .eq('id', params.id)
      .eq('user_id', user.id) // 본인 식재료만 조회
      .single();

    if (error) return { success: false, error: error.message };
    return { success: true, data };
  });
