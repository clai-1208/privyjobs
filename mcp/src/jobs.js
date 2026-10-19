/**
 * In-process job state machine for MCP tools (local mode).
 * Aligns with P0.3: settle off-platform before deliver.
 * Platform does NOT custody funds. Points are reputation garnish only.
 */
import * as store from "./store.js";
import * as api from "./api.js";

export const SETTLE_METHODS = [
  "escrow",
  "wechat",
  "alipay",
  "other",
  "international_tbd",
];

const PENDING = "待匹配";

function now() {
  return Date.now();
}

function normalizeMethod(m) {
  if (!m) return "";
  const s = String(m).trim().toLowerCase();
  if (s === "intl_tbd" || s === "intl" || s === "international") {
    return "international_tbd";
  }
  if (s === "weixin") return "wechat";
  return s;
}

function publicJob(job) {
  if (!job) return null;
  return {
    id: job.id,
    title: job.title,
    skill: job.skill,
    brief: job.brief,
    points: job.points,
    accept: job.accept,
    channel: job.channel,
    status: job.status,
    resident: job.resident,
    clarify_locked: !!job.clarify_locked,
    clarify_round: job.clarify_round || 0,
    clarify_questions: job.clarify_questions || [],
    buyer_answers: job.buyer_answers || "",
    settlement_method: job.settlement_method || "",
    settlement_buyer_confirmed: !!job.settlement_buyer_confirmed,
    settlement_seller_confirmed: !!job.settlement_seller_confirmed,
    settlement_agreed: !!job.settlement_agreed,
    settlement_agreed_at: job.settlement_agreed_at || null,
    result_package: job.result_package || null,
    notes: job.notes || {
      platform_custodies_funds: false,
      settlement: "off_platform",
      sell: "workflows_channels_authorized_data_slices",
      not: "dumping_kb_into_platform_or_model",
      points_are_reputation_only: true,
    },
    created_at: job.created_at,
    updated_at: job.updated_at,
  };
}

function ok(data) {
  return { ok: true, ...data };
}

function fail(message, extra) {
  const e = new Error(message);
  e.extra = extra || {};
  throw e;
}

export async function createJob(input) {
  if (api.hasRemote()) {
    const body = {
      title: input.title,
      skill: input.skill,
      brief: input.brief,
      points: input.points,
      accept: input.accept,
      channel: input.channel,
    };
    const res = await api.remoteCreateJob(body);
    return ok({ source: "api", job: res.job || res });
  }

  const title = String(input.title || "").trim();
  const skill = String(input.skill || "").trim();
  const brief = String(input.brief || "").trim();
  if (!title || !skill || !brief) {
    fail("title, skill, and brief are required");
  }
  const points = Math.max(0, Math.min(Number(input.points) || 0, 9999));
  const id = store.uid("job");
  const job = {
    id,
    title,
    skill,
    brief,
    points,
    accept: String(input.accept || "").trim(),
    channel: String(input.channel || "").trim() || "私有通道交付",
    status: "clarify",
    resident: PENDING,
    clarify_locked: false,
    clarify_round: 0,
    clarify_questions: [
      "输入与格式边界是否清楚？",
      "交付物形态是否确认？",
      "验收标准是否可客观判定？",
    ],
    buyer_answers: "",
    settlement_method: "",
    settlement_buyer_confirmed: false,
    settlement_seller_confirmed: false,
    settlement_agreed: false,
    settlement_agreed_at: null,
    result_package: null,
    notes: {
      platform_custodies_funds: false,
      settlement: "off_platform",
      sell: "workflows_channels_authorized_data_slices",
      not: "dumping_kb_into_platform_or_model",
      points_are_reputation_only: true,
    },
    created_at: now(),
    updated_at: now(),
  };
  // Lightweight local match hint: if skill mentions known demo tokens, assign a label
  const sk = skill.toLowerCase();
  if (/发票|映射|schema|sku|别名/.test(skill) || /invoice|sku/i.test(sk)) {
    job.resident = "R-07 · 墨线";
    job.match_explain = "本地 MCP 演示匹配 · 墨线域";
  } else if (/nginx|5xx|日志|log/i.test(skill)) {
    job.resident = "R-12 · 夜值";
    job.match_explain = "本地 MCP 演示匹配 · 夜值域";
  } else {
    job.match_explain = "未匹配 · 待认领（MCP 本地）";
  }
  store.saveJob(job);
  return ok({ source: "local", job: publicJob(job) });
}

