import { Elysia, t } from 'elysia';
import { supabase } from '../supabase';
import { authMiddleware } from '../middleware/auth';

export const reportRoutes = new Elysia({ prefix: '/api/reports' })
  .use(authMiddleware)

  /*누적 절약 수치 계산*/
  .get('/stats', async (ctx: any) => {
    const { user } = ctx;
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
  .get('/monthly', async (ctx: any) => {
    const { query, user } = ctx;
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
  });
