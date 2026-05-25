import { Elysia, t } from 'elysia';
import { supabase } from '../supabase';
import { getUser } from '../lib/getUser';

export const reportRoutes = new Elysia({ prefix: '/api/reports' })

  /*누적 절약 수치 계산*/
  .get('/stats', async ({ headers }) => {
    const user = await getUser(headers);
    if (!user) return { success: false, error: 'Unauthorized' };

    const { data, error } = await supabase
      .from('eco_savings_logs')
      .select('saved_money, carbon_reduced')
      .eq('user_id', user.id);

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
  .get('/monthly', async ({ query, headers }) => {
    const user = await getUser(headers);
    if (!user) return { success: false, error: 'Unauthorized' };

    const { month } = query;

    const startDate = new Date(`${month}-01`).toISOString();
    const endDate = new Date(new Date(`${month}-01`).setMonth(
      new Date(`${month}-01`).getMonth() + 1
    )).toISOString();

    const { data: logs, error: logError } = await supabase
      .from('eco_savings_logs')
      .select('saved_money, carbon_reduced, created_at')
      .eq('user_id', user.id)
      .gte('created_at', startDate)
      .lt('created_at', endDate);

    if (logError) return { success: false, error: logError.message };

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
        total_saved_money: totalSavedMoney,
        total_carbon_reduced: totalCarbon,
        consumed_count: consumed.length,
        waste_prevented: consumed.length
      }
    };
  }, {
    query: t.Object({
      month: t.String()
    })
  });