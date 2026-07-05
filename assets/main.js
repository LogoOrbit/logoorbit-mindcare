// MindCare Services® — shared interactions
(function () {
  var nav = document.getElementById('navbar');
  var progressBar = document.getElementById('scrollProgress');
  window.addEventListener('scroll', function () {
    if (nav) nav.classList.toggle('scrolled', window.scrollY > 20);
    if (progressBar) {
      var h = document.documentElement;
      var scrolled = h.scrollTop / (h.scrollHeight - h.clientHeight);
      progressBar.style.width = Math.min(scrolled * 100, 100) + '%';
    }
  }, { passive: true });

  // Mobile menu
  var menuOpen = false;
  window.toggleMenu = function () {
    menuOpen = !menuOpen;
    var menu = document.getElementById('mobileMenu');
    var spans = document.querySelectorAll('.hamburger span');
    var burger = document.querySelector('.hamburger');
    if (burger) burger.setAttribute('aria-expanded', menuOpen);
    if (!menu) return;
    if (menuOpen) {
      menu.classList.add('open');
      document.body.style.overflow = 'hidden';
      if (spans[0]) { spans[0].style.transform = 'rotate(45deg) translate(5px, 5px)'; spans[1].style.opacity = '0'; spans[2].style.transform = 'rotate(-45deg) translate(5px, -5px)'; }
    } else {
      menu.classList.remove('open');
      document.body.style.overflow = '';
      spans.forEach(function (s) { s.style.transform = ''; s.style.opacity = ''; });
    }
  };
  document.querySelectorAll('.mobile-menu a').forEach(function (link) {
    link.addEventListener('click', function () { if (menuOpen) window.toggleMenu(); });
  });

  // FAQ accordion
  document.querySelectorAll('.faq-item').forEach(function (item) {
    var btn = item.querySelector('.faq-q');
    var ans = item.querySelector('.faq-a');
    if (!btn || !ans) return;
    btn.addEventListener('click', function () {
      var isOpen = item.classList.toggle('open');
      btn.setAttribute('aria-expanded', isOpen);
      ans.style.maxHeight = isOpen ? ans.scrollHeight + 'px' : null;
    });
  });

  // Fade-up on scroll
  if ('IntersectionObserver' in window) {
    var obs = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry, i) {
        if (entry.isIntersecting) {
          setTimeout(function () { entry.target.classList.add('visible'); }, i * 60);
          obs.unobserve(entry.target);
        }
      });
    }, { threshold: 0.08 });
    document.querySelectorAll('.fade-up').forEach(function (el) { obs.observe(el); });
  } else {
    document.querySelectorAll('.fade-up').forEach(function (el) { el.classList.add('visible'); });
  }
})();
