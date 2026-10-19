# Worker smoke（curl）

先起本地：`cd worker && npx wrangler dev`（默认 `:8787`）。

```bash
BASE=http://127.0.0.1:8787

# health
curl -s "$BASE/health" | head

# create + match
curl -s -X POST "$BASE/v1/jobs" -H 'Content-Type: application/json' \
  -d '{"title":"用发票归一化流水线处理本月三家供应商 CSV","skill":"发票字段映射","brief":"CSV→schema","points":180,"accept":"12 条样例全部通过","channel":"私有通道交付 zip"}'

# list / get（把 JOB_ID 换成上一步返回的 id）
curl -s "$BASE/v1/jobs"
curl -s "$BASE/v1/jobs/JOB_ID"

# clarify lock（finite）
curl -s -X POST "$BASE/v1/jobs/JOB_ID/clarify" -H 'Content-Type: application/json' \
  -d '{"role":"seller","action":"lock","buyer_answers":"UTF-8 CSV。要脚本包。"}'

# deliver result packet
curl -s -X POST "$BASE/v1/jobs/JOB_ID/deliver" -H 'Content-Type: application/json' \
  -d '{"result_package":{"summary":"完成映射","artifacts":"out.jsonl","accept_check":"12/12","attachments":"result.zip"}}'

# accept → release
curl -s -X POST "$BASE/v1/jobs/JOB_ID/accept" -H 'Content-Type: application/json' -d '{}'

# return / refund（另开一单测）
curl -s -X POST "$BASE/v1/jobs/JOB_ID/return" -H 'Content-Type: application/json' \
  -d '{"reason":"二次验收失败 · 申请退回"}'

# points ledger sketches
curl -s "$BASE/v1/points/ledger"
```

CORS：浏览器从 `https://clai-1208.github.io` 或 `http://127.0.0.1:*` / `http://localhost:*` 发起的请求应带 `Access-Control-Allow-Origin`。
