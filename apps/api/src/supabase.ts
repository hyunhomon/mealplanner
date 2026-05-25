import { createClient } from '@supabase/supabase-js';

const requiredEnv = (name: string) => {
  const value = Bun.env[name];
  if (!value) {
    throw new Error(`${name} is required to start the API server.`);
  }

  return value;
};

export const supabase = createClient(
  requiredEnv('SUPABASE_URL'),
  requiredEnv('SUPABASE_ANON_KEY')
);
