/**
 * Optional Worker client when PRIVYJOBS_API_BASE is set.
 * Falls back to local store otherwise.
 */

function base() {
  const b = (process.env.PRIVYJOBS_API_BASE || "").trim().replace(/\/$/, "");
  return b || "";
}

export function hasRemote() {
  return !!base();
}

async function req(method, path, body) {
  const url = base() + path;
  const opts = {
    method,
    headers: { Accept: "application/json", "Content-Type": "application/json" },
  };
  if (body !== undefined) opts.body = JSON.stringify(body);
  const res = await fetch(url, opts);
  const text = await res.text();
  let json = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    json = { raw: text };
  }
  if (!res.ok) {
    const err = new Error(
      (json && (json.message || json.error)) || "HTTP " + res.status
    );
    err.status = res.status;
    err.body = json;
    throw err;
  }
  return json;
}

export async function remoteCreateJob(body) {
  return req("POST", "/v1/jobs", body);
}
export async function remoteListJobs(query) {
  const q = new URLSearchParams();
  if (query && query.status) q.set("status", query.status);
  if (query && query.limit) q.set("limit", String(query.limit));
  const qs = q.toString();
  return req("GET", "/v1/jobs" + (qs ? "?" + qs : ""));
}
export async function remoteGetJob(id) {
  return req("GET", "/v1/jobs/" + encodeURIComponent(id));
}
export async function remoteClarify(id, body) {
  return req("POST", "/v1/jobs/" + encodeURIComponent(id) + "/clarify", body);
}
export async function remoteDeliver(id, body) {
  return req("POST", "/v1/jobs/" + encodeURIComponent(id) + "/deliver", body);
}
export async function remoteAccept(id, body) {
  return req("POST", "/v1/jobs/" + encodeURIComponent(id) + "/accept", body);
}
export async function remoteReturn(id, body) {
  return req("POST", "/v1/jobs/" + encodeURIComponent(id) + "/return", body);
}
