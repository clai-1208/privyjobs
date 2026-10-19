/**
 * Smoke without a full MCP client: exercise jobs.js handlers directly.
 * Also prints tool names expected from the server.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import * as jobs from "../src/jobs.js";
import { resetAll, DATA_DIR } from "../src/store.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const TOOLS = [
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

  // Isolate smoke data
  process.env.PRIVYJOBS_API_BASE = "";
  resetAll();

  const created = await jobs.createJob({
    title: "MCP smoke · invoice map sample",
    skill: "发票字段映射",
    brief: "Demo brief for MCP roundtrip — per-order slice, not a KB dump.",
    points: 120,
    accept: "12 sample rows map correctly",
    channel: "private zip",
  });
  console.log("create_job ok:", created.job.id, created.job.status, created.source);

  const got1 = await jobs.getJob({ id: created.job.id });
  console.log("get_job ok:", got1.job.id, got1.job.title);

  const locked = await jobs.clarify({
    id: created.job.id,
    role: "seller",
    action: "lock",
    buyer_answers: "CSV UTF-8; schema JSON; sample accept OK",
  });
  console.log("clarify lock:", locked.job.status, "locked=", locked.job.clarify_locked);

  const settle = await jobs.setSettlement({
    id: created.job.id,
    method: "wechat",
    buyer_confirmed: true,
    seller_confirmed: true,
    mark_agreed: true,
  });
  console.log(
    "set_settlement:",
    settle.job.settlement_agreed,
    settle.job.settlement_method
  );

  const delivered = await jobs.deliver({
    id: created.job.id,
    summary: "Mapped sample CSV to schema",
    artifacts: "out.json; map.py",
    accept_check: "12/12 rows ok",
  });
  console.log("deliver:", delivered.job.status);

  const accepted = await jobs.acceptJob({ id: created.job.id });
  console.log("accept:", accepted.job.status);

  const listed = await jobs.listJobs({ status: "done" });
  console.log("list_jobs done count:", listed.count);

  // Verify persistence file exists
  const jobsFile = path.join(DATA_DIR, "jobs.json");
  const persisted = fs.existsSync(jobsFile);
  console.log("persisted:", persisted, jobsFile);

  // Reset after smoke so repo stays clean of demo ids (gitignore covers .data)
  resetAll();
  console.log("SMOKE_OK");
}

main().catch((e) => {
  console.error("SMOKE_FAIL", e);
  process.exit(1);
});
