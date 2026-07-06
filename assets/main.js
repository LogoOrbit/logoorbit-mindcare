// MindCare Services® — shared interactions (interior & landing pages)
(function () {
  var doc = document.documentElement;
  var nav = document.getElementById('navbar');
  var progressBar = document.getElementById('scrollProgress');
  var reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;

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

  // ---------- Theme toggle ----------
  function setTheme(t) {
    doc.setAttribute('data-theme', t);
    try { localStorage.setItem('mc-theme', t); } catch (e) {}
    var m = document.querySelector('meta[name="theme-color"]:not([media])') || document.querySelector('meta[name="theme-color"]');
    if (m) m.setAttribute('content', t === 'dark' ? '#0e1b13' : '#e9ebe6');
  }
  var themeBtn = document.getElementById('themeBtn');
  if (themeBtn) themeBtn.addEventListener('click', function () {
    setTheme(doc.getAttribute('data-theme') === 'dark' ? 'light' : 'dark');
  });

  // ======================================================================
  //  URDU TRANSLATION (whole-page, exact text-node match)
  // ======================================================================
  var UR = {
    // --- nav / common ---
    "Home":"ہوم","Services":"خدمات","Team":"ٹیم","About":"ہمارے بارے میں","Contact":"رابطہ",
    "Book Consultation":"اپائنٹمنٹ","Book a Consultation":"مشورہ بُک کریں","Book Free Consultation":"مفت مشورہ بُک کریں",
    "Book a Free Consultation":"مفت مشورہ بُک کریں","Book Appointment":"اپائنٹمنٹ","Book Free Consultation »":"مفت مشورہ بُک کریں",
    "FAQ":"سوالات","All Services":"تمام خدمات","About Us":"ہمارے بارے میں","Our Team":"ہماری ٹیم",
    "Company":"ادارہ","Help & Guides":"مدد و رہنمائی","Meet the Team":"ہماری ٹیم سے ملیں",
    "Read her profile":"پروفائل دیکھیں","View profile →":"پروفائل دیکھیں ←","Learn more →":"مزید جانیں ←",
    "Back to Main":"مرکزی صفحہ","← Back to Main":"مرکزی صفحہ »","Chat on WhatsApp":"واٹس ایپ پر بات کریں",
    "WhatsApp Us":"واٹس ایپ کریں","Skip to main content":"مرکزی مواد پر جائیں",
    "A multidisciplinary team":"ایک کثیر الشعبہ ٹیم",
    // --- footer ---
    "A psychotherapy and mental health firm in Karachi, Pakistan, making evidence-based support accessible for all.":"کراچی، پاکستان میں نفسیاتی و ذہنی صحت کا ادارہ، جو ثبوت پر مبنی مدد سب کے لیے قابلِ رسائی بناتا ہے۔",
    "Keeping Your Peace ®":"آپ کا سکون، ہماری ذمہ داری ®",
    "© 2026 MindCare Services®. All rights reserved.":"© 2026 مائنڈ کیئر سروسز®۔ جملہ حقوق محفوظ ہیں۔",
    "Keeping Your Peace · Karachi, Pakistan":"آپ کا سکون · کراچی، پاکستان",
    "Karachi, Pakistan":"کراچی، پاکستان",
    // --- service names ---
    "Individual Psychotherapy":"انفرادی سائیکو تھراپی","Psychotherapy":"سائیکو تھراپی",
    "Family & Relationship Counseling":"خاندانی و تعلقاتی کاؤنسلنگ","Family Counseling":"فیملی کاؤنسلنگ",
    "Speech Therapy":"اسپیچ تھراپی","Physiotherapy":"فزیو تھراپی","Occupational Therapy":"آکوپیشنل تھراپی",
    "Behavioral Therapy":"رویّہ جاتی تھراپی","Remedial Home Sessions":"گھر پر علاجی سیشن",
    "Diagnostic Assessments":"تشخیصی جائزے","Dental Consultations":"ڈینٹل مشورے",
    "Awareness Sessions & Trainings":"آگہی سیشنز و تربیت",
    // --- services index ---
    "Comprehensive care for":"جامع دیکھ بھال برائے","mind & body":"دماغ و جسم",
    "10 services · One caring team":"10 خدمات · ایک مخلص ٹیم",
    "A holistic range of therapy and clinical services — all under one roof in Karachi, delivered by experienced professionals. Choose a service to learn more.":"تھراپی اور طبی خدمات کا ہمہ گیر سلسلہ — سب کراچی میں ایک ہی چھت تلے، تجربہ کار ماہرین کے ذریعے۔ مزید جاننے کے لیے کوئی خدمت منتخب کریں۔",
    "Confidential, one-on-one talk therapy for adults and adolescents — using proven methods like CBT to work through anxiety…":"بالغوں اور نوجوانوں کے لیے خفیہ، انفرادی گفتگو پر مبنی تھراپی — پریشانی سے نمٹنے کے لیے سی بی ٹی جیسے مستند طریقے…",
    "Guided sessions that help families and couples rebuild communication, resolve recurring conflict, and navigate big life …":"رہنمائی پر مبنی سیشن جو خاندانوں اور جوڑوں کو دوبارہ رابطہ بحال کرنے، جھگڑے سلجھانے اور زندگی کے بڑے مراحل سے گزرنے میں مدد دیتے ہیں…",
    "Expert support for communication — from children's language delays and articulation to adult fluency and speech recovery…":"رابطے کے لیے ماہرانہ مدد — بچوں کی زبان میں تاخیر اور تلفظ سے لے کر بالغوں کی روانی اور گفتار کی بحالی تک…",
    "Rehabilitation, pain management and mobility improvement — assessed and treated by experienced physiotherapists who help…":"بحالی، درد کا انتظام اور نقل و حرکت میں بہتری — تجربہ کار فزیو تھراپسٹ کی تشخیص اور علاج کے ساتھ…",
    "Helping individuals of all ages regain independence in the daily activities that matter most — from a child's fine-motor…":"ہر عمر کے افراد کو روزمرہ کے اہم کاموں میں خودمختاری دوبارہ حاصل کرنے میں مدد — بچے کی باریک حرکات سے لے کر…",
    "Structured, evidence-based interventions for autism spectrum support, ADHD and social-skills development — building posi…":"آٹزم، اے ڈی ایچ ڈی اور سماجی مہارتوں کی نشوونما کے لیے منظم، ثبوت پر مبنی اقدامات — مثبت…",
    "Specialized, one-on-one therapy for individuals with special needs — delivered in the comfort and familiarity of your ow…":"خصوصی ضروریات والے افراد کے لیے مخصوص، انفرادی تھراپی — آپ کے اپنے گھر کے پُرسکون ماحول میں…",
    "Cognitive and psychological evaluations that bring clarity — guiding accurate diagnosis and a personalized, effective tr…":"ذہنی اور نفسیاتی جائزے جو وضاحت لاتے ہیں — درست تشخیص اور مؤثر، ذاتی نوعیت کے علاج کی رہنمائی…",
    "Expert advice on oral health, treatment planning and preventive care — from a qualified dental consultant, as part of Mi…":"دانتوں کی صحت، علاج کی منصوبہ بندی اور احتیاطی نگہداشت پر ماہرانہ مشورہ — ایک ماہر ڈینٹل کنسلٹنٹ کی جانب سے…",
    "Certified mental health workshops for workplaces, schools and institutions — designed to reduce stigma, build resilience…":"دفاتر، اسکولوں اور اداروں کے لیے مستند ذہنی صحت ورکشاپس — بدنامی کم کرنے اور حوصلہ بڑھانے کے لیے…",
    "Not sure which service fits?":"یقین نہیں کون سی خدمت مناسب ہے؟",
    "Tell us what's going on and we'll guide you to the right support — free and confidential.":"ہمیں بتائیں کیا مسئلہ ہے، ہم آپ کو صحیح مدد کی طرف رہنمائی کریں گے — مفت اور خفیہ۔",
    // --- team index ---
    "Meet the people behind":"ملیں اُن ماہرین سے جو ہیں","your care":"آپ کی دیکھ بھال کے پیچھے",
    "A dedicated group of specialists united by one mission: compassionate, professional, impactful care. Get to know each of them.":"ماہرین کا ایک پُرعزم گروہ، ایک مشن پر متحد: ہمدرد، پیشہ ورانہ اور مؤثر دیکھ بھال۔ ہر ایک کو جانیں۔",
    "Want to work with one of our specialists?":"ہمارے کسی ماہر کے ساتھ کام کرنا چاہتے ہیں؟",
    "Book a free, confidential consultation and we'll match you with the right person.":"ایک مفت، خفیہ مشورہ بُک کریں اور ہم آپ کو صحیح ماہر سے ملا دیں گے۔",
    // roles
    "Founder & Lead Psychotherapist":"بانی و لیڈ سائیکو تھراپسٹ","Team Coordinator":"ٹیم کوآرڈینیٹر",
    "Psychologist":"ماہرِ نفسیات","Physiotherapist":"فزیو تھراپسٹ","Consultant Physiotherapist":"کنسلٹنٹ فزیو تھراپسٹ",
    "Dental Consultant":"ڈینٹل کنسلٹنٹ",
    // --- about ---
    "Founded by Shaista Tariq · PPA Member":"بانی: شائستہ طارق · پی پی اے ممبر",
    "Real support, from people who":"حقیقی مدد، اُن لوگوں سے جو","actually listen":"واقعی سنتے ہیں",
    "MindCare Services® is a mental health and rehabilitation clinic in Karachi. We bring therapy, counseling and rehab care together under one warm, judgment-free roof — in clinic, at your home, or online.":"مائنڈ کیئر سروسز® کراچی میں ذہنی صحت اور بحالی کا کلینک ہے۔ ہم تھراپی، کاؤنسلنگ اور بحالی کی خدمات کو ایک پُرسکون، بغیر تنقید ماحول میں یکجا کرتے ہیں — کلینک میں، آپ کے گھر پر، یا آن لائن۔",
    "Our Story":"ہماری کہانی","Why we started MindCare":"ہم نے مائنڈ کیئر کیوں شروع کیا",
    "In Karachi, asking for help still feels harder than it should. Long waits, cold clinics, and the quiet worry of being judged keep too many people from getting support they need.":"کراچی میں مدد مانگنا آج بھی ضرورت سے زیادہ مشکل لگتا ہے۔ لمبے انتظار، سرد کلینک، اور تنقید کا خاموش خوف بہت سے لوگوں کو ضروری مدد سے دور رکھتے ہیں۔",
    "MindCare was built to change that. We keep things human: one caring team, honest conversations, and care plans you actually understand. Whether it's the mind or the body, you're met with patience — never a script.":"مائنڈ کیئر اسی کو بدلنے کے لیے بنایا گیا۔ ہم چیزیں انسانی رکھتے ہیں: ایک مخلص ٹیم، دیانتدار گفتگو، اور ایسے علاجی منصوبے جو آپ واقعی سمجھ سکیں۔ چاہے معاملہ دماغ کا ہو یا جسم کا، آپ کو صبر ملے گا — کوئی رٹا رٹایا انداز نہیں۔",
    "What makes us different":"ہمیں کیا مختلف بناتا ہے",
    "One team for mind and body — therapy, counseling and rehab in one place.":"دماغ اور جسم کے لیے ایک ہی ٹیم — تھراپی، کاؤنسلنگ اور بحالی، سب ایک جگہ۔",
    "Come to us, or we come to you — clinic, home visits and online sessions.":"آپ ہمارے پاس آئیں، یا ہم آپ کے پاس — کلینک، گھر پر آمد اور آن لائن سیشن۔",
    "Evidence-based, never one-size-fits-all.":"ثبوت پر مبنی، ہر ایک کے لیے ایک جیسا نہیں۔",
    "Private and confidential, always.":"ہمیشہ نجی اور خفیہ۔",
    "A PPA Member and mental health educator, Shaista leads every care plan personally and set MindCare's warm, no-judgment tone.":"پی پی اے ممبر اور ذہنی صحت کی معلمہ، شائستہ ہر علاجی منصوبے کی خود نگرانی کرتی ہیں اور مائنڈ کیئر کے پُرخلوص، بلا تنقید انداز کی بنیاد رکھی۔",
    "What we stand for":"ہمارے اصول","Care, the way it should feel":"دیکھ بھال، جیسی ہونی چاہیے",
    "Four simple promises that shape every session.":"چار سادہ وعدے جو ہر سیشن کی بنیاد ہیں۔",
    "Warmth first":"پہلے اپنائیت","You're a person, not a case file. We listen before we advise.":"آپ ایک انسان ہیں، کوئی فائل نہیں۔ ہم مشورہ دینے سے پہلے سنتے ہیں۔",
    "Private & safe":"نجی اور محفوظ","What you share stays between us. Every time.":"آپ کی بات ہمارے درمیان رہتی ہے۔ ہر بار۔",
    "Evidence-based":"ثبوت پر مبنی","Real methods that work — explained in plain language.":"کارآمد اور مستند طریقے — آسان زبان میں سمجھائے گئے۔",
    "Care that reaches you":"آپ تک پہنچنے والی دیکھ بھال","Clinic, home visit or online — whatever fits your life.":"کلینک، گھر پر آمد یا آن لائن — جو آپ کی زندگی کے مطابق ہو۔",
    "Services for mind & body":"دماغ و جسم کی خدمات","Specialists on the team":"ٹیم کے ماہرین",
    "6 days":"6 دن","Open Monday–Saturday":"پیر تا ہفتہ کھلا","Confidential care":"خفیہ دیکھ بھال",
    "Ready when you are.":"جب آپ تیار ہوں۔",
    "A free, confidential consultation is the easiest way to begin. No pressure, no judgment.":"ایک مفت، خفیہ مشورہ شروعات کا آسان ترین طریقہ ہے۔ کوئی دباؤ نہیں، کوئی تنقید نہیں۔",
    // --- contact ---
    "Book a Consultation":"مشورہ بُک کریں",
    "Take the first step. We'll listen, guide, and support you — no pressure, no judgment, 100% confidential.":"پہلا قدم اٹھائیں۔ ہم سنیں گے، رہنمائی کریں گے اور آپ کا ساتھ دیں گے — کوئی دباؤ نہیں، کوئی تنقید نہیں، 100% خفیہ۔",
    "Get in Touch":"رابطہ کریں","Send a Message":"پیغام بھیجیں",
    "Choose any way that feels comfortable — fill the form, call us, WhatsApp, or email directly. We typically respond within a few hours.":"جو طریقہ آسان لگے اپنائیں — فارم بھریں، کال کریں، واٹس ایپ کریں یا براہِ راست ای میل کریں۔ ہم عموماً چند گھنٹوں میں جواب دیتے ہیں۔",
    "Phone":"فون","Email":"ای میل","Location":"مقام","Website":"ویب سائٹ","Clinic Hours":"کلینک کے اوقات",
    "Mon–Sat · 9am to 7pm":"پیر تا ہفتہ · صبح 9 تا شام 7","Karachi, Sindh, Pakistan":"کراچی، سندھ، پاکستان",
    "Consultation":"مشورہ","Appointment":"اپائنٹمنٹ","General Query":"عام سوال","Message Sent!":"پیغام بھیج دیا گیا!",
    "Full Name *":"پورا نام *","Phone *":"فون *","Email Address":"ای میل ایڈریس","Service Needed":"مطلوبہ خدمت",
    "Tell us a little about what's going on":"تھوڑا بتائیں کہ کیا ہو رہا ہے","Preferred Date":"پسندیدہ تاریخ",
    "Preferred Time":"پسندیدہ وقت","Service / Specialist":"خدمت / ماہر","Notes":"نوٹس",
    "Your Name":"آپ کا نام","Phone / Email":"فون / ای میل","Your Question or Message":"آپ کا سوال یا پیغام",
    // --- service-detail common headings ---
    "What this service helps with":"یہ خدمت کن مسائل میں مدد دیتی ہے","Our approach":"ہمارا طریقہ کار",
    "Quick facts":"مختصر حقائق","What's Included":"کیا شامل ہے","Evidence-Based Methods":"ثبوت پر مبنی طریقے",
    "Total Confidentiality":"مکمل رازداری","Judgment-Free Space":"بلا تنقید ماحول","Flexible Sessions":"لچکدار سیشن",
    "Good to Know":"جاننے کے قابل","Explore More":"مزید دیکھیں","Not sure if this is right for you?":"یقین نہیں کہ یہ آپ کے لیے ٹھیک ہے؟"
  };
  var PH = {
    "Your name":"آپ کا نام","Name":"نام","+92...":"+92...","+92... or email":"+92... یا ای میل","your@email.com":"your@email.com",
    "You don't have to share everything. Just a sentence or two is fine. Everything is confidential.":"سب کچھ بتانا ضروری نہیں۔ ایک دو جملے کافی ہیں۔ سب کچھ خفیہ رہے گا۔",
    "Any additional info for us to know before the appointment...":"اپائنٹمنٹ سے پہلے بتانے کے لیے کوئی اضافی بات...",
    "Ask us anything — about services, team, pricing, or anything else.":"کچھ بھی پوچھیں — خدمات، ٹیم، فیس یا کسی بھی بارے میں۔"
  };
  var textNodes = [];
  if (document.body) {
    var walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, {
      acceptNode: function (n) {
        if (!n.nodeValue || !n.nodeValue.trim()) return NodeFilter.FILTER_REJECT;
        var t = n.parentNode && n.parentNode.nodeName;
        if (t === 'SCRIPT' || t === 'STYLE' || t === 'NOSCRIPT') return NodeFilter.FILTER_REJECT;
        return NodeFilter.FILTER_ACCEPT;
      }
    });
    var node; while ((node = walker.nextNode())) { node.__en = node.nodeValue; textNodes.push(node); }
  }
  var phEls = [].slice.call(document.querySelectorAll('[placeholder]'));
  phEls.forEach(function (e) { e.__ph = e.getAttribute('placeholder'); });

  function applyLang(lang) {
    var ur = lang === 'ur';
    textNodes.forEach(function (n) {
      var key = n.__en.trim();
      if (ur && UR[key] != null) n.nodeValue = n.__en.replace(key, UR[key]);
      else n.nodeValue = n.__en;
    });
    phEls.forEach(function (e) {
      var k = (e.__ph || '').trim();
      e.setAttribute('placeholder', (ur && PH[k]) ? PH[k] : e.__ph);
    });
    doc.setAttribute('lang', lang);
    doc.setAttribute('dir', ur ? 'rtl' : 'ltr');
    var lb = document.getElementById('langBtn');
    if (lb) lb.textContent = ur ? 'EN' : 'اردو';
    try { localStorage.setItem('mc-lang', lang); } catch (e) {}
  }
  applyLang(doc.getAttribute('lang') === 'ur' ? 'ur' : 'en');
  var langBtn = document.getElementById('langBtn');
  if (langBtn) langBtn.addEventListener('click', function () {
    applyLang(doc.getAttribute('lang') === 'ur' ? 'en' : 'ur');
  });

  // ======================================================================
  //  SCROLL ANIMATIONS  (reveal + parallax)
  // ======================================================================
  // auto-tag more elements so the whole page animates in
  if (!reduce) {
    var autoSel = '.page-hero .ph-inner > *, .section-header, .section-header > *, .aside-card, .faq-item, ' +
                  '.cta-band-inner > *, .detail-art, .profile-head, .tag-row, .detail-body h2, .detail-body p, .detail-body ul';
    document.querySelectorAll(autoSel).forEach(function (el) { el.classList.add('fade-up'); });
    // directional variety
    document.querySelectorAll('.detail-art').forEach(function (el){ el.classList.add('rv-right'); });
    document.querySelectorAll('.aside-card').forEach(function (el){ el.classList.add('rv-right'); });
    document.querySelectorAll('.detail-body h2, .detail-body p, .detail-body ul').forEach(function (el){ el.classList.add('rv-left'); });
    // stagger inside grids
    document.querySelectorAll('.card-grid, .feature-grid').forEach(function (g) {
      [].slice.call(g.children).forEach(function (c, i) { c.style.setProperty('--d', (i % 3) * 90 + 'ms'); });
    });
  }

  var revealEls = [].slice.call(document.querySelectorAll('.fade-up'));
  if ('IntersectionObserver' in window && !reduce) {
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) { entry.target.classList.add('visible'); io.unobserve(entry.target); }
      });
    }, { threshold: 0.12, rootMargin: '0px 0px -6% 0px' });
    revealEls.forEach(function (el) { io.observe(el); });
  } else {
    revealEls.forEach(function (el) { el.classList.add('visible'); });
  }

  // parallax layers
  var heroes = [].slice.call(document.querySelectorAll('.page-hero'));
  var pEls = [].slice.call(document.querySelectorAll('[data-parallax], .detail-art'));
  var ticking = false;
  function onScroll() {
    if (nav) nav.classList.toggle('scrolled', window.scrollY > 20);
    if (progressBar) {
      var h = document.documentElement;
      progressBar.style.width = Math.min((h.scrollTop / (h.scrollHeight - h.clientHeight || 1)) * 100, 100) + '%';
    }
    if (reduce) return;
    if (!ticking) {
      ticking = true;
      requestAnimationFrame(function () {
        var y = window.scrollY;
        heroes.forEach(function (hEl) { hEl.style.setProperty('--py', (y * 0.28).toFixed(1) + 'px'); });
        pEls.forEach(function (el) {
          var r = el.getBoundingClientRect();
          var off = (r.top + r.height / 2) - window.innerHeight / 2;
          var f = parseFloat(el.getAttribute('data-parallax') || '-0.06');
          el.style.transform = 'translateY(' + (off * f).toFixed(1) + 'px)';
        });
        ticking = false;
      });
    }
  }
  window.addEventListener('scroll', onScroll, { passive: true });
  onScroll();

  // ---------- Smooth page transitions between internal pages ----------
  if (!reduce) {
    document.addEventListener('click', function (e) {
      var a = e.target.closest && e.target.closest('a');
      if (!a || e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      var href = a.getAttribute('href');
      if (!href || a.target === '_blank' || a.hasAttribute('download')) return;
      if (href.charAt(0) === '#' || /^(mailto:|tel:|javascript:)/i.test(href)) return;
      if (a.host && a.host !== location.host) return;
      if (a.pathname === location.pathname && a.hash) return;
      e.preventDefault();
      document.body.classList.add('page-exit');
      setTimeout(function () { window.location.href = a.href; }, 260);
    });
    window.addEventListener('pageshow', function (ev) { if (ev.persisted) document.body.classList.remove('page-exit'); });
  }
})();
