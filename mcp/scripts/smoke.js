/**
 * Smoke without a full MCP client: exercise discover + jobs handlers.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import * as jobs from "../src/jobs.js";
import * as discover from "../src/discover.js";
import { resetAll, DATA_DIR } from "../src/store.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const TOOLS = [
  "find_sellers",
  "match_sellers",
  "get_quote",
  "create_job",
  "clarify",
  "set_settlement",
  "deliver",
  "accept",
  "return_job",
  "list_jobs",
  "get_job",
];

async function main() {
  console.log("== PrivyJobs MCP smoke ==");
  console.log("tools:", TOOLS.join(", "));
  console.log("data dir:", DATA_DIR);

  process.env.PRIVYJOBS_API_BASE = "";
  resetAll();

  const found = await discover.findSellers({
    skill: "发票字段映射 CSV schema",
    brief: "三家供应商发票归一化",
    limit: 3,
  });
  console.log("--- find_sellers sample ---");
  console.log(JSON.stringify(found, null, 2));

  const matched = await discover.matchSellers({
    need: "Nginx 5xx access log 尖峰归因",
    limit: 2,
  });
  console.log("match_sellers count:", matched.count, "top:", matched.matches[0] && matched.matches[0].id);

  const top = (found.matches && found.matches[0]) || {};
  const quote = await discover.getQuote({
    seller_id: top.id || "R-07",
    job_summary: "用发票归一化流水线处理本月三家供应商 CSV；12 条样例验收",
  });
  console.log("--- get_quote sample ---");
  console.log(JSON.stringify(quote, null, 2));

  const created = await jobs.createJob({
    title: "MCP smoke · invoice map sample",
    skill: "发票字段映射",
    brief: "Demo brief for MCP roundtrip — per-order slice, not a KB dump.",
    points: 120,
    accept: "12 sample rows map correctly",
    channel: "private zip",
  });
  console.log("create_job ok:", created.job.id, created.job.status);

  const got1 = await jobs.getJob({ id: created.job.id });
  console.log("get_job ok:", got1.job.id);

  await jobs.clarify({
    id: created.job.id,
    role: "seller",
    action: "lock",
    buyer_answers: "CSV UTF-8; schema JSON; sample accept OK",
  });
  await jobs.setSettlement({
    id: created.job.id,
    method: "wechat",
    buyer_confirmed: true,
    seller_confirmed: true,
    mark_agreed: true,
  });
  await jobs.deliver({
    id: created.job.id,
    summary: "Mapped sample CSV to schema",
    artifacts: "out.json; map.py",
    accept_check: "12/12 rows ok",
  });
  const accepted = await jobs.acceptJob({ id: created.job.id });
  console.log("accept:", accepted.job.status);

  const listed = await jobs.listJobs({ status: "done" });
  console.log("list_jobs done count:", listed.count);
  console.log("persisted:", fs.existsSync(path.join(DATA_DIR, "jobs.json")));

  // Write samples for docs/report
  const outDir = path.join(__dirname, "../.data");
  fs.mkdirSync(outDir, { recursive: true });
  fs.writeFileSync(
    path.join(outDir, "smoke-find_sellers.json"),
    JSON.stringify(found, null, 2) + "\n"
  );
  fs.writeFileSync(
    path.join(outDir, "smoke-get_quote.json"),
    JSON.stringify(quote, null, 2) + "\n"
  );

  resetAll();
  console.log("SMOKE_OK");
}

main().catch((e) => {
  console.error("SMOKE_FAIL", e);
  process.exit(1);
});
