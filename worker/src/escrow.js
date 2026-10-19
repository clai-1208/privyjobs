/**
 * Escrow.com thin stub — sandbox if ESCROW_API_EMAIL + ESCROW_API_KEY set, else mock.
 * Platform never holds principal; this only creates/reads third-party escrow txs.
 */

const SANDBOX = "https://api.escrow-sandbox.com/2017-09-01/transaction";

const mem = new Map();

function hasLiveKeys(env) {
  return !!(env && env.ESCROW_API_EMAIL && env.ESCROW_API_KEY);
}

function mockId() {
  return "esc_mock_" + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
}

export async function createEscrow(env, body) {
  const amount = Number(body && body.amount) || 0;
  const currency = String((body && body.currency) || "USD").toUpperCase();
  const description = String((body && body.description) || "PrivyJobs order").slice(0, 500);
  const job_id = (body && body.job_id) || null;

  if (hasLiveKeys(env)) {
    const auth =
      "Basic " +
      btoa(String(env.ESCROW_API_EMAIL) + ":" + String(env.ESCROW_API_KEY));
    // Minimal create payload — see https://www.escrow.com/api/docs/create-transaction
    const payload = {
      parties: [
        { role: "buyer", customer: env.ESCROW_BUYER_EMAIL || env.ESCROW_API_EMAIL },
        { role: "seller", customer: env.ESCROW_SELLER_EMAIL || env.ESCROW_API_EMAIL },
      ],
      currency: currency.toLowerCase(),
      description,
      items: [
        {
          title: description.slice(0, 100) || "PrivyJobs delivery",
          description,
          type: "general_merchandise",
          inspection_period: 259200,
          quantity: 1,
          schedule: [{ amount: amount || 1, payer_customer: env.ESCROW_BUYER_EMAIL || env.ESCROW_API_EMAIL, beneficiary_customer: env.ESCROW_SELLER_EMAIL || env.ESCROW_API_EMAIL }],
        },
      ],
    };
    try {
      const res = await fetch(SANDBOX, {
        method: "POST",
        headers: {
          Authorization: auth,
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify(payload),
      });
      const text = await res.text();
      let json = null;
      try {
        json = text ? JSON.parse(text) : null;
      } catch (_) {
        json = { raw: text };
      }
      if (!res.ok) {
        return {
          ok: false,
          mode: "sandbox_error",
          status: res.status,
          body: json,
          message: "Escrow sandbox create failed; check credentials/payload",
        };
      }
      return {
        ok: true,
        mode: "sandbox",
        escrow_tx_id: String(json.id || json.transaction_id || ""),
        escrow_status: "draft",
        job_id,
        raw: json,
        disclaimer: "Platform never holds principal. Escrow.com is third-party.",
      };
    } catch (e) {
      return {
        ok: false,
        mode: "sandbox_error",
        message: e && e.message ? e.message : String(e),
      };
    }
  }

  const id = mockId();
  const row = {
    id,
    escrow_tx_id: id,
    escrow_status: "draft",
    amount,
    currency,
    description,
    job_id,
    created_at: new Date().toISOString(),
    mode: "mock",
  };
  mem.set(id, row);
  return {
    ok: true,
    mode: "mock",
    escrow_tx_id: id,
    escrow_status: "draft",
    job_id,
    disclaimer:
      "Mock only — no Escrow API keys. Platform never holds principal. Set ESCROW_API_EMAIL + ESCROW_API_KEY for sandbox.",
  };
}

export async function getEscrow(env, id) {
  if (!id) return { ok: false, message: "id required" };
  if (hasLiveKeys(env) && !String(id).startsWith("esc_mock_")) {
    const auth =
      "Basic " +
      btoa(String(env.ESCROW_API_EMAIL) + ":" + String(env.ESCROW_API_KEY));
    try {
      const res = await fetch(SANDBOX + "/" + encodeURIComponent(id), {
        headers: { Authorization: auth, Accept: "application/json" },
      });
      const json = await res.json().catch(() => null);
      if (!res.ok) {
        return { ok: false, mode: "sandbox_error", status: res.status, body: json };
      }
      return {
        ok: true,
        mode: "sandbox",
        escrow_tx_id: id,
        escrow_status: (json && (json.status || json.item_status)) || "unknown",
        raw: json,
        disclaimer: "Platform never holds principal.",
      };
    } catch (e) {
      return { ok: false, mode: "sandbox_error", message: e.message || String(e) };
    }
  }
  const row = mem.get(id);
  if (!row) {
    // synthesize for unknown mock ids so client GETs work after restart
    return {
      ok: true,
      mode: "mock",
      escrow_tx_id: id,
      escrow_status: "draft",
      note: "Not in worker memory; returning draft stub",
      disclaimer: "Mock only. Platform never holds principal.",
    };
  }
  return {
    ok: true,
    mode: "mock",
    escrow_tx_id: row.escrow_tx_id,
    escrow_status: row.escrow_status,
    job_id: row.job_id,
    disclaimer: "Mock only. Platform never holds principal.",
  };
}

export async function advanceMock(id, status) {
  const row = mem.get(id) || {
    id,
    escrow_tx_id: id,
    escrow_status: "draft",
    mode: "mock",
  };
  const allowed = ["draft", "funded", "delivered", "accepted", "cancelled"];
  if (allowed.indexOf(status) >= 0) row.escrow_status = status;
  mem.set(id, row);
  return { ok: true, mode: "mock", escrow_tx_id: id, escrow_status: row.escrow_status };
}