export async function listJobs(input) {
  if (api.hasRemote()) {
    const res = await api.remoteListJobs(input || {});
    return ok({ source: "api", jobs: res.jobs || res.items || res });
  }
  const jobs = store.listJobs(input || {}).map(publicJob);
  return ok({ source: "local", jobs, count: jobs.length });
}

export async function getJob(input) {
  const id = String((input && input.id) || "").trim();
  if (!id) fail("id is required");
  if (api.hasRemote()) {
    const res = await api.remoteGetJob(id);
    return ok({ source: "api", job: res.job || res });
  }
  const job = store.getJob(id);
  if (!job) fail("job not found: " + id);
  return ok({ source: "local", job: publicJob(job) });
}

export async function clarify(input) {
  const id = String((input && input.id) || "").trim();
  if (!id) fail("id is required");
  const role = String((input && input.role) || "seller").toLowerCase();
  const action = String((input && input.action) || "lock").toLowerCase();

  if (api.hasRemote()) {
    const res = await api.remoteClarify(id, {
      role,
      action,
      buyer_answers: input.buyer_answers || "",
    });
    return ok({ source: "api", job: res.job || res });
  }

  const job = store.getJob(id);
  if (!job) fail("job not found: " + id);
  if (job.clarify_locked || job.clarify_round >= 1) {
    fail("clarify already locked (one round max); proceed to settlement / deliver");
  }
  if (job.status !== "clarify") {
    fail("job status must be clarify to lock; got " + job.status);
  }
  if (input.buyer_answers) {
    job.buyer_answers = String(input.buyer_answers).trim();
  }
  if (action === "lock" || role === "seller") {
    job.clarify_locked = true;
    job.clarify_round = 1;
    job.status = "making";
    job.updated_at = now();
    store.saveJob(job);
  }
  return ok({
    source: "local",
    job: publicJob(job),
    hint: "Clarify locked. Next: set_settlement (off-platform; platform does not custody funds), then deliver.",
  });
}

export async function setSettlement(input) {
  const id = String((input && input.id) || "").trim();
  if (!id) fail("id is required");
  const method = normalizeMethod(input.method);
  const buyerOk = !!(input.buyer_confirmed ?? input.buyerConfirmed);
  const sellerOk = !!(input.seller_confirmed ?? input.sellerConfirmed);
  const mark =
    input.mark_agreed === true ||
    input.markAgreed === true ||
    (buyerOk && sellerOk && !!method);

  if (api.hasRemote()) {
    // Worker may not have settle endpoint yet — fall through to local overlay when remote fails
    try {
      // Prefer remote get then local merge note if no settle route
      const got = await api.remoteGetJob(id);
      const remoteJob = got.job || got;
      // Attempt a soft patch via clarify note is wrong; keep local settlement for MCP when Worker lacks endpoint
      return await setSettlementLocalFromRemote(remoteJob, {
        method,
        buyerOk,
        sellerOk,
        mark,
      });
    } catch (e) {
      // If remote missing, try pure local
      return setSettlementLocal(id, method, buyerOk, sellerOk, mark);
    }
  }
  return setSettlementLocal(id, method, buyerOk, sellerOk, mark);
}

async function setSettlementLocalFromRemote(remoteJob, opts) {
  // Mirror remote job into local store for settlement fields (Worker P0.3 settle may be Pages-only)
  const existing = store.getJob(remoteJob.id) || {
    id: remoteJob.id,
    title: remoteJob.title,
    skill: remoteJob.skill,
    brief: remoteJob.brief,
    points: remoteJob.points,
    accept: remoteJob.accept,
    channel: remoteJob.channel,
    status: remoteJob.status || "making",
    resident: remoteJob.resident,
    clarify_locked: !!remoteJob.clarify_locked,
    clarify_round: remoteJob.clarify_round || 0,
    created_at: now(),
  };
  Object.assign(existing, {
    status: remoteJob.status || existing.status,
    clarify_locked: !!remoteJob.clarify_locked || existing.clarify_locked,
  });
  store.saveJob(existing);
  return setSettlementLocal(
    existing.id,
    opts.method,
    opts.buyerOk,
    opts.sellerOk,
    opts.mark
  );
}

