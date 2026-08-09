#!/usr/bin/env python3
"""Static page generator for MindCare Services®.
Generates /services/*.html and /team/*.html plus their index pages from the
data tables below, so every interior page shares one design system and a
consistent SEO/schema baseline. Run: python3 build.py
"""
import os, re, html, json, datetime, subprocess
from urllib.parse import quote as urlquote

BASE = "https://themindcareservices.com"
PHONE = "+92-327-2337631"
PHONE_H = "+92 327 2337631"
WA = "https://wa.me/923272337631"
ROOT = os.path.dirname(os.path.abspath(__file__))
TODAY = datetime.date.today().isoformat()

GTAG = """<!-- Google tag (gtag.js) -->
<script async src="https://www.googletagmanager.com/gtag/js?id=G-QZFCFZT32R"></script>
<script>
  window.dataLayer = window.dataLayer || [];
  function gtag(){dataLayer.push(arguments);}
  gtag('js', new Date());
  gtag('config', 'G-QZFCFZT32R');
</script>"""

FONTS = ('<link rel="preconnect" href="https://fonts.googleapis.com">'
         '<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>'
         '<link href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,400;0,600;1,400;1,600&family=DM+Sans:wght@300;400;500;600;700&display=swap" rel="stylesheet">')


def head(title, desc, canonical, prefix, schema, og_type="website"):
    return f"""<!DOCTYPE html>
<html lang="en" data-theme="light">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<script>(function(){{try{{var t=localStorage.getItem('mc-theme')||'light';document.documentElement.setAttribute('data-theme',t);var l=localStorage.getItem('mc-lang');if(!l){{l=((navigator.language||'').toLowerCase().indexOf('ur')===0)?'ur':'en';}}document.documentElement.setAttribute('lang',l);document.documentElement.setAttribute('dir',l==='ur'?'rtl':'ltr');}}catch(e){{}}}})();</script>
<meta name="theme-color" content="#f4fbfb">
<meta name="color-scheme" content="light">
<meta name="format-detection" content="telephone=yes">
<title>{html.escape(title)}</title>
<meta name="description" content="{html.escape(desc)}">
<meta name="author" content="MindCare Services®">
<meta name="robots" content="index, follow, max-image-preview:large, max-snippet:-1">
<link rel="canonical" href="{canonical}">
<meta property="og:type" content="{og_type}">
<meta property="og:title" content="{html.escape(title)}">
<meta property="og:description" content="{html.escape(desc)}">
<meta property="og:url" content="{canonical}">
<meta property="og:image" content="{BASE}/mindcare.png">
<meta property="og:site_name" content="MindCare Services®">
<meta property="og:locale" content="en_PK">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="{html.escape(title)}">
<meta name="twitter:description" content="{html.escape(desc)}">
<meta name="twitter:image" content="{BASE}/mindcare.png">
<link rel="icon" href="{prefix}mindcare.png" type="image/png">
<link rel="apple-touch-icon" sizes="180x180" href="/assets/icons/apple-touch-icon.png">
<link rel="manifest" href="{prefix}site.webmanifest">
{GTAG}
{FONTS}
<link rel="stylesheet" href="{prefix}assets/styles.css">
<script type="application/ld+json">
{json.dumps(schema, indent=2)}
</script>
</head>
<body>
<a href="#main" class="skip-link">Skip to main content</a>
<div class="scroll-progress" id="scrollProgress" aria-hidden="true"></div>
"""


def social_image(out, path, alt, w, h):
    """Point og:image and twitter:image at a page-specific card.

    Chat apps and social crawlers need a raster image at an absolute URL, so
    `path` should be a JPEG or PNG, never the SVG used on the page itself.
    """
    url = f"{BASE}/{path}"
    out = out.replace(
        f'<meta property="og:image" content="{BASE}/mindcare.png">',
        f'<meta property="og:image" content="{url}">\n'
        f'<meta property="og:image:secure_url" content="{url}">\n'
        f'<meta property="og:image:type" content="image/jpeg">\n'
        f'<meta property="og:image:width" content="{w}">\n'
        f'<meta property="og:image:height" content="{h}">\n'
        f'<meta property="og:image:alt" content="{html.escape(alt)}">')
    return out.replace(
        f'<meta name="twitter:image" content="{BASE}/mindcare.png">',
        f'<meta name="twitter:image" content="{url}">\n'
        f'<meta name="twitter:image:alt" content="{html.escape(alt)}">')


def icon(prefix, name, w=None):
    a = f' width="{w}" height="{w}"' if w else ''
    return f'<svg{a}><use href="{prefix}assets/sprite.svg#{name}"/></svg>'


def nav(prefix, active=None):
    def cls(key):
        return ' class="active"' if active == key else ''
    return f"""<nav id="navbar" aria-label="Primary navigation">
  <a href="/" class="nav-logo" aria-label="MindCare Services home">
    <img src="{prefix}mindcare.png" width="790" height="316" alt="MindCare Services®, a psychotherapy and mental health clinic in Karachi">
  </a>
  <ul class="nav-links">
    <li><a href="/"{cls('home')}>Home</a></li>
    <li><a href="/services/"{cls('services')}>Services</a></li>
    <li><a href="/about"{cls('about')}>About</a></li>
    <li><a href="/team/"{cls('team')}>Team</a></li>
    <li><a href="/articles"{cls('articles')}>Articles</a></li>
    <li><a href="/workshops"{cls('workshops')}>Workshops</a></li>
    <li><a href="/contact" class="nav-cta">Book</a></li>
  </ul>
  <div class="nav-tools">
    <button class="icon-btn" id="langBtn" type="button" aria-label="Change language">اردو</button>
    <button class="icon-btn" id="themeBtn" type="button" aria-label="Toggle dark mode"><svg class="sun" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round"><circle cx="12" cy="12" r="4.5"/><path d="M12 2.5v2.5M12 19v2.5M2.5 12H5M19 12h2.5M4.9 4.9l1.8 1.8M17.3 17.3l1.8 1.8M19.1 4.9l-1.8 1.8M6.7 17.3l-1.8 1.8"/></svg><svg class="moon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round"><path d="M20 14.5A8.5 8.5 0 0 1 9.5 4 8.5 8.5 0 1 0 20 14.5Z"/></svg></button>
    <button type="button" class="hamburger" onclick="toggleMenu()" aria-label="Open menu" aria-expanded="false" aria-controls="mobileMenu"><span></span><span></span><span></span></button>
  </div>
</nav>
<div class="mobile-menu" id="mobileMenu">
  <a href="/">Home</a>
  <a href="/services/">Services</a>
  <a href="/about">About</a>
  <a href="/team/">Team</a>
  <a href="/articles">Articles</a>
  <a href="/workshops">Workshops</a>
  <a href="/contact" class="m-cta">Book a Consultation</a>
</div>
<div class="wa-float">
  <div class="wa-tooltip">Chat on WhatsApp</div>
  <a href="{WA}?text=Hi%2C%20I%27d%20like%20to%20book%20a%20consultation%20with%20MindCare%20Services." target="_blank" rel="noopener" class="wa-float-btn" aria-label="Chat with MindCare on WhatsApp">{icon(prefix,'i-wa')}</a>
</div>
"""


def cta_band(prefix, heading, sub):
    return f"""<section class="cta-band" aria-label="Book a consultation">
  <div class="cta-band-inner fade-up">
    <div><h2>{heading}</h2><p>{sub}</p></div>
    <div class="cta-band-btns">
      <a href="/contact" class="btn-white">Book Free Consultation</a>
      <a href="{WA}" target="_blank" rel="noopener" class="btn-white wa">{icon(prefix,'i-wa','18')} WhatsApp Us</a>
    </div>
  </div>
</section>"""


def footer(prefix):
    return f"""<footer>
  <div class="footer-grid">
    <div class="footer-brand">
      <div class="footer-logo-text">MIND<span>CARE</span></div>
      <div class="footer-tagline">Keeping Your Peace ®</div>
      <p>A psychotherapy and mental health firm in Karachi, Pakistan, making evidence-based support accessible for all.</p>
      <div class="footer-social">
        <a href="https://www.instagram.com/mindcare.services/" target="_blank" rel="noopener" aria-label="MindCare on Instagram"><svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="2" width="20" height="20" rx="5"/><path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z"/><line x1="17.5" y1="6.5" x2="17.51" y2="6.5"/></svg></a>
        <a href="https://www.linkedin.com/company/mindcare-services/" target="_blank" rel="noopener" aria-label="MindCare on LinkedIn"><svg viewBox="0 0 24 24" width="15" height="15" fill="currentColor"><path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 0 1-2.063-2.065 2.064 2.064 0 1 1 2.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/></svg></a>
        <a href="{WA}" target="_blank" rel="noopener" aria-label="MindCare on WhatsApp"><svg width="15" height="15" fill="currentColor"><use href="{prefix}assets/sprite.svg#i-wa"/></svg></a>
      </div>
    </div>
    <div class="footer-col"><h4>Services</h4><ul>
      <li><a href="/services/individual-psychotherapy">Psychotherapy</a></li>
      <li><a href="/services/family-counseling">Family Counseling</a></li>
      <li><a href="/services/speech-therapy">Speech Therapy</a></li>
      <li><a href="/services/physiotherapy">Physiotherapy</a></li>
      <li><a href="/services/behavioral-therapy">Behavioral Therapy</a></li>
      <li><a href="/services/">All Services</a></li>
    </ul></div>
    <div class="footer-col"><h4>Company</h4><ul>
      <li><a href="/#about">About Us</a></li>
      <li><a href="/#journey">How It Works</a></li>
      <li><a href="/team/">Our Team</a></li>
      <li><a href="/articles">Articles</a></li>
      <li><a href="/guides">Help &amp; Guides</a></li>
      <li><a href="/workshops">Workshops</a></li>
      <li><a href="/#faq">FAQ</a></li>
      <li><a href="/contact">Book Appointment</a></li>
    </ul></div>
    <div class="footer-col"><h4>Contact</h4><ul>
      <li><a href="tel:{PHONE}">{PHONE_H}</a></li>
      <li><a href="https://www.instagram.com/mindcare.services/" target="_blank" rel="noopener">@mindcare.services</a></li>
      <li><a href="mailto:shaistatariq2002@gmail.com">shaistatariq2002@gmail.com</a></li>
      <li><a href="/contact">Book Consultation</a></li>
      <li><span>Karachi, Pakistan</span></li>
    </ul></div>
  </div>
  <div class="footer-bottom">
    <span>© 2026 MindCare Services®. All rights reserved.</span>
    <span>Keeping Your Peace · Karachi, Pakistan</span>
  </div>
</footer>
<script src="{prefix}assets/main.js" defer></script>
</body>
</html>
"""


def li(prefix, text):
    return f'      <li>{icon(prefix,"i-check","22")}<span>{text}</span></li>'


def faq_block(prefix, faqs):
    items = "\n".join(
        f'''      <div class="faq-item">
        <button type="button" class="faq-q" aria-expanded="false">{html.escape(q)}</button>
        <div class="faq-a"><p>{a}</p></div>
      </div>''' for q, a in faqs)
    return f"""<section id="faq" class="bg-off">
  <div class="section-inner">
    <div class="section-header centered fade-up"><span class="section-tag">Good to Know</span><h2 class="section-title">Frequently Asked Questions</h2></div>
    <div class="faq-list fade-up">
{items}
    </div>
  </div>
</section>"""


# ─────────────────────────── SERVICE DATA ───────────────────────────
SERVICES = [
    dict(slug="individual-psychotherapy", icon="i-brain", name="Individual Psychotherapy",
         title="Individual Psychotherapy in Karachi | CBT for Anxiety & Depression | MindCare Services®",
         desc="One-on-one psychotherapy in Karachi for anxiety, depression, stress and trauma. Evidence-based CBT and talk therapy for adults and adolescents. Book a free consultation.",
         lede="Confidential, one-on-one talk therapy for adults and adolescents, using proven methods like CBT to work through anxiety, depression, stress and trauma at a pace that feels right for you.",
         helps=["Anxiety, panic and constant worry", "Depression, low mood and loss of motivation",
                "Stress, burnout and overwhelm", "Trauma and difficult past experiences",
                "Self-esteem, identity and life transitions", "Sleep problems linked to your mental state"],
         approach=["Therapy here is a partnership, not a lecture. Your first session is a relaxed conversation where we listen to what's going on and answer your questions. There is nothing you have to prepare and no pressure.",
                   "From there, your therapist draws on evidence-based approaches (Cognitive Behavioral Therapy, psychodynamic therapy and motivational techniques) chosen to fit you, not a one-size-fits-all script. You set the goals; we bring the tools and the steady support."],
         included=[("i-brain","Evidence-Based Methods","CBT, psychodynamic and motivational therapy, tailored to your needs."),
                   ("i-lock","Total Confidentiality","Everything you share stays private, always."),
                   ("i-heart-hands","Judgment-Free Space","Come as you are. No problem is too small to bring."),
                   ("i-clock","Flexible Sessions","In-clinic appointments Mon-Sat, scheduled around you.")],
         faqs=[("Do I need a diagnosis to start therapy?","No. You don't need a referral or a diagnosis to begin. Many people come simply because something feels off, and that's reason enough. We'll figure out the rest together."),
               ("How long does psychotherapy take?","It varies from person to person. Some concerns ease in a handful of sessions; others benefit from longer support. Your therapist will discuss a realistic plan with you and review it as you progress."),
               ("Is what I share really confidential?","Yes. Your sessions are 100% confidential and never disclosed to anyone. Confidentiality is central to how MindCare works.")]),
    dict(slug="family-counseling", icon="i-family", name="Family & Relationship Counseling",
         title="Family & Relationship Counseling in Karachi | MindCare Services®",
         desc="Family and couples counseling in Karachi to rebuild communication, resolve conflict and navigate change together. Guided, confidential sessions. Book a free consultation.",
         lede="Guided sessions that help families and couples rebuild communication, resolve recurring conflict, and navigate big life transitions together, with a neutral, caring professional in the room.",
         helps=["Communication breakdowns and repeated arguments", "Parent-child and teenager conflict",
                "Marital and relationship strain", "Adjusting to major life changes together",
                "Blended-family and in-law dynamics", "Grief and loss within the family"],
         approach=["Most family conflict isn't about who's right. It's about patterns that keep repeating. Our counselors help everyone feel heard, then gently surface those patterns so the whole family can change them together.",
                   "Sessions are structured but warm. We set shared goals, teach practical communication skills, and give each person space to be understood, building trust and connection that lasts beyond the room."],
         included=[("i-family","Whole-Family View","We work with the relationships, not against any one person."),
                   ("i-heart-hands","Neutral & Fair","Everyone gets heard. No sides, no blame."),
                   ("i-lock","Private & Safe","A confidential space for honest conversations."),
                   ("i-check","Practical Skills","Communication tools you can actually use at home.")],
         faqs=[("Does everyone in the family need to attend?","Not necessarily. Sessions can include the whole family, a couple, or start with one person. We'll recommend what's most helpful for your situation."),
               ("Can you help with couples as well as families?","Yes. We support couples and married partners as well as parents, children and extended-family relationships."),
               ("What if my family has never done counseling before?","That's completely normal and most families haven't. Your first session is a gentle introduction, with nothing to prepare and no pressure.")]),
    dict(slug="speech-therapy", icon="i-speech", name="Speech Therapy",
         title="Speech Therapy in Karachi for Children & Adults | MindCare Services®",
         desc="Expert speech therapy in Karachi for language delays, articulation, stammering and communication disorders in children and adults. Book a free assessment today.",
         lede="Expert support for communication, from children's language delays and articulation to adult fluency and speech recovery, with warm, structured therapy that builds real confidence.",
         helps=["Speech and language delays in children", "Articulation and pronunciation difficulties",
                "Stammering and fluency challenges", "Autism-related communication support",
                "Adult speech recovery after illness or injury", "Social communication and expression skills"],
         approach=["Communication is how we connect, and small, consistent steps create big change. Our speech therapists begin with a careful assessment, then build a personalized plan of playful, goal-driven exercises.",
                   "For children, therapy often looks like structured play; for adults, targeted practice and coaching. Families get guidance to reinforce progress at home, so gains carry into everyday life."],
         included=[("i-clipboard","Full Assessment","We start by understanding exactly what's needed."),
                   ("i-speech","Tailored Plans","Personalized, age-appropriate therapy goals."),
                   ("i-family","Family Coaching","We show you how to support progress at home."),
                   ("i-check","Measured Progress","Clear milestones you can see and celebrate.")],
         faqs=[("At what age should my child start speech therapy?","Earlier is better, but it's never too late. If you've noticed a delay or difficulty at any age, an assessment will tell you whether therapy would help."),
               ("Do you offer speech therapy for adults?","Yes. We support adults with fluency, articulation and speech recovery needs, including after illness or injury."),
               ("How is progress tracked?","Your therapist sets clear, measurable goals and reviews them regularly, so you can see improvement over time.")]),
    dict(slug="physiotherapy", icon="i-physio", name="Physiotherapy",
         title="Physiotherapy in Karachi | Pain Relief & Rehabilitation | MindCare Services®",
         desc="Physiotherapy in Karachi for pain relief, rehabilitation and improved mobility. Musculoskeletal and neuro-physiotherapy by experienced physiotherapists. Book today.",
         lede="Rehabilitation, pain management and mobility improvement, assessed and treated by experienced physiotherapists who help you move, recover and feel like yourself again.",
         helps=["Back, neck and joint pain", "Post-injury and post-surgery rehabilitation",
                "Musculoskeletal conditions", "Neurological rehabilitation (neuro-PT)",
                "Posture and movement correction", "Chronic pain management"],
         approach=["Pain and stiffness shouldn't run your life. Our physiotherapists start with a thorough assessment to find the real source of the problem, then build a hands-on treatment and exercise plan around your goals.",
                   "Treatment combines manual therapy, guided exercise and education so you don't just feel better in the session. You keep improving between them, and learn how to prevent the problem returning."],
         included=[("i-clipboard","Thorough Assessment","We diagnose the cause, not just the symptom."),
                   ("i-physio","Hands-On Treatment","Manual therapy plus a tailored exercise plan."),
                   ("i-home","Home Programs","Simple exercises to keep progress going at home."),
                   ("i-check","Recovery Focused","Clear goals to get you back to full function.")],
         faqs=[("Do I need a doctor's referral for physiotherapy?","No referral is required. You can book an assessment directly and we'll advise on the best plan for you."),
               ("What conditions do you treat?","Musculoskeletal pain, sports and post-surgical injuries, neurological conditions, posture issues and chronic pain, among others."),
               ("How many sessions will I need?","It depends on your condition and goals. After your assessment, your physiotherapist will give you a realistic estimate and review it as you improve.")]),
    dict(slug="occupational-therapy", icon="i-hand", name="Occupational Therapy",
         title="Occupational Therapy in Karachi for All Ages | MindCare Services®",
         desc="Occupational therapy in Karachi helping children and adults regain independence in daily activities and life skills. Personalized OT programs. Book a free consultation.",
         lede="Helping individuals of all ages regain independence in the daily activities that matter most, from a child's fine-motor skills to an adult's return to everyday routines.",
         helps=["Children's fine-motor and sensory development", "Daily-living skills and independence",
                "Support for autism, ADHD and developmental needs", "Rehabilitation after injury or illness",
                "Handwriting, coordination and self-care skills", "Building routines and life skills"],
         approach=["Occupational therapy is about doing the things you need and love to do. We assess where daily life feels hard, then break skills down into achievable, practical steps.",
                   "Whether it's a child learning to hold a pencil or an adult rebuilding a routine, therapy is engaging, goal-driven and closely coordinated with families and caregivers for real-world results."],
         included=[("i-hand","Skill Building","Practical training for real daily activities."),
                   ("i-puzzle","Sensory Support","Strategies for sensory and developmental needs."),
                   ("i-family","Caregiver Guidance","We involve families for lasting progress."),
                   ("i-check","Independence Goals","Milestones focused on everyday life.")],
         faqs=[("Who can benefit from occupational therapy?","Children with developmental or sensory needs, and adults recovering independence after injury, illness or life changes."),
               ("How is OT different from physiotherapy?","Physiotherapy focuses on movement and physical function; occupational therapy focuses on the practical skills and activities of daily living. They often work well together."),
               ("Do you support children with autism or ADHD?","Yes. We provide structured, individualized OT support for children with autism, ADHD and related developmental needs.")]),
    dict(slug="behavioral-therapy", icon="i-cycle", name="Behavioral Therapy",
         title="Behavioral Therapy in Karachi | ASD & ADHD Support | MindCare Services®",
         desc="Structured behavioral therapy in Karachi for ASD support, ADHD and social-skills development using proven frameworks. Individualized programs. Book a free consultation.",
         lede="Structured, evidence-based interventions for autism spectrum support, ADHD and social-skills development, building positive behaviors and skills through proven frameworks.",
         helps=["Autism spectrum (ASD) support", "ADHD and attention-related challenges",
                "Social-skills and communication development", "Managing challenging behaviors",
                "Emotional regulation and coping skills", "Building routines and positive habits"],
         approach=["Behavioral therapy works by understanding what drives a behavior, then teaching and reinforcing positive alternatives in small, consistent steps.",
                   "Our therapists use structured, proven frameworks tailored to each individual, and partner closely with families so strategies stay consistent between sessions, where the real progress happens."],
         included=[("i-cycle","Proven Frameworks","Structured, evidence-based intervention plans."),
                   ("i-puzzle","Individualized","Tailored to each person's strengths and needs."),
                   ("i-family","Family Partnership","Consistent strategies for home and school."),
                   ("i-check","Positive Focus","Building skills, not just reducing behaviors.")],
         faqs=[("What ages do you work with?","We primarily support children and adolescents, with programs individualized to each person's developmental level and goals."),
               ("Do you coordinate with schools or families?","Yes. Consistency matters, so we work closely with families and, where helpful, caregivers and educators."),
               ("Is behavioral therapy evidence-based?","Yes. We use structured, well-researched frameworks and adapt them to each individual.")]),
    dict(slug="remedial-home-sessions", icon="i-home", name="Remedial Home Sessions",
         title="Remedial Home Therapy Sessions in Karachi (Special Needs) | MindCare Services®",
         desc="Specialized home-based remedial therapy in Karachi for individuals with special needs. Professional, one-on-one care delivered to your doorstep. Book a consultation.",
         lede="Specialized, one-on-one therapy for individuals with special needs, delivered in the comfort and familiarity of your own home, by professionals who bring the clinic to you.",
         helps=["Special-needs support in a familiar setting", "Individuals who find clinic visits difficult",
                "Consistent one-on-one attention", "Skill-building within daily home routines",
                "Family involvement and coaching", "Continuity of care between clinic and home"],
         approach=["For many individuals with special needs, home is where they feel safest, and where learning sticks best. Our remedial home sessions bring professional, structured therapy directly to that environment.",
                   "Working in the home lets us build skills into real daily routines and coach families in the moment, creating consistent, meaningful progress that's hard to replicate in a clinic alone."],
         included=[("i-home","Care at Your Door","Professional therapy in a familiar setting."),
                   ("i-heart-hands","One-on-One","Focused, individualized attention every session."),
                   ("i-family","Family Coaching","We guide caregivers to reinforce progress."),
                   ("i-check","Real-Life Skills","Learning built into everyday routines.")],
         faqs=[("Which areas do you cover for home sessions?","We serve families across Karachi. Contact us with your location and we'll confirm availability."),
               ("Who are home sessions best suited for?","Individuals with special needs who benefit from a familiar environment or find travelling to a clinic difficult."),
               ("Are home sessions as effective as clinic sessions?","For many individuals they're more effective, because skills are practiced directly within daily routines and the home environment.")]),
    dict(slug="diagnostic-assessments", icon="i-clipboard", name="Diagnostic Assessments",
         title="Psychological & Diagnostic Assessments in Karachi | MindCare Services®",
         desc="Professional psychological and cognitive diagnostic assessments in Karachi to guide accurate diagnosis and personalized treatment planning. Book an assessment today.",
         lede="Cognitive and psychological evaluations that bring clarity, guiding accurate diagnosis and a personalized, effective treatment plan built around real understanding.",
         helps=["Clarity when symptoms are confusing or overlapping", "Cognitive and psychological evaluation",
                "Developmental and learning assessments", "A clear basis for a treatment plan",
                "Understanding strengths as well as challenges", "Informed next steps and referrals"],
         approach=["A good assessment answers the question 'what's really going on?', and that clarity is often the turning point. Our evaluations are thorough, professional and explained in plain language.",
                   "You won't be handed a label and sent away. We walk you through what the results mean and translate them into clear, practical recommendations and a personalized plan."],
         included=[("i-clipboard","Thorough Evaluation","Structured cognitive and psychological assessment."),
                   ("i-brain","Expert Interpretation","Results explained clearly, in plain language."),
                   ("i-check","Actionable Plan","Findings turned into concrete next steps."),
                   ("i-lock","Confidential","Your results stay private and secure.")],
         faqs=[("What does a diagnostic assessment involve?","Typically a structured interview and standardized evaluation tools, followed by a clear explanation of the results and recommendations."),
               ("Will I understand the results?","Yes. We explain everything in plain language and give you practical, personalized next steps, with no jargon and no confusion."),
               ("Is an assessment confidential?","Absolutely. Your assessment and results are kept strictly confidential.")]),
    dict(slug="dental-consultations", icon="i-tooth", name="Dental Consultations",
         title="Dental Consultations in Karachi | Oral Health Advice | MindCare Services®",
         desc="Professional dental consultations in Karachi, with expert advice on oral health, treatment planning and preventive care from a qualified dental consultant. Book today.",
         lede="Expert advice on oral health, treatment planning and preventive care, from a qualified dental consultant, as part of MindCare's whole-person approach to wellbeing.",
         helps=["Oral health check-ups and advice", "Preventive and restorative care guidance",
                "Treatment planning and second opinions", "Understanding your options clearly",
                "Guidance on maintaining long-term oral health", "Referrals where specialist care is needed"],
         approach=["Oral health is part of overall health, and good decisions start with good advice. Our dental consultant offers clear, unhurried guidance so you understand your options before committing to anything.",
                   "Whether you need a check-up, a treatment plan or a second opinion, you'll get honest, professional advice focused on preventive care and long-term wellbeing."],
         included=[("i-tooth","Expert Advice","Guidance from a qualified dental consultant."),
                   ("i-clipboard","Treatment Planning","Clear options explained without pressure."),
                   ("i-shield","Preventive Focus","Care aimed at long-term oral health."),
                   ("i-check","Honest Guidance","Straightforward advice you can trust.")],
         faqs=[("What can I expect from a dental consultation?","A professional assessment of your oral health, clear explanation of any concerns, and honest guidance on your options and next steps."),
               ("Do you focus on preventive care?","Yes. Our emphasis is on preventive advice and long-term oral health, alongside treatment planning where needed."),
               ("Can I get a second opinion here?","Yes. If you'd like clarity on an existing treatment plan, our consultant can provide a professional second opinion.")]),
    dict(slug="awareness-sessions", icon="i-grad", name="Awareness Sessions & Trainings",
         title="Mental Health Awareness Sessions & Corporate Trainings in Karachi | MindCare Services®",
         desc="Certified mental health awareness sessions and trainings in Karachi for workplaces, schools and institutions. Reduce stigma and build resilience. Enquire today.",
         lede="Certified mental health workshops for workplaces, schools and institutions, designed to reduce stigma, build resilience and equip your community with practical wellbeing tools.",
         helps=["Corporate wellness and employee wellbeing", "School and university awareness programs",
                "Reducing mental health stigma", "Building resilience and coping skills",
                "Stress management for teams", "Creating supportive institutional cultures"],
         approach=["Awareness changes everything. When people understand mental health, they seek help sooner and support each other better. Our sessions are engaging, practical and tailored to your audience.",
                   "Led by experienced professionals including our PPA-member founder Shaista Tariq, workshops blend real understanding with actionable tools your team, students or community can use straight away."],
         included=[("i-building","Corporate Wellness","Tailored programs for organizations and teams."),
                   ("i-school","Educational Seminars","Engaging sessions for schools and universities."),
                   ("i-grad","Certified & Practical","Professional, actionable, audience-specific content."),
                   ("i-heart-hands","Stigma Reduction","Building open, supportive cultures.")],
         faqs=[("Who are these sessions for?","Workplaces, schools, universities, NGOs and institutions that want to build awareness, resilience and a supportive culture."),
               ("Can sessions be tailored to our organization?","Yes. Every program is tailored to your audience, goals and context."),
               ("How do we arrange a session?","Get in touch via our contact page or WhatsApp with a little about your organization, and we'll design a program with you.")]),
]

