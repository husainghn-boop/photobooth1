import { createClient } from '@supabase/supabase-js';

/**
 * Supabase client for browser-based operations.
 * Uses public (anon key) for client-side only.
 * Service role key MUST NOT be exposed in frontend code.
 */

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

/**
 * Validate that required Supabase environment variables are configured.
 * Throws an error at runtime if missing to catch configuration issues early.
 */
function validateSupabaseConfig(): void {
  if (!supabaseUrl) {
    throw new Error(
      'Missing VITE_SUPABASE_URL environment variable. ' +
      'Please configure your Supabase project URL in .env.local'
    );
  }

  if (!supabaseAnonKey) {
    throw new Error(
      'Missing VITE_SUPABASE_PUBLISHABLE_KEY environment variable. ' +
      'Please configure your Supabase publishable key (anon key) in .env.local'
    );
  }
}

// Validate configuration on module load
validateSupabaseConfig();

/**
 * Supabase client instance for browser-based operations.
 * 
 * Security notes:
 * - Uses public anon key (safe for browser)
 * - RLS policies enforce row-level access control
 * - Authentication state managed via Supabase Auth
 * - Service role key NEVER exposed in frontend
 */
export const supabase = createClient(supabaseUrl, supabaseAnonKey);

export default supabase;
