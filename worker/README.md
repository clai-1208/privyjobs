# PrivyJobs Worker（源码切片）

实现 `docs/backend-contract.html` 的 `/v1` 契约。**本切片只入库源码，不要求 Cloudflare 登录或生产部署。**

## 布局

```
worker/
  wrangler.toml      # name=privyjobs-api；KV JOBS 占位 id
  package.json
  SMOKE.md           # curl 烟测
  src/
    index.js         # 路由：jobs / clarify / deliver / accept / return / points
    store.js         # KV 绑定 JOBS（+ POINTS）或内存 Map 回退
    match.js         # 与客户端相同的域词 token 重叠撮合
    cors.js          # Pages + localhost CORS
    sellers.js / sellers.json  # 捆绑卖方目录（不公开 dump 全量技能）
```

## 本地 `wrangler dev`

```bash
cd worker
npm install          # 首次
npx wrangler dev     # 默认 http://127.0.0.1:8787
```

无真实 KV namespace 时：`store.js` 使用**内存 Map** 回退（进程内有效）。有 preview_id 时 wrangler 本地模拟 KV。

### 接上静态站

在任意 HTML 设：

```html
<meta name="privyjobs-api" content="http://127.0.0.1:8787">
```

或控制台：`window.PRIVYJOBS_API_BASE = "http://127.0.0.1:8787"`。

**默认 `API_BASE=""` 不变**——GitHub Pages 静态演示仍走 localStorage。

### 生产（以后）

1. 在 CF 控制台创建 KV `JOBS`（可选 `POINTS`），把 id 填进 `wrangler.toml`
2. `npx wrangler deploy`（需账号；**本切片不做**）
3. Pages meta 指向 Worker URL

## 规则

仅积分 · 澄清上限 1 轮锁定 · 结果摘要包交付 · 无论坛 · 技能不全量公开。


## Escrow.com stub (international)

Routes:

- `POST /v1/escrow/create` — body: `{ amount, currency, description, job_id }`
- `GET /v1/escrow/:id`

Env (optional; **sandbox only**):

```bash
# .dev.vars or Cloudflare secrets — do not commit
ESCROW_API_EMAIL=you@example.com
ESCROW_API_KEY=...
# optional party emails for create payload
ESCROW_BUYER_EMAIL=buyer@example.com
ESCROW_SELLER_EMAIL=seller@example.com
```

Without keys: **mock** ids (`esc_mock_…`) and statuses. Platform **never holds principal**; Escrow.com is third-party.
Docs: [docs/escrow.html](../docs/escrow.html) · API: https://www.escrow.com/api/docs/create-transaction
