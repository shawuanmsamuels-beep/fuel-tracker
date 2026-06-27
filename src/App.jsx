import { useState, useEffect, useRef } from "react";
import {
  hasSupabase, getUser, onAuth, signUp, signIn, signOut,
  loadProfile, saveProfile, loadEntries, addEntry, deleteEntry,
  loadWeights, upsertWeight, deleteWeight, migrateLocal,
} from "./cloud";

// ── CONSTANTS ────────────────────────────────────────────────────────────────
const MC = { protein: "#FF6B6B", carbs: "#FFD93D", fat: "#6BCB77" };
const MEALS = ["Breakfast", "Lunch", "Dinner", "Snacks"];
const TODAY = new Date().toISOString().slice(0, 10);

const FEATURES = [
  { icon: "🔥", title: "Calorie Tracking", desc: "Log every meal in seconds with 3M+ foods from our live database." },
  { icon: "📊", title: "Macro Breakdown", desc: "Detailed protein, carb & fat ratios visualised in real time." },
  { icon: "🎯", title: "Personal Goals", desc: "Set your own calorie target based on your weight, height & goal." },
  { icon: "🍽️", title: "Meal Planner", desc: "Organise intake across Breakfast, Lunch, Dinner & Snacks." },
  { icon: "💾", title: "Auto-Save", desc: "Your logs save automatically — never lose a day's data." },
  { icon: "⚡", title: "Instant Insights", desc: "Know exactly where your calories come from at a glance." },
];

const TESTIMONIALS = [
  { initials: "JM", name: "Jordan M., 34", role: "Lost 22 lbs in 10 weeks", stars: 5, text: "I tried every app out there. Fuel Tracker is the only one I actually stuck with. Searched for 'Chipotle burrito bowl' and it was right there. Game changer." },
  { initials: "PS", name: "Priya S., 28", role: "Marathon runner, Boston qualifier", stars: 5, text: "The macro breakdown transformed my race prep. I finally hit my carb targets consistently. Shaved 8 minutes off my PR this spring." },
  { initials: "CR", name: "Carlos R., 41", role: "Down 35 lbs, kept it off 1 year", stars: 5, text: "I'm not a tech person but this app is dead simple. It remembers everything, the food search actually works, and I've logged every day for 14 months." },
];

const FAQS = [
  { q: "Do I need a credit card for the free trial?", a: "No. Your 7-day free trial starts the moment you sign up — no credit card required. You'll only be asked for payment details when your trial ends and you choose to continue." },
  { q: "What happens after the 7-day trial?", a: "After 7 days you'll be prompted to choose a plan. Monthly is $9.99/month, or save 34% with the Annual plan at $79/year. If you don't subscribe, your account remains but logging is paused." },
  { q: "Can I cancel anytime?", a: "Absolutely. Cancel with one click from your account settings — no phone calls, no hoops. If you cancel mid-cycle, you keep access until the end of your paid period." },
  { q: "Is there a money-back guarantee?", a: "Yes. If you're not satisfied within 30 days of your first paid charge, email us for a full refund — no questions asked." },
  { q: "How big is the food database?", a: "Fuel Tracker connects to Open Food Facts — a community-verified database of over 3 million foods worldwide including restaurant meals, branded products, and whole foods." },
  { q: "Does my data save if I close the app?", a: "Yes. All your logs are automatically saved to your device so your data is there when you come back, even without an internet connection." },
  { q: "Can I set my own calorie goal?", a: "Yes. During onboarding you set your name, weight, height, age, and goal (lose / maintain / gain). We calculate a personalised daily calorie target you can adjust anytime in Settings." },
  { q: "What devices does Fuel Tracker work on?", a: "Fuel Tracker is a web app that works beautifully on any device — iPhone, Android, desktop, or tablet. Native iOS and Android apps are coming in Q3 2026." },
  { q: "Is my data private?", a: "Your nutrition data is stored locally on your device and never sold to third parties. We take privacy seriously — see our Privacy Policy for full details." },
];

// ── STORAGE HELPERS ──────────────────────────────────────────────────────────
const LS = {
  get: (k, fallback = null) => { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : fallback; } catch { return fallback; } },
  set: (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch {} },
};

// ── CALORIE CALCULATOR ───────────────────────────────────────────────────────
function calcGoal(profile) {
  if (!profile) return 2000;
  const { weight, height, age, sex, goal } = profile;
  const w = parseFloat(weight) || 70, h = parseFloat(height) || 170, a = parseFloat(age) || 30;
  const bmr = sex === "female" ? 10 * w + 6.25 * h - 5 * a - 161 : 10 * w + 6.25 * h - 5 * a + 5;
  const tdee = bmr * 1.4;
  return Math.round(goal === "lose" ? tdee - 500 : goal === "gain" ? tdee + 300 : tdee);
}

// ── OPEN FOOD FACTS API ──────────────────────────────────────────────────────
async function fetchOFF(query) {
  const res = await fetch(
    `https://world.openfoodfacts.org/cgi/search.pl?search_terms=${encodeURIComponent(query)}&search_simple=1&action=process&json=1&page_size=40&sort_by=unique_scans_n&fields=product_name,nutriments,brands,serving_size`
  );
  const data = await res.json();
  const seen = new Set();
  return (data.products || [])
    .filter(p => p.product_name && p.nutriments?.["energy-kcal_100g"] > 0)
    .map(p => ({
      name: [p.brands, p.product_name].filter(Boolean).join(" — ").trim().slice(0, 60),
      calories: Math.round(p.nutriments["energy-kcal_100g"] || 0),
      protein: Math.round((p.nutriments["proteins_100g"] || 0) * 10) / 10,
      carbs: Math.round((p.nutriments["carbohydrates_100g"] || 0) * 10) / 10,
      fat: Math.round((p.nutriments["fat_100g"] || 0) * 10) / 10,
      serving: p.serving_size || "100g",
    }))
    .filter(p => { const k = p.name.toLowerCase(); if (seen.has(k)) return false; seen.add(k); return true; });
}

async function searchFoods(query) {
  const q = (query || "").trim();
  if (q.length < 2) return [];
  try {
    let results = await fetchOFF(q);
    // If a plural term comes back empty, retry with the singular (e.g. "eggs" → "egg")
    if (results.length === 0 && q.length > 3 && q.toLowerCase().endsWith("s")) {
      results = await fetchOFF(q.slice(0, -1));
    }
    // Float results whose name actually contains the search term to the top
    const ql = q.toLowerCase();
    results.sort((a, b) => Number(b.name.toLowerCase().includes(ql)) - Number(a.name.toLowerCase().includes(ql)));
    return results.slice(0, 15);
  } catch { return []; }
}

// ── RING CHART ───────────────────────────────────────────────────────────────
function RingChart({ consumed, goal }) {
  const pct = Math.min(consumed / goal, 1);
  const r = 70, circ = 2 * Math.PI * r, over = consumed > goal;
  return (
    <svg width="180" height="180" viewBox="0 0 180 180">
      <circle cx="90" cy="90" r={r} fill="none" stroke="#1a1a2e" strokeWidth="14" />
      <circle cx="90" cy="90" r={r} fill="none" stroke={over ? "#FF6B6B" : "#C8F564"} strokeWidth="14"
        strokeDasharray={`${pct * circ} ${circ}`} strokeLinecap="round" transform="rotate(-90 90 90)"
        style={{ transition: "stroke-dasharray 0.6s cubic-bezier(.4,0,.2,1)" }} />
      <text x="90" y="82" textAnchor="middle" fill={over ? "#FF6B6B" : "#C8F564"} fontSize="28" fontWeight="800" fontFamily="'DM Mono',monospace">{consumed}</text>
      <text x="90" y="102" textAnchor="middle" fill="#666" fontSize="12" fontFamily="'DM Mono',monospace">/ {goal} kcal</text>
      <text x="90" y="118" textAnchor="middle" fill="#444" fontSize="11" fontFamily="'DM Mono',monospace">{over ? "OVER GOAL" : `${goal - consumed} left`}</text>
    </svg>
  );
}