SERVICE_BY_SLUG = {s["slug"]: s for s in SERVICES}


def detail_art_svg(prefix, ic):
    return f'<svg width="160" height="160" aria-hidden="true"><use href="{prefix}assets/sprite.svg#{ic}"/></svg>'


def service_page(s):
    prefix = "../"
    url = f"{BASE}/services/{s['slug']}"
    schema = {"@context": "https://schema.org", "@graph": [
        {"@type": "MedicalTherapy", "name": s["name"], "url": url,
         "description": s["desc"],
         "provider": {"@type": "MedicalClinic", "name": "MindCare Services®", "url": BASE,
                      "telephone": PHONE, "address": {"@type": "PostalAddress", "addressLocality": "Karachi", "addressRegion": "Sindh", "addressCountry": "PK"}},
         "areaServed": {"@type": "City", "name": "Karachi"}},
        {"@type": "BreadcrumbList", "itemListElement": [
            {"@type": "ListItem", "position": 1, "name": "Home", "item": f"{BASE}/"},
            {"@type": "ListItem", "position": 2, "name": "Services", "item": f"{BASE}/services/"},
            {"@type": "ListItem", "position": 3, "name": s["name"], "item": url}]},
        {"@type": "FAQPage", "mainEntity": [
            {"@type": "Question", "name": q, "acceptedAnswer": {"@type": "Answer", "text": a}} for q, a in s["faqs"]]},
    ]}
    helps = "\n".join(li(prefix, h) for h in s["helps"])
    approach = "\n".join(f"        <p>{p}</p>" for p in s["approach"])
    included = "\n".join(
        f'''      <div class="feature-card fade-up"><div class="fi">{icon(prefix,ic)}</div><h3>{t}</h3><p>{d}</p></div>'''
        for ic, t, d in s["included"])
    related = [x for x in SERVICES if x["slug"] != s["slug"]][:3]
    related_cards = "\n".join(
        f'''      <a class="link-card fade-up" href="/services/{r['slug']}"><div class="fi">{icon(prefix,r['icon'])}</div><h3>{r['name']}</h3><p>{r['lede'][:96]}…</p><span class="more">Learn more →</span></a>'''
        for r in related)

    out = head(s["title"], s["desc"], url, prefix, schema)
    out += nav(prefix, "services")
    out += f"""<main id="main">
<header class="page-hero">
  <div class="ph-inner">
    <ol class="breadcrumb"><li><a href="/">Home</a></li><li><a href="/services/">Services</a></li><li aria-current="page">{s['name']}</li></ol>
    <div class="ph-badge">{icon(prefix,'i-shield')} Evidence-based · Confidential · Karachi</div>
    <h1>{s['name']}</h1>
    <p class="lede">{s['lede']}</p>
    <div class="ph-actions">
      <a href="/contact" class="btn-primary">Book Free Consultation</a>
      <a href="{WA}" target="_blank" rel="noopener" class="btn-secondary">Ask on WhatsApp</a>
    </div>
  </div>
</header>

<section>
  <div class="section-inner">
    <div class="detail-grid">
      <div class="detail-body fade-up">
        <h2>What this service helps with</h2>
        <ul>
{helps}
        </ul>
        <h2>Our approach</h2>
{approach}
      </div>
      <aside class="aside-card fade-up">
        <div class="detail-art" style="margin-bottom:20px">{detail_art_svg(prefix,s['icon'])}</div>
        <h3>Quick facts</h3>
        <ul class="aside-list">
          <li>{icon(prefix,'i-shield')} Evidence-based care</li>
          <li>{icon(prefix,'i-lock')} 100% confidential</li>
          <li>{icon(prefix,'i-clock')} Mon-Sat, 9am-7pm</li>
          <li>{icon(prefix,'i-phone')} {PHONE_H}</li>
        </ul>
        <div class="aside-actions">
          <a href="/contact" class="btn-primary" style="justify-content:center">Book a Consultation</a>
          <a href="{WA}" target="_blank" rel="noopener" class="btn-wa-block">{icon(prefix,'i-wa')} WhatsApp Us</a>
        </div>
      </aside>
    </div>
  </div>
</section>

<section class="bg-off">
  <div class="section-inner">
    <div class="section-header centered fade-up"><span class="section-tag">What's Included</span><h2 class="section-title">What you can expect</h2></div>
    <div class="feature-grid">
{included}
    </div>
  </div>
</section>

{faq_block(prefix, s['faqs'])}

<section>
  <div class="section-inner">
    <div class="section-header centered fade-up"><span class="section-tag">Explore More</span><h2 class="section-title">Related services</h2></div>
    <div class="card-grid">
{related_cards}
    </div>
  </div>
</section>

{cta_band(prefix, "Not sure if this is right for you?", "That's okay. A free, confidential consultation will help you decide. No pressure.")}
</main>
"""
    out += footer(prefix)
    return out


def services_index():
    prefix = "../"
    url = f"{BASE}/services/"
    schema = {"@context": "https://schema.org", "@graph": [
        {"@type": "CollectionPage", "name": "Our Services | MindCare Services®", "url": url,
         "description": "The full range of psychotherapy, counseling and clinical services offered by MindCare Services® in Karachi."},
        {"@type": "BreadcrumbList", "itemListElement": [
            {"@type": "ListItem", "position": 1, "name": "Home", "item": f"{BASE}/"},
            {"@type": "ListItem", "position": 2, "name": "Services", "item": url}]},
        {"@type": "ItemList", "itemListElement": [
            {"@type": "ListItem", "position": i + 1, "name": s["name"], "url": f"{BASE}/services/{s['slug']}"}
            for i, s in enumerate(SERVICES)]},
    ]}
    cards = "\n".join(
        f'''      <a class="link-card fade-up" href="/services/{s['slug']}"><div class="fi">{icon(prefix,s['icon'])}</div><h3>{s['name']}</h3><p>{s['lede'][:120]}…</p><span class="more">Learn more →</span></a>'''
        for s in SERVICES)
    out = head("Our Services | Psychotherapy, Counseling & Therapy in Karachi | MindCare Services®",
               "Explore all MindCare Services® offerings in Karachi: psychotherapy, family counseling, speech therapy, physiotherapy, occupational and behavioral therapy, assessments and more.",
               url, prefix, schema)
    out += nav(prefix, "services")
    out += f"""<main id="main">
<header class="page-hero">
  <div class="ph-inner">
    <ol class="breadcrumb"><li><a href="/">Home</a></li><li aria-current="page">Services</li></ol>
    <div class="ph-badge">{icon(prefix,'i-puzzle')} 10 services · One caring team</div>
    <h1>Comprehensive care for <em>mind &amp; body</em></h1>
    <p class="lede">A holistic range of therapy and clinical services, all under one roof in Karachi, delivered by experienced professionals. Choose a service to learn more.</p>
    <div class="ph-actions"><a href="/contact" class="btn-primary">Book Free Consultation</a></div>
  </div>
</header>
<section>
  <div class="section-inner">
    <div class="card-grid">
{cards}
    </div>
  </div>
</section>
{cta_band(prefix, "Not sure which service fits?", "Tell us what's going on and we'll guide you to the right support, free and confidential.")}
</main>
"""
    out += footer(prefix)
    return out


# ─────────────────────────── TEAM DATA ───────────────────────────
AV = {
 "shaista": '<svg viewBox="0 0 80 80"><rect width="80" height="80" fill="#c9f0f4"/><circle cx="40" cy="34" r="15" fill="#eaa17a"/><path d="M25 30c0-11 7-19 15-19s15 8 15 19c0 4-1 7-2 9 1-8-1-15-5-18-2 3-6 5-12 5-4 0-6-1-8-2-2 3-3 8-2 13-1-2-1-5-1-7Z" fill="#177585"/><path d="M14 76c3-15 13-23 26-23s23 8 26 23" fill="#0b5f6d"/><circle cx="35" cy="34" r="1.7" fill="#3c2a20"/><circle cx="45" cy="34" r="1.7" fill="#3c2a20"/><path d="M36 40c2.4 2.2 5.6 2.2 8 0" stroke="#7c4a32" stroke-width="1.8" fill="none" stroke-linecap="round"/></svg>',
 "ribqah": '<svg viewBox="0 0 80 80"><rect width="80" height="80" fill="#e6ddf7"/><circle cx="40" cy="34" r="15" fill="#f0b48e"/><path d="M24 36c-2-13 6-24 16-24s18 11 16 24c-2-9-7-14-16-14s-14 5-16 14Z" fill="#241a12"/><path d="M24 36c0 10 2 16 0 22l6-2c-2-6-2-13 0-20h-6ZM56 36c0 10-2 16 0 22l-6-2c2-6 2-13 0-20h6Z" fill="#241a12"/><path d="M14 76c3-15 13-23 26-23s23 8 26 23" fill="#7b5ea7"/><circle cx="35" cy="34" r="1.7" fill="#241a12"/><circle cx="45" cy="34" r="1.7" fill="#241a12"/><path d="M36 40c2.4 2.2 5.6 2.2 8 0" stroke="#8a5638" stroke-width="1.8" fill="none" stroke-linecap="round"/></svg>',
 "ejaz": '<svg viewBox="0 0 80 80"><rect width="80" height="80" fill="#fde3d1"/><circle cx="40" cy="34" r="15" fill="#eaa17a"/><path d="M26 30c1-10 6-17 14-17s13 7 14 17c0 3 0 6-1 8 0-7-2-13-6-16-3 3-7 4-11 4-3 0-5 0-7-1-2 3-3 7-2 12-1-2-1-4-1-7Z" fill="#5a3b28"/><path d="M14 76c3-15 13-23 26-23s23 8 26 23" fill="#e07b4a"/><circle cx="35" cy="34" r="1.7" fill="#3c2a20"/><circle cx="45" cy="34" r="1.7" fill="#3c2a20"/><path d="M36 40c2.4 2.2 5.6 2.2 8 0" stroke="#7c4a32" stroke-width="1.8" fill="none" stroke-linecap="round"/></svg>',
 "rimsha": '<svg viewBox="0 0 80 80"><rect width="80" height="80" fill="#d3e7f8"/><circle cx="40" cy="34" r="15" fill="#f0b48e"/><path d="M25 32c-1-12 6-21 15-21s16 9 15 21l-3 3c1-9-3-16-12-16s-13 7-12 16l-3-3Z" fill="#241a12"/><path d="M14 76c3-15 13-23 26-23s23 8 26 23" fill="#4a90d9"/><circle cx="35" cy="34" r="1.7" fill="#241a12"/><circle cx="45" cy="34" r="1.7" fill="#241a12"/><path d="M36 40c2.4 2.2 5.6 2.2 8 0" stroke="#8a5638" stroke-width="1.8" fill="none" stroke-linecap="round"/></svg>',
 "hareem": '<svg viewBox="0 0 80 80"><rect width="80" height="80" fill="#fbdae8"/><circle cx="40" cy="34" r="15" fill="#eaa17a"/><path d="M25 33c-2-12 5-22 15-22s17 10 15 22c-1-9-6-15-15-15s-14 6-15 15Z" fill="#3c2a20"/><path d="M14 76c3-15 13-23 26-23s23 8 26 23" fill="#d94a8a"/><circle cx="35" cy="34" r="1.7" fill="#3c2a20"/><circle cx="45" cy="34" r="1.7" fill="#3c2a20"/><path d="M36 40c2.4 2.2 5.6 2.2 8 0" stroke="#7c4a32" stroke-width="1.8" fill="none" stroke-linecap="round"/></svg>',
 "shafeeq": '<svg viewBox="0 0 80 80"><rect width="80" height="80" fill="#dff0d8"/><circle cx="40" cy="35" r="15" fill="#d9a06b"/><path d="M27 30c2-9 6-14 13-14s11 5 13 14c0 2 0 3-1 5 0-6-2-10-5-12-2 2-4 3-7 3s-5-1-7-3c-3 2-5 6-5 12 0-2-1-3-1-5Z" fill="#241a12"/><path d="M14 76c3-15 13-23 26-23s23 8 26 23" fill="#2d6a1f"/><circle cx="35" cy="35" r="1.7" fill="#241a12"/><circle cx="45" cy="35" r="1.7" fill="#241a12"/><path d="M36 41c2.4 2.2 5.6 2.2 8 0" stroke="#7a4a28" stroke-width="1.8" fill="none" stroke-linecap="round"/></svg>',
}

TEAM = [
    dict(slug="shaista-tariq", av="shaista", name="Shaista Tariq", role="Founder & Associate Psychologist",
         title="Shaista Tariq, Founder & Associate Psychologist (PPA Member) | MindCare Services®",
         desc="Shaista Tariq is the founder of MindCare Services® in Karachi. She is an Associate Psychologist, Counsellor, Behavior Therapist and Mental Health Care Provider, and a personal Member of the Pakistan Psychological Association (PPA).",
         tags=["Founder", "PPA Member", "Associate Psychologist", "Behavior Therapist"],
         job="Psychologist",
         headline="Associate Psychologist | Counsellor | Mental Health Care Provider | Behavior Therapist",
         bio=["Shaista Tariq is an Associate Psychologist, Counsellor, Behavior Therapist and Mental Health Care Provider, and the founder of MindCare Services®. She is personally a verified Member of the Pakistan Psychological Association (PPA).",
              "She founded MindCare on a single belief: no one should have to struggle alone, or feel that what they're going through isn't \"serious enough\" to ask for help. Under her leadership, MindCare has grown into a multidisciplinary team offering holistic, evidence-based care across Karachi.",
              "Alongside MindCare, Shaista works as a Behavioral Therapist and Additional Needs Coordinator at VIVI - The Bear School, supporting children with additional needs. She works with adults and adolescents using approaches including Cognitive Behavioral Therapy (CBT), Applied Behavior Analysis (ABA) and motivational therapy, and leads awareness sessions and trainings for workplaces, schools and institutions.",
              "She also writes on mental health, workplaces and the human side of care. You can <a href=\"/articles\">read her articles here</a>."],
         focus=["Anxiety, depression and stress", "Behavior therapy &amp; child mental health", "Cognitive Behavioral Therapy (CBT)",
                "Counselling for individuals and families", "Mental health education &amp; awareness training"],
         knows=["Psychology", "Counselling", "Cognitive Behavioral Therapy", "Applied Behavior Analysis", "Behavioral Therapy", "Child Mental Health", "Mental Health"],
         experience=[
             {"role": "Founder", "org": "MindCare Services®", "date": "Aug 2024 - Present"},
             {"role": "Additional Needs Coordinator", "org": "VIVI - The Bear School", "date": "Nov 2025 - Present"},
             {"role": "Behavioral Therapist", "org": "VIVI - The Bear School", "date": "Dec 2024 - Present"},
             {"role": "Member", "org": "Pakistan Psychological Association", "date": "Mar 2026 - Present"},
             {"role": "Child Mental Health Care Provider", "org": "Core Care Clinic", "date": "Feb 2024 - Aug 2024"},
             {"role": "Management Sub-coordinator", "org": "Core Care Clinic", "date": "Feb 2024 - Aug 2024"},
         ],
         education=[
             {"title": "ABA Certification, Psychology", "org": "American Council of Training & Development", "date": "2024"},
             {"title": "Bachelor of Psychology (Social Sciences)", "org": "Jinnah University for Women", "date": "2020 - 2024"},
         ],
         skills=["Business Ownership", "Early-Stage Ventures", "Start-up Leadership", "Cognitive Behavioral Therapy (CBT)",
                 "Applied Behavior Analysis (ABA)", "Behavioral Therapy", "Counselling", "Child Mental Health", "Mental Health Awareness"],
         member="PPA"),
    dict(slug="ribqah-arshad", av="ribqah", name="Ribqah Arshad", role="Team Coordinator",
         title="Ribqah Arshad, Team Coordinator | MindCare Services® Karachi",
         desc="Ribqah Arshad is the Team Coordinator at MindCare Services® in Karachi, managing operations and client relations so every client's experience is smooth and supportive.",
         tags=["Operations", "Client Relations"], job="Team Coordinator",
         bio=["Ribqah Arshad keeps MindCare running smoothly. As Team Coordinator, she oversees day-to-day operations and client relations, and is often the first friendly point of contact when you reach out.",
              "Her focus is making sure every client's experience, from the first enquiry to booking the right specialist, feels easy, warm and well-organized."],
         focus=["Client onboarding and support", "Appointment coordination", "Operations and scheduling", "Care continuity across the team"],
         knows=["Operations", "Client Relations", "Coordination"], member=None),
    dict(slug="ejaz-fatima", av="ejaz", name="Ejaz Fatima", role="Physiotherapist",
         title="Ejaz Fatima, Physiotherapist | MindCare Services® Karachi",
         desc="Ejaz Fatima is a physiotherapist at MindCare Services® in Karachi, specialising in rehabilitation and pain management to help clients move and recover.",
         tags=["Physiotherapy", "Rehabilitation", "Pain Management"], job="Physiotherapist",
         bio=["Ejaz Fatima is a physiotherapist focused on rehabilitation and pain management. She helps clients recover from injury, ease persistent pain and rebuild strength and mobility.",
              "Her hands-on, goal-driven approach combines manual therapy with tailored exercise so clients keep improving between sessions and learn to prevent problems returning."],
         focus=["Pain management", "Post-injury and post-surgery rehabilitation", "Musculoskeletal conditions", "Mobility and strength recovery"],
         knows=["Physiotherapy", "Rehabilitation", "Pain Management"], member=None,
         service="physiotherapy"),
    dict(slug="rimsha-pari", av="rimsha", name="Rimsha Pari", role="Consultant Physiotherapist",
         title="Rimsha Pari, Consultant Physiotherapist | MindCare Services® Karachi",
         desc="Rimsha Pari is a consultant physiotherapist at MindCare Services® in Karachi, specialising in musculoskeletal and neurological physiotherapy.",
         tags=["Consultant Physiotherapist", "Musculoskeletal", "Neuro-PT"], job="Consultant Physiotherapist",
         bio=["Rimsha Pari is a consultant physiotherapist with expertise in musculoskeletal and neurological physiotherapy (neuro-PT). She assesses the root cause of movement and pain problems and builds targeted recovery plans.",
              "She works closely with each client to restore function, reduce pain and improve quality of life through evidence-based, individualized treatment."],
         focus=["Musculoskeletal physiotherapy", "Neurological rehabilitation", "Posture and movement correction", "Chronic pain management"],
         knows=["Physiotherapy", "Musculoskeletal Therapy", "Neurological Rehabilitation"], member=None,
         service="physiotherapy"),
    dict(slug="hareem-tariq", av="hareem", name="Hareem Tariq", role="Dental Consultant",
         title="Hareem Tariq, Dental Consultant | MindCare Services® Karachi",
         desc="Hareem Tariq is the dental consultant at MindCare Services® in Karachi, offering preventive and restorative oral-health advice and treatment planning.",
         tags=["Dental Consultant", "Preventive Care", "Restorative Care"], job="Dental Consultant",
         bio=["Hareem Tariq is MindCare's dental consultant, focused on preventive and restorative care. She offers clear, unhurried guidance on oral health, treatment planning and second opinions.",
              "Her emphasis is on prevention and long-term oral health, helping clients understand their options and make confident decisions."],
         focus=["Oral health check-ups and advice", "Preventive care", "Restorative treatment planning", "Second opinions"],
         knows=["Dentistry", "Preventive Care", "Oral Health"], member=None,
         service="dental-consultations"),
    dict(slug="shafeeq-langhar", av="shafeeq", name="Shafeeq Langhar", role="Psychologist",
         title="Shafeeq Langhar, Clinical Psychologist | MindCare Services® Karachi",
         desc="Shafeeq Langhar is a clinical psychologist at MindCare Services® in Karachi, providing individual and group therapy grounded in clinical psychology.",
         tags=["Psychologist", "Clinical Psychology", "Individual & Group Therapy"], job="Psychologist",
         bio=["Shafeeq Langhar is a clinical psychologist providing individual and group therapy. He supports clients through a range of psychological concerns with an evidence-based, compassionate approach.",
              "He believes in meeting each person where they are, and tailors therapy, one-on-one or in groups, to each client's goals and comfort."],
         focus=["Clinical psychology", "Individual therapy", "Group therapy", "Anxiety, depression and stress"],
         knows=["Clinical Psychology", "Psychotherapy", "Group Therapy"], member=None,
         service="individual-psychotherapy"),
]


