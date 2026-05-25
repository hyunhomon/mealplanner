import { Elysia, t } from 'elysia';
import { supabase } from '../supabase';
import { getUser } from '../lib/getUser';

export const preferencesRoutes = new Elysia({ prefix: '/api/preferences' })

  /*선호 식단 조회*/
  .get('/', async ({ headers }) => {
    const user = await getUser(headers);
    if (!user) return { success: false, error: 'Unauthorized' };

    const { data, error } = await supabase
      .from('user_preferences')
      .select('id, user_id, health_condition, created_at')
      .eq('user_id', user.id)
      .single();

    if (error || !data) {
      const { data: newPref, error: createError } = await supabase
        .from('user_preferences')
        .insert([{ user_id: user.id, health_condition: '일반' }])
        .select()
        .single();

      if (createError) return { success: false, error: createError.message };
      return { success: true, data: newPref };
    }

    return { success: true, data };
  })

  /*선호 식단 수정*/
  .post('/', async ({ body, headers }) => {
    const user = await getUser(headers);
    if (!user) return { success: false, error: 'Unauthorized' };

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
      health_condition: t.String()
    })
  });