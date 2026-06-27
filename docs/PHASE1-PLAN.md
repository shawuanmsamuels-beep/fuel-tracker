# Fuel Tracker — Project Status & Phase 1 Plan

> Hand-off doc so a fresh session (or future me) can continue seamlessly.
> Owner is a **beginner** — explain everything in plain English, explain why each
> file/command/agent exists before using it, and do a short strategist analysis
> before building. Keep the landing page **dark** (the owner likes it); brightening
> applies to the in-app tracker only.

## Hand-off prompt to start tomorrow
> "Continue Fuel Tracker. We finished the UI polish, weight tracking, brightened
> tracker, and improved search — all live on Netlify. Today is **Phase 1: add
> Supabase accounts + cloud sync.** Read docs/PHASE1-PLAN.md first."

---

## What the app is
- **Fuel Tracker** — a calorie + macro tracking web app, intended to launch as a **paid product**.
- **Stack:** React + Vite, single main file `src/App.jsx`. Styling is inline styles.
- **Fonts:** Syne (headings) + DM Mono (body), loaded in `index.html`.
- **Data today:** browser-only (`localStorage`) — keys `ft_profile`, `ft_entries_<date>`, `ft_weight`. No backend yet.
- **Food data:** Open Food Facts public API (in `searchFoods()`), sorted by popularity.
- **Hosting:** Netlify project **fueltracker-app**, live at **fueltracker-app.netlify.app**.
  **Auto-deploys from the `main` branch** — merge to `main` = live in ~1–2 min.
- **Repo:** `shawuanmsamuels-beep/fuel-tracker`. Working branch: `claude/nice-dijkstra-qeul7y`.
  Convention: develop on the branch → PR → merge to `main` to publish.

## Done so far (all live)
- ✅ UI polish: fonts load early in `index.html`; tracker centered in a max-width column.
- ✅ Weight tracking: a **Weight** tab — log weigh-ins, SVG progress chart, Current/Start/Change stats, editable history. Saved under `ft_weight`.
- ✅ Cleanup: removed corrupted `src/index.html`, duplicate `src/vite.config.js`, unused `useCallback`, redundant font `@import`s.
- ✅ Brightened tracker: softer dark background (`#14151f`), lighter cards (`#1f2130`), explicit light text so food names are readable, brighter tabs/labels, soft card shadows, lighter search dropdown.
- ✅ Search icon + hover highlights (`.ft-tab` / `.ft-row` / `.ft-item` CSS in the app-view `<style>`), and popularity-sorted/de-duped food search.
- ✅ **Phase 1 COMPLETE (live & verified):** Supabase accounts + cloud sync. Signup/login,
  cloud-stored profile/entries/weights, one-time local→cloud migration, log-out button.
  Verified: entry persists across logout→login. Supabase **Site URL** set to the
  Netlify URL. Supabase publishable URL+key are baked into `src/supabase.js` (public-safe,
  RLS-protected), so no Netlify env vars are needed.
  NOTE: email confirmation is still **ON** in Supabase (new users must click the
  confirmation email — which now correctly opens the live app). Can be turned off in
  Authentication → Providers → Email if instant signup is preferred.