def team_page(m):
    prefix = "../"
    url = f"{BASE}/team/{m['slug']}"
    person = {"@type": "Person", "name": m["name"], "url": url, "jobTitle": m["role"],
              "description": m["desc"], "image": f"{BASE}/mindcare.png",
              "worksFor": {"@type": "MedicalClinic", "name": "MindCare Services®", "url": BASE},
              "knowsAbout": m["knows"],
              "hasOccupation": {"@type": "Occupation", "name": m["job"], "occupationLocation": {"@type": "City", "name": "Karachi"}}}
    if m.get("member"):
        person["memberOf"] = {"@type": "Organization", "name": "Pakistan Psychological Association", "alternateName": "PPA"}
    schema = {"@context": "https://schema.org", "@graph": [person,
        {"@type": "BreadcrumbList", "itemListElement": [
            {"@type": "ListItem", "position": 1, "name": "Home", "item": f"{BASE}/"},
            {"@type": "ListItem", "position": 2, "name": "Team", "item": f"{BASE}/team/"},
            {"@type": "ListItem", "position": 3, "name": m["name"], "item": url}]}]}
    tags = "".join(f'<span class="mini-tag">{t}</span>' for t in m["tags"])
    bio = "\n".join(f"        <p>{p}</p>" for p in m["bio"])
    focus = "\n".join(li(prefix, f) for f in m["focus"])
    headline_html = f'<div class="role-sub">{m["headline"]}</div>' if m.get("headline") else ""
    extra = ""
    if m.get("experience"):
        rows = "\n".join(
            f'          <li><span class="cv-role">{html.escape(e["role"])}</span>'
            f'<span class="cv-org">{html.escape(e["org"])}</span>'
            f'<span class="cv-date">{html.escape(e["date"])}</span></li>'
            for e in m["experience"])
        extra += f"""        <h2>Experience</h2>
        <ul class="cv-list">
{rows}
        </ul>
"""
    if m.get("education"):
        rows = "\n".join(
            f'          <li><span class="cv-role">{html.escape(e["title"])}</span>'
            f'<span class="cv-org">{html.escape(e["org"])}</span>'
            f'<span class="cv-date">{html.escape(e["date"])}</span></li>'
            for e in m["education"])
        extra += f"""        <h2>Education &amp; Credentials</h2>
        <ul class="cv-list">
{rows}
        </ul>
"""
    if m.get("skills"):
        chips = "".join(f'<li>{html.escape(s)}</li>' for s in m["skills"])
        extra += f"""        <h2>Skills</h2>
        <ul class="skill-chips">{chips}</ul>
"""
    svc = m.get("service")
    svc_link = ""
    if svc:
        sname = SERVICE_BY_SLUG[svc]["name"]
        svc_link = f'<p style="margin-top:18px"><a href="/services/{svc}" class="more" style="font-weight:600">See {sname} →</a></p>'
    out = head(m["title"], m["desc"], url, prefix, schema, og_type="profile")
    out += nav(prefix, "team")
    out += f"""<main id="main">
<header class="page-hero">
  <div class="ph-inner">
    <ol class="breadcrumb"><li><a href="/">Home</a></li><li><a href="/team/">Team</a></li><li aria-current="page">{m['name']}</li></ol>
    <div class="profile-head">
      <div class="profile-avatar">{AV[m['av']]}</div>
      <div>
        <h1 style="margin-bottom:2px">{m['name']}</h1>
        <div class="role">{m['role']}</div>
        {headline_html}
        <div class="tag-row">{tags}</div>
      </div>
    </div>
  </div>
</header>
<section>
  <div class="section-inner">
    <div class="detail-grid">
      <div class="detail-body fade-up">
        <h2>About {m['name'].split()[0]}</h2>
{bio}
        <h2>Focus areas</h2>
        <ul>
{focus}
        </ul>
{extra}        {svc_link}
      </div>
      <aside class="aside-card fade-up">
        <h3>Book with {m['name'].split()[0]}</h3>
        <p>Reach out for a free, confidential consultation. We'll help you find the right time and the right support.</p>
        <ul class="aside-list">
          <li>{icon(prefix,'i-clock')} Mon-Sat, 9am-7pm</li>
          <li>{icon(prefix,'i-phone')} {PHONE_H}</li>
          <li>{icon(prefix,'i-lock')} 100% confidential</li>
        </ul>
        <div class="aside-actions">
          <a href="/contact" class="btn-primary" style="justify-content:center">Book a Consultation</a>
          <a href="{WA}" target="_blank" rel="noopener" class="btn-wa-block">{icon(prefix,'i-wa')} WhatsApp Us</a>
        </div>
      </aside>
    </div>
  </div>
</section>
{cta_band(prefix, "Ready to take the first step?", "A free, confidential consultation is the easiest way to begin. No pressure, no judgment.")}
</main>
"""
    out += footer(prefix)
    return out


def team_index():
    prefix = "../"
    url = f"{BASE}/team/"
    schema = {"@context": "https://schema.org", "@graph": [
        {"@type": "CollectionPage", "name": "Our Team | MindCare Services®", "url": url,
         "description": "Meet the multidisciplinary team of specialists at MindCare Services® in Karachi."},
        {"@type": "BreadcrumbList", "itemListElement": [
            {"@type": "ListItem", "position": 1, "name": "Home", "item": f"{BASE}/"},
            {"@type": "ListItem", "position": 2, "name": "Team", "item": url}]},
        {"@type": "ItemList", "itemListElement": [
            {"@type": "ListItem", "position": i + 1, "name": m["name"], "url": f"{BASE}/team/{m['slug']}"}
            for i, m in enumerate(TEAM)]}]}
    cards = "\n".join(
        f'''      <a class="link-card fade-up" href="/team/{m['slug']}" style="text-align:center">
        <div class="profile-avatar" style="width:96px;height:96px;border-radius:50%;margin:0 auto 14px">{AV[m['av']]}</div>
        <h3>{m['name']}</h3><p style="color:var(--teal-dark);font-weight:600;margin-bottom:4px">{m['role']}</p>
        <span class="more">View profile →</span></a>''' for m in TEAM)
    out = head("Our Team | Psychotherapists & Specialists in Karachi | MindCare Services®",
               "Meet the MindCare Services® team in Karachi: psychotherapists, physiotherapists, a psychologist, dental consultant and coordinators led by founder Shaista Tariq (PPA Member).",
               url, prefix, schema)
    out += nav(prefix, "team")
    out += f"""<main id="main">
<header class="page-hero">
  <div class="ph-inner">
    <ol class="breadcrumb"><li><a href="/">Home</a></li><li aria-current="page">Team</li></ol>
    <div class="ph-badge">{icon(prefix,'i-family')} A multidisciplinary team</div>
    <h1>Meet the people behind <em>your care</em></h1>
    <p class="lede">A dedicated group of specialists united by one mission: compassionate, professional, impactful care. Get to know each of them.</p>
    <div class="ph-actions"><a href="/contact" class="btn-primary">Book Free Consultation</a></div>
  </div>
</header>
<section>
  <div class="section-inner">
    <div class="card-grid">
{cards}
    </div>
  </div>
</section>
{cta_band(prefix, "Want to work with one of our specialists?", "Book a free, confidential consultation and we'll match you with the right person.")}
</main>
"""
    out += footer(prefix)
    return out


# ─────────────────────────── SEO LANDING TOPICS ───────────────────────────
# service = related service slug. sib links auto-generated.
TOPICS = [
 dict(slug="anxiety-therapy-karachi", h1="Anxiety Therapy in Karachi", service="individual-psychotherapy",
   title="Anxiety Therapy in Karachi | Treatment for Anxiety & Panic | MindCare Services®",
   desc="Struggling with anxiety in Karachi? MindCare Services® offers evidence-based anxiety therapy and CBT for worry, panic and overthinking. Book a free consultation.",
   lede="If worry, racing thoughts or panic are running your life, you're not alone, and it's highly treatable. Our therapists in Karachi help you calm the noise with proven, evidence-based methods.",
   signs=["Constant worry you can't switch off","Racing thoughts, restlessness or feeling on edge","Panic attacks or a pounding heart","Trouble sleeping or concentrating","Avoiding people, places or situations"],
   help=["Anxiety responds very well to therapy, especially Cognitive Behavioral Therapy (CBT), which helps you understand and gradually retrain the thought patterns that keep anxiety going.","At MindCare, your first session is a calm, confidential conversation. Together we build a practical plan to help you feel in control again, at a pace that suits you."],
   faqs=[("Can anxiety really be treated without medication?","Yes. Many people manage anxiety successfully through therapy alone, particularly CBT. If medication is ever appropriate, we'll discuss it openly."),
         ("How soon will I feel better?","Many people notice relief within a few sessions as they learn tools to manage symptoms, though lasting change builds over time."),
         ("Is it confidential?","Completely. Everything you share stays private.")]),
 dict(slug="depression-treatment-karachi", h1="Depression Treatment in Karachi", service="individual-psychotherapy",
   title="Depression Treatment & Counseling in Karachi | MindCare Services®",
   desc="Compassionate depression treatment and counseling in Karachi. Evidence-based therapy for low mood, hopelessness and loss of motivation. Book a free consultation today.",
   lede="When everything feels heavy and joy feels far away, that's not weakness or laziness. It can be depression, and help genuinely works. We're here in Karachi when you're ready.",
   signs=["Persistent low mood or sadness","Loss of interest in things you used to enjoy","Low energy, motivation or focus","Changes in sleep or appetite","Feeling hopeless, worthless or numb"],
   help=["Depression is one of the most treatable mental health conditions. Our therapists use evidence-based approaches to help you gently rebuild energy, motivation and hope.","There's nothing you need to 'prove' to deserve support. A free, confidential consultation is a safe first step toward feeling like yourself again."],
   faqs=[("How do I know if it's depression or just a bad phase?","If low mood has lasted more than a couple of weeks and affects daily life, it's worth talking to someone. A consultation can bring clarity, and no diagnosis is needed to start."),
         ("Do you treat severe depression?","Yes, and where needed we coordinate appropriate care. Please reach out, or in an emergency, contact local emergency services."),
         ("Is therapy really effective for depression?","Yes. Evidence-based talk therapy is a proven, effective treatment for depression.")]),
 dict(slug="stress-management-karachi", h1="Stress & Burnout Therapy in Karachi", service="individual-psychotherapy",
   title="Stress Management & Burnout Therapy in Karachi | MindCare Services®",
   desc="Overwhelmed by stress or burnout in Karachi? Learn practical, evidence-based tools to manage stress and recover balance with MindCare Services®. Book a free consultation.",
   lede="Chronic stress and burnout don't just 'go away', but the right tools change everything. We help you understand your stress and build a calmer, more sustainable balance.",
   signs=["Feeling constantly overwhelmed or on edge","Exhaustion that rest doesn't fix","Irritability, tension or trouble switching off","Headaches, poor sleep or low focus","Losing motivation at work or home"],
   help=["We help you identify what's driving your stress and teach practical, proven techniques to regulate it, from thought strategies to healthier boundaries and routines.","Whether it's work, study, family or everything at once, you'll leave with real tools, not just talk."],
   faqs=[("Is burnout different from stress?","Burnout is what happens when stress goes unaddressed for too long, leading to deep exhaustion. Both respond well to support."),
         ("Do you offer corporate stress programs?","Yes. See our awareness sessions and trainings for teams and organizations."),
         ("How many sessions will I need?","It varies. Many people gain useful tools quickly; your therapist will suggest a realistic plan.")]),
 dict(slug="trauma-therapy-karachi", h1="Trauma Therapy in Karachi", service="individual-psychotherapy",
   title="Trauma Therapy & PTSD Support in Karachi | MindCare Services®",
   desc="Gentle, evidence-based trauma therapy in Karachi for difficult past experiences and PTSD symptoms. Safe, confidential support at MindCare Services®. Book today.",
   lede="Difficult experiences can leave a lasting mark, but healing is possible. Our trauma-informed therapists offer a safe, steady space to process the past at your own pace.",
   signs=["Flashbacks, nightmares or intrusive memories","Feeling on guard, jumpy or unsafe","Avoiding reminders of what happened","Emotional numbness or feeling disconnected","Difficulty trusting or feeling calm"],
   help=["Trauma therapy is never about forcing you to relive anything. We move gently and safely, helping your mind and body feel secure again.","You set the pace. Our role is to walk beside you with care, skill and complete confidentiality."],
   faqs=[("Do I have to talk about the trauma in detail?","No. Effective trauma work can happen without forcing you to relive details before you're ready. Safety comes first."),
         ("How long does trauma therapy take?","It's different for everyone. Your therapist will explain what to expect and adjust as you go."),
         ("Is it confidential?","Absolutely. Your story is yours, and stays private.")]),
 dict(slug="ocd-therapy-karachi", h1="OCD Therapy in Karachi", service="individual-psychotherapy",
   title="OCD Therapy & Treatment in Karachi | MindCare Services®",
   desc="Evidence-based OCD therapy in Karachi for intrusive thoughts and compulsions. Confidential, professional support at MindCare Services®. Book a free consultation.",
   lede="Obsessive thoughts and compulsions can be exhausting and isolating, but they respond well to the right therapy. We help you break the cycle in Karachi.",
   signs=["Unwanted, intrusive or distressing thoughts","Repetitive checking, washing or counting","Rituals that feel impossible to resist","Significant time lost to obsessions","Anxiety when routines are interrupted"],
   help=["OCD is treatable with structured, evidence-based therapy that helps you respond differently to intrusive thoughts and reduce compulsions over time.","We create a supportive, non-judgmental plan tailored to you, with small steps that add up to real relief."],
   faqs=[("Is OCD curable?","OCD is very manageable with the right therapy. Many people reduce symptoms dramatically and regain control of their time and peace of mind."),
         ("Do you treat 'pure O' (intrusive thoughts without visible rituals)?","Yes. Intrusive thoughts alone are a recognized form of OCD and are treatable."),
         ("Where do I start?","With a free, confidential consultation, and no pressure.")]),
 dict(slug="panic-attack-help-karachi", h1="Panic Attack Help in Karachi", service="individual-psychotherapy",
   title="Panic Attack Help & Treatment in Karachi | MindCare Services®",
   desc="Frightening panic attacks? MindCare Services® in Karachi offers effective therapy to understand and reduce panic attacks. Confidential support. Book a free consultation.",
   lede="Panic attacks can feel terrifying and come out of nowhere, but they're not dangerous, and therapy can dramatically reduce them. Help is here in Karachi.",
   signs=["Sudden racing heart or chest tightness","Shortness of breath or dizziness","A wave of intense fear or dread","Fear of losing control or 'going crazy'","Avoiding places where panic struck before"],
   help=["We help you understand what happens in your body during a panic attack, which itself reduces fear, then teach proven techniques to calm and prevent them.","Over time, most people gain real confidence that they can handle and reduce panic."],
   faqs=[("Are panic attacks dangerous?","They feel frightening but are not physically dangerous. Understanding this is a key part of recovery."),
         ("Can therapy stop panic attacks?","Yes. Evidence-based therapy is highly effective at reducing and often stopping panic attacks."),
         ("How quickly can I get help?","Reach out today via WhatsApp or the booking form, and we typically respond within a few hours.")]),
 dict(slug="marriage-couples-counseling-karachi", h1="Marriage & Couples Counseling in Karachi", service="family-counseling",
   title="Marriage & Couples Counseling in Karachi | MindCare Services®",
   desc="Rebuild communication and connection with marriage and couples counseling in Karachi. Neutral, confidential guidance at MindCare Services®. Book a free consultation.",
   lede="Every relationship hits hard patches. Couples counseling gives you a neutral, caring space to be heard, understand each other, and rebuild connection.",
   signs=["The same arguments on repeat","Feeling unheard or distant","Trust or communication breakdowns","Struggling through a major life change","Wanting to reconnect but not knowing how"],
   help=["Our counselors help both partners feel heard, then gently surface the patterns behind the conflict so you can change them together.","Sessions are fair, warm and practical, and you'll learn real communication skills you can use at home."],
   faqs=[("What if my partner won't come?","You can start on your own. Individual work often helps the relationship too, and partners sometimes join later."),
         ("Do you take sides?","Never. Our role is neutral: to help both of you feel understood."),
         ("Is it confidential?","Yes, completely.")]),
 dict(slug="teen-adolescent-therapy-karachi", h1="Teen & Adolescent Therapy in Karachi", service="individual-psychotherapy",
   title="Teenage & Adolescent Therapy in Karachi | MindCare Services®",
   desc="Supportive therapy for teenagers in Karachi for anxiety, low mood, exam stress, self-esteem and more. Confidential, teen-friendly care at MindCare Services®.",
   lede="The teenage years can be overwhelming. We offer teen-friendly, confidential therapy in Karachi that helps young people feel understood and supported.",
   signs=["Anxiety, low mood or mood swings","Exam or academic pressure","Withdrawal from family or friends","Low self-esteem or identity struggles","Anger, irritability or acting out"],
   help=["We meet teens where they are, with no lectures and no judgment. Therapy helps them build confidence, coping skills and emotional resilience.","We also guide parents on how to support their teenager, while respecting the young person's privacy."],
   faqs=[("Will you tell my parents what I say?","We explain confidentiality clearly to every teen. Your trust matters, and we handle it with care."),
         ("What ages do you work with?","We support adolescents and young people; contact us with your child's age and we'll advise."),
         ("How do we start?","Book a free consultation and we'll take it from there, gently.")]),
 dict(slug="child-psychologist-karachi", h1="Child Psychologist in Karachi", service="behavioral-therapy",
   title="Child Psychologist in Karachi | Support for Children | MindCare Services®",
   desc="Looking for a child psychologist in Karachi? MindCare Services® supports children with behavior, emotions, development and learning. Caring, expert help. Book today.",
   lede="Every child deserves to be understood. Our specialists in Karachi support children's emotional, behavioral and developmental needs with warmth and expertise.",
   signs=["Big or frequent behavior challenges","Difficulty focusing or sitting still","Struggles with friendships or emotions","Developmental or learning concerns","Anxiety, fears or low mood in your child"],
   help=["We assess what's really going on, then build a caring, structured plan, often through play and positive, evidence-based methods children respond to.","Families are part of the process, so progress continues at home and school."],
   faqs=[("At what age can my child see a specialist?","Support is available from early childhood upward. If you've noticed a concern at any age, an assessment can help."),
         ("Do you support autism and ADHD?","Yes. See our behavioral therapy and occupational therapy services for structured, individualized support."),
         ("How do we begin?","Start with a free consultation. We'll listen and guide you.")]),
 dict(slug="adhd-assessment-therapy-karachi", h1="ADHD Support & Therapy in Karachi", service="behavioral-therapy",
   title="ADHD Support, Assessment & Therapy in Karachi | MindCare Services®",
   desc="ADHD support in Karachi for children and adults: assessment, behavioral therapy and practical strategies at MindCare Services®. Book a free consultation.",
   lede="ADHD isn't a lack of effort. It's how a brain is wired. We offer assessment and practical, evidence-based support in Karachi for children and adults.",
   signs=["Difficulty focusing or finishing tasks","Restlessness or impulsivity","Disorganization and forgetfulness","Struggles at school or work","Emotional overwhelm or frustration"],
   help=["We provide diagnostic assessment for clarity, then structured behavioral strategies and skills that help manage attention, organization and impulsivity.","Support is tailored to each person, with guidance for families, schools or workplaces where helpful."],
   faqs=[("Do you assess adults as well as children?","Yes. ADHD affects adults too, and assessment plus practical strategies can be life-changing."),
         ("Is behavioral therapy effective for ADHD?","Yes. Structured, evidence-based behavioral approaches are a core part of managing ADHD."),
         ("Where do we start?","With an assessment or a free consultation, whichever suits you.")]),
 dict(slug="grief-loss-counseling-karachi", h1="Grief & Loss Counseling in Karachi", service="individual-psychotherapy",
   title="Grief & Bereavement Counseling in Karachi | MindCare Services®",
   desc="Compassionate grief and bereavement counseling in Karachi. A safe space to process loss at your own pace with MindCare Services®. Book a free consultation.",
   lede="Grief has no timetable and no 'right' way to feel. We offer a gentle, understanding space in Karachi to carry loss and slowly find your footing again.",
   signs=["Overwhelming sadness or waves of grief","Feeling numb, lost or disconnected","Trouble sleeping, eating or functioning","Guilt, anger or difficult emotions","Struggling to move forward"],
   help=["There's no pressure to 'get over' anything. We simply walk beside you, helping you process loss in a way that honors what, or who, you've lost.","Support is patient, warm and entirely led by you."],
   faqs=[("Is it too soon (or too late) for grief counseling?","There's no wrong time. Whether the loss is recent or years ago, support can help."),
         ("What kinds of loss do you support?","Bereavement, but also other losses: relationships, health, identity or major change."),
         ("Is it confidential?","Yes, always.")]),
 dict(slug="anger-management-karachi", h1="Anger Management in Karachi", service="individual-psychotherapy",
   title="Anger Management Therapy in Karachi | MindCare Services®",
   desc="Anger management therapy in Karachi to understand triggers and respond calmly. Practical, confidential support at MindCare Services®. Book a free consultation.",
   lede="Anger is a normal emotion, but when it runs the show, it damages relationships and wellbeing. We help you understand and manage it in Karachi.",
   signs=["Frequent or intense outbursts","Regret after losing your temper","Tension in relationships or at work","Feeling like anger controls you","Physical signs like a racing heart or clenching"],
   help=["We help you spot your triggers and early warning signs, then build practical tools to respond calmly instead of reacting.","This isn't about suppressing anger. It's about being in control of it."],
   faqs=[("Can anger really be managed?","Yes. With the right tools most people gain real control over how they respond."),
         ("Is this just for extreme cases?","No. Anyone who feels their anger is harming their life or relationships can benefit."),
         ("How do I start?","Book a free, confidential consultation.")]),
 dict(slug="online-therapy-pakistan", h1="Online Therapy & Counseling in Pakistan", service="individual-psychotherapy",
   title="Online Therapy & Counseling in Pakistan | MindCare Services®",
   desc="Access professional therapy from anywhere in Pakistan. MindCare Services® offers confidential online counseling and psychotherapy. Book a free consultation.",
   lede="Can't visit in person? Support shouldn't depend on your postcode. We make professional, confidential therapy accessible across Pakistan.",
   signs=["You live outside Karachi","A busy schedule makes visits hard","You prefer the comfort of home","You want to start sooner rather than later","Privacy and convenience matter to you"],
   help=["Reach out to arrange a consultation and we'll discuss the options that work best for your situation and location.","Wherever you are, the same evidence-based, judgment-free care applies."],
   faqs=[("Do you offer sessions outside Karachi?","Contact us with your location and needs and we'll advise on the best way to support you."),
         ("Is online therapy effective?","For many concerns, yes. Remote therapy can be just as effective as in-person."),
         ("How do I book?","Message us on WhatsApp or use the booking form.")]),
 dict(slug="self-esteem-confidence-therapy-karachi", h1="Self-Esteem & Confidence Therapy in Karachi", service="individual-psychotherapy",
   title="Self-Esteem & Confidence Therapy in Karachi | MindCare Services®",
   desc="Build self-esteem and confidence with therapy in Karachi. Overcome self-doubt and harsh self-criticism at MindCare Services®. Book a free consultation.",
   lede="The way you talk to yourself shapes everything. Therapy helps you quiet the harsh inner critic and build genuine, lasting confidence.",
   signs=["Constant self-criticism or self-doubt","Feeling 'not good enough'","Fear of judgment or failure","Difficulty setting boundaries","Comparing yourself to others"],
   help=["We help you understand where low self-esteem comes from and gently build a kinder, stronger relationship with yourself.","Confidence isn't something you're born with. It's something you can build, and we'll show you how."],
   faqs=[("Can therapy really improve confidence?","Yes. Self-esteem is learnable, and therapy gives you the understanding and tools to build it."),
         ("How long does it take?","It varies, but many people feel a shift within a few sessions."),
         ("Is it confidential?","Completely.")]),
 dict(slug="best-psychologist-karachi", h1="Looking for a Psychologist in Karachi?", service="individual-psychotherapy",
   title="Psychologist in Karachi | Trusted Mental Health Care | MindCare Services®",
   desc="Searching for a trusted psychologist in Karachi? MindCare Services®, founded by PPA member Shaista Tariq, offers evidence-based, confidential care. Book today.",
   lede="Choosing the right support matters. MindCare Services® is a multidisciplinary mental health clinic in Karachi, founded by Shaista Tariq, a Member of the Pakistan Psychological Association (PPA).",
   signs=["You want evidence-based, professional care","You value confidentiality and warmth","You'd like a team, not just one option","You want a free first consultation","You're ready to feel better"],
   help=["Our team includes psychotherapists and a clinical psychologist, offering individual, family and specialized therapy, all under one roof.","Founded on the belief that no one should struggle alone, we make quality mental health care approachable and judgment-free."],
   faqs=[("What's the difference between a psychologist and psychotherapist?","Both provide talk therapy. Our clinic offers both, and we'll match you with the right professional for your needs."),
         ("Is the founder qualified?","Shaista Tariq is a Psychotherapist and personal Member of the Pakistan Psychological Association (PPA)."),
         ("How do I book?","Use the booking form or WhatsApp. The first consultation is free.")]),
 dict(slug="mental-health-clinic-karachi", h1="Mental Health Clinic in Karachi", service="individual-psychotherapy",
   title="Mental Health Clinic in Karachi | Therapy & Counseling | MindCare Services®",
   desc="MindCare Services® is a trusted mental health clinic in Karachi offering psychotherapy, counseling, and multidisciplinary therapy under one roof. Book a free consultation.",
   lede="A calm, professional place to get the support you need. MindCare Services® brings psychotherapy, counseling and multidisciplinary therapy together under one roof in Karachi.",
   signs=["You want everything in one trusted place","Individual, family or specialized therapy","A confidential, judgment-free environment","Evidence-based, professional care","A free first consultation"],
   help=["From psychotherapy and family counseling to speech, physio, occupational and behavioral therapy, our multidisciplinary team coordinates holistic care.","Whatever you're facing, there's a professional here who can help, and a first step that's free and confidential."],
   faqs=[("What services do you offer?","Psychotherapy, family counseling, speech and physiotherapy, occupational and behavioral therapy, assessments, dental consultations and more."),
         ("Do I need a referral?","No referral is needed. You can book directly."),
         ("Where are you located?","We're based in Karachi. Contact us for details and to book.")]),
 dict(slug="cbt-therapy-karachi", h1="CBT (Cognitive Behavioral Therapy) in Karachi", service="individual-psychotherapy",
   title="CBT: Cognitive Behavioral Therapy in Karachi | MindCare Services®",
   desc="Evidence-based CBT (Cognitive Behavioral Therapy) in Karachi for anxiety, depression, OCD and more at MindCare Services®. Practical, proven. Book a free consultation.",
   lede="CBT is one of the most researched, effective therapies in the world. It helps you change the thought and behavior patterns that keep you stuck. It is practical, structured and proven.",
   signs=["Anxiety, worry or panic","Depression or low mood","OCD or intrusive thoughts","Stress and overwhelm","Unhelpful thinking patterns"],
   help=["CBT is practical and goal-focused. You'll learn to notice unhelpful thoughts, test them, and replace them with more balanced, useful ones, with real tools between sessions.","Our therapists tailor CBT to you, so it fits your life and your goals."],
   faqs=[("What is CBT good for?","CBT is highly effective for anxiety, depression, OCD, panic, stress and more."),
         ("How long does CBT take?","It's often shorter-term and structured; your therapist will outline a realistic plan."),
         ("Is CBT evidence-based?","Yes. It's one of the most well-researched, proven talk therapies available.")]),
 dict(slug="workplace-mental-health-karachi", h1="Workplace & Corporate Mental Health in Karachi", service="awareness-sessions",
   title="Corporate & Workplace Mental Health Programs in Karachi | MindCare Services®",
   desc="Boost employee wellbeing with corporate mental health awareness sessions and trainings in Karachi from MindCare Services®. Reduce stigma, build resilience. Enquire now.",
   lede="Healthy teams start with mental wellbeing. We deliver certified workplace mental health workshops in Karachi that reduce stigma and build resilience.",
   signs=["Rising stress or burnout in your team","High absenteeism or low morale","You want a supportive workplace culture","Leadership wants practical wellbeing tools","You're planning a wellness initiative"],
   help=["Our tailored corporate programs, led by experienced professionals including PPA member Shaista Tariq, give your people real understanding and practical tools.","Every session is designed around your organization's goals, audience and context."],
   faqs=[("Can sessions be customized for our company?","Yes. Every program is tailored to your team, goals and industry."),
         ("Who leads the sessions?","Experienced professionals including our founder, Shaista Tariq (PPA Member)."),
         ("How do we arrange one?","Contact us with a little about your organization and we'll design a program with you.")]),
 dict(slug="speech-therapy-for-children-karachi", h1="Speech Therapy for Children in Karachi", service="speech-therapy",
   title="Speech Therapy for Children in Karachi | Language Delay Help | MindCare Services®",
   desc="Children's speech therapy in Karachi for language delays, articulation and stammering. Warm, structured, play-based support at MindCare Services®. Book an assessment.",
   lede="If your child is struggling to communicate, early support makes a huge difference. Our speech therapists in Karachi help children find their voice through playful, structured therapy.",
   signs=["Speech or language delay","Difficulty pronouncing sounds","Stammering or fluency issues","Trouble being understood","Autism-related communication needs"],
   help=["We start with a careful assessment, then build a fun, personalized plan of goal-driven exercises, often through play, that children respond to.","Parents get simple coaching to reinforce progress at home, so gains carry into everyday life."],
   faqs=[("What age should my child start?","Earlier is better, but it's never too late. An assessment will tell you if therapy would help."),
         ("How is progress measured?","Your therapist sets clear goals and reviews them regularly so you can see improvement."),
         ("How do we begin?","Book a speech therapy assessment or a free consultation.")]),
 dict(slug="physiotherapy-back-pain-karachi", h1="Physiotherapy for Back & Joint Pain in Karachi", service="physiotherapy",
   title="Physiotherapy for Back & Joint Pain in Karachi | MindCare Services®",
   desc="Relieve back, neck and joint pain with physiotherapy in Karachi. Hands-on treatment and tailored exercise from experienced physiotherapists. Book an assessment today.",
   lede="Persistent back, neck or joint pain shouldn't run your life. Our physiotherapists in Karachi find the real cause and build a plan to get you moving freely again.",
   signs=["Back, neck or joint pain","Stiffness or reduced mobility","Pain after injury or surgery","Poor posture or recurring strain","Chronic or nagging discomfort"],
   help=["We start with a thorough assessment to find the source of the problem, then combine hands-on treatment with a tailored exercise plan.","You'll also learn simple home exercises so you keep improving, and prevent the problem returning."],
   faqs=[("Do I need a referral?","No. You can book a physiotherapy assessment directly."),
         ("How many sessions will I need?","It depends on your condition; your physiotherapist will give a realistic estimate after assessment."),
         ("What do you treat?","Back and joint pain, sports and post-surgical injuries, posture issues and chronic pain, among others.")]),
]

