# PrivyJobs

买工作流、私有通道与专有数据——**不是**又一个模型或 LLM 壳。

**买方（要租用的人）**贴出任务 → 平台按**卖方（有工作流的人）**声明的工作流 / 数据域**免费撮合** → 私下澄清并交付 → 双方**微信 / 支付宝站外自行结算**。**平台不托管资金**。站内「点」仅作早期声誉 / 活跃装饰，**非法币、不是下单货币**。

静态演示站（GitHub Pages）。顶栏可切换买方 / 卖方身份；演示链路：记单 → 一轮澄清锁定 → 约定站外结算 → 结果包 → 验收。

**现状口径（诚实）**：演示 · 免费撮合 · 站外自结 · 平台不托管资金 · Worker 未部署。未齐阻塞前不宣称生产撮合——见 [docs/BLOCKERS.md](docs/BLOCKERS.md)。

演示规则：锁定后 7 日未交付可关闭意向；验收失败一次可要求返工，二次失败关闭。验收只更新订单状态，不代表平台控款。

## 本地预览

```bash
python3 -m http.server 8080
# 打开 http://127.0.0.1:8080/
```

## 文档与阻塞

- [docs/BLOCKERS.md](docs/BLOCKERS.md) — 生产前阻塞（CF 凭证、真卖方候选、口径）
- [docs/seed-outreach.md](docs/seed-outreach.md) — 种子卖方私信模板（私聊用，不发广场）
- [worker/README.md](worker/README.md) — Cloudflare Worker 源码；`npx wrangler dev`；**未部署**生产
- [docs/backend-contract.html](docs/backend-contract.html) — 可共享后端契约
- [docs/agent-api.html](docs/agent-api.html) — 买方 AI 接口草案

## MCP（外部 AI）

- [`docs/escrow.html`](docs/escrow.html) — Escrow.com 国际托管说明（平台不经手本金；无密钥时 mock）
- [`mcp/`](mcp/) — stdio MCP server：`create_job` / `clarify` / `set_settlement` / `deliver` / `accept` / `return_job` / `list_jobs` / `get_job`
- 默认本机 `mcp/.data/`；设 `PRIVYJOBS_API_BASE` 可走 Worker
- 平台不托管资金；卖工作流 / 私有通道 / 按单数据切片，不是把知识库倒进模型
- 安装：`cd mcp && npm install && npm start` · 烟测：`npm run smoke` · 说明见 [mcp/README.md](mcp/README.md)

## 买方 AI API（mock）

- `docs/agent-api.html` — 买方 AI 接口草案（OpenAPI 风格）
- `docs/backend-contract.html` — 可共享后端契约（`/v1/jobs` · clarify · deliver · accept/return · points ledger）
- `docs/mock/*.json` · `docs/mock/v1/*.json` — 静态 mock；`API_BASE` 空则本机 localStorage，设置后客户端可 fetch
- `js/api.js` — `API_BASE` 接缝（`meta[name=privyjobs-api]` / `PRIVYJOBS_API_BASE`）；失败 toast 一次并回退本机
- `worker/` — Cloudflare Worker 源码（契约实现）；`cd worker && npx wrangler dev` 本地烟测；**未部署**生产，Pages 默认 `API_BASE=""` 不变
- `docs/mock/sellers.json` — 卖方目录（workflow / channel / data）；`js/main.js` fetch 加载，失败时回退内联目录

## 展廊可下载样例

- `showcase/files/normalize_invoice_schema.py` — 发票 CSV schema 映射短脚本
- `showcase/files/invoice-schema-memo.md` — 对应备忘


## 撮合（静态 demo）

下单后的卖方匹配在**浏览器端**完成：对照演示卖方技能域词 + 本机 `localStorage` 登记做 token 重叠打分；成功时展示**命中域词**，0 分则进入**待匹配池**（不向买方甩卖方目录）。卖方身份可扫池并「认领试做」。真 API / 服务端撮合尚未上线。卖方页提供「试匹配」自测。

## 卖方预登记

- `prereg.html` — 意向收集（一句话能力 / kind / 边界 / 验收≤3 / 交付 / 周转 / 联系窗 / 参考分区间 / 脱敏样例）
- 提交写入本机 localStorage；可复制 JSON；列表标 **预登记 · 非真下单**
- 免费撮合 · 站外自结 · 平台不托管资金；卖步骤/通道/按单切片（不全库倒进平台）
- 私信话术：[docs/seed-outreach.md](docs/seed-outreach.md)

## License

MIT
