(function () {
  "use strict";

  var PRIVATE_MODE = !!window.PRIVATE_MODE;
  if (PRIVATE_MODE) {
    document.body.classList.add("private-mode");
    var subLine = document.querySelector(".hero .sub");
    if (subLine) subLine.textContent = "私人模式 · 数据仅存本机，不会上传";
  }
  var KEY = PRIVATE_MODE ? "reading_tracker_v1" : "research_platform_v1";
  var THEME_KEY = PRIVATE_MODE
    ? "research_workbench_theme_v1"
    : "research_platform_theme_v1";
  var TAB_KEY = PRIVATE_MODE
    ? "research_workbench_tab_v1"
    : "research_platform_tab_v1";
  var SEED = window.SEED || { entries: [] };

  var $ = function (s, r) {
    return (r || document).querySelector(s);
  };
  var $$ = function (s, r) {
    return Array.prototype.slice.call((r || document).querySelectorAll(s));
  };
  var esc = function (v) {
    return String(v == null ? "" : v).replace(/[&<>"']/g, function (c) {
      return {
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#39;",
      }[c];
    });
  };
  var clone = function (o) {
    return JSON.parse(JSON.stringify(o));
  };
  var clamp = function (n, min, max) {
    n = parseInt(n, 10);
    if (isNaN(n)) n = min;
    return Math.max(min, Math.min(max, n));
  };
  var uid = function (prefix) {
    return prefix + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
  };
  var nowIso = function () {
    return new Date().toISOString();
  };
  var parseTags = function (v) {
    return String(v || "")
      .split(/[,，]/)
      .map(function (s) {
        return s.trim();
      })
      .filter(Boolean);
  };
  var formatTime = function (iso) {
    if (!iso) return "";
    var d = new Date(iso);
    if (isNaN(d.getTime())) return "";
    return (
      d.getFullYear() +
      "-" +
      String(d.getMonth() + 1).padStart(2, "0") +
      "-" +
      String(d.getDate()).padStart(2, "0") +
      " " +
      String(d.getHours()).padStart(2, "0") +
      ":" +
      String(d.getMinutes()).padStart(2, "0")
    );
  };
  var todayStr = function () {
    var d = new Date();
    return (
      d.getFullYear() +
      "-" +
      String(d.getMonth() + 1).padStart(2, "0") +
      "-" +
      String(d.getDate()).padStart(2, "0")
    );
  };

  var state;
  var filters = { q: "", status: "all", priority: "all", sort: "default" };
  var memoFilter = { q: "", filter: "all", sort: "updated" };
  var todoFilter = { q: "", filter: "all", sort: "priority" };
  var activeTab = "lit";
  var selectedMemoId = null;
  var editingEntry = null;
  var editingSection = null;
  var notebookWin = null;
  var notebookId = null;
  var saveTimer = null;

  function normalize(raw) {
    var d = raw || {};
    var isVersioned = typeof d.version === "number";
    var sections =
      Array.isArray(d.sections) && d.sections.length
        ? d.sections.map(function (s, i) {
            return {
              id: s.id || "s" + (i + 1),
              name: s.name || "未命名分区",
              collapsed: !!s.collapsed,
            };
          })
        : [{ id: "s1", name: "文献清单", collapsed: false }];

    var entries = Array.isArray(d.entries) ? d.entries : [];
    entries = entries.map(function (e, i) {
      var sec =
        e.section &&
        sections.some(function (s) {
          return s.id === e.section;
        })
          ? e.section
          : sections[0].id;
      var p = e.priority;
      if (!isVersioned) p = ({ 1: 2, 2: 4, 3: 5 })[p] || 3;
      return {
        id: e.id || "R" + (i + 1),
        title: e.title || "未命名文献",
        year: e.year || "",
        link: e.link || "",
        section: sec,
        priority: clamp(p == null ? 3 : p, 1, 5),
        read: !!e.read,
        notes: e.notes || "",
        readWhat: e.readWhat || "",
      };
    });

    var memos = Array.isArray(d.memos) ? d.memos : [];
    memos = memos.map(function (m, i) {
      return {
        id: m.id || "m" + (i + 1),
        title: m.title || "未命名心得",
        content: m.content || "",
        tags: Array.isArray(m.tags) ? m.tags : parseTags(m.tags),
        pinned: !!m.pinned,
        created: m.created || nowIso(),
        updated: m.updated || m.created || nowIso(),
      };
    });

    var todos = Array.isArray(d.todos) ? d.todos : [];
    todos = todos.map(function (t, i) {
      return {
        id: t.id || "t" + (i + 1),
        title: t.title || "未命名待办",
        done: !!t.done,
        priority: ["high", "medium", "low"].indexOf(t.priority) >= 0 ? t.priority : "medium",
        due: t.due || "",
        tags: Array.isArray(t.tags) ? t.tags : parseTags(t.tags),
        notes: t.notes || "",
        created: t.created || nowIso(),
        updated: t.updated || t.created || nowIso(),
      };
    });

    var bookmarks = Array.isArray(d.bookmarks) ? d.bookmarks : [];
    bookmarks = bookmarks
      .map(function (b, i) {
        return {
          id: b.id || "b" + (i + 1),
          title: b.title || b.url || "未命名网址",
          url: b.url || "",
        };
      })
      .filter(function (b) {
        return !!b.url;
      });

    return {
      version: 3,
      sections: sections,
      entries: entries,
      memos: memos,
      todos: todos,
      bookmarks: bookmarks,
    };
  }

  function loadState() {
    try {
      var raw = localStorage.getItem(KEY);
      if (raw) {
        var d = JSON.parse(raw);
        if (d && Array.isArray(d.entries)) return normalize(d);
      }
    } catch (e) {}
    try {
      if (
        PRIVATE_MODE &&
        window.PRIVATE_STATE &&
        Array.isArray(window.PRIVATE_STATE.entries)
      )
        return normalize(window.PRIVATE_STATE);
    } catch (e) {}
    return normalize(clone(SEED));
  }
  function save() {
    state.version = 3;
    try {
      localStorage.setItem(KEY, JSON.stringify(state));
    } catch (e) {}
  }
  function debounceSave() {
    clearTimeout(saveTimer);
    saveTimer = setTimeout(save, 350);
  }

  function toast(msg) {
    var t = $("#toast");
    t.textContent = msg;
    t.classList.add("show");
    clearTimeout(t._tm);
    t._tm = setTimeout(function () {
      t.classList.remove("show");
    }, 1900);
  }

  function sectionById(id) {
    for (var i = 0; i < state.sections.length; i++)
      if (state.sections[i].id === id) return state.sections[i];
    return null;
  }
  function entryById(id) {
    for (var i = 0; i < state.entries.length; i++)
      if (state.entries[i].id === id) return state.entries[i];
    return null;
  }
  function memoById(id) {
    for (var i = 0; i < state.memos.length; i++)
      if (state.memos[i].id === id) return state.memos[i];
    return null;
  }
  function todoById(id) {
    for (var i = 0; i < state.todos.length; i++)
      if (state.todos[i].id === id) return state.todos[i];
    return null;
  }
  function genEntryId() {
    var i = 1;
    while (
      state.entries.some(function (e) {
        return e.id === "R" + i;
      })
    )
      i++;
    return "R" + i;
  }
  function genMemoId() {
    var i = 1;
    while (
      state.memos.some(function (m) {
        return m.id === "m" + i;
      })
    )
      i++;
    return "m" + i;
  }
  function genTodoId() {
    var i = 1;
    while (
      state.todos.some(function (t) {
        return t.id === "t" + i;
      })
    )
      i++;
    return "t" + i;
  }
  function genBookmarkId() {
    var i = 1;
    while (
      state.bookmarks.some(function (b) {
        return b.id === "b" + i;
      })
    )
      i++;
    return "b" + i;
  }
  var normalizeUrl = function (value) {
    var u = String(value || "").trim();
    if (!u) return "";
    if (!/^https?:\/\//i.test(u)) {
      if (/^[a-z][a-z0-9+.-]*:/i.test(u)) return "";
      u = "https://" + u;
    }
    try {
      var p = new URL(u);
      if (p.protocol !== "http:" && p.protocol !== "https:") return "";
      return p.href;
    } catch (e) {
      return "";
    }
  };
  function priorityOf(e) {
    return clamp(e.priority, 1, 5);
  }
  function starsHTML(p) {
    return "★".repeat(p) + '<span class="dim">' + "☆".repeat(5 - p) + "</span>";
  }

  // ---------------- header / tabs ----------------
  function renderProgress() {
    var total = state.entries.length;
    var read = state.entries.filter(function (e) {
      return e.read;
    }).length;
    var pct = total ? Math.round((read * 100) / total) : 0;
    $("#progress-bar").style.width = pct + "%";
    $("#progress-text").textContent =
      "阅读进度 " + pct + "%" + (total ? "（" + read + " / " + total + "）" : "");
  }
  function renderCounts() {
    var active = state.todos.filter(function (t) {
      return !t.done;
    }).length;
    var total = state.todos.length;
    $("#tab-lit-count").textContent = state.entries.length;
    $("#tab-memo-count").textContent = state.memos.length;
    $("#tab-todo-count").textContent = total ? active + "/" + total : "0";
  }
  function renderBookmarks() {
    var box = $("#bookmarks");
    var add =
      '<button class="bookmark-add" type="button" data-act="add-bookmark">＋ 添加网址</button>';
    if (!state.bookmarks.length) {
      box.innerHTML = '<span class="bookmark-label">常用网址</span>' + add;
      return;
    }
    box.innerHTML =
      '<span class="bookmark-label">常用网址</span>' +
      state.bookmarks
        .map(function (b) {
          return (
            '<span class="bookmark-chip">' +
            '<a href="' +
            esc(b.url) +
            '" target="_blank" rel="noopener" title="' +
            esc(b.url) +
            '">' +
            esc(b.title) +
            "</a>" +
            '<button class="bookmark-del" type="button" data-act="del-bookmark" data-id="' +
            esc(b.id) +
            '" title="删除">×</button>' +
            "</span>"
          );
        })
        .join("") +
      add;
  }
  function applyTab(tab) {
    activeTab = tab;
    document.body.dataset.tab = tab;
    $$("#tabs .tab").forEach(function (b) {
      b.classList.toggle("active", b.dataset.tab === tab);
    });
    ["lit", "memo", "todo"].forEach(function (k) {
      $("#module-" + k).classList.toggle("hidden", k !== tab);
    });
    try {
      localStorage.setItem(TAB_KEY, tab);
    } catch (e) {}
    if (tab === "memo") setTimeout(fitMemoWorkspace, 0);
  }
  function fitMemoWorkspace() {
    if (activeTab !== "memo") return;
    var ws = document.querySelector(".memo-workspace");
    if (!ws || typeof ws.getBoundingClientRect !== "function") return;
    if (window.innerWidth && window.innerWidth <= 900) {
      ws.style.height = "";
      return;
    }
    var top = ws.getBoundingClientRect().top;
    var h = window.innerHeight - Math.max(0, top) - 18;
    ws.style.height = Math.max(480, h) + "px";
  }
  window.addEventListener("resize", fitMemoWorkspace);
  function renderModule(tab) {
    if (tab === "lit") renderSections();
    else if (tab === "memo") renderMemos();
    else if (tab === "todo") renderTodos();
    renderCounts();
  }

  // ---------------- literature ----------------
  function filtersActive() {
    return !!(
      filters.q.trim() ||
      filters.status !== "all" ||
      filters.priority !== "all"
    );
  }
  function visibleEntries(sectionId) {
    var arr = state.entries.filter(function (e) {
      return e.section === sectionId;
    });
    var q = filters.q.trim().toLowerCase();
    if (q) {
      arr = arr.filter(function (e) {
        return [e.id, e.title, e.readWhat, e.notes, e.year]
          .join(" ")
          .toLowerCase()
          .indexOf(q) >= 0;
      });
    }
    if (filters.status === "read")
      arr = arr.filter(function (e) {
        return e.read;
      });
    if (filters.status === "unread")
      arr = arr.filter(function (e) {
        return !e.read;
      });
    if (filters.status === "notes")
      arr = arr.filter(function (e) {
        return e.notes && e.notes.trim();
      });
    if (filters.priority !== "all")
      arr = arr.filter(function (e) {
        return String(priorityOf(e)) === filters.priority;
      });

    if (filters.sort === "priority") {
      arr.sort(function (a, b) {
        return priorityOf(b) - priorityOf(a) || a.title.localeCompare(b.title, "zh");
      });
    } else if (filters.sort === "year") {
      arr.sort(function (a, b) {
        return (
          (parseInt(b.year, 10) || 0) - (parseInt(a.year, 10) || 0) ||
          a.title.localeCompare(b.title, "zh")
        );
      });
    } else if (filters.sort === "title") {
      arr.sort(function (a, b) {
        return a.title.localeCompare(b.title, "zh");
      });
    } else {
      arr.sort(function (a, b) {
        return String(a.id).localeCompare(String(b.id), undefined, {
          numeric: true,
        });
      });
    }
    return arr;
  }
  function cardHTML(e) {
    var p = priorityOf(e);
    return (
      '<article class="card' +
      (e.read ? " is-read" : "") +
      '" data-id="' +
      esc(e.id) +
      '">' +
      '<div class="card-top">' +
      '<span class="entry-id">' +
      esc(e.id) +
      "</span>" +
      '<span class="stars" title="优先级 ' +
      p +
      '/5">' +
      starsHTML(p) +
      "</span>" +
      '<label class="read-toggle"><input type="checkbox" data-act="read"' +
      (e.read ? " checked" : "") +
      "><span>已读</span></label>" +
      "</div>" +
      '<h3 class="card-title" title="点击打开笔记小窗">' +
      esc(e.title) +
      "</h3>" +
      '<div class="card-row">' +
      (e.link
        ? '<a class="link" href="' +
          esc(e.link) +
          '" target="_blank" rel="noopener">原文 ↗</a>'
        : "") +
      (e.year ? '<span class="tag">' + esc(e.year) + "</span>" : "") +
      "</div>" +
      (e.readWhat
        ? '<div class="readwhat"><b>关注点</b>' + esc(e.readWhat) + "</div>"
        : "") +
      (e.notes && e.notes.trim()
        ? '<div class="note-preview">' +
          esc(e.notes).replace(/\n/g, "<br>") +
          "</div>"
        : "") +
      '<div class="card-actions">' +
      '<button class="btn tiny" type="button" data-act="notebook">笔记</button>' +
      '<button class="btn tiny" type="button" data-act="edit">编辑</button>' +
      '<button class="btn tiny danger" type="button" data-act="del">删除</button>' +
      "</div>" +
      "</article>"
    );
  }
  function sectionHTML(sec) {
    var all = state.entries.filter(function (e) {
      return e.section === sec.id;
    });
    var shown = visibleEntries(sec.id);
    if (filtersActive() && shown.length === 0) return "";
    var read = all.filter(function (e) {
      return e.read;
    }).length;
    var pct = all.length ? Math.round((read * 100) / all.length) : 0;
    var open = filtersActive() ? shown.length > 0 : !sec.collapsed;
    var countText = filtersActive()
      ? shown.length + " / " + all.length + " 篇"
      : all.length + " 篇";
    return (
      '<details class="section" data-id="' +
      esc(sec.id) +
      '"' +
      (open ? " open" : "") +
      ">" +
      "<summary>" +
      '<span class="chev">▸</span>' +
      '<span class="sec-title">' +
      esc(sec.name) +
      "</span>" +
      '<span class="sec-meta">' +
      countText +
      " · 已读 " +
      read +
      "</span>" +
      '<span class="sec-progress"><i style="width:' +
      pct +
      '%"></i></span>' +
      '<span class="sec-actions">' +
      '<button class="btn tiny" type="button" data-act="add-entry" data-sec="' +
      esc(sec.id) +
      '">＋ 文献</button>' +
      '<button class="btn tiny" type="button" data-act="rename-sec" data-sec="' +
      esc(sec.id) +
      '">重命名</button>' +
      '<button class="btn tiny danger" type="button" data-act="del-sec" data-sec="' +
      esc(sec.id) +
      '">删除</button>' +
      "</span>" +
      "</summary>" +
      '<div class="cards">' +
      (shown.length
        ? shown.map(cardHTML).join("")
        : '<div class="empty-sec">暂无文献，点「＋ 文献」添加。</div>') +
      "</div>" +
      "</details>"
    );
  }
  function renderSections() {
    var html = state.sections.map(sectionHTML).join("");
    if (!html) {
      html =
        '<div class="empty-all">没有匹配的文献。<br><button class="btn" id="clear-filter" type="button">清空筛选</button></div>';
    }
    $("#sections").innerHTML = html;
    if (!filtersActive()) {
      $$("#sections details.section").forEach(function (d) {
        d.addEventListener("toggle", function () {
          var sec = sectionById(d.dataset.id);
          if (sec) {
            sec.collapsed = !d.open;
            save();
          }
        });
      });
    }
    var cf = $("#clear-filter");
    if (cf) cf.addEventListener("click", clearFilters);
  }
  function clearFilters() {
    filters = { q: "", status: "all", priority: "all", sort: "default" };
    $("#search").value = "";
    $("#status").value = "all";
    $("#priority").value = "all";
    $("#sort").value = "default";
    renderSections();
  }

  // ---------------- entry / section modals ----------------
  function fillSectionSelect(selected) {
    var sel = $("#f-section");
    sel.innerHTML = "";
    state.sections.forEach(function (s) {
      var o = document.createElement("option");
      o.value = s.id;
      o.textContent = s.name;
      sel.appendChild(o);
    });
    if (
      selected &&
      state.sections.some(function (s) {
        return s.id === selected;
      })
    )
      sel.value = selected;
  }
  function setPriority(p) {
    p = clamp(p, 1, 5);
    $("#f-priority").value = String(p);
    $$("#f-stars button").forEach(function (b) {
      b.classList.toggle("on", parseInt(b.dataset.star, 10) <= p);
    });
  }
  function openEntryModal(entry, sectionId) {
    editingEntry = entry || null;
    $("#entry-modal-title").textContent = entry
      ? "编辑文献 " + entry.id
      : "添加文献";
    $("#f-title").value = entry ? entry.title : "";
    $("#f-year").value = entry ? entry.year : "";
    $("#f-link").value = entry ? entry.link : "";
    $("#f-readwhat").value = entry ? entry.readWhat : "";
    $("#f-notes").value = entry ? entry.notes : "";
    fillSectionSelect(entry ? entry.section : sectionId || state.sections[0].id);
    setPriority(entry ? entry.priority : 3);
    $("#entry-modal").classList.remove("hidden");
    setTimeout(function () {
      $("#f-title").focus();
    }, 40);
  }
  function closeEntryModal() {
    $("#entry-modal").classList.add("hidden");
    editingEntry = null;
  }
  function openSectionModal(sec) {
    editingSection = sec || null;
    $("#section-modal-title").textContent = sec ? "重命名分区" : "新建分区";
    $("#f-section-name").value = sec ? sec.name : "";
    $("#section-modal").classList.remove("hidden");
    setTimeout(function () {
      $("#f-section-name").focus();
    }, 40);
  }
  function closeSectionModal() {
    $("#section-modal").classList.add("hidden");
    editingSection = null;
  }

  // ---------------- memos ----------------
  function memoVisible() {
    var arr = state.memos.slice();
    var q = memoFilter.q.trim().toLowerCase();
    if (q) {
      arr = arr.filter(function (m) {
        return [m.title, m.content, (m.tags || []).join(" ")]
          .join(" ")
          .toLowerCase()
          .indexOf(q) >= 0;
      });
    }
    if (memoFilter.filter === "pinned")
      arr = arr.filter(function (m) {
        return m.pinned;
      });
    if (memoFilter.sort === "created")
      arr.sort(function (a, b) {
        return (
          (b.pinned ? 1 : 0) - (a.pinned ? 1 : 0) ||
          String(b.created).localeCompare(String(a.created))
        );
      });
    else if (memoFilter.sort === "title")
      arr.sort(function (a, b) {
        return (
          (b.pinned ? 1 : 0) - (a.pinned ? 1 : 0) ||
          a.title.localeCompare(b.title, "zh")
        );
      });
    else
      arr.sort(function (a, b) {
        return (
          (b.pinned ? 1 : 0) - (a.pinned ? 1 : 0) ||
          String(b.updated).localeCompare(String(a.updated))
        );
      });
    return arr;
  }
  function memoItemHTML(m) {
    return (
      '<button class="memo-item' +
      (m.id === selectedMemoId ? " active" : "") +
      '" type="button" data-act="select-memo" data-id="' +
      esc(m.id) +
      '">' +
      '<span class="memo-item-title">' +
      (m.pinned ? "★ " : "") +
      esc(m.title || "未命名心得") +
      "</span>" +
      '<span class="memo-item-meta">' +
      esc(formatTime(m.updated)) +
      (m.tags && m.tags.length ? " · " + esc(m.tags.join(" / ")) : "") +
      "</span></button>"
    );
  }
  function renderMemoEditor() {
    var box = $("#memo-editor");
    var m = selectedMemoId ? memoById(selectedMemoId) : null;
    if (!m) {
      box.innerHTML =
        '<div class="memo-editor-empty">从右侧列表选择一条心得，或点「＋ 新建心得」开始记录。</div>';
      return;
    }
    box.innerHTML =
      '<div class="memo-editor-head">' +
      '<input class="memo-title-input" data-act="memo-title" value="' +
      esc(m.title) +
      '" placeholder="心得标题">' +
      '<button class="memo-pin' +
      (m.pinned ? " on" : "") +
      '" type="button" data-act="pin-memo" title="置顶">★</button>' +
      "</div>" +
      '<div class="memo-tags-row"><input class="memo-tags" data-act="memo-tags" value="' +
      esc((m.tags || []).join(", ")) +
      '" placeholder="标签，用逗号分隔"></div>' +
      '<textarea class="memo-body" data-act="memo-body" placeholder="写研究心得、想法、待验证的问题…">' +
      esc(m.content || "") +
      "</textarea>" +
      '<div class="memo-foot"><span>更新于 ' +
      esc(formatTime(m.updated)) +
      " · " +
      (m.content || "").length +
      ' 字</span><span><button class="btn tiny danger" type="button" data-act="del-memo">删除</button></span></div>';
  }
  function renderMemos() {
    var list = memoVisible();
    if (selectedMemoId && !memoById(selectedMemoId)) selectedMemoId = null;
    if (!selectedMemoId && list.length) selectedMemoId = list[0].id;
    var box = $("#memo-list");
    box.innerHTML = list.length
      ? list.map(memoItemHTML).join("")
      : '<div class="memo-empty">没有匹配的研究心得。</div>';
    $("#memo-sidebar-count").textContent = list.length + " 条";
    renderMemoEditor();
  }
  function addMemo() {
    memoFilter = { q: "", filter: "all", sort: "updated" };
    $("#memo-search").value = "";
    $("#memo-filter").value = "all";
    $("#memo-sort").value = "updated";
    var m = {
      id: genMemoId(),
      title: "未命名心得",
      content: "",
      tags: [],
      pinned: false,
      created: nowIso(),
      updated: nowIso(),
    };
    state.memos.push(m);
    selectedMemoId = m.id;
    save();
    renderMemos();
    renderCounts();
    setTimeout(function () {
      var input = $("#memo-editor .memo-title-input");
      if (input) {
        input.focus();
        input.select();
      }
    }, 30);
  }

  // ---------------- todos ----------------
  var PRIORITY_RANK = { high: 0, medium: 1, low: 2 };
  function todoVisible() {
    var arr = state.todos.slice();
    var q = todoFilter.q.trim().toLowerCase();
    if (q) {
      arr = arr.filter(function (t) {
        return [t.title, (t.tags || []).join(" "), t.notes]
          .join(" ")
          .toLowerCase()
          .indexOf(q) >= 0;
      });
    }
    if (todoFilter.filter === "active")
      arr = arr.filter(function (t) {
        return !t.done;
      });
    if (todoFilter.filter === "done")
      arr = arr.filter(function (t) {
        return t.done;
      });
    if (todoFilter.sort === "due") {
      arr.sort(function (a, b) {
        var done = (a.done ? 1 : 0) - (b.done ? 1 : 0);
        if (done) return done;
        if (!a.due && !b.due) return 0;
        if (!a.due) return 1;
        if (!b.due) return -1;
        return a.due.localeCompare(b.due);
      });
    } else if (todoFilter.sort === "created") {
      arr.sort(function (a, b) {
        return (
          (a.done ? 1 : 0) - (b.done ? 1 : 0) ||
          String(b.created).localeCompare(String(a.created))
        );
      });
    } else {
      arr.sort(function (a, b) {
        return (
          (a.done ? 1 : 0) - (b.done ? 1 : 0) ||
          (PRIORITY_RANK[a.priority] || 1) -
            (PRIORITY_RANK[b.priority] || 1) ||
          String(b.created).localeCompare(String(a.created))
        );
      });
    }
    return arr;
  }
  function todoHTML(t) {
    var done = t.done;
    var overdue = !!t.due && !done && t.due < todayStr();
    var pClass = "p-" + (t.priority || "medium");
    return (
      '<article class="todo' +
      (done ? " done" : "") +
      '" data-id="' +
      esc(t.id) +
      '">' +
      '<label class="todo-check"><input type="checkbox" data-act="todo-done"' +
      (done ? " checked" : "") +
      "></label>" +
      '<div class="todo-main">' +
      '<input class="todo-title" data-act="todo-title" value="' +
      esc(t.title) +
      '" placeholder="待办事项">' +
      '<div class="todo-meta">' +
      '<select class="todo-priority ' +
      pClass +
      '" data-act="todo-priority">' +
      '<option value="high"' +
      (t.priority === "high" ? " selected" : "") +
      ">高</option>" +
      '<option value="medium"' +
      (t.priority === "medium" ? " selected" : "") +
      ">中</option>" +
      '<option value="low"' +
      (t.priority === "low" ? " selected" : "") +
      ">低</option>" +
      "</select>" +
      '<input type="date" class="todo-due' +
      (overdue ? " overdue" : "") +
      '" data-act="todo-due" value="' +
      esc(t.due || "") +
      '">' +
      '<input class="todo-tags" data-act="todo-tags" value="' +
      esc((t.tags || []).join(", ")) +
      '" placeholder="标签，用逗号分隔">' +
      "</div>" +
      '<details class="todo-details"><summary>备注' +
      (t.notes ? "（已填写）" : "") +
      '</summary><textarea data-act="todo-notes" placeholder="补充说明…">' +
      esc(t.notes || "") +
      "</textarea></details>" +
      "</div>" +
      '<button class="todo-del" type="button" data-act="del-todo" title="删除">×</button>' +
      "</article>"
    );
  }
  function renderTodos() {
    var list = todoVisible();
    var box = $("#todo-list");
    var active = state.todos.filter(function (t) {
      return !t.done;
    }).length;
    var done = state.todos.length - active;
    $("#todo-summary").textContent =
      state.todos.length
        ? active + " 项未完成 · " + done + " 项已完成"
        : "";
    if (!list.length) {
      box.innerHTML =
        '<div class="todo-empty">' +
        (state.todos.length
          ? "没有匹配的待办。"
          : "还没有待办，在上方输入框添加一条。") +
        "</div>";
      return;
    }
    box.innerHTML = list.map(todoHTML).join("");
  }
  function addTodo() {
    todoFilter = { q: "", filter: "all", sort: "priority" };
    $("#todo-search").value = "";
    $("#todo-filter").value = "all";
    $("#todo-sort").value = "priority";
    var input = $("#new-todo");
    var title = input.value.trim();
    if (!title) {
      toast("待办内容不能为空");
      input.focus();
      return;
    }
    var t = {
      id: genTodoId(),
      title: title,
      done: false,
      priority: $("#new-todo-priority").value || "medium",
      due: "",
      tags: [],
      notes: "",
      created: nowIso(),
      updated: nowIso(),
    };
    state.todos.push(t);
    input.value = "";
    save();
    renderTodos();
    renderCounts();
    input.focus();
  }

  // ---------------- notebook window ----------------
  function openNotebook(e) {
    notebookId = e.id;
    var w = 480;
    var h = Math.max(620, (window.screen.availHeight || 900) - 60);
    var left = Math.max(0, (window.screen.availWidth || 1200) - w - 20);
    var features =
      "popup=yes,width=" +
      w +
      ",height=" +
      h +
      ",left=" +
      left +
      ",top=0,resizable=yes,scrollbars=yes";
    notebookWin = window.open(
      "notebook.html?id=" +
        encodeURIComponent(e.id) +
        (PRIVATE_MODE ? "&mode=private" : ""),
      "rl_notebook",
      features,
    );
    if (!notebookWin) {
      toast("浏览器拦截了弹窗，请允许本页弹窗后重试");
      return;
    }
    notebookWin.focus();
    setTimeout(postEntryToNotebook, 700);
  }
  function postEntryToNotebook() {
    if (!notebookWin || notebookWin.closed || !notebookId) return;
    var e = entryById(notebookId);
    if (!e) return;
    notebookWin.postMessage(
      {
        type: "rl-state",
        entry: {
          id: e.id,
          title: e.title,
          link: e.link,
          notes: e.notes || "",
        },
      },
      "*",
    );
  }
  window.addEventListener("message", function (ev) {
    var d = ev.data || {};
    if (d.type === "rl-hello" && d.id) {
      notebookId = d.id;
      postEntryToNotebook();
    } else if (d.type === "rl-save" && d.id) {
      var e = entryById(d.id);
      if (!e) return;
      e.notes = d.notes || "";
      save();
      renderSections();
    }
  });

  // ---------------- events: tabs ----------------
  $("#tabs").addEventListener("click", function (ev) {
    var b = ev.target.closest(".tab");
    if (!b) return;
    applyTab(b.dataset.tab);
    renderModule(b.dataset.tab);
  });

  // ---------------- events: literature ----------------
  $("#search").addEventListener("input", function () {
    filters.q = this.value;
    renderSections();
  });
  $("#status").addEventListener("change", function () {
    filters.status = this.value;
    renderSections();
  });
  $("#priority").addEventListener("change", function () {
    filters.priority = this.value;
    renderSections();
  });
  $("#sort").addEventListener("change", function () {
    filters.sort = this.value;
    renderSections();
  });
  $("#add").addEventListener("click", function () {
    openEntryModal(null, state.sections[0].id);
  });
  $("#add-section").addEventListener("click", function () {
    openSectionModal(null);
  });
  $("#expand").addEventListener("click", function () {
    state.sections.forEach(function (s) {
      s.collapsed = false;
    });
    save();
    renderSections();
  });
  $("#collapse").addEventListener("click", function () {
    state.sections.forEach(function (s) {
      s.collapsed = true;
    });
    save();
    renderSections();
  });
  $("#sections").addEventListener("click", function (ev) {
    var btn = ev.target.closest("button[data-act]");
    if (btn) {
      if (btn.closest("summary")) {
        ev.preventDefault();
        ev.stopPropagation();
      }
      var act = btn.dataset.act;
      var secId = btn.dataset.sec;
      if (act === "add-entry") return openEntryModal(null, secId);
      if (act === "rename-sec") return openSectionModal(sectionById(secId));
      if (act === "del-sec") return deleteSection(secId);
      var card = btn.closest(".card");
      if (!card) return;
      var e = entryById(card.dataset.id);
      if (!e) return;
      if (act === "notebook") openNotebook(e);
      else if (act === "edit") openEntryModal(e, e.section);
      else if (act === "del") deleteEntry(e);
      return;
    }
    var title = ev.target.closest(".card-title");
    if (title) {
      var te = entryById(title.closest(".card").dataset.id);
      if (te) openNotebook(te);
      return;
    }
    if (ev.target.closest("a, input, textarea, label, select")) return;
    var cardEl = ev.target.closest(".card");
    if (cardEl) {
      var ce = entryById(cardEl.dataset.id);
      if (ce) openNotebook(ce);
    }
  });
  $("#sections").addEventListener("change", function (ev) {
    var cb = ev.target.closest('input[data-act="read"]');
    if (!cb) return;
    var card = cb.closest(".card");
    var e = entryById(card.dataset.id);
    if (!e) return;
    e.read = cb.checked;
    save();
    renderSections();
    renderProgress();
  });
  function deleteEntry(e) {
    if (!confirm("确定删除「" + e.title + "」？该操作不可撤销。")) return;
    state.entries = state.entries.filter(function (x) {
      return x.id !== e.id;
    });
    save();
    renderSections();
    renderProgress();
    renderCounts();
    toast("已删除 " + e.id);
  }
  function deleteSection(id) {
    if (state.sections.length <= 1) {
      toast("至少保留一个分区");
      return;
    }
    var sec = sectionById(id);
    if (!sec) return;
    var count = state.entries.filter(function (e) {
      return e.section === id;
    }).length;
    if (
      !confirm(
        "删除分区「" + sec.name + "」？其中 " + count + " 篇文献会移到第一个分区。",
      )
    )
      return;
    var target = state.sections.filter(function (s) {
      return s.id !== id;
    })[0];
    state.entries.forEach(function (e) {
      if (e.section === id) e.section = target.id;
    });
    state.sections = state.sections.filter(function (s) {
      return s.id !== id;
    });
    save();
    renderSections();
    toast("已删除分区");
  }

  // ---------------- events: entry / section modals ----------------
  $("#f-stars").addEventListener("click", function (ev) {
    var b = ev.target.closest("button[data-star]");
    if (!b) return;
    setPriority(parseInt(b.dataset.star, 10));
  });
  $("#entry-cancel").addEventListener("click", closeEntryModal);
  $("#entry-modal").addEventListener("click", function (ev) {
    if (ev.target === $("#entry-modal")) closeEntryModal();
  });
  $("#entry-save").addEventListener("click", function () {
    var title = $("#f-title").value.trim();
    if (!title) {
      toast("标题不能为空");
      $("#f-title").focus();
      return;
    }
    var wasEditing = !!editingEntry;
    var data = {
      title: title,
      year: $("#f-year").value.trim(),
      link: $("#f-link").value.trim(),
      section: $("#f-section").value,
      priority: clamp($("#f-priority").value, 1, 5),
      readWhat: $("#f-readwhat").value.trim(),
      notes: $("#f-notes").value,
    };
    if (editingEntry) Object.assign(editingEntry, data);
    else {
      data.id = genEntryId();
      data.read = false;
      state.entries.push(data);
    }
    save();
    closeEntryModal();
    renderSections();
    renderProgress();
    renderCounts();
    toast(wasEditing ? "已保存修改" : "已添加文献");
  });
  $("#section-cancel").addEventListener("click", closeSectionModal);
  $("#section-modal").addEventListener("click", function (ev) {
    if (ev.target === $("#section-modal")) closeSectionModal();
  });
  $("#section-save").addEventListener("click", function () {
    var name = $("#f-section-name").value.trim();
    if (!name) {
      toast("分区名称不能为空");
      return;
    }
    if (editingSection) editingSection.name = name;
    else state.sections.push({ id: uid("s"), name: name, collapsed: false });
    save();
    closeSectionModal();
    renderSections();
    toast("分区已保存");
  });

  // ---------------- events: memos ----------------
  $("#memo-search").addEventListener("input", function () {
    memoFilter.q = this.value;
    renderMemos();
  });
  $("#memo-filter").addEventListener("change", function () {
    memoFilter.filter = this.value;
    renderMemos();
  });
  $("#memo-sort").addEventListener("change", function () {
    memoFilter.sort = this.value;
    renderMemos();
  });
  $("#add-memo").addEventListener("click", addMemo);
  $("#memo-list").addEventListener("click", function (ev) {
    var item = ev.target.closest(".memo-item");
    if (!item) return;
    selectedMemoId = item.dataset.id;
    $$("#memo-list .memo-item").forEach(function (b) {
      b.classList.toggle("active", b.dataset.id === selectedMemoId);
    });
    renderMemoEditor();
  });
  $("#memo-editor").addEventListener("click", function (ev) {
    var btn = ev.target.closest("button[data-act]");
    if (!btn) return;
    var m = selectedMemoId ? memoById(selectedMemoId) : null;
    if (!m) return;
    var act = btn.dataset.act;
    if (act === "pin-memo") {
      m.pinned = !m.pinned;
      m.updated = nowIso();
      save();
      renderMemos();
    } else if (act === "del-memo") {
      if (!confirm("确定删除这条研究心得？")) return;
      state.memos = state.memos.filter(function (x) {
        return x.id !== m.id;
      });
      selectedMemoId = null;
      save();
      renderMemos();
      renderCounts();
    }
  });
  $("#memo-editor").addEventListener("input", function (ev) {
    var m = selectedMemoId ? memoById(selectedMemoId) : null;
    if (!m) return;
    m.updated = nowIso();
    if (ev.target.classList.contains("memo-title-input")) {
      m.title = ev.target.value;
      var item = document.querySelector(
        '.memo-item[data-id="' + m.id + '"] .memo-item-title',
      );
      if (item)
        item.textContent =
          (m.pinned ? "★ " : "") + (m.title || "未命名心得");
    } else if (ev.target.classList.contains("memo-tags")) {
      m.tags = parseTags(ev.target.value);
    } else if (ev.target.classList.contains("memo-body")) {
      m.content = ev.target.value;
      var foot = document.querySelector("#memo-editor .memo-foot span");
      if (foot)
        foot.textContent =
          "更新于 " + formatTime(m.updated) + " · " + m.content.length + " 字";
    } else return;
    debounceSave();
  });

  // ---------------- events: todos ----------------
  $("#add-todo").addEventListener("click", addTodo);
  $("#new-todo").addEventListener("keydown", function (ev) {
    if (ev.key === "Enter") {
      ev.preventDefault();
      addTodo();
    }
  });
  $("#todo-search").addEventListener("input", function () {
    todoFilter.q = this.value;
    renderTodos();
  });
  $("#todo-filter").addEventListener("change", function () {
    todoFilter.filter = this.value;
    renderTodos();
  });
  $("#todo-sort").addEventListener("change", function () {
    todoFilter.sort = this.value;
    renderTodos();
  });
  $("#clear-done").addEventListener("click", function () {
    var done = state.todos.filter(function (t) {
      return t.done;
    });
    if (!done.length) {
      toast("没有已完成的待办");
      return;
    }
    if (!confirm("清除 " + done.length + " 条已完成的待办？")) return;
    state.todos = state.todos.filter(function (t) {
      return !t.done;
    });
    save();
    renderTodos();
    renderCounts();
  });
  $("#todo-list").addEventListener("change", function (ev) {
    var todoEl = ev.target.closest(".todo");
    if (!todoEl) return;
    var t = todoById(todoEl.dataset.id);
    if (!t) return;
    if (ev.target.matches('input[data-act="todo-done"]')) {
      t.done = ev.target.checked;
      t.updated = nowIso();
      save();
      renderTodos();
      renderCounts();
    } else if (ev.target.matches('select[data-act="todo-priority"]')) {
      t.priority = ev.target.value;
      t.updated = nowIso();
      save();
      renderTodos();
    } else if (ev.target.matches('input[data-act="todo-due"]')) {
      t.due = ev.target.value;
      t.updated = nowIso();
      save();
      renderTodos();
    }
  });
  $("#todo-list").addEventListener("input", function (ev) {
    var todoEl = ev.target.closest(".todo");
    if (!todoEl) return;
    var t = todoById(todoEl.dataset.id);
    if (!t) return;
    if (ev.target.classList.contains("todo-title")) t.title = ev.target.value;
    else if (ev.target.classList.contains("todo-tags"))
      t.tags = parseTags(ev.target.value);
    else if (ev.target.matches('textarea[data-act="todo-notes"]'))
      t.notes = ev.target.value;
    else return;
    t.updated = nowIso();
    debounceSave();
  });
  $("#todo-list").addEventListener("click", function (ev) {
    var btn = ev.target.closest("button[data-act]");
    if (!btn) return;
    var todoEl = btn.closest(".todo");
    if (!todoEl) return;
    var id = todoEl.dataset.id;
    if (btn.dataset.act !== "del-todo") return;
    var t = todoById(id);
    if (!t) return;
    if (!confirm("删除待办「" + t.title + "」？")) return;
    state.todos = state.todos.filter(function (x) {
      return x.id !== id;
    });
    save();
    renderTodos();
    renderCounts();
  });

  // ---------------- fixed bookmarks ----------------
  function openBookmarkModal() {
    $("#bookmark-modal-title").textContent = "添加固定网址";
    $("#bm-title").value = "";
    $("#bm-url").value = "";
    $("#bookmark-modal").classList.remove("hidden");
    setTimeout(function () {
      $("#bm-url").focus();
    }, 40);
  }
  function closeBookmarkModal() {
    $("#bookmark-modal").classList.add("hidden");
  }
  $("#bookmarks").addEventListener("click", function (ev) {
    var add = ev.target.closest('button[data-act="add-bookmark"]');
    if (add) {
      openBookmarkModal();
      return;
    }
    var del = ev.target.closest('button[data-act="del-bookmark"]');
    if (!del) return;
    if (!confirm("删除这个固定网址？")) return;
    state.bookmarks = state.bookmarks.filter(function (b) {
      return b.id !== del.dataset.id;
    });
    save();
    renderBookmarks();
    toast("已删除网址");
  });
  $("#bm-cancel").addEventListener("click", closeBookmarkModal);
  $("#bookmark-modal").addEventListener("click", function (ev) {
    if (ev.target === $("#bookmark-modal")) closeBookmarkModal();
  });
  $("#bm-url").addEventListener("keydown", function (ev) {
    if (ev.key === "Enter") {
      ev.preventDefault();
      $("#bm-save").click();
    }
  });
  $("#bm-save").addEventListener("click", function () {
    var url = normalizeUrl($("#bm-url").value);
    if (!url) {
      toast("请输入有效的 http/https 网址");
      $("#bm-url").focus();
      return;
    }
    var title = $("#bm-title").value.trim();
    if (!title) {
      try {
        title = new URL(url).hostname.replace(/^www\./, "");
      } catch (e) {
        title = "未命名网址";
      }
    }
    state.bookmarks.push({ id: genBookmarkId(), title: title, url: url });
    save();
    closeBookmarkModal();
    renderBookmarks();
    toast("已添加固定网址");
  });

  // ---------------- import / export / theme / print ----------------
  $("#export").addEventListener("click", function () {
    var blob = new Blob([JSON.stringify(state, null, 2)], {
      type: "application/json",
    });
    var a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download =
      "research_workbench_" + new Date().toISOString().slice(0, 10) + ".json";
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(function () {
      URL.revokeObjectURL(a.href);
    }, 1500);
    toast("已导出备份");
  });
  $("#import").addEventListener("click", function () {
    $("#file").click();
  });
  $("#file").addEventListener("change", function () {
    var f = this.files && this.files[0];
    if (!f) return;
    var reader = new FileReader();
    reader.onload = function () {
      try {
        var d = JSON.parse(reader.result);
        if (!d || !Array.isArray(d.entries)) throw new Error("bad format");
        if (
          !confirm(
            "导入将覆盖当前工作台（" +
              state.entries.length +
              " 篇文献 / " +
              state.memos.length +
              " 条心得 / " +
              state.todos.length +
              " 项待办），确定？",
          )
        )
          return;
        state = normalize(d);
        save();
        renderAll();
        toast("已导入数据");
      } catch (e) {
        toast("导入失败：不是有效的备份文件");
      }
      $("#file").value = "";
    };
    reader.readAsText(f);
  });
  function applyTheme(t) {
    document.documentElement.dataset.theme = t;
    $("#theme").textContent = t === "dark" ? "☀️" : "🌙";
    try {
      localStorage.setItem(THEME_KEY, t);
    } catch (e) {}
  }
  $("#theme").addEventListener("click", function () {
    applyTheme(
      document.documentElement.dataset.theme === "dark" ? "light" : "dark",
    );
  });
  $("#print").addEventListener("click", function () {
    window.print();
  });

  document.addEventListener("keydown", function (ev) {
    if (ev.key !== "Escape") return;
    if (!$("#entry-modal").classList.contains("hidden")) closeEntryModal();
    else if (!$("#section-modal").classList.contains("hidden"))
      closeSectionModal();
    else if (!$("#bookmark-modal").classList.contains("hidden"))
      closeBookmarkModal();
  });
  window.addEventListener("beforeunload", save);

  // ---------------- render all / init ----------------
  function renderAll() {
    renderProgress();
    renderCounts();
    renderBookmarks();
    renderSections();
    renderMemos();
    renderTodos();
  }
  (function init() {
    var t = "light";
    try {
      t = localStorage.getItem(THEME_KEY) || "light";
    } catch (e) {}
    applyTheme(t);
    state = loadState();
    save();
    var tab = "lit";
    try {
      tab = localStorage.getItem(TAB_KEY) || "lit";
    } catch (e) {}
    if (["lit", "memo", "todo"].indexOf(tab) < 0) tab = "lit";
    applyTab(tab);
    renderAll();
  })();
})();
