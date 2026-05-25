import { Elysia, t } from 'elysia';
import { supabase } from '../supabase';
import { authMiddleware } from '../middleware/auth';
import { fail } from '../lib/responses';
import { LlmError, analyzeMealPhoto } from '../services/llm';

/**
 * 캐릭터 상태 시스템
 *
 * [상태 흐름]
 * egg(알) → healthy(건강) → happy(행복)
 *                        ↘ weak(약함) → dead(죽음) → egg(부활)
 *
 * [HP 기준]
 * happy:   80 ~ 100
 * healthy: 40 ~ 79
 * weak:    1  ~ 39
 * dead:    0 이하
 * egg:     초기 상태 (첫 먹이 시 healthy로 전환)
 */

// ─────────────────────────────────────────
// ✏️ 변경 가능한 게임 설정값
// ─────────────────────────────────────────

const MAX_HP = 100;           // ✏️ HP 최댓값
const MIN_HP = 0;             // ✏️ HP 최솟값

const FEED_HP_GAIN = 10;      // ✏️ 먹이 줄 때 HP 증가량
const PENALTY_HP_LOSS = 15;   // ✏️ 식재료 방치/폐기 시 HP 감소량
const DECAY_PER_DAY = 5;      // ✏️ 하루 방치 시 HP 자동 감소량

const HAPPY_THRESHOLD = 80;   // ✏️ happy 상태 최소 HP
const HEALTHY_THRESHOLD = 40; // ✏️ healthy 상태 최소 HP (이하 weak)

const INITIAL_HP = 50;        // ✏️ 캐릭터 최초 생성 / 부활 시 HP
const FEED_EXP_GAIN = 1;      // ✏️ 먹이 줄 때 경험치 증가량

const failLlm = (set: { status?: unknown }, error: unknown) => {
  if (error instanceof LlmError && error.code === 'LLM_CONFIG_ERROR') {
    return fail(set, 500, error.code, error.message);
  }

  if (error instanceof LlmError) {
    return fail(set, 502, error.code, error.message, error.details);
  }

  return fail(set, 502, 'LLM_ANALYSIS_FAILED', 'Failed to analyze the meal photo with LLM.', error);
};

// ─────────────────────────────────────────

// HP → 상태 계산
const calcStage = (hp: number, currentStage: string): string => {
  if (currentStage === 'egg') return 'egg';
  if (hp <= MIN_HP)             return 'dead';
  if (hp >= HAPPY_THRESHOLD)    return 'happy';
  if (hp >= HEALTHY_THRESHOLD)  return 'healthy';
  return 'weak';
};

// 마지막 먹이 이후 경과일 기반 HP 감소량 계산
const calcDecay = (lastFedAt: string): number => {
  const lastFed = new Date(lastFedAt).getTime();
  const now = Date.now();
  const daysPassed = Math.floor((now - lastFed) / 86400000);
  return daysPassed * DECAY_PER_DAY;
};

export const characterRoutes = new Elysia({ prefix: '/api/character' })
  .use(authMiddleware)

  /*캐릭터 현재 상태 조회*/
  .get('/', async ({ user }: any) => {
    let { data: character, error } = await supabase
      .from('user_character')
      .select('*')
      .eq('user_id', user.id)
      .single();

    // 캐릭터 없으면 자동 생성 (알 상태)
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

    // 방치 시간 기반 HP 자동 감소 (egg/dead 상태 제외)
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

  /*먹이 주기 (식재료 소비 시 호출)*/
  .post('/feed', async ({ user }: any) => {
    const { data: character, error } = await supabase
      .from('user_character')
      .select('*')
      .eq('user_id', user.id)
      .single();

    if (error || !character) return { success: false, error: '캐릭터가 없어요.' };

    // 죽은 상태에서는 부활 먼저
    if (character.stage === 'dead') {
      return { success: false, error: '먼저 새 알을 받아야 해요.', need_rebirth: true };
    }

    const newHp = Math.min(MAX_HP, character.hp + FEED_HP_GAIN);
    const newExp = character.exp + FEED_EXP_GAIN;
    const newTotalSaved = character.total_saved + 1;

    // 알 → 건강으로 첫 전환
    const newStage = character.stage === 'egg'
      ? 'healthy'
      : calcStage(newHp, character.stage);

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
  .post('/penalty', async ({ user }: any) => {
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
      .update({
        hp: newHp,
        stage: newStage,
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
        status_message: getStatusMessage(newStage, newHp),
        message: newStage === 'dead'
          ? '캐릭터가 죽었어요... 새 알을 받아보세요. 💀'
          : newStage === 'weak'
            ? `캐릭터가 약해졌어요! HP -${PENALTY_HP_LOSS} (현재 ${newHp}/${MAX_HP}) 😢`
            : `HP -${PENALTY_HP_LOSS} (현재 ${newHp}/${MAX_HP})`
      }
    };
  })

  /*부활 - 새 알 받기 (죽은 상태에서만 가능)*/
  .post('/rebirth', async ({ user }: any) => {
    const { data: character, error } = await supabase
      .from('user_character')
      .select('*')
      .eq('user_id', user.id)
      .single();

    if (error || !character) return { success: false, error: '캐릭터가 없어요.' };
    if (character.stage !== 'dead')
      return { success: false, error: '캐릭터가 죽지 않았어요.' };

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

  /*Analyze meal photo and update HP*/
  .post('/eat-photo', async ({ body, user, set }: any) => {
    const { image, recommended_recipe_name } = body;

    const { data: character, error } = await supabase
      .from('user_character')
      .select('*')
      .eq('user_id', user.id)
      .single();

    if (error || !character) return { success: false, error: 'Character not found.' };
    if (character.stage === 'dead') return { success: false, error: 'Rebirth is required first.', need_rebirth: true };
    if (character.stage === 'egg') return { success: false, error: 'Character is still an egg.' };

    const HP_HEALTHY = 15;
    const HP_RECIPE = 20;
    const HP_UNHEALTHY = -5;

    let analysis;
    try {
      analysis = await analyzeMealPhoto(image, recommended_recipe_name);
    } catch (error) {
      return failLlm(set, error);
    }

    let hpChange = HP_HEALTHY;
    let message = `Healthy meal. HP +${HP_HEALTHY} (${analysis.foodName})`;

    if (analysis.isUnhealthy) {
      hpChange = HP_UNHEALTHY;
      message = `Unhealthy meal. HP ${hpChange} (${analysis.foodName})`;
    } else if (analysis.isRecommendedRecipe) {
      hpChange = HP_RECIPE;
      message = `Recommended recipe match. HP +${HP_RECIPE} (${analysis.foodName})`;
    }

    const newHp = Math.min(MAX_HP, Math.max(MIN_HP, character.hp + hpChange));
    const newStage = calcStage(newHp, character.stage);

    const { data: updated, error: updateError } = await supabase
      .from('user_character')
      .update({
        hp: newHp,
        stage: newStage,
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
        hp_before: character.hp,
        hp_change: hpChange,
        hp_after: newHp,
        food_name: analysis.foodName,
        is_unhealthy: analysis.isUnhealthy,
        is_recommended_recipe: analysis.isRecommendedRecipe,
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
// ─────────────────────────────────────────
// ✏️ 상태별 메시지 (원하는 문구로 변경 가능)
// ─────────────────────────────────────────
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
