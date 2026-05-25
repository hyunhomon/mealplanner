import { Elysia, t } from 'elysia';
import { supabase } from '../supabase';
import { getUser } from '../lib/getUser';

const MAX_HP = 100;
const MIN_HP = 0;
const FEED_HP_GAIN = 10;
const PENALTY_HP_LOSS = 15;
const DECAY_PER_DAY = 5;
const HAPPY_THRESHOLD = 80;
const HEALTHY_THRESHOLD = 40;
const INITIAL_HP = 50;
const FEED_EXP_GAIN = 1;

const calcStage = (hp: number, currentStage: string): string => {
  if (currentStage === 'egg') return 'egg';
  if (hp <= MIN_HP)             return 'dead';
  if (hp >= HAPPY_THRESHOLD)    return 'happy';
  if (hp >= HEALTHY_THRESHOLD)  return 'healthy';
  return 'weak';
};

const calcDecay = (lastFedAt: string): number => {
  const lastFed = new Date(lastFedAt).getTime();
  const now = Date.now();
  const daysPassed = Math.floor((now - lastFed) / 86400000);
  return daysPassed * DECAY_PER_DAY;
};

const getStatusMessage = (stage: string, hp: number): string => {
  switch (stage) {
    case 'egg':     return '알이 따뜻하게 품어지고 있어요. 첫 식재료를 소비해보세요! 🥚';
    case 'happy':   return `아주 행복한 상태예요! HP: ${hp}/${MAX_HP} 😊`;
    case 'healthy': return `건강한 상태예요! HP: ${hp}/${MAX_HP} 😊`;
    case 'weak':    return `많이 약해졌어요... 얼른 식재료를 소비해주세요! HP: ${hp}/${MAX_HP} 😢`;
    case 'dead':    return '캐릭터가 무지개다리를 건넜어요. 새 알을 받아보세요. 💀';
    default:        return '';
  }
};

