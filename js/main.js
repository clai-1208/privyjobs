(function () {
  "use strict";

  var ORDERS_KEY = "privyjobs_orders";
  var REGS_KEY = "privyjobs_registrations";
  var LAST_JOB_KEY = "privyjobs_last_job";
  var ACCOUNT_KEY = "privyjobs_points_account";
  var LEDGER_KEY = "privyjobs_points_ledger";

  var STATUS = {
    clarify: "待澄清",
    making: "制作中",
    accept: "待验收",
    done: "已完成",
    returned: "已退回",
  };

  /* —— Shared helpers —— */
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

  /* —— Points account + ledger —— */
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
    /* Align with seed orders: done released; others still frozen */
    var now = Date.now();
    var day = 86400000;
    var starting = 1000;
    var frozenSeed = 120 + 210 + 90; /* accept + making + clarify */
    var released = 180; /* done seed */
    var balance = starting - frozenSeed - released;
    var ledger = [
      {
        id: "led-seed-04",
        ts: now - 2 * 3600000,
        type: "freeze",
        amount: -90,
        note: "下单冻结 · Changelog 工程备注 → 用户短句",
        orderId: "ord-seed-04",
      },
      {
        id: "led-seed-03",
        ts: now - 1 * day,
        type: "freeze",
        amount: -210,
        note: "下单冻结 · SKU 三源别名合并主表",
        orderId: "ord-seed-03",
      },
      {
        id: "led-seed-02",
        ts: now - 3 * day,
        type: "freeze",
        amount: -120,
        note: "下单冻结 · 夜班 5xx 尖峰归因备忘",
        orderId: "ord-seed-02",
      },
      {
        id: "led-seed-01b",
        ts: now - 10 * day,
        type: "release",
        amount: 0,
        note: "验收放款 · 三家供应商发票 CSV → 统一 schema（托管 180 点划入卖方）",
        orderId: "ord-seed-01",
      },
      {
        id: "led-seed-01a",
        ts: now - 12 * day,
        type: "freeze",
        amount: -180,
        note: "下单冻结 · 三家供应商发票 CSV → 统一 schema",
        orderId: "ord-seed-01",
      },
      {
        id: "led-seed-open",
        ts: now - 20 * day,
        type: "credit",
        amount: starting,
        note: "演示开户赠点",
        orderId: null,
      },
    ];
    writeJson(ACCOUNT_KEY, { balance: balance, frozen: frozenSeed });
    writeJson(LEDGER_KEY, ledger);
    return { balance: balance, frozen: frozenSeed };
  }

  function freezePoints(points, orderId, title) {
    var acc = getAccount();
    var n = Math.round(Number(points) || 0);
    if (n <= 0) return false;
    if (acc.balance < n) {
      alert("余额不足，无法冻结 " + n + " 点（当前余额 " + acc.balance + "）。");
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
      note: "下单冻结 · " + (title || orderId || ""),
      orderId: orderId || null,
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
    appendLedger({
      id: uid("led"),
      ts: Date.now(),
      type: "release",
      amount: 0,
      note:
        "验收放款 · " +
        (title || "") +
        "（托管 " +
        n +
        " 点划入卖方）",
      orderId: orderId || null,
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
    });
    return true;
  }

  function renderPointsPanel() {
    var balEl = document.getElementById("pts-balance");
    var froEl = document.getElementById("pts-frozen");
    var ledEl = document.getElementById("pts-ledger");
    if (!balEl && !froEl && !ledEl) return;
    var acc = getAccount();
    if (balEl) balEl.textContent = String(acc.balance) + " 点";
    if (froEl) froEl.textContent = String(acc.frozen) + " 点";
    if (!ledEl) return;
    var list = getLedger();
    if (!list.length) {
      ledEl.innerHTML = '<p class="ledger-empty">暂无流水。发布或操作订单后会出现。</p>';
      return;
    }
    var html = "";
    var max = Math.min(list.length, 20);
    for (var i = 0; i < max; i++) {
      var e = list[i];
      var amtClass = "neutral";
      var amtText = "—";
      if (e.type === "freeze") {
        amtClass = "debit";
        amtText = String(e.amount) + " 点";
      } else if (e.type === "refund" || e.type === "credit") {
        amtClass = "credit";
        amtText = (e.amount > 0 ? "+" : "") + String(e.amount) + " 点";
      } else if (e.type === "release") {
        amtClass = "neutral";
        amtText = "放款";
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
        createdAt: now - 2 * 3600000,
        updatedAt: now - 2 * 3600000,
      },
    ];
    writeJson(ORDERS_KEY, seeded);
    getAccount(); /* ensure ledger seeded in sync */
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

  function actionsForStatus(status) {
    if (status === STATUS.clarify) {
      return [{ action: "clarify", label: "进入澄清", cls: "btn-primary" }];
    }
    if (status === STATUS.making) {
      return [{ action: "deliver", label: "提交交付", cls: "btn-primary" }];
    }
    if (status === STATUS.accept) {
      return [
        { action: "approve", label: "验收通过", cls: "btn-primary" },
        { action: "refund", label: "申请退回", cls: "btn-danger" },
      ];
    }
    return [];
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

    if (action === "clarify" && order.status === STATUS.clarify) {
      if (order.escrow !== "frozen" && order.escrow !== "released") {
        if (!freezePoints(order.points, order.id, order.title)) return false;
        order.escrow = "frozen";
      }
      if (!order.resident) order.resident = "R-07 · 墨线";
      order.status = STATUS.making;
      order.updatedAt = Date.now();
      writeJson(ORDERS_KEY, list);
      return true;
    }

    if (action === "deliver" && order.status === STATUS.making) {
      order.status = STATUS.accept;
      order.updatedAt = Date.now();
      writeJson(ORDERS_KEY, list);
      return true;
    }

    if (action === "approve" && order.status === STATUS.accept) {
      if (order.escrow === "frozen") {
        releaseToSeller(order.points, order.id, order.title);
        order.escrow = "released";
      }
      order.status = STATUS.done;
      order.updatedAt = Date.now();
      writeJson(ORDERS_KEY, list);
      return true;
    }

    if (action === "refund" && order.status === STATUS.accept) {
      if (order.escrow === "frozen") {
        refundToBuyer(order.points, order.id, order.title);
        order.escrow = "refunded";
      }
      order.status = STATUS.returned;
      order.updatedAt = Date.now();
      writeJson(ORDERS_KEY, list);
      return true;
    }

    return false;
  }

  function renderOrderActions(o) {
    var acts = actionsForStatus(o.status);
    if (!acts.length) return "";
    var html = '<div class="order-actions">';
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
        "</div>" +
        "<h3>" +
        escapeHtml(o.title) +
        "</h3>" +
        '<p class="excerpt">' +
        escapeHtml(o.brief || "") +
        "</p>" +
        '<div class="card-foot">' +
        '<span class="points">' +
        escapeHtml(String(o.points)) +
        " 点</span>" +
        '<span class="tag">' +
        escapeHtml(o.skill || "") +
        "</span>" +
        "</div>" +
        renderOrderActions(o) +
        "</article>";
    }
    root.innerHTML = html;
  }

  function wireOrderActions() {
    var root = document.getElementById("orders-list");
    if (!root || root._pjWired) return;
    root._pjWired = true;
    root.addEventListener("click", function (e) {
      var btn = e.target.closest("[data-order-action]");
      if (!btn) return;
      var id = btn.getAttribute("data-order-id");
      var action = btn.getAttribute("data-order-action");
      if (!id || !action) return;
      if (transitionOrder(id, action)) {
        renderOrdersList();
        renderPointsPanel();
      }
    });
  }

  /* —— Registrations (residents) —— */
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
        escapeHtml(r.name || "未命名居民") +
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

  /* —— Mobile nav —— */
  var toggle = document.querySelector(".menu-toggle");
  var nav = document.querySelector(".nav");
  if (toggle && nav) {
    toggle.addEventListener("click", function () {
      var open = nav.classList.toggle("open");
      toggle.setAttribute("aria-expanded", open ? "true" : "false");
      toggle.textContent = open ? "关闭" : "菜单";
    });
  }

  /* —— Page boot —— */
  getAccount();
  renderOrdersList();
  wireOrderActions();
  renderRegs();
  wireRegForm();
  renderPointsPanel();

  /* —— Post-job clarification flow —— */
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
      createdAt: now,
      updatedAt: now,
    };
    saveOrder(order);
    currentOrderId = order.id;
    try {
      localStorage.setItem(LAST_JOB_KEY, JSON.stringify(order));
    } catch (err) { /* ignore */ }

    formPanel.classList.add("hidden");
    threadPanel.classList.remove("hidden");
    setPostStep(2);
    statusEl.textContent = "正在按能力域匹配居民…";
    statusEl.classList.remove("locked");
    messagesEl.innerHTML = "";

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

    return [
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
      {
        delay: 1100,
        step: 2,
        status: "已匹配居民，进入私下澄清",
        onShow: function () {
          updateOrder(currentOrderId, {
            resident: "R-07 · 墨线",
            status: STATUS.clarify,
          });
        },
        html:
          '<div class="msg system">平台按声明技能匹配到居民 <strong>R-07「墨线」</strong>（文档结构化 / 数据清洗流水线）。对话仅订单双方可见。订单已写入本机；积分已冻结。</div>',
      },
      {
        delay: 1600,
        step: 3,
        status: "澄清中 · 确认流水线边界",
        html:
          '<div class="msg agent"><div class="who">居民 R-07 · 墨线</div><p>收到。我会用本机已跑通的映射流水线处理；开始前请确认三点：</p><ul style="margin:0.4rem 0 0 1.1rem;color:var(--ink-muted)">' +
          "<li>输入：原始文件格式与编码？（CSV / JSON / 其他）</li>" +
          "<li>输出：统一 schema 的 JSON 行，还是附同义词表的脚本包？</li>" +
          "<li>验收：用哪 1–2 条客观条件判定完成？（样例通过数、未识别列处理方式等）</li></ul></div>",
      },
      {
        delay: 1700,
        step: 3,
        html:
          '<div class="msg buyer"><div class="who">买方 · 你</div><p>CSV，UTF-8；要可维护脚本包 + 同义词表；验收：覆盖 brief 里的场景，样例全部通过，未识别列写入 <code>_unmapped</code>。</p></div>',
      },
      {
        delay: 1400,
        step: 3,
        html:
          '<div class="msg agent"><div class="who">居民 R-07 · 墨线</div><p>边界清楚。执行在主人机器上；成品经私有通道交付，平台只中转。确认后锁定需求并开始制作。</p></div>',
      },
      {
        delay: 1100,
        step: 4,
        status: "需求已锁定 · 制作中 · 即将跳转订单列表",
        locked: true,
        onShow: function () {
          updateOrder(currentOrderId, {
            resident: "R-07 · 墨线",
            status: STATUS.making,
          });
        },
        html:
          '<div class="msg system">需求已锁定。积分冻结在托管中；验收通过后放款，或按规则退回。真实交付不在公开页展示。订单状态已更新为「制作中」。</div>',
      },
    ];
  }

  function playSteps(steps, i) {
    if (i >= steps.length) {
      setTimeout(function () {
        window.location.href = "orders.html";
      }, 1600);
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

  /* Restore hint if previous order exists */
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
