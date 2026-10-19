/**
 * CORS: GitHub Pages origin + localhost / 127.0.0.1 (any port).
 */

const PAGES_ORIGIN = "https://clai-1208.github.io";

export function isAllowedOrigin(origin) {
  if (!origin) return false;
  if (origin === PAGES_ORIGIN) return true;
  try {
    const u = new URL(origin);
    if (u.protocol !== "http:" && u.protocol !== "https:") return false;
    const host = u.hostname;
    if (host === "localhost" || host === "127.0.0.1") return true;
  } catch (_) {
    return false;
  }
  return false;
}

export function corsHeaders(request) {
  const origin = request.headers.get("Origin") || "";
  const h = {
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Accept, Authorization",
    "Access-Control-Max-Age": "86400",
    Vary: "Origin",
  };
  if (isAllowedOrigin(origin)) {
    h["Access-Control-Allow-Origin"] = origin;
  } else if (!origin) {
    /* non-browser / curl — no ACAO needed */
  } else {
    /* disallowed: omit ACAO so browser blocks */
  }
  return h;
}

export function withCors(request, response) {
  const extra = corsHeaders(request);
  const headers = new Headers(response.headers);
  Object.keys(extra).forEach((k) => headers.set(k, extra[k]));
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}
