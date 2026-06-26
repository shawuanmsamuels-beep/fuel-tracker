// ── SUPABASE CLIENT ──────────────────────────────────────────────────────────
// Single place that connects the app to your Supabase project (cloud database + login).
// The two values come from environment variables so they live outside the code:
//   - VITE_SUPABASE_URL       → your project's URL
//   - VITE_SUPABASE_ANON_KEY  → your project's public "anon" key (safe for the browser)
// If they're missing, `supabase` is null and the app falls back to browser-only storage.
import { createClient } from "@supabase/supabase-js";

const url = import.meta.env.VITE_SUPABASE_URL;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

export const supabase = url && anonKey ? createClient(url, anonKey) : null;
export const hasSupabase = !!supabase;