TOPIC_SLUGS = [t["slug"] for t in TOPICS]


def seo_page(t):
    prefix = ""
    url = f"{BASE}/{t['slug']}"
    svc = SERVICE_BY_SLUG[t["service"]]
    schema = {"@context": "https://schema.org", "@graph": [
        {"@type": "MedicalWebPage", "@id": url + "#webpage", "url": url, "name": t["h1"],
         "description": t["desc"], "inLanguage": "en-PK",
         "about": {"@type": "MedicalClinic", "name": "MindCare Services®", "url": BASE},
         "audience": {"@type": "MedicalAudience", "geographicArea": {"@type": "City", "name": "Karachi"}},
         "speakable": {"@type": "SpeakableSpecification", "cssSelector": ["h1", ".lede"]}},
        {"@type": "BreadcrumbList", "itemListElement": [
            {"@type": "ListItem", "position": 1, "name": "Home", "item": f"{BASE}/"},
            {"@type": "ListItem", "position": 2, "name": "Guides", "item": f"{BASE}/guides"},
            {"@type": "ListItem", "position": 3, "name": t["h1"], "item": url}]},
        {"@type": "FAQPage", "mainEntity": [
            {"@type": "Question", "name": q, "acceptedAnswer": {"@type": "Answer", "text": a}} for q, a in t["faqs"]]},
    ]}
    signs = "\n".join(li(prefix, s) for s in t["signs"])
    help_p = "\n".join(f"        <p>{p}</p>" for p in t["help"])
    sibs = [x for x in TOPICS if x["slug"] != t["slug"]][:3]
    sib_cards = "\n".join(
        f'''      <a class="link-card fade-up" href="/{s['slug']}"><div class="fi">{icon(prefix,'i-heart-hands')}</div><h3>{s['h1']}</h3><p>{s['lede'][:92]}…</p><span class="more">Read more →</span></a>'''
        for s in sibs)
    out = head(t["title"], t["desc"], url, prefix, schema, og_type="article")
    out += nav(prefix)
    out += f"""<main id="main">
<header class="page-hero">
  <div class="ph-inner">
    <ol class="breadcrumb"><li><a href="/">Home</a></li><li><a href="/guides">Guides</a></li><li aria-current="page">{t['h1']}</li></ol>
    <div class="ph-badge">{icon(prefix,'i-heart-hands')} Confidential · Judgment-free · Karachi</div>
    <h1>{t['h1']}</h1>
    <p class="lede">{t['lede']}</p>
    <div class="ph-actions">
      <a href="/contact" class="btn-primary">Book Free Consultation</a>
      <a href="{WA}" target="_blank" rel="noopener" class="btn-secondary">Ask on WhatsApp</a>
    </div>
  </div>
</header>
<section>
  <div class="section-inner">
    <div class="detail-grid">
      <div class="detail-body fade-up">
        <h2>Signs it might be time to reach out</h2>
        <ul>
{signs}
        </ul>
        <h2>How we help</h2>
{help_p}
        <p style="margin-top:6px"><a href="/services/{svc['slug']}" class="more" style="font-weight:600">Learn about our {svc['name']} service →</a></p>
      </div>
      <aside class="aside-card fade-up">
        <h3>Take the first step</h3>
        <p>A free, confidential consultation is the easiest way to begin. No pressure, no judgment.</p>
        <ul class="aside-list">
          <li>{icon(prefix,'i-shield')} Evidence-based care</li>
          <li>{icon(prefix,'i-lock')} 100% confidential</li>
          <li>{icon(prefix,'i-clock')} Mon-Sat, 9am-7pm</li>
          <li>{icon(prefix,'i-phone')} {PHONE_H}</li>
        </ul>
        <div class="aside-actions">
          <a href="/contact" class="btn-primary" style="justify-content:center">Book a Consultation</a>
          <a href="{WA}" target="_blank" rel="noopener" class="btn-wa-block">{icon(prefix,'i-wa')} WhatsApp Us</a>
        </div>
      </aside>
    </div>
  </div>
</section>
{faq_block(prefix, t['faqs'])}
<section>
  <div class="section-inner">
    <div class="section-header centered fade-up"><span class="section-tag">Explore More</span><h2 class="section-title">Related support</h2></div>
    <div class="card-grid">
{sib_cards}
    </div>
    <div style="text-align:center;margin-top:32px" class="fade-up"><a href="/guides" class="btn-secondary">See all help topics →</a></div>
  </div>
</section>
{cta_band(prefix, "You don't have to figure this out alone.", "Reach out today. A free, confidential consultation is the first step.")}
</main>
"""
    out += footer(prefix)
    return out


def guides_index():
    prefix = ""
    url = f"{BASE}/guides"
    schema = {"@context": "https://schema.org", "@graph": [
        {"@type": "CollectionPage", "name": "Mental Health Help & Guides | MindCare Services®", "url": url,
         "description": "Guides and support pages for anxiety, depression, stress, trauma, relationships, children and more in Karachi."},
        {"@type": "BreadcrumbList", "itemListElement": [
            {"@type": "ListItem", "position": 1, "name": "Home", "item": f"{BASE}/"},
            {"@type": "ListItem", "position": 2, "name": "Guides", "item": url}]},
        {"@type": "ItemList", "itemListElement": [
            {"@type": "ListItem", "position": i + 1, "name": t["h1"], "url": f"{BASE}/{t['slug']}"}
            for i, t in enumerate(TOPICS)]}]}
    cards = "\n".join(
        f'''      <a class="link-card fade-up" href="/{t['slug']}"><div class="fi">{icon(prefix,'i-heart-hands')}</div><h3>{t['h1']}</h3><p>{t['lede'][:110]}…</p><span class="more">Read more →</span></a>'''
        for t in TOPICS)
    out = head("Mental Health Help & Guides in Karachi | Anxiety, Depression & More | MindCare Services®",
               "Find help for anxiety, depression, stress, trauma, relationships, children's needs and more in Karachi. Practical guides and support from MindCare Services®.",
               url, prefix, schema)
    out += nav(prefix)
    out += f"""<main id="main">
<header class="page-hero">
  <div class="ph-inner">
    <ol class="breadcrumb"><li><a href="/">Home</a></li><li aria-current="page">Guides</li></ol>
    <div class="ph-badge">{icon(prefix,'i-heart-hands')} Whatever you're facing</div>
    <h1>Find the <em>right support</em> for what you're going through</h1>
    <p class="lede">Not sure where to start? Pick what resonates below. Each guide explains the signs and how we can help, right here in Karachi.</p>
    <div class="ph-actions"><a href="/contact" class="btn-primary">Book Free Consultation</a></div>
  </div>
</header>
<section>
  <div class="section-inner">
    <div class="card-grid">
{cards}
    </div>
  </div>
</section>
{cta_band(prefix, "Still not sure what you need?", "That's completely okay. Tell us what's going on and we'll guide you, free and confidential.")}
</main>
"""
    out += footer(prefix)
    return out


# ─────────────────────────── ARTICLES ───────────────────────────
# Articles written by Shaista Tariq. Each one gets a dedicated page under
# /articles/<slug>.html; the original LinkedIn post is linked as the source.
#
# Body blocks: ("lead"|"p"|"h2", text) · ("ask", question) · ("quote", text)
#              ("ul", [items]) · ("kv", [(term, definition)]) · ("note", title, text)

MOTIFS = {
    # Mind vs. machine: a rule-following grid wired to an organic form
    "soul": '''<svg viewBox="0 0 200 140" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
      <rect x="16" y="36" width="66" height="66" rx="10" opacity=".55"/>
      <path d="M30 52h38M30 64h38M30 76h24M30 88h30" opacity=".4"/>
      <path d="M122 32c24 0 38 18 38 38s-14 38-38 38c-15 0-25-9-25-21 0-11 9-15 9-23 0-10-10-12-10-21 0-7 11-11 26-11Z" opacity=".95"/>
      <circle cx="130" cy="66" r="6" fill="currentColor" stroke="none" opacity=".9"/>
      <path d="M138 52c8 4 10 12 6 20" opacity=".6"/>
      <path d="M82 69h15" stroke-dasharray="2 6" opacity=".8"/>
    </svg>''',
    # Balance: what the work weighs against what it is paid
    "pay": '''<svg viewBox="0 0 200 140" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
      <path d="M100 26v88M76 114h48"/>
      <path d="M44 40h112" opacity=".9"/>
      <circle cx="100" cy="40" r="5" fill="currentColor" stroke="none"/>
      <path d="M44 40 26 84h36L44 40Z" opacity=".95"/>
      <path d="M156 40l-12 30h24l-12-30Z" opacity=".5"/>
      <path d="M26 84c4 8 32 8 36 0M144 70c3 6 21 6 24 0" opacity=".7"/>
    </svg>''',
    # Consistency plus correction: steady steps, gently re-aimed
    "consistency": '''<svg viewBox="0 0 200 140" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
      <path d="M22 104h156" opacity=".4"/>
      <circle cx="38" cy="104" r="6" opacity=".95"/><circle cx="72" cy="104" r="6" opacity=".85"/>
      <circle cx="106" cy="104" r="6" opacity=".75"/><circle cx="140" cy="104" r="6" opacity=".65"/>
      <circle cx="174" cy="104" r="6" opacity=".55"/>
      <path d="M30 76c30 4 52-6 62-24 8-14 22-20 40-18" opacity=".95"/>
      <path d="M120 30l14 4-6 13" opacity=".95"/>
    </svg>''',
    # Work: output falling away, and a door left open
    "work": '''<svg viewBox="0 0 200 140" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
      <rect x="22" y="46" width="24" height="66" rx="6" opacity=".95"/>
      <rect x="56" y="64" width="24" height="48" rx="6" opacity=".72"/>
      <rect x="90" y="82" width="24" height="30" rx="6" opacity=".5"/>
      <path d="M144 30h34v82h-34" opacity=".9"/>
      <path d="M162 72h-32M142 60l-14 12 14 12" opacity=".95"/>
    </svg>''',
}

ARTICLES = [
    dict(slug="the-soul-cannot-be-coded",
         title="The Soul Cannot Be Coded",
         kicker="Man vs. Machine: the Chinese Room and why processing is not consciousness",
         category="Philosophy of Mind",
         motif="soul", a1="#0f9aa8", a2="#5c58c9",
         date="2026-03-03", date_h="3 March 2026",
         url="https://www.linkedin.com/pulse/soul-cannot-coded-shaista-tariq-pp4df/",
         blurb="A philosophical dialogue on consciousness, machines and the irreducible human, and why empathy, presence and the human soul can never truly be coded.",
         desc="Shaista Tariq on the Chinese Room, instinct, the subconscious and the soul as scientific inference: a philosophical case for why human consciousness cannot be replicated by machines.",
         takeaways=[
             "Instinct comes before training. No one programs hunger into a newborn.",
             "Machines have no subconscious, so no hidden depth shapes what they say.",
             "A functionally perfect replica still never becomes the original.",
             "We already accept non-physical realities: thoughts, logic, numbers.",
         ],
         body=[
             ("lead", "Can a machine truly think? Can it feel? Can it understand? These are not merely academic questions; they are among the most consequential questions of our time, as artificial intelligence grows more sophisticated and more embedded in human life."),
             ("p", "What follows is a philosophical dialogue that begins with a classic thought experiment and arrives somewhere most Western philosophy has never dared to go: the argument that the human soul, understood not as a religious abstraction but as a scientific inference, is the unbridgeable gap between human consciousness and any machine."),
             ("note", "An original work of philosophical reasoning", "The arguments developed here emerged organically through conversation, built not from textbooks, but from genuine inquiry into what makes a human being irreducibly human."),
             ("h2", "The experiment under discussion: the Chinese Room, and why it is not enough"),
             ("p", "John Searle's famous thought experiment imagines a person locked in a room, receiving messages in Chinese. Using a comprehensive rulebook, they produce correct Chinese responses without understanding a single word. Searle's argument: this is exactly what computers do. They manipulate symbols according to rules. They have syntax, but no semantics. No matter how sophisticated the program, the room never understands Chinese."),
             ("p", "Most philosophical responses to this challenge debate the mechanics, asking whether the &ldquo;system as a whole&rdquo; understands even if the person inside does not. But there is a deeper and more revealing challenge to ask: even if the room produced a perfect answer, a human who genuinely understood Chinese might have answered <em>differently</em>. Not wrongly, but differently. Because a human brings something the rulebook does not have: an opinion."),
             ("quote", "This distinction between <em>the correct answer</em> and <em>my answer</em> is one the Chinese Room can never bridge."),
             ("p", "The room gives what it was built to give. A human gives what they, specifically and irreducibly, choose to give. The source of that difference is the central problem this essay investigates. What follows are the distinctions that separate humans from machines, and the rationales for the questions the Chinese Room leaves open."),
             ("h2", "Part I. Instinct, need, and the stake in existence"),
             ("ask", "If an AI can simulate human needs perfectly, does it actually experience the &ldquo;drive&rdquo; behind those needs?"),
             ("p", "A baby does not learn to cry for milk. No one programs hunger into a newborn. The drive comes from within, from billions of years of evolution encoded in biology prior to any training, any instruction, any input from the outside world. This is the first and perhaps most important distinction between human consciousness and artificial intelligence."),
             ("p", "A computer starts as pure zero. Whatever it knows, whatever it appears to feel, was put there by someone else. It is borrowed consciousness at best, not original. It has no stake in anything. It does not fear death, does not hunger, has no skin in the game. Philosophers call this <em>intentionality</em>: the idea that all human thought is <em>about</em> something, driven by desire, fear, need. The Chinese Room processes, but wants nothing."),
             ("p", "One might ask: does a thermostat &ldquo;want&rdquo; warmth? Does a virus &ldquo;want&rdquo; to survive? The answer illuminates the point rather than undermining it. We call these processes drives only by analogy. The virus has no experience of wanting. The thermostat has no awareness of cold. But a hungry child does not merely behave as if they want milk; they <em>want</em> it, in the full phenomenological sense. That wanting arises from within, not from programming."),
             ("h2", "Part II. The three levels: what computers cannot have"),
             ("ask", "If a machine has no subconscious, no dreams and no biological trauma, can it ever truly &ldquo;understand&rdquo; the human experience, or is it just replicating the surface of our thoughts?"),
             ("p", "Human consciousness operates across three levels: the conscious, the subconscious and the unconscious. Most of what the brain does is below awareness. Generational memory, instincts, fears, attractions, all baked into a person before they are born. Dreams are not random noise; they are the subconscious processing what the conscious mind could not."),
             ("p", "A computer has no subconscious. It has no suppressed drives bubbling up to influence its outputs in ways it cannot explain. Everything a computer does is explicit. There is no hidden layer of unresolved experience shaping its responses. It absorbs information. Humans pass it through generations, filtered through biology, trauma, love and time."),
             ("p", "This is perhaps the deepest structural difference. The subconscious is not merely a feature of human psychology; it is evidence of an interior life that has depth, layers, and a history that no input-output machine can replicate."),
             ("h2", "Part III. The brand and the replica: on origin and authenticity"),
             ("ask", "If a replica is functionally perfect, does it ever truly become the original? Or is there an &ldquo;essence&rdquo; of origin that a machine can never inherit, no matter how sophisticated its code?"),
             ("p", "Why can a replica never truly be the original? Not merely because of quality, since a perfect replica might be functionally indistinguishable. The difference is one of origin and authority. The original carries something the copy structurally cannot have, regardless of how perfect the imitation becomes."),
             ("p", "Humans are the original. Artificial intelligence is the replica. No matter how sophisticated the copy becomes, it cannot carry what the original <em>is</em>, because it did not come from the same source."),
             ("p", "This observation leads to a profound implication. If humans wanted to truly replicate themselves, nature already provided the method: reproduction. Birth is not copying data. It is passing something forward, instinct, essence, the irreducible human quality, through a process we did not design and do not fully control. A born child is unpredictable. You cannot determine what they will become. That unpredictability is not a flaw; it is proof that something real is happening, something beyond programming."),
             ("p", "A computer's &ldquo;child&rdquo; is just another program. Fully controlled. Fully predictable in principle. This is not a difference in degree; it is a difference in kind."),
             ("h2", "Part IV. The aether argument: soul as scientific inference"),
             ("ask", "If we accept the existence of dark matter because of its effect on the universe, why do we hesitate to accept a soul when human consciousness behaves as if one exists?"),
             ("p", "In the history of science, there is a recurring pattern: something is accepted as real before it is proven, because the evidence of its effects demands it. Aether was proposed because space behaved as if something filled it: objects moved, light propagated, forces acted across apparent voids. Dark matter is the contemporary version: invisible, undetected directly, yet required by the mathematics of galactic motion."),
             ("p", "The soul should be understood in precisely this way. We cannot see it, touch it or measure it directly. But human behaviour, including consciousness, creativity, love, sacrifice and the experience of meaning, only makes complete sense if something like the soul exists. This is not a religious argument. It is a scientific-style inference from observed effects to necessary cause."),
             ("p", "Physics has already established that human perception covers only a narrow slice of reality. Frequencies exist below and above what we can hear. Colours exist beyond what we can see. Quantum mechanics describes a reality that functionally exists but that no human can directly perceive or intuit. Dimensions beyond the three we experience may be real. The soul operating on a frequency or dimension beyond current sensory range is not mystical. It is consistent with how science already understands the limits of perception."),
             ("h2", "Part V. Thoughts without proof: the strongest argument"),
             ("ask", "If we accept that numbers and logic are real despite being non-physical, why do we demand physical proof for the existence of the human soul?"),
             ("p", "Here is the argument that most completely exposes the inconsistency of materialist scepticism about the soul: we already accept the existence of something non-physical as the foundation of all knowledge."),
             ("p", "Thoughts exist. No one disputes this. Yet no one has ever touched a thought, seen a thought, or held a thought in their hand. Science itself operates on thoughts. Logic is a thought. Mathematics is a thought. The number seven has never been located in physical space. And yet civilisation is built on the reality of these non-physical things."),
             ("quote", "If we accept thoughts as real without physical proof, and we do, completely, without question, then the burden-of-proof argument against the soul loses its force."),
             ("p", "We have already conceded that non-physical things can be real. The question is not <em>whether</em> non-physical reality exists. We know it does. The question is only how far it extends."),
             ("p", "Spirituality, the dimension of the soul accessible through inner experience, exists across every human culture and every era of history. It appears in all religions, and in the lives of those who claim no religion at all. Atheists describe experiences of transcendence, awe and meaning that exceed the mechanical. This universality is not proof of a particular religious tradition. It is evidence of something in the human constitution that points beyond the physical, something the Chinese Room will never have, no matter how its rulebook grows."),
             ("h2", "Conclusion: what machines will never be"),
             ("p", "The argument developed in this essay can be stated plainly. Human consciousness is not a sophisticated information-processing system that could, in principle, be replicated by sufficiently advanced machines. It is something different in kind: arising from a biological origin that is prior to training, driven by instincts that predate birth, structured by layers of subconscious depth that no explicit program can reproduce, authenticated by an origin that no replica can share, and animated by a soul whose existence is scientifically inferrable even if not yet scientifically measurable."),
             ("p", "To create something truly like a human, you cannot build it. You must grow it. Reproduction is not a workaround; it is the only method that works, because it is the only method that passes the irreducible thing forward. The soul is not installed. It is inherited, generated, born."),
             ("quote", "The Chinese Room will always give the correct answer. But it will never give <em>its</em> answer."),
             ("p", "And in that gap, between the correct and the personal, between the programmed and the willed, between the processed and the felt, lives everything that makes a human being human."),
         ]),
    dict(slug="cost-of-professionalism-vs-reality-of-pay",
         title="The Cost of Professionalism vs. The Reality of Pay",
         kicker="What psychology graduates are offered, and what the law says they are owed",
         category="Work & Ethics",
         motif="pay", a1="#d9743a", a2="#a03418",
         date="2026-02-16", date_h="16 February 2026",
         url="https://www.linkedin.com/pulse/cost-professionalism-vs-reality-pay-shaista-tariq-sv88f/",
         blurb="Burnout is common, but we rarely ask why. An honest look at the gap between the professionalism expected of care workers and the reality of how that work is paid.",
         desc="Shaista Tariq on underpaid psychology roles in Pakistan: what Sindh's minimum wage law actually requires of clinics, hospitals and NGOs, and why underpayment fuels burnout.",
         takeaways=[
             "Sindh's notified minimum wage for a skilled worker in 2025-26 is around PKR 49,628 a month.",
             "Private hospitals, clinics and NGOs count as commercial establishments and are covered.",
             "Labelling a formal role an &ldquo;internship&rdquo; does not remove the legal minimum.",
             "Underpaying trained care workers is a direct route to burnout and attrition.",
         ],
         body=[
             ("lead", "Burnout during work is a common thing, but we have to ask why and how it happens. I recently saw a post from a mental health firm offering only PKR 25,000 for a psychologist with two years of experience in addiction care. Like, seriously? Is it even worth wasting our money on degrees?"),
             ("p", "As a psychology learner, this hurts. I assume this happens in other fields as well, but based on this example, it reminds me of one of my own experiences. For my first pay, I worked 12-hour shifts for only PKR 25,000. I have no personal regrets, because it was good learning and I wasn't struggling financially. But what about those who really need a job to support themselves or their families?"),
             ("h2", "What the government says"),
             ("p", "Now, take a look at what the government says about this. According to the latest notification for the 2025-2026 fiscal year, the minimum wage for a skilled worker in Sindh has been set at approximately <strong>PKR 49,628 per month</strong>."),
             ("p", "Moreover, the law mandates that no industrial or commercial establishment, which includes private hospitals, clinics and NGOs, can pay a worker less than the notified rate for their skill category."),
             ("h2", "Which specific laws state this?"),
             ("p", "There are three main legal instruments that define and protect your initial salary limits:"),
             ("kv", [
                 ("Sindh Minimum Wages Act, 2015", "This is the primary law. Section 6 gives the government the power to declare minimum wage rates that employers must follow."),
                 ("Minimum Wages Ordinance, 1961", "This defines a &ldquo;worker&rdquo; as anyone performing skilled, unskilled, intellectual or clerical work."),
                 ("The Annual Minimum Wage Notification (2025-26)", "Issued by the Labour &amp; Human Resources Department, Government of Sindh. This explicitly lists the PKR 49,628 rate for skilled professionals."),
             ]),
             ("note", "Important note on &ldquo;establishments&rdquo;", "By law, specifically the Sindh Terms of Employment Act, 2015, these regulations apply to all commercial establishments. While some small private practices might try to bypass this by calling a role an &ldquo;internship&rdquo;, any formal employment contract for a BS Psychology graduate must legally honour the skilled-worker minimum rate."),
             ("h2", "A call to action for students"),
             ("p", "As a psychology student, I think we all should take a step for this. I have seen professionals spending millions on their Masters and MPhil degrees, only to earn 25k? Seriously?"),
             ("p", "In the next part, we will discuss this further. However, anyone can put their thoughts on it now. What do you think?"),
         ]),
    dict(slug="consistency-vs-correction",
         title="Consistency vs. Correction",
         kicker="Why showing up every day only works when you also check the direction",
         category="Growth & Practice",
         motif="consistency", a1="#2D6A1F", a2="#0f9aa8",
         date="2026-01-22", date_h="22 January 2026",
         url="https://www.linkedin.com/pulse/consistency-vs-correction-shaista-tariq-3ozpf/",
         blurb="What matters more: consistency, or correcting your direction? For me it isn't a debate: consistency only works when it is paired with regular self-correction.",
         desc="Shaista Tariq on why consistency alone leads to burnout or stagnation, and how pairing steady effort with regular self-correction turns work into meaningful growth.",
         takeaways=[
             "Consistency does not work automatically on its own.",
             "Effort without alignment feels productive, until it doesn't.",
             "Unreflected repetition often ends in burnout or stagnation.",
             "Real progress is steady effort plus a continuously refined path.",
         ],
         body=[
             ("lead", "The question often comes up: what matters more: consistency in your work, or correcting your direction from time to time? For me, this isn't a debate. People are free to see it from their own perspective."),
             ("p", "From my point of view, both consistency and correction are equally important. Consistency only works when it is paired with regular self-correction. Showing up every day matters, but so does checking whether you're moving in the right direction."),
             ("p", "Consistency doesn't work automatically on its own. If you keep working without pausing to reflect and adjust your approach, it can lead to a substantial and unreliable waste of energy. Effort without alignment may feel productive, but over time it often results in burnout or stagnation."),
             ("quote", "Real progress comes from staying consistent while continuously refining the path."),
             ("p", "That balance is what turns effort into meaningful growth. Of course, this is my personal perspective, and yours may differ."),
         ]),
    dict(slug="why-people-leave-jobs-and-productivity-drops",
         title="Why People Leave Jobs, Productivity Drops &amp; Businesses Struggle",
         kicker="Low productivity is rarely laziness. It is biology, rhythm and rigid hiring",
         category="Workplace Psychology",
         motif="work", a1="#4a63cf", a2="#0b5f6d",
         date="2026-01-21", date_h="21 January 2026",
         url="https://www.linkedin.com/pulse/why-people-leave-jobs-productivity-drops-businesses-struggle-tariq-ey6zf/",
         blurb="The psychological and human factors behind disengagement, burnout and turnover at work, and what leaders can do to genuinely support their people.",
         desc="Shaista Tariq on why productivity drops and people leave jobs: focus cycles, individual working rhythms, rigid schedules, and the shared responsibility of managers and employees.",
         takeaways=[
             "Of 6-8 active hours a day, only about 3-5 are genuinely productive.",
             "Deep focus lasts 60-90 minutes; breaks are essential, not a luxury.",
             "Rigid schedules assume time spent equals work done.",
             "Responsibility for low productivity is shared by managers and employees.",
         ],
         body=[
             ("lead", "Over time, I've noticed a recurring pattern behind low productivity and the gradual decline of many businesses. While there are multiple reasons, one factor stands out clearly from my personal experience: the way people are hired and managed."),
             ("p", "Hiring is often treated as a checklist process: fill the position, set the hours, assign the tasks. But productivity doesn't work that way. The human brain may stay active for 6-8 hours a day, yet only about 3-5 hours are genuinely productive. Deep focus usually lasts 60-90 minutes, after which efficiency drops. This is not laziness; it's biology. Regular breaks are not a luxury; they are essential for maintaining mental clarity and long-term performance."),
             ("h2", "Everyone works to a different rhythm"),
             ("p", "What I've also observed is that everyone has a different working capacity and rhythm. Some people perform best in the morning, others later in the day. Many individuals naturally develop an entrepreneurial mindset, and they know how and when they work best. Unfortunately, this potential often goes unnoticed. Instead of nurturing self-reliant routines, many organisations emphasise rigid schedules and fixed working hours, assuming that time spent equals work done."),
             ("h2", "So who is responsible?"),
             ("ask", "Who is responsible for low productivity: hiring managers, or employees?"),
             ("p", "The honest answer is: <strong>both</strong>."),
             ("p", "In some workplaces, employees understand their productivity levels and preferred work styles but are not given the freedom to apply them. They're expected to follow a one-size-fits-all routine, even if it limits their efficiency. In other cases, hiring managers lack an understanding of how productivity truly works, overlooking the importance of flexibility, mental fatigue and individual strengths."),
             ("quote", "Productivity isn't about controlling people. It's about understanding them."),
             ("p", "Businesses grow when employers trust their teams and employees take ownership of their responsibilities. When both sides meet halfway, people stay longer, productivity improves, and businesses become more resilient."),
         ]),
]


