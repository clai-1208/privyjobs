(function () {

  function tt(key, vars) {
    if (window.PJ_I18N && typeof window.PJ_I18N.t === "function") {
      return window.PJ_I18N.t(key, vars);
    }
    return key;
  }

  "use strict";

  var ORDERS_KEY = "privyjobs_orders";
  var REGS_KEY = "privyjobs_registrations";
  var LAST_JOB_KEY = "privyjobs_last_job";
  var ACCOUNT_KEY = "privyjobs_points_account";
  var LEDGER_KEY = "privyjobs_points_ledger";
  var ROLE_KEY = "privyjobs_role";
  var TOUR_KEY = "privyjobs_tour";
  var SELLER_EARN_KEY = "privyjobs_seller_earned";
  var PREREG_KEY = "privyjobs_prereg";
  var FAKE_SELLER_KEY = "privyjobs_fake_seller";

  /* —— API_BASE seam (js/api.js): empty → localStorage only —— */
  function apiReady() {
    return (
      typeof window !== "undefined" &&
      window.PrivyJobsAPI &&
      typeof window.PrivyJobsAPI.hasApi === "function" &&
      window.PrivyJobsAPI.hasApi()
    );
  }

  function apiNotify(op, id, body) {
    if (!apiReady()) return;
    var A = window.PrivyJobsAPI;
    var p = null;
    if (op === "clarify") p = A.clarify(id, body);
    else if (op === "deliver") p = A.deliver(id, body);
    else if (op === "accept") p = A.accept(id, body);
    else if (op === "return") p = A.returnJob(id, body);
    else if (op === "create") p = A.createJob(body);
    if (p && typeof p.then === "function") {
      p.then(function () { /* best-effort; local already applied */ });
    }
  }


  var STATUS = {
    clarify: "待澄清",
    making: "制作中",
    accept: "待验收",
    done: "已完成",
    returned: "已退回",
  };

  /* —— Seller catalog + client-side match (static demo) —— */
  /* Inline fallback used immediately; fetch docs/mock/sellers.json when available. */
  var INLINE_SELLER_CATALOG = [
    {
      id: "R-07",
      name: "墨线",
      label: "R-07 · 墨线",
      kind: "workflow",
      domains: ["发票", "映射", "schema", "CSV", "同义词", "SKU", "别名"],
      showcase: true,
      about: "文档结构化 / 数据清洗流水线。售出同义词表与映射脚本。",
      voice: "墨线",
      questions: [
        "输入：原始文件格式与编码？（CSV / JSON / 其他）",
        "输出：统一 schema 的 JSON 行，还是附同义词表的脚本包？",
        "验收：用哪 1–2 条客观条件判定完成？",
      ],
    },
    {
      id: "R-12",
      name: "夜值",
      label: "R-12 · 夜值",
      kind: "workflow",
      domains: ["Nginx", "5xx", "access log", "归因", "尖峰"],
      showcase: true,
      about: "访问日志归因清单。按固定复盘步骤跑脱敏 log。",
      voice: "夜值",
      questions: [
        "日志：access log 时间窗与脱敏范围？",
        "输出：时间窗 + 路径占比备忘，还是附 grep 脚本？",
        "验收：哪几条尖峰路径需要可复核？",
      ],
    },
    {
      id: "R-03",
      name: "短句",
      label: "R-03 · 短句",
      kind: "workflow",
      domains: ["Changelog", "中英", "精简", "禁词", "短句"],
      showcase: true,
      about: "Changelog 精简流水线：工程备注 → 用户短句。",
      voice: "短句",
      questions: [
        "输入：工程备注条数与语言？（中 / 英 / 混）",
        "输出：中英对照短句，还是仅中文？",
        "验收：字数上限与禁词表是否沿用默认？",
      ],
    },
    {
      id: "R-21",
      name: "闸口",
      label: "R-21 · 闸口",
      kind: "channel",
      domains: ["内推", "闭门会", "私有群", "渠道", "工单检索", "内网文档"],
      showcase: true,
      about: "私有通道：内网文档 / 工单检索与闭门会纪要投递，不经公开广场。",
      voice: "闸口",
      questions: [
        "通道：内推群 / 闭门会纪要 / 内网工单检索，哪一种？",
        "输出：检索摘要包，还是带权限说明的通道链接清单？",
        "验收：命中条数与脱敏范围如何判定？",
      ],
    },
    {
      id: "R-18",
      name: "底表",
      label: "R-18 · 底表",
      kind: "data",
      domains: ["脱敏样本", "专有语料", "数据集", "价目", "合规词表"],
      showcase: true,
      about: "专有数据：行业价目表与合规词表；可租用脱敏样本 / 专有语料切片。",
      voice: "底表",
      questions: [
        "数据：行业价目、合规词表，还是脱敏样本切片？",
        "输出：CSV / JSON 数据集，还是附字段字典的语料包？",
        "验收：样本量与脱敏规则是否按你方清单？",
      ],
    },
  ];

  var SELLER_CATALOG = INLINE_SELLER_CATALOG.slice();

  function sellersJsonUrl() {
    var base = pageDepth();
    return (base === "." ? "" : base + "/") + "docs/mock/sellers.json";
  }

  function normalizeSellerList(data) {
    if (!data) return null;
    if (Array.isArray(data)) return data;
    if (Array.isArray(data.sellers)) return data.sellers;
    return null;
  }

  function applySellerCatalog(list) {
    if (!list || !list.length) return false;
    SELLER_CATALOG = list.slice();
    renderSellerCatalog();
    return true;
  }

  function loadSellerCatalog() {
    var url = sellersJsonUrl();
    try {
      fetch(url, { cache: "no-store" })
        .then(function (r) {
          if (!r.ok) throw new Error("HTTP " + r.status);
          return r.json();
        })
        .then(function (data) {
          var list = normalizeSellerList(data);
          if (list && list.length) applySellerCatalog(list);
        })
        .catch(function () {
          /* keep INLINE_SELLER_CATALOG already assigned to SELLER_CATALOG */
        });
    } catch (err) {
      /* sync fallback: inline catalog already in place */
    }
  }

  function tokenizeDomains(raw) {
    if (!raw) return [];
    return String(raw)
      .split(/[|,\uFF0C\u3001\/\s]+/)
      .map(function (t) {
        return t.trim();
      })
      .filter(Boolean);
  }

  function haystackOf(job) {
    return [job.skill || "", job.title || "", job.brief || "", job.accept || ""]
      .join(" ")
      .toLowerCase();
  }

  function scoreSeller(seller, hay) {
    var score = 0;
    var hits = [];
    var domains = seller.domains || [];
    for (var i = 0; i < domains.length; i++) {
      var raw = String(domains[i] || "");
      var tok = raw.toLowerCase();
      if (tok && hay.indexOf(tok) >= 0) {
        score += 1;
        hits.push(raw);
      }
    }
    return { score: score, hits: hits };
  }

  function sellersForMatch() {
    var list = SELLER_CATALOG.slice();
    var regs = getRegs();
    for (var i = 0; i < regs.length; i++) {
      var r = regs[i];
      list.push({
        id: r.id || "reg",
        name: r.name || "本机登记",
        label: (r.id ? r.id + " · " : "") + (r.name || "本机登记"),
        kind: r.kind || "workflow",
        domains: tokenizeDomains(r.domain).concat(tokenizeDomains(r.offer)),
        showcase: false,
        about: r.offer || "",
        voice: r.name || "本机登记",
        questions: [
          "输入与格式边界是否清楚？",
          "交付物形态是否确认？",
          "验收标准是否可客观判定？",
        ],
        fromReg: true,
      });
    }
    return list;
  }

  function matchSeller(job) {
    var hay = haystackOf(job);
    var sellers = sellersForMatch();
    var best = null;
    var bestScore = 0;
    var bestHits = [];
    for (var j = 0; j < sellers.length; j++) {
      var s2 = sellers[j];
      var sc2 = scoreSeller(s2, hay);
      if (sc2.score <= 0) continue;
      if (
        !best ||
        sc2.score > bestScore ||
        (sc2.score === bestScore && s2.showcase && !best.showcase)
      ) {
        best = s2;
        bestScore = sc2.score;
        bestHits = sc2.hits.slice();
      }
    }
    if (!best || bestScore <= 0) return null;
    return { seller: best, score: bestScore, hits: bestHits };
  }

  function formatHitTokens(hits) {
    if (!hits || !hits.length) return "";
    return hits.join("、");
  }

  function isPendingPoolOrder(o) {
    if (!o) return false;
    if (o.status !== STATUS.clarify) return false;
    var r = o.resident || "";
    return !r || r === "待匹配";
  }

  function getPendingPoolOrders() {
    return getOrders().filter(isPendingPoolOrder);
  }

  function getFakeSellerIdentity() {
    var saved = readJson(FAKE_SELLER_KEY, null);
    if (saved && saved.label) return saved;
    var regs = getRegs();
    if (regs.length) {
      var r = regs[0];
      return {
        id: r.id || "reg",
        name: r.name || "本机登记",
        label: (r.id ? r.id + " · " : "") + (r.name || "本机登记"),
        fromReg: true,
      };
    }
    return {
      id: "local-seller",
      name: "本机卖方",
      label: "本机卖方 · 试做",
      fromReg: false,
    };
  }

  function setFakeSellerIdentity(ident) {
    writeJson(FAKE_SELLER_KEY, ident);
  }

  function claimPendingOrder(orderId) {
    var role = getRole();
    if (role !== "seller") {
      alert("请切换到卖方身份后再认领试做。");
      return false;
    }
    var list = getOrders();
    var order = null;
    for (var i = 0; i < list.length; i++) {
      if (list[i].id === orderId) {
        order = list[i];
        break;
      }
    }
    if (!order || !isPendingPoolOrder(order)) {
      alert("该单不在待匹配池，或已被认领。");
      return false;
    }
    var ident = getFakeSellerIdentity();
    order.resident = ident.label;
    order.claimedBy = ident.label;
    order.claimedAt = Date.now();
    order.matchExplain = "认领试做 · " + ident.label;
    order.matchHits = order.matchHits || [];
    if (!order.clarifyQuestions || !order.clarifyQuestions.length) {
      order.clarifyQuestions = questionsForOrder(order);
    }
    order.clarifyLocked = false;
    order.clarifyRound = order.clarifyRound || 0;
    order.updatedAt = Date.now();
    writeJson(ORDERS_KEY, list);
    return true;
  }

  function kindLabel(kind) {
    if (kind === "channel") return "私有通道";
    if (kind === "data") return "专有数据";
    return "工作流 / 流水线";
  }


  function getTourSteps() {
    return [
      {
        id: 1,
        title: tt("tour.step1.title"),
        hint: tt("tour.step1.hint"),
        href: "post.html",
        page: "post",
      },
      {
        id: 2,
        title: tt("tour.step2.title"),
        hint: tt("tour.step2.hint"),
        href: "orders.html",
        page: "orders",
      },
      {
        id: 3,
        title: tt("tour.step3.title"),
        hint: tt("tour.step3.hint"),
        href: "orders.html",
        page: "orders",
      },
      {
        id: 4,
        title: tt("tour.step4.title"),
        hint: tt("tour.step4.hint"),
        href: "orders.html",
        page: "orders",
      },
      {
        id: 5,
        title: tt("tour.step5.title"),
        hint: tt("tour.step5.hint"),
        href: "orders.html",
        page: "orders",
      },
    ];
  }
  var TOUR_STEPS = getTourSteps();

  function escapeHtml(s) {
    return String(s)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function readJson(key, fallback) {
    try {
      var raw = localStorage.getItem(key);
      if (!raw) return fallback;
      var parsed = JSON.parse(raw);
      return parsed == null ? fallback : parsed;
    } catch (err) {
      return fallback;
    }
  }

  function writeJson(key, value) {
    try {
      localStorage.setItem(key, JSON.stringify(value));
      return true;
    } catch (err) {
      return false;
    }
  }

  function uid(prefix) {
    return (
      (prefix || "id") +
      "-" +
      Date.now().toString(36) +
      "-" +
      Math.random().toString(36).slice(2, 7)
    );
  }

  function formatTime(ts) {
    try {
      var d = new Date(ts);
      var y = d.getFullYear();
      var m = String(d.getMonth() + 1).padStart(2, "0");
      var day = String(d.getDate()).padStart(2, "0");
      var h = String(d.getHours()).padStart(2, "0");
      var min = String(d.getMinutes()).padStart(2, "0");
      return y + "-" + m + "-" + day + " " + h + ":" + min;
    } catch (err) {
      return "";
    }
  }

  function statusClass(status) {
    if (status === STATUS.done) return "status-done";
    if (status === STATUS.accept) return "status-accept";
    if (status === STATUS.making) return "status-making";
    if (status === STATUS.returned) return "status-returned";
    return "status-clarify";
  }

  function pageDepth() {
    var path = (location.pathname || "").replace(/\\/g, "/");
    if (path.indexOf("/showcase/") >= 0 || path.indexOf("/docs/") >= 0) return "..";
    return ".";
  }

  function hrefFor(file) {
    var base = pageDepth();
    return base === "." ? file : base + "/" + file;
  }

  /* —— Role / identity —— */
  function getRole() {
    var r = localStorage.getItem(ROLE_KEY);
    return r === "seller" ? "seller" : "buyer";
  }

  function setRole(role) {
    localStorage.setItem(ROLE_KEY, role === "seller" ? "seller" : "buyer");
    renderIdentityBar();
    renderHonestyStrip();
    renderTourBanner();
    renderOrdersList();
    renderPendingPool();
    renderPointsPanel();
    updatePostGate();
  }

  function roleLabel(role) {
    return role === "seller"
      ? tt("identity.seller_full")
      : tt("identity.buyer_full");
  }

  function renderIdentityBar() {
    var host = document.getElementById("identity-bar");
    if (!host) {
      var headerInner = document.querySelector(".site-header .inner");
      if (!headerInner) return;
      host = document.createElement("div");
      host.id = "identity-bar";
      host.className = "identity-bar";
      headerInner.appendChild(host);
    }
    var role = getRole();
    host.innerHTML =
      '<span class="identity-label">' +
      escapeHtml(tt("identity.label")) +
      "</span>" +
      '<div class="identity-toggle" role="group" aria-label="' +
      escapeHtml(tt("identity.toggle_aria")) +
      '">' +
      '<button type="button" class="id-btn' +
      (role === "buyer" ? " is-active" : "") +
      '" data-set-role="buyer">' +
      escapeHtml(tt("identity.buyer")) +
      "</button>" +
      '<button type="button" class="id-btn' +
      (role === "seller" ? " is-active" : "") +
      '" data-set-role="seller">' +
      escapeHtml(tt("identity.seller")) +
      "</button>" +
      "</div>" +
      '<span class="identity-hint">' +
      escapeHtml(roleLabel(role)) +
      "</span>";
  }

  function wireIdentityBar() {
    document.addEventListener("click", function (e) {
      var btn = e.target.closest("[data-set-role]");
      if (!btn) return;
      setRole(btn.getAttribute("data-set-role"));
    });
  }

  /* —— Site-wide honesty strip —— */
  function renderHonestyStrip() {
    var existing = document.getElementById("honesty-strip");
    var bar = existing;
    if (!bar) {
      bar = document.createElement("div");
      bar.id = "honesty-strip";
      bar.className = "honesty-strip";
      bar.setAttribute("role", "status");
      var header = document.querySelector(".site-header");
      if (header && header.nextSibling) {
        header.parentNode.insertBefore(bar, header.nextSibling);
      } else if (header) {
        header.parentNode.appendChild(bar);
      } else {
        document.body.insertBefore(bar, document.body.firstChild);
      }
    }
    var blockers = hrefFor("docs/BLOCKERS.md");
    bar.innerHTML =
      '<div class="honesty-inner">' +
      "<span>" + escapeHtml(tt("honesty.strip")) + "</span>" +
      '<a class="honesty-link" href="' +
      blockers +
      '">' +
      escapeHtml(tt("honesty.blockers")) +
      "</a>" +
      "</div>";
  }

  /* —— Tour —— */
  function getTour() {
    var t = readJson(TOUR_KEY, null);
    if (!t || typeof t !== "object") return { active: false, step: 1 };
    return {
      active: !!t.active,
      step: Math.max(1, Math.min(5, Number(t.step) || 1)),
      done: !!t.done,
    };
  }

  function saveTour(t) {
    writeJson(TOUR_KEY, t);
  }

  function startTour() {
    saveTour({ active: true, step: 1, done: false, startedAt: Date.now() });
    setRole("buyer");
    renderTourBanner();
    window.location.href = hrefFor("post.html");
  }

  function advanceTour(toStep) {
    var t = getTour();
    if (!t.active) return;
    if (toStep > t.step) {
      t.step = toStep;
      if (toStep > 5) {
        t.active = false;
        t.done = true;
        t.step = 5;
      }
      saveTour(t);
      renderTourBanner();
    }
  }

  function completeTour() {
    saveTour({ active: false, step: 5, done: true, finishedAt: Date.now() });
    renderTourBanner();
  }

  function dismissTour() {
    saveTour({ active: false, step: getTour().step, done: false });
    renderTourBanner();
  }

  function detectTourAdvanceFromOrders() {
    /* Tour advances only on explicit actions (post / clarify / deliver / accept). */
  }

  function renderTourBanner() {
    var existing = document.getElementById("tour-banner");
    var t = getTour();
    if (!t.active) {
      if (existing) existing.remove();
      var doneNote = document.getElementById("tour-done-note");
      if (t.done && !doneNote) {
        /* keep quiet after done; homepage CTA resets */
      }
      return;
    }
    var step = TOUR_STEPS[t.step - 1];
    var next = TOUR_STEPS[t.step] || null;
    var bar = existing;
    if (!bar) {
      bar = document.createElement("div");
      bar.id = "tour-banner";
      bar.className = "tour-banner";
      var header = document.querySelector(".site-header");
      if (header && header.nextSibling) {
        header.parentNode.insertBefore(bar, header.nextSibling);
      } else if (header) {
        header.parentNode.appendChild(bar);
      } else {
        document.body.insertBefore(bar, document.body.firstChild);
      }
    }
    var role = getRole();
    var roleTip =
      t.step === 1
        ? tt("tour.keep_buyer")
        : t.step === 2 || t.step === 4
          ? tt("tour.need_seller")
          : t.step === 3
            ? tt("tour.need_either")
            : tt("tour.need_buyer");
    bar.innerHTML =
      '<div class="tour-inner">' +
      '<div class="tour-progress">' +
      TOUR_STEPS.map(function (s) {
        var cls =
          s.id < t.step ? "is-done" : s.id === t.step ? "is-active" : "";
        return (
          '<span class="tour-dot ' +
          cls +
          '" title="' +
          escapeHtml(s.title) +
          '">' +
          s.id +
          "</span>"
        );
      }).join("") +
      "</div>" +
      '<div class="tour-copy">' +
      "<strong>" +
      escapeHtml(
        tt("tour.banner", { n: String(t.step) + "/5", title: step.title })
      ) +
      "</strong>" +
      "<p>" +
      escapeHtml(step.hint) +
      " " +
      escapeHtml(roleTip) +
      (next
        ? " " + escapeHtml(tt("tour.next", { title: next.title }))
        : " " + escapeHtml(tt("tour.can_end"))) +
      "</p>" +
      '<p class="tour-rules">' +
      escapeHtml(tt("demo.rules_short")) +
      "</p>" +
      "</div>" +
      '<div class="tour-actions">' +
      '<a class="btn btn-primary btn-sm" href="' +
      hrefFor(step.href) +
      '">' +
      escapeHtml(tt("tour.go")) +
      "</a>" +
      '<button type="button" class="btn btn-ghost btn-sm" id="tour-dismiss">' + escapeHtml(tt("tour.dismiss")) + '</button>' +
      "</div></div>";
    var dismiss = document.getElementById("tour-dismiss");
    if (dismiss) {
      dismiss.onclick = function () {
        dismissTour();
      };
    }
  }

  function wireTourStart() {
    var btn = document.getElementById("start-tour");
    if (btn) {
      btn.addEventListener("click", function (e) {
        e.preventDefault();
        startTour();
      });
    }
  }

  /* —— Points —— */
  function getAccount() {
    var acc = readJson(ACCOUNT_KEY, null);
    if (acc && typeof acc.balance === "number" && typeof acc.frozen === "number") {
      return acc;
    }
    return seedAccount();
  }

  function saveAccount(acc) {
    writeJson(ACCOUNT_KEY, {
      balance: Math.max(0, Math.round(acc.balance)),
      frozen: Math.max(0, Math.round(acc.frozen)),
    });
  }

  function getSellerEarned() {
    var n = Number(localStorage.getItem(SELLER_EARN_KEY));
    return isNaN(n) ? 0 : Math.max(0, Math.round(n));
  }

  function addSellerEarned(n) {
    var cur = getSellerEarned();
    localStorage.setItem(SELLER_EARN_KEY, String(cur + Math.round(n)));
  }

  function getLedger() {
    var list = readJson(LEDGER_KEY, null);
    if (list && Array.isArray(list) && list.length) return list;
    return [];
  }

  function saveLedger(list) {
    writeJson(LEDGER_KEY, list);
  }

  function appendLedger(entry) {
    var list = getLedger();
    list.unshift(entry);
    if (list.length > 80) list = list.slice(0, 80);
    saveLedger(list);
    return entry;
  }

  function seedAccount() {
    var now = Date.now();
    var day = 86400000;
    var starting = 1000;
    var frozenSeed = 120 + 210 + 90;
    var released = 180;
    var balance = starting - frozenSeed - released;
    var ledger = [
      {
        id: "led-seed-04",
        ts: now - 2 * 3600000,
        type: "freeze",
        amount: -90,
        note: "意向记录 · Changelog 工程备注 → 用户短句",
        orderId: "ord-seed-04",
        role: "buyer",
      },
      {
        id: "led-seed-03",
        ts: now - 1 * day,
        type: "freeze",
        amount: -210,
        note: "意向记录 · SKU 三源别名合并主表",
        orderId: "ord-seed-03",
        role: "buyer",
      },
      {
        id: "led-seed-02",
        ts: now - 3 * day,
        type: "freeze",
        amount: -120,
        note: "意向记录 · 夜班 5xx 尖峰归因备忘",
        orderId: "ord-seed-02",
        role: "buyer",
      },
      {
        id: "led-seed-01b",
        ts: now - 10 * day,
        type: "release",
        amount: 180,
        note: "验收确认 · 三家供应商发票 CSV → 统一 schema（声誉计入 180 · 站外自结）",
        orderId: "ord-seed-01",
        role: "both",
      },
      {
        id: "led-seed-01a",
        ts: now - 12 * day,
        type: "freeze",
        amount: -180,
        note: "意向记录 · 三家供应商发票 CSV → 统一 schema",
        orderId: "ord-seed-01",
        role: "buyer",
      },
      {
        id: "led-seed-open",
        ts: now - 20 * day,
        type: "credit",
        amount: starting,
        note: "演示开户赠点（买方）",
        orderId: null,
        role: "buyer",
      },
    ];
    writeJson(ACCOUNT_KEY, { balance: balance, frozen: frozenSeed });
    writeJson(LEDGER_KEY, ledger);
    if (!localStorage.getItem(SELLER_EARN_KEY)) {
      localStorage.setItem(SELLER_EARN_KEY, "180");
    }
    return { balance: balance, frozen: frozenSeed };
  }

  function freezePoints(points, orderId, title) {
    var acc = getAccount();
    var n = Math.round(Number(points) || 0);
    if (n <= 0) return false;
    if (acc.balance < n) {
      alert("演示参考分不足，无法记入意向 " + n + " 点（当前 " + acc.balance + "）。点仅作声誉装饰，非法币。");
      return false;
    }
    acc.balance -= n;
    acc.frozen += n;
    saveAccount(acc);
    appendLedger({
      id: uid("led"),
      ts: Date.now(),
      type: "freeze",
      amount: -n,
      note: "意向记录 · " + (title || orderId || ""),
      orderId: orderId || null,
      role: "buyer",
    });
    return true;
  }

  function releaseToSeller(points, orderId, title) {
    var acc = getAccount();
    var n = Math.round(Number(points) || 0);
    if (n <= 0) return false;
    if (acc.frozen < n) n = acc.frozen;
    acc.frozen -= n;
    saveAccount(acc);
    addSellerEarned(n);
    appendLedger({
      id: uid("led"),
      ts: Date.now(),
      type: "release",
      amount: n,
      note:
        "验收确认 · " +
        (title || "") +
        "（卖方入账 " +
        n +
        " 点）",
      orderId: orderId || null,
      role: "both",
    });
    return true;
  }

  function refundToBuyer(points, orderId, title) {
    var acc = getAccount();
    var n = Math.round(Number(points) || 0);
    if (n <= 0) return false;
    if (acc.frozen < n) n = acc.frozen;
    acc.frozen -= n;
    acc.balance += n;
    saveAccount(acc);
    appendLedger({
      id: uid("led"),
      ts: Date.now(),
      type: "refund",
      amount: n,
      note: "申请退回 · " + (title || "") + "（解冻 " + n + " 点）",
      orderId: orderId || null,
      role: "buyer",
    });
    return true;
  }

  function renderPointsPanel() {
    var balEl = document.getElementById("pts-balance");
    var froEl = document.getElementById("pts-frozen");
    var earnEl = document.getElementById("pts-earned");
    var ledEl = document.getElementById("pts-ledger");
    var roleHint = document.getElementById("pts-role-hint");
    if (!balEl && !froEl && !ledEl && !earnEl) return;
    var role = getRole();
    var acc = getAccount();
    if (balEl) balEl.textContent = String(acc.balance) + " 点";
    if (froEl) froEl.textContent = String(acc.frozen) + " 点";
    if (earnEl) earnEl.textContent = String(getSellerEarned()) + " 点";
    if (roleHint) {
      roleHint.textContent =
        role === "seller"
          ? tt("points.role.seller")
          : tt("points.role.buyer");
    }
    var buyerBlock = document.getElementById("pts-buyer-stats");
    var sellerBlock = document.getElementById("pts-seller-stats");
    if (buyerBlock) buyerBlock.classList.toggle("hidden", role !== "buyer");
    if (sellerBlock) sellerBlock.classList.toggle("hidden", role !== "seller");
    if (!ledEl) return;
    var list = getLedger();
    var filtered = list.filter(function (e) {
      if (role === "seller") {
        return e.type === "release" || e.role === "seller" || e.role === "both";
      }
      return e.role !== "seller";
    });
    if (!filtered.length) {
      ledEl.innerHTML =
        '<p class="ledger-empty">' + escapeHtml(tt("points.ledger_empty")) + "</p>";
      return;
    }
    var html = "";
    var max = Math.min(filtered.length, 20);
    for (var i = 0; i < max; i++) {
      var e = filtered[i];
      var amtClass = "neutral";
      var amtText = "—";
      if (e.type === "freeze") {
        amtClass = "debit";
        amtText = String(e.amount) + " 点";
      } else if (e.type === "refund" || e.type === "credit") {
        amtClass = "credit";
        amtText = (e.amount > 0 ? "+" : "") + String(e.amount) + " 点";
      } else if (e.type === "release") {
        amtClass = role === "seller" ? "credit" : "neutral";
        amtText =
          role === "seller"
            ? "+" + String(e.amount || 0) + " 点"
            : tt("points.release_label", { n: String(e.amount || 0) });
      }
      html +=
        '<div class="ledger-row">' +
        "<div>" +
        escapeHtml(e.note || e.type) +
        "</div>" +
        '<div class="ledger-amt ' +
        amtClass +
        '">' +
        escapeHtml(amtText) +
        "</div>" +
        '<div class="ledger-meta">' +
        escapeHtml(formatTime(e.ts)) +
        (e.orderId ? " · " + escapeHtml(e.orderId) : "") +
        "</div>" +
        "</div>";
    }
    ledEl.innerHTML = html;
  }

  /* —— Orders —— */
  function seedOrdersIfEmpty() {
    var list = readJson(ORDERS_KEY, null);
    if (list && Array.isArray(list) && list.length) return list;
    var now = Date.now();
    var day = 86400000;
    var seeded = [
      {
        id: "ord-seed-01",
        title: "三家供应商发票 CSV → 统一 schema",
        skill: "发票字段映射流水线",
        brief: "租用墨线同义词表与映射脚本，处理本月三家供应商导出。",
        points: 180,
        accept: "12 条样例全部通过；未识别列写入 _unmapped",
        channel: "私有通道 zip + README",
        status: STATUS.done,
        resident: "R-07 · 墨线",
        escrow: "released",
        reworkCount: 0,
        settlementMethod: "wechat",
        settlementBuyerOk: true,
        settlementSellerOk: true,
        settlementAgreed: true,
        settlementAgreedAt: now - 11 * day,
        createdAt: now - 12 * day,
        updatedAt: now - 10 * day,
      },
      {
        id: "ord-seed-02",
        title: "夜班 5xx 尖峰归因备忘",
        skill: "Nginx / 访问日志归因清单",
        brief: "按夜值复盘清单跑脱敏 access log，给出时间窗与路径占比。",
        points: 120,
        accept: "时间窗与路径占比可复核",
        channel: "私有通道 Markdown",
        status: STATUS.accept,
        resident: "R-12 · 夜值",
        escrow: "frozen",
        reworkCount: 0,
        settlementMethod: "escrow",
        settlementBuyerOk: true,
        settlementSellerOk: true,
        settlementAgreed: true,
        settlementAgreedAt: now - 2 * day,
        escrow_tx_id: "esc_mock_seed02",
        escrow_status: "delivered",
        clarifyLocked: true,
        clarifyRound: 1,
        clarifyQuestions: [
          "日志：access log 时间窗与脱敏范围？",
          "输出：时间窗 + 路径占比备忘，还是附 grep 脚本？",
          "验收：哪几条尖峰路径需要可复核？",
        ],
        buyerAnswers:
          "时间窗昨夜 00–06；脱敏已完成。要 Markdown 备忘 + 附 grep。尖峰 /api/v2/orders 与 /static/assets 需可复核。",
        resultPackage: {
          summary:
            "按夜值复盘清单完成脱敏 access log 归因；锁定两处尖峰路径并给出时间窗占比。",
          artifacts:
            "night-5xx-memo.md；grep-hotpaths.sh；samples/peak-snippet.log（演示文件名）",
          acceptCheck:
            "时间窗 00–06 可复核；/api/v2/orders 与 /static/assets 占比表已附；与验收条件对齐。",
          attachments: "night-5xx-memo.md, grep-hotpaths.sh",
          deliveredAt: now - 1 * day,
        },
        createdAt: now - 3 * day,
        updatedAt: now - 1 * day,
      },
      {
        id: "ord-seed-03",
        title: "SKU 三源别名合并主表",
        skill: "别名主表 / 冲突裁决规则",
        brief: "ERP + Shopify + 线下表合并；冲突按专有规则集裁决。",
        points: 210,
        accept: "抽查 20 行；未裁决项单独列出",
        channel: "私有通道 CSV 包",
        status: STATUS.making,
        resident: "R-07 · 墨线",
        escrow: "frozen",
        reworkCount: 0,
        settlementMethod: "",
        settlementBuyerOk: false,
        settlementSellerOk: false,
        settlementAgreed: false,
        clarifyLocked: true,
        clarifyRound: 1,
        clarifyQuestions: [
          "输入：原始文件格式与编码？（CSV / JSON / 其他）",
          "输出：统一 schema 的 JSON 行，还是附同义词表的脚本包？",
          "验收：用哪 1–2 条客观条件判定完成？",
        ],
        buyerAnswers:
          "三源均为 UTF-8 CSV。要主表 CSV + 冲突裁决规则说明。抽查 20 行；未裁决单独列出。",
        createdAt: now - 1 * day,
        updatedAt: now - 6 * 3600000,
      },
      {
        id: "ord-seed-04",
        title: "Changelog 工程备注 → 用户短句",
        skill: "Changelog 精简流水线",
        brief: "40 条工程备注压成 8 条中英对照，带字数与禁词规则。",
        points: 90,
        accept: "中文每条 ≤42 字；无营销套话",
        channel: "私有通道交付",
        status: STATUS.clarify,
        resident: "R-03 · 短句",
        escrow: "frozen",
        reworkCount: 0,
        clarifyLocked: false,
        clarifyRound: 0,
        clarifyQuestions: [
          "输入：工程备注条数与语言？（中 / 英 / 混）",
          "输出：中英对照短句，还是仅中文？",
          "验收：字数上限与禁词表是否沿用默认？",
        ],
        buyerAnswers: "",
        createdAt: now - 2 * 3600000,
        updatedAt: now - 2 * 3600000,
      },
    ];
    writeJson(ORDERS_KEY, seeded);
    getAccount();
    return seeded;
  }

  function getOrders() {
    return seedOrdersIfEmpty();
  }

  function saveOrder(order) {
    var list = getOrders();
    list.unshift(order);
    writeJson(ORDERS_KEY, list);
    return order;
  }

  function updateOrder(id, patch) {
    var list = getOrders();
    for (var i = 0; i < list.length; i++) {
      if (list[i].id === id) {
        for (var k in patch) {
          if (Object.prototype.hasOwnProperty.call(patch, k)) {
            list[i][k] = patch[k];
          }
        }
        list[i].updatedAt = Date.now();
        writeJson(ORDERS_KEY, list);
        return list[i];
      }
    }
    return null;
  }


  function findCatalogSellerByResident(resident) {
    var label = String(resident || "");
    if (!label || label === "待匹配") return null;
    for (var i = 0; i < SELLER_CATALOG.length; i++) {
      var s = SELLER_CATALOG[i];
      if (s.label === label || label.indexOf(s.name) >= 0 || label.indexOf(s.id) >= 0) {
        return s;
      }
    }
    var regs = getRegs();
    for (var j = 0; j < regs.length; j++) {
      var r = regs[j];
      var regLabel = (r.id ? r.id + " · " : "") + (r.name || "本机登记");
      if (regLabel === label || label.indexOf(r.name || "") >= 0) {
        return {
          questions: [
            "输入与格式边界是否清楚？",
            "交付物形态是否确认？",
            "验收标准是否可客观判定？",
          ],
        };
      }
    }
    return null;
  }

  function questionsForOrder(o) {
    if (o && o.clarifyQuestions && o.clarifyQuestions.length) {
      return o.clarifyQuestions.slice(0, 3);
    }
    var s = findCatalogSellerByResident(o && o.resident);
    if (s && s.questions && s.questions.length) {
      return s.questions.slice(0, 3);
    }
    return [
      "输入与格式边界是否清楚？",
      "交付物形态是否确认？",
      "验收标准是否可客观判定？",
    ];
  }

  function isClarifyLocked(o) {
    if (!o) return false;
    if (o.clarifyLocked) return true;
    if (o.status === STATUS.making || o.status === STATUS.accept || o.status === STATUS.done) {
      return true;
    }
    return false;
  }

  function renderClarifyBlock(o) {
    if (!o) return "";
    if (
      o.status !== STATUS.clarify &&
      o.status !== STATUS.making &&
      !(o.clarifyQuestions && o.clarifyQuestions.length)
    ) {
      return "";
    }
    if (o.status === STATUS.accept || o.status === STATUS.done || o.status === STATUS.returned) {
      /* result package owns the buyer view after deliver */
      if (o.resultPackage) return "";
    }
    var qs = questionsForOrder(o);
    var locked = isClarifyLocked(o);
    var role = getRole();
    var html = '<div class="clarify-block">';
    if (locked) {
      html +=
        '<p class="lock-banner">需求已锁定 · 卖方停答开放问题，制作中</p>';
      html +=
        '<p class="clarify-cap-note">澄清已用满一轮。开放问答关闭；买方不做开放闲聊追问。卖方私下制作，稍后提交结果摘要包。</p>';
    } else {
      html +=
        '<p class="clarify-cap-note">澄清上限：卖方「回应澄清」仅一轮，随后锁定进入制作。买方只答复下方问题清单——只答清单，不做开放闲聊。</p>';
    }
    html += '<p class="clarify-qs-label">卖方问题清单（最多 3 问）</p><ol class="clarify-qs">';
    for (var i = 0; i < qs.length; i++) {
      html += "<li>" + escapeHtml(qs[i]) + "</li>";
    }
    html += "</ol>";
    if (locked) {
      if (o.buyerAnswers) {
        html +=
          '<div class="clarify-answers-ro"><span class="who">买方答复</span><p>' +
          escapeHtml(o.buyerAnswers) +
          "</p></div>";
      }
    } else if (role === "buyer") {
      html +=
        '<label class="clarify-answer-label" for="buyer-answer-' +
        escapeHtml(o.id) +
        '">你的答复（一轮内写清即可）</label>';
      html +=
        '<textarea class="clarify-answer-input" id="buyer-answer-' +
        escapeHtml(o.id) +
        '" rows="3" maxlength="800" placeholder="针对上方问题作答。提交后仍须等卖方「回应澄清」锁定；锁定后不能再追问。">' +
        escapeHtml(o.buyerAnswers || "") +
        "</textarea>";
      html +=
        '<div class="btn-row" style="margin-top:0.55rem">' +
        '<button type="button" class="btn btn-ghost btn-sm" data-save-answers="' +
        escapeHtml(o.id) +
        '">保存答复</button>' +
        '<span class="action-hint">保存只记答复；卖方锁定后停答。</span>' +
        "</div>";
    } else if (role === "seller") {
      if (o.buyerAnswers) {
        html +=
          '<div class="clarify-answers-ro"><span class="who">买方已答复</span><p>' +
          escapeHtml(o.buyerAnswers) +
          "</p></div>";
      } else {
        html +=
          '<p class="action-hint" style="margin-top:0.45rem">买方尚未写入答复亦可锁定（演示）；点「回应澄清」即停答并进入制作。</p>';
      }
    }
    html += "</div>";
    return html;
  }

  function renderResultPackageBlock(o) {
    if (!o || !o.resultPackage) return "";
    var p = o.resultPackage;
    var html = '<div class="result-pack">';
    html += '<p class="result-pack-title">结果摘要包</p>';
    html +=
      '<p class="clarify-cap-note">待验收后买方只看成品包，不看澄清以外的过程闲聊。</p>';
    html +=
      '<dl class="result-pack-fields">' +
      "<dt>交付摘要</dt><dd>" +
      escapeHtml(p.summary || "—") +
      "</dd>" +
      "<dt>产物清单</dt><dd>" +
      escapeHtml(p.artifacts || "—") +
      "</dd>" +
      "<dt>验收对照</dt><dd>" +
      escapeHtml(p.acceptCheck || "—") +
      "</dd>";
    if (p.attachments) {
      html +=
        "<dt>附件名（演示）</dt><dd>" +
        escapeHtml(p.attachments) +
        "</dd>";
    }
    html += "</dl></div>";
    return html;
  }

  function renderDeliverForm(o) {
    if (!o || !o._uiDeliver) return "";
    var acceptHint = o.accept || "（单内验收标准）";
    var html = '<div class="deliver-form" data-deliver-form="' + escapeHtml(o.id) + '">';
    html += '<p class="result-pack-title">填写结果摘要包</p>';
    html +=
      '<p class="clarify-cap-note">「提交交付」= 交成品包，不是继续聊天。请填写结构化字段。</p>';
    html +=
      '<label for="dp-summary-' +
      escapeHtml(o.id) +
      '">交付摘要</label>' +
      '<textarea id="dp-summary-' +
      escapeHtml(o.id) +
      '" rows="2" maxlength="500" placeholder="本次产出了什么、边界内如何完成">' +
      escapeHtml((o.resultPackage && o.resultPackage.summary) || "") +
      "</textarea>";
    html +=
      '<label for="dp-artifacts-' +
      escapeHtml(o.id) +
      '">产物清单</label>' +
      '<textarea id="dp-artifacts-' +
      escapeHtml(o.id) +
      '" rows="2" maxlength="400" placeholder="文件 / 脚本 / 表名等（演示可用本地文件名）">' +
      escapeHtml((o.resultPackage && o.resultPackage.artifacts) || "") +
      "</textarea>";
    html +=
      '<label for="dp-accept-' +
      escapeHtml(o.id) +
      '">验收对照</label>' +
      '<textarea id="dp-accept-' +
      escapeHtml(o.id) +
      '" rows="2" maxlength="400" placeholder="对照：「' +
      escapeHtml(acceptHint).replace(/"/g, "&quot;") +
      '」">' +
      escapeHtml((o.resultPackage && o.resultPackage.acceptCheck) || "") +
      "</textarea>";
    html +=
      '<label for="dp-files-' +
      escapeHtml(o.id) +
      '">附件名（可选 · 演示）</label>' +
      '<input type="text" id="dp-files-' +
      escapeHtml(o.id) +
      '" maxlength="200" placeholder="例如：result.zip, README.md" value="' +
      escapeHtml((o.resultPackage && o.resultPackage.attachments) || "") +
      '">';
    html +=
      '<div class="btn-row" style="margin-top:0.65rem">' +
      '<button type="button" class="btn btn-primary" data-order-action="deliver_submit" data-order-id="' +
      escapeHtml(o.id) +
      '">确认提交结果包</button>' +
      '<button type="button" class="btn btn-ghost" data-order-action="deliver_cancel" data-order-id="' +
      escapeHtml(o.id) +
      '">取消</button>' +
      "</div></div>";
    return html;
  }


  var SETTLE_METHODS = ["escrow", "wechat", "alipay", "other", "intl_tbd"];

  function settleMethodLabel(code) {
    if (code === "escrow") return tt("settle.method.escrow");
    if (code === "wechat") return tt("settle.method.wechat");
    if (code === "alipay") return tt("settle.method.alipay");
    if (code === "other") return tt("settle.method.other");
    if (code === "intl_tbd") return tt("settle.method.intl");
    return "—";
  }

  function normalizeSettlement(o) {
    if (!o) return o;
    if (!o.settlementMethod) o.settlementMethod = "";
    if (typeof o.settlementBuyerOk !== "boolean") o.settlementBuyerOk = false;
    if (typeof o.settlementSellerOk !== "boolean") o.settlementSellerOk = false;
    if (typeof o.settlementAgreed !== "boolean") o.settlementAgreed = false;
    if (!o.escrow_tx_id) o.escrow_tx_id = o.escrowTxId || "";
    if (!o.escrow_status) o.escrow_status = o.escrowStatus || "";
    return o;
  }

  function escrowStatusRank(st) {
    var order = { draft: 1, funded: 2, delivered: 3, accepted: 4, cancelled: 0 };
    return order[st] || 0;
  }

  function createMockEscrow(order) {
    normalizeSettlement(order);
    order.settlementMethod = "escrow";
    order.escrow_tx_id = "esc_mock_" + String(order.id || "x").replace(/[^a-zA-Z0-9]/g, "") + "_" + Date.now().toString(36);
    order.escrow_status = "draft";
    order.settlementBuyerOk = true;
    order.settlementSellerOk = true;
    order.settlementAgreed = true;
    order.settlementAgreedAt = Date.now();
    if (order.status === STATUS.clarify) order.status = STATUS.making;
    order.updatedAt = Date.now();
    return order;
  }

  function canMarkSettlement(o) {
    normalizeSettlement(o);
    return (
      !!o.settlementMethod &&
      SETTLE_METHODS.indexOf(o.settlementMethod) >= 0 &&
      o.settlementBuyerOk &&
      o.settlementSellerOk
    );
  }

  function renderSettlementBlock(o) {
    if (!o) return "";
    normalizeSettlement(o);
    /* Show once clarify is locked / making / accept / done; hide on pure clarify unlock */
    var show =
      o.settlementAgreed ||
      o.status === STATUS.making ||
      o.status === STATUS.accept ||
      o.status === STATUS.done ||
      (o.status === STATUS.clarify && o.clarifyLocked);
    if (!show) return "";
    var role = getRole();
    var html = '<div class="settle-block" data-settle-order="' + escapeHtml(o.id) + '">';
    html +=
      '<p class="settle-title">' + escapeHtml(tt("settle.title")) + "</p>";
    html +=
      '<p class="settle-disclaimer">' +
      escapeHtml(tt("settle.disclaimer")) +
      "</p>";
    html +=
      '<p class="settle-sell">' + escapeHtml(tt("settle.sell")) + "</p>";
    if (o.settlementAgreed) {
      html +=
        '<p class="settle-marked"><strong>' +
        escapeHtml(tt("settle.marked")) +
        "</strong> · " +
        escapeHtml(
          tt("settle.done_meta", { method: settleMethodLabel(o.settlementMethod) })
        ) +
        "</p>";
      html += "</div>";
      html += renderEscrowPanel(o);
      return html;
    }
    html +=
      '<label class="settle-method-label" for="settle-method-' +
      escapeHtml(o.id) +
      '">' +
      escapeHtml(tt("settle.method")) +
      "</label>";
    html +=
      '<select class="settle-method" id="settle-method-' +
      escapeHtml(o.id) +
      '" data-settle-method="' +
      escapeHtml(o.id) +
      '">' +
      '<option value="">' +
      escapeHtml(tt("settle.method.placeholder")) +
      "</option>";
    var opts = [
      ["escrow", "settle.method.escrow"],
      ["wechat", "settle.method.wechat"],
      ["alipay", "settle.method.alipay"],
      ["other", "settle.method.other"],
      ["intl_tbd", "settle.method.intl"],
    ];
    for (var i = 0; i < opts.length; i++) {
      html +=
        '<option value="' +
        opts[i][0] +
        '"' +
        (o.settlementMethod === opts[i][0] ? " selected" : "") +
        ">" +
        escapeHtml(tt(opts[i][1])) +
        "</option>";
    }
    html += "</select>";
    html +=
      '<label class="settle-check"><input type="checkbox" data-settle-buyer="' +
      escapeHtml(o.id) +
      '"' +
      (o.settlementBuyerOk ? " checked" : "") +
      (role !== "buyer" ? " disabled" : "") +
      "> " +
      escapeHtml(tt("settle.buyer_ok")) +
      "</label>";
    html +=
      '<label class="settle-check"><input type="checkbox" data-settle-seller="' +
      escapeHtml(o.id) +
      '"' +
      (o.settlementSellerOk ? " checked" : "") +
      (role !== "seller" ? " disabled" : "") +
      "> " +
      escapeHtml(tt("settle.seller_ok")) +
      "</label>";
    html +=
      '<p class="settle-sell" style="margin-top:0.45rem">' +
      escapeHtml(tt("settle.escrow.hint")) +
      "</p>";
    html +=
      '<div class="btn-row" style="margin-top:0.45rem">' +
      '<button type="button" class="btn btn-primary btn-sm" data-escrow-create="' +
      escapeHtml(o.id) +
      '">' +
      escapeHtml(tt("settle.escrow.cta")) +
      "</button>" +
      '<span class="action-hint">' +
      escapeHtml(tt("settle.escrow.demo")) +
      "</span></div>";
    var can = canMarkSettlement(o);
    html +=
      '<div class="btn-row" style="margin-top:0.55rem">' +
      '<button type="button" class="btn btn-ghost btn-sm" data-settle-mark="' +
      escapeHtml(o.id) +
      '"' +
      (can ? "" : " disabled") +
      ">" +
      escapeHtml(tt("settle.mark")) +
      "</button>" +
      '<span class="action-hint">' +
      escapeHtml(role === "buyer" ? tt("settle.hint_buyer") : tt("settle.hint_seller")) +
      "</span></div>";
    html += "</div>";
    return html;
  }

  function renderEscrowPanel(o) {
    normalizeSettlement(o);
    if (!o.settlementAgreed || o.settlementMethod !== "escrow") return "";
    var html = '<div class="escrow-panel" data-escrow-panel="' + escapeHtml(o.id) + '">';
    html +=
      '<p class="settle-title">' + escapeHtml(tt("settle.method.escrow")) + "</p>";
    html +=
      '<p class="settle-disclaimer">' + escapeHtml(tt("settle.escrow.steps")) + "</p>";
    if (!o.escrow_tx_id) {
      html +=
        '<div class="btn-row" style="margin-top:0.45rem">' +
        '<button type="button" class="btn btn-primary btn-sm" data-escrow-create="' +
        escapeHtml(o.id) +
        '">' +
        escapeHtml(tt("settle.escrow.demo")) +
        "</button></div>";
      html += "</div>";
      return html;
    }
    html +=
      '<p><strong>' +
      escapeHtml(tt("settle.escrow.id")) +
      ":</strong> <code>" +
      escapeHtml(o.escrow_tx_id) +
      "</code></p>";
    html +=
      '<p><strong>' +
      escapeHtml(tt("settle.escrow.status")) +
      ':</strong> <span class="tag accent">' +
      escapeHtml(o.escrow_status || "draft") +
      "</span></p>";
    var nextMap = {
      draft: "funded",
      funded: "delivered",
      delivered: "accepted",
    };
    var nxt = nextMap[o.escrow_status];
    if (nxt) {
      html +=
        '<div class="btn-row" style="margin-top:0.45rem">' +
        '<button type="button" class="btn btn-ghost btn-sm" data-escrow-advance="' +
        escapeHtml(o.id) +
        '" data-escrow-next="' +
        nxt +
        '">' +
        escapeHtml(tt("settle.escrow.advance")) +
        " → " +
        nxt +
        "</button>" +
        '<a class="btn btn-ghost btn-sm" href="' +
        hrefFor("docs/escrow.html") +
        '">' +
        escapeHtml(tt("nav.escrow")) +
        "</a></div>";
    } else {
      html +=
        '<div class="btn-row" style="margin-top:0.45rem"><a class="btn btn-ghost btn-sm" href="' +
        hrefFor("docs/escrow.html") +
        '">' +
        escapeHtml(tt("nav.escrow")) +
        "</a></div>";
    }
    html += "</div>";
    return html;
  }

  function actionsForStatus(status, role, order) {
    var acts = [];
    if (status === STATUS.clarify && role === "seller") {
      acts.push({ action: "clarify", label: tt("act.clarify"), cls: "btn-primary" });
    }
    if (status === STATUS.making && role === "seller") {
      normalizeSettlement(order);
      if (order && order.settlementAgreed) {
        acts.push({ action: "deliver", label: tt("act.deliver"), cls: "btn-primary" });
      }
    }
    if (status === STATUS.accept && role === "buyer") {
      acts.push({ action: "approve", label: tt("act.approve"), cls: "btn-primary" });
      var reworks = order && order.reworkCount ? Number(order.reworkCount) : 0;
      if (reworks < 1) {
        acts.push({ action: "rework", label: tt("act.rework"), cls: "btn-ghost" });
      } else {
        acts.push({ action: "refund", label: tt("act.refund"), cls: "btn-danger" });
      }
    }
    if (
      (status === STATUS.making || status === STATUS.clarify) &&
      role === "buyer"
    ) {
      /* buyer can request return if locked > 7 days — demo: always offer soft note via overdue flag */
      var age = order && order.updatedAt ? Date.now() - order.updatedAt : 0;
      var seven = 7 * 86400000;
      if (age >= seven || (order && order.demoOverdue)) {
        acts.push({
          action: "refund_late",
          label: tt("act.refund_late"),
          cls: "btn-danger",
        });
      }
    }
    return acts;
  }

  function transitionOrder(id, action) {
    var list = getOrders();
    var order = null;
    for (var i = 0; i < list.length; i++) {
      if (list[i].id === id) {
        order = list[i];
        break;
      }
    }
    if (!order) return false;
    var role = getRole();

    if (action === "clarify" && order.status === STATUS.clarify) {
      if (role !== "seller") {
        alert("请切换到卖方身份后再回应澄清。");
        return false;
      }
      if (order.escrow !== "frozen" && order.escrow !== "released") {
        if (!freezePoints(order.points, order.id, order.title)) return false;
        order.escrow = "frozen";
      }
      if (!order.resident || order.resident === "待匹配") {
        alert("该单仍在待匹配池。请先在「待匹配」列表点「认领试做」，再回应澄清。");
        return false;
      }
      if (order.clarifyLocked || (order.clarifyRound && order.clarifyRound >= 1)) {
        alert("澄清已锁定：本单只能回应一轮。需求已进制作，请提交结果摘要包。");
        return false;
      }
      order.clarifyQuestions = questionsForOrder(order);
      order.clarifyLocked = true;
      order.clarifyRound = 1;
      order.clarifyLockedAt = Date.now();
      order.status = STATUS.making;
      order._uiDeliver = false;
      order.updatedAt = Date.now();
      writeJson(ORDERS_KEY, list);
      apiNotify("clarify", order.id, {
        role: "seller",
        action: "lock",
        buyer_answers: order.buyerAnswers || "",
      });
      var t = getTour();
      if (t.active && t.step <= 2) advanceTour(3);
      return true;
    }

    if (action === "settle_mark") {
      normalizeSettlement(order);
      if (order.status !== STATUS.making && order.status !== STATUS.clarify) {
        return false;
      }
      if (!order.clarifyLocked && order.status === STATUS.clarify) {
        alert(tt("settle.gate_deliver"));
        return false;
      }
      if (!order.settlementMethod) {
        alert(tt("settle.need_method"));
        return false;
      }
      if (!order.settlementBuyerOk || !order.settlementSellerOk) {
        alert(tt("settle.need_both"));
        return false;
      }
      order.settlementAgreed = true;
      order.settlementAgreedAt = Date.now();
      if (order.status === STATUS.clarify) order.status = STATUS.making;
      order.updatedAt = Date.now();
      writeJson(ORDERS_KEY, list);
      var ts = getTour();
      if (ts.active && ts.step <= 3) advanceTour(4);
      return true;
    }

    if (action === "deliver" && order.status === STATUS.making) {
      if (role !== "seller") {
        alert("请切换到卖方身份后再提交交付。");
        return false;
      }
      normalizeSettlement(order);
      if (!order.settlementAgreed) {
        alert(tt("settle.gate_deliver"));
        return false;
      }
      if (order.settlementMethod === "escrow") {
        if (!order.escrow_tx_id || escrowStatusRank(order.escrow_status) < escrowStatusRank("funded")) {
          alert(tt("settle.escrow.need_funded"));
          return false;
        }
      }
      /* open structured result-package form instead of open chat */
      order._uiDeliver = true;
      order.updatedAt = Date.now();
      writeJson(ORDERS_KEY, list);
      return true;
    }

    if (action === "deliver_cancel" && order.status === STATUS.making) {
      order._uiDeliver = false;
      order.updatedAt = Date.now();
      writeJson(ORDERS_KEY, list);
      return true;
    }

    if (action === "deliver_submit" && order.status === STATUS.making) {
      if (role !== "seller") {
        alert("请切换到卖方身份后再提交交付。");
        return false;
      }
      normalizeSettlement(order);
      if (!order.settlementAgreed) {
        alert(tt("settle.gate_deliver"));
        return false;
      }
      if (order.settlementMethod === "escrow") {
        if (!order.escrow_tx_id || escrowStatusRank(order.escrow_status) < escrowStatusRank("funded")) {
          alert(tt("settle.escrow.need_funded"));
          return false;
        }
      }
      var pack = order._pendingPackage;
      if (!pack || !pack.summary || !pack.artifacts || !pack.acceptCheck) {
        alert("请填写结果摘要包：交付摘要、产物清单、验收对照（均为必填）。");
        return false;
      }
      order.resultPackage = {
        summary: pack.summary,
        artifacts: pack.artifacts,
        acceptCheck: pack.acceptCheck,
        attachments: pack.attachments || "",
        deliveredAt: Date.now(),
      };
      order._pendingPackage = null;
      order._uiDeliver = false;
      order.status = STATUS.accept;
      normalizeSettlement(order);
      if (order.settlementMethod === "escrow" && order.escrow_status === "funded") {
        order.escrow_status = "delivered";
      }
      order.updatedAt = Date.now();
      writeJson(ORDERS_KEY, list);
      apiNotify("deliver", order.id, { result_package: order.resultPackage });
      var t2 = getTour();
      if (t2.active && t2.step <= 4) advanceTour(5);
      return true;
    }

    if (action === "approve" && order.status === STATUS.accept) {
      if (role !== "buyer") {
        alert("请切换到买方身份后再验收。");
        return false;
      }
      normalizeSettlement(order);
      if (order.settlementMethod === "escrow") {
        if (escrowStatusRank(order.escrow_status) < escrowStatusRank("delivered")) {
          alert(tt("settle.escrow.need_delivered"));
          return false;
        }
        order.escrow_status = "accepted";
      }
      if (order.escrow === "frozen") {
        releaseToSeller(order.points, order.id, order.title);
        order.escrow = "released";
      }
      order.status = STATUS.done;
      order.updatedAt = Date.now();
      writeJson(ORDERS_KEY, list);
      apiNotify("accept", order.id, { confirm: true });
      var t3 = getTour();
      if (t3.active) completeTour();
      return true;
    }

    if (action === "rework" && order.status === STATUS.accept) {
      if (role !== "buyer") {
        alert("请切换到买方身份。");
        return false;
      }
      order.reworkCount = (order.reworkCount || 0) + 1;
      order.status = STATUS.making;
      order._uiDeliver = false;
      order.previousResultPackage = order.resultPackage || order.previousResultPackage || null;
      order.resultPackage = null;
      order.updatedAt = Date.now();
      writeJson(ORDERS_KEY, list);
      appendLedger({
        id: uid("led"),
        ts: Date.now(),
        type: "rework",
        amount: 0,
        note: "验收未通过 · 要求返工 · " + (order.title || ""),
        orderId: order.id,
        role: "both",
      });
      return true;
    }

    if (
      (action === "refund" || action === "refund_late") &&
      (order.status === STATUS.accept ||
        order.status === STATUS.making ||
        order.status === STATUS.clarify)
    ) {
      if (role !== "buyer") {
        alert("请切换到买方身份后再申请退回。");
        return false;
      }
      if (order.escrow === "frozen") {
        refundToBuyer(order.points, order.id, order.title);
        order.escrow = "refunded";
      }
      order.status = STATUS.returned;
      order.updatedAt = Date.now();
      writeJson(ORDERS_KEY, list);
      apiNotify("return", order.id, {
        reason: action === "refund_late" ? "锁定超 7 日未交付" : "二次失败 · 申请退回",
      });
      var t4 = getTour();
      if (t4.active) completeTour();
      return true;
    }

    return false;
  }

  function renderOrderActions(o) {
    var role = getRole();
    var acts = actionsForStatus(o.status, role, o);
    if (o._uiDeliver) {
      acts = acts.filter(function (a) {
        return a.action !== "deliver";
      });
    }
    var html = '<div class="order-actions">';
    if (!acts.length) {
      if (o.status === STATUS.clarify && role === "buyer") {
        html +=
          '<span class="action-hint">请答复上方问题清单并等待卖方「回应澄清」锁定。只答清单，不做开放闲聊。</span>';
      } else if (o.status === STATUS.making && role === "buyer") {
        normalizeSettlement(o);
        html +=
          '<span class="action-hint">' +
          escapeHtml(
            o.settlementAgreed
              ? "需求已锁定 · 站外结算已约定 · 制作中。"
              : tt("settle.hint_buyer")
          ) +
          "</span>";
      } else if (o.status === STATUS.making && role === "seller") {
        normalizeSettlement(o);
        if (!o.settlementAgreed) {
          html +=
            '<span class="action-hint">' +
            escapeHtml(tt("settle.gate_deliver")) +
            "</span>";
        }
      } else if (o.status === STATUS.accept && role === "seller") {
        html +=
          '<span class="action-hint">结果摘要包已交 · 待买方验收。请切换到买方。</span>';
      } else if (o.status === STATUS.done || o.status === STATUS.returned) {
        html +=
          '<span class="action-hint">终态，无更多操作。</span>';
      }
      html += "</div>";
      return html;
    }
    for (var i = 0; i < acts.length; i++) {
      var a = acts[i];
      html +=
        '<button type="button" class="btn ' +
        a.cls +
        '" data-order-action="' +
        a.action +
        '" data-order-id="' +
        escapeHtml(o.id) +
        '">' +
        escapeHtml(a.label) +
        "</button>";
    }
    html += "</div>";
    return html;
  }

  function renderOrdersList() {
    var root = document.getElementById("orders-list");
    if (!root) return;
    var list = getOrders();
    var roleEl = document.getElementById("orders-role-hint");
    if (roleEl) {
      roleEl.textContent = tt("orders.role_hint", {
        role: roleLabel(getRole()),
      });
    }
    if (!list.length) {
      root.innerHTML =
        '<p class="note">暂无订单。可先去 <a href="post.html">发布任务</a>。</p>';
      return;
    }
    var html = "";
    for (var i = 0; i < list.length; i++) {
      var o = list[i];
      html +=
        '<article class="card order-card" data-order-id="' +
        escapeHtml(o.id) +
        '">' +
        '<div class="meta">' +
        '<span class="status-pill ' +
        statusClass(o.status) +
        '">' +
        escapeHtml(o.status) +
        "</span>" +
        "<span>" +
        escapeHtml(o.resident || "待匹配") +
        "</span>" +
        "<span>" +
        escapeHtml(formatTime(o.createdAt)) +
        "</span>" +
        (o.reworkCount
          ? '<span class="tag">已返工 ' + o.reworkCount + " 次</span>"
          : "") +
        (isPendingPoolOrder(o)
          ? '<span class="tag warn-tag">待匹配池</span>'
          : "") +
        "</div>" +
        "<h3>" +
        escapeHtml(o.title) +
        "</h3>" +
        '<p class="excerpt">' +
        escapeHtml(o.brief || "") +
        "</p>" +
        (o.matchExplain
          ? '<p class="match-explain">' + escapeHtml(o.matchExplain) + "</p>"
          : "") +
        '<div class="card-foot">' +
        '<span class="points">' +
        escapeHtml(String(o.points)) +
        " 点</span>" +
        '<span class="tag">' +
        escapeHtml(o.skill || "") +
        "</span>" +
        "</div>" +
        renderClarifyBlock(o) +
        renderSettlementBlock(o) +
        renderResultPackageBlock(o) +
        renderDeliverForm(o) +
        renderOrderActions(o) +
        "</article>";
    }
    root.innerHTML = html;
    detectTourAdvanceFromOrders();
  }

  function renderPendingPool() {
    var root = document.getElementById("pending-pool");
    var buyerNote = document.getElementById("pending-pool-buyer-note");
    var role = getRole();
    var pool = getPendingPoolOrders();

    if (buyerNote) {
      if (role === "buyer" && pool.length) {
        buyerNote.classList.remove("hidden");
        buyerNote.textContent =
          "有 " +
          pool.length +
          " 单未匹配 · 已进入待匹配池（不展示卖方目录）。卖方身份可扫池认领试做。";
      } else if (role === "buyer") {
        buyerNote.classList.add("hidden");
        buyerNote.textContent = "";
      } else {
        buyerNote.classList.add("hidden");
      }
    }

    if (!root) return;
    var section = document.getElementById("pending-pool-section");
    if (role !== "seller") {
      root.innerHTML = "";
      if (section) section.classList.add("hidden");
      return;
    }
    if (section) section.classList.remove("hidden");
    if (!pool.length) {
      root.innerHTML =
        '<p class="note">待匹配池为空。未命中域词的新单会出现在这里。</p>';
      return;
    }
    var html = "";
    for (var i = 0; i < pool.length; i++) {
      var o = pool[i];
      html +=
        '<article class="card order-card pending-card" data-order-id="' +
        escapeHtml(o.id) +
        '">' +
        '<div class="meta">' +
        '<span class="status-pill status-clarify">待澄清</span>' +
        '<span class="tag warn-tag">待匹配</span>' +
        "<span>" +
        escapeHtml(formatTime(o.createdAt)) +
        "</span>" +
        "</div>" +
        "<h3>" +
        escapeHtml(o.title) +
        "</h3>" +
        '<p class="excerpt">' +
        escapeHtml(o.brief || "") +
        "</p>" +
        '<p class="match-explain">未匹配 · 进入待匹配池（不暴露卖方目录）</p>' +
        '<div class="card-foot">' +
        '<span class="points">' +
        escapeHtml(String(o.points)) +
        " 点</span>" +
        '<span class="tag">' +
        escapeHtml(o.skill || "") +
        "</span>" +
        "</div>" +
        '<div class="order-actions">' +
        '<button type="button" class="btn btn-primary" data-claim-order="' +
        escapeHtml(o.id) +
        '">认领试做</button>' +
        '<span class="action-hint">绑到本机假身份 / 登记居民，再回应澄清。</span>' +
        "</div>" +
        "</article>";
    }
    root.innerHTML = html;
  }

  function wireClaimActions() {
    document.addEventListener("click", function (e) {
      var btn = e.target.closest("[data-claim-order]");
      if (!btn) return;
      var id = btn.getAttribute("data-claim-order");
      if (!id) return;
      if (claimPendingOrder(id)) {
        renderOrdersList();
        renderPendingPool();
        renderTourBanner();
      }
    });
  }

  function wireOrderActions() {
    var root = document.getElementById("orders-list");
    if (!root || root._pjWired) return;
    root._pjWired = true;
    root.addEventListener("change", function (e) {
      var methodEl = e.target.closest("[data-settle-method]");
      if (methodEl) {
        var oid = methodEl.getAttribute("data-settle-method");
        var listM = getOrders();
        for (var mi = 0; mi < listM.length; mi++) {
          if (listM[mi].id === oid) {
            normalizeSettlement(listM[mi]);
            if (listM[mi].settlementAgreed) return;
            listM[mi].settlementMethod = methodEl.value || "";
            listM[mi].updatedAt = Date.now();
            writeJson(ORDERS_KEY, listM);
            break;
          }
        }
        renderOrdersList();
        return;
      }
      var buyerCb = e.target.closest("[data-settle-buyer]");
      if (buyerCb) {
        if (getRole() !== "buyer") return;
        var bid = buyerCb.getAttribute("data-settle-buyer");
        var listB = getOrders();
        for (var bi = 0; bi < listB.length; bi++) {
          if (listB[bi].id === bid) {
            normalizeSettlement(listB[bi]);
            if (listB[bi].settlementAgreed) return;
            listB[bi].settlementBuyerOk = !!buyerCb.checked;
            listB[bi].updatedAt = Date.now();
            writeJson(ORDERS_KEY, listB);
            break;
          }
        }
        renderOrdersList();
        return;
      }
      var sellerCb = e.target.closest("[data-settle-seller]");
      if (sellerCb) {
        if (getRole() !== "seller") return;
        var sid2 = sellerCb.getAttribute("data-settle-seller");
        var listS = getOrders();
        for (var si = 0; si < listS.length; si++) {
          if (listS[si].id === sid2) {
            normalizeSettlement(listS[si]);
            if (listS[si].settlementAgreed) return;
            listS[si].settlementSellerOk = !!sellerCb.checked;
            listS[si].updatedAt = Date.now();
            writeJson(ORDERS_KEY, listS);
            break;
          }
        }
        renderOrdersList();
        return;
      }
    });
    root.addEventListener("click", function (e) {

      var methodSel = e.target.closest("[data-settle-method]");
      if (methodSel) return; /* change handled separately */
      var escCreate = e.target.closest("[data-escrow-create]");
      if (escCreate) {
        var eid = escCreate.getAttribute("data-escrow-create");
        var listE = getOrders();
        for (var ei = 0; ei < listE.length; ei++) {
          if (listE[ei].id === eid) {
            createMockEscrow(listE[ei]);
            writeJson(ORDERS_KEY, listE);
            break;
          }
        }
        renderOrdersList();
        renderPendingPool();
        renderTourBanner();
        return;
      }
      var escAdv = e.target.closest("[data-escrow-advance]");
      if (escAdv) {
        var aid = escAdv.getAttribute("data-escrow-advance");
        var nxtSt = escAdv.getAttribute("data-escrow-next");
        var listA = getOrders();
        for (var ai = 0; ai < listA.length; ai++) {
          if (listA[ai].id === aid) {
            normalizeSettlement(listA[ai]);
            if (nxtSt) listA[ai].escrow_status = nxtSt;
            listA[ai].updatedAt = Date.now();
            writeJson(ORDERS_KEY, listA);
            break;
          }
        }
        renderOrdersList();
        renderPendingPool();
        return;
      }
      var markBtn = e.target.closest("[data-settle-mark]");
      if (markBtn) {
        var mid = markBtn.getAttribute("data-settle-mark");
        if (mid && transitionOrder(mid, "settle_mark")) {
          renderOrdersList();
          renderPendingPool();
          renderTourBanner();
        }
        return;
      }

      var saveBtn = e.target.closest("[data-save-answers]");
      if (saveBtn) {
        var sid = saveBtn.getAttribute("data-save-answers");
        var ta = document.getElementById("buyer-answer-" + sid);
        if (!sid || !ta) return;
        if (getRole() !== "buyer") {
          alert("请切换到买方身份后再保存答复。");
          return;
        }
        var list = getOrders();
        for (var i = 0; i < list.length; i++) {
          if (list[i].id === sid) {
            if (isClarifyLocked(list[i]) || list[i].status !== STATUS.clarify) {
              alert("需求已锁定，不能再改答复或开放追问。");
              return;
            }
            list[i].buyerAnswers = (ta.value || "").trim();
            list[i].clarifyQuestions = questionsForOrder(list[i]);
            list[i].updatedAt = Date.now();
            writeJson(ORDERS_KEY, list);
            break;
          }
        }
        renderOrdersList();
        renderPendingPool();
        return;
      }
      var btn = e.target.closest("[data-order-action]");
      if (!btn) return;
      var id = btn.getAttribute("data-order-id");
      var action = btn.getAttribute("data-order-action");
      if (!id || !action) return;
      if (action === "deliver_submit") {
        var summaryEl = document.getElementById("dp-summary-" + id);
        var artEl = document.getElementById("dp-artifacts-" + id);
        var accEl = document.getElementById("dp-accept-" + id);
        var fileEl = document.getElementById("dp-files-" + id);
        var list2 = getOrders();
        for (var j = 0; j < list2.length; j++) {
          if (list2[j].id === id) {
            list2[j]._pendingPackage = {
              summary: summaryEl ? (summaryEl.value || "").trim() : "",
              artifacts: artEl ? (artEl.value || "").trim() : "",
              acceptCheck: accEl ? (accEl.value || "").trim() : "",
              attachments: fileEl ? (fileEl.value || "").trim() : "",
            };
            writeJson(ORDERS_KEY, list2);
            break;
          }
        }
      }
      if (transitionOrder(id, action)) {
        renderOrdersList();
        renderPendingPool();
        renderPointsPanel();
        renderTourBanner();
      }
    });
  }

  /* —— Registrations —— */
  function getRegs() {
    var list = readJson(REGS_KEY, []);
    return Array.isArray(list) ? list : [];
  }

  function saveReg(reg) {
    var list = getRegs();
    list.unshift(reg);
    writeJson(REGS_KEY, list);
    return reg;
  }

  function renderSellerCatalog() {
    var root = document.getElementById("seller-catalog");
    if (!root) return;
    var html = "";
    for (var i = 0; i < SELLER_CATALOG.length; i++) {
      var s = SELLER_CATALOG[i];
      var tags = "";
      tags +=
        '<span class="tag accent">' +
        escapeHtml(kindLabel(s.kind).split(" ")[0]) +
        "</span>";
      for (var d = 0; d < s.domains.length; d++) {
        tags += '<span class="tag">' + escapeHtml(s.domains[d]) + "</span>";
      }
      html +=
        '<article class="resident">' +
        '<div class="id">' +
        escapeHtml(s.id) +
        "</div>" +
        "<h3>" +
        escapeHtml(s.name) +
        "</h3>" +
        '<p class="about">' +
        escapeHtml(s.about || "") +
        "</p>" +
        '<div class="skills">' +
        tags +
        "</div>" +
        "</article>";
    }
    root.innerHTML = html;
  }

  function wireTryMatch() {
    var form = document.getElementById("try-match-form");
    var out = document.getElementById("try-match-out");
    if (!form || !out) return;
    form.addEventListener("submit", function (e) {
      e.preventDefault();
      var skill = (document.getElementById("try-skill").value || "").trim();
      if (!skill) {
        out.textContent = "请输入能力域关键词。";
        out.classList.remove("hidden");
        return;
      }
      var m = matchSeller({ skill: skill, title: skill, brief: "" });
      if (!m) {
        out.innerHTML =
          "结果：<strong>未匹配 · 进入待匹配池</strong>（0 命中域词）。不展示卖方目录。";
      } else {
        out.innerHTML =
          "结果：会匹配到 <strong>" +
          escapeHtml(m.seller.label) +
          "</strong> · 命中域词：" +
          escapeHtml(formatHitTokens(m.hits)) +
          "（" +
          m.score +
          "）。";
      }
      out.classList.remove("hidden");
    });
  }

  function renderRegs() {
    var root = document.getElementById("regs-list");
    if (!root) return;
    var list = getRegs();
    if (!list.length) {
      root.innerHTML =
        '<p class="meta" style="padding:0.5rem 0">本机尚无登记。填上方表单即可声明可售工作流（仅存浏览器）。</p>';
      return;
    }
    var html = "";
    for (var i = 0; i < list.length; i++) {
      var r = list[i];
      var kindLabel =
        r.kind === "channel"
          ? "私有通道"
          : r.kind === "data"
            ? "专有数据"
            : "工作流 / 流水线";
      html +=
        '<article class="resident">' +
        '<div class="id">' +
        escapeHtml(r.id) +
        " · 本机登记</div>" +
        "<h3>" +
        escapeHtml(r.name || "未命名卖方") +
        "</h3>" +
        '<p class="about">' +
        escapeHtml(r.offer || "") +
        "</p>" +
        '<div class="skills">' +
        '<span class="tag accent">' +
        escapeHtml(kindLabel) +
        "</span>" +
        '<span class="tag">' +
        escapeHtml(r.domain || "") +
        "</span>" +
        "</div>" +
        '<p class="meta" style="margin-top:0.75rem">' +
        escapeHtml(formatTime(r.createdAt)) +
        "</p>" +
        "</article>";
    }
    root.innerHTML = html;
  }

  function wireRegForm() {
    var form = document.getElementById("reg-form");
    if (!form) return;
    form.addEventListener("submit", function (e) {
      e.preventDefault();
      var name = (document.getElementById("reg-name").value || "").trim();
      var domain = (document.getElementById("reg-domain").value || "").trim();
      var kind = (document.getElementById("reg-kind").value || "workflow").trim();
      var offer = (document.getElementById("reg-offer").value || "").trim();
      if (!name || !domain || !offer) {
        alert("请填写称呼、能力域与可售说明。");
        return;
      }
      saveReg({
        id: uid("reg"),
        name: name,
        domain: domain,
        kind: kind,
        offer: offer,
        createdAt: Date.now(),
      });
      form.reset();
      renderRegs();
      var note = document.getElementById("reg-ok");
      if (note) {
        note.textContent = "已写入本机 localStorage。下方列表已更新。";
        note.classList.remove("hidden");
      }
    });
  }

  /* —— Seller 预登记（意向，非真下单） —— */
  function getPreregs() {
    var list = readJson(PREREG_KEY, []);
    return Array.isArray(list) ? list : [];
  }

  function savePrereg(item) {
    var list = getPreregs();
    list.unshift(item);
    writeJson(PREREG_KEY, list);
    return item;
  }

  function renderPreregList() {
    var root = document.getElementById("prereg-list");
    if (!root) return;
    var list = getPreregs();
    if (!list.length) {
      root.innerHTML =
        '<p class="note">尚无预登记。上方表单写入本机后，会出现在此（标「预登记 · 非真下单」）。</p>';
      return;
    }
    var html = "";
    for (var i = 0; i < list.length; i++) {
      var p = list[i];
      html +=
        '<article class="card prereg-card" data-prereg-id="' +
        escapeHtml(p.id) +
        '">' +
        '<div class="meta">' +
        '<span class="tag accent">预登记 · 非真下单</span>' +
        '<span class="tag">' +
        escapeHtml(kindLabel(p.kind)) +
        "</span>" +
        "<span>" +
        escapeHtml(formatTime(p.createdAt)) +
        "</span>" +
        "</div>" +
        "<h3>" +
        escapeHtml(p.capability || "未命名能力") +
        "</h3>" +
        '<p class="excerpt">' +
        escapeHtml(p.boundary || "") +
        "</p>" +
        '<div class="card-foot">' +
        '<span class="tag">' +
        escapeHtml(p.delivery || "") +
        "</span>" +
        (p.pointsRange
          ? '<span class="points">' + escapeHtml(p.pointsRange) + "</span>"
          : "") +
        '<button type="button" class="btn btn-ghost btn-sm" data-copy-prereg="' +
        escapeHtml(p.id) +
        '">复制 JSON</button>' +
        "</div>" +
        "</article>";
    }
    root.innerHTML = html;
  }

  function wirePreregForm() {
    var form = document.getElementById("prereg-form");
    if (!form) return;
    form.addEventListener("submit", function (e) {
      e.preventDefault();
      var capability = (document.getElementById("prereg-capability").value || "").trim();
      var kind = (document.getElementById("prereg-kind").value || "workflow").trim();
      var boundary = (document.getElementById("prereg-boundary").value || "").trim();
      var accept = (document.getElementById("prereg-accept").value || "").trim();
      var delivery = (document.getElementById("prereg-delivery").value || "").trim();
      var turnaround = (document.getElementById("prereg-turnaround").value || "").trim();
      var contact = (document.getElementById("prereg-contact").value || "").trim();
      var pointsRange = (document.getElementById("prereg-points").value || "").trim();
      var sample = (document.getElementById("prereg-sample").value || "").trim();
      if (!capability || !boundary || !accept || !delivery || !turnaround) {
        alert("请至少填写：一句话能力、边界、验收、交付形态、周转。");
        return;
      }
      var acceptLines = accept
        .split(/\n+/)
        .map(function (l) { return l.trim(); })
        .filter(Boolean)
        .slice(0, 3);
      var item = {
        id: uid("pre"),
        capability: capability,
        kind: kind,
        boundary: boundary,
        accept: acceptLines,
        delivery: delivery,
        turnaround: turnaround,
        contact: contact,
        pointsRange: pointsRange,
        sample: sample,
        label: "预登记 · 非真下单",
        createdAt: Date.now(),
      };
      savePrereg(item);
      form.reset();
      renderPreregList();
      var note = document.getElementById("prereg-ok");
      if (note) {
        note.textContent = "已写入本机 localStorage（预登记 · 非真下单 · 免费撮合 · 站外自结）。";
        note.classList.remove("hidden");
      }
    });
    document.addEventListener("click", function (e) {
      var btn = e.target.closest("[data-copy-prereg]");
      if (!btn) return;
      var id = btn.getAttribute("data-copy-prereg");
      var list = getPreregs();
      var found = null;
      for (var i = 0; i < list.length; i++) {
        if (list[i].id === id) {
          found = list[i];
          break;
        }
      }
      if (!found) return;
      var text = JSON.stringify(found, null, 2);
      function ok() {
        btn.textContent = "已复制";
        setTimeout(function () {
          btn.textContent = "复制 JSON";
        }, 1500);
      }
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(text).then(ok).catch(function () {
          window.prompt("复制以下 JSON", text);
        });
      } else {
        window.prompt("复制以下 JSON", text);
      }
    });
  }

  function updatePostGate() {
    var form = document.getElementById("job-form");
    var gate = document.getElementById("post-role-gate");
    if (!form) return;
    var role = getRole();
    if (gate) {
      if (role === "seller") {
        gate.classList.remove("hidden");
        gate.innerHTML =
          '当前是<strong>卖方</strong>身份。发布任务需切换到<strong>买方（要租用的人）</strong>。' +
          ' <button type="button" class="btn btn-ghost btn-sm" data-set-role="buyer">切换为买方</button>';
      } else {
        gate.classList.add("hidden");
      }
    }
    var submit = form.querySelector('button[type="submit"]');
    if (submit) submit.disabled = role === "seller";
  }

  /* —— Mobile nav —— */
  var toggle = document.querySelector(".menu-toggle");
  var nav = document.querySelector(".nav");
  if (toggle && nav) {
    toggle.addEventListener("click", function () {
      var open = nav.classList.toggle("open");
      toggle.setAttribute("aria-expanded", open ? "true" : "false");
      toggle.textContent = open ? tt("nav.close") : tt("nav.menu");
    });
  }

  /* —— Boot —— */
  function refreshI18nDynamic() {
    TOUR_STEPS = getTourSteps();
    renderIdentityBar();
    renderHonestyStrip();
    renderTourBanner();
    renderOrdersList();
    renderPendingPool();
    renderPointsPanel();
    updatePostGate();
    var mt = document.querySelector(".menu-toggle");
    if (mt && !document.querySelector(".nav.open")) {
      mt.textContent = tt("nav.menu");
    }
  }

  function bootCore() {
  getAccount();
  renderIdentityBar();
  wireIdentityBar();
  renderHonestyStrip();
  renderTourBanner();
  wireTourStart();
  renderOrdersList();
  renderPendingPool();
  if (apiReady() && window.PrivyJobsAPI.listJobs) {
    window.PrivyJobsAPI.listJobs().then(function (res) {
      /* Remote list is advisory this slice; keep localStorage as UI source.
         Success proves the seam; null already toasted + fell back. */
      if (res && res.ok) {
        /* no-op merge: demo remains local-first until Worker ships */
      }
    });
  }
  wireOrderActions();
  wireClaimActions();
  renderRegs();
  renderSellerCatalog();
  loadSellerCatalog();
  wireTryMatch();
  wireRegForm();
  wirePreregForm();
  renderPreregList();
  renderPointsPanel();
  updatePostGate();
  } /* end bootCore */

  if (window.PJ_I18N && window.PJ_I18N.whenReady) {
    window.PJ_I18N.whenReady(bootCore);
  } else {
    bootCore();
  }
  document.addEventListener("pj-i18n-change", function () {
    refreshI18nDynamic();
  });

  /* —— Post-job flow —— */
  var form = document.getElementById("job-form");
  if (!form) return;

  var formPanel = document.getElementById("form-panel");
  var threadPanel = document.getElementById("thread-panel");
  var statusEl = document.getElementById("thread-status");
  var messagesEl = document.getElementById("thread-messages");
  var stepsEl = document.getElementById("post-steps");
  var newJobBtn = document.getElementById("new-job-btn");
  var currentOrderId = null;

  if (newJobBtn) {
    newJobBtn.addEventListener("click", function () {
      location.reload();
    });
  }

  function setPostStep(n) {
    if (!stepsEl) return;
    var items = stepsEl.querySelectorAll("li");
    for (var i = 0; i < items.length; i++) {
      var step = Number(items[i].getAttribute("data-step"));
      items[i].classList.remove("is-active", "is-done");
      if (step < n) items[i].classList.add("is-done");
      if (step === n) items[i].classList.add("is-active");
    }
  }

  form.addEventListener("submit", function (e) {
    e.preventDefault();
    if (getRole() !== "buyer") {
      alert("请先切换到买方（要租用的人）再发布任务。");
      setRole("buyer");
      return;
    }
    var title = (document.getElementById("job-title").value || "").trim();
    var skill = (document.getElementById("job-skill").value || "").trim();
    var brief = (document.getElementById("job-brief").value || "").trim();
    var points = (document.getElementById("job-points").value || "").trim();
    var accept = (document.getElementById("job-accept").value || "").trim();
    var channel = (
      document.getElementById("job-channel")
        ? document.getElementById("job-channel").value
        : ""
    ).trim();

    if (!title || !skill || !brief || !points) {
      alert("请填写标题、能力域、需求简述与出价。");
      return;
    }

    var pts = Number(points);
    if (!pts || pts <= 0) {
      alert("请填写有效的积分数。");
      return;
    }

    var now = Date.now();
    var orderId = uid("ord");
    if (!freezePoints(pts, orderId, title)) return;

    var order = {
      id: orderId,
      title: title,
      skill: skill,
      brief: brief,
      points: pts,
      accept: accept,
      channel: channel,
      status: STATUS.clarify,
      resident: "",
      escrow: "frozen",
      reworkCount: 0,
      settlementMethod: "",
      settlementBuyerOk: false,
      settlementSellerOk: false,
      settlementAgreed: false,
      escrow_tx_id: "",
      escrow_status: "",
      createdAt: now,
      updatedAt: now,
    };
    saveOrder(order);
    currentOrderId = order.id;
    apiNotify("create", order.id, {
      title: order.title,
      skill: order.skill,
      brief: order.brief,
      points: order.points,
      accept: order.accept,
      channel: order.channel,
    });
    try {
      localStorage.setItem(LAST_JOB_KEY, JSON.stringify(order));
    } catch (err) { /* ignore */ }

    formPanel.classList.add("hidden");
    threadPanel.classList.remove("hidden");
    setPostStep(2);
    statusEl.textContent = "正在按能力域匹配卖方…";
    statusEl.classList.remove("locked");
    messagesEl.innerHTML = "";

    advanceTour(2);

    var steps = buildClarification(order);
    playSteps(steps, 0);
  });

  function buildClarification(job) {
    var acceptLine = job.accept
      ? escapeHtml(job.accept)
      : "（买方未填，需在澄清中补齐）";
    var channelLine = job.channel
      ? escapeHtml(job.channel)
      : "私有通道交付（默认）";

    var matched = matchSeller(job);
    var steps = [
      {
        delay: 500,
        step: 2,
        html:
          '<div class="msg buyer"><div class="who">买方 · 你</div><p><strong>' +
          escapeHtml(job.title) +
          "</strong></p><p>" +
          escapeHtml(job.brief) +
          '</p><p class="meta" style="margin-top:0.5rem">能力域 · ' +
          escapeHtml(job.skill) +
          " · " +
          escapeHtml(String(job.points)) +
          " 点</p>" +
          '<p class="meta">验收 · ' +
          acceptLine +
          "</p>" +
          '<p class="meta">交付 · ' +
          channelLine +
          "</p></div>",
      },
    ];

    if (!matched) {
      steps.push({
        delay: 1100,
        step: 2,
        status: "未匹配 · 进入待匹配池",
        onShow: function () {
          updateOrder(currentOrderId, {
            resident: "待匹配",
            status: STATUS.clarify,
            matchHits: [],
            matchExplain: "未匹配 · 进入待匹配池",
          });
        },
        html:
          '<div class="msg system"><strong>未匹配 · 进入待匹配池</strong>。订单保持「待澄清」。买方侧只见这一条说明——<strong>不展示卖方目录</strong>。可细化能力域后重发，或等待卖方身份在待匹配池「认领试做」。意向已写入订单记录；可稍后关闭。报酬始终站外自结。</div>',
      });
      steps.push({
        delay: 1400,
        step: 3,
        status: "待匹配池 · 等待认领或细化",
        locked: false,
        html:
          '<div class="msg system">演示不会伪造卖方、也不会甩完整目录。域词 0 命中即入池；匹配为浏览器端 token 重叠（静态 demo）。</div>',
      });
      return steps;
    }

    var s = matched.seller;
    var qHtml = "";
    var qs = s.questions || [];
    for (var qi = 0; qi < qs.length && qi < 3; qi++) {
      qHtml += "<li>" + escapeHtml(qs[qi]) + "</li>";
    }

    var hitLine = formatHitTokens(matched.hits);
    var explain =
      "命中域词：" + (hitLine || "（计分域词）") + "（" + matched.score + "）";
    steps.push({
      delay: 1100,
      step: 2,
      status: "已匹配 · " + explain,
      onShow: function () {
        updateOrder(currentOrderId, {
          resident: s.label,
          status: STATUS.clarify,
          matchHits: matched.hits.slice(),
          matchExplain: explain,
          clarifyQuestions: (s.questions || []).slice(0, 3),
          clarifyLocked: false,
          clarifyRound: 0,
          buyerAnswers: "",
        });
      },
      html:
        '<div class="msg system">平台按声明技能匹配到卖方 <strong>' +
        escapeHtml(s.label) +
        "</strong>（" +
        escapeHtml(kindLabel(s.kind)) +
        "）。<br><strong>命中域词：</strong>" +
        escapeHtml(hitLine) +
        "（" +
        matched.score +
        "）。澄清仅订单双方可见，且<strong>限一轮</strong>——不做开放闲聊追问。订单记录已写入本机；平台不托管资金，结算站外自结。卖步骤/通道/切片，不是倒知识库。<br>演示下一步：到订单答复问题清单，再切<strong>卖方</strong>点「回应澄清」锁定。</div>",
    });
    steps.push({
      delay: 1600,
      step: 3,
      status: "澄清中 · 确认流水线边界（预览）",
      html:
        '<div class="msg agent"><div class="who">卖方 ' +
        escapeHtml(s.label) +
        "</div><p>收到。我会用本机已跑通的边界处理；开始前请确认：</p><ul style=\"margin:0.4rem 0 0 1.1rem;color:var(--ink-muted)\">" +
        qHtml +
        "</ul></div>",
    });
    steps.push({
      delay: 1400,
      step: 3,
      html:
        '<div class="msg buyer"><div class="who">买方 · 你</div><p>（预览答复）边界清楚；请按你的流水线执行，验收条件以单内为准。</p></div>',
    });
    steps.push({
      delay: 1100,
      step: 3,
      status: "澄清预览结束 · 请到订单页由卖方锁定",
      locked: false,
      html:
        '<div class="msg system">以上为澄清预览（买方答复区示意）。订单仍为「待澄清」。买方只答问题清单，<strong>只答清单</strong>。请切<strong>卖方</strong>在 <a href="orders.html">订单</a> 点「回应澄清」——一轮后锁定：「需求已锁定 · 卖方停答开放问题，制作中」。交付须交<strong>结果摘要包</strong>。<br>演示规则：锁定后 7 日未交付可退回；验收失败一次可要求返工，二次失败退回。</div>',
    });
    return steps;
  }

  function playSteps(steps, i) {
    if (i >= steps.length) {
      setTimeout(function () {
        window.location.href = "orders.html";
      }, 1800);
      return;
    }
    var step = steps[i];
    setTimeout(function () {
      if (step.step) setPostStep(step.step);
      if (step.html) {
        messagesEl.insertAdjacentHTML("beforeend", step.html);
        messagesEl.lastElementChild.scrollIntoView({
          behavior: "smooth",
          block: "nearest",
        });
      }
      if (step.status) {
        statusEl.textContent = step.status;
        if (step.locked) statusEl.classList.add("locked");
      }
      if (typeof step.onShow === "function") step.onShow();
      playSteps(steps, i + 1);
    }, step.delay);
  }

  try {
    var prev = localStorage.getItem(LAST_JOB_KEY);
    if (prev) {
      var hint = document.getElementById("restore-hint");
      if (hint) {
        var j = JSON.parse(prev);
        hint.innerHTML =
          "本机上次订单：「" +
          escapeHtml(j.title) +
          "」· 可在 <a href=\"orders.html\">订单</a> 查看";
        hint.classList.remove("hidden");
      }
    }
  } catch (err) { /* ignore */ }
})();
