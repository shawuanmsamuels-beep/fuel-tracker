// Serverless function: receives Stripe events and updates the user's subscription
// status in Supabase. Verifies the Stripe signature so only real Stripe events act.
//
// We talk to Supabase via its REST API using plain fetch() (built into Node 20)
// instead of the @supabase/supabase-js SDK. The SDK is heavy and was failing to
// bundle on Netlify (the function crashed at startup with an empty log / 502).
// A simple fetch keeps this function tiny and reliable.
//
// Required Netlify env vars:
//   STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET, SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
const Stripe = require("stripe");

exports.handler = async (event) => {
  const secret = process.env.STRIPE_SECRET_KEY;
  const whSecret = process.env.STRIPE_WEBHOOK_SECRET;
  const supaUrl = process.env.SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!secret || !whSecret || !supaUrl || !serviceKey) {
    return { statusCode: 500, body: "Webhook not configured" };
  }

  const stripe = Stripe(secret);
  const sig = event.headers["stripe-signature"];
  let evt;
  try {
    const raw = event.isBase64Encoded ? Buffer.from(event.body, "base64").toString("utf8") : event.body;
    evt = stripe.webhooks.constructEvent(raw, sig, whSecret);
  } catch (err) {
    return { statusCode: 400, body: `Signature verification failed: ${err.message}` };
  }

  // Update matching profiles row(s) via the Supabase REST API.
  // column is "user_id" or "stripe_customer_id".
  const updateProfile = async (column, value, fields) => {
    const base = supaUrl.replace(/\/$/, "");
    const url = `${base}/rest/v1/profiles?${column}=eq.${encodeURIComponent(value)}`;
    const res = await fetch(url, {
      method: "PATCH",
      headers: {
        apikey: serviceKey,
        Authorization: `Bearer ${serviceKey}`,
        "Content-Type": "application/json",
        Prefer: "return=minimal",
      },
      body: JSON.stringify(fields),
    });
    if (!res.ok) {
      const text = await res.text();
      throw new Error(`Supabase update failed (${res.status}): ${text}`);
    }
  };

  try {
    if (evt.type === "checkout.session.completed") {
      const s = evt.data.object;
      if (s.client_reference_id) {
        await updateProfile("user_id", s.client_reference_id, {
          subscription_status: "active",
          stripe_customer_id: s.customer || null,
        });
      }
    } else if (evt.type === "customer.subscription.updated") {
      const sub = evt.data.object;
      const status = sub.status === "active" || sub.status === "trialing" ? "active" : "canceled";
      if (sub.metadata && sub.metadata.user_id) await updateProfile("user_id", sub.metadata.user_id, { subscription_status: status });
      else if (sub.customer) await updateProfile("stripe_customer_id", sub.customer, { subscription_status: status });
    } else if (evt.type === "customer.subscription.deleted") {
      const sub = evt.data.object;
      if (sub.metadata && sub.metadata.user_id) await updateProfile("user_id", sub.metadata.user_id, { subscription_status: "canceled" });
      else if (sub.customer) await updateProfile("stripe_customer_id", sub.customer, { subscription_status: "canceled" });
    }
    return { statusCode: 200, body: JSON.stringify({ received: true }) };
  } catch (e) {
    return { statusCode: 500, body: e.message };
  }
};