def _plain(x):
    return re.sub(r"<[^>]+>", " ", re.sub(r"&[a-z]+;", " ", x))


def read_time(a):
    words = 0
    for b in a["body"]:
        for part in b[1:]:
            if isinstance(part, str):
                words += len(_plain(part).split())
            else:
                for it in part:
                    seq = it if isinstance(it, (tuple, list)) else (it,)
                    words += sum(len(_plain(x).split()) for x in seq)
    return max(1, round(words / 200))


def art_body(blocks):
    out = []
    for b in blocks:
        kind = b[0]
        if kind == "lead":
            out.append(f'<p class="art-lead">{b[1]}</p>')
        elif kind == "p":
            out.append(f"<p>{b[1]}</p>")
        elif kind == "h2":
            out.append(f"<h2>{b[1]}</h2>")
        elif kind == "ask":
            out.append(f'<div class="art-ask"><span>The question</span><p>{b[1]}</p></div>')
        elif kind == "quote":
            out.append(f"<blockquote>{b[1]}</blockquote>")
        elif kind == "ul":
            items = "".join(f"<li>{i}</li>" for i in b[1])
            out.append(f'<ul class="art-ul">{items}</ul>')
        elif kind == "kv":
            rows = "".join(f"<div class=\"art-kv\"><dt>{t}</dt><dd>{d}</dd></div>" for t, d in b[1])
            out.append(f'<dl class="art-kvs">{rows}</dl>')
        elif kind == "note":
            out.append(f'<aside class="art-note"><h4>{b[1]}</h4><p>{b[2]}</p></aside>')
    return "\n      ".join(out)


def art_motif(a, cls="art-art"):
    return (f'<div class="{cls}" style="--a1:{a["a1"]};--a2:{a["a2"]}">'
            f'{MOTIFS[a["motif"]]}</div>')


def art_url(a):
    return f"{BASE}/articles/{a['slug']}"


def article_page(a, idx):
    prefix = "../"
    url = art_url(a)
    plain_title = html.unescape(a["title"])
    share = urlquote(url, safe="")
    wa_share = "https://wa.me/?text=" + urlquote(f"{plain_title}: {url}", safe="")
    schema = {"@context": "https://schema.org", "@graph": [
        {"@type": "BlogPosting", "headline": plain_title, "url": url, "mainEntityOfPage": url,
         "description": a["desc"], "datePublished": a["date"], "dateModified": a["date"],
         "articleSection": a["category"], "inLanguage": "en",
         "image": f"{BASE}/mindcare.png",
         "author": {"@type": "Person", "name": "Shaista Tariq", "url": f"{BASE}/team/shaista-tariq",
                    "jobTitle": "Founder & Associate Psychologist"},
         "publisher": {"@type": "Organization", "name": "MindCare Services®", "url": BASE,
                       "logo": {"@type": "ImageObject", "url": f"{BASE}/mindcare.png"}},
         "isBasedOn": a["url"]},
        {"@type": "BreadcrumbList", "itemListElement": [
            {"@type": "ListItem", "position": 1, "name": "Home", "item": f"{BASE}/"},
            {"@type": "ListItem", "position": 2, "name": "Articles", "item": f"{BASE}/articles"},
            {"@type": "ListItem", "position": 3, "name": plain_title, "item": url}]}]}
    mins = read_time(a)
    takeaways = "\n        ".join(
        f"<li>{icon(prefix,'i-check','20')}<span>{t}</span></li>" for t in a["takeaways"])
    prev_a = ARTICLES[idx - 1] if idx > 0 else None
    next_a = ARTICLES[idx + 1] if idx < len(ARTICLES) - 1 else None
    pn = ""
    if prev_a:
        pn += (f'      <a href="/articles/{prev_a["slug"]}" class="pv"><span class="art-pn-l">← Previous</span>'
               f'<strong>{prev_a["title"]}</strong></a>\n')
    if next_a:
        pn += (f'      <a href="/articles/{next_a["slug"]}" class="nx"><span class="art-pn-l">Next →</span>'
               f'<strong>{next_a["title"]}</strong></a>\n')
    others = [x for x in ARTICLES if x["slug"] != a["slug"]][:3]
    more = "\n".join(art_card(x) for x in others)

    out = head(f"{plain_title} | Shaista Tariq | MindCare Services®", a["desc"], url, prefix,
               schema, og_type="article")
    out += nav(prefix, "articles")
    out += f"""<main id="main">
<header class="page-hero art-hero" style="--a1:{a['a1']};--a2:{a['a2']}">
  <div class="ph-inner">
    <ol class="breadcrumb"><li><a href="/">Home</a></li><li><a href="/articles">Articles</a></li><li aria-current="page">{a['title']}</li></ol>
    {art_motif(a, 'art-art art-hero-motif')}
    <span class="art-chip">{a['category']}</span>
    <h1>{a['title']}</h1>
    <p class="lede">{a['kicker']}.</p>
    <div class="art-byline">
      <span class="art-avatar">{AV['shaista']}</span>
      <span class="art-by-who">
        <a class="art-by-name" href="/team/shaista-tariq">Shaista Tariq</a>
        <span class="art-by-role">Founder &amp; Associate Psychologist · PPA Member</span>
      </span>
      <span class="art-by-meta"><time datetime="{a['date']}">{a['date_h']}</time> · {mins} min read</span>
    </div>
  </div>
</header>

<section>
  <div class="section-inner">
    <div class="detail-grid">
      <article class="article-body fade-up">
        <div class="art-takeaways">
          <h2 class="art-tk-title">In short</h2>
          <ul>
        {takeaways}
          </ul>
        </div>
      {art_body(a['body'])}
        <div class="art-end">
          <span class="art-avatar sm">{AV['shaista']}</span>
          <p>Written by <a href="/team/shaista-tariq">Shaista Tariq</a>, founder of MindCare Services®. Originally published on LinkedIn. <a href="{a['url']}" target="_blank" rel="noopener">read the original post ↗</a></p>
        </div>
      </article>
      <aside class="aside-card fade-up">
        <h3>Article details</h3>
        <ul class="aside-list">
          <li>{icon(prefix,'i-book')} {a['category']}</li>
          <li>{icon(prefix,'i-clock')} {mins} min read</li>
          <li>{icon(prefix,'i-grad')} Published {a['date_h']}</li>
          <li>{icon(prefix,'i-globe')} <a href="{a['url']}" target="_blank" rel="noopener">Original on LinkedIn</a></li>
        </ul>
        <h3>Share this</h3>
        <div class="art-share">
          <a class="art-share-btn" href="https://www.linkedin.com/sharing/share-offsite/?url={share}" target="_blank" rel="noopener" aria-label="Share on LinkedIn"><svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M20.45 20.45h-3.55v-5.57c0-1.33-.03-3.04-1.85-3.04-1.86 0-2.14 1.45-2.14 2.94v5.67H9.35V9h3.41v1.56h.05c.48-.9 1.64-1.85 3.37-1.85 3.6 0 4.27 2.37 4.27 5.46v6.28ZM5.34 7.43a2.06 2.06 0 1 1 0-4.13 2.06 2.06 0 0 1 0 4.13Zm1.78 13.02H3.56V9h3.56v11.45ZM22.22 0H1.77C.79 0 0 .77 0 1.73v20.54C0 23.23.79 24 1.77 24h20.45c.98 0 1.78-.77 1.78-1.73V1.73C24 .77 23.2 0 22.22 0Z"/></svg><span>LinkedIn</span></a>
          <a class="art-share-btn" href="{wa_share}" target="_blank" rel="noopener" aria-label="Share on WhatsApp"><svg fill="currentColor" aria-hidden="true"><use href="{prefix}assets/sprite.svg#i-wa"/></svg><span>WhatsApp</span></a>
          <button type="button" class="art-share-btn" data-copy="{url}"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="9" y="9" width="12" height="12" rx="2.5"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg><span>Copy link</span></button>
        </div>
        <h3>Talk to someone</h3>
        <p>If anything here resonated, a free and confidential consultation is a good place to start.</p>
        <div class="aside-actions">
          <a href="/contact" class="btn-primary" style="justify-content:center">Book a Consultation</a>
          <a href="{WA}" target="_blank" rel="noopener" class="btn-wa-block">{icon(prefix,'i-wa')} WhatsApp Us</a>
        </div>
      </aside>
    </div>
  </div>
</section>

<section class="bg-off">
  <div class="section-inner">
    <div class="section-header fade-up"><span class="section-tag">Keep reading</span><h2 class="section-title">More from Shaista</h2></div>
    <div class="art-pn fade-up">
{pn}    </div>
    <div class="art-grid" style="margin-top:22px">
{more}
    </div>
  </div>
</section>

{cta_band(prefix, "Have something on your mind?", "Whether it's for you or someone you care about, we're here. Reach out for a free, confidential consultation.")}
</main>
"""
    out += footer(prefix)
    return out


def art_card(a):
    """Magazine-style card used on the index and in 'keep reading' rails."""
    href = f"/articles/{a['slug']}"
    return f'''      <article class="art-card fade-up" style="--a1:{a['a1']};--a2:{a['a2']}">
        {art_motif(a)}
        <div class="art-card-body">
          <span class="art-chip">{a['category']}</span>
          <h3><a href="{href}">{a['title']}</a></h3>
          <p>{a['blurb']}</p>
          <div class="art-card-foot">
            <span class="art-date"><time datetime="{a['date']}">{a['date_h']}</time> · {read_time(a)} min</span>
            <span class="more">Read →</span>
          </div>
        </div>
      </article>'''


def articles_index():
    prefix = ""
    url = f"{BASE}/articles"
    lead, rest = ARTICLES[0], ARTICLES[1:]
    schema = {"@context": "https://schema.org", "@graph": [
        {"@type": "Blog", "name": "Articles by Shaista Tariq | MindCare Services®", "url": url,
         "description": "Articles and reflections by Shaista Tariq, founder of MindCare Services®, on mental health, care, workplaces and the human side of psychology.",
         "author": {"@type": "Person", "name": "Shaista Tariq", "url": f"{BASE}/team/shaista-tariq"},
         "blogPost": [
             {"@type": "BlogPosting", "headline": html.unescape(a["title"]), "url": art_url(a),
              "datePublished": a["date"], "description": a["desc"],
              "author": {"@type": "Person", "name": "Shaista Tariq"}} for a in ARTICLES]},
        {"@type": "BreadcrumbList", "itemListElement": [
            {"@type": "ListItem", "position": 1, "name": "Home", "item": f"{BASE}/"},
            {"@type": "ListItem", "position": 2, "name": "Articles", "item": url}]},
        {"@type": "ItemList", "itemListElement": [
            {"@type": "ListItem", "position": i + 1, "name": html.unescape(a["title"]), "url": art_url(a)}
            for i, a in enumerate(ARTICLES)]}]}
    cards = "\n".join(art_card(a) for a in rest)
    topics = "".join(f'<span class="art-pill">{a["category"]}</span>' for a in ARTICLES)
    out = head("Articles by Shaista Tariq | Mental Health, Care & Workplaces | MindCare Services®",
               "Articles and reflections by Shaista Tariq, founder of MindCare Services® in Karachi, on mental health, the human side of care, workplaces and behaviour. Read them in full here.",
               url, prefix, schema)
    out += nav(prefix, "articles")
    out += f"""<main id="main">
<header class="page-hero">
  <div class="ph-inner">
    <ol class="breadcrumb"><li><a href="/">Home</a></li><li aria-current="page">Articles</li></ol>
    <div class="ph-badge">{icon(prefix,'i-book')} {len(ARTICLES)} essays &amp; reflections</div>
    <h1>Articles by <em>Shaista Tariq</em></h1>
    <p class="lede">Long-form writing on mental health, the human side of care, workplaces and behaviour, by the founder of MindCare Services®. Every piece is here in full, no login required.</p>
    <div class="art-pills">{topics}</div>
    <div class="ph-actions"><a href="/team/shaista-tariq" class="btn-secondary">About Shaista →</a></div>
  </div>
</header>
<section>
  <div class="section-inner">
    <div class="section-header fade-up"><span class="section-tag">Latest</span></div>
    <article class="art-feature fade-up" style="--a1:{lead['a1']};--a2:{lead['a2']}">
      {art_motif(lead)}
      <div class="art-feature-body">
        <span class="art-chip">{lead['category']}</span>
        <h2><a href="/articles/{lead['slug']}">{lead['title']}</a></h2>
        <p class="art-kicker">{lead['kicker']}</p>
        <p>{lead['blurb']}</p>
        <div class="art-card-foot">
          <span class="art-date"><time datetime="{lead['date']}">{lead['date_h']}</time> · {read_time(lead)} min read</span>
          <span class="more">Read the essay →</span>
        </div>
      </div>
    </article>
    <div class="art-grid" style="margin-top:22px">
{cards}
    </div>
    <p class="art-foot-note fade-up">Each article is also published on LinkedIn, and links to the original posts sit at the end of every piece.</p>
  </div>
</section>
{cta_band(prefix, "Have something on your mind?", "Whether it's for you or someone you care about, we're here. Reach out for a free, confidential consultation.")}
</main>
"""
    out += footer(prefix)
    return out


# ─────────────────────────── WORKSHOPS ───────────────────────────
WS_WA = (WA + "?text=Hi%21%20I%27d%20like%20to%20apply%20for%20the%20Applied%20Psychology"
         "%20Masterclass%20%2827%E2%80%9331%20July%202026%29.%20Please%20share%20the"
         "%20registration%20details.")

WS_DAYS = [
    dict(img="01-day1-poster.png", day="Day 1 · Mon 27 July", title="Case Conceptualization & Diagnostic Reasoning",
         desc="Learn to think like a clinician and turn scattered client information into a clear, structured case map.",
         kit=["Intake Form Template", "5-Ps Framework Cheat Sheet", "Sample Redacted Case Study"]),
    dict(img="02-day2-poster.png", day="Day 2 · Tue 28 July", title="The CBT Toolkit: Core Interventions",
         desc="Hands-on practice with the interventions used in real sessions, with worksheets you can legally photocopy for your future clients.",
         kit=["7-Column Thought Records", "Behavioral Experiment Templates", "Photocopy-Ready Worksheets"]),
    dict(img="03-day3-poster.png", day="Day 3 · Wed 29 July", title="Trauma-Informed Care & Somatic Stabilization",
         desc="Understand the nervous system under stress and guide clients back into their window of tolerance.",
         kit=["Window of Tolerance Chart", "3 Somatic Grounding Scripts", "5-4-3-2-1 & Box Breathing Guides"]),
    dict(img="04-day4-poster.png", day="Day 4 · Thu 30 July", title="Ethics, Boundaries & Crisis Management",
         desc="Handle the hardest moments of practice with confidence, safety and professional integrity.",
         kit=["Suicide Risk Assessment Checklist", "Crisis Safety Plan Template", "Boundary-Setting Frameworks"]),
    dict(img="05-day5-poster.png", day="Day 5 · Fri 31 July", title="From Student to Practitioner: Career & Practice Building",
         desc="Package your skills, build your presence and step into professional practice with a clear roadmap.",
         kit=["Self-Compassion E-Journal Template", "Workbook Layout Templates", "Content Packaging Playbook"]),
]


# ── Mind in the Making: Montessori Fundamentals Certificate ──
# Our current open workshop. Three days, in person in Karachi, written for the
# two audiences who sit in the same room for this one: parents and early-years
# teachers. Dates are announced batch by batch, so nothing here carries a date.
MF_SLUG = "montessori-fundamentals-workshop"
MF_REG_SLUG = "montessori-fundamentals-register"
MF_TITLE = "Mind in the Making"
MF_CERT = "Montessori Fundamentals Certificate"
MF_PLAIN = f"Mind in the Making: {MF_CERT}"
MF_POSTER = "assets/workshops/montessori-fundamentals-poster.svg"
# Landscape JPEG card: what chat apps and social platforms show when the link is shared.
MF_OG = "assets/workshops/montessori-fundamentals-og.jpg"
MF_ALT = ("Mind in the Making, the Montessori Fundamentals Certificate: a three-day workshop "
          "by MindCare Services®")
MF_WA = (WA + "?text=Hi%21%20I%27d%20like%20to%20register%20for%20the%20Mind%20in%20the%20Making"
         "%20Montessori%20Fundamentals%20Certificate%20workshop.%20Please%20share%20the%20dates"
         "%20and%20details.")

MF_DAYS = [
    dict(num="01", label="Day One", icon="i-brain",
         title="Decoding the Child&#39;s Perspective",
         desc="Before any method, any material and any correction, there is one skill: seeing the "
              "situation the way the child is seeing it. We spend the first day learning to look.",
         kit=["The world from three feet tall: what a child actually perceives",
              "The absorbent mind and the sensitive periods, in plain language",
              "Behaviour as communication: reading the need under the tantrum",
              "Structured observation, the skill every Montessori guide starts with",
              "Take home: an observation record sheet and a sensitive-periods chart"]),
    dict(num="02", label="Day Two", icon="i-heart-hands",
         title="Early Childhood Psychology",
         desc="What is actually happening inside a child in the first six years, from attachment and "
              "temperament to language, movement and the long work of learning to self-regulate.",
         kit=["Attachment, temperament and why two children in one house differ so much",
              "Language, movement and the developing brain, birth to six",
              "Regulation and co-regulation: calming a child by first calming yourself",
              "Normal variation vs. genuine red flags, and when to seek an assessment",
              "Take home: a developmental milestones chart and a regulation toolkit"]),
    dict(num="03", label="Day Three", icon="i-hand",
         title="The Practical Life Area of the Montessori Curriculum",
         desc="The most underestimated shelf in any Montessori classroom, and the easiest to "
              "recreate at home. A hands-on day: you will present exercises, not just watch them.",
         kit=["Why practical life comes first: concentration, coordination, independence, order",
              "Presenting an exercise: slow hands, few words, and the art of stepping back",
              "Care of self, care of the environment, and grace &amp; courtesy",
              "Building a practical life shelf at home or in class, on a real budget",
              "Take home: an activity bank, shelf-setup plan and presentation scripts"]),
]

MF_FAQS = [
    ("Who is this workshop actually for?",
     "Parents, early-years teachers and directresses, Montessori and education students, psychology "
     "students, daycare and playgroup staff, and anyone who spends their days with children under six. "
     "You do not need a Montessori background, a teaching job or a psychology degree to follow it: "
     "everything is taught from the ground up, and the two audiences in the room, parents and teachers, "
     "consistently turn out to have the same questions."),
    ("Is this a full Montessori diploma?",
     "No, and we would rather be clear about that than let anyone assume. This is a three-day "
     "foundations course with a Certificate of Completion issued by MindCare Services®. It is not an "
     "AMI or AMS diploma and it does not by itself qualify you to run a Montessori classroom. What it "
     "does give you is a genuine working understanding of the child, the psychology underneath the "
     "method, and a practical life area you can set up and present properly."),
    ("Do I get a certificate?",
     "Yes. Every participant who completes all three days receives a Certificate of Completion in "
     "Montessori Fundamentals from MindCare Services®, for your CV, your school file or your own record."),
    ("I am a parent, not a teacher. Will most of it be irrelevant?",
     "Quite the opposite: day one and day three were written with parents in mind. Decoding your "
     "child's perspective changes how mornings and bedtimes go, and the practical life work is designed "
     "to be rebuilt at home with things you already own. Teachers get the classroom version of the same "
     "material, and the mixed room is part of why the discussion is good."),
    ("Do I need to bring any materials?",
     "No. Materials are provided in the session and the practical life work is demonstrated with real "
     "equipment as well as with the household substitutes we recommend for home. Bring a notebook."),
    ("Which language is it taught in?",
     "English, with Urdu explanations whenever they help, the same way we run all our sessions."),
    ("When does it run, and what does it cost?",
     "Dates are confirmed batch by batch and we announce them to registered participants first, along "
     "with the venue and the fee for that batch. Registering costs nothing and commits you to nothing: "
     "it simply puts you at the front of the queue when the next batch opens."),
    ("Can I attend just one of the three days?",
     "The three days are built to stack, so we run it as one certificate rather than as separate "
     "sessions. If your schedule makes a full three days impossible, message us and we will tell you "
     "when the next batch runs."),
    ("Is this therapy or an assessment for my child?",
     "No. This is an educational workshop for adults, not psychotherapy, diagnosis or treatment for a "
     "child. If day two raises something about your own child that deserves proper attention, our "
     "clinical team in Karachi does developmental assessments and child therapy, and we will point you "
     "to the right person."),
    ("How do I register?",
     f"Open the <a href=\"/{MF_REG_SLUG}\">registration page</a> and fill the short form, and we "
     f"will confirm your place and send you the dates, venue and fee as soon as the batch is set. You "
     f"can also register on <a href=\"{MF_WA}\" target=\"_blank\" rel=\"noopener\">WhatsApp</a>. "
     f"Seats are capped because day three is hands-on."),
]

