import { createClient } from "@supabase/supabase-js";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

// Check if we're in production and warn if vars are missing
if (import.meta.env.PROD && (!supabaseUrl || !supabaseAnonKey)) {
  // eslint-disable-next-line no-console
  console.error(
    "❌ CRITICAL: Supabase environment variables are missing!\n" +
    "Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in Vercel environment variables.\n" +
    "Current values:\n" +
    `  VITE_SUPABASE_URL: ${supabaseUrl ? '✅ Set' : '❌ Missing'}\n` +
    `  VITE_SUPABASE_ANON_KEY: ${supabaseAnonKey ? '✅ Set' : '❌ Missing'}\n\n` +
    "The app will not work without these variables. Please add them in Vercel Settings → Environment Variables and redeploy."
  );
}

// Use provided values or fallback to prevent crash
// Note: App will not work properly without valid credentials
const finalUrl = supabaseUrl || "https://placeholder.supabase.co";
const finalKey = supabaseAnonKey || "placeholder-key";

export const supabase = createClient(finalUrl, finalKey);

