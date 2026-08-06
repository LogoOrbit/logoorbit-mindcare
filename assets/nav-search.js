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

  /* ---- overlay markup ---- */
  var overlay = document.createElement("div");
  overlay.className = "ns-overlay";
  overlay.setAttribute("role", "dialog");
  overlay.setAttribute("aria-modal", "true");
  overlay.setAttribute("aria-label", "Search this site");
  overlay.innerHTML =
    '<div class="ns-panel">' +
      '<form class="ns-form" role="search">' +
        '<svg class="ns-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="11" cy="11" r="7"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>' +
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
