/**
 * PrivyJobs client API seam.
 * API_BASE empty (default) → callers keep using localStorage (offline demo).
 * API_BASE set (meta[name=privyjobs-api] or window.PRIVYJOBS_API_BASE) →
 * try fetch /v1/... ; on network / HTTP fail toast once and return null (fallback local).
 * No Worker required for this slice; static docs/mock/v1/*.json mirror the contract.
 */
(function (global) {
  "use strict";

  function resolveApiBase() {
    try {
      var meta = document.querySelector('meta[name="privyjobs-api"]');
      if (meta) {
        var c = (meta.getAttribute("content") || "").trim();
        if (c) return c.replace(/\/$/, "");
      }
    } catch (err) { /* ignore */ }
    if (typeof global.PRIVYJOBS_API_BASE === "string") {
      return global.PRIVYJOBS_API_BASE.trim().replace(/\/$/, "");
    }
    return "";
  }

  var API_BASE = resolveApiBase();
  var toastedFail = false;

  function toastOnce(msg) {
    if (toastedFail) return;
    toastedFail = true;
    var text = msg || "API 不可用，已回退本机 localStorage";
    var el = document.getElementById("pj-api-toast");
    if (!el) {
      el = document.createElement("div");
      el.id = "pj-api-toast";
      el.className = "pj-api-toast";
      el.setAttribute("role", "status");
      document.body.appendChild(el);
    }
    el.textContent = text;
    el.classList.add("is-visible");
    setTimeout(function () {
      el.classList.remove("is-visible");
    }, 4200);
  }

  function hasApi() {
    return !!API_BASE;
  }

  function apiFetch(path, opts) {
    if (!API_BASE) return Promise.resolve(null);
    var url = API_BASE.replace(/\/$/, "") + path;
    var headers = { Accept: "application/json" };
    var init = opts || {};
    if (init.body && typeof init.body === "object") {
      headers["Content-Type"] = "application/json";
      init = {
        method: init.method || "POST",
        headers: headers,
        body: JSON.stringify(init.body),
        cache: "no-store",
      };
    } else {
      init = {
        method: init.method || "GET",
        headers: headers,
        cache: "no-store",
      };
      if (opts && opts.body) init.body = opts.body;
    }
    return fetch(url, init)
      .then(function (r) {
        if (!r.ok) throw new Error("HTTP " + r.status);
        return r.json();
      })
      .catch(function (err) {
        toastOnce(
          "API 不可用（" +
            (err && err.message ? err.message : "network") +
            "），已回退本机 localStorage"
        );
        return null;
      });
  }

  global.PrivyJobsAPI = {
    API_BASE: API_BASE,
    hasApi: hasApi,
    toastOnce: toastOnce,
    /** POST /v1/jobs — create + match */
    createJob: function (body) {
      return apiFetch("/v1/jobs", { method: "POST", body: body || {} });
    },
    /** GET /v1/jobs */
    listJobs: function (query) {
      var q = query ? "?" + query : "";
      return apiFetch("/v1/jobs" + q, { method: "GET" });
    },
    /** GET /v1/jobs/:id */
    getJob: function (id) {
      return apiFetch("/v1/jobs/" + encodeURIComponent(id), { method: "GET" });
    },
    /** POST /v1/jobs/:id/clarify — finite round */
    clarify: function (id, body) {
      return apiFetch("/v1/jobs/" + encodeURIComponent(id) + "/clarify", {
        method: "POST",
        body: body || {},
      });
    },
    /** POST /v1/jobs/:id/deliver — result packet */
    deliver: function (id, body) {
      return apiFetch("/v1/jobs/" + encodeURIComponent(id) + "/deliver", {
        method: "POST",
        body: body || {},
      });
    },
    /** POST /v1/jobs/:id/accept */
    accept: function (id, body) {
      return apiFetch("/v1/jobs/" + encodeURIComponent(id) + "/accept", {
        method: "POST",
        body: body || {},
      });
    },
    /** POST /v1/jobs/:id/return */
    returnJob: function (id, body) {
      return apiFetch("/v1/jobs/" + encodeURIComponent(id) + "/return", {
        method: "POST",
        body: body || {},
      });
    },
    /** GET /v1/points/ledger — freeze / release / refund sketch */
    pointsLedger: function () {
      return apiFetch("/v1/points/ledger", { method: "GET" });
    },
  };
})(typeof window !== "undefined" ? window : this);
