import { supabase } from '../supabase';

export const getUser = async (headers: Record<string, string | undefined>) => {
  const token = headers['authorization']?.replace('Bearer ', '');
  if (!token) return null;
  const { data: { user }, error } = await supabase.auth.getUser(token);
  if (error || !user) return null;
  return user;
};