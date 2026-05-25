import { Elysia } from 'elysia';
import { supabase } from '../supabase';

const getBearerToken = (authorization: string | undefined) => {
  if (!authorization?.startsWith('Bearer ')) return undefined;
  return authorization.slice('Bearer '.length).trim();
};

export const authMiddleware = new Elysia()
  .derive(async ({ headers, set }) => {
    const token = getBearerToken(headers.authorization);
    if (!token) {
      set.status = 401;
      throw new Error('Unauthorized');
    }

    const { data: { user }, error } = await supabase.auth.getUser(token);
    if (error || !user) {
      set.status = 401;
      throw new Error('Unauthorized');
    }

    return { user };
  });
