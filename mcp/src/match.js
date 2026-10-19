/**
 * Domain-token overlap ranking — same idea as worker/src/match.js / site client.
 * Catalog: docs/mock/sellers.json (no full KB dump; domains + one-line about only).
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const CATALOG_PATH = path.resolve(__dirname, "../../docs/mock/sellers.json");

let cached = null;

export function loadCatalog() {
  if (cached) return cached;
  const raw = fs.readFileSync(CATALOG_PATH, "utf8");
  const data = JSON.parse(raw);
  cached = (data && data.sellers) || [];
  return cached;
}

function haystackOf(need) {
  if (typeof need === "string") return need.toLowerCase();
  return [need.skill || "", need.title || "", need.brief || "", need.accept || "", need.need || ""]
    .join(" ")
    .toLowerCase();
}

function scoreSeller(seller, hay) {
  let score = 0;
  const hits = [];
  const domains = seller.domains || [];
  for (let i = 0; i < domains.length; i++) {
    const raw = String(domains[i] || "");
    const tok = raw.toLowerCase();
    if (tok && hay.indexOf(tok) >= 0) {
      score += 1;
      hits.push(raw);
    }
  }
  return { score, hits };
}

/**
 * Rank all sellers with score > 0; if none, return empty list (no catalog dump).
 */
export function rankSellers(need, opts) {
  const hay = haystackOf(need || {});
  const limit = Math.min(Math.max(Number(opts && opts.limit) || 5, 1), 20);
  const sellers = loadCatalog();
  const ranked = [];
  for (let i = 0; i < sellers.length; i++) {
    const s = sellers[i];
    const sc = scoreSeller(s, hay);
    if (sc.score <= 0) continue;
    ranked.push({
      id: s.id,
      name: s.name,
      label: s.label || s.id + " · " + s.name,
      kind: s.kind || "workflow",
      domains_hit: sc.hits.slice(),
      score: sc.score,
      about: s.about || "",
      showcase: !!s.showcase,
    });
  }
  ranked.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    if (a.showcase !== b.showcase) return a.showcase ? -1 : 1;
    return String(a.id).localeCompare(String(b.id));
  });
  return ranked.slice(0, limit);
}

export function findSellerById(id) {
  const want = String(id || "").trim();
  if (!want) return null;
  const sellers = loadCatalog();
  for (let i = 0; i < sellers.length; i++) {
    const s = sellers[i];
    if (s.id === want || s.label === want || s.name === want) return s;
  }
  // soft: id contained in label
  for (let j = 0; j < sellers.length; j++) {
    const s2 = sellers[j];
    if (String(s2.label || "").indexOf(want) >= 0) return s2;
  }
  return null;
}

/** Quote stub — not a binding price; no fund custody. */
export function buildQuote(seller, jobSummary) {
  if (!seller) return null;
  const kind = seller.kind || "workflow";
  const summary = String(jobSummary || "").trim();

  // Early phase: free matching; points demoted; optional off-platform amount blank
  let price_hint;
  let turnaround;
  if (kind === "channel") {
    price_hint = {
      early_phase: "free_match",
      points_demoted: true,
      points_reference: "80–180 (reputation garnish only, not currency)",
      off_platform_amount: null,
      note: "Early phase: free match. Optional off-platform fee agreed privately after accept.",
    };
    turnaround = "Clarify lock → 1–3 business days (channel retrieval)";
  } else if (kind === "data") {
    price_hint = {
      early_phase: "free_match",
      points_demoted: true,
      points_reference: "100–220 (reputation garnish only, not currency)",
      off_platform_amount: null,
      note: "Per-order authorized data slice — not a full KB dump. Off-platform settle after accept.",
    };
    turnaround = "Clarify lock → 1–2 business days (slice prep)";
  } else {
    price_hint = {
      early_phase: "free_match",
      points_demoted: true,
      points_reference: "90–210 (reputation garnish only, not currency)",
      off_platform_amount: null,
      note: "Early phase: free match. Points are reputation only. Pay WeChat/Alipay off-platform if both agree.",
    };
    turnaround = "Clarify lock → 2–4 business days (workflow run on seller machine)";
  }

  return {
    seller_id: seller.id,
    seller_name: seller.name,
    seller_label: seller.label || seller.id + " · " + seller.name,
    what_is_sold: kind,
    about: seller.about || "",
    job_summary: summary || null,
    price_hint,
    turnaround,
    settlement_methods: ["escrow", "wechat", "alipay", "other"],
    settlement_primary_intl: "escrow",
    clarify_preview: (seller.questions || []).slice(0, 3),
    disclaimer_zh: "平台不托管资金。报酬微信/支付宝等站外自结；报价仅为意向 stub，非法币承诺。",
    disclaimer_en:
      "Platform does not custody funds. Settlement is WeChat/Alipay/other off-platform. This quote is a stub, not a fiat commitment.",
    sell_framing:
      "Sell repeatable workflows, private channels models can't enter, and per-order authorized data slices — NOT dumping a KB into the platform or a model.",
  };
}
