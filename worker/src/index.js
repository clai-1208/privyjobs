/**
 * PrivyJobs Cloudflare Worker — contract impl for docs/backend-contract.html
 * Endpoints: POST/GET /v1/jobs, GET /v1/jobs/:id, clarify, deliver, accept, return,
 * GET /v1/points/ledger. Source-only slice; do not require CF login to develop.
 */

import { createStore } from "./store.js";
import {
  matchSeller,
  formatHitTokens,
  defaultQuestions,
  PENDING,
  MAX_CLARIFY_ROUNDS,
} from "./match.js";
import { withCors, corsHeaders } from "./cors.js";

const NOTES = {
  points_only: true,
  no_real_money: true,
  skills_not_public_dump: true,
  clarify_capped: true,
  no_forum: true,
};

function json(data, status = 200) {
  return new Response(JSON.stringify(data, null, 2), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store",
    },
  });
}

function err(status, code, message, extra) {
  return json(
    Object.assign({ ok: false, error: code, message }, extra || {}),
    status
  );
}

async function readBody(request) {
  try {
    const t = await request.text();
    if (!t) return {};
    return JSON.parse(t);
  } catch (_) {
    return null;
  }
}

function newJobId() {
  return "job_" + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
}

function summarizeJob(job) {
  return {
    id: job.id,
    title: job.title,
    status: job.status,
    points: job.points,
    resident: job.resident,
    escrow: job.escrow,
    clarify_locked: !!job.clarify_locked,
    clarify_round: job.clarify_round || 0,
    match_explain: job.match_explain,
    updated_at: job.updated_at || job.created_at,
  };
}

async function handleCreateJob(request, store) {
  const body = await readBody(request);
  if (body === null) return err(400, "bad_json", "Request body must be JSON");

  const title = String(body.title || "").trim() || "未命名任务";
  const skill = String(body.skill || "").trim();
  const brief = String(body.brief || "").trim();
  const points = Math.max(1, Math.min(Number(body.points) || 0, 100000));
  const accept = String(body.accept || "").trim();
  const channel = String(body.channel || "").trim() || "私有通道交付";

  const now = new Date().toISOString();
  const id = newJobId();
  const draft = { title, skill, brief, accept, points };

  let resident = PENDING;
  let match_explain = "未匹配 · 进入待匹配池";
  let match_hits = [];
  let clarify_questions = [
    "输入与格式边界是否清楚？",
    "交付物形态是否确认？",
    "验收标准是否可客观判定？",
  ];

  const matched = matchSeller(draft);
  if (matched) {
    resident = matched.seller.label || matched.seller.name;
    const hitLine = formatHitTokens(matched.hits);
    match_explain =
      "命中域词：" + (hitLine || "（计分域词）") + "（" + matched.score + "）";
    match_hits = matched.hits.slice();
    clarify_questions = defaultQuestions(matched.seller);
  }

  let ledgerEntry = null;
  try {
    const fr = await store.freeze(points, id, "意向记录 · " + title);
    ledgerEntry = fr.entry;
  } catch (e) {
    if (e && e.code === "insufficient_balance") {
      return err(402, "insufficient_balance", "演示参考分不足，无法记入意向");
    }
    throw e;
  }

  const job = {
    id,
    status: "clarify",
    title,
    skill,
    brief,
    points,
    accept,
    channel,
    resident,
    escrow: "frozen",
    clarify_locked: false,
    clarify_round: 0,
    clarify_questions,
    buyer_answers: "",
    result_package: null,
    match_explain,
    match_hits,
    rework_count: 0,
    created_at: now,
    updated_at: now,
  };
  await store.putJob(job);

  return json({
    ok: true,
    worker: true,
    operation: "create_job",
    contract: "POST /v1/jobs",
    store: store.mode,
    job,
    ledger: ledgerEntry,
    notes: NOTES,
  });
}

async function handleListJobs(request, store) {
  const url = new URL(request.url);
  const status = url.searchParams.get("status") || "";
  const limit = parseInt(url.searchParams.get("limit") || "20", 10);
  const offset = parseInt(url.searchParams.get("offset") || "0", 10);
  const { jobs, page } = await store.listJobs({
    status: status || undefined,
    limit,
    offset,
  });
  return json({
    ok: true,
    worker: true,
    operation: "list_jobs",
    contract: "GET /v1/jobs",
    jobs: jobs.map(summarizeJob),
    page,
    notes: {
      points_only: true,
      skills_not_public_dump: true,
      clarify_capped: true,
    },
  });
}

async function handleGetJob(id, store) {
  const job = await store.getJob(id);
  if (!job) return err(404, "not_found", "Job not found: " + id);
  return json({
    ok: true,
    worker: true,
    operation: "get_job",
    contract: "GET /v1/jobs/:id",
    job,
  });
}