# Styles shared by the Montessori workshop page and its registration page.
MF_CSS = """
.mf-hero-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(min(290px,100%),1fr));gap:40px;align-items:center}
.mf-poster{width:100%;height:auto;border-radius:20px;box-shadow:0 18px 46px rgba(30,45,40,.16);border:1px solid var(--border);background:#fff}
.mf-facts{display:grid;grid-template-columns:repeat(auto-fit,minmax(min(190px,100%),1fr));gap:16px;margin-top:6px}
.mf-fact{background:var(--card);border:1px solid var(--border);border-radius:16px;padding:16px 18px}
.mf-fact strong{display:block;font-size:.74rem;letter-spacing:.1em;text-transform:uppercase;color:var(--teal-deep);margin-bottom:5px}
.mf-fact span{font-size:1.02rem;font-weight:600;color:var(--dark)}
.mf-day{position:relative;display:flex;flex-direction:column;align-items:flex-start}
.mf-day .section-tag{align-self:flex-start}
.mf-day h3{min-height:2.6em;align-self:stretch}
.mf-day>p,.mf-day .aside-list{align-self:stretch}
.mf-day>p{flex:1 0 auto}
.mf-day .aside-list{margin-bottom:0}
@media(max-width:760px){.mf-day h3{min-height:0}.mf-day>p{flex:0 1 auto}}
.mf-day .mf-num{display:inline-flex;align-items:center;justify-content:center;flex:0 0 auto;box-sizing:border-box;width:46px;height:46px;min-width:46px;aspect-ratio:1;border-radius:50%;
 font-family:'Cormorant Garamond',serif;font-size:1.35rem;font-weight:700;color:#fff;margin-bottom:12px}
.mf-day:nth-child(1) .mf-num{background:var(--teal)}
.mf-day:nth-child(2) .mf-num{background:var(--green)}
.mf-day:nth-child(3) .mf-num{background:var(--coral)}
.mf-honest{background:var(--teal-light);border:1px solid var(--border);border-left:5px solid var(--teal);border-radius:16px;padding:24px 28px;max-width:860px;margin:0 auto}
.mf-honest h3{margin-bottom:10px}
.mf-badge-row{display:flex;flex-wrap:wrap;gap:10px;justify-content:center;margin-top:20px}
.mf-badge-row span{font-size:.8rem;font-weight:600;color:var(--teal-deep);background:var(--teal-light);
 border:1px solid var(--border);padding:5px 13px;border-radius:999px}
html[data-theme="dark"] .mf-fact{background:#12241a}
html[data-theme="dark"] .mf-honest{background:rgba(15,154,168,.12)}
html[data-theme="dark"] .mf-poster{background:#f7fdfd}
"""

# Single-step registration. There is no fee to collect on this page: the batch
# fee is quoted when the dates are announced, so the form only has to capture
# who is coming and how to reach them.
MF_FORM_JS = """
(function(){
  var form = document.getElementById('mf-form');
  if(!form) return;

  var alertBox = document.getElementById('mf-alert');
  var submit   = document.getElementById('mf-submit');
  var label    = document.getElementById('mf-submit-label');

  function val(id){ var el = document.getElementById(id); return el ? el.value.trim() : ''; }
  function clearAlert(){ alertBox.hidden = true; alertBox.textContent = ''; }
  function fail(msg, id){
    alertBox.textContent = msg;
    alertBox.hidden = false;
    alertBox.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    var el = id && document.getElementById(id);
    if(el){
      el.style.borderColor = '#d64545';
      el.focus();
      setTimeout(function(){ el.style.borderColor = ''; }, 2600);
    }
    return false;
  }

  function succeed(){
    form.innerHTML = '<div class="tm-done">' +
      '<div class="tm-tick">&#10003;</div>' +
      '<h3>Your place is reserved</h3>' +
      '<p>Thank you. We will email and message you the dates, the venue and the fee for the next batch ' +
      'as soon as it is set, and registered participants always hear first.</p>' +
      '<p>Nothing is due now, and nothing is confirmed until you tell us it works for you.</p>' +
      '<p style="margin-top:16px"><a href="/montessori-fundamentals-workshop" style="font-weight:600">Back to the workshop details</a></p>' +
      '</div>';
    form.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }

  form.addEventListener('submit', function(e){
    e.preventDefault();
    clearAlert();

    if(!val('mf-name'))     return fail('Please enter your name.', 'mf-name');
    if(!val('mf-institute'))return fail('Please tell us your school, institute or "home" if you are a parent.', 'mf-institute');
    if(!val('mf-role'))     return fail('Please tell us your role or current education.', 'mf-role');
    if(!val('mf-phone'))    return fail('Please enter a phone number we can reach you on.', 'mf-phone');
    if(!val('mf-email'))    return fail('Please enter your email address.', 'mf-email');
    if(!/^[^@\\s]+@[^@\\s]+\\.[^@\\s]+$/.test(val('mf-email'))) return fail('That email address does not look right.', 'mf-email');

    submit.disabled = true;
    label.textContent = 'Sending...';

    fetch('/api/workshop-register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        workshop: 'Mind in the Making: Montessori Fundamentals Certificate',
        name: val('mf-name'),
        institute: val('mf-institute'),
        phone: val('mf-phone'),
        email: val('mf-email'),
        education: val('mf-role'),
        prior_info: val('mf-prior'),
        expectations: val('mf-expect'),
        // The certificate is part of this workshop rather than a paid add-on,
        // so nothing is ever uploaded here and the flag stays false.
        certificate: false
      })
    }).then(function(res){
      return res.json().catch(function(){ return {}; }).then(function(data){
        if(!res.ok || !data.ok) throw new Error(data.error || 'We could not submit your registration. Please try again.');
        succeed();
      });
    }).catch(function(err){
      submit.disabled = false;
      label.textContent = 'Reserve My Place';
      fail(err.message || 'We could not submit your registration. Please try again.');
    });
  });
})();
"""


# ── Telepathy & Meditation: online live workshop ──
TM_SLUG = "telepathy-meditation-workshop"
# Registration lives on its own page: a two-step form, no scrolling and no
# marketing around it, with the optional certificate fee saved for the last step.
TM_REG_SLUG = "telepathy-meditation-register"
TM_TITLE = "Telepathy &amp; Meditation: The Art of Deep Attunement"
TM_PLAIN = "Telepathy & Meditation: The Art of Deep Attunement"
TM_POSTER = "assets/workshops/telepathy-meditation-poster.svg"
# Landscape JPEG card: what chat apps and social platforms show when the link is shared.
TM_OG = "assets/workshops/telepathy-meditation-og.jpg"
TM_WA = (WA + "?text=Hi%21%20I%27d%20like%20to%20register%20for%20the%20free%20Telepathy%20%26%20Meditation"
         "%20online%20workshop.%20Please%20share%20the%20dates%20and%20Zoom%20details.")

# The workshop itself costs nothing. The only money that ever changes hands is
# the optional certificate, and it is asked for once, at the end of the form.
TM_CERT_FEE = "PKR 1,000"
TM_SESSIONS = [
    dict(tag="Evening One · Part One", icon="i-brain",
         title="Stillness First: The Meditation Foundation",
         desc="Attunement starts with a quiet nervous system. We build the practice that makes everything else possible: breath, posture, the body scan, and what to do when the mind refuses to settle.",
         kit=["Guided breath &amp; body-scan practice, live",
              "The three anchors: breath, body, sound",
              "Working with a restless or anxious mind",
              "Building a 10-minute daily habit that survives a busy week"]),
    dict(tag="Evening One · Part Two", icon="i-heart-hands",
         title="Limbic Resonance: Why We Feel Each Other",
         desc="The honest science behind that uncanny sense of “knowing” what someone feels. Mirror systems, co-regulation, emotional contagion, and why a settled person can settle a room.",
         kit=["Co-regulation and the social nervous system",
              "Emotional contagion vs. genuine empathy",
              "Why presence is felt before a word is spoken",
              "What research supports, and what it does not"]),
    dict(tag="Evening Two · Part One", icon="i-speech",
         title="Listening Beneath the Words",
         desc="Most of what people tell us is never said aloud. Train the skill that reads pace, pause, tone and posture: the closest thing to mind-reading any of us will ever have.",
         kit=["Reading tone, tempo and silence",
              "Empathic accuracy, and how to check it out loud",
              "Reflective listening scripts you can use tonight",
              "Catching your own projections before you name them"]),
    dict(tag="Evening Two · Part Two", icon="i-shield",
         title="The Resonance Lab &amp; Healthy Boundaries",
         desc="Guided pair work in Zoom breakout rooms: sit with a partner, tune in, then compare notes. Playful, curious, honest about the results, followed by the piece most “empaths” never learn.",
         kit=["Live dyad attunement exercises (breakout rooms)",
              "Absorbing vs. attuning: knowing the difference",
              "Grounding and closing rituals after heavy conversations",
              "Your 21-day practice plan, built in the session"]),
]

TM_FAQS = [
    ("Is this workshop claiming that telepathy is real?",
     "No, and we want to be straightforward about that. There is no credible scientific evidence for mind-to-mind transmission, and we will say so in the room. What we explore is the very real, well-documented experience underneath the word: limbic resonance, co-regulation and empathic accuracy: the reasons a person can walk in and change the temperature of a room without saying anything. We treat “telepathy” as an honest question to sit with, not a power to sell you."),
    ("Is this therapy?",
     "No. This is an educational and experiential workshop, not psychotherapy, diagnosis or treatment, and it is not a substitute for either. If something surfaces during the sessions that deserves proper attention, our clinical team is one message away and we will happily point you to the right support."),
    ("Do I need any meditation experience?",
     "None at all. Every practice is guided from the beginning, and complete beginners often get the most out of it. If you already have a steady practice, the attunement and dyad work will give it somewhere new to go."),
    ("It's online, so will it actually feel connected?",
     "That is precisely what the format is testing, and in our experience it holds up better than people expect. Sessions are live on Zoom with cameras on, small breakout pairs, and a group small enough that everyone is spoken to by name. Nothing is pre-recorded."),
    ("What if I miss a session or my internet drops?",
     "Every registered participant gets the session recordings for 30 days, plus the guided audio practices and the workbook, so you can catch up and keep practising in your own time."),
    ("Which language is it taught in?",
     "English, with Urdu explanations whenever they help, the same way we run our sessions. The guided meditation audio is provided in both English and Urdu."),
    ("Has this workshop already run?",
     "Yes. This batch has been delivered and registration is closed. Recordings, the guided audio and the workbook went out to everyone who registered. We do re-run popular workshops, so if you would like to be told when this one comes back, message us and we will add you to the list."),
    ("Was the workshop really free?",
     "Yes, completely. Both live evenings, the guided audio, the workbook and the 30-day recordings cost you nothing. There is no hidden charge, no upsell in the session and no card details anywhere on the form. We run it free because attunement is the kind of skill that makes people easier to live with, and we would rather it spread."),
    ("If it's free, what is the PKR 1,000 for?",
     f"Only for the optional certificate. If you would like an official Certificate of Participation issued by MindCare Services®, it is a one-time fee of {TM_CERT_FEE} that covers verification, issuing and record-keeping. It is entirely optional: you can attend the whole workshop, keep every resource and never pay a rupee. Your certificate is emailed to you within one business day."),
    ("Can I still join this one?",
     f"No, this batch has finished. What is open right now is <a href=\"/{MF_SLUG}\">Mind in the Making, our Montessori Fundamentals Certificate</a>: three days in Karachi on the child's perspective, early childhood psychology and the practical life area of the Montessori curriculum. If you want to hear the moment Telepathy &amp; Meditation runs again, <a href=\"{TM_WA}\" target=\"_blank\" rel=\"noopener\">message us on WhatsApp</a> and we will keep you on the list."),
]


# Styles shared by the workshop page and the standalone registration page.
TM_CSS = """
.tm-hero-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(min(290px,100%),1fr));gap:40px;align-items:center}
.tm-poster{width:100%;height:auto;border-radius:20px;box-shadow:0 20px 54px rgba(6,43,49,.28)}
.ws-shot{position:relative;display:block;border-radius:18px;overflow:hidden;line-height:0}
.ws-shot img{display:block;width:100%;height:auto}
/* A soft fade rather than a hard band: the poster's own call to action sits in
   the bottom eighth, and a gradient covers it without slicing the line above. */
.ws-shot::after{content:'Completed · Registration Closed';position:absolute;left:0;right:0;bottom:0;
 height:14%;min-height:44px;display:flex;align-items:flex-end;justify-content:center;
 padding:0 10px 3.2%;background:linear-gradient(180deg,rgba(11,95,109,0) 0%,rgba(11,95,109,.92) 42%,rgba(11,95,109,.97) 100%);
 color:#fff;font-family:'DM Sans',sans-serif;font-size:.76rem;font-weight:700;letter-spacing:.14em;
 text-transform:uppercase;text-align:center;line-height:1.3}
@media(max-width:520px){.ws-shot::after{font-size:.66rem;letter-spacing:.1em}}
.tm-facts{display:grid;grid-template-columns:repeat(auto-fit,minmax(min(190px,100%),1fr));gap:16px;margin-top:6px}
.tm-fact{background:var(--card);border:1px solid var(--border);border-radius:16px;padding:16px 18px}
.tm-fact strong{display:block;font-size:.74rem;letter-spacing:.1em;text-transform:uppercase;color:var(--teal-deep);margin-bottom:5px}
.tm-fact span{font-size:1.02rem;font-weight:600;color:var(--dark)}
.tm-honest{background:var(--teal-light);border:1px solid var(--border);border-left:5px solid var(--teal);border-radius:16px;padding:24px 28px;max-width:860px;margin:0 auto}
.tm-honest h3{margin-bottom:10px}
.tm-free{background:linear-gradient(135deg,rgba(43,189,201,.16),rgba(15,154,168,.06));border:1px solid var(--border);
 border-radius:22px;padding:34px 30px;max-width:880px;margin:0 auto;text-align:center}
.tm-free .tm-price{font-family:'Cormorant Garamond',serif;font-size:3.6rem;line-height:1;color:var(--teal-deep);font-weight:600;display:block;margin-bottom:6px}
.tm-free h3{font-size:1.5rem;margin:0 0 10px}
.tm-free p{max-width:620px;margin:0 auto 14px;color:var(--gray)}
.tm-cert{background:var(--card);border:1px solid var(--border);border-radius:16px;padding:20px 24px;max-width:620px;
 margin:22px auto 0;text-align:left}
.tm-cert h4{font-size:1rem;margin:0 0 6px}
.tm-cert p{margin:0;font-size:.9rem;text-align:left}
.tm-badge-row{display:flex;flex-wrap:wrap;gap:10px;justify-content:center;margin-top:20px}
.tm-badge-row span{font-size:.8rem;font-weight:600;color:var(--teal-deep);background:var(--teal-light);
 border:1px solid var(--border);padding:5px 13px;border-radius:999px}
/* Money is always green on this site: it reads as affordable and safe rather
   than as a charge, which matters when the only fee is a small optional one. */
.tm-amount{color:var(--green);font-weight:700;white-space:nowrap}
.tm-done-badge{color:var(--green);border-color:rgba(45,106,31,.3);background:var(--green-light)}
html[data-theme="dark"] .tm-fact,html[data-theme="dark"] .tm-cert{background:#12241a}
html[data-theme="dark"] .tm-amount{color:#6ede8a}
html[data-theme="dark"] .tm-honest{background:rgba(15,154,168,.12)}
@media(max-width:560px){.tm-free{padding:28px 20px}.tm-free .tm-price{font-size:2.9rem}}
"""

# Shared registration-form styles. The `.tm-*` class names are historical: they
# were written for the first workshop's form and are now used by every one.
REG_FORM_CSS = """
.tm-reg-wrap{max-width:660px;margin:0 auto}
.tm-form{background:var(--card);border:1px solid var(--border);border-radius:22px;padding:32px;box-shadow:var(--shadow-soft)}
.tm-row{display:grid;grid-template-columns:1fr 1fr;gap:14px}
.tm-field{margin-bottom:15px}
.tm-field label{display:block;font-size:.78rem;font-weight:600;margin-bottom:5px;color:var(--dark)}
.tm-field input,.tm-field select,.tm-field textarea{width:100%;padding:11px 13px;border:1px solid var(--border);border-radius:10px;font-family:inherit;font-size:.94rem;background:var(--white);color:var(--dark)}
.tm-field textarea{min-height:84px;resize:vertical}
.tm-field input:focus,.tm-field select:focus,.tm-field textarea:focus{border-color:var(--teal);outline:none;box-shadow:0 0 0 3px rgba(43,189,201,.13)}
.tm-field input[type="file"]{padding:9px 11px;background:var(--white);cursor:pointer}
.tm-field input[type="file"]::file-selector-button{border:1px solid var(--border);background:var(--teal-light);color:var(--teal-deep);
 border-radius:7px;padding:6px 12px;margin-right:11px;font:inherit;font-size:.8rem;font-weight:600;cursor:pointer}
.tm-req{color:var(--teal-deep)}
.tm-hint{font-size:.78rem;color:var(--gray);margin:7px 0 0}
.tm-note{font-size:.82rem;color:var(--gray);margin-top:14px;text-align:center}
.tm-form-title{font-size:1.25rem;margin:0 0 6px}
.tm-form-sub{font-size:.9rem;color:var(--gray);margin:0 0 22px}
.tm-progress{display:flex;align-items:center;gap:10px;margin-bottom:24px}
.tm-progress li{list-style:none;flex:1;font-size:.72rem;font-weight:700;letter-spacing:.08em;text-transform:uppercase;
 color:var(--gray);border-top:3px solid var(--border);padding-top:9px}
.tm-progress li.on{color:var(--teal-deep);border-top-color:var(--teal)}
.tm-actions{display:flex;gap:12px;margin-top:6px}
.tm-actions .btn-primary,.tm-actions .btn-secondary{flex:1;justify-content:center}
.tm-choice{display:block;border:1px solid var(--border);border-radius:16px;padding:18px 20px;margin-bottom:14px;cursor:pointer;background:var(--white)}
.tm-choice:hover{border-color:var(--teal)}
.tm-choice input{position:absolute;opacity:0;pointer-events:none}
.tm-choice-head{display:flex;align-items:baseline;justify-content:space-between;gap:12px;flex-wrap:wrap}
.tm-choice-head strong{font-size:1.02rem;color:var(--dark)}
.tm-choice-head em{font-style:normal;font-weight:700;font-size:.95rem;color:var(--teal-deep);white-space:nowrap}
/* Both prices sit in a green pill: the point of this step is that the money is
   small and optional, so it should read as reassuring rather than as a toll. */
.tm-amount{color:var(--green);font-weight:700;white-space:nowrap}
.tm-choice-head em.tm-amount{color:var(--green);background:var(--green-light);border:1px solid rgba(45,106,31,.22);
 border-radius:999px;padding:4px 13px;font-size:.9rem}
.tm-choice p{margin:6px 0 0;font-size:.87rem;color:var(--gray)}
.tm-choice.sel{border-color:var(--teal);box-shadow:0 0 0 3px rgba(43,189,201,.13);background:var(--teal-light)}
.tm-bank{background:var(--teal-light);border:1px solid var(--border);border-radius:16px;padding:22px 24px;margin:4px 0 18px}
.tm-bank h4{font-size:.98rem;margin:0 0 4px}
.tm-bank>p{font-size:.86rem;color:var(--gray);margin:0 0 16px}
.tm-bank-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(min(220px,100%),1fr));gap:14px;margin:0}
.tm-bank-grid dt{font-size:.7rem;letter-spacing:.09em;text-transform:uppercase;color:var(--teal-deep);font-weight:700;margin-bottom:3px}
.tm-bank-grid dd{margin:0;font-size:.95rem;font-weight:600;color:var(--dark);display:flex;align-items:center;gap:8px;flex-wrap:wrap;overflow-wrap:anywhere}
.tm-copy{border:1px solid var(--border);background:var(--card);color:var(--teal-deep);border-radius:7px;padding:3px 9px;
 font:inherit;font-size:.7rem;font-weight:700;letter-spacing:.05em;text-transform:uppercase;cursor:pointer}
.tm-copy:hover{border-color:var(--teal)}
.tm-alert{background:#fdecec;border:1px solid #f3c4c4;color:#a12a2a;border-radius:10px;padding:11px 14px;font-size:.86rem;margin-bottom:15px}
.tm-done{text-align:center;padding:18px 4px}
.tm-done h1,.tm-done h3{font-size:1.4rem;margin:0 0 10px}
.tm-done p{color:var(--gray);font-size:.94rem;margin:0 auto 8px;max-width:440px}
.tm-tick{width:58px;height:58px;border-radius:50%;background:var(--teal);color:#fff;display:flex;align-items:center;justify-content:center;margin:0 auto 18px;font-size:1.8rem}
html[data-theme="dark"] .tm-form{background:#12241a}
html[data-theme="dark"] .tm-field input,html[data-theme="dark"] .tm-field select,html[data-theme="dark"] .tm-field textarea{background:#0e1b13;color:var(--dark)}
html[data-theme="dark"] .tm-choice{background:#0e1b13}
html[data-theme="dark"] .tm-choice.sel,html[data-theme="dark"] .tm-bank{background:rgba(15,154,168,.12)}
html[data-theme="dark"] .tm-copy{background:#12241a}
html[data-theme="dark"] .tm-amount{color:#6ede8a}
html[data-theme="dark"] .tm-choice-head em.tm-amount{color:#6ede8a;border-color:rgba(110,222,138,.28)}
html[data-theme="dark"] .tm-alert{background:#3a1c1c;border-color:#5e2b2b;color:#f0b4b4}
@media(max-width:560px){.tm-row{grid-template-columns:1fr}.tm-form{padding:24px 20px}.tm-actions{flex-direction:column-reverse}}
"""

