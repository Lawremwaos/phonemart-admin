import { createClient } from "@supabase/supabase-js";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

if (!supabaseUrl || !supabaseAnonKey) {
  // eslint-disable-next-line no-console
  console.error(
    "❌ CRITICAL: Supabase environment variables are missing!\n" +
    "Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in Vercel environment variables.\n" +
    "Current values:\n" +
    `  VITE_SUPABASE_URL: ${supabaseUrl ? '✅ Set' : '❌ Missing'}\n` +
    `  VITE_SUPABASE_ANON_KEY: ${supabaseAnonKey ? '✅ Set' : '❌ Missing'}`
  );
}

// Create client with fallback empty strings (will fail gracefully)
export const supabase = createClient(supabaseUrl || "", supabaseAnonKey || "");

