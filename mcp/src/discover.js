import { rankSellers, findSellerById, buildQuote } from "./match.js";

const DISCLAIMER =
  "Platform does not custody funds. Sell workflows/channels/authorized data slices — not dumping a KB into the model.";

function ok(data) {
  return { ok: true, ...data, disclaimer: DISCLAIMER };
}

function fail(message) {
  const e = new Error(message);
  throw e;
}

/**
 * find_sellers / match_sellers — same impl
 */
export async function findSellers(input) {
  const needText =
    (input && (input.need || input.query || input.brief || input.skill)) || "";
  const skill = (input && input.skill) || "";
  const brief = (input && input.brief) || "";
  const title = (input && input.title) || "";
  const accept = (input && input.accept) || "";
  const composed = {
    skill: skill || needText,
    brief: brief || needText,
    title,
    accept,
    need: needText,
  };
  if (!String(composed.skill || composed.brief || composed.need).trim()) {
    fail("need, skill, or brief is required");
  }
  const limit = input && input.limit;
  const matches = rankSellers(composed, { limit });
  return ok({
    source: "catalog",
    catalog: "docs/mock/sellers.json",
    scorer: "domain-token-overlap (same as worker/src/match.js)",
    query: {
      skill: composed.skill,
      brief: composed.brief,
      title: composed.title || undefined,
    },
    matches,
    count: matches.length,
    note:
      matches.length === 0
        ? "0 hits → no catalog dump; refine skill/brief or leave unmatched for claim pool."
        : "Ranked by domain token overlap. Domains hit only — no full knowledge-base dump.",
  });
}

export const matchSellers = findSellers;

export async function getQuote(input) {
  const sellerId = String(
    (input && (input.seller_id || input.sellerId || input.id)) || ""
  ).trim();
  if (!sellerId) fail("seller_id is required");
  const jobSummary = String(
    (input &&
      (input.job_summary ||
        input.jobSummary ||
        input.summary ||
        input.brief ||
        input.need)) ||
      ""
  ).trim();
  const seller = findSellerById(sellerId);
  if (!seller) fail("seller not found: " + sellerId + " (catalog ids only; no KB dump)");
  const quote = buildQuote(seller, jobSummary);
  return ok({
    source: "catalog",
    quote,
  });
}
