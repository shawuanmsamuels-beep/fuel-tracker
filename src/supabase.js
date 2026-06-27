// ── SUPABASE CLIENT ──────────────────────────────────────────────────────────
// Single place that connects the app to your Supabase project (cloud database + login).
// The two values come from environment variables so they live outside the code:
//   - VITE_SUPABASE_URL       → your project's URL
//   - VITE_SUPABASE_ANON_KEY  → your project's public "anon" key (safe for the browser)
// If they're missing, `supabase` is null and the app falls back to browser-only storage.
import { createClient } from "@supabase/supabase-js";

// The publishable key is public by design (safe in the browser; data is protected
// by Row-Level Security). Env vars override these if set, otherwise we fall back
// to the project's built-in values so the app works without extra config.
// NOTE: only ever hardcode PUBLISHABLE keys here — never a secret/service_role key.
const url = import.meta.env.VITE_SUPABASE_URL || "https://wgnkqonwclypjpfrcgzu.supabase.co";
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || "sb_publishable_exIeDnihQQfikviwLoJtng_eKc7WWic";

export const supabase = url && anonKey ? createClient(url, anonKey) : null;
export const hasSupabase = !!supabase;