## Known follow-ups / quality ideas
- Food search is the **free** Open Food Facts DB — still imperfect for very generic terms.
- `calorie-tracker (1).pdf` sits in the repo (owner's file — left untouched).
- A real **privacy policy** is needed before storing user data / taking payments.

---

# Phase 1 — Accounts + Cloud Sync (Supabase)

**Goal:** users sign up / log in and their data follows them across devices,
instead of being trapped in one browser.

**Why a backend:** the app is currently static (runs only in the browser).
Accounts + sync need a server + database. **Supabase** = the beginner-friendly
choice (hosted auth + Postgres database, generous free tier).

### What we'll build (3 pieces)
1. **Login/signup screen** (email + password) styled to match the dark theme,
   shown before the tracker. Supabase handles login/logout/password-reset.
2. **Cloud save:** change saving so profile, food entries, and weights write to
   Supabase (tagged to the logged-in user) — not just `localStorage`.
3. **Sync + migration:** on login, pull the user's data from the cloud; carry any
   existing local data up to their account the first time so nothing is lost.

### Owner's prep (before/at start of Phase 1)
1. Create a free **Supabase** account at supabase.com (can sign up with GitHub).
2. Create a new **project** (name e.g. `fuel-tracker`, pick a nearby region, save
   the generated DB password).
3. That's it — tomorrow we copy two values into the app: the **Project URL** and
   the public **anon key**.

### What Claude will handle
- Install the Supabase client library; add a small `supabase.js` config.
- Create the database tables (e.g. `profiles`, `entries`, `weights`).
- Set up **Row-Level Security** so each user can only read/write their own rows.
- Build the auth UI and rewire the save/load logic; implement the migration.
- Test that two browsers/devices show the same data.

### Security notes
- The **anon key is safe in the front-end** (public by design); data is protected
  by Row-Level Security rules.
- Any **secret** keys (e.g. Stripe, later) go in **Netlify environment variables**,
  never in the code.
- Free tier is plenty to launch.

---

# Phase 2 — Payments (in progress)

## CURRENT STATUS (resume here)
- ✅ **Stage 2a (trial + gating) — DONE & live.** `accessInfo()` in `src/cloud.js`;
  Paywall + "trial days left" banner in `src/App.jsx`. Columns `subscription_status`
  (default 'trialing') and `trial_ends_at` (default now()+7 days) added to `profiles`.
- ✅ **Stage 2b code — BUILT & deployed, but INERT until Netlify env vars are set.**
  - `netlify/functions/create-checkout.js` (opens Stripe Checkout)
  - `netlify/functions/stripe-webhook.js` (verifies events → updates `subscription_status` via Supabase service key)
  - Paywall "Subscribe" button calls create-checkout; app re-checks status on `?checkout=success`.
  - `netlify.toml` has functions dir + Node 20; `stripe` is a dependency.
- ✅ Privacy Policy + Terms of Service pages added (footer links).
- ⛔ **BLOCKED:** owner is locked out of Stripe (2FA reset in progress, ~12h). Stage 2b
  finishes once they're back in.

## Remaining steps to finish Stage 2b (when Stripe is accessible)
1. **Supabase SQL:** `alter table public.profiles add column if not exists stripe_customer_id text;`
2. **Stripe (TEST mode):** create a $9.99/month recurring Price → copy the **price_… ID**;
   copy the **sk_test_… secret key**.
3. **Supabase:** copy the **service key** (sb_secret_… / service_role) for the webhook.
4. **Netlify env vars** (Site config → Environment variables — include a VALUE!):
   `STRIPE_SECRET_KEY`, `STRIPE_PRICE_ID`, `SUPABASE_URL` (https://wgnkqonwclypjpfrcgzu.supabase.co),
   `SUPABASE_SERVICE_ROLE_KEY`. Then **trigger a redeploy**.
5. **Stripe webhook:** add endpoint `https://fueltracker-app.netlify.app/.netlify/functions/stripe-webhook`,
   events: `checkout.session.completed`, `customer.subscription.updated`, `customer.subscription.deleted`.
   Copy the **whsec_… signing secret** → add as Netlify env var `STRIPE_WEBHOOK_SECRET` → redeploy.
6. **Test:** set a profile's `trial_ends_at` to the past → reload → Paywall → Subscribe →
   test card `4242 4242 4242 4242` (any future date/CVC/zip) → returns → unlocks (status 'active').
   Then cancel the sub in Stripe → webhook → status 'canceled' → app locks.

---

## Original Phase 2 notes

**DECISION (owner, leaning):** go with **Option B — full subscription gating.**
The owner wants a canceled subscription to **restrict access** to the app.

- **Option A (simple):** keep existing **Stripe Payment Links** (already in the app).
  Money reaches the owner, but the app can't auto-unlock per user. (Not chosen.)
- **Option B (full, chosen):** Stripe Checkout + subscriptions with a free trial that
  **auto-unlock/lock** the app based on payment status. Needs a serverless
  function (Netlify Functions) + a Stripe webhook + a `subscription` status column
  on the `profiles` table in Supabase.

### Gating behavior (agreed design)
- A valid **free trial OR active subscription** is required to USE the tracker.
- On cancellation / lapse: the user can **still log in and their data is preserved**,
  but the tracker is replaced by a **"Your subscription ended — resubscribe"** wall.
- **Do NOT block login entirely** — that traps users out of their own data and
  invites chargebacks. Restrict *features*, not *login*. (Netflix model.)

### Rough Phase 2 build steps (for later)
1. Add a `subscription_status` (+ `trial_ends_at`) column to `profiles`.
2. Stripe Checkout for the trial/subscription (replace the static payment links).
3. Netlify serverless function + Stripe **webhook** to update `subscription_status`
   when payments succeed / subscriptions cancel.
4. Gate the `app` view: if status is not active/trialing → show the resubscribe wall.
5. Store the Stripe **secret key** + webhook secret as **Netlify env vars** (never in code).

Build accounts (Phase 1) **before** payment gating (Phase 2).