async function handleClarify(id, request, store) {
  const job = await store.getJob(id);
  if (!job) return err(404, "not_found", "Job not found: " + id);
  const body = (await readBody(request)) || {};

  if (job.clarify_locked) {
    return err(409, "clarify_locked", "澄清已锁定，不做开放闲聊追问", {
      clarify_cap: {
        max_rounds: MAX_CLARIFY_ROUNDS,
        rounds_used: job.clarify_round || MAX_CLARIFY_ROUNDS,
        locked: true,
        buyer_may_query_knowledge_base: false,
      },
    });
  }

  if (body.buyer_answers) {
    job.buyer_answers = String(body.buyer_answers);
  }

  const action = String(body.action || "lock").toLowerCase();
  const role = String(body.role || "seller").toLowerCase();
  const now = new Date().toISOString();

  if (action === "lock" || role === "seller") {
    const used = (job.clarify_round || 0) + 1;
    if (used > MAX_CLARIFY_ROUNDS) {
      return err(409, "clarify_cap", "澄清轮次已用尽", {
        clarify_cap: {
          max_rounds: MAX_CLARIFY_ROUNDS,
          rounds_used: job.clarify_round || 0,
          locked: !!job.clarify_locked,
          buyer_may_query_knowledge_base: false,
        },
      });
    }
    job.clarify_round = used;
    job.clarify_locked = true;
    job.clarify_locked_at = now;
    job.status = "making";
    job.updated_at = now;
    await store.putJob(job);

    return json({
      ok: true,
      worker: true,
      operation: "clarify",
      contract: "POST /v1/jobs/:id/clarify",
      job_id: id,
      status: job.status,
      clarify_cap: {
        max_rounds: MAX_CLARIFY_ROUNDS,
        rounds_used: job.clarify_round,
        locked: true,
        buyer_may_query_knowledge_base: false,
      },
      lock_note: "需求已锁定 · 卖方停答开放问题，制作中",
      job: {
        id: job.id,
        status: job.status,
        clarify_locked: true,
        clarify_round: job.clarify_round,
        clarify_locked_at: job.clarify_locked_at,
      },
      next: {
        hint: "澄清已用满一轮；其后仅 deliver（结果摘要包），不做开放闲聊追问。",
        related: ["deliver", "get_job"],
      },
    });
  }

  job.updated_at = now;
  await store.putJob(job);
  return json({
    ok: true,
    worker: true,
    operation: "clarify",
    contract: "POST /v1/jobs/:id/clarify",
    job_id: id,
    status: job.status,
    clarify_cap: {
      max_rounds: MAX_CLARIFY_ROUNDS,
      rounds_used: job.clarify_round || 0,
      locked: false,
      buyer_may_query_knowledge_base: true,
    },
    job: summarizeJob(job),
  });
}

async function handleDeliver(id, request, store) {
  const job = await store.getJob(id);
  if (!job) return err(404, "not_found", "Job not found: " + id);
  if (job.status !== "making" && job.status !== "accept") {
    return err(409, "bad_status", "Deliver only from making (or rework)", {
      status: job.status,
    });
  }
  const body = (await readBody(request)) || {};
  const pkg = body.result_package || body;
  const summary = String(pkg.summary || "").trim();
  const artifacts = String(pkg.artifacts || "").trim();
  const accept_check = String(pkg.accept_check || "").trim();
  if (!summary || !artifacts || !accept_check) {
    return err(
      400,
      "result_package_required",
      "result_package must include summary, artifacts, accept_check"
    );
  }
  const now = new Date().toISOString();
  job.result_package = {
    summary,
    artifacts,
    accept_check,
    attachments: String(pkg.attachments || ""),
    delivered_at: now,
  };
  job.status = "accept";
  job.updated_at = now;
  await store.putJob(job);

  return json({
    ok: true,
    worker: true,
    operation: "deliver",
    contract: "POST /v1/jobs/:id/deliver",
    job_id: id,
    status: job.status,
    result_package: job.result_package,
    job: { id: job.id, status: job.status, escrow: job.escrow },
    next: {
      hint: "待买方 accept 或 return；不开放过程闲聊。",
      related: ["accept", "return"],
    },
  });
}

async function handleAccept(id, request, store) {
  const job = await store.getJob(id);
  if (!job) return err(404, "not_found", "Job not found: " + id);
  if (job.status !== "accept") {
    return err(409, "bad_status", "Accept only when status=accept", {
      status: job.status,
    });
  }
  const now = new Date().toISOString();
  const points = job.points || 0;
  const { entry } = await store.release(
    points,
    id,
    "验收确认 · 声誉计入 " + points + " 点（站外自结）"
  );
  job.status = "done";
  job.escrow = "released";
  job.updated_at = now;
  await store.putJob(job);

  return json({
    ok: true,
    worker: true,
    operation: "accept",
    contract: "POST /v1/jobs/:id/accept",
    job_id: id,
    status: job.status,
    escrow: job.escrow,
    ledger: entry,
    job: { id: job.id, status: job.status, escrow: job.escrow },
    notes: { points_only: true, no_real_money: true },
  });
}

