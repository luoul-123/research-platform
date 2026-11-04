(function () {
  "use strict";
  var KEY = "research_platform_v1";
  var SEED = window.SEED || { entries: [], groups: [], metaTasks: [] };
  var $ = function (s, r) {
    return (r || document).querySelector(s);
  };
  var params = new URLSearchParams(location.search);
  var id = params.get("id") || "";
  var entry = null;
  var timer = null;

  function clone(o) {
    return JSON.parse(JSON.stringify(o));
  }
  function loadState() {
    try {
      var raw = localStorage.getItem(KEY);
      if (raw) {
        var d = JSON.parse(raw);
        if (d && Array.isArray(d.entries)) {
          d.meta = d.meta || {};
          d.metaTasks = d.metaTasks || clone(SEED.metaTasks || []);
          return d;
        }
      }
    } catch (e) {}
    var s = clone(SEED);
    s.meta = {};
    return s;
  }
  var state = loadState();

  function findEntry() {
    for (var i = 0; i < state.entries.length; i++) {
      if (state.entries[i].id === id) return state.entries[i];
    }
    return null;
  }
  function saveState() {
    try {
      localStorage.setItem(KEY, JSON.stringify(state));
    } catch (e) {}
  }
  function updateCount() {
    var v = $("#nb-notes").value || "";
    $("#nb-count").textContent = v.length + " 字";
  }
  function clean(s) {
    return String(s || "").replace(/\*{1,2}([^*]+)\*{1,2}/g, "$1");
  }
  function setMeta(e) {
    $("#nb-id").textContent = e.id;
    $("#nb-title").textContent = clean(e.title);
    if (e.link) {
      $("#nb-open").disabled = false;
      $("#nb-open").textContent = "打开原文 ↗";
      $("#nb-open").onclick = function () {
        window.open(e.link, "_blank", "noopener");
      };
    } else {
      $("#nb-open").disabled = true;
      $("#nb-open").textContent = "无原文链接";
      $("#nb-open").onclick = null;
    }
  }
  function render() {
    entry = findEntry();
    if (!entry) {
      $(".nb-main").innerHTML =
        '<div class="nb-empty"><h2>没有找到这篇文献</h2>' +
        "<p>请从阅读清单点「笔记」重新打开；或指定 ?id=A1。</p>" +
        '<button class="btn primary" id="nb-go" type="button">打开阅读清单</button></div>';
      $("#nb-open").disabled = true;
      $("#nb-open").textContent = "无原文链接";
      var go = $("#nb-go");
      if (go)
        go.onclick = function () {
          window.open("index.html", "_blank");
        };
      return;
    }
    setMeta(entry);
    $("#nb-notes").value = entry.notes || "";
    updateCount();
  }

  function saveNow() {
    if (!entry) return;
    entry.notes = $("#nb-notes").value;
    state.entries = state.entries.map(function (e) {
      return e.id === entry.id ? entry : e;
    });
    saveState();
    $("#nb-status").textContent = "已保存 " + new Date().toLocaleTimeString();
    if (window.opener && !window.opener.closed) {
      try {
        window.opener.postMessage(
          { type: "rl-save", id: entry.id, notes: entry.notes },
          "*",
        );
      } catch (e) {}
    }
  }

  $("#nb-notes").addEventListener("input", function () {
    if (!entry) return;
    entry.notes = this.value;
    updateCount();
    $("#nb-status").textContent = "未保存…";
    clearTimeout(timer);
    timer = setTimeout(saveNow, 450);
  });

  window.addEventListener("beforeunload", saveNow);

  $("#nb-close").addEventListener("click", function () {
    saveNow();
    window.close();
  });
  $("#nb-list").addEventListener("click", function () {
    window.open("index.html", "_blank");
  });
  $("#nb-copy").addEventListener("click", function () {
    if (!entry || !entry.link) {
      $("#nb-status").textContent = "没有可复制的链接";
      return;
    }
    var text = entry.link;
    var done = function () {
      $("#nb-status").textContent = "链接已复制";
    };
    var fail = function () {
      $("#nb-status").textContent = "复制失败，请手动复制";
    };
    if (navigator.clipboard && window.isSecureContext) {
      navigator.clipboard.writeText(text).then(done, fail);
    } else {
      var ta = document.createElement("textarea");
      ta.value = text;
      ta.style.position = "fixed";
      ta.style.opacity = "0";
      document.body.appendChild(ta);
      ta.select();
      try {
        document.execCommand("copy") ? done() : fail();
      } catch (e) {
        fail();
      }
      ta.remove();
    }
  });

  // The opener sends the authoritative entry state (robust even when file://
  // pages do not share localStorage).
  window.addEventListener("message", function (ev) {
    var d = ev.data || {};
    if (d.type !== "rl-state" || !d.entry) return;
    var fresh = d.entry;
    if (fresh.id !== id) return;
    if (document.activeElement !== $("#nb-notes")) {
      $("#nb-notes").value = fresh.notes || "";
      updateCount();
    }
    var local = findEntry();
    if (local) {
      local.title = fresh.title || local.title;
      local.link = fresh.link || local.link;
      local.notes = fresh.notes || local.notes;
      entry = local;
      setMeta(local);
    }
  });

  // If localStorage is shared, keep this window fresh when the list edits notes.
  window.addEventListener("storage", function (ev) {
    if (ev.key !== KEY) return;
    state = loadState();
    var e = findEntry();
    if (!e) return;
    if (
      document.activeElement !== $("#nb-notes") &&
      $("#nb-notes").value !== (e.notes || "")
    ) {
      $("#nb-notes").value = e.notes || "";
      updateCount();
    }
    entry = e;
    setMeta(e);
  });

  render();
  if (window.opener && !window.opener.closed) {
    try {
      window.opener.postMessage({ type: "rl-hello", id: id }, "*");
    } catch (e) {}
  }
})();
