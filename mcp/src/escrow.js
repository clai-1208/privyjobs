/**
 * MCP Escrow helpers — local mock by default; optional Worker PRIVYJOBS_API_BASE.
 * Platform never holds principal.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import * as api from "./api.js";
import * as store from "./store.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ESCROW_FILE = path.join(path.resolve(__dirname, "../.data"), "escrow.json");

function readEscrowDb() {
  try {
    if (!fs.existsSync(ESCROW_FILE)) return { txs: {} };
    return JSON.parse(fs.readFileSync(ESCROW_FILE, "utf8"));
  } catch {
    return { txs: {} };
  }
}

function writeEscrowDb(db) {
  const dir = path.dirname(ESCROW_FILE);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(ESCROW_FILE, JSON.stringify(db, null, 2) + "\n");
}

function mockId() {
  return "esc_mock_" + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
}

const DISCLAIMER =
  "Platform never holds principal. Escrow.com is third-party international escrow. Domestic WeChat/Alipay are off-platform self-settle (not built here).";

export async function createEscrow(input) {
  const job_id = (input && (input.job_id || input.jobId)) || null;
  const amount = Number(input && input.amount) || 0;
  const currency = String((input && input.currency) || "USD").toUpperCase();
  const description = String((input && input.description) || "PrivyJobs order").slice(0, 500);

  if (api.hasRemote()) {
    try {
      const base = (process.env.PRIVYJOBS_API_BASE || "").replace(/\/$/, "");
      const res = await fetch(base + "/v1/escrow/create", {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify({ amount, currency, description, job_id }),
      });
      const json = await res.json();
      if (json && json.ok && job_id) attachToJob(job_id, json.escrow_tx_id, json.escrow_status || "draft");
      return { ...json, disclaimer: DISCLAIMER };
    } catch (e) {
      /* fall through to mock */
    }
  }

  const id = mockId();
  const row = {
    escrow_tx_id: id,
    escrow_status: "draft",
    amount,
    currency,
    description,
    job_id,
    created_at: new Date().toISOString(),
    mode: "mock",
  };
  const db = readEscrowDb();
  db.txs[id] = row;
  writeEscrowDb(db);
  if (job_id) attachToJob(job_id, id, "draft");
  return {
    ok: true,
    mode: "mock",
    ...row,
    disclaimer: DISCLAIMER + " Mock — no Escrow API keys configured.",
  };
}

function attachToJob(jobId, txId, status) {
  const job = store.getJob(jobId);
  if (!job) return;
  job.settlement_method = "escrow";
  job.settlement_agreed = true;
  job.settlement_buyer_confirmed = true;
  job.settlement_seller_confirmed = true;
  job.escrow_tx_id = txId;
  job.escrow_status = status;
  job.updated_at = Date.now();
  store.saveJob(job);
}

export async function getEscrowStatus(input) {
  const id = String((input && (input.id || input.escrow_tx_id || input.escrowTxId)) || "").trim();
  if (!id) throw new Error("id (escrow_tx_id) is required");

  if (api.hasRemote() && !id.startsWith("esc_mock_")) {
    try {
      const base = (process.env.PRIVYJOBS_API_BASE || "").replace(/\/$/, "");
      const res = await fetch(base + "/v1/escrow/" + encodeURIComponent(id), {
        headers: { Accept: "application/json" },
      });
      const json = await res.json();
      return { ...json, disclaimer: DISCLAIMER };
    } catch (_) {
      /* mock fallback */
    }
  }

  const db = readEscrowDb();
  const row = db.txs[id];
  if (!row) {
    return {
      ok: true,
      mode: "mock",
      escrow_tx_id: id,
      escrow_status: "draft",
      note: "Unknown id — draft stub",
      disclaimer: DISCLAIMER,
    };
  }
  return { ok: true, mode: "mock", ...row, disclaimer: DISCLAIMER };
}

export async function advanceEscrow(input) {
  const id = String((input && (input.id || input.escrow_tx_id)) || "").trim();
  const status = String((input && input.status) || "").trim();
  const allowed = ["draft", "funded", "delivered", "accepted", "cancelled"];
  if (!id) throw new Error("id required");
  if (allowed.indexOf(status) < 0) throw new Error("status must be one of " + allowed.join(", "));
  const db = readEscrowDb();
  const row = db.txs[id] || { escrow_tx_id: id, mode: "mock" };
  row.escrow_status = status;
  db.txs[id] = row;
  writeEscrowDb(db);
  if (row.job_id) attachToJob(row.job_id, id, status);
  return { ok: true, mode: "mock", escrow_tx_id: id, escrow_status: status, disclaimer: DISCLAIMER };
}
