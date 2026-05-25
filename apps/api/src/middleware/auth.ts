import { Elysia } from 'elysia';
import { supabase } from '../supabase';

export const authMiddleware = new Elysia()
  .derive(async ({ headers, set }) => {
    const token = headers['authorization']?.replace('Bearer ', '');
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