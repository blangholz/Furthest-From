import { demoMode } from '../config';
import { supabase } from '../supabase';
import { demoApi } from './demo-api';
import { supabaseApi } from './supabase-api';
import type { Api } from './types';

export const api: Api = demoMode || !supabase ? demoApi : supabaseApi(supabase);
export { demoApi };
export * from './types';