def telepathy_meditation_page():
    prefix = ""
    url = f"{BASE}/{TM_SLUG}"
    schema = {"@context": "https://schema.org", "@graph": [
        {"@type": "BreadcrumbList", "itemListElement": [
            {"@type": "ListItem", "position": 1, "name": "Home", "item": f"{BASE}/"},
            {"@type": "ListItem", "position": 2, "name": "Workshops", "item": f"{BASE}/workshops"},
            {"@type": "ListItem", "position": 3, "name": "Telepathy & Meditation Workshop", "item": url}]},
        # Course rather than Event: dates are announced batch by batch, and an Event
        # without a startDate is invalid structured data.
        {"@type": "Course", "name": TM_PLAIN,
         "url": url,
         "image": f"{BASE}/{TM_OG}",
         "inLanguage": ["en", "ur"],
         "isAccessibleForFree": True,
         "educationalLevel": "Beginner to advanced",
         "description": ("A free two-evening live online workshop from MindCare Services® exploring meditation, "
                         "limbic resonance and empathic attunement: the science and practice behind feeling "
                         "genuinely connected to another person. Includes guided audio, a workbook and 30-day "
                         "recording access at no cost. An official certificate of participation is optional, "
                         "a one-time PKR 1,000, emailed within one business day."),
         "offers": {"@type": "Offer", "price": "0", "priceCurrency": "PKR",
                    "category": "Free", "availability": "https://schema.org/SoldOut",
                    "url": f"{BASE}/{TM_SLUG}"},
         "provider": {"@type": "Organization", "name": "MindCare Services®", "url": BASE},
         "hasCourseInstance": {"@type": "CourseInstance", "courseMode": "Online",
                               "courseWorkload": "PT4H",
                               "location": {"@type": "VirtualLocation", "url": url}}},
        {"@type": "FAQPage", "mainEntity": [
            {"@type": "Question", "name": q,
             "acceptedAnswer": {"@type": "Answer", "text": re.sub(r"<[^>]+>", "", a)}}
            for q, a in TM_FAQS]}]}

    session_cards = "\n".join(f'''      <article class="feature-card fade-up">
        <div class="fi">{icon(prefix, s['icon'])}</div>
        <span class="section-tag">{s['tag']}</span>
        <h3 style="margin-top:10px">{s['title']}</h3>
        <p>{s['desc']}</p>
        <ul class="aside-list" style="margin-top:12px">
{chr(10).join(li(prefix, k) for k in s['kit'])}
        </ul>
      </article>''' for s in TM_SESSIONS)

    out = head("Telepathy & Meditation: Completed Live Online Workshop | MindCare Services®",
               "MindCare's free live online workshop on meditation and deep attunement has now been "
               "delivered and registration is closed. Read what the two evenings covered, and see the "
               "workshop that is open next: our Montessori Fundamentals Certificate.",
               url, prefix, schema, og_type="website")
    out = social_image(out, TM_OG, "Telepathy & Meditation: The Art of Deep Attunement, a live online workshop by MindCare Services®", 1200, 630)
    out += nav(prefix, "workshops")
    out += f"""<main id="main">
<style>{TM_CSS}</style>

<header class="page-hero">
  <div class="ph-inner">
    <ol class="breadcrumb"><li><a href="/">Home</a></li><li><a href="/workshops">Workshops</a></li><li aria-current="page">Telepathy &amp; Meditation</li></ol>
    <div class="ph-badge tm-done-badge">{icon(prefix,'i-check')} Completed · Registration Closed</div>
    <h1>Telepathy &amp; <em>Meditation</em></h1>
    <p class="lede">Two evenings on the quietest, most underrated skill there is: the ability to settle yourself, and then genuinely tune in to another human being. This workshop has now been delivered, and this page is kept as the record of what it covered.</p>
    <div class="ph-actions">
      <a href="/{MF_SLUG}" class="btn-primary">{icon(prefix,'i-clipboard','18')} See the workshop that&#39;s open now</a>
      <a href="{TM_WA}" target="_blank" rel="noopener" class="btn-secondary">{icon(prefix,'i-wa','18')} Tell me when it runs again</a>
    </div>
  </div>
</header>

<section>
  <div class="section-inner">
    <div class="tm-hero-grid">
      <div class="fade-up">
        <span class="ws-shot tm-poster"><img src="{prefix}{TM_POSTER}" alt="Telepathy &amp; Meditation: The Art of Deep Attunement, live online workshop poster. This workshop has been completed." width="900" height="1200"></span>
      </div>
      <div class="fade-up">
        <span class="section-tag">Completed</span>
        <h2 class="section-title">You already know the feeling. This is the practice behind it.</h2>
        <p style="margin:14px 0 16px">Someone walks into the room and you feel it before they speak. A friend calls the moment you thought of them. A client goes quiet and something in your own chest tightens. We call it telepathy because we don't have a better everyday word for it, but what's actually happening is attunement, and unlike magic, attunement can be trained.</p>
        <p style="margin-bottom:20px">Over two live evenings we built it deliberately: first the meditation that quiets your own noise, then the listening that lets someone else's signal through. Small group, cameras on, real practice in pairs, and an honest conversation about where the science ends and the mystery begins. All of it free.</p>
        <div class="tm-facts">
          <div class="tm-fact"><strong>Status</strong><span>Completed · registration closed</span></div>
          <div class="tm-fact"><strong>Fee</strong><span>Free · nothing was charged</span></div>
          <div class="tm-fact"><strong>Format</strong><span>Two live evenings on Zoom</span></div>
          <div class="tm-fact"><strong>Language</strong><span>English, with Urdu where it helps</span></div>
        </div>
        <div style="margin-top:24px"><a href="/{MF_SLUG}" class="btn-primary">{icon(prefix,'i-clipboard','18')} What&#39;s open now</a></div>
      </div>
    </div>
  </div>
</section>

<section class="bg-off">
  <div class="section-inner">
    <div class="tm-free fade-up">
      <span class="section-tag">How it went</span>
      <span class="tm-price">Done</span>
      <h3>Both evenings ran, and everything promised went out</h3>
      <p>No ticket, no deposit, no card details, and nothing sold in the session. Every registered participant received the Zoom link, the guided audio in English and Urdu, the attunement workbook and thirty days of recordings, at no cost.</p>
      <div class="tm-badge-row">
        <span>Delivered free, as promised</span><span>Workbook &amp; audio sent</span><span>Recordings shared</span><span>Certificates issued</span>
      </div>
      <div class="tm-cert">
        <h4>{icon(prefix,'i-grad','18')} Attended, and still want the certificate?</h4>
        <p>The optional <strong>Certificate of Participation</strong> from MindCare Services® is still available to anyone who joined the sessions, at the same one-time <span class="tm-amount">{TM_CERT_FEE}</span>. Message us on WhatsApp and we will arrange it. Everything else about the workshop was, and stays, free.</p>
      </div>
      <div style="margin-top:24px"><a href="{TM_WA}" target="_blank" rel="noopener" class="btn-primary">{icon(prefix,'i-wa','18')} Message us about a certificate</a></div>
    </div>
  </div>
</section>

<section>
  <div class="section-inner">
    <div class="section-header centered fade-up"><span class="section-tag">The Two Evenings</span><h2 class="section-title">Four movements, one skill</h2><p class="section-sub">What the workshop covered. Every part was taught live and practised in the session, so nobody left having only heard about it.</p></div>
    <div class="feature-grid">
{session_cards}
    </div>
  </div>
</section>

<section class="bg-off">
  <div class="section-inner">
    <div class="tm-honest fade-up">
      <span class="section-tag">Straight talk</span>
      <h3 style="margin-top:10px">What this workshop is, and what it isn't</h3>
      <p style="margin-bottom:14px"><strong>It is</strong> an experiential meditation and attunement workshop grounded in what psychology actually knows about empathy, co-regulation and the nervous system, run with curiosity about the parts we can't yet explain.</p>
      <p><strong>It isn't</strong> a claim that thoughts travel between minds, a psychic certification, or a form of treatment. Nothing here replaces therapy, medication or medical advice. If something tender comes up while you practise, our clinical team in Karachi is one message away.</p>
    </div>
  </div>
</section>

<section>
  <div class="section-inner">
    <div class="section-header centered fade-up"><span class="section-tag">Included, at no cost</span><h2 class="section-title">What you take home</h2></div>
    <div class="feature-grid">
      <div class="feature-card fade-up"><div class="fi">{icon(prefix,'i-clock')}</div><h3>30-day recording access</h3><p>Both evenings recorded and shared, so a missed session or a shaky connection never costs you the workshop.</p></div>
      <div class="feature-card fade-up"><div class="fi">{icon(prefix,'i-speech')}</div><h3>Guided audio, English &amp; Urdu</h3><p>The meditations from the sessions, recorded in both languages, to keep the practice going after the Zoom window closes.</p></div>
      <div class="feature-card fade-up"><div class="fi">{icon(prefix,'i-book')}</div><h3>The attunement workbook</h3><p>Practice logs, listening scripts, dyad exercise cards and your 21-day plan: a printable PDF sent before session one.</p></div>
      <div class="feature-card fade-up"><div class="fi">{icon(prefix,'i-grad')}</div><h3>Certificate, if you wanted one</h3><p>Optional Certificate of Participation from MindCare Services®, a one-time <span class="tm-amount">{TM_CERT_FEE}</span>, emailed within one business day. Everything above was free regardless.</p></div>
    </div>
  </div>
</section>

<section class="bg-off">
  <div class="section-inner">
    <div class="section-header centered fade-up"><span class="section-tag">Good For</span><h2 class="section-title">Who this is for</h2></div>
    <div class="feature-grid">
      <div class="feature-card fade-up"><div class="fi">{icon(prefix,'i-heart-hands')}</div><h3>The naturally sensitive</h3><p>People who pick up on everyone's mood and pay for it later. You'll learn the difference between tuning in and taking on.</p></div>
      <div class="feature-card fade-up"><div class="fi">{icon(prefix,'i-brain')}</div><h3>Meditators wanting depth</h3><p>You have a practice but it has gone flat. Attunement work gives stillness a direction and a partner.</p></div>
      <div class="feature-card fade-up"><div class="fi">{icon(prefix,'i-clipboard')}</div><h3>Helping professionals</h3><p>Therapists, students, teachers, doctors and coaches who want presence to be a skill rather than a good day.</p></div>
      <div class="feature-card fade-up"><div class="fi">{icon(prefix,'i-family')}</div><h3>Couples &amp; close pairs</h3><p>Partners, siblings and friends are welcome to register together and pair up for the breakout practice.</p></div>
    </div>
    <div style="text-align:center;margin-top:40px" class="fade-up">
      <p style="margin-bottom:16px;font-weight:600">This batch has finished. Our next workshop, <em>{MF_TITLE}: {MF_CERT}</em>, is open for registration now.</p>
      <a href="/{MF_REG_SLUG}" class="btn-primary">{icon(prefix,'i-clipboard','18')} Register for the next workshop</a>
      <p style="margin-top:14px">or call <a href="tel:{PHONE}" style="font-weight:600">{PHONE_H}</a></p>
    </div>
  </div>
</section>

{faq_block(prefix, TM_FAQS)}

{cta_band(prefix, "Missed this one?", "Message us on WhatsApp and we will tell you the moment it runs again. In the meantime, our Montessori Fundamentals Certificate is open for registration.")}
</main>
"""
    out += footer(prefix)
    return out


def telepathy_register_page():
    """Registration for a workshop that has finished running.

    The URL is kept alive rather than deleted: it has been shared, indexed and
    printed on a poster, so it should explain what happened and hand the visitor
    the workshop that is actually open instead of a dead form.
    """
    prefix = ""
    url = f"{BASE}/{TM_REG_SLUG}"
    schema = {"@context": "https://schema.org", "@graph": [
        {"@type": "BreadcrumbList", "itemListElement": [
            {"@type": "ListItem", "position": 1, "name": "Home", "item": f"{BASE}/"},
            {"@type": "ListItem", "position": 2, "name": "Workshops", "item": f"{BASE}/workshops"},
            {"@type": "ListItem", "position": 3, "name": "Telepathy & Meditation Workshop", "item": f"{BASE}/{TM_SLUG}"},
            {"@type": "ListItem", "position": 4, "name": "Register", "item": url}]},
        {"@type": "WebPage", "name": "Registration Closed: Telepathy & Meditation Workshop | MindCare Services®",
         "url": url,
         "description": ("Registration for the MindCare Services® Telepathy & Meditation live online "
                         "workshop is now closed: the workshop has been delivered. Our current open "
                         "workshop is Mind in the Making, the Montessori Fundamentals Certificate."),
         "isPartOf": {"@type": "WebSite", "name": "MindCare Services®", "url": BASE}}]}

    out = head("Registration Closed: Telepathy & Meditation Workshop | MindCare Services®",
               "Registration for the Telepathy & Meditation live online workshop is closed: this "
               "workshop has now been delivered. See what's open next from MindCare Services®, "
               "including our Montessori Fundamentals Certificate.",
               url, prefix, schema, og_type="website")
    # A closed form is not a page we want ranking for "register".
    out = out.replace('<meta name="robots" content="index, follow, max-image-preview:large, max-snippet:-1">',
                      '<meta name="robots" content="noindex, follow">')
    out = social_image(out, MF_OG, MF_ALT, 1200, 630)
    out += nav(prefix, "workshops")
    out += f"""<main id="main">
<style>{REG_FORM_CSS}</style>

<section style="padding-top:132px">
  <div class="section-inner">
    <div class="tm-reg-wrap">
      <div class="tm-form">
        <div class="tm-done">
          <div class="tm-tick" style="background:var(--green)">&#10003;</div>
          <h1>This workshop has been completed</h1>
          <p>Registration for <strong>Telepathy &amp; Meditation: The Art of Deep Attunement</strong> is now
             closed. Thank you to everyone who joined us: the recordings, guided audio and workbook have
             gone out to every registered participant.</p>
          <p>Attended and still want your optional Certificate of Participation? Message us and we will
             sort it out.</p>
          <div class="tm-actions" style="justify-content:center;margin-top:22px">
            <a href="/{MF_REG_SLUG}" class="btn-primary">{icon(prefix,'i-clipboard','18')} Register for our next workshop</a>
          </div>
          <p style="margin-top:18px"><a href="{TM_WA}" target="_blank" rel="noopener" style="font-weight:600">Message us on WhatsApp</a>
             or call <a href="tel:{PHONE}" style="font-weight:600">{PHONE_H}</a></p>
        </div>
      </div>

      <div class="tm-form" style="margin-top:22px">
        <span class="section-tag">Open now</span>
        <h2 class="tm-form-title" style="margin-top:8px">{MF_TITLE}: <em>{MF_CERT}</em></h2>
        <p class="tm-form-sub">A three-day certificate workshop in Karachi for parents and early-years
           teachers: decoding the child's perspective, early childhood psychology, and the practical life
           area of the Montessori curriculum. Registration is open and dates go to registered
           participants first.</p>
        <div class="tm-actions">
          <a href="/{MF_SLUG}" class="btn-secondary" style="text-align:center">Read the details</a>
          <a href="/{MF_REG_SLUG}" class="btn-primary">{icon(prefix,'i-clipboard','18')} Reserve My Place</a>
        </div>
      </div>

      <p style="text-align:center;margin-top:22px"><a href="/{TM_SLUG}" class="more" style="font-weight:600">← Read about the completed workshop</a></p>
    </div>
  </div>
</section>
</main>
"""
    out += footer(prefix)
    return out


def montessori_page():
    """Mind in the Making: the three-day Montessori Fundamentals Certificate.

    Modelled on the first workshop's page, minus the dates: batches are
    announced to registered participants first, so nothing here is dated.
    """
    prefix = ""
    reg = f"/{MF_REG_SLUG}"
    url = f"{BASE}/{MF_SLUG}"
    schema = {"@context": "https://schema.org", "@graph": [
        {"@type": "BreadcrumbList", "itemListElement": [
            {"@type": "ListItem", "position": 1, "name": "Home", "item": f"{BASE}/"},
            {"@type": "ListItem", "position": 2, "name": "Workshops", "item": f"{BASE}/workshops"},
            {"@type": "ListItem", "position": 3, "name": MF_PLAIN, "item": url}]},
        # Course rather than Event: dates are announced batch by batch, and an
        # Event without a startDate is invalid structured data.
        {"@type": "Course", "name": MF_PLAIN,
         "url": url,
         "image": f"{BASE}/{MF_OG}",
         "inLanguage": ["en", "ur"],
         "educationalLevel": "Foundation, no prior Montessori experience required",
         "description": ("A three-day Montessori fundamentals certificate workshop from MindCare "
                         "Services® in Karachi for parents, early-years teachers and students. Day one "
                         "decodes the child's perspective, day two covers early childhood psychology, "
                         "and day three is hands-on with the practical life area of the Montessori "
                         "curriculum. Certificate of Completion included."),
         "teaches": [d["title"].replace("&#39;", "'") for d in MF_DAYS],
         "offers": {"@type": "Offer", "availability": "https://schema.org/InStock",
                    "url": f"{BASE}/{MF_REG_SLUG}"},
         "provider": {"@type": "Organization", "name": "MindCare Services®", "url": BASE},
         "hasCourseInstance": {"@type": "CourseInstance", "courseMode": "Onsite",
                               "courseWorkload": "P3D",
                               "location": {"@type": "Place", "name": "MindCare Services®",
                                            "address": {"@type": "PostalAddress",
                                                        "addressLocality": "Karachi",
                                                        "addressCountry": "PK"}}}},
        {"@type": "FAQPage", "mainEntity": [
            {"@type": "Question", "name": q,
             "acceptedAnswer": {"@type": "Answer", "text": re.sub(r"<[^>]+>", "", a)}}
            for q, a in MF_FAQS]}]}

    day_cards = "\n".join(f'''      <article class="feature-card fade-up mf-day">
        <span class="mf-num">{d['num']}</span>
        <span class="section-tag">{d['label']}</span>
        <h3 style="margin-top:10px">{d['title']}</h3>
        <p>{d['desc']}</p>
        <ul class="aside-list" style="margin-top:12px">
{chr(10).join(li(prefix, k) for k in d['kit'])}
        </ul>
      </article>''' for d in MF_DAYS)

    out = head(f"{MF_PLAIN} | 3-Day Workshop in Karachi | MindCare Services®",
               "Mind in the Making: a three-day Montessori Fundamentals Certificate workshop in Karachi "
               "for parents and early-years teachers. Decoding the child's perspective, early childhood "
               "psychology, and the practical life area of the Montessori curriculum. Registration open.",
               url, prefix, schema, og_type="website")
    out = social_image(out, MF_OG, MF_ALT, 1200, 630)
    out += nav(prefix, "workshops")
    out += f"""<main id="main">
<style>{MF_CSS}</style>

<header class="page-hero">
  <div class="ph-inner">
    <ol class="breadcrumb"><li><a href="/">Home</a></li><li><a href="/workshops">Workshops</a></li><li aria-current="page">Mind in the Making</li></ol>
    <div class="ph-badge">{icon(prefix,'i-school')} New · 3-Day Certificate · Registration Open</div>
    <h1>Mind in the <em>Making</em></h1>
    <p class="lede">Three days on the child in front of you: how they actually see the world, what is happening in their first six years, and how the quiet, practical part of the Montessori curriculum turns all of it into independence. For parents and teachers, in the same room, on purpose.</p>
    <div class="ph-actions">
      <a href="{reg}" class="btn-primary">{icon(prefix,'i-clipboard','18')} Reserve My Place</a>
      <a href="{MF_WA}" target="_blank" rel="noopener" class="btn-secondary">{icon(prefix,'i-wa','18')} Ask us on WhatsApp</a>
    </div>
  </div>
</header>

<section>
  <div class="section-inner">
    <div class="mf-hero-grid">
      <div class="fade-up">
        <img src="{prefix}{MF_POSTER}" alt="{MF_ALT}" class="mf-poster" width="900" height="1200">
      </div>
      <div class="fade-up">
        <span class="section-tag">The invitation</span>
        <h2 class="section-title">&ldquo;{MF_CERT}&rdquo;</h2>
        <p style="margin:14px 0 16px">A child who will not put their shoes on is not being difficult. A three-year-old who screams when the bread is cut the wrong way is not being unreasonable. From inside their own head, both are behaving perfectly logically, and almost everything that goes wrong in an early-years room or a family morning comes from missing that.</p>
        <p style="margin-bottom:20px">Maria Montessori's whole method rests on one habit: watch the child before you correct the child. Over three days we build that habit properly, put the developmental psychology underneath it, and then hand you the most practical part of the curriculum, the practical life area, ready to set up at home or in class.</p>
        <div class="mf-facts">
          <div class="mf-fact"><strong>Format</strong><span>Three days · hands-on</span></div>
          <div class="mf-fact"><strong>Where</strong><span>In person in Karachi</span></div>
          <div class="mf-fact"><strong>For</strong><span>Parents, teachers &amp; students</span></div>
          <div class="mf-fact"><strong>You leave with</strong><span>Certificate of Completion</span></div>
        </div>
        <div style="margin-top:24px"><a href="{reg}" class="btn-primary">{icon(prefix,'i-clipboard','18')} Reserve My Place</a></div>
      </div>
    </div>
  </div>
</section>

<section class="bg-off">
  <div class="section-inner">
    <div class="section-header centered fade-up"><span class="section-tag">The Three Days</span><h2 class="section-title">One question per day, answered properly</h2><p class="section-sub">Each day stands on the one before it: see the child, understand the child, then set up the environment the child can actually work in.</p></div>
    <div class="feature-grid">
{day_cards}
    </div>
  </div>
</section>

<section>
  <div class="section-inner">
    <div class="section-header centered fade-up"><span class="section-tag">Included</span><h2 class="section-title">What you take home</h2></div>
    <div class="feature-grid">
      <div class="feature-card fade-up"><div class="fi">{icon(prefix,'i-grad')}</div><h3>Certificate of Completion</h3><p>Issued by MindCare Services® to every participant who completes all three days, for your CV, your school file or your own record.</p></div>
      <div class="feature-card fade-up"><div class="fi">{icon(prefix,'i-clipboard')}</div><h3>Observation &amp; milestone charts</h3><p>The record sheet Montessori guides actually use, a sensitive-periods chart and a birth-to-six developmental milestones reference.</p></div>
      <div class="feature-card fade-up"><div class="fi">{icon(prefix,'i-home')}</div><h3>A practical life activity bank</h3><p>Exercises, presentation scripts and a shelf-setup plan you can build at home or in a classroom without importing anything.</p></div>
      <div class="feature-card fade-up"><div class="fi">{icon(prefix,'i-heart-hands')}</div><h3>A regulation toolkit</h3><p>What to actually say and do in the middle of a meltdown, for the adult as much as for the child.</p></div>
    </div>
  </div>
</section>

<section class="bg-off">
  <div class="section-inner">
    <div class="section-header centered fade-up"><span class="section-tag">Good For</span><h2 class="section-title">Who this is for</h2></div>
    <div class="feature-grid">
      <div class="feature-card fade-up"><div class="fi">{icon(prefix,'i-family')}</div><h3>Parents</h3><p>Especially of under-sixes. You will leave with a different read on the behaviour you were about to punish, and a shelf you can build this weekend.</p></div>
      <div class="feature-card fade-up"><div class="fi">{icon(prefix,'i-school')}</div><h3>Early-years teachers</h3><p>Montessori directresses, playgroup and daycare staff, and anyone running a room full of three-year-olds with more instinct than training.</p></div>
      <div class="feature-card fade-up"><div class="fi">{icon(prefix,'i-grad')}</div><h3>Education &amp; psychology students</h3><p>Developmental theory with the practical half attached, taught by clinicians who assess and treat children every week.</p></div>
      <div class="feature-card fade-up"><div class="fi">{icon(prefix,'i-heart-hands')}</div><h3>Caregivers &amp; helpers</h3><p>Grandparents, nannies and anyone else who spends whole days with a small child and wants to do it with more understanding.</p></div>
    </div>
    <div style="text-align:center;margin-top:40px" class="fade-up">
      <p style="margin-bottom:16px;font-weight:600">Seats are capped because day three is hands-on, and registered participants hear the dates first.</p>
      <a href="{reg}" class="btn-primary">{icon(prefix,'i-clipboard','18')} Reserve My Place</a>
      <p style="margin-top:14px">or call <a href="tel:{PHONE}" style="font-weight:600">{PHONE_H}</a></p>
    </div>
  </div>
</section>

<section>
  <div class="section-inner">
    <div class="mf-honest fade-up">
      <span class="section-tag">Straight talk</span>
      <h3 style="margin-top:10px">What this certificate is, and what it isn&#39;t</h3>
      <p style="margin-bottom:14px"><strong>It is</strong> a three-day foundations course with a Certificate of Completion from MindCare Services®: a genuine working understanding of the child, the developmental psychology underneath the Montessori method, and a practical life area you can set up and present properly.</p>
      <p><strong>It isn&#39;t</strong> an AMI or AMS diploma, and on its own it does not qualify you to run a Montessori classroom. It is also not therapy or an assessment for your child, though if day two raises something worth looking at, our clinical team in Karachi does exactly that work.</p>
    </div>
  </div>
</section>

{faq_block(prefix, MF_FAQS)}

{cta_band(prefix, "Not sure if it's for you?", "Tell us whether you're coming as a parent, a teacher or a student and we'll tell you honestly what you'll get out of it. A real person from our team answers.")}
</main>
"""
    out += footer(prefix)
    return out


