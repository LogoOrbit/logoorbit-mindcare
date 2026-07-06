// MindCare Services® — shared interactions (interior & landing pages)
(function () {
  var doc = document.documentElement;
  var nav = document.getElementById('navbar');
  var progressBar = document.getElementById('scrollProgress');

  window.addEventListener('scroll', function () {
    if (nav) nav.classList.toggle('scrolled', window.scrollY > 20);
    if (progressBar) {
      var h = document.documentElement;
      progressBar.style.width = Math.min((h.scrollTop / (h.scrollHeight - h.clientHeight || 1)) * 100, 100) + '%';
    }
  }, { passive: true });

  // ---------- Mobile menu ----------
  var menuOpen = false;
  window.toggleMenu = function () {
    menuOpen = !menuOpen;
    var menu = document.getElementById('mobileMenu');
    var spans = document.querySelectorAll('.hamburger span');
    var burger = document.querySelector('.hamburger');
    if (burger) burger.setAttribute('aria-expanded', menuOpen);
    if (!menu) return;
    if (menuOpen) {
      menu.classList.add('open'); document.body.style.overflow = 'hidden';
      if (spans[0]) { spans[0].style.transform = 'rotate(45deg) translate(5px, 5px)'; spans[1].style.opacity = '0'; spans[2].style.transform = 'rotate(-45deg) translate(5px, -5px)'; }
    } else {
      menu.classList.remove('open'); document.body.style.overflow = '';
      spans.forEach(function (s) { s.style.transform = ''; s.style.opacity = ''; });
    }
  };
  document.querySelectorAll('.mobile-menu a').forEach(function (link) {
    link.addEventListener('click', function () { if (menuOpen) window.toggleMenu(); });
  });

  // ---------- FAQ ----------
  document.querySelectorAll('.faq-item').forEach(function (item) {
    var btn = item.querySelector('.faq-q'), ans = item.querySelector('.faq-a');
    if (!btn || !ans) return;
    btn.addEventListener('click', function () {
      var isOpen = item.classList.toggle('open');
      btn.setAttribute('aria-expanded', isOpen);
      ans.style.maxHeight = isOpen ? ans.scrollHeight + 'px' : null;
    });
  });

  // ---------- Fade-up ----------
  if ('IntersectionObserver' in window) {
    var obs = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry, i) {
        if (entry.isIntersecting) { setTimeout(function () { entry.target.classList.add('visible'); }, i * 60); obs.unobserve(entry.target); }
      });
    }, { threshold: 0.08 });
    document.querySelectorAll('.fade-up').forEach(function (el) { obs.observe(el); });
  } else {
    document.querySelectorAll('.fade-up').forEach(function (el) { el.classList.add('visible'); });
  }

  // ---------- Theme toggle ----------
  function setTheme(t) {
    doc.setAttribute('data-theme', t);
    try { localStorage.setItem('mc-theme', t); } catch (e) {}
    var m = document.querySelector('meta[name="theme-color"]:not([media])') || document.querySelector('meta[name="theme-color"]');
    if (m) m.setAttribute('content', t === 'dark' ? '#0e1b13' : '#f2f6f3');
  }
  var themeBtn = document.getElementById('themeBtn');
  if (themeBtn) themeBtn.addEventListener('click', function () {
    setTheme(doc.getAttribute('data-theme') === 'dark' ? 'light' : 'dark');
  });

  // ---------- Language (common UI: nav, footer, breadcrumb, buttons) ----------
  var UR = {
    "Home":"ہوم","Services":"خدمات","Team":"ٹیم","About":"ہمارے بارے میں","Contact":"رابطہ",
    "Book Consultation":"اپائنٹمنٹ","Book a Consultation":"مشورہ بُک کریں","Book Free Consultation":"مفت مشورہ بُک کریں",
    "Book a Free Consultation":"مفت مشورہ بُک کریں","Book Appointment":"اپائنٹمنٹ",
    "FAQ":"سوالات","All Services":"تمام خدمات","About Us":"ہمارے بارے میں","Our Team":"ہماری ٹیم",
    "Help & Guides":"مدد و رہنمائی","Meet the Team":"ہماری ٹیم سے ملیں","Read her profile":"پروفائل دیکھیں",
    "Back to Main":"مرکزی صفحہ","← Back to Main":"مرکزی صفحہ »",
    "Psychotherapy":"سائیکو تھراپی","Family Counseling":"فیملی کاؤنسلنگ","Speech Therapy":"اسپیچ تھراپی",
    "Physiotherapy":"فزیو تھراپی","Behavioral Therapy":"رویّہ جاتی تھراپی"
  };
  var SEL = '.nav-links a, .mobile-menu a, footer a, .breadcrumb li, .breadcrumb a, .btn-primary, .btn-secondary, .nav-cta, .m-cta';
  function tText(el, lang) {
    // translate only the direct text (skip if it contains child elements like icons)
    var hasEl = false, i;
    for (i = 0; i < el.childNodes.length; i++) { if (el.childNodes[i].nodeType === 1) { hasEl = true; break; } }
    if (hasEl) {
      for (i = 0; i < el.childNodes.length; i++) {
        var n = el.childNodes[i];
        if (n.nodeType === 3 && n.textContent.trim()) {
          var k = n.textContent.trim();
          if (!n.__en) n.__en = k;
          n.textContent = (lang === 'ur' && UR[n.__en]) ? (' ' + UR[n.__en] + ' ') : (' ' + n.__en + ' ');
        }
      }
      return;
    }
    var orig = el.getAttribute('data-en');
    if (orig == null) { orig = el.textContent.trim(); el.setAttribute('data-en', orig); }
    el.textContent = (lang === 'ur' && UR[orig]) ? UR[orig] : orig;
  }
  function applyLang(lang) {
    document.querySelectorAll(SEL).forEach(function (el) { tText(el, lang); });
    doc.setAttribute('lang', lang);
    doc.setAttribute('dir', lang === 'ur' ? 'rtl' : 'ltr');
    var lb = document.getElementById('langBtn');
    if (lb) lb.textContent = lang === 'ur' ? 'EN' : 'اردو';
    try { localStorage.setItem('mc-lang', lang); } catch (e) {}
  }
  applyLang(doc.getAttribute('lang') === 'ur' ? 'ur' : 'en');
  var langBtn = document.getElementById('langBtn');
  if (langBtn) langBtn.addEventListener('click', function () {
    applyLang(doc.getAttribute('lang') === 'ur' ? 'en' : 'ur');
  });
})();
