/**
 * Domain-token overlap match — same idea as client js/main.js.
 * Sellers are bundled (sellers.json); 0 hits → 待匹配 pool (no catalog dump).
 */

import sellersBundle from "./sellers.js";

const PENDING = "待匹配";
const MAX_CLARIFY_ROUNDS = 1;

export { PENDING, MAX_CLARIFY_ROUNDS };

export function getSellers() {
  const list = (sellersBundle && sellersBundle.sellers) || [];
  return list.slice();
}

function haystackOf(job) {
  return [job.skill || "", job.title || "", job.brief || "", job.accept || ""]
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

export function matchSeller(job) {
  const hay = haystackOf(job);
  const sellers = getSellers();
  let best = null;
  let bestScore = 0;
  let bestHits = [];
  for (let j = 0; j < sellers.length; j++) {
    const s2 = sellers[j];
    const sc2 = scoreSeller(s2, hay);
    if (sc2.score <= 0) continue;
    if (
      !best ||
      sc2.score > bestScore ||
      (sc2.score === bestScore && s2.showcase && !best.showcase)
    ) {
      best = s2;
      bestScore = sc2.score;
      bestHits = sc2.hits.slice();
    }
  }
  if (!best || bestScore <= 0) return null;
  return { seller: best, score: bestScore, hits: bestHits };
}

export function formatHitTokens(hits) {
  if (!hits || !hits.length) return "";
  return hits.join("、");
}

export function defaultQuestions(seller) {
  if (seller && Array.isArray(seller.questions) && seller.questions.length) {
    return seller.questions.slice();
  }
  return [
    "输入与格式边界是否清楚？",
    "交付物形态是否确认？",
    "验收标准是否可客观判定？",
  ];
}
