# ClickBank — everything for the affiliate launch

Files in this folder, and when to use each:

| File | What it is |
|---|---|
| **CLICKBANK-SETUP.md** | The step-by-step vendor setup (start here). Honest about the ~$49.95 fee and the plan. |
| **sales-page.html** | The ClickBank **pitch page** — the twin of the Gumroad page, wired for ClickBank. Host on your custom domain. |
| **thank-you.html** | The **download page** buyers land on after paying. Buyers-only (noindex). |
| **affiliate-marketplace-listing.md** | Marketplace blurb + swipe copy for affiliates (paste into ClickBank + your Affiliate Tools page). |
| **affiliate-program-launch-posts.md** | 10 social posts recruiting affiliates once you're live. |

## Before the pages go live — 2 find-and-replace jobs

1. **sales-page.html** → replace **`CLICKBANK_ORDER_LINK`** with your ClickBank
   order-form URL (3 buy buttons: hero, buy section, final CTA).
2. **thank-you.html** → replace **`DOWNLOAD_LINK`** with the direct URL to your
   kit PDF (2 spots: the button + the "right-click" fallback link).

## Order of operations

1. Do the steps in **CLICKBANK-SETUP.md** (account → activation → host these two
   pages on your domain → add the product → approval).
2. ClickBank gives you the order-form link → paste it into **sales-page.html**.
3. Host your PDF → paste that link into **thank-you.html**.
4. Enable the marketplace listing (use **affiliate-marketplace-listing.md**).
5. Recruit affiliates with **affiliate-program-launch-posts.md** (fill in the
   `[AFFILIATE SIGNUP LINK]` / `[KIT LINK]` placeholders first).

> Note: the guarantee on the ClickBank pages is **60 days** (ClickBank enforces
> its own 60-day policy) — that's intentional and differs from the 30-day text on
> the Gumroad page.
