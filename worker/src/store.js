/**
 * Persistence: Cloudflare KV binding JOBS (and optional POINTS),
 * with in-memory Map fallback for bare `wrangler dev` without preview ids.
 */

const mem = {
  jobs: new Map(),
  ledger: [],
  account: { balance: 1000, frozen: 0, seller_earned: 0 },
};

function kvGet(ns, key) {
  if (!ns || typeof ns.get !== "function") return Promise.resolve(null);
  return ns.get(key, { type: "json" }).catch(() => null);
}

function kvPut(ns, key, value) {
  if (!ns || typeof ns.put !== "function") return Promise.resolve(false);
  return ns.put(key, JSON.stringify(value)).then(() => true).catch(() => false);
}

export function createStore(env) {
  const jobsNs = env && env.JOBS;
  const pointsNs = (env && env.POINTS) || jobsNs;
  const useKv = !!(jobsNs && typeof jobsNs.get === "function");

  return {
    mode: useKv ? "kv" : "memory",

    async listJobIds() {
      if (useKv) {
        const meta = (await kvGet(jobsNs, "jobs:index")) || { ids: [] };
        return Array.isArray(meta.ids) ? meta.ids : [];
      }
      return Array.from(mem.jobs.keys());
    },

    async getJob(id) {
      if (!id) return null;
      if (useKv) return (await kvGet(jobsNs, "job:" + id)) || null;
      return mem.jobs.get(id) || null;
    },

    async putJob(job) {
      if (!job || !job.id) throw new Error("job.id required");
      if (useKv) {
        await kvPut(jobsNs, "job:" + job.id, job);
        const meta = (await kvGet(jobsNs, "jobs:index")) || { ids: [] };
        const ids = Array.isArray(meta.ids) ? meta.ids.slice() : [];
        if (ids.indexOf(job.id) < 0) ids.unshift(job.id);
        await kvPut(jobsNs, "jobs:index", { ids: ids.slice(0, 500) });
        return job;
      }
      mem.jobs.set(job.id, job);
      return job;
    },

    async listJobs({ status, limit, offset } = {}) {
      const ids = await this.listJobIds();
      const lim = Math.min(Math.max(limit || 20, 1), 100);
      const off = Math.max(offset || 0, 0);
      const out = [];
      for (let i = 0; i < ids.length; i++) {
        const j = await this.getJob(ids[i]);
        if (!j) continue;
        if (status && j.status !== status) continue;
        out.push(j);
      }
      const total = out.length;
      const page = out.slice(off, off + lim);
      return { jobs: page, page: { limit: lim, offset: off, total } };
    },

    async getAccount() {
      if (useKv) {
        const a = await kvGet(pointsNs, "points:account");
        if (a) return a;
        return { balance: 1000, frozen: 0, seller_earned: 0 };
      }
      return { ...mem.account };
    },

    async putAccount(account) {
      if (useKv) {
        await kvPut(pointsNs, "points:account", account);
        return account;
      }
      mem.account = { ...account };
      return mem.account;
    },

    async getLedger() {
      if (useKv) {
        const led = await kvGet(pointsNs, "points:ledger");
        return Array.isArray(led) ? led : [];
      }
      return mem.ledger.slice();
    },

    async appendLedger(entry) {
      const list = await this.getLedger();
      list.unshift(entry);
      const trimmed = list.slice(0, 200);
      if (useKv) {
        await kvPut(pointsNs, "points:ledger", trimmed);
      } else {
        mem.ledger = trimmed;
      }
      return entry;
    },

    /** freeze / release / refund sketches — mutate account + ledger */
    async freeze(amount, orderId, note) {
      const n = Math.abs(Number(amount) || 0);
      const acct = await this.getAccount();
      if (acct.balance < n) {
        const err = new Error("insufficient_balance");
        err.code = "insufficient_balance";
        throw err;
      }
      acct.balance -= n;
      acct.frozen += n;
      await this.putAccount(acct);
      const entry = {
        id: "led_" + Date.now().toString(36),
        ts: new Date().toISOString(),
        type: "freeze",
        amount: -n,
        note: note || "意向记录",
        order_id: orderId,
        role: "buyer",
      };
      await this.appendLedger(entry);
      return { account: acct, entry };
    },

    async release(amount, orderId, note) {
      const n = Math.abs(Number(amount) || 0);
      const acct = await this.getAccount();
      acct.frozen = Math.max(0, (acct.frozen || 0) - n);
      acct.seller_earned = (acct.seller_earned || 0) + n;
      await this.putAccount(acct);
      const entry = {
        id: "led_" + Date.now().toString(36),
        ts: new Date().toISOString(),
        type: "release",
        amount: n,
        note: note || "验收确认",
        order_id: orderId,
        role: "both",
      };
      await this.appendLedger(entry);
      return { account: acct, entry };
    },

    async refund(amount, orderId, note) {
      const n = Math.abs(Number(amount) || 0);
      const acct = await this.getAccount();
      acct.frozen = Math.max(0, (acct.frozen || 0) - n);
      acct.balance = (acct.balance || 0) + n;
      await this.putAccount(acct);
      const entry = {
        id: "led_" + Date.now().toString(36),
        ts: new Date().toISOString(),
        type: "refund",
        amount: n,
        note: note || "申请退回 · 解冻",
        order_id: orderId,
        role: "buyer",
      };
      await this.appendLedger(entry);
      return { account: acct, entry };
    },
  };
}
