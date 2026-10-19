# PrivyJobs MCP — smoke

## Tools expected

`find_sellers`, `match_sellers`, `get_quote`, `create_job`, `clarify`, `set_settlement`, `deliver`, `accept`, `return_job`, `list_jobs`, `get_job`

## Path under test

**find → quote → create_job → clarify → settle → deliver → accept**

## Automated

```bash
cd mcp
npm install
npm run smoke
```

Exercises handlers directly (local `.data/`), prints sample JSON for `find_sellers` and `get_quote`, then resets the job store.

Expected end line: `SMOKE_OK`

### What smoke checks

1. `find_sellers` on invoice/schema need → ranked matches with domains_hit + score  
2. `match_sellers` alias on Nginx/5xx need  
3. `get_quote` for top seller → price_hint / turnaround / settlement_methods / disclaimers  
4. Full order chain as before  

## Manual MCP client

1. List tools — confirm discovery + order tools.  
2. `find_sellers` `{ "skill": "发票映射" }`  
3. `get_quote` `{ "seller_id": "R-07", "job_summary": "…" }`  
4. Optionally `create_job` after human approval.

## Notes

- Scorer aligned with `worker/src/match.js` (domain-token overlap).  
- Catalog: `docs/mock/sellers.json` — no full KB dump.  
- Platform does not custody funds.
