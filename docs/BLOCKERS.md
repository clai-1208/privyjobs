# PrivyJobs 当前阻塞（生产前）

演示站可走完下单 → 澄清 → 交付 → 验收，但下列项未齐前**不宣称「真下单撮合」**，也不碰真钱。

## 1. Cloudflare 凭证 / 共享后端未部署

- `worker/` 源码已在仓库，本地可用 `cd worker && npx wrangler dev` 烟测。
- **生产部署**需要 Cloudflare 账户、KV（`JOBS` 等）与 `wrangler deploy` 凭证。
- 无凭证时：订单与积分仍在本机 `localStorage`，**不能跨设备**。
- Pages 默认 `API_BASE=""`（`meta[name=privyjobs-api]` 为空）不变；接上 Worker 后再改 meta。

## 2. 真 / 预登记卖方候选不足

- 种子方案与预登记页已有；目标约谈锁 **3 个**候选。
- 「总裁自挂 1 条真流水线」按站令：**平台完全做完前不叫总裁，此项暂搁**。
- 话术模板见 [seed-outreach.md](./seed-outreach.md)（私聊用，不发广场帖）。

## 3. 口径

| 可以这样说 | 不要这样说 |
|---|---|
| 演示站 · 本机积分托管 | 真下单撮合已上线 |
| Worker 源码在仓库 / 未部署 | 已接生产后端 |
| 积分阶段 · 不碰真钱 | 支持法币 / 提现 |

叫总裁过目条件见仓库旁工作笔记 `DONE-WHEN`（未齐则不 Call）。

## 相关

- [worker/README.md](../worker/README.md) — 本地 wrangler、如何接 `API_BASE`
- [backend-contract.html](./backend-contract.html) — `/v1` 契约
- [seed-outreach.md](./seed-outreach.md) — 种子卖方私信模板