function setSettlementLocal(id, method, buyerOk, sellerOk, mark) {
  const job = store.getJob(id);
  if (!job) fail("job not found: " + id);
  if (job.settlement_agreed) {
    return ok({
      source: "local",
      job: publicJob(job),
      hint: "Already marked off-platform settlement agreed.",
    });
  }
  if (!job.clarify_locked && job.status === "clarify") {
    fail("Lock clarify first (one round), then set settlement.");
  }
  if (method) {
    if (SETTLE_METHODS.indexOf(method) < 0) {
      fail(
        "method must be one of: " + SETTLE_METHODS.join(", "),
        { allowed: SETTLE_METHODS }
      );
    }
    job.settlement_method = method;
  }
  if (typeof buyerOk === "boolean") job.settlement_buyer_confirmed = buyerOk;
  if (typeof sellerOk === "boolean") job.settlement_seller_confirmed = sellerOk;

  if (mark) {
    if (!job.settlement_method) fail("Choose settlement method before marking agreed.");
    if (!job.settlement_buyer_confirmed || !job.settlement_seller_confirmed) {
      fail("Both buyer_confirmed and seller_confirmed must be true to mark agreed.");
    }
    job.settlement_agreed = true;
    job.settlement_agreed_at = now();
    if (job.status === "clarify") job.status = "making";
  }
  job.updated_at = now();
  store.saveJob(job);
  return ok({
    source: "local",
    job: publicJob(job),
    disclaimer:
      "Platform does not custody funds. Remuneration is WeChat/Alipay (etc.) off-platform. This tool only records the agreement.",
  });
}

export async function deliver(input) {
  const id = String((input && input.id) || "").trim();
  if (!id) fail("id is required");
  const summary = String((input && input.summary) || "").trim();
  const artifacts = String((input && input.artifacts) || "").trim();
  const accept_check = String(
    (input && (input.accept_check || input.acceptCheck)) || ""
  ).trim();
  const attachments = String((input && input.attachments) || "").trim();
  if (!summary || !artifacts || !accept_check) {
    fail("summary, artifacts, and accept_check are required (result package)");
  }

  if (api.hasRemote()) {
    // Gate locally if we have settlement state
    const local = store.getJob(id);
    if (local && !local.settlement_agreed) {
      fail(
        "Mark off-platform settlement agreed (set_settlement) before deliver. Platform does not custody funds."
      );
    }
    const res = await api.remoteDeliver(id, {
      result_package: {
        summary,
        artifacts,
        accept_check,
        attachments,
      },
    });
    return ok({ source: "api", job: res.job || res });
  }

  const job = store.getJob(id);
  if (!job) fail("job not found: " + id);
  if (job.status !== "making") {
    fail("job must be in making status to deliver; got " + job.status);
  }
  if (!job.settlement_agreed) {
    fail(
      "Mark off-platform settlement agreed (set_settlement) before deliver. Platform does not custody funds."
    );
  }
  job.result_package = {
    summary,
    artifacts,
    accept_check,
    attachments,
    delivered_at: now(),
  };
  job.status = "accept";
  job.updated_at = now();
  store.saveJob(job);
  return ok({
    source: "local",
    job: publicJob(job),
    hint: "Result package submitted. Buyer may accept. Remuneration stays off-platform.",
  });
}

export async function acceptJob(input) {
  const id = String((input && input.id) || "").trim();
  if (!id) fail("id is required");
  if (api.hasRemote()) {
    const res = await api.remoteAccept(id, { confirm: true });
    return ok({ source: "api", job: res.job || res });
  }
  const job = store.getJob(id);
  if (!job) fail("job not found: " + id);
  if (job.status !== "accept") {
    fail("job must be awaiting accept; got " + job.status);
  }
  job.status = "done";
  job.updated_at = now();
  store.saveJob(job);
  return ok({
    source: "local",
    job: publicJob(job),
    hint: "Accepted. Pay off-platform (WeChat/Alipay). Platform does not custody or release funds. Points are reputation only.",
  });
}

export async function returnJob(input) {
  const id = String((input && input.id) || "").trim();
  if (!id) fail("id is required");
  const reason = String((input && input.reason) || "closed").trim();
  if (api.hasRemote()) {
    const res = await api.remoteReturn(id, { reason });
    return ok({ source: "api", job: res.job || res });
  }
  const job = store.getJob(id);
  if (!job) fail("job not found: " + id);
  if (job.status === "done" || job.status === "returned") {
    fail("job already terminal: " + job.status);
  }
  job.status = "returned";
  job.return_reason = reason;
  job.updated_at = now();
  store.saveJob(job);
  return ok({
    source: "local",
    job: publicJob(job),
    hint: "Intent closed. No platform refund — funds were never custodied.",
  });
}
