/* PrivyJobs lightweight i18n — zh + en, localStorage override */
(function (global) {
  var LANG_KEY = "privyjobs_lang";
  var dict = {};
  var lang = "zh";
  var readyCallbacks = [];
  var isReady = false;

  function detectDefault() {
    var saved = null;
    try {
      saved = localStorage.getItem(LANG_KEY);
    } catch (e) {}
    if (saved === "en" || saved === "zh") return saved;
    var nav =
      (navigator.languages && navigator.languages[0]) ||
      navigator.language ||
      "zh";
    return /^en\b/i.test(String(nav)) ? "en" : "zh";
  }

  function localeBase() {
    var path = (location.pathname || "").replace(/\\/g, "/");
    if (/\/(docs|showcase)\//.test(path)) return "../locales/";
    return "locales/";
  }

  function t(key, vars) {
    var s = dict[key];
    if (s == null || s === "") s = key;
    if (vars && typeof vars === "object") {
      s = String(s).replace(/\{(\w+)\}/g, function (_, k) {
        return vars[k] != null ? String(vars[k]) : "{" + k + "}";
      });
    }
    return s;
  }

  function applyAttr(el, attr, key) {
    if (!key) return;
    var val = t(key);
    if (attr === "text" || attr === "html") return;
    if (attr === "title") el.setAttribute("title", val);
    else if (attr === "placeholder") el.setAttribute("placeholder", val);
    else if (attr === "aria-label") el.setAttribute("aria-label", val);
    else el.setAttribute(attr, val);
  }

  function applyElement(el) {
    var key = el.getAttribute("data-i18n");
    if (key) {
      if (el.hasAttribute("data-i18n-html")) {
        el.innerHTML = t(key);
      } else {
        el.textContent = t(key);
      }
    }
    var attrs = el.getAttribute("data-i18n-attr");
    if (attrs) {
      attrs.split(";").forEach(function (pair) {
        var parts = pair.split(":").map(function (x) {
          return x.trim();
        });
        if (parts.length === 2) applyAttr(el, parts[0], parts[1]);
      });
    }
  }

  function applyAll(root) {
    var scope = root || document;
    var nodes = scope.querySelectorAll("[data-i18n], [data-i18n-attr]");
    for (var i = 0; i < nodes.length; i++) applyElement(nodes[i]);
    document.documentElement.setAttribute("lang", lang === "en" ? "en" : "zh-CN");
    var titleKey = document.body && document.body.getAttribute("data-i18n-title");
    if (titleKey) document.title = t(titleKey);
  }

  function renderLangToggle() {
    var headerInner = document.querySelector(".site-header .inner");
    if (!headerInner) return;
    var existing = document.getElementById("lang-toggle");
    var host = existing;
    if (!host) {
      host = document.createElement("div");
      host.id = "lang-toggle";
      host.className = "lang-toggle";
      host.setAttribute("role", "group");
      host.setAttribute("aria-label", t("lang.toggle_aria"));
      var nav = headerInner.querySelector(".nav");
      if (nav) headerInner.insertBefore(host, nav);
      else headerInner.appendChild(host);
    }
    host.setAttribute("aria-label", t("lang.toggle_aria"));
    host.innerHTML =
      '<button type="button" class="lang-btn' +
      (lang === "zh" ? " is-active" : "") +
      '" data-set-lang="zh" lang="zh-CN">中文</button>' +
      '<button type="button" class="lang-btn' +
      (lang === "en" ? " is-active" : "") +
      '" data-set-lang="en" lang="en">English</button>';
  }

  function wireLangToggle() {
    if (wireLangToggle._wired) return;
    wireLangToggle._wired = true;
    document.addEventListener("click", function (e) {
      var btn = e.target.closest("[data-set-lang]");
      if (!btn) return;
      var next = btn.getAttribute("data-set-lang");
      if (next === "en" || next === "zh") setLang(next);
    });
  }

  function ensureDocsLead() {
    if (!/\/docs\//.test(location.pathname || "")) return;
    var main = document.querySelector("main");
    if (!main) return;
    var existing = document.getElementById("docs-en-lead");
    if (lang === "en") {
      if (!existing) {
        existing = document.createElement("p");
        existing.id = "docs-en-lead";
        existing.className = "note docs-en-lead";
        main.insertBefore(existing, main.firstChild);
      }
      existing.textContent = t("docs.en_lead");
      existing.classList.remove("hidden");
    } else if (existing) {
      existing.classList.add("hidden");
    }
  }

  function notifyReady() {
    isReady = true;
    for (var i = 0; i < readyCallbacks.length; i++) {
      try {
        readyCallbacks[i]();
      } catch (err) {
        console.error(err);
      }
    }
    readyCallbacks = [];
    try {
      document.dispatchEvent(new CustomEvent("pj-i18n-ready", { detail: { lang: lang } }));
    } catch (e2) {}
  }

  function whenReady(cb) {
    if (isReady) cb();
    else readyCallbacks.push(cb);
  }

  function loadDict(nextLang, cb) {
    var url = localeBase() + nextLang + ".json";
    fetch(url, { cache: "no-cache" })
      .then(function (r) {
        if (!r.ok) throw new Error("locale " + r.status);
        return r.json();
      })
      .then(function (data) {
        dict = data || {};
        lang = nextLang;
        try {
          localStorage.setItem(LANG_KEY, lang);
        } catch (e) {}
        if (cb) cb(null);
      })
      .catch(function (err) {
        console.warn("i18n load failed", url, err);
        if (cb) cb(err);
      });
  }

  function refreshUI() {
    applyAll(document);
    renderLangToggle();
    ensureDocsLead();
    try {
      document.dispatchEvent(new CustomEvent("pj-i18n-change", { detail: { lang: lang } }));
    } catch (e) {}
  }

  function setLang(next) {
    if (next !== "en" && next !== "zh") return;
    loadDict(next, function () {
      refreshUI();
    });
  }

  function getLang() {
    return lang;
  }

  function init() {
    wireLangToggle();
    var initial = detectDefault();
    loadDict(initial, function (err) {
      if (err && initial !== "zh") {
        loadDict("zh", function () {
          refreshUI();
          notifyReady();
        });
        return;
      }
      refreshUI();
      notifyReady();
    });
  }

  global.PJ_I18N = {
    t: t,
    setLang: setLang,
    getLang: getLang,
    whenReady: whenReady,
    applyAll: applyAll,
    refresh: refreshUI,
  };
  global.t = t;

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})(window);
