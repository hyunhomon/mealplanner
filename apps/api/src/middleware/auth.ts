import { Elysia } from 'elysia';
import { supabase } from '../supabase';

const getBearerToken = (authorization: string | undefined) => {
  if (!authorization?.startsWith('Bearer ')) return undefined;
  return authorization.slice('Bearer '.length).trim();
};

const unauthorized = () => {
  const error = new Error('Unauthorized') as Error & { status: number; code: string };
  error.status = 401;
  error.code = 'UNAUTHORIZED';
  return error;
};

export const authMiddleware = new Elysia()
  .resolve(async ({ headers, set }) => {
    const token = getBearerToken(headers.authorization);
    if (!token) {
      set.status = 401;
      throw unauthorized();
    }

    const { data: { user }, error } = await supabase.auth.getUser(token);
    if (error || !user) {
      set.status = 401;
      throw unauthorized();
    }

    return { user };
  })
  .as('global');