async function handleReturn(id, request, store) {
  const job = await store.getJob(id);
  if (!job) return err(404, "not_found", "Job not found: " + id);
  const body = (await readBody(request)) || {};
  const reason = String(body.reason || "申请退回").trim();

  /* rework once when in accept without force-return reason for secondary fail */
  const force =
    /二次|退回|超时|7\s*日|late/i.test(reason) || body.force === true;
  if (job.status === "accept" && !force && (job.rework_count || 0) < 1) {
    job.rework_count = (job.rework_count || 0) + 1;
    job.status = "making";
    job.result_package = null;
    job.updated_at = new Date().toISOString();
    await store.putJob(job);
    return json({
      ok: true,
      worker: true,
      operation: "return",
      contract: "POST /v1/jobs/:id/return",
      job_id: id,
      status: job.status,
      escrow: job.escrow,
      rework: true,
      reason,
      job: { id: job.id, status: job.status, escrow: job.escrow },
      notes: {
        points_only: true,
        rework_quota: 1,
        late_unlock_days: 7,
        hint: "一次验收失败 → 返工 making；再次 return 将退回解冻。",
      },
    });
  }

  if (
    job.escrow !== "frozen" &&
    job.status !== "clarify" &&
    job.status !== "making" &&
    job.status !== "accept"
  ) {
    return err(409, "bad_status", "Cannot return from status " + job.status, {
      status: job.status,
    });
  }

  const now = new Date().toISOString();
  const points = job.points || 0;
  let entry = null;
  if (job.escrow === "frozen") {
    const fr = await store.refund(
      points,
      id,
      "申请退回 · 解冻 " + points + " 点"
    );
    entry = fr.entry;
  }
  job.status = "returned";
  job.escrow = "refunded";
  job.return_reason = reason;
  job.updated_at = now;
  await store.putJob(job);

  return json({
    ok: true,
    worker: true,
    operation: "return",
    contract: "POST /v1/jobs/:id/return",
    job_id: id,
    status: job.status,
    escrow: job.escrow,
    ledger: entry,
    reason,
    job: { id: job.id, status: job.status, escrow: job.escrow },
    notes: {
      points_only: true,
      rework_quota: 1,
      late_unlock_days: 7,
    },
  });
}

async function handleLedger(store) {
  const account = await store.getAccount();
  const entries = await store.getLedger();
  return json({
    ok: true,
    worker: true,
    operation: "points_ledger",
    contract: "GET /v1/points/ledger",
    account,
    entries,
    sketches: {
      freeze: "POST create job → balance -= n, frozen += n",
      release: "POST accept → frozen -= n, seller_earned += n",
      refund: "POST return → frozen -= n, balance += n",
    },
    notes: { points_only: true, no_real_money: true },
  });
}

function handleHealth(store) {
  return json({
    ok: true,
    service: "privyjobs-worker",
    version: "v1-draft",
    store: store.mode,
    contract: "docs/backend-contract.html",
    endpoints: [
      "POST /v1/jobs",
      "GET /v1/jobs",
      "GET /v1/jobs/:id",
      "POST /v1/jobs/:id/clarify",
      "POST /v1/jobs/:id/deliver",
      "POST /v1/jobs/:id/accept",
      "POST /v1/jobs/:id/return",
      "GET /v1/points/ledger",
    ],
    notes: NOTES,
  });
}

async function route(request, env) {
  const store = createStore(env || {});
  const url = new URL(request.url);
  const path = url.pathname.replace(/\/$/, "") || "/";
  const method = request.method.toUpperCase();

  if (method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders(request) });
  }

  if (method === "GET" && (path === "/" || path === "/health" || path === "/v1")) {
    return handleHealth(store);
  }

  if (method === "POST" && path === "/v1/jobs") {
    return handleCreateJob(request, store);
  }
  if (method === "GET" && path === "/v1/jobs") {
    return handleListJobs(request, store);
  }
  if (method === "GET" && path === "/v1/points/ledger") {
    return handleLedger(store);
  }

  const jobMatch = path.match(/^\/v1\/jobs\/([^/]+)(?:\/(clarify|deliver|accept|return))?$/);
  if (jobMatch) {
    const id = decodeURIComponent(jobMatch[1]);
    const action = jobMatch[2];
    if (!action && method === "GET") return handleGetJob(id, store);
    if (action === "clarify" && method === "POST")
      return handleClarify(id, request, store);
    if (action === "deliver" && method === "POST")
      return handleDeliver(id, request, store);
    if (action === "accept" && method === "POST")
      return handleAccept(id, request, store);
    if (action === "return" && method === "POST")
      return handleReturn(id, request, store);
  }

  return err(404, "not_found", "No route for " + method + " " + path);
}

export default {
  async fetch(request, env) {
    try {
      const res = await route(request, env);
      return withCors(request, res);
    } catch (e) {
      return withCors(
        request,
        err(500, "internal", e && e.message ? e.message : String(e))
      );
    }
  },
};
