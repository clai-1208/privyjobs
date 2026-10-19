# PrivyJobs MCP — smoke

## Tools expected

`create_job`, `clarify`, `set_settlement`, `deliver`, `accept`, `return_job`, `list_jobs`, `get_job`

## Automated roundtrip (no MCP client)

```bash
cd mcp
npm install
npm run smoke
```

This exercises the job handlers directly (local `.data/`), then resets the store:

1. `create_job` → status `clarify`
2. `get_job` → same id
3. `clarify` lock → `making`
4. `set_settlement` wechat + both confirms + mark → `settlement_agreed`
5. `deliver` result package → `accept`
6. `accept` → `done`
7. `list_jobs` status=done

Expected console end line: `SMOKE_OK`

## Manual MCP client check (optional)

With the server configured in Cursor/Claude Desktop:

1. List tools — confirm the eight names above.
2. Call `create_job` with title/skill/brief.
3. Call `get_job` with the returned id.

## Notes

- Default mode does **not** need Cloudflare.
- Settlement is recorded only; platform does not custody funds.
