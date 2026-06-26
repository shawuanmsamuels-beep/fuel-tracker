// ── CLOUD DATA LAYER ─────────────────────────────────────────────────────────
// All talking-to-Supabase lives here: auth (sign up / in / out) and reading/
// writing profiles, food entries, and weights. The rest of the app imports these
// functions instead of calling Supabase directly.
import { supabase, hasSupabase } from "./supabase";

export { hasSupabase };

// ── AUTH ─────────────────────────────────────────────────────────────────────
export async function getUser() {
  if (!hasSupabase) return null;
  const { data } = await supabase.auth.getSession();
  return data.session?.user ?? null;
}

// Calls cb(user|null) whenever the user logs in or out. Returns an unsubscribe fn.
export function onAuth(cb) {
  if (!hasSupabase) return () => {};
  const { data } = supabase.auth.onAuthStateChange((_event, session) => cb(session?.user ?? null));
  return () => data.subscription.unsubscribe();
}

export async function signUp(email, password) {
  if (!hasSupabase) return { error: { message: "Cloud not configured" } };
  return supabase.auth.signUp({ email, password });
}
export async function signIn(email, password) {
  if (!hasSupabase) return { error: { message: "Cloud not configured" } };
  return supabase.auth.signInWithPassword({ email, password });
}
export async function signOut() {
  if (!hasSupabase) return;
  return supabase.auth.signOut();
}

// ── PROFILE ──────────────────────────────────────────────────────────────────
export async function loadProfile(userId) {
  const { data, error } = await supabase.from("profiles").select("*").eq("user_id", userId).maybeSingle();
  if (error || !data) return null;
  return { name: data.name, age: data.age, sex: data.sex, weight: data.weight, height: data.height, goal: data.goal };
}
export async function saveProfile(userId, p) {
  return supabase.from("profiles").upsert({
    user_id: userId,
    name: p.name, age: String(p.age ?? ""), sex: p.sex,
    weight: String(p.weight ?? ""), height: String(p.height ?? ""), goal: p.goal,
    updated_at: new Date().toISOString(),
  });
}

// ── FOOD ENTRIES (per day) ───────────────────────────────────────────────────
function rowToEntry(r) {
  return { id: r.id, name: r.name, calories: Number(r.calories), protein: Number(r.protein), carbs: Number(r.carbs), fat: Number(r.fat), meal: r.meal, qty: Number(r.qty) };
}
export async function loadEntries(userId, day) {
  const { data, error } = await supabase.from("entries").select("*").eq("user_id", userId).eq("day", day).order("created_at");
  if (error || !data) return [];
  return data.map(rowToEntry);
}
export async function addEntry(userId, day, e) {
  const { data, error } = await supabase.from("entries")
    .insert({ user_id: userId, day, name: e.name, calories: e.calories, protein: e.protein, carbs: e.carbs, fat: e.fat, meal: e.meal, qty: e.qty })
    .select().single();
  if (error || !data) return null;
  return rowToEntry(data);
}
export async function deleteEntry(id) {
  return supabase.from("entries").delete().eq("id", id);
}

// ── WEIGHTS ──────────────────────────────────────────────────────────────────
export async function loadWeights(userId) {
  const { data, error } = await supabase.from("weights").select("*").eq("user_id", userId).order("day");
  if (error || !data) return [];
  return data.map(r => ({ date: r.day, weight: Number(r.weight) }));
}
export async function upsertWeight(userId, date, weight) {
  return supabase.from("weights").upsert({ user_id: userId, day: date, weight });
}
export async function deleteWeight(userId, date) {
  return supabase.from("weights").delete().eq("user_id", userId).eq("day", date);
}

// ── ONE-TIME MIGRATION ───────────────────────────────────────────────────────
// When a user first signs in and the cloud has no profile yet, carry any data
// they'd saved locally (in this browser) up to their new account.
export async function migrateLocal(userId) {
  try {
    const prof = JSON.parse(localStorage.getItem("ft_profile") || "null");
    if (prof) await saveProfile(userId, prof);
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.startsWith("ft_entries_")) {
        const day = key.replace("ft_entries_", "");
        const arr = JSON.parse(localStorage.getItem(key) || "[]");
        for (const e of arr) await addEntry(userId, day, e);
      }
    }
    const weights = JSON.parse(localStorage.getItem("ft_weight") || "[]");
    for (const w of weights) await upsertWeight(userId, w.date, w.weight);
  } catch { /* ignore migration errors — not fatal */ }
}
