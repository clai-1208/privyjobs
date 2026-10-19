# PrivyJobs MCP server

stdio MCP tools so external AIs can run the **same** landing chain as the static demo:

`find_sellers` / `match_sellers` → `get_quote` → `create_escrow` (intl) → `create_job` → `clarify` (1 round) → `set_settlement` (off-platform) → `deliver` → `accept` / `return_job` · `list_jobs` · `get_job`

**Product rules (encoded in every tool description):**

- Platform **does not custody funds**. Remuneration is WeChat / Alipay / other **off-platform**.
- Sell **repeatable workflows**, **private channels** models can’t enter, and **per-order authorized data slices**.
- **Not** dumping a knowledge base into the platform or a model.
- Points are **reputation garnish only**, not currency.

## Install

```bash
cd mcp
npm install
```

Requires Node ≥ 18.

## Run (stdio)

```bash
cd mcp
npm start
# or: node src/index.js
```

Persistence:

| Env | Behavior |
|---|---|
| `PRIVYJOBS_API_BASE` unset (default) | Local JSON under `mcp/.data/` (gitignored) |
| `PRIVYJOBS_API_BASE=http://127.0.0.1:8787` | Prefer Worker `/v1` (see `../worker/`); settlement may still use local overlay if Worker lacks that route |

## Cursor / Claude Desktop config

Point the MCP client at this server with **absolute** paths:

```json
{
  "mcpServers": {
    "privyjobs": {
      "command": "node",
      "args": ["/ABS/PATH/TO/privyjobs/mcp/src/index.js"],
      "env": {}
    }
  }
}
```

Optional Worker:

```json
{
  "mcpServers": {
    "privyjobs": {
      "command": "node",
      "args": ["/ABS/PATH/TO/privyjobs/mcp/src/index.js"],
      "env": {
        "PRIVYJOBS_API_BASE": "http://127.0.0.1:8787"
      }
    }
  }
}
```

## Tools

| Tool | Purpose |
|---|---|
| `find_sellers` | Rank catalog sellers by domain-token overlap (id, name, kind, domains hit, score, about) |
| `match_sellers` | Alias of `find_sellers` (same scorer as `worker/src/match.js`) |
| `get_quote` | Quote stub: price_hint (points demoted / free early), turnaround, settlement_methods (prefers `escrow` for intl), what_is_sold |
| `create_escrow` | Create Escrow.com or **mock** tx (`esc_mock_*`); platform never holds principal |
| `get_escrow_status` | Read `draft\|funded\|delivered\|accepted\|cancelled` |
| `create_job` | Buyer intent / order log |
| `clarify` | One-round lock → `making` |
| `set_settlement` | method (`wechat`/`alipay`/`other`/`international_tbd`) + buyer/seller confirms; mark agreed |
| `deliver` | Result package (requires settlement agreed) |
| `accept` | Buyer accept (status only — no platform payout) |
| `return_job` | Close intent |
| `list_jobs` | List / filter |
| `get_job` | Fetch one |

## Discovery path (buyer agent)

1. `find_sellers` / `match_sellers` with skill/brief  
2. `get_quote` with chosen `seller_id` + job summary  
3. After human OK → `create_job` → clarify → set_settlement → deliver → accept  

Ranking uses `docs/mock/sellers.json` with the same domain-token overlap idea as `worker/src/match.js`. 0 hits → empty list (no catalog dump).

## Smoke

```bash
cd mcp
npm run smoke
```

See [SMOKE.md](./SMOKE.md).

## Out of scope

Cloudflare production deploy, crypto rails, real WeChat Pay APIs.

Sample tool JSON: [`examples/find_sellers.sample.json`](examples/find_sellers.sample.json), [`examples/get_quote.sample.json`](examples/get_quote.sample.json).

