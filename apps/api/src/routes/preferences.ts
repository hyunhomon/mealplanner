import { Elysia, t } from 'elysia';
import { supabase } from '../supabase';
import { authMiddleware } from '../middleware/auth';

export const preferencesRoutes = new Elysia({ prefix: '/api/preferences' })
  .use(authMiddleware)

  /*선호 식단 조회*/
  .get('/', async ({ user }) => {
    const { data, error } = await supabase
      .from('user_preferences')
      .select('id, user_id, health_condition, created_at')
      .eq('user_id', user.id)
      .single();

    // 없으면 기본값으로 자동 생성
    if (error || !data) {
      const { data: newPref, error: createError } = await supabase
        .from('user_preferences')
        .insert([{
          user_id: user.id,
          health_condition: '일반'
        }])
        .select()
        .single();

      if (createError) return { success: false, error: createError.message };
      return { success: true, data: newPref };
    }

    return { success: true, data };
  })

  /*선호 식단 수정*/
  .post('/', async ({ body, user }) => {
    const { health_condition } = body;

    const { data: existing } = await supabase
      .from('user_preferences')
      .select('id')
      .eq('user_id', user.id)
      .single();

    if (existing) {
      const { data, error } = await supabase
        .from('user_preferences')
        .update({ health_condition })
        .eq('user_id', user.id)
        .select()
        .single();

      if (error) return { success: false, error: error.message };
      return { success: true, data };
    }

    const { data, error } = await supabase
      .from('user_preferences')
      .insert([{ user_id: user.id, health_condition }])
      .select()
      .single();

    if (error) return { success: false, error: error.message };
    return { success: true, data };
  }, {
    body: t.Object({
      health_condition: t.String() // 일반/비건/다이어트/저염식
    })
  });