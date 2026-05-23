import { Elysia, t } from 'elysia';
import { cors } from '@elysiajs/cors';
import { supabase } from './supabase';

const app = new Elysia()
  .use(cors())
  .get('/', () => 'MealPlanner API Server is Running')
  
  //ingredients
  .group('/api/ingredients', (api) =>
    api
      /*미소비 식재료 목록 조회*/
      .get('/', async () => {
        const { data, error } = await supabase
          .from('ingredients')
          .select('*')
          .eq('is_consumed', false)
          .order('expired_at', { ascending: true });

        if (error) return { success: false, error: error.message };
        return { success: true, data };
      })

      /*영수증 OCR 및 음성 데이터 텍스트 인식*/
      .post('/parse-scan', async ({ body }) => {
        // --
        return { success: true, data: [] };
      }, {
        body: t.Object({
          type: t.String({ enum: ['OCR', 'VOICE'] }),
          payload: t.String()
        })
      })

      /*식재료 소비 및 환경절약 처리*/
      .post('/consume', async ({ body }) => {
        const { ingredient_id, saved_money, carbon_reduced } = body;

        //식재료 소비 상태
        const { error: ingredientError } = await supabase
          .from('ingredients')
          .update({ is_consumed: true })
          .eq('id', ingredient_id);

        if (ingredientError) return { success: false, error: ingredientError.message };

        //에코 절약 통계
        const { error: logError } = await supabase
          .from('eco_savings_logs')
          .insert([
            { saved_money, carbon_reduced }
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
  )

  //reports
  .group('/api/reports', (api) =>
    api
      /*누적 절약 수치 계산*/
      .get('/stats', async () => {
        const { data, error } = await supabase
          .from('eco_savings_logs')
          .select('saved_money, carbon_reduced');

        if (error) return { success: false, error: error.message };

        const totalMoney = data.reduce((acc, cur) => acc + cur.saved_money, 0);
        const totalCarbon = data.reduce((acc, cur) => acc + cur.carbon_reduced, 0);

        return {
          success: true,
          total_saved_money: totalMoney,
          total_carbon_reduced: totalCarbon
        };
      })
  )
  .listen(3000);

console.log(`http://localhost:3000`);