export const characterRoutes = new Elysia({ prefix: '/api/character' })

  /*캐릭터 현재 상태 조회*/
  .get('/', async ({ headers }) => {
    const user = await getUser(headers);
    if (!user) return { success: false, error: 'Unauthorized' };

    let { data: character, error } = await supabase
      .from('user_character')
      .select('*')
      .eq('user_id', user.id)
      .single();

    if (error || !character) {
      const { data: newChar, error: createError } = await supabase
        .from('user_character')
        .insert([{
          user_id: user.id,
          level: 1,
          exp: 0,
          hp: INITIAL_HP,
          stage: 'egg',
          total_saved: 0,
          born_count: 1,
          penalty_points: 0,
          last_fed_at: new Date().toISOString(),
          last_cooked_at: new Date().toISOString()
        }])
        .select()
        .single();

      if (createError) return { success: false, error: createError.message };
      return { success: true, data: newChar };
    }

    if (character.stage !== 'egg' && character.stage !== 'dead') {
      const decay = calcDecay(character.last_fed_at);
      if (decay > 0) {
        const newHp = Math.max(MIN_HP, character.hp - decay);
        const newStage = calcStage(newHp, character.stage);

        const { data: updated } = await supabase
          .from('user_character')
          .update({ hp: newHp, stage: newStage, updated_at: new Date().toISOString() })
          .eq('user_id', user.id)
          .select()
          .single();

        character = updated || character;
      }
    }

    return {
      success: true,
      data: {
        ...character,
        status_message: getStatusMessage(character.stage, character.hp)
      }
    };
  })

  /*먹이 주기*/
  .post('/feed', async ({ headers }) => {
    const user = await getUser(headers);
    if (!user) return { success: false, error: 'Unauthorized' };

    const { data: character, error } = await supabase
      .from('user_character')
      .select('*')
      .eq('user_id', user.id)
      .single();

    if (error || !character) return { success: false, error: '캐릭터가 없어요.' };
    if (character.stage === 'dead') return { success: false, error: '먼저 새 알을 받아야 해요.', need_rebirth: true };

    const newHp = Math.min(MAX_HP, character.hp + FEED_HP_GAIN);
    const newExp = character.exp + FEED_EXP_GAIN;
    const newTotalSaved = character.total_saved + 1;
    const newStage = character.stage === 'egg' ? 'healthy' : calcStage(newHp, character.stage);
    const hatched = character.stage === 'egg' && newStage === 'healthy';

    const { data: updated, error: updateError } = await supabase
      .from('user_character')
      .update({
        hp: newHp,
        exp: newExp,
        stage: newStage,
        total_saved: newTotalSaved,
        last_fed_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .eq('user_id', user.id)
      .select()
      .single();

    if (updateError) return { success: false, error: updateError.message };

    return {
      success: true,
      data: {
        ...updated,
        hatched,
        status_message: getStatusMessage(newStage, newHp),
        message: hatched
          ? '알에서 부화했어요! 건강한 상태가 됐어요! 🐣'
          : newStage === 'happy'
            ? '행복한 상태가 됐어요! 😊'
            : `HP +${FEED_HP_GAIN} (현재 ${newHp}/${MAX_HP})`
      }
    };
  })

  /*식재료 방치/폐기 시 HP 감소*/
  .post('/penalty', async ({ headers }) => {
    const user = await getUser(headers);
    if (!user) return { success: false, error: 'Unauthorized' };

    const { data: character, error } = await supabase
      .from('user_character')
      .select('*')
      .eq('user_id', user.id)
      .single();

    if (error || !character) return { success: false, error: '캐릭터가 없어요.' };
    if (character.stage === 'egg' || character.stage === 'dead')
      return { success: true, data: character };

    const newHp = Math.max(MIN_HP, character.hp - PENALTY_HP_LOSS);
    const newStage = calcStage(newHp, character.stage);

    const { data: updated, error: updateError } = await supabase
      .from('user_character')
      .update({ hp: newHp, stage: newStage, updated_at: new Date().toISOString() })
      .eq('user_id', user.id)
      .select()
      .single();

    if (updateError) return { success: false, error: updateError.message };

    return {
      success: true,
      data: {
        ...updated,
        status_message: getStatusMessage(newStage, newHp),
        message: newStage === 'dead'
          ? '캐릭터가 죽었어요... 새 알을 받아보세요. 💀'
          : newStage === 'weak'
            ? `캐릭터가 약해졌어요! HP -${PENALTY_HP_LOSS} (현재 ${newHp}/${MAX_HP}) 😢`
            : `HP -${PENALTY_HP_LOSS} (현재 ${newHp}/${MAX_HP})`
      }
    };
  })

  /*부활 - 새 알 받기*/
  .post('/rebirth', async ({ headers }) => {
    const user = await getUser(headers);
    if (!user) return { success: false, error: 'Unauthorized' };

    const { data: character, error } = await supabase
      .from('user_character')
      .select('*')
      .eq('user_id', user.id)
      .single();

    if (error || !character) return { success: false, error: '캐릭터가 없어요.' };
    if (character.stage !== 'dead') return { success: false, error: '캐릭터가 죽지 않았어요.' };

    const { data: updated, error: updateError } = await supabase
      .from('user_character')
      .update({
        hp: INITIAL_HP,
        exp: 0,
        stage: 'egg',
        born_count: character.born_count + 1,
        last_fed_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .eq('user_id', user.id)
      .select()
      .single();

    if (updateError) return { success: false, error: updateError.message };

    return {
      success: true,
      data: {
        ...updated,
        message: `새 알이 태어났어요! (${updated.born_count}번째 생명) 🥚`
      }
    };
  })

  /*음식 사진 촬영 시 HP 회복/감소*/
  .post('/eat-photo', async ({ body, headers }) => {
    const user = await getUser(headers);
    if (!user) return { success: false, error: 'Unauthorized' };

    const { image, recommended_recipe_name } = body;

    const { data: character, error } = await supabase
      .from('user_character')
      .select('*')
      .eq('user_id', user.id)
      .single();

    if (error || !character) return { success: false, error: '캐릭터가 없어요.' };
    if (character.stage === 'dead') return { success: false, error: '먼저 새 알을 받아야 해요.', need_rebirth: true };
    if (character.stage === 'egg') return { success: false, error: '아직 알 상태예요.' };

    const HP_HEALTHY = 15;
    const HP_RECIPE = 20;
    const HP_UNHEALTHY = -5;

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
              { type: 'image_url', image_url: { url: `data:image/jpeg;base64,${image}` } },
              {
                type: 'text',
                text: `이 음식 사진을 분석해줘. 다음 JSON 형식으로만 반환해줘:
{
  "food_name": "음식 이름",
  "is_unhealthy": true/false,
  "is_recommended_recipe": true/false,
  "reason": "판단 이유"
}
판단 기준:
1. is_unhealthy: 패스트푸드, 튀긴 음식, 과자, 탄산음료, 술 등 건강에 좋지 않은 음식이면 true
2. is_recommended_recipe: 추천 레시피명 "${recommended_recipe_name || ''}"과 사진 음식이 일치하면 true. 추천 레시피명이 없으면 false
3. is_unhealthy가 true이면 is_recommended_recipe는 무조건 false`
              }
            ]
          }
        ]
      })
    });

    const result = await response.json();
    const cleaned = result.choices[0].message.content.replace(/```json|```/g, '').trim();
    const analysis = JSON.parse(cleaned);

    let hpChange = 0;
    let message = '';

    if (analysis.is_unhealthy) {
      hpChange = HP_UNHEALTHY;
      message = `건강에 좋지 않은 음식이에요! HP ${hpChange} 😟 (${analysis.food_name})`;
    } else if (analysis.is_recommended_recipe) {
      hpChange = HP_RECIPE;
      message = `추천 레시피 음식이에요! HP +${hpChange} 🎉 (${analysis.food_name})`;
    } else {
      hpChange = HP_HEALTHY;
      message = `건강한 음식이에요! HP +${hpChange} 😊 (${analysis.food_name})`;
    }

    const newHp = Math.min(MAX_HP, Math.max(MIN_HP, character.hp + hpChange));
    const newStage = calcStage(newHp, character.stage);

    const { data: updated, error: updateError } = await supabase
      .from('user_character')
      .update({ hp: newHp, stage: newStage, updated_at: new Date().toISOString() })
      .eq('user_id', user.id)
      .select()
      .single();

    if (updateError) return { success: false, error: updateError.message };

    return {
      success: true,
      data: {
        ...updated,
        hp_before: character.hp,
        hp_change: hpChange,
        hp_after: newHp,
        food_name: analysis.food_name,
        is_unhealthy: analysis.is_unhealthy,
        is_recommended_recipe: analysis.is_recommended_recipe,
        reason: analysis.reason,
        status_message: getStatusMessage(newStage, newHp),
        message
      }
    };
  }, {
    body: t.Object({
      image: t.String(),
      recommended_recipe_name: t.Optional(t.String())
    })
  });