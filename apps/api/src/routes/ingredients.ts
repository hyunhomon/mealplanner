import { Elysia, t } from 'elysia';
import { supabase } from '../supabase';
import { getItemCode } from '../lib/itemCodes';
import { getUser } from '../lib/getUser';

export const ingredientRoutes = new Elysia({ prefix: '/api/ingredients' })

  /*미소비 식재료 목록 조회*/
  .get('/', async ({ headers }) => {
    const user = await getUser(headers);
    if (!user) return { success: false, error: 'Unauthorized' };

    const { data, error } = await supabase
      .from('ingredients')
      .select('*')
      .eq('is_consumed', false)
      .eq('user_id', user.id)
      .order('expired_at', { ascending: true });

    if (error) return { success: false, error: error.message };
    return { success: true, data };
  })

  /*식재료 수동 등록 (슬라이더 양 입력)*/
  .post('/', async ({ body, headers, set }) => {
    const user = await getUser(headers);
    if (!user) return { success: false, error: 'Unauthorized' };

    const { name, quantity, expired_at } = body;

    if (quantity < 0.1) {
      set.status = 400;
      return { success: false, error: '수량은 0.1 이상이어야 해요.' };
    }

    const itemInfo = getItemCode(name);

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
  .post('/parse-scan', async ({ body, headers }) => {
    const user = await getUser(headers);
    if (!user) return { success: false, error: 'Unauthorized' };

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
    const cleaned = result.choices[0].message.content.replace(/```json|```/g, '').trim();
    const ingredients = JSON.parse(cleaned);

    const rows = ingredients.map((item: { name: string; expiryDays: number }) => {
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

  /*식재료 소비 및 환경절약 처리*/
  .post('/consume', async ({ body, headers }) => {
    const user = await getUser(headers);
    if (!user) return { success: false, error: 'Unauthorized' };

    const { ingredient_id, saved_money, carbon_reduced } = body;

    const { error: ingredientError } = await supabase
      .from('ingredients')
      .update({ is_consumed: true })
      .eq('id', ingredient_id)
      .eq('user_id', user.id);

    if (ingredientError) return { success: false, error: ingredientError.message };

    const { error: logError } = await supabase
      .from('eco_savings_logs')
      .insert([{ saved_money, carbon_reduced, user_id: user.id }]);

    if (logError) return { success: false, error: logError.message };

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

    return { success: true, message: 'Success' };
  }, {
    body: t.Object({
      ingredient_id: t.String(),
      saved_money: t.Number(),
      carbon_reduced: t.Number()
    })
  })

  /*소비 완료 이미지 분석*/
  .post('/consume-image', async ({ body, headers }) => {
    const user = await getUser(headers);
    if (!user) return { success: false, error: 'Unauthorized' };

    const { ingredient_id, image } = body;

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
    const cleaned = result.choices[0].message.content.replace(/```json|```/g, '').trim();
    const { consumed_ratio, remaining_ratio } = JSON.parse(cleaned);

    const { data: ingredient, error: fetchError } = await supabase
      .from('ingredients')
      .select('quantity')
      .eq('id', ingredient_id)
      .eq('user_id', user.id)
      .single();

    if (fetchError) return { success: false, error: fetchError.message };

    const consumed_quantity = ingredient.quantity * consumed_ratio;
    const remaining_quantity = ingredient.quantity * remaining_ratio;
    const saved_money = Math.round(consumed_quantity * 500);
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
      .insert([{ saved_money, carbon_reduced, user_id: user.id }]);

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

  /*유통기한 D-2 이내 재료 조회 (푸시 알림용)*/
  .get('/expiring', async ({ query, headers }) => {
    const user = await getUser(headers);
    if (!user) return { success: false, error: 'Unauthorized' };

    const days = Number(query.days) || 2;
    const now = new Date();
    const targetDate = new Date();
    targetDate.setDate(now.getDate() + days);

    const { data, error } = await supabase
      .from('ingredients')
      .select('id, name, expired_at, quantity')
      .eq('is_consumed', false)
      .eq('user_id', user.id)
      .gte('expired_at', now.toISOString())
      .lte('expired_at', targetDate.toISOString())
      .order('expired_at', { ascending: true });

    if (error) return { success: false, error: error.message };

    const result = (data || []).map(item => {
      const daysLeft = Math.ceil(
        (new Date(item.expired_at).getTime() - now.getTime()) / 86400000
      );
      return {
        ...item,
        days_left: daysLeft,
        message: daysLeft === 0
          ? `${item.name}의 유통기한이 오늘 만료돼요!`
          : `${item.name}의 유통기한이 ${daysLeft}일 남았어요.`
      };
    });

    return { success: true, count: result.length, data: result };
  }, {
    query: t.Object({
      days: t.Optional(t.String())
    })
  })

  /*식재료 시세 조회 (친환경농산물 가격정보 API)*/
  .get('/price', async ({ query }) => {
    const { name } = query;

    const today = new Date();
    const yyyymmdd = today.toISOString().slice(0, 10).replace(/-/g, '');

    const params = new URLSearchParams({
      serviceKey: Bun.env.ECO_PRICE_API_KEY || '',
      returnType: 'JSON',
      pageNo: '1',
      numOfRows: '10',
      'cond[exmn_ymd::LTE]': yyyymmdd,
      'cond[exmn_ymd::GTE]': yyyymmdd,
    });

    const response = await fetch(
      `https://apis.data.go.kr/B552845/ecoFriendly/price?${params}`
    );

    const result = await response.json();
    const items = result?.response?.body?.items?.item || [];

    const filtered = items.filter((item: any) =>
      item.item_nm?.includes(name)
    );

    if (filtered.length === 0) {
      return { success: true, data: null, message: '해당 식재료 시세 정보가 없어요.' };
    }

    return {
      success: true,
      data: filtered.map((item: any) => ({
        name: item.item_nm,
        grade: item.grd_nm,
        unit: item.unit,
        unit_size: item.unit_sz,
        price: item.exmn_dd_prc,
        price_per_kg: item.exmn_dd_cnvs_prc,
        market: item.mrkt_nm,
        date: item.exmn_ymd
      }))
    };
  }, {
    query: t.Object({
      name: t.String()
    })
  })

  /*캘린더 - 월별 식재료 소비기한 상태 조회*/
  .get('/calendar', async ({ query, headers }) => {
    const user = await getUser(headers);
    if (!user) return { success: false, error: 'Unauthorized' };

    const { month } = query;

    const startDate = new Date(`${month}-01`).toISOString();
    const endDate = new Date(new Date(`${month}-01`).setMonth(
      new Date(`${month}-01`).getMonth() + 1
    )).toISOString();

    const { data, error } = await supabase
      .from('ingredients')
      .select('name, expired_at, is_consumed')
      .eq('user_id', user.id)
      .gte('expired_at', startDate)
      .lt('expired_at', endDate)
      .order('expired_at', { ascending: true });

    if (error) return { success: false, error: error.message };

    const calendar = data.map(item => {
      const daysLeft = Math.ceil(
        (new Date(item.expired_at).getTime() - Date.now()) / 86400000
      );
      return {
        name: item.name,
        expired_at: item.expired_at,
        is_consumed: item.is_consumed,
        status: daysLeft <= 2 ? 'red' : daysLeft <= 7 ? 'yellow' : 'green'
      };
    });

    return { success: true, data: calendar };
  }, {
    query: t.Object({
      month: t.String()
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
  .get('/:id', async ({ params, headers }) => {
    const user = await getUser(headers);
    if (!user) return { success: false, error: 'Unauthorized' };

    const { data, error } = await supabase
      .from('ingredients')
      .select('*')
      .eq('id', params.id)
      .eq('user_id', user.id)
      .single();

    if (error) return { success: false, error: error.message };
    return { success: true, data };
  });