// ── MACRO BAR ────────────────────────────────────────────────────────────────
function MacroBar({ protein, carbs, fat }) {
  const total = protein * 4 + carbs * 4 + fat * 9 || 1;
  const pP = (protein * 4 / total) * 100, pC = (carbs * 4 / total) * 100, pF = (fat * 9 / total) * 100;
  return (
    <div style={{ width: "100%" }}>
      <div style={{ display: "flex", borderRadius: 6, overflow: "hidden", height: 10, gap: 2, marginBottom: 10 }}>
        <div style={{ width: `${pP}%`, background: MC.protein, transition: "width .5s ease" }} />
        <div style={{ width: `${pC}%`, background: MC.carbs, transition: "width .5s ease" }} />
        <div style={{ width: `${pF}%`, background: MC.fat, transition: "width .5s ease" }} />
      </div>
      <div style={{ display: "flex", gap: 16, justifyContent: "center" }}>
        {[["P", protein, "protein"], ["C", carbs, "carbs"], ["F", fat, "fat"]].map(([l, v, k]) => (
          <div key={k} style={{ display: "flex", alignItems: "center", gap: 5 }}>
            <div style={{ width: 8, height: 8, borderRadius: 2, background: MC[k] }} />
            <span style={{ color: "#888", fontSize: 11, fontFamily: "'DM Mono',monospace" }}>{l} {Math.round(v)}g</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── WEIGHT CHART ─────────────────────────────────────────────────────────────
function WeightChart({ data }) {
  const W = 320, H = 150, padX = 12, padTop = 16, padBot = 24;
  if (data.length === 0) return null;
  const weights = data.map(d => d.weight);
  let min = Math.min(...weights), max = Math.max(...weights);
  if (min === max) { min -= 1; max += 1; }
  const chartW = W - padX * 2, chartH = H - padTop - padBot;
  const x = i => data.length === 1 ? W / 2 : padX + (i / (data.length - 1)) * chartW;
  const y = w => padTop + (1 - (w - min) / (max - min)) * chartH;
  const pts = data.map((d, i) => `${x(i)},${y(d.weight)}`).join(" ");
  const area = `${padX},${padTop + chartH} ${pts} ${padX + chartW},${padTop + chartH}`;
  const fmt = s => { const [, m, d] = s.split("-"); return `${+m}/${+d}`; };
  return (
    <svg width="100%" viewBox={`0 0 ${W} ${H}`} style={{ display: "block" }}>
      {[0, 0.5, 1].map(t => (
        <line key={t} x1={padX} x2={W - padX} y1={padTop + t * chartH} y2={padTop + t * chartH} stroke="#1a1a2e" strokeWidth="1" />
      ))}
      {data.length > 1 && <polygon points={area} fill="#C8F56415" />}
      {data.length > 1 && <polyline points={pts} fill="none" stroke="#C8F564" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />}
      {data.map((d, i) => (
        <circle key={i} cx={x(i)} cy={y(d.weight)} r={i === data.length - 1 ? 4 : 3} fill="#C8F564" stroke="#0d0d1a" strokeWidth="1.5" />
      ))}
      <text x={W - padX} y={padTop + 3} textAnchor="end" fill="#555" fontSize="9" fontFamily="'DM Mono',monospace">{max.toFixed(1)}</text>
      <text x={W - padX} y={padTop + chartH + 3} textAnchor="end" fill="#555" fontSize="9" fontFamily="'DM Mono',monospace">{min.toFixed(1)}</text>
      {data.length > 1 && <text x={padX} y={H - 6} textAnchor="start" fill="#555" fontSize="9" fontFamily="'DM Mono',monospace">{fmt(data[0].date)}</text>}
      <text x={W - padX} y={H - 6} textAnchor="end" fill="#555" fontSize="9" fontFamily="'DM Mono',monospace">{fmt(data[data.length - 1].date)}</text>
    </svg>
  );
}

// ── ONBOARDING ───────────────────────────────────────────────────────────────
function Onboarding({ onDone }) {
  const [step, setStep] = useState(0);
  const [form, setForm] = useState({ name: "", age: "", sex: "male", weight: "", height: "", goal: "lose" });
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const steps = [
    {
      title: "Hey! What's your name?",
      sub: "Let's make this personal.",
      content: (
        <input value={form.name} onChange={e => set("name", e.target.value)} placeholder="Your first name"
          style={{ width: "100%", padding: "14px 18px", background: "#0d0d1a", border: "1px solid #2a2a40", borderRadius: 12, color: "#e8e8f0", fontFamily: "'DM Mono',monospace", fontSize: 18, textAlign: "center" }} />
      ),
      valid: form.name.trim().length > 0,
    },
    {
      title: "Your goal?",
      sub: "We'll calculate your daily target.",
      content: (
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {[["lose", "🔥 Lose Weight", "Calorie deficit"], ["maintain", "⚖️ Stay the Same", "Maintenance calories"], ["gain", "💪 Build Muscle", "Calorie surplus"]].map(([val, label, sub]) => (
            <button key={val} onClick={() => set("goal", val)} style={{
              padding: "16px 20px", borderRadius: 12, border: "2px solid", textAlign: "left",
              borderColor: form.goal === val ? "#C8F564" : "#2a2a40",
              background: form.goal === val ? "#C8F56415" : "#0d0d1a",
              cursor: "pointer", color: "#e8e8f0",
            }}>
              <div style={{ fontFamily: "'Syne',sans-serif", fontWeight: 800, fontSize: 15 }}>{label}</div>
              <div style={{ fontSize: 11, color: "#666", marginTop: 3, fontFamily: "'DM Mono',monospace" }}>{sub}</div>
            </button>
          ))}
        </div>
      ),
      valid: true,
    },
    {
      title: "A bit about you",
      sub: "Used only to calculate your calorie goal.",
      content: (
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <div style={{ display: "flex", gap: 8 }}>
            {["male", "female"].map(s => (
              <button key={s} onClick={() => set("sex", s)} style={{
                flex: 1, padding: "12px 0", borderRadius: 10, border: "2px solid",
                borderColor: form.sex === s ? "#C8F564" : "#2a2a40",
                background: form.sex === s ? "#C8F56415" : "#0d0d1a",
                color: form.sex === s ? "#C8F564" : "#666", cursor: "pointer",
                fontFamily: "'DM Mono',monospace", fontSize: 12, textTransform: "capitalize",
              }}>{s}</button>
            ))}
          </div>
          {[["Age", "age", "years"], ["Weight", "weight", "kg"], ["Height", "height", "cm"]].map(([label, key, unit]) => (
            <div key={key} style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <input type="number" value={form[key]} onChange={e => set(key, e.target.value)} placeholder={label}
                style={{ flex: 1, padding: "12px 14px", background: "#0d0d1a", border: "1px solid #2a2a40", borderRadius: 10, color: "#e8e8f0", fontFamily: "'DM Mono',monospace", fontSize: 14 }} />
              <span style={{ color: "#444", fontSize: 12, width: 30 }}>{unit}</span>
            </div>
          ))}
        </div>
      ),
      valid: form.age && form.weight && form.height,
    },
  ];

  const cur = steps[step];

  const finish = () => {
    const profile = { ...form, goal: form.goal };
    LS.set("ft_profile", profile);
    onDone(profile);
  };

  return (
    <div style={{ minHeight: "100vh", background: "#0d0d1a", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: 24, fontFamily: "'DM Mono',monospace" }}>
      <div style={{ width: "100%", maxWidth: 400 }}>
        {/* Logo */}
        <div style={{ textAlign: "center", marginBottom: 48 }}>
          <span style={{ fontFamily: "'Syne',sans-serif", fontWeight: 800, fontSize: 28, color: "#C8F564" }}>FUEL</span>
          <span style={{ fontFamily: "'Syne',sans-serif", fontWeight: 800, fontSize: 28 }}> TRACKER</span>
        </div>

        {/* Progress dots */}
        <div style={{ display: "flex", gap: 8, justifyContent: "center", marginBottom: 40 }}>
          {steps.map((_, i) => (
            <div key={i} style={{ width: i === step ? 24 : 8, height: 8, borderRadius: 4, background: i <= step ? "#C8F564" : "#2a2a40", transition: "all .3s" }} />
          ))}
        </div>

        <h2 style={{ fontFamily: "'Syne',sans-serif", fontWeight: 800, fontSize: 28, marginBottom: 8, textAlign: "center", color: "#e8e8f0" }}>{cur.title}</h2>
        <p style={{ color: "#666", textAlign: "center", marginBottom: 32, fontSize: 13 }}>{cur.sub}</p>

        {cur.content}

        <button onClick={() => cur.valid && (step < steps.length - 1 ? setStep(s => s + 1) : finish())}
          style={{
            width: "100%", marginTop: 28, padding: "16px 0", borderRadius: 12, border: "none",
            background: cur.valid ? "#C8F564" : "#1e1e30", color: cur.valid ? "#0d0d1a" : "#444",
            fontFamily: "'Syne',sans-serif", fontWeight: 800, fontSize: 16, cursor: cur.valid ? "pointer" : "default",
            transition: "all .2s",
          }}>
          {step < steps.length - 1 ? "Continue →" : "Let's go! 🚀"}
        </button>

        {step > 0 && (
          <button onClick={() => setStep(s => s - 1)} style={{ width: "100%", marginTop: 12, padding: "12px 0", background: "none", border: "none", color: "#444", cursor: "pointer", fontSize: 12 }}>← Back</button>
        )}
      </div>
    </div>
  );
}

// ── TRACKER APP ──────────────────────────────────────────────────────────────
function TrackerApp({ profile, onBack, embedded = false, userId = null, onLogout }) {
  const goal = calcGoal(profile);
  const storageKey = `ft_entries_${TODAY}`;

  const [entries, setEntries] = useState(() => LS.get(storageKey, []));
  const [search, setSearch] = useState("");
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [selectedMeal, setSelectedMeal] = useState("Breakfast");
  const [qty, setQty] = useState(1);
  const [activeTab, setActiveTab] = useState("log");
  const [showDrop, setShowDrop] = useState(false);
  const [saved, setSaved] = useState(false);
  const [weights, setWeights] = useState(() => LS.get("ft_weight", []));
  const [weightInput, setWeightInput] = useState("");
  const debounceRef = useRef(null);

  // Persist entries
  useEffect(() => {
    LS.set(storageKey, entries);
    setSaved(true);
    const t = setTimeout(() => setSaved(false), 1500);
    return () => clearTimeout(t);
  }, [entries]);

  // Persist weight log (local cache)
  useEffect(() => { LS.set("ft_weight", weights); }, [weights]);

  // When logged in, load this user's data from the cloud (source of truth)
  useEffect(() => {
    if (!userId) return;
    let alive = true;
    (async () => {
      const [e, w] = await Promise.all([loadEntries(userId, TODAY), loadWeights(userId)]);
      if (!alive) return;
      setEntries(e);
      setWeights(w);
    })();
    return () => { alive = false; };
  }, [userId]);

  // Debounced food search
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (search.length < 2) { setResults([]); return; }
    debounceRef.current = setTimeout(async () => {
      setLoading(true);
      const foods = await searchFoods(search);
      setResults(foods);
      setLoading(false);
    }, 400);
  }, [search]);

  const totals = entries.reduce((a, e) => ({
    calories: a.calories + e.calories * e.qty,
    protein: a.protein + e.protein * e.qty,
    carbs: a.carbs + e.carbs * e.qty,
    fat: a.fat + e.fat * e.qty,
  }), { calories: 0, protein: 0, carbs: 0, fat: 0 });

  const addFood = async (food) => {
    const base = { ...food, meal: selectedMeal, qty: Number(qty) };
    setSearch(""); setResults([]); setShowDrop(false); setQty(1);
    if (userId) {
      const savedRow = await addEntry(userId, TODAY, base);
      setEntries(p => [...p, savedRow || { ...base, id: Date.now() }]);
    } else {
      setEntries(p => [...p, { ...base, id: Date.now() }]);
    }
  };

  const removeEntry = (id) => {
    setEntries(p => p.filter(e => e.id !== id));
    if (userId) deleteEntry(id);
  };
  const mealGroups = MEALS.map(m => ({
    meal: m,
    items: entries.filter(e => e.meal === m),
    total: entries.filter(e => e.meal === m).reduce((s, e) => s + e.calories * e.qty, 0),
  }));

  // Weight tracking
  const sortedWeights = [...weights].sort((a, b) => a.date.localeCompare(b.date));
  const todayWeight = weights.find(e => e.date === TODAY);
  const current = sortedWeights.length ? sortedWeights[sortedWeights.length - 1].weight : 0;
  const start = sortedWeights.length ? sortedWeights[0].weight : 0;
  const change = current - start;
  const changeColor = change === 0 ? "#888"
    : (change < 0 && profile?.goal === "lose") || (change > 0 && profile?.goal === "gain") ? "#C8F564"
    : (change > 0 && profile?.goal === "lose") || (change < 0 && profile?.goal === "gain") ? "#FF6B6B"
    : "#888";
  const fmtShort = s => { const [y, m, d] = s.split("-").map(Number); return new Date(y, m - 1, d).toLocaleDateString("en-US", { month: "short", day: "numeric" }); };

  const logWeight = () => {
    const w = parseFloat(weightInput);
    if (!w || w <= 0) return;
    setWeights(prev => [...prev.filter(e => e.date !== TODAY), { date: TODAY, weight: w }]);
    setWeightInput("");
    if (userId) upsertWeight(userId, TODAY, w);
  };
  const removeWeight = (date) => {
    setWeights(prev => prev.filter(e => e.date !== date));
    if (userId) deleteWeight(userId, date);
  };

  return (
    <div style={{ background: "#14151f", color: "#e8e8f0", fontFamily: "'DM Mono',monospace", ...(embedded ? { borderRadius: 16, overflow: "hidden", border: "1px solid #2c2d40", maxWidth: 420, margin: "0 auto" } : { minHeight: "100vh", maxWidth: 640, margin: "0 auto", borderLeft: "1px solid #2c2d40", borderRight: "1px solid #2c2d40" }) }}>
      {/* Header */}
      <div style={{ background: "linear-gradient(180deg,#23253a 0%,#14151f 100%)", padding: "20px 20px 16px", borderBottom: "1px solid #2c2d40", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div>
          <div style={{ display: "flex", alignItems: "baseline", gap: 6, marginBottom: 2 }}>
            <span style={{ fontFamily: "'Syne',sans-serif", fontSize: 20, fontWeight: 800, letterSpacing: -1, color: "#C8F564" }}>FUEL</span>
            <span style={{ fontFamily: "'Syne',sans-serif", fontSize: 20, fontWeight: 800, letterSpacing: -1 }}>TRACKER</span>
          </div>
          <div style={{ color: "#444", fontSize: 9, letterSpacing: 3 }}>{new Date().toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" }).toUpperCase()}</div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          {saved && <span style={{ fontSize: 10, color: "#C8F564", letterSpacing: 1 }}>✓ SAVED</span>}
          {profile && <div style={{ background: "#C8F56420", border: "1px solid #C8F56440", borderRadius: 20, padding: "5px 12px", fontSize: 11, color: "#C8F564", fontFamily: "'DM Mono',monospace" }}>{profile.name?.split(" ")[0]}</div>}
          {!embedded && userId && onLogout && <button onClick={onLogout} style={{ background: "none", border: "1px solid #2a2a40", color: "#888", borderRadius: 8, padding: "5px 12px", cursor: "pointer", fontFamily: "'DM Mono',monospace", fontSize: 10 }}>Log out</button>}
          {!embedded && !userId && onBack && <button onClick={onBack} style={{ background: "none", border: "1px solid #2a2a40", color: "#666", borderRadius: 8, padding: "5px 12px", cursor: "pointer", fontFamily: "'DM Mono',monospace", fontSize: 10 }}>← Exit</button>}
        </div>
      </div>

      {/* Goal bar */}
      <div style={{ padding: "10px 20px", background: "#14151f", borderBottom: "1px solid #2c2d40" }}>
        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 5 }}>
          <span style={{ fontSize: 10, color: "#8a8ca4", letterSpacing: 2 }}>DAILY GOAL</span>
          <span style={{ fontSize: 10, color: Math.round(totals.calories) > goal ? "#FF6B6B" : "#C8F564" }}>{Math.round(totals.calories)} / {goal} kcal</span>
        </div>
        <div style={{ height: 4, background: "#1a1a2e", borderRadius: 2, overflow: "hidden" }}>
          <div style={{ height: "100%", width: `${Math.min(totals.calories / goal * 100, 100)}%`, background: totals.calories > goal ? "#FF6B6B" : "#C8F564", borderRadius: 2, transition: "width .5s ease" }} />
        </div>
      </div>

      {/* Tabs */}
      <div style={{ display: "flex", borderBottom: "1px solid #2c2d40" }}>
        {["log", "summary", "weight"].map(tab => (
          <button key={tab} className="ft-tab" onClick={() => setActiveTab(tab)} style={{
            flex: 1, padding: "12px 0", border: "none", background: "none", cursor: "pointer",
            color: activeTab === tab ? "#C8F564" : "#9a9cb4", fontFamily: "'DM Mono',monospace",
            fontSize: 10, letterSpacing: 3, textTransform: "uppercase",
            borderBottom: activeTab === tab ? "2px solid #C8F564" : "2px solid transparent",
          }}>{tab}</button>
        ))}
      </div>

      {activeTab === "log" && (
        <div style={{ padding: "16px 16px 0", maxHeight: embedded ? 480 : "none", overflowY: "auto" }}>
          {/* Add food */}
          <div style={{ background: "#1f2130", boxShadow: "0 4px 14px rgba(0,0,0,.4)", borderRadius: 10, padding: 14, marginBottom: 16, border: "1px solid #2c2d40" }}>
            <div style={{ fontSize: 9, letterSpacing: 3, color: "#C8F564", marginBottom: 10 }}>ADD FOOD — 3M+ FOODS</div>
            <div style={{ display: "flex", gap: 5, marginBottom: 10, flexWrap: "wrap" }}>
              {MEALS.map(m => (
                <button key={m} onClick={() => setSelectedMeal(m)} style={{
                  padding: "4px 10px", borderRadius: 20, border: "1px solid",
                  borderColor: selectedMeal === m ? "#C8F564" : "#2a2a40",
                  background: selectedMeal === m ? "#C8F56420" : "transparent",
                  color: selectedMeal === m ? "#C8F564" : "#666",
                  fontFamily: "'DM Mono',monospace", fontSize: 10, cursor: "pointer",
                }}>{m}</button>
              ))}
            </div>
            <div style={{ position: "relative" }}>
              <span style={{ position: "absolute", left: 12, top: 20, transform: "translateY(-50%)", color: "#6a6c84", pointerEvents: "none", display: "flex" }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><circle cx="11" cy="11" r="7" /><line x1="21" y1="21" x2="16.5" y2="16.5" /></svg>
              </span>
              <input value={search}
                onChange={e => { setSearch(e.target.value); setShowDrop(true); }}
                onFocus={() => setShowDrop(true)}
                placeholder="Search any food, brand, or restaurant…"
                style={{ width: "100%", padding: "10px 12px 10px 34px", background: "#0d0d1a", border: "1px solid #3a3c52", borderRadius: 8, color: "#e8e8f0", fontFamily: "'DM Mono',monospace", fontSize: 12 }} />
              {showDrop && (search.length > 1) && (
                <div style={{ position: "absolute", top: "calc(100% + 4px)", left: 0, right: 0, background: "#262838", border: "1px solid #3a3c52", borderRadius: 8, zIndex: 100, maxHeight: 220, overflowY: "auto" }}>
                  {loading && <div style={{ padding: 14, fontSize: 11, color: "#a2a4bc", textAlign: "center" }}>Searching 3M+ foods…</div>}
                  {!loading && results.length === 0 && search.length > 1 && <div style={{ padding: 14, fontSize: 11, color: "#a2a4bc", textAlign: "center" }}>No results — try a different term</div>}
                  {results.map((f, i) => (
                    <div key={i} className="ft-row" onClick={() => addFood(f)} style={{ padding: "9px 12px", cursor: "pointer", display: "flex", justifyContent: "space-between", borderBottom: "1px solid #2c2d40", gap: 8 }}>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 12, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{f.name}</div>
                        <div style={{ fontSize: 10, color: "#a2a4bc", marginTop: 2 }}>P:{f.protein}g C:{f.carbs}g F:{f.fat}g per 100g</div>
                      </div>
                      <span style={{ color: "#C8F564", fontSize: 12, flexShrink: 0 }}>{f.calories} kcal</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 10 }}>
              <span style={{ color: "#444", fontSize: 10 }}>QTY</span>
              <button onClick={() => setQty(q => Math.max(0.5, Number(q) - 0.5))} style={{ width: 28, height: 28, background: "#1e1e30", border: "none", color: "#e8e8f0", borderRadius: 6, cursor: "pointer", fontSize: 16 }}>−</button>
              <span style={{ fontFamily: "'Syne',sans-serif", fontWeight: 800, fontSize: 15, minWidth: 22, textAlign: "center" }}>{qty}</span>
              <button onClick={() => setQty(q => Number(q) + 0.5)} style={{ width: 28, height: 28, background: "#1e1e30", border: "none", color: "#e8e8f0", borderRadius: 6, cursor: "pointer", fontSize: 16 }}>+</button>
              <span style={{ color: "#555", fontSize: 10, marginLeft: 4 }}>× 100g servings</span>
            </div>
          </div>

          {/* Meal groups */}
          {mealGroups.filter(g => g.items.length > 0).map(g => (
            <div key={g.meal} style={{ marginBottom: 14 }}>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6, padding: "0 2px" }}>
                <span style={{ fontSize: 9, letterSpacing: 3, color: "#C8F564" }}>{g.meal.toUpperCase()}</span>
                <span style={{ fontSize: 10, color: "#888" }}>{Math.round(g.total)} kcal</span>
              </div>
              <div style={{ background: "#1f2130", boxShadow: "0 4px 14px rgba(0,0,0,.4)", borderRadius: 8, overflow: "hidden", border: "1px solid #2c2d40" }}>
                {g.items.map((e, i) => (
                  <div key={e.id} className="ft-item" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 12px", borderBottom: i < g.items.length - 1 ? "1px solid #2c2d40" : "none" }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 12, marginBottom: 1, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{e.name}</div>
                      <div style={{ fontSize: 9, color: "#a2a4bc" }}>×{e.qty} · P:{Math.round(e.protein * e.qty)}g C:{Math.round(e.carbs * e.qty)}g F:{Math.round(e.fat * e.qty)}g</div>
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: 10, flexShrink: 0 }}>
                      <span style={{ color: "#C8F564", fontSize: 12 }}>{Math.round(e.calories * e.qty)}</span>
                      <button onClick={() => removeEntry(e.id)} style={{ background: "none", border: "none", color: "#FF6B6B", cursor: "pointer", opacity: 0.5, fontSize: 16 }}>×</button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}

          {entries.length === 0 && (
            <div style={{ textAlign: "center", padding: "32px 0", color: "#6a6c84" }}>
              <div style={{ fontSize: 36, marginBottom: 8 }}>🍽</div>
              <div style={{ fontSize: 10, letterSpacing: 2 }}>SEARCH FOR A FOOD TO GET STARTED</div>
            </div>
          )}
          <div style={{ height: 16 }} />
        </div>
      )}

      {activeTab === "summary" && (
        <div style={{ padding: "20px 16px" }}>
          <div style={{ display: "flex", justifyContent: "center", marginBottom: 20 }}>
            <RingChart consumed={Math.round(totals.calories)} goal={goal} />
          </div>
          <div style={{ background: "#1f2130", boxShadow: "0 4px 14px rgba(0,0,0,.4)", borderRadius: 10, padding: 16, border: "1px solid #2c2d40", marginBottom: 12 }}>
            <div style={{ fontSize: 9, letterSpacing: 3, color: "#C8F564", marginBottom: 12 }}>MACROS</div>
            <MacroBar protein={totals.protein} carbs={totals.carbs} fat={totals.fat} />
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
            {[["Protein", Math.round(totals.protein) + "g", MC.protein], ["Carbs", Math.round(totals.carbs) + "g", MC.carbs], ["Fat", Math.round(totals.fat) + "g", MC.fat], ["Remaining", Math.max(0, goal - Math.round(totals.calories)) + " kcal", "#C8F564"]].map(([label, val, color]) => (
              <div key={label} style={{ background: "#1f2130", boxShadow: "0 4px 14px rgba(0,0,0,.4)", borderRadius: 8, padding: "12px 14px", border: "1px solid #2c2d40" }}>
                <div style={{ fontSize: 9, color: "#8a8ca4", letterSpacing: 2, marginBottom: 4 }}>{label.toUpperCase()}</div>
                <div style={{ fontSize: 20, fontFamily: "'Syne',sans-serif", fontWeight: 800, color }}>{val}</div>
              </div>
            ))}
          </div>
          {mealGroups.some(g => g.items.length > 0) && (
            <div style={{ background: "#1f2130", boxShadow: "0 4px 14px rgba(0,0,0,.4)", borderRadius: 10, padding: 16, border: "1px solid #2c2d40", marginTop: 10 }}>
              <div style={{ fontSize: 9, letterSpacing: 3, color: "#C8F564", marginBottom: 14 }}>MEAL BREAKDOWN</div>
              {mealGroups.filter(g => g.items.length > 0).map(g => (
                <div key={g.meal} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
                  <div style={{ fontSize: 12, color: "#888", width: 70 }}>{g.meal}</div>
                  <div style={{ flex: 1, height: 4, background: "#1a1a2e", borderRadius: 2, margin: "0 12px", overflow: "hidden" }}>
                    <div style={{ height: "100%", width: `${Math.min(g.total / goal * 100, 100)}%`, background: "#C8F564", borderRadius: 2 }} />
                  </div>
                  <span style={{ fontSize: 12, color: "#C8F564", minWidth: 60, textAlign: "right" }}>{Math.round(g.total)} kcal</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {activeTab === "weight" && (
        <div style={{ padding: "20px 16px" }}>
          {/* Log today's weight */}
          <div style={{ background: "#1f2130", boxShadow: "0 4px 14px rgba(0,0,0,.4)", borderRadius: 10, padding: 16, border: "1px solid #2c2d40", marginBottom: 12 }}>
            <div style={{ fontSize: 9, letterSpacing: 3, color: "#C8F564", marginBottom: 12 }}>{todayWeight ? "UPDATE TODAY'S WEIGHT" : "LOG TODAY'S WEIGHT"}</div>
            <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
              <input type="number" value={weightInput} onChange={e => setWeightInput(e.target.value)}
                onKeyDown={e => e.key === "Enter" && logWeight()}
                placeholder={todayWeight ? `${todayWeight.weight} kg` : "Enter weight"}
                style={{ flex: 1, padding: "12px 14px", background: "#0d0d1a", border: "1px solid #2a2a40", borderRadius: 8, color: "#e8e8f0", fontFamily: "'DM Mono',monospace", fontSize: 14 }} />
              <span style={{ color: "#444", fontSize: 12 }}>kg</span>
              <button onClick={logWeight} disabled={!weightInput}
                style={{ padding: "0 18px", height: 42, background: weightInput ? "#C8F564" : "#1e1e30", color: weightInput ? "#0d0d1a" : "#555", border: "none", borderRadius: 8, cursor: weightInput ? "pointer" : "default", fontFamily: "'Syne',sans-serif", fontWeight: 800, fontSize: 13 }}>
                {todayWeight ? "Update" : "Save"}
              </button>
            </div>
          </div>

          {sortedWeights.length === 0 ? (
            <div style={{ textAlign: "center", padding: "32px 0", color: "#6a6c84" }}>
              <div style={{ fontSize: 36, marginBottom: 8 }}>📉</div>
              <div style={{ fontSize: 10, letterSpacing: 2 }}>LOG YOUR WEIGHT TO SEE PROGRESS</div>
            </div>
          ) : (
            <>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8, marginBottom: 12 }}>
                {[["Current", current.toFixed(1) + " kg", "#C8F564"], ["Start", start.toFixed(1) + " kg", "#888"], ["Change", (change > 0 ? "+" : "") + change.toFixed(1) + " kg", changeColor]].map(([label, val, color]) => (
                  <div key={label} style={{ background: "#1f2130", boxShadow: "0 4px 14px rgba(0,0,0,.4)", borderRadius: 8, padding: "12px 10px", border: "1px solid #2c2d40", textAlign: "center" }}>
                    <div style={{ fontSize: 9, color: "#8a8ca4", letterSpacing: 2, marginBottom: 4 }}>{label.toUpperCase()}</div>
                    <div style={{ fontSize: 17, fontFamily: "'Syne',sans-serif", fontWeight: 800, color }}>{val}</div>
                  </div>
                ))}
              </div>

              <div style={{ background: "#1f2130", boxShadow: "0 4px 14px rgba(0,0,0,.4)", borderRadius: 10, padding: 16, border: "1px solid #2c2d40", marginBottom: 12 }}>
                <div style={{ fontSize: 9, letterSpacing: 3, color: "#C8F564", marginBottom: 12 }}>PROGRESS</div>
                <WeightChart data={sortedWeights} />
              </div>

              <div style={{ background: "#1f2130", boxShadow: "0 4px 14px rgba(0,0,0,.4)", borderRadius: 10, padding: "8px 0", border: "1px solid #2c2d40" }}>
                {[...sortedWeights].reverse().map((e, i, arr) => (
                  <div key={e.date} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "9px 16px", borderBottom: i < arr.length - 1 ? "1px solid #1e1e30" : "none" }}>
                    <span style={{ fontSize: 11, color: "#888", fontFamily: "'DM Mono',monospace" }}>{fmtShort(e.date)}{e.date === TODAY ? " · Today" : ""}</span>
                    <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                      <span style={{ fontSize: 13, color: "#C8F564", fontFamily: "'DM Mono',monospace" }}>{e.weight.toFixed(1)} kg</span>
                      <button onClick={() => removeWeight(e.date)} style={{ background: "none", border: "none", color: "#FF6B6B", cursor: "pointer", opacity: 0.5, fontSize: 16 }}>×</button>
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}

// ── PRICING CARD ─────────────────────────────────────────────────────────────
function PricingCard({ plan, price, period, badge, features, cta, ctaLink, highlight }) {
  return (
    <div style={{
      background: highlight ? "linear-gradient(135deg,#C8F564 0%,#a8e044 100%)" : "#13132a",
      border: highlight ? "none" : "1px solid #2a2a40",
      borderRadius: 20, padding: "32px 28px", flex: 1, minWidth: 260,
      position: "relative", color: highlight ? "#0d0d1a" : "#e8e8f0",
      boxShadow: highlight ? "0 20px 60px #C8F56440" : "none",
      transform: highlight ? "scale(1.04)" : "scale(1)",
    }}>
      {badge && (
        <div style={{ position: "absolute", top: -14, left: "50%", transform: "translateX(-50%)", background: "#0d0d1a", color: "#C8F564", fontSize: 10, letterSpacing: 3, padding: "5px 16px", borderRadius: 20, border: "1px solid #C8F564", fontFamily: "'DM Mono',monospace", whiteSpace: "nowrap" }}>{badge}</div>
      )}
      <div style={{ fontFamily: "'DM Mono',monospace", fontSize: 11, letterSpacing: 3, opacity: 0.6, marginBottom: 8 }}>{plan}</div>
      <div style={{ display: "flex", alignItems: "baseline", gap: 4, marginBottom: 4 }}>
        <span style={{ fontFamily: "'Syne',sans-serif", fontWeight: 800, fontSize: 44 }}>{price}</span>
        <span style={{ fontFamily: "'DM Mono',monospace", fontSize: 13, opacity: 0.6 }}>{period}</span>
      </div>
      <div style={{ fontFamily: "'DM Mono',monospace", fontSize: 11, marginBottom: 24, opacity: 0.8, background: highlight ? "#0d0d1a20" : "#C8F56415", borderRadius: 8, padding: "8px 12px" }}>
        🎉 FREE for 7 days · then {price}{period}
      </div>
      <div style={{ marginBottom: 28 }}>
        {features.map(f => (
          <div key={f} style={{ display: "flex", gap: 10, marginBottom: 10, alignItems: "flex-start" }}>
            <span style={{ color: highlight ? "#0d0d1a" : "#C8F564", fontWeight: 800, fontSize: 14, marginTop: 1 }}>✓</span>
            <span style={{ fontFamily: "'DM Mono',monospace", fontSize: 12, lineHeight: 1.5, opacity: 0.85 }}>{f}</span>
          </div>
        ))}
      </div>
      <a href={ctaLink} target="_blank" rel="noopener noreferrer" style={{
        display: "block", textAlign: "center", padding: "14px 0",
        background: highlight ? "#0d0d1a" : "#C8F564",
        color: highlight ? "#C8F564" : "#0d0d1a",
        borderRadius: 12, fontFamily: "'Syne',sans-serif", fontWeight: 800,
        fontSize: 14, letterSpacing: 1, textDecoration: "none",
        boxShadow: highlight ? "none" : "0 4px 20px #C8F56430",
      }}>{cta}</a>
      <div style={{ textAlign: "center", marginTop: 12, fontSize: 10, opacity: 0.5, fontFamily: "'DM Mono',monospace" }}>30-day money-back guarantee</div>
    </div>
  );
}

// ── FAQ ───────────────────────────────────────────────────────────────────────
function FAQ() {
  const [open, setOpen] = useState(null);
  return (
    <section id="faq" style={{ padding: "100px 24px", maxWidth: 800, margin: "0 auto" }}>
      <div style={{ textAlign: "center", marginBottom: 64 }}>
        <div style={{ fontSize: 10, letterSpacing: 4, color: "#C8F564", marginBottom: 16 }}>GOT QUESTIONS?</div>
        <h2 style={{ fontFamily: "'Syne',sans-serif", fontWeight: 800, fontSize: "clamp(28px,4vw,48px)", letterSpacing: -1 }}>We've got answers.</h2>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        {FAQS.map((faq, i) => (
          <div key={i} onClick={() => setOpen(open === i ? null : i)} style={{
            background: "#13132a", border: "1px solid", borderColor: open === i ? "#C8F56440" : "#1e1e30",
            borderRadius: 14, overflow: "hidden", cursor: "pointer", transition: "border-color .2s",
          }}>
            <div style={{ padding: "18px 22px", display: "flex", justifyContent: "space-between", alignItems: "center", gap: 16 }}>
              <span style={{ fontFamily: "'DM Mono',monospace", fontSize: 14, color: open === i ? "#C8F564" : "#e8e8f0", lineHeight: 1.4 }}>{faq.q}</span>
              <span style={{ color: "#C8F564", fontSize: 20, flexShrink: 0, transform: open === i ? "rotate(45deg)" : "none", transition: "transform .2s" }}>+</span>
            </div>
            {open === i && (
              <div style={{ padding: "0 22px 20px", color: "#888", fontSize: 13, lineHeight: 1.8, fontFamily: "'DM Mono',monospace", borderTop: "1px solid #1e1e30", paddingTop: 16 }}>
                {faq.a}
              </div>
            )}
          </div>
        ))}
      </div>
    </section>
  );
}

// ── AUTH (LOGIN / SIGN UP) ───────────────────────────────────────────────────
function Auth({ onAuthed }) {
  const [mode, setMode] = useState("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");

  const inputStyle = { width: "100%", padding: "13px 16px", background: "#0d0d1a", border: "1px solid #2a2a40", borderRadius: 10, color: "#e8e8f0", fontFamily: "'DM Mono',monospace", fontSize: 14 };

  const submit = async () => {
    setError(""); setInfo("");
    if (!email || !password) { setError("Enter your email and password."); return; }
    if (password.length < 6) { setError("Password must be at least 6 characters."); return; }
    setBusy(true);
    const { data, error } = await (mode === "signup" ? signUp : signIn)(email.trim(), password);
    setBusy(false);
    if (error) { setError(error.message); return; }
    if (mode === "signup" && !data?.session) {
      setInfo("Account created! Check your email to confirm, then log in.");
      setMode("login");
      return;
    }
    onAuthed();
  };

  return (
    <div style={{ minHeight: "100vh", background: "#0d0d1a", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: 24, fontFamily: "'DM Mono',monospace" }}>
      <div style={{ width: "100%", maxWidth: 380 }}>
        <div style={{ textAlign: "center", marginBottom: 32 }}>
          <span style={{ fontFamily: "'Syne',sans-serif", fontWeight: 800, fontSize: 28, color: "#C8F564" }}>FUEL</span>
          <span style={{ fontFamily: "'Syne',sans-serif", fontWeight: 800, fontSize: 28 }}> TRACKER</span>
        </div>
        <h2 style={{ fontFamily: "'Syne',sans-serif", fontWeight: 800, fontSize: 24, marginBottom: 6, textAlign: "center", color: "#e8e8f0" }}>{mode === "signup" ? "Create your account" : "Welcome back"}</h2>
        <p style={{ color: "#888", textAlign: "center", marginBottom: 24, fontSize: 12, lineHeight: 1.6 }}>{mode === "signup" ? "Start free — your data syncs across all your devices." : "Log in to access your tracker."}</p>

        <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="Email" autoComplete="email" style={inputStyle} />
        <input type="password" value={password} onChange={e => setPassword(e.target.value)} onKeyDown={e => e.key === "Enter" && submit()} placeholder="Password" autoComplete={mode === "signup" ? "new-password" : "current-password"} style={{ ...inputStyle, marginTop: 10 }} />

        {error && <div style={{ color: "#FF6B6B", fontSize: 12, marginTop: 12, textAlign: "center", lineHeight: 1.5 }}>{error}</div>}
        {info && <div style={{ color: "#C8F564", fontSize: 12, marginTop: 12, textAlign: "center", lineHeight: 1.5 }}>{info}</div>}

        <button onClick={submit} disabled={busy} style={{ width: "100%", marginTop: 18, padding: "14px 0", borderRadius: 12, border: "none", background: busy ? "#1e1e30" : "#C8F564", color: busy ? "#666" : "#0d0d1a", fontFamily: "'Syne',sans-serif", fontWeight: 800, fontSize: 15, cursor: busy ? "default" : "pointer" }}>
          {busy ? "Please wait…" : mode === "signup" ? "Create account" : "Log in"}
        </button>

        <div style={{ textAlign: "center", marginTop: 16, fontSize: 12, color: "#888" }}>
          {mode === "signup" ? "Already have an account? " : "New here? "}
          <span onClick={() => { setMode(mode === "signup" ? "login" : "signup"); setError(""); setInfo(""); }} style={{ color: "#C8F564", cursor: "pointer" }}>
            {mode === "signup" ? "Log in" : "Create one"}
          </span>
        </div>
      </div>
    </div>
  );
}

// ── LANDING PAGE ──────────────────────────────────────────────────────────────
export default function App() {
  const [view, setView] = useState("landing");
  const [profile, setProfile] = useState(() => LS.get("ft_profile", null));
  const [user, setUser] = useState(null);

  // Resolve a logged-in user → load (or first-time migrate) their cloud profile
  const resolveUser = async (u) => {
    setUser(u);
    if (!u) return null;
    let prof = await loadProfile(u.id);
    if (!prof && LS.get("ft_profile", null)) {
      await migrateLocal(u.id);
      prof = await loadProfile(u.id);
    }
    setProfile(prof);
    return prof;
  };

  // On load: restore any existing session; route to landing on sign-out
  useEffect(() => {
    if (!hasSupabase) return;
    let unsub;
    (async () => {
      const u = await getUser();
      if (u) await resolveUser(u);
      unsub = onAuth((u2) => {
        if (!u2) { setUser(null); setProfile(null); setView("landing"); }
      });
    })();
    return () => unsub && unsub();
  }, []);

  const handleStartTrial = async () => {
    if (!hasSupabase) { setView(profile ? "app" : "onboard"); return; }
    const u = user || await getUser();
    if (!u) { setView("auth"); return; }
    const prof = profile || await resolveUser(u);
    setView(prof ? "app" : "onboard");
  };

  const handleLogout = async () => { await signOut(); };

  const scrollTo = (id) => document.getElementById(id)?.scrollIntoView({ behavior: "smooth" });

  if (view === "auth") return (
    <>
      <style>{`*{box-sizing:border-box;margin:0;padding:0}input{outline:none}`}</style>
      <Auth onAuthed={async () => {
        const u = await getUser();
        const prof = await resolveUser(u);
        setView(prof ? "app" : "onboard");
      }} />
    </>
  );

  if (view === "onboard") return (
    <>
      <style>{`*{box-sizing:border-box;margin:0;padding:0}input{outline:none}`}</style>
      <Onboarding onDone={async (p) => { if (user) await saveProfile(user.id, p); setProfile(p); setView("app"); }} />
    </>
  );

  if (view === "app") return (
    <>
      <style>{`*{box-sizing:border-box;margin:0;padding:0}input{outline:none}::-webkit-scrollbar{width:4px}::-webkit-scrollbar-thumb{background:#333;border-radius:4px}
        .ft-tab{transition:color .15s} .ft-tab:hover{color:#e8e8f0 !important}
        .ft-row{transition:background .15s} .ft-row:hover{background:#33354a !important}
        .ft-item{transition:background .15s} .ft-item:hover{background:#262838}`}</style>
      <TrackerApp profile={profile} userId={user?.id || null} onLogout={handleLogout} onBack={() => setView("landing")} />
    </>
  );

  // LANDING
  return (
    <div style={{ background: "#0d0d1a", color: "#e8e8f0", fontFamily: "'DM Mono',monospace", overflowX: "hidden" }}>
      <style>{`
        *{box-sizing:border-box;margin:0;padding:0} html{scroll-behavior:smooth}
        ::-webkit-scrollbar{width:4px} ::-webkit-scrollbar-thumb{background:#333;border-radius:4px}
        input{outline:none}
        @keyframes float{0%,100%{transform:translateY(0)}50%{transform:translateY(-10px)}}
        @keyframes fadeUp{from{opacity:0;transform:translateY(24px)}to{opacity:1;transform:translateY(0)}}
        @keyframes pulse{0%,100%{box-shadow:0 0 0 0 #C8F56440}50%{box-shadow:0 0 0 16px #C8F56400}}
        .hero-cta{animation:pulse 2.5s infinite}
        .feat-card:hover{border-color:#C8F56450!important;transform:translateY(-4px)}
        .feat-card{transition:all .25s}
        .nav-link:hover{color:#C8F564!important}
        .nav-link{transition:color .2s}
      `}</style>

      {/* NAV */}
      <nav style={{ position: "sticky", top: 0, zIndex: 100, background: "#0d0d1acc", backdropFilter: "blur(16px)", borderBottom: "1px solid #1e1e30", padding: "14px 32px", display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 12 }}>
        <div style={{ display: "flex", alignItems: "baseline", gap: 6 }}>
          <span style={{ fontFamily: "'Syne',sans-serif", fontWeight: 800, fontSize: 20, color: "#C8F564" }}>FUEL</span>
          <span style={{ fontFamily: "'Syne',sans-serif", fontWeight: 800, fontSize: 20 }}>TRACKER</span>
        </div>
        <div style={{ display: "flex", gap: 20, alignItems: "center", flexWrap: "wrap" }}>
          {[["Features", "features"], ["Pricing", "pricing"], ["Reviews", "reviews"], ["FAQ", "faq"]].map(([label, id]) => (
            <button key={id} className="nav-link" onClick={() => scrollTo(id)} style={{ background: "none", border: "none", color: "#666", cursor: "pointer", fontFamily: "'DM Mono',monospace", fontSize: 12, letterSpacing: 2 }}>{label}</button>
          ))}
          <button onClick={handleStartTrial} style={{ background: "#C8F564", color: "#0d0d1a", border: "none", borderRadius: 10, padding: "9px 20px", cursor: "pointer", fontFamily: "'Syne',sans-serif", fontWeight: 800, fontSize: 13 }}>Try Free →</button>
        </div>
      </nav>

      {/* HERO */}
      <section style={{ minHeight: "94vh", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "80px 24px 60px", textAlign: "center", position: "relative", overflow: "hidden" }}>
        <div style={{ position: "absolute", top: "10%", left: "5%", width: 400, height: 400, background: "#C8F56410", borderRadius: "50%", filter: "blur(90px)", pointerEvents: "none" }} />
        <div style={{ position: "absolute", bottom: "5%", right: "5%", width: 300, height: 300, background: "#FF6B6B0d", borderRadius: "50%", filter: "blur(80px)", pointerEvents: "none" }} />

        <div style={{ display: "inline-flex", alignItems: "center", gap: 8, background: "#C8F56415", border: "1px solid #C8F56430", borderRadius: 20, padding: "7px 18px", marginBottom: 32, fontSize: 11, letterSpacing: 2, color: "#C8F564" }}>
          🎉 FREE 7-DAY TRIAL · NO CREDIT CARD NEEDED
        </div>

        <h1 style={{ fontFamily: "'Syne',sans-serif", fontWeight: 800, fontSize: "clamp(40px,8vw,86px)", lineHeight: 1, letterSpacing: -3, marginBottom: 24, animation: "fadeUp .8s ease both" }}>
          TRACK YOUR<br /><span style={{ color: "#C8F564" }}>CALORIES.</span><br />CRUSH YOUR GOALS.
        </h1>
        <p style={{ fontSize: 16, color: "#888", maxWidth: 500, lineHeight: 1.7, marginBottom: 44, animation: "fadeUp .8s .15s ease both", opacity: 0, animationFillMode: "forwards" }}>
          The smartest calorie & macro tracker. Search 3 million+ real foods, set personal goals, and watch your data save automatically — every single day.
        </p>
        <div style={{ display: "flex", gap: 14, flexWrap: "wrap", justifyContent: "center", marginBottom: 60, animation: "fadeUp .8s .3s ease both", opacity: 0, animationFillMode: "forwards" }}>
          <button className="hero-cta" onClick={handleStartTrial} style={{ background: "#C8F564", color: "#0d0d1a", border: "none", borderRadius: 14, padding: "16px 36px", cursor: "pointer", fontFamily: "'Syne',sans-serif", fontWeight: 800, fontSize: 16 }}>
            Start Free Trial →
          </button>
          <button onClick={() => scrollTo("pricing")} style={{ background: "transparent", color: "#e8e8f0", border: "1px solid #2a2a40", borderRadius: 14, padding: "16px 36px", cursor: "pointer", fontFamily: "'DM Mono',monospace", fontSize: 13 }}>
            View Pricing
          </button>
        </div>

        {/* Floating app preview */}
        <div style={{ width: "100%", maxWidth: 430, animation: "float 5s ease-in-out infinite", animationDelay: ".5s" }}>
          <div style={{ background: "linear-gradient(160deg,#13132a,#0d0d1a)", border: "1px solid #2a2a40", borderRadius: 24, overflow: "hidden", boxShadow: "0 40px 100px #00000080, 0 0 0 1px #C8F56420" }}>
            <TrackerApp profile={profile} embedded />
          </div>
        </div>

        <div style={{ display: "flex", gap: 48, marginTop: 60, flexWrap: "wrap", justifyContent: "center" }}>
          {[["3M+", "Foods in Database"], ["2026", "App Launch"], ["30-Day", "Guarantee"]].map(([val, label]) => (
            <div key={label} style={{ textAlign: "center" }}>
              <div style={{ fontFamily: "'Syne',sans-serif", fontWeight: 800, fontSize: 28, color: "#C8F564" }}>{val}</div>
              <div style={{ fontSize: 10, color: "#555", letterSpacing: 2, marginTop: 4 }}>{label.toUpperCase()}</div>
            </div>
          ))}
        </div>
      </section>

      {/* FEATURES */}
      <section id="features" style={{ padding: "100px 24px", maxWidth: 1100, margin: "0 auto" }}>
        <div style={{ textAlign: "center", marginBottom: 64 }}>
          <div style={{ fontSize: 10, letterSpacing: 4, color: "#C8F564", marginBottom: 16 }}>EVERYTHING YOU NEED</div>
          <h2 style={{ fontFamily: "'Syne',sans-serif", fontWeight: 800, fontSize: "clamp(32px,5vw,56px)", letterSpacing: -2 }}>Built for real results.</h2>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(300px,1fr))", gap: 20 }}>
          {FEATURES.map(f => (
            <div key={f.title} className="feat-card" style={{ background: "#13132a", border: "1px solid #1e1e30", borderRadius: 16, padding: "28px 24px" }}>
              <div style={{ fontSize: 36, marginBottom: 16 }}>{f.icon}</div>
              <div style={{ fontFamily: "'Syne',sans-serif", fontWeight: 800, fontSize: 18, marginBottom: 10 }}>{f.title}</div>
              <div style={{ color: "#888", fontSize: 13, lineHeight: 1.7 }}>{f.desc}</div>
            </div>
          ))}
        </div>
      </section>

      {/* SCIENCE SECTION */}
      <section style={{ padding: "60px 24px", background: "#08081a", borderTop: "1px solid #1e1e30", borderBottom: "1px solid #1e1e30" }}>
        <div style={{ maxWidth: 1100, margin: "0 auto", display: "flex", gap: 48, alignItems: "center", flexWrap: "wrap" }}>
          <div style={{ flex: 1, minWidth: 280 }}>
            <div style={{ fontSize: 10, letterSpacing: 4, color: "#C8F564", marginBottom: 16 }}>SCIENCE-BACKED</div>
            <h2 style={{ fontFamily: "'Syne',sans-serif", fontWeight: 800, fontSize: 36, letterSpacing: -1, marginBottom: 20, lineHeight: 1.15 }}>Nutrition data you can trust.</h2>
            <p style={{ color: "#888", fontSize: 14, lineHeight: 1.8, marginBottom: 24 }}>Fuel Tracker connects to Open Food Facts — a community-verified database of over 3 million foods worldwide, from restaurant meals to branded products and whole foods.</p>
            {["🥗 3M+ verified foods including restaurants", "⚖️ Accurate macro tracking per serving", "🔬 Personalised calorie goals for your body", "💾 Auto-save — your data is always there"].map(item => (
              <div key={item} style={{ fontSize: 13, color: "#ccc", marginBottom: 10 }}>{item}</div>
            ))}
          </div>
          <div style={{ flex: 1, minWidth: 280 }}>
            <div style={{ background: "linear-gradient(135deg,#13132a,#1a1a3a)", border: "1px solid #2a2a40", borderRadius: 20, padding: 32, textAlign: "center" }}>
              <div style={{ fontSize: 56, marginBottom: 20 }}>🥦🍗🍕🍌</div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10 }}>
                {[["Calories", "2,000", "#C8F564"], ["Protein", "150g", "#FF6B6B"], ["Carbs", "200g", "#FFD93D"], ["Fat", "65g", "#6BCB77"], ["Foods", "3M+", "#A78BFA"], ["Saved", "✓", "#60A5FA"]].map(([label, val, color]) => (
                  <div key={label} style={{ background: "#0d0d1a", borderRadius: 10, padding: "12px 8px" }}>
                    <div style={{ fontFamily: "'Syne',sans-serif", fontWeight: 800, fontSize: 15, color }}>{val}</div>
                    <div style={{ fontSize: 9, color: "#555", letterSpacing: 1, marginTop: 3 }}>{label.toUpperCase()}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* TESTIMONIALS */}
      <section id="reviews" style={{ padding: "100px 24px", maxWidth: 1100, margin: "0 auto" }}>
        <div style={{ textAlign: "center", marginBottom: 64 }}>
          <div style={{ fontSize: 10, letterSpacing: 4, color: "#C8F564", marginBottom: 16 }}>REAL PEOPLE. REAL RESULTS.</div>
          <h2 style={{ fontFamily: "'Syne',sans-serif", fontWeight: 800, fontSize: "clamp(28px,4vw,48px)", letterSpacing: -1 }}>Loved by thousands.</h2>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(280px,1fr))", gap: 20 }}>
          {TESTIMONIALS.map(t => (
            <div key={t.name} style={{ background: "#13132a", border: "1px solid #1e1e30", borderRadius: 16, padding: 28 }}>
              <div style={{ display: "flex", gap: 14, alignItems: "center", marginBottom: 16 }}>
                <div style={{ width: 48, height: 48, borderRadius: "50%", background: "linear-gradient(135deg,#C8F564,#a8e044)", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "'Syne',sans-serif", fontWeight: 800, fontSize: 16, color: "#0d0d1a", flexShrink: 0 }}>{t.initials}</div>
                <div>
                  <div style={{ fontFamily: "'Syne',sans-serif", fontWeight: 800, fontSize: 14 }}>{t.name}</div>
                  <div style={{ color: "#C8F564", fontSize: 11, marginTop: 2 }}>{t.role}</div>
                </div>
              </div>
              <div style={{ color: "#FFD93D", fontSize: 14, marginBottom: 10, letterSpacing: 2 }}>{"★".repeat(t.stars)}</div>
              <div style={{ color: "#aaa", fontSize: 13, lineHeight: 1.7, fontStyle: "italic" }}>"{t.text}"</div>
            </div>
          ))}
        </div>
      </section>

      {/* PRICING */}
      <section id="pricing" style={{ padding: "100px 24px", background: "#08081a", borderTop: "1px solid #1e1e30" }}>
        <div style={{ textAlign: "center", maxWidth: 600, margin: "0 auto 64px" }}>
          <div style={{ fontSize: 10, letterSpacing: 4, color: "#C8F564", marginBottom: 16 }}>SIMPLE PRICING</div>
          <h2 style={{ fontFamily: "'Syne',sans-serif", fontWeight: 800, fontSize: "clamp(32px,5vw,56px)", letterSpacing: -2, marginBottom: 16 }}>Start free. Stay fit.</h2>
          <p style={{ color: "#888", fontSize: 14, lineHeight: 1.7 }}>Try Fuel Tracker FREE for 7 days. No credit card required. Cancel anytime. 30-day money-back guarantee.</p>
        </div>
        <div style={{ display: "flex", gap: 24, maxWidth: 860, margin: "0 auto", flexWrap: "wrap", justifyContent: "center", alignItems: "flex-start" }}>
          <PricingCard plan="MONTHLY" price="$9.99" period="/ month" badge={null} highlight={false}
            features={["Full calorie & macro tracking", "3M+ food database (live search)", "Personalised calorie goals", "Auto-save — never lose data", "7-day free trial included", "Cancel anytime"]}
            cta="Start Free Trial" ctaLink="https://buy.stripe.com/28E3cw5Jy9kUbWo49G28802" />
          <PricingCard plan="ANNUAL" price="$79" period="/ year" badge="BEST VALUE — SAVE 34%" highlight={true}
            features={["Everything in Monthly", "Priority customer support", "Early access to new features", "Nutrition coaching resources", "7-day free trial included", "One payment, full year access"]}
            cta="Get Annual Plan" ctaLink="https://buy.stripe.com/8x2cN67RG40AbWo7lS28803" />
        </div>
        <div style={{ textAlign: "center", marginTop: 32, color: "#555", fontSize: 12 }}>
          Annual saves you <span style={{ color: "#C8F564" }}>$40.88</span> vs monthly · 🛡️ 30-day money-back guarantee on all plans
        </div>
        <div style={{ display: "flex", justifyContent: "center", gap: 12, marginTop: 32, flexWrap: "wrap" }}>
          {["🔒 Secure Checkout", "💳 All Major Cards", "🔁 Cancel Anytime", "✅ 7-Day Free Trial", "🛡️ 30-Day Guarantee"].map(b => (
            <div key={b} style={{ background: "#13132a", border: "1px solid #2a2a40", borderRadius: 20, padding: "8px 16px", fontSize: 11, color: "#888" }}>{b}</div>
          ))}
        </div>
      </section>

      {/* FAQ */}
      <FAQ />

      {/* FINAL CTA */}
      <section style={{ padding: "100px 24px", textAlign: "center", position: "relative", overflow: "hidden", borderTop: "1px solid #1e1e30" }}>
        <div style={{ position: "absolute", top: "50%", left: "50%", transform: "translate(-50%,-50%)", width: 600, height: 600, background: "#C8F56408", borderRadius: "50%", filter: "blur(100px)", pointerEvents: "none" }} />
        <div style={{ position: "relative" }}>
          <h2 style={{ fontFamily: "'Syne',sans-serif", fontWeight: 800, fontSize: "clamp(36px,6vw,72px)", letterSpacing: -3, marginBottom: 20, lineHeight: 1.05 }}>
            YOUR BEST BODY<br /><span style={{ color: "#C8F564" }}>STARTS TODAY.</span>
          </h2>
          <p style={{ color: "#888", fontSize: 15, maxWidth: 420, margin: "0 auto 40px", lineHeight: 1.7 }}>"Start your transformation today. 7 days free, then just $9.99/mo — or save 34% annually.</p>
          <div style={{ display: "flex", gap: 14, justifyContent: "center", flexWrap: "wrap" }}>
            <button onClick={handleStartTrial} style={{ background: "#C8F564", color: "#0d0d1a", border: "none", borderRadius: 14, padding: "18px 42px", cursor: "pointer", fontFamily: "'Syne',sans-serif", fontWeight: 800, fontSize: 16 }}>
              Try Free for 7 Days →
            </button>
            <a href="https://buy.stripe.com/5kQfZi4Fu9kU4tW21y28801" target="_blank" rel="noopener noreferrer" style={{ display: "inline-flex", alignItems: "center", background: "transparent", color: "#e8e8f0", border: "1px solid #2a2a40", borderRadius: 14, padding: "18px 42px", fontFamily: "'DM Mono',monospace", fontSize: 13, textDecoration: "none" }}>
              Get Annual — $79/yr
            </a>
          </div>
          <div style={{ marginTop: 20, color: "#444", fontSize: 12 }}>🛡️ 30-day money-back guarantee · No credit card for trial</div>
        </div>
      </section>

      {/* FOOTER */}
      <footer style={{ borderTop: "1px solid #1e1e30", padding: "32px 24px", display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 16 }}>
        <div style={{ display: "flex", alignItems: "baseline", gap: 6 }}>
          <span style={{ fontFamily: "'Syne',sans-serif", fontWeight: 800, color: "#C8F564" }}>FUEL</span>
          <span style={{ fontFamily: "'Syne',sans-serif", fontWeight: 800 }}>TRACKER</span>
        </div>
        <div style={{ display: "flex", gap: 20, flexWrap: "wrap" }}>
          {[["Privacy Policy", "#"], ["Terms of Service", "#"], ["Support", "mailto:support@fueltracker.app"]].map(([label, href]) => (
            <a key={label} href={href} style={{ color: "#444", fontSize: 11, textDecoration: "none", letterSpacing: 1 }}>{label}</a>
          ))}
        </div>
        <div style={{ color: "#333", fontSize: 11 }}>© 2026 Fuel Tracker. All rights reserved.</div>
      </footer>
    </div>
  );
}
