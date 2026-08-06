(function () {
  "use strict";
  var PER_PAGE = 5;
  var form = document.getElementById("searchForm");
  var input = document.getElementById("searchInput");
  var resultsEl = document.getElementById("searchResults");
  var metaEl = document.getElementById("searchMeta");
  var pagerEl = document.getElementById("searchPagination");
  if (!form || !input || !resultsEl) return;

  var INDEX = null;
  var indexPromise = fetch("assets/search-index.json")
    .then(function (r) { return r.json(); })
    .then(function (data) { INDEX = data; return data; })
    .catch(function () { INDEX = []; return []; });

  function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }

  function score(entry, terms) {
    var title = entry.title.toLowerCase();
    var desc = (entry.desc || "").toLowerCase();
    var s = 0;
    terms.forEach(function (t) {
      if (!t) return;
      if (title.indexOf(t) !== -1) s += title.indexOf(t) === 0 ? 6 : 3;
      if (desc.indexOf(t) !== -1) s += 1;
    });
    return s;
  }

  function search(query) {
    var terms = query.toLowerCase().trim().split(/\s+/).filter(Boolean);
    if (!terms.length || !INDEX) return [];
    return INDEX
      .map(function (e) { return { entry: e, s: score(e, terms) }; })
      .filter(function (r) { return r.s > 0; })
      .sort(function (a, b) { return b.s - a.s; })
      .map(function (r) { return r.entry; });
  }

  function prettyUrl(url) {
    return url.replace(/^https?:\/\//, "");
  }

  var BROWSE = [
    { t: "All Services", d: "Therapy, counseling and rehabilitation care under one roof.", h: "services/index.html" },
    { t: "Our Team", d: "Meet the psychologists and therapists at MindCare.", h: "team/index.html" },
    { t: "Anxiety Therapy in Karachi", d: "Treatment for anxiety, worry and panic.", h: "anxiety-therapy-karachi.html" },
    { t: "Depression Treatment", d: "Evidence-based support for low mood and depression.", h: "depression-treatment-karachi.html" },
    { t: "Child Psychologist", d: "Assessment and therapy for children and teens.", h: "child-psychologist-karachi.html" },
    { t: "Workshops", d: "Live online sessions and masterclasses.", h: "workshops.html" },
    { t: "Book a Free Consultation", d: "Talk to us about what you need, no cost.", h: "contact.html" }
  ];

  function browseHtml(heading) {
    return '<div class="search-browse"><h2>' + heading + "</h2>" +
      BROWSE.map(function (b) {
        return '<a class="sb-item" href="' + b.h + '"><span class="sb-t">' + b.t +
          '</span><span class="sb-d">' + b.d + "</span></a>";
      }).join("") + "</div>";
  }

  function render(query, results, page) {
    var total = results.length;
    var pages = Math.max(1, Math.ceil(total / PER_PAGE));
    page = Math.min(Math.max(1, page), pages);
    var start = (page - 1) * PER_PAGE;
    var slice = results.slice(start, start + PER_PAGE);

    metaEl.textContent = query
      ? (total ? "About " + total + " result" + (total === 1 ? "" : "s") + " for “" + query + "”" : "No results for “" + query + "”")
      : "";

    resultsEl.innerHTML = slice
      .map(function (e) {
        return (
          '<article class="search-result">' +
          '<p class="sr-url">' + escapeHtml(prettyUrl(e.url)) + "</p>" +
          '<h3><a href="' + escapeHtml(e.path) + '">' + escapeHtml(e.title) + "</a></h3>" +
          "<p>" + escapeHtml(e.desc || "") + "</p>" +
          "</article>"
        );
      })
      .join("");

    if (!query) {
      resultsEl.innerHTML = browseHtml("Popular pages");
    } else if (!total) {
      resultsEl.innerHTML =
        '<p class="search-empty">Nothing matched “' + escapeHtml(query) + '”. Try a broader word like ' +
        '“anxiety”, “therapy” or “children”.</p>' + browseHtml("Or browse these");
    }

    pagerEl.innerHTML = "";
    if (query && pages > 1) {
      var frag = document.createDocumentFragment();
      var prev = document.createElement("button");
      prev.type = "button";
      prev.textContent = "‹ Prev";
      prev.disabled = page === 1;
      prev.addEventListener("click", function () { goToPage(query, page - 1); });
      frag.appendChild(prev);

      for (var i = 1; i <= pages; i++) {
        (function (p) {
          var btn = document.createElement("button");
          btn.type = "button";
          btn.textContent = String(p);
          if (p === page) btn.className = "active";
          btn.addEventListener("click", function () { goToPage(query, p); });
          frag.appendChild(btn);
        })(i);
      }

      var next = document.createElement("button");
      next.type = "button";
      next.textContent = "Next ›";
      next.disabled = page === pages;
      next.addEventListener("click", function () { goToPage(query, page + 1); });
      frag.appendChild(next);

      pagerEl.appendChild(frag);
    }
  }

  function goToPage(query, page) {
    var url = new URL(window.location.href);
    url.searchParams.set("q", query);
    if (page > 1) url.searchParams.set("page", page);
    else url.searchParams.delete("page");
    history.replaceState(null, "", url);
    indexPromise.then(function () {
      render(query, search(query), page);
      window.scrollTo({ top: resultsEl.offsetTop - 100, behavior: "smooth" });
    });
  }

  function runFromUrl() {
    var url = new URL(window.location.href);
    var q = url.searchParams.get("q") || "";
    var page = parseInt(url.searchParams.get("page"), 10) || 1;
    input.value = q;
    indexPromise.then(function () { render(q, search(q), page); });
  }

  form.addEventListener("submit", function (e) {
    e.preventDefault();
    goToPage(input.value.trim(), 1);
  });

  runFromUrl();
})();
