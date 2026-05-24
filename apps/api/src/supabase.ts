// apps/api/src/supabase.ts
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = Bun.env.SUPABASE_URL || '';
const supabaseKey = Bun.env.SUPABASE_ANON_KEY || '';

export const supabase = createClient(supabaseUrl, supabaseKey);
