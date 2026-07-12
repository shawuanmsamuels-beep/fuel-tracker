# Selling on ClickBank — an honest setup guide

> Goal: list a product on the **ClickBank marketplace** so *affiliates* (other
> people with audiences) promote it for you and earn a commission on each sale.
> You get clicks and sales you didn't have to chase yourself. That's the dream —
> here's the real cost, the real work, and the smartest way in.

---

## Read this first (the honest part)

ClickBank is **not** like Gumroad. Three things surprise people:

1. **It costs money to start.** ClickBank charges a **one-time ~$49.95 vendor
   activation fee** when you list your first product. (Your Brand Brief says
   "$0 budget" — this breaks that rule. It's a real, small investment, not free.)
2. **ClickBank becomes your checkout.** Affiliates can't just link to your
   Gumroad or Netlify page. The sale has to go *through ClickBank* so it can
   track the affiliate and split the money. You keep Gumroad for direct sales;
   ClickBank is a **second, parallel checkout** built for affiliates.
3. **You need two real pages on your own domain** (details below) and your
   product goes through a short **approval review** before it's live.

**So is it worth it?** Only if you actually want an affiliate army selling for
you. If you just want a buy button, Gumroad (already set up) is better. ClickBank
earns its fee when *other people's audiences* start sending you sales.

---

## Which of your products fits ClickBank? (pick ONE to start)

| Product | ClickBank fit | Why |
|---|---|---|
| **Ship It Without Code** ($19.99) | ✅ **Best first pick** | Pure digital, higher price = a commission worth an affiliate's time, "make money / build a product" is one of ClickBank's biggest categories. |
| **Fuel Tracker** ($9.99/mo) | ⚠️ Strong but harder | ClickBank *loves* recurring subscriptions (affiliates earn every month). But you'd move checkout off Stripe onto ClickBank — real integration work. Do this *second*, once you've learned the ropes. |
| **Gentle Potty Training** ($7.99) | ❌ Not a good fit | Sold on **Amazon KDP**, which controls its own checkout — you can't route it through ClickBank. Price is also too low to interest affiliates after ClickBank's cut. Keep this on Amazon + Gumroad + Pinterest. |

> **Recommendation: launch _Ship It Without Code_ on ClickBank first.** The rest of
> this guide uses it as the example. (Everything transfers to Fuel Tracker later.)

---

## What you need before you start (checklist)

- [ ] A **domain you control** (e.g. shawuanwrites.com) — ClickBank won't approve
      a `.netlify.app` subdomain as your primary pitch page in most cases; use a
      custom domain.
- [ ] A **Pitch Page** (your sales page) — you already have one:
      `marketing/ship-it-without-code/index.html`. It just needs to live on your
      domain and add a ClickBank buy link.
- [ ] A **Thank-You Page** — a page buyers land on *after paying*, where they get
      the download. ClickBank requires this be separate from the pitch page.
- [ ] The product file itself — your kit as a **PDF**.
- [ ] ~**$49.95** for the activation fee, and a bank account for payouts.

---

## Step-by-step

### Step 1 — Create your ClickBank account (~10 min)
1. Go to **clickbank.com** → **Sign Up**. Fill in your details.
2. Choose the **Seller (Vendor)** role — you're *selling*, not just promoting.
3. Complete your account/tax info so ClickBank can pay you.

### Step 2 — Pay the activation & set your account nickname (~5 min)
1. ClickBank asks for the **one-time activation fee** to publish your first product.
2. Pick your **account nickname** carefully — it's permanent and appears in every
   affiliate link. Something clean like `shipitnocode` or `shawuan`.

### Step 3 — Host your two pages on your domain (~30 min)
1. **Pitch page:** put `marketing/ship-it-without-code/index.html` live on your
   custom domain (e.g. `shawuanwrites.com/ship-it`). You can host it free on
   Netlify but point your **custom domain** at it.
2. **Thank-you page:** make a second simple page (e.g. `/ship-it/thank-you`) that
   says "Thanks — here's your download" with the PDF link. **Don't** make this
   page public/linkable from your site — only buyers should reach it.
3. On the pitch page, the buy button will point to your **ClickBank order-form
   link** (you get it in the next step), *not* to Gumroad.

### Step 4 — Add the product in ClickBank (~20 min)
1. In your ClickBank dashboard: **Account Settings → My Products → Add Product**.
2. Choose **Digital – Standard**, one-time payment.
3. **Product title:** `Ship It Without Code — 50 AI Prompts to Build & Launch Your First Paid Product`
4. **Price:** `19.99`
5. **Pitch Page URL:** your domain sales page from Step 3.
6. **Thank-You Page URL:** your thank-you page from Step 3.
7. Save. ClickBank gives you an **order-form / buy link** — put *that* on your
   pitch page's buy buttons (replace the Gumroad `BUY_LINK`s for the ClickBank
   version of the page; keep a Gumroad copy for direct traffic if you like).

