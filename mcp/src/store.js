/**
 * Local JSON persistence under mcp/.data/ when PRIVYJOBS_API_BASE is unset.
 * Platform does not custody funds — this store only keeps order logs.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = path.resolve(__dirname, "../.data");
const JOBS_FILE = path.join(DATA_DIR, "jobs.json");

function ensureDir() {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
}

function readAll() {
  ensureDir();
  if (!fs.existsSync(JOBS_FILE)) return { jobs: {} };
  try {
    const raw = fs.readFileSync(JOBS_FILE, "utf8");
    const data = JSON.parse(raw);
    if (!data || typeof data !== "object") return { jobs: {} };
    if (!data.jobs || typeof data.jobs !== "object") data.jobs = {};
    return data;
  } catch {
    return { jobs: {} };
  }
}

function writeAll(data) {
  ensureDir();
  fs.writeFileSync(JOBS_FILE, JSON.stringify(data, null, 2) + "\n", "utf8");
}

export function uid(prefix) {
  return (
    prefix +
    "_" +
    Date.now().toString(36) +
    Math.random().toString(36).slice(2, 7)
  );
}

export function listJobs(filter) {
  const data = readAll();
  let jobs = Object.values(data.jobs);
  if (filter && filter.status) {
    jobs = jobs.filter((j) => j.status === filter.status);
  }
  jobs.sort((a, b) => (b.updated_at || 0) - (a.updated_at || 0));
  const limit = Math.min(Math.max(Number(filter && filter.limit) || 50, 1), 100);
  return jobs.slice(0, limit);
}

export function getJob(id) {
  const data = readAll();
  return data.jobs[id] || null;
}

export function saveJob(job) {
  const data = readAll();
  data.jobs[job.id] = job;
  writeAll(data);
  return job;
}

export function resetAll() {
  ensureDir();
  writeAll({ jobs: {} });
}

export { DATA_DIR, JOBS_FILE };