def montessori_register_page():
    """One-step registration: who you are, and how we reach you.

    There is no fee to collect here. The batch fee and venue are quoted when the
    dates are announced, so asking for money on this page would be guesswork.
    """
    prefix = ""
    url = f"{BASE}/{MF_REG_SLUG}"
    schema = {"@context": "https://schema.org", "@graph": [
        {"@type": "BreadcrumbList", "itemListElement": [
            {"@type": "ListItem", "position": 1, "name": "Home", "item": f"{BASE}/"},
            {"@type": "ListItem", "position": 2, "name": "Workshops", "item": f"{BASE}/workshops"},
            {"@type": "ListItem", "position": 3, "name": MF_PLAIN, "item": f"{BASE}/{MF_SLUG}"},
            {"@type": "ListItem", "position": 4, "name": "Register", "item": url}]},
        {"@type": "WebPage", "name": f"Register: {MF_PLAIN} | MindCare Services®",
         "url": url,
         "description": ("Registration for the MindCare Services® Mind in the Making three-day "
                         "Montessori Fundamentals Certificate workshop in Karachi. A short form: "
                         "we confirm your place and send the dates, venue and fee for the next batch."),
         "isPartOf": {"@type": "WebSite", "name": "MindCare Services®", "url": BASE}}]}

    out = head(f"Register: {MF_PLAIN} | MindCare Services®",
               "Reserve your place on Mind in the Making, MindCare's three-day Montessori Fundamentals "
               "Certificate workshop in Karachi. One short form, nothing to pay now: we send the dates, "
               "venue and fee for the next batch to registered participants first.",
               url, prefix, schema, og_type="website")
    out = social_image(out, MF_OG, MF_ALT, 1200, 630)
    out += nav(prefix, "workshops")
    out += f"""<main id="main">
<style>{REG_FORM_CSS}</style>

<section style="padding-top:132px">
  <div class="section-inner">
    <div class="tm-reg-wrap">
      <div class="section-header centered" style="margin-bottom:26px">
        <span class="section-tag">Registration Open</span>
        <h1 class="section-title" style="font-size:2.1rem">Register for {MF_TITLE}</h1>
        <p class="section-sub">The three-day <em>{MF_CERT}</em>. Fill this in and we'll confirm your place, then send the dates, the venue and the fee for the next batch before we announce them anywhere else.</p>
      </div>

      <form class="tm-form" id="mf-form" novalidate>
        <h2 class="tm-form-title">Your details</h2>
        <p class="tm-form-sub">Nothing to pay on this page, and no payment details are asked for anywhere on it.</p>

        <div class="tm-field"><label for="mf-name">Name <span class="tm-req">*</span></label><input type="text" id="mf-name" placeholder="Your full name" autocomplete="name"></div>
        <div class="tm-row">
          <div class="tm-field"><label for="mf-institute">School / Institute <span class="tm-req">*</span></label><input type="text" id="mf-institute" placeholder="Where you teach or study, or &quot;home&quot;" autocomplete="organization"></div>
          <div class="tm-field"><label for="mf-role">Your role or education <span class="tm-req">*</span></label><input type="text" id="mf-role" placeholder="e.g. Parent, Montessori directress, BS Psychology"></div>
        </div>
        <div class="tm-row">
          <div class="tm-field"><label for="mf-phone">Phone <span class="tm-req">*</span></label><input type="tel" id="mf-phone" placeholder="+92..." autocomplete="tel"></div>
          <div class="tm-field"><label for="mf-email">Email <span class="tm-req">*</span></label><input type="email" id="mf-email" placeholder="your@email.com" autocomplete="email"></div>
        </div>
        <div class="tm-field">
          <label for="mf-prior">Prior knowledge</label>
          <textarea id="mf-prior" placeholder="Training, teaching experience, or the ages of your own children. It is completely fine to write none."></textarea>
        </div>
        <div class="tm-field">
          <label for="mf-expect">Expectations</label>
          <textarea id="mf-expect" placeholder="A sentence or two is plenty, and it genuinely shapes how we run day three."></textarea>
        </div>

        <div class="tm-alert" id="mf-alert" role="alert" hidden></div>
        <div class="tm-actions">
          <button type="submit" class="btn-primary" id="mf-submit">{icon(prefix,'i-clipboard','18')} <span id="mf-submit-label">Reserve My Place</span></button>
        </div>

        <p class="tm-note">Registering costs nothing and commits you to nothing: it puts you first in line when the next batch opens. Your details go straight to the MindCare team and are never shown publicly. Questions first? Call <a href="tel:{PHONE}" style="font-weight:600">{PHONE_H}</a> or <a href="{MF_WA}" target="_blank" rel="noopener" style="font-weight:600">message us on WhatsApp</a>.</p>
      </form>

      <p style="text-align:center;margin-top:22px"><a href="/{MF_SLUG}" class="more" style="font-weight:600">← Read the workshop details</a></p>
    </div>
  </div>
</section>
</main>
<script>{MF_FORM_JS}</script>
"""
    out += footer(prefix)
    return out


def workshops_page():
    prefix = ""
    url = f"{BASE}/workshops"
    schema = {"@context": "https://schema.org", "@graph": [
        {"@type": "CollectionPage", "name": "Workshops & Trainings | MindCare Services®", "url": url,
         "description": "Professional psychology workshops and certification trainings by MindCare Services® in Karachi."},
        {"@type": "BreadcrumbList", "itemListElement": [
            {"@type": "ListItem", "position": 1, "name": "Home", "item": f"{BASE}/"},
            {"@type": "ListItem", "position": 2, "name": "Workshops", "item": url}]},
        {"@type": "Course", "name": MF_PLAIN,
         "url": f"{BASE}/{MF_SLUG}",
         "image": f"{BASE}/{MF_OG}",
         "inLanguage": ["en", "ur"],
         "description": ("A three-day Montessori fundamentals certificate workshop in Karachi for "
                         "parents, early-years teachers and students, covering the child's "
                         "perspective, early childhood psychology and the practical life area of the "
                         "Montessori curriculum."),
         "offers": {"@type": "Offer", "availability": "https://schema.org/InStock",
                    "url": f"{BASE}/{MF_REG_SLUG}"},
         "provider": {"@type": "Organization", "name": "MindCare Services®", "url": BASE},
         "hasCourseInstance": {"@type": "CourseInstance", "courseMode": "Onsite", "courseWorkload": "P3D",
                               "location": {"@type": "Place", "name": "MindCare Services®",
                                            "address": {"@type": "PostalAddress",
                                                        "addressLocality": "Karachi",
                                                        "addressCountry": "PK"}}}},
        {"@type": "Event", "name": "Applied Psychology Masterclass: 5-Day Certification Series",
         "startDate": "2026-07-27", "endDate": "2026-07-31",
         "eventStatus": "https://schema.org/EventScheduled",
         "offers": {"@type": "Offer", "availability": "https://schema.org/SoldOut",
                    "url": f"{BASE}/workshops#masterclass"},
         "eventAttendanceMode": "https://schema.org/OfflineEventAttendanceMode",
         "image": f"{BASE}/assets/workshops/00-main-poster.png",
         "description": "A 5-day applied psychology certification masterclass covering case conceptualization, CBT interventions, trauma-informed care, ethics & crisis management, and practice building. Includes certificate and toolkit manual.",
         "organizer": {"@type": "Organization", "name": "MindCare Services®", "url": BASE},
         "location": {"@type": "Place", "name": "MindCare Services®",
                      "address": {"@type": "PostalAddress", "addressLocality": "Karachi",
                                  "addressCountry": "PK"}}},
        # Kept in the graph as a completed course: the page still documents it.
        {"@type": "Course", "name": TM_PLAIN,
         "url": f"{BASE}/{TM_SLUG}",
         "image": f"{BASE}/{TM_POSTER}",
         "isAccessibleForFree": True,
         "description": ("A free two-evening live online workshop on meditation, limbic resonance and "
                         "empathic attunement. This workshop has been delivered and registration is closed."),
         "offers": {"@type": "Offer", "price": "0", "priceCurrency": "PKR", "category": "Free",
                    "availability": "https://schema.org/SoldOut", "url": f"{BASE}/{TM_SLUG}"},
         "provider": {"@type": "Organization", "name": "MindCare Services®", "url": BASE},
         "hasCourseInstance": {"@type": "CourseInstance", "courseMode": "Online",
                               "courseWorkload": "PT4H",
                               "location": {"@type": "VirtualLocation", "url": f"{BASE}/{TM_SLUG}"}}}]}

    mf_days = "\n".join(f'''      <article class="feature-card fade-up mf-day">
        <span class="mf-num">{d['num']}</span>
        <span class="section-tag">{d['label']}</span>
        <h3 style="margin-top:10px">{d['title']}</h3>
        <p>{d['desc']}</p>
      </article>''' for d in MF_DAYS)

    day_cards = "\n".join(f'''      <article class="feature-card fade-up ws-day">
        <img src="assets/workshops/{d['img']}" alt="{html.escape(d['title'])}, Applied Psychology Masterclass {d['day']}" width="1080" height="1350" loading="lazy" style="width:100%;height:auto;border-radius:14px;margin-bottom:16px">
        <span class="section-tag">{d['day']}</span>
        <h3 style="margin-top:10px">{html.escape(d['title'])}</h3>
        <p>{html.escape(d['desc'])}</p>
        <ul class="aside-list" style="margin-top:12px">
{chr(10).join(li(prefix, k) for k in d['kit'])}
        </ul>
      </article>''' for d in WS_DAYS)

    out = head("Workshops & Trainings | Montessori Fundamentals Certificate, Karachi | MindCare Services®",
               "MindCare workshops: register for Mind in the Making, our three-day Montessori "
               "Fundamentals Certificate in Karachi, plus the Applied Psychology Masterclass "
               "certification series. See what's open and what we've already run.",
               url, prefix, schema, og_type="website")
    out = social_image(out, MF_OG, MF_ALT, 1200, 630)
    out += nav(prefix, "workshops")
    out += f"""<main id="main">
<style>{MF_CSS}
.ws-past .ws-shot{{filter:saturate(.78);box-shadow:0 14px 36px rgba(6,43,49,.18)}}
.ws-shot{{position:relative;display:block;border-radius:18px;overflow:hidden;line-height:0}}
.ws-shot img{{display:block;width:100%;height:auto}}
/* A soft fade rather than a hard band: the poster's own call to action sits in
   the bottom eighth, and a gradient covers it without slicing the line above. */
.ws-shot::after{{content:'Completed · Registration Closed';position:absolute;left:0;right:0;bottom:0;
 height:14%;min-height:44px;display:flex;align-items:flex-end;justify-content:center;
 padding:0 10px 3.2%;background:linear-gradient(180deg,rgba(11,95,109,0) 0%,rgba(11,95,109,.92) 42%,rgba(11,95,109,.97) 100%);
 color:#fff;font-family:'DM Sans',sans-serif;font-size:.76rem;font-weight:700;letter-spacing:.14em;
 text-transform:uppercase;text-align:center;line-height:1.3}}
@media(max-width:520px){{.ws-shot::after{{font-size:.66rem;letter-spacing:.1em}}}}
.ws-done-tag{{display:inline-flex;align-items:center;gap:8px;font-size:.72rem;font-weight:700;letter-spacing:.14em;
 text-transform:uppercase;color:var(--green);background:var(--green-light);border:1px solid rgba(45,106,31,.22);
 padding:6px 14px;border-radius:50px;margin-bottom:12px}}
</style>

<header class="page-hero">
  <div class="ph-inner">
    <ol class="breadcrumb"><li><a href="/">Home</a></li><li aria-current="page">Workshops</li></ol>
    <div class="ph-badge">{icon(prefix,'i-school')} Next Up · 3-Day Certificate · Registration Open</div>
    <h1>Workshops &amp; <em>Trainings</em></h1>
    <p class="lede">Practical, human, evidence-based learning from the MindCare clinical team, in person in Karachi and online. Open for registration right now: <strong>{MF_TITLE}</strong>, our three-day Montessori Fundamentals Certificate for parents and early-years teachers.</p>
    <div class="ph-actions">
      <a href="/{MF_REG_SLUG}" class="btn-primary">{icon(prefix,'i-clipboard','18')} Reserve My Place</a>
      <a href="#masterclass" class="btn-secondary">See the Masterclass ↓</a>
    </div>
  </div>
</header>

<section>
  <div class="section-inner">
    <div class="section-header centered fade-up"><span class="section-tag">New · Registration Open</span><h2 class="section-title">Our next workshop is three days on the child</h2></div>
    <div class="split-grid fade-up" style="display:grid;grid-template-columns:repeat(auto-fit,minmax(min(290px,100%),1fr));gap:36px;align-items:center">
      <div>
        <a href="/{MF_SLUG}" aria-label="Mind in the Making, Montessori Fundamentals Certificate workshop details"><img src="{prefix}{MF_POSTER}" alt="{MF_ALT}" width="900" height="1200" class="mf-poster"></a>
      </div>
      <div>
        <span class="section-tag">3 Days · Karachi · Certificate</span>
        <h3 style="font-size:1.7rem;margin:10px 0 12px">{MF_TITLE}: <em>{MF_CERT}</em></h3>
        <p style="margin-bottom:16px">Watch the child before you correct the child. Three days that teach you to see a small child's world from the inside, explain what is actually happening developmentally in the first six years, and then hand you the practical life area of the Montessori curriculum to set up at home or in your classroom.</p>
        <ul class="aside-list">
{li(prefix,'Day 01 · Decoding the child&#39;s perspective')}
{li(prefix,'Day 02 · Early childhood psychology')}
{li(prefix,'Day 03 · The practical life area of the Montessori curriculum')}
{li(prefix,'Certificate of Completion for every participant')}
{li(prefix,'Written for parents and early-years teachers alike')}
{li(prefix,'Observation sheets, milestone charts &amp; an activity bank to keep')}
        </ul>
        <div style="margin-top:24px;display:flex;gap:12px;flex-wrap:wrap">
          <a href="/{MF_REG_SLUG}" class="btn-primary">{icon(prefix,'i-clipboard','18')} Reserve My Place</a>
          <a href="/{MF_SLUG}" class="btn-secondary">Full details →</a>
        </div>
      </div>
    </div>
  </div>
</section>

<section class="bg-off">
  <div class="section-inner">
    <div class="section-header centered fade-up"><span class="section-tag">The Three Days</span><h2 class="section-title">One question per day, answered properly</h2><p class="section-sub">Each day stands on the one before it: see the child, understand the child, then set up the environment the child can actually work in.</p></div>
    <div class="feature-grid">
{mf_days}
    </div>
    <div style="text-align:center;margin-top:36px" class="fade-up">
      <a href="/{MF_SLUG}" class="btn-secondary">Read the full three-day breakdown →</a>
    </div>
  </div>
</section>

<section id="masterclass">
  <div class="section-inner">
    <div class="section-header centered fade-up"><span class="section-tag">Certification Series · Karachi</span><h2 class="section-title">Applied Psychology Masterclass</h2><p class="section-sub">Five days. Five clinical skill sets. One certification: our in-person training for students and helping professionals, delivered 27-31 July 2026. Registration for this run is closed, and we do re-run it.</p></div>
    <div class="split-grid" style="display:grid;grid-template-columns:repeat(auto-fit,minmax(min(300px,100%),1fr));gap:36px;align-items:center">
      <div class="fade-up">
        <span class="ws-shot" style="box-shadow:0 18px 48px rgba(0,0,0,.18);filter:saturate(.78)"><img src="assets/workshops/00-main-poster.png" alt="Applied Psychology Masterclass, 5-day certification series poster, 27-31 July 2026. This masterclass has been completed." width="1080" height="1350" loading="lazy"></span>
      </div>
      <div class="fade-up">
        <span class="ws-done-tag">{icon(prefix,'i-check','15')} Completed · Registration Closed</span>
        <span class="section-tag">Why this masterclass</span>
        <h2 class="section-title">Walk out session-ready, not just certified</h2>
        <p style="margin:14px 0 18px">Most trainings end with a certificate. This one ended with a working clinical toolkit: printed templates, worksheets and scripts participants actually use with clients, plus the confidence to apply them. This run has been delivered; the full outline is kept here as the record.</p>
        <ul class="aside-list">
{li(prefix,'Certificate of completion for every participant')}
{li(prefix,'Complete practitioner toolkit &amp; manual to keep')}
{li(prefix,'Hands-on practice, real case studies, live demos')}
{li(prefix,'Photocopy-ready worksheets for your future clients')}
{li(prefix,'Taught by MindCare&#39;s clinical team in Karachi')}
        </ul>
        <div style="margin-top:24px"><a href="{WS_WA}" target="_blank" rel="noopener" class="btn-secondary">{icon(prefix,'i-wa','18')} Tell me when it runs again</a></div>
      </div>
    </div>
  </div>
</section>

<section id="schedule" class="bg-off">
  <div class="section-inner">
    <div class="section-header centered fade-up"><span class="section-tag">The 5-Day Journey</span><h2 class="section-title">One skill set per day, one toolkit for life</h2><p class="section-sub">Each day builds on the last, and each day you take home the exact tools professionals use.</p></div>
    <div class="card-grid">
{day_cards}
    </div>
  </div>
</section>

<section id="past">
  <div class="section-inner">
    <div class="section-header centered fade-up"><span class="section-tag">Already Delivered</span><h2 class="section-title">Workshops we've already run</h2><p class="section-sub">Kept here as a record of what we teach. Registration for these is closed, but we do re-run the popular ones.</p></div>
    <div class="split-grid fade-up ws-past" style="display:grid;grid-template-columns:repeat(auto-fit,minmax(min(260px,100%),1fr));gap:36px;align-items:center">
      <div>
        <a href="/{TM_SLUG}" class="ws-shot" aria-label="Telepathy and Meditation workshop details, completed"><img src="{prefix}{TM_POSTER}" alt="Telepathy &amp; Meditation: The Art of Deep Attunement, live online workshop poster. This workshop has been completed." width="900" height="1200"></a>
      </div>
      <div>
        <span class="ws-done-tag">{icon(prefix,'i-check','15')} Completed · Registration Closed</span>
        <h3 style="font-size:1.5rem;margin:4px 0 12px">Telepathy &amp; Meditation: <em>The Art of Deep Attunement</em></h3>
        <p style="margin-bottom:16px">Two free live evenings on Zoom: the meditation that quiets your own noise, then the listening that lets another person's signal through, with an honest look at the science of empathy and co-regulation. Delivered free as promised, with the guided audio, workbook and recordings sent to every participant.</p>
        <div style="display:flex;gap:12px;flex-wrap:wrap">
          <a href="/{TM_SLUG}" class="btn-secondary">See what it covered →</a>
        </div>
      </div>
    </div>
  </div>
</section>

<section class="bg-off">
  <div class="section-inner">
    <div class="section-header centered fade-up"><span class="section-tag">Good For</span><h2 class="section-title">Who should attend</h2></div>
    <div class="feature-grid">
      <div class="feature-card fade-up"><div class="fi">{icon(prefix,'i-family')}</div><h3>Parents &amp; caregivers</h3><p>Understand the child in front of you before you correct them, and build an environment they can actually work in.</p></div>
      <div class="feature-card fade-up"><div class="fi">{icon(prefix,'i-school')}</div><h3>Teachers &amp; early-years staff</h3><p>Montessori directresses, playgroup and daycare staff who want the psychology underneath the method.</p></div>
      <div class="feature-card fade-up"><div class="fi">{icon(prefix,'i-grad')}</div><h3>Students &amp; fresh graduates</h3><p>Bridge the gap between the classroom and the real room, with tools and templates already in hand.</p></div>
      <div class="feature-card fade-up"><div class="fi">{icon(prefix,'i-heart-hands')}</div><h3>Helping professionals</h3><p>Counselors, therapists and community workers who want evidence-based tools they can use responsibly.</p></div>
    </div>
    <div style="text-align:center;margin-top:40px" class="fade-up">
      <p style="margin-bottom:16px;font-weight:600">Seats are limited, and registration closes when the batch is full.</p>
      <a href="/{MF_REG_SLUG}" class="btn-primary">{icon(prefix,'i-clipboard','18')} Reserve My Place</a>
      <p style="margin-top:14px">or call <a href="tel:{PHONE}" style="font-weight:600">{PHONE_H}</a></p>
    </div>
  </div>
</section>

{cta_band(prefix, "Want a workshop we haven't listed?", "Tell us the topic and who it's for, and we'll build it for your school, workplace or community. Message us on WhatsApp and a real person from our team will answer.")}
</main>
"""
    out += footer(prefix)
    return out



def confirmation_page():
    prefix = ""
    url = f"{BASE}/confirmed"
    schema = {"@context": "https://schema.org", "@type": "WebPage",
              "name": "Appointment Confirmed | MindCare Services®", "url": url,
              "description": "Your appointment request has been received. The MindCare Services® team will be in touch shortly to confirm your session.",
              "isPartOf": {"@type": "WebSite", "name": "MindCare Services®", "url": BASE}}
    out = head("Appointment Confirmed | Thank You | MindCare Services®",
               "Thank you. Your appointment request has been received. Our team will contact you shortly to confirm the details. Keeping Your Peace®.",
               url, prefix, schema)
    # Thank-you pages should not be indexed by search engines.
    out = out.replace('<meta name="robots" content="index, follow, max-image-preview:large, max-snippet:-1">',
                      '<meta name="robots" content="noindex, follow">')
    out += nav(prefix)
    out += f"""<main id="main">
<header class="page-hero confirm-hero">
  <div class="ph-inner" style="text-align:center;max-width:720px;margin:0 auto">
    <div class="confirm-check" aria-hidden="true">
      <svg width="52" height="52" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6 9 17l-5-5"/></svg>
    </div>
    <div class="ph-badge" style="margin:0 auto 18px">{icon(prefix,'i-heart-hands')} Keeping Your Peace®</div>
    <h1>Your appointment request is confirmed</h1>
    <p class="lede">Thank you for reaching out to MindCare Services®. We've received your request and a member of our team will contact you shortly to finalise the date, time and details of your session.</p>
    <div class="ph-actions" style="justify-content:center">
      <a href="{WA}?text=Hi%2C%20I%20just%20booked%20an%20appointment%20and%20wanted%20to%20confirm%20the%20details." target="_blank" rel="noopener" class="btn-primary">{icon(prefix,'i-wa','18')} Message us on WhatsApp</a>
      <a href="/" class="btn-secondary">Back to Home</a>
    </div>
  </div>
</header>

<section>
  <div class="section-inner">
    <div class="section-header centered fade-up"><span class="section-tag">What Happens Next</span><h2 class="section-title">Here's what to expect</h2></div>
    <div class="feature-grid">
      <div class="feature-card fade-up"><div class="fi">{icon(prefix,'i-phone')}</div><h3>1. We'll be in touch</h3><p>Our coordinator will reach out by phone or WhatsApp to confirm your appointment and answer any questions.</p></div>
      <div class="feature-card fade-up"><div class="fi">{icon(prefix,'i-clock')}</div><h3>2. Confirm your time</h3><p>We'll lock in a slot that suits you. Sessions run Mon-Sat, 9am-7pm, in-clinic in Karachi.</p></div>
      <div class="feature-card fade-up"><div class="fi">{icon(prefix,'i-heart-hands')}</div><h3>3. Your first session</h3><p>A relaxed, judgment-free conversation. Nothing to prepare, just come as you are.</p></div>
    </div>
    <div style="text-align:center;margin-top:36px">
      <p style="margin-bottom:14px">Need to reach us sooner? Call <a href="tel:{PHONE}" style="font-weight:600">{PHONE_H}</a>.</p>
      <a href="/services/" class="more" style="font-weight:600">Explore our services →</a>
    </div>
  </div>
</section>

{cta_band(prefix, "While you wait, get to know us", "Read about our team and approach, or reach out any time on WhatsApp. We're here to help.")}
</main>
"""
    out += footer(prefix)
    return out


def write(path, content):
    full = os.path.join(ROOT, path)
    os.makedirs(os.path.dirname(full), exist_ok=True)
    with open(full, "w", encoding="utf-8") as f:
        f.write(content)
    print("wrote", path)


def last_modified(path):
    """The date a page really changed, for <lastmod>.

    Stamping every URL with today's date on every build tells crawlers the
    whole site changed when nothing did, and rewrites all fifty lines of the
    sitemap in each diff. So: a page with uncommitted edits changed today,
    anything else carries the date of the commit that last touched it.
    """
    def git(*args):
        return subprocess.run(("git", *args), cwd=ROOT, capture_output=True,
                              text=True, check=True).stdout.strip()
    try:
        if git("status", "--porcelain", "--", path):
            return TODAY
        return git("log", "-1", "--format=%cs", "--", path) or TODAY
    except (OSError, subprocess.SubprocessError):
        return TODAY


def build():
    for s in SERVICES:
        write(f"services/{s['slug']}.html", service_page(s))
    write("services/index.html", services_index())
    for m in TEAM:
        write(f"team/{m['slug']}.html", team_page(m))
    write("team/index.html", team_index())
    for t in TOPICS:
        write(f"{t['slug']}.html", seo_page(t))
    write("guides.html", guides_index())
    for i, a in enumerate(ARTICLES):
        write(f"articles/{a['slug']}.html", article_page(a, i))
    write("articles.html", articles_index())
    write("workshops.html", workshops_page())
    write(f"{MF_SLUG}.html", montessori_page())
    write(f"{MF_REG_SLUG}.html", montessori_register_page())
    write(f"{TM_SLUG}.html", telepathy_meditation_page())
    write(f"{TM_REG_SLUG}.html", telepathy_register_page())
    write("confirmed.html", confirmation_page())
    # sitemap. Every entry is (served URL, source file, priority): the file is
    # what lastmod is read from, so a page only claims to have changed when it
    # actually has. /confirmed and the closed telepathy registration are
    # noindex, so they are deliberately absent.
    urls = [(f"{BASE}/", "index.html", "1.0"),
            (f"{BASE}/about", "about.html", "0.7"),
            (f"{BASE}/contact", "contact.html", "0.8"),
            (f"{BASE}/services/", "services/index.html", "0.9"),
            (f"{BASE}/team/", "team/index.html", "0.7"),
            (f"{BASE}/guides", "guides.html", "0.8"),
            (f"{BASE}/articles", "articles.html", "0.7"),
            (f"{BASE}/workshops", "workshops.html", "0.9"),
            (f"{BASE}/{MF_SLUG}", f"{MF_SLUG}.html", "0.9"),
            (f"{BASE}/{MF_REG_SLUG}", f"{MF_REG_SLUG}.html", "0.8"),
            (f"{BASE}/{TM_SLUG}", f"{TM_SLUG}.html", "0.6")]
    urls += [(f"{BASE}/services/{s['slug']}", f"services/{s['slug']}.html", "0.8") for s in SERVICES]
    urls += [(f"{BASE}/team/{m['slug']}", f"team/{m['slug']}.html", "0.6") for m in TEAM]
    urls += [(f"{BASE}/{t['slug']}", f"{t['slug']}.html", "0.8") for t in TOPICS]
    urls += [(art_url(a), f"articles/{a['slug']}.html", "0.7") for a in ARTICLES]
    body = "\n".join(
        f"  <url><loc>{u}</loc><lastmod>{last_modified(f)}</lastmod>"
        f"<changefreq>monthly</changefreq><priority>{p}</priority></url>"
        for u, f, p in urls)
    sitemap = ('<?xml version="1.0" encoding="UTF-8"?>\n'
               '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n'
               f"{body}\n</urlset>\n")
    write("sitemap.xml", sitemap)
    print(f"\nDone: {len(SERVICES)} services + {len(TEAM)} team + 2 index + sitemap")


if __name__ == "__main__":
    build()
