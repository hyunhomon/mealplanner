import { Elysia } from 'elysia';
import { supabase } from '../supabase';
import { authMiddleware } from '../middleware/auth';
import { authSchemas } from '../schemas';
import { fail, ok } from '../lib/responses';
import { getEnv } from '../env';

const redirectTo = () => getEnv('AUTH_REDIRECT_URL') ?? 'http://localhost:5173';

export const authRoutes = new Elysia({ prefix: '/auth', tags: ['Auth'] })
  .post('/signup', async ({ body, set }) => {
    const { data, error } = await supabase.auth.signUp(body);
    if (error) return fail(set, 400, 'SIGNUP_FAILED', error.message);

    return ok(data);
  }, {
    body: authSchemas.emailPassword,
    detail: {
      tags: ['Auth'],
      summary: 'Sign up with email and password'
    }
  })

  .post('/login', async ({ body, set }) => {
    const { data, error } = await supabase.auth.signInWithPassword(body);
    if (error) return fail(set, 401, 'LOGIN_FAILED', error.message);

    return ok(data);
  }, {
    body: authSchemas.emailPassword,
    detail: {
      tags: ['Auth'],
      summary: 'Log in with email and password'
    }
  })

  .post('/phone', async ({ body, set }) => {
    const { error } = await supabase.auth.signInWithOtp({ phone: body.phone });
    if (error) return fail(set, 400, 'OTP_SEND_FAILED', error.message);

    return ok({ message: 'OTP sent.' });
  }, {
    body: authSchemas.phone,
    detail: {
      tags: ['Auth'],
      summary: 'Send an SMS OTP'
    }
  })

  .post('/verify-otp', async ({ body, set }) => {
    const { data, error } = await supabase.auth.verifyOtp({
      phone: body.phone,
      token: body.token,
      type: 'sms'
    });
    if (error) return fail(set, 401, 'OTP_VERIFY_FAILED', error.message);

    return ok(data);
  }, {
    body: authSchemas.verifyOtp,
    detail: {
      tags: ['Auth'],
      summary: 'Verify an SMS OTP'
    }
  })

  .post('/google', async ({ set }) => {
    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: redirectTo() }
    });
    if (error) return fail(set, 400, 'OAUTH_URL_FAILED', error.message);

    return ok(data);
  }, {
    detail: {
      tags: ['Auth'],
      summary: 'Create a Google OAuth login URL'
    }
  })

  .post('/apple', async ({ set }) => {
    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: 'apple',
      options: { redirectTo: redirectTo() }
    });
    if (error) return fail(set, 400, 'OAUTH_URL_FAILED', error.message);

    return ok(data);
  }, {
    detail: {
      tags: ['Auth'],
      summary: 'Create an Apple OAuth login URL'
    }
  })

  .use(authMiddleware)
  .post('/logout', async () => {
    // Supabase JWTs are stateless for this API. The client should clear its stored session after this acknowledgement.
    return ok({ message: 'Logged out.' });
  }, {
    detail: {
      tags: ['Auth'],
      summary: 'Acknowledge logout for an authenticated user'
    }
  });
