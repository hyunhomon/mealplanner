import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { requiredEnv } from './env';

let client: SupabaseClient | undefined;

const getSupabase = () => {
  client ??= createClient(
    requiredEnv('SUPABASE_URL'),
    requiredEnv('SUPABASE_ANON_KEY')
  );

  return client;
};

export const supabase = new Proxy({} as SupabaseClient, {
  get(_target, property, receiver) {
    return Reflect.get(getSupabase(), property, receiver);
  }
});
