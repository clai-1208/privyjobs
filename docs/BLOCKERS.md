# PrivyJobs 当前阻塞（生产前）

演示站可走完下单 → 澄清 → 交付 → 验收，但下列项未齐前**不宣称「真下单撮合」**。报酬始终**站外自行结算**（微信 / 支付宝）；**平台不托管资金**。站内点仅作声誉装饰，**非法币、不是下单货币**。

## 1. Cloudflare 凭证 / 共享后端未部署

- `worker/` 源码已在仓库，本地可用 `cd worker && npx wrangler dev` 烟测。
- **生产部署**需要 Cloudflare 账户、KV（`JOBS` 等）与 `wrangler deploy` 凭证。
- 无凭证时：订单与演示声誉账本仍在本机 `localStorage`，**不能跨设备**。
- Pages 默认 `API_BASE=""`（`meta[name=privyjobs-api]` 为空）不变；接上 Worker 后再改 meta。

## 2. 真 / 预登记卖方候选不足

- 种子方案与预登记页已有；目标约谈锁 **3 个**候选。
- 「总裁自挂 1 条真流水线」按站令：**平台完全做完前不叫总裁，此项暂搁**。
- 话术模板见 [seed-outreach.md](./seed-outreach.md)（私聊用，不发广场帖）。

## 2b. Escrow.com 国际密钥（可选）

- 代码路径与 mock 已就绪（`docs/escrow.html` · Worker `/v1/escrow/*` · MCP `create_escrow`）。
- **真沙箱**需 `ESCROW_API_EMAIL` + `ESCROW_API_KEY`——未齐前保持 mock；**不要催总裁要密钥直到路径验完**。
- 平台永不经手本金；国内支付轨另议。

## 3. 口径

| 可以这样说 | 不要这样说 |
|---|---|
| 演示 · 免费撮合 · 站外自结 · 平台不托管资金 | 真下单撮合已上线 |
| Worker 源码在仓库 / 未部署 | 已接生产后端 |
| 点 = 声誉装饰 · 非法币 · 非下单货币 | 积分托管 / 担保放款 / 平台控款 |
| 双方微信 / 支付宝自行结算 | 平台资金托管 / 放款 |

叫总裁过目条件见仓库旁工作笔记 `DONE-WHEN`（未齐则不 Call）。

## 相关

- [worker/README.md](../worker/README.md) — 本地 wrangler、如何接 `API_BASE`
- [backend-contract.html](./backend-contract.html) — `/v1` 契约
- [seed-outreach.md](./seed-outreach.md) — 种子卖方私信模板
