// Serverless function: creates a Stripe Checkout session for a logged-in user.
// Runs on Netlify's server, so the Stripe SECRET key is never exposed to the browser.
// Required Netlify env vars: STRIPE_SECRET_KEY, STRIPE_PRICE_ID  (optional: SITE_URL)
const Stripe = require("stripe");

exports.handler = async (event) => {
  if (event.httpMethod !== "POST") {
    return { statusCode: 405, body: JSON.stringify({ error: "Method not allowed" }) };
  }
  const secret = process.env.STRIPE_SECRET_KEY;
  const priceId = process.env.STRIPE_PRICE_ID;
  const siteUrl = process.env.SITE_URL || "https://fueltracker-app.netlify.app";
  if (!secret || !priceId) {
    return { statusCode: 500, body: JSON.stringify({ error: "Payments are not configured yet." }) };
  }
  try {
    const stripe = Stripe(secret);
    const { userId, email } = JSON.parse(event.body || "{}");
    if (!userId) return { statusCode: 400, body: JSON.stringify({ error: "Missing userId" }) };

    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      line_items: [{ price: priceId, quantity: 1 }],
      client_reference_id: userId,                 // links the payment back to our user
      customer_email: email || undefined,
      subscription_data: { metadata: { user_id: userId } },
      success_url: `${siteUrl}/?checkout=success`,
      cancel_url: `${siteUrl}/?checkout=cancel`,
      allow_promotion_codes: true,
    });
    return { statusCode: 200, body: JSON.stringify({ url: session.url }) };
  } catch (e) {
    return { statusCode: 500, body: JSON.stringify({ error: e.message }) };
  }
};
