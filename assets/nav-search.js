/* Live site search from the nav icon, on every page.
   The icon's href tells us how deep we are ("search.html" vs "../search.html"),
   so the same script works from the root, /services/, /team/ and /articles/. */
(function () {
  "use strict";

  var trigger = document.querySelector('.nav-tools a.icon-btn[href$="search.html"]');
  if (!trigger) return;

  var PREFIX = trigger.getAttribute("href").replace(/search\.html$/, "");
  var MAX = 7;
  var INDEX = null;
  var loading = null;

  function loadIndex() {
    if (loading) return loading;
    loading = fetch(PREFIX + "assets/search-index.json")
      .then(function (r) { return r.json(); })
      .then(function (d) { INDEX = d; return d; })
      .catch(function () { INDEX = []; return []; });
    return loading;
  }

  function esc(s) {
    return String(s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }

  function score(e, terms) {
    var t = e.title.toLowerCase(), d = (e.desc || "").toLowerCase(), s = 0;
    terms.forEach(function (q) {
      if (!q) return;
      if (t.indexOf(q) !== -1) s += t.indexOf(q) === 0 ? 6 : 3;
      if (d.indexOf(q) !== -1) s += 1;
    });
    return s;
  }

  function search(q) {
    var terms = q.toLowerCase().trim().split(/\s+/).filter(Boolean);
    if (!terms.length || !INDEX) return [];
    return INDEX.map(function (e) { return { e: e, s: score(e, terms) }; })
      .filter(function (r) { return r.s > 0; })
      .sort(function (a, b) { return b.s - a.s; })
      .map(function (r) { return r.e; });
  }

  /* ---- styles ----
     Injected here rather than living in styles.css: index.html and
     contact.html carry their own inline CSS and never load styles.css,
     so an external rule would leave the overlay completely unstyled.
     Those pages also name their tokens --ink/--muted where the shared
     sheet uses --dark/--gray, hence the layered var() fallbacks. */
  var TXT = "var(--dark, var(--ink, #1b2822))";
  var DIM = "var(--gray, var(--muted, #44544b))";
  var CARD = "var(--card, #fff)";
  var LINE = "var(--border, rgba(128,128,128,.25))";
  var css = document.createElement("style");
  css.textContent = [
    ".ns-overlay{position:fixed;inset:0;z-index:5000;background:rgba(10,20,16,.55);",
    "-webkit-backdrop-filter:blur(4px);backdrop-filter:blur(4px);display:none;",
    "align-items:flex-start;justify-content:center;padding:12vh 20px 20px}",
    ".ns-overlay.is-open{display:flex}",
    ".ns-panel{width:100%;max-width:620px;background:" + CARD + ";border:1px solid " + LINE + ";",
    "border-radius:16px;box-shadow:0 24px 60px rgba(0,0,0,.28);overflow:hidden;",
    "font-family:'DM Sans',system-ui,sans-serif}",
    ".ns-form{display:flex;align-items:center;gap:10px;padding:14px 16px;border-bottom:1px solid " + LINE + "}",
    ".ns-icon{width:20px !important;height:20px !important;flex:0 0 20px;color:var(--teal,#0f9aa8)}",
    ".ns-input{flex:1;min-width:0;border:0;background:none;color:" + TXT + ";",
    "font-family:inherit;font-size:1.02rem;line-height:1.4;outline:none}",
    ".ns-input::placeholder{color:" + DIM + ";opacity:1}",
    ".ns-close{border:1px solid " + LINE + ";background:none;color:" + DIM + ";font-family:inherit;",
    "font-size:.72rem;padding:4px 9px;border-radius:6px;cursor:pointer;flex:none}",
    ".ns-close:hover{color:var(--teal-dark,#12808d);border-color:var(--teal,#0f9aa8)}",
    ".ns-results{max-height:60vh;overflow-y:auto;padding:8px}",
    ".ns-hint{color:" + DIM + ";font-size:.9rem;padding:18px 10px;margin:0}",
    ".ns-item{display:block;padding:10px 12px;border-radius:10px;text-decoration:none}",
    ".ns-item:hover,.ns-item.is-active{background:var(--teal-light,#e8f9fb)}",
    ".ns-t{display:block;color:" + TXT + ";font-weight:600;font-size:.95rem;line-height:1.35}",
    ".ns-item:hover .ns-t,.ns-item.is-active .ns-t{color:var(--teal-dark,#12808d)}",
    ".ns-d{display:block;color:" + DIM + ";font-size:.82rem;line-height:1.45;margin-top:2px}",
    ".ns-all{display:block;padding:11px 12px;margin-top:4px;border-top:1px solid " + LINE + ";",
    "color:var(--teal-dark,#12808d);font-size:.86rem;font-weight:600;text-decoration:none}",
    ".ns-all:hover{background:var(--teal-light,#e8f9fb)}",
    "@media (max-width:560px){.ns-overlay{padding:8vh 12px 12px}.ns-close{display:none}}"
  ].join("");
  document.head.appendChild(css);

  /* ---- overlay markup ---- */
  var overlay = document.createElement("div");
  overlay.className = "ns-overlay";
  overlay.setAttribute("role", "dialog");
  overlay.setAttribute("aria-modal", "true");
  overlay.setAttribute("aria-label", "Search this site");
  overlay.innerHTML =
    '<div class="ns-panel">' +
      '<form class="ns-form" role="search">' +
        '<svg class="ns-icon" width="20" height="20" viewBox="0 0 24 24" style="width:20px;height:20px;flex:none" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="11" cy="11" r="7"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>' +
        '<input type="search" class="ns-input" autocomplete="off" placeholder="Search services, team, articles…" aria-label="Search">' +
        '<button type="button" class="ns-close" aria-label="Close search">Esc</button>' +
      '</form>' +
      '<div class="ns-results" role="listbox"></div>' +
    '</div>';
  document.body.appendChild(overlay);

  var panel = overlay.querySelector(".ns-panel");
  var form = overlay.querySelector(".ns-form");
  var input = overlay.querySelector(".ns-input");
  var list = overlay.querySelector(".ns-results");
  var closeBtn = overlay.querySelector(".ns-close");
  var active = -1;
  var current = [];

  function render(q) {
    var results = search(q).slice(0, MAX);
    current = results;
    active = -1;
    if (!q.trim()) {
      list.innerHTML = '<p class="ns-hint">Type to search across services, team, articles and workshops.</p>';
      return;
    }
    if (!results.length) {
      list.innerHTML = '<p class="ns-hint">No matches for “' + esc(q) + '”.</p>';
      return;
    }
    list.innerHTML = results.map(function (e, i) {
      return '<a class="ns-item" role="option" data-i="' + i + '" href="' + esc(PREFIX + e.path) + '">' +
        '<span class="ns-t">' + esc(e.title.split("|")[0].trim()) + "</span>" +
        '<span class="ns-d">' + esc((e.desc || "").slice(0, 95)) + "…</span>" +
        "</a>";
    }).join("") +
      '<a class="ns-all" href="' + esc(PREFIX + "search.html") + "?q=" + encodeURIComponent(q) + '">See all results for “' + esc(q) + '” →</a>';
  }

  function setActive(n) {
    var items = list.querySelectorAll(".ns-item");
    if (!items.length) return;
    if (active >= 0 && items[active]) items[active].classList.remove("is-active");
    active = (n + items.length) % items.length;
    items[active].classList.add("is-active");
    items[active].scrollIntoView({ block: "nearest" });
  }

  function open(e) {
    if (e) e.preventDefault();
    overlay.classList.add("is-open");
    document.body.style.overflow = "hidden";
    loadIndex().then(function () { render(input.value); });
    render(input.value);
    setTimeout(function () { input.focus(); }, 30);
  }

  function close() {
    overlay.classList.remove("is-open");
    document.body.style.overflow = "";
    trigger.focus();
  }

  trigger.addEventListener("click", open);
  closeBtn.addEventListener("click", close);
  overlay.addEventListener("mousedown", function (e) {
    if (!panel.contains(e.target)) close();
  });

  var timer;
  input.addEventListener("input", function () {
    clearTimeout(timer);
    var v = input.value;
    timer = setTimeout(function () { loadIndex().then(function () { render(v); }); }, 80);
  });

  form.addEventListener("submit", function (e) {
    e.preventDefault();
    var items = list.querySelectorAll(".ns-item");
    if (active >= 0 && items[active]) { window.location.href = items[active].href; return; }
    var q = input.value.trim();
    if (q) window.location.href = PREFIX + "search.html?q=" + encodeURIComponent(q);
  });

  input.addEventListener("keydown", function (e) {
    if (e.key === "ArrowDown") { e.preventDefault(); setActive(active + 1); }
    else if (e.key === "ArrowUp") { e.preventDefault(); setActive(active - 1); }
    else if (e.key === "Escape") { close(); }
  });

  document.addEventListener("keydown", function (e) {
    if (overlay.classList.contains("is-open")) return;
    var tag = (e.target.tagName || "").toLowerCase();
    if (tag === "input" || tag === "textarea" || e.target.isContentEditable) return;
    if (e.key === "/" || ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k")) open(e);
  });
})();
