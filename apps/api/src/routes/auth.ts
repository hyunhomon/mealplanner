import { Elysia, t } from 'elysia';
import { supabase } from '../supabase';

export const authRoutes = new Elysia({ prefix: '/auth' })
  /*이메일 회원가입*/
  .post('/signup', async ({ body }) => {
    const { email, password } = body;
    const { data, error } = await supabase.auth.signUp({ email, password });
    if (error) return { success: false, error: error.message };
    return { success: true, data };
  }, {
    body: t.Object({
      email: t.String(),
      password: t.String()
    })
  })

  /*이메일 로그인*/
  .post('/login', async ({ body }) => {
    const { email, password } = body;
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) return { success: false, error: error.message };
    return { success: true, data };
  }, {
    body: t.Object({
      email: t.String(),
      password: t.String()
    })
  })

  /*로그아웃*/
  .post('/logout', async () => {
    const { error } = await supabase.auth.signOut();
    if (error) return { success: false, error: error.message };
    return { success: true };
  })

  /*전화번호로 OTP 발송*/
  .post('/phone', async ({ body }) => {
    const { phone } = body;
    const { error } = await supabase.auth.signInWithOtp({ phone });
    if (error) return { success: false, error: error.message };
    return { success: true, message: 'OTP가 발송됐어요.' };
  }, {
    body: t.Object({
      phone: t.String() // 예: +821012345678
    })
  })

  /*OTP 인증*/
  .post('/verify-otp', async ({ body }) => {
    const { phone, token } = body;
    const { data, error } = await supabase.auth.verifyOtp({
      phone,
      token,
      type: 'sms'
    });
    if (error) return { success: false, error: error.message };
    return { success: true, data };
  }, {
    body: t.Object({
      phone: t.String(),
      token: t.String() // 예: 123456
    })
  })

  /*Google 소셜 로그인*/
  .post('/google', async () => {
    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: 'http://localhost:5173' }
    });
    if (error) return { success: false, error: error.message };
    return { success: true, data };
  })

  /*Apple 소셜 로그인*/
  .post('/apple', async () => {
    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: 'apple',
      options: { redirectTo: 'http://localhost:5173' }
    });
    if (error) return { success: false, error: error.message };
    return { success: true, data };
  });