### Step 5 — Submit for approval & test (~1–3 days)
1. Submit the product. ClickBank reviews the pages (they check the pitch page,
   pricing, and that the thank-you/download works).
2. They'll send a **test purchase** flow — run it, confirm the PDF delivers.
3. Once approved, the product is **live**.

### Step 6 — List it in the Affiliate Marketplace & set commission (~15 min)
This is the whole point — making affiliates *want* to promote you.
1. In the product settings, **enable the Affiliate Marketplace listing**.
2. **Set the commission %.** For a digital info-product, **50–75%** is normal and
   is what gets affiliates to notice you. Yes, that's a lot — but 60% of a sale
   you'd never have made beats 100% of nothing. Start at **60%**.
3. Write your **marketplace blurb** and add an **Affiliate Tools page** link —
   both are already drafted for you in
   **`affiliate-marketplace-listing.md`** (next file over). Paste them in.

---

## After you're live — how sales actually start

Listing on the marketplace is necessary but **not enough**. On day one you'll
have "gravity" (ClickBank's popularity score) of zero, so affiliates won't find
you by browsing. You have to **recruit your first few affiliates**:

1. **Publish your Affiliate Tools page** (see the listing file) so affiliates
   have swipe copy, banners, and their commission spelled out.
2. **Reach out** to small creators/bloggers in the "build a product / side
   hustle / no-code" space — offer them your ClickBank affiliate link. One or
   two who post get you your first sales.
3. **Promote it yourself too.** You can use your *own* affiliate link and stack
   your existing marketing (content-agent posts, YouTube, LinkedIn story) on top.
4. **Get a few sales → gravity rises → affiliates start finding you organically.**
   It compounds, but the first push is manual. One step at a time.

---

## Common gotchas (save yourself the headache)

- **Don't** point ClickBank at your Gumroad or Amazon link — the sale must run
  through ClickBank or affiliates get nothing and you'll be rejected.
- **Do** keep the thank-you page unlinked from your site (buyers-only), or people
  grab the download without paying.
- **Refund reality:** ClickBank enforces its own **60-day money-back guarantee**
  on most products — bake that into your expectations.
- **Fees:** ClickBank takes a per-sale cut (roughly ~7.5% + $1) *before* the
  affiliate split. So on $19.99 at 60% commission, you net a smaller slice — but
  again, it's incremental sales you weren't getting.
- **Fuel Tracker later:** when you're ready, recurring subscriptions are
  ClickBank's sweet spot (affiliates earn on every rebill). That's a bigger
  integration job — flag me and we'll plan it as its own project.

---

## TL;DR

1. ClickBank isn't free ($49.95) and becomes your checkout — worth it *only* if
   you want affiliates selling for you.
2. **Start with Ship It Without Code.** Skip Gentle Potty Training (Amazon-locked).
   Do Fuel Tracker second.
3. Host a pitch page + thank-you page on your domain, add the product, list it in
   the marketplace at **~60% commission**, then **recruit your first affiliates**.
4. Use the ready-made copy in `affiliate-marketplace-listing.md`.
