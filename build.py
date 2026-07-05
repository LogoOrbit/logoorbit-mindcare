#!/usr/bin/env python3
"""Static page generator for MindCare Services®.
Generates /services/*.html and /team/*.html plus their index pages from the
data tables below, so every interior page shares one design system and a
consistent SEO/schema baseline. Run: python3 build.py
"""
import os, html, json, datetime

BASE = "https://themindcareservices.com"
PHONE = "+92-327-2337631"
PHONE_H = "+92 327 2337631"
WA = "https://wa.me/923272337631"
ROOT = os.path.dirname(os.path.abspath(__file__))
TODAY = datetime.date.today().isoformat()

FONTS = ('<link rel="preconnect" href="https://fonts.googleapis.com">'
         '<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>'
         '<link href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,400;0,600;1,400;1,600&family=DM+Sans:wght@300;400;500;600;700&display=swap" rel="stylesheet">')


def head(title, desc, canonical, prefix, schema, og_type="website"):
    return f"""<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<meta name="theme-color" content="#2BBDC9" media="(prefers-color-scheme: light)">
<meta name="theme-color" content="#0e1b13" media="(prefers-color-scheme: dark)">
<meta name="color-scheme" content="light dark">
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
<link rel="apple-touch-icon" href="{prefix}mindcare.png">
<link rel="manifest" href="{prefix}site.webmanifest">
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


def icon(prefix, name, w=None):
    a = f' width="{w}" height="{w}"' if w else ''
    return f'<svg{a}><use href="{prefix}assets/sprite.svg#{name}"/></svg>'


def nav(prefix):
    return f"""<nav id="navbar" aria-label="Primary navigation">
  <a href="{prefix}index.html" class="nav-logo" aria-label="MindCare Services home">
    <img src="{prefix}mindcare.png" width="120" height="54" alt="MindCare Services® — psychotherapy and mental health clinic in Karachi">
  </a>
  <ul class="nav-links">
    <li><a href="{prefix}index.html">Home</a></li>
    <li><a href="{prefix}services/index.html">Services</a></li>
    <li><a href="{prefix}index.html#journey">How It Works</a></li>
    <li><a href="{prefix}team/index.html">Team</a></li>
    <li><a href="{prefix}index.html#about">About</a></li>
    <li><a href="{prefix}contact.html" class="nav-cta">Book Consultation</a></li>
  </ul>
  <button type="button" class="hamburger" onclick="toggleMenu()" aria-label="Open menu" aria-expanded="false" aria-controls="mobileMenu"><span></span><span></span><span></span></button>
</nav>
<div class="mobile-menu" id="mobileMenu">
  <a href="{prefix}index.html">Home</a>
  <a href="{prefix}services/index.html">Services</a>
  <a href="{prefix}index.html#journey">How It Works</a>
  <a href="{prefix}team/index.html">Team</a>
  <a href="{prefix}index.html#about">About</a>
  <a href="{prefix}index.html#faq">FAQ</a>
  <a href="{prefix}contact.html" class="m-cta">Book a Consultation</a>
  <a href="{WA}" target="_blank" rel="noopener" class="m-wa">{icon(prefix,'i-wa','18')} Chat on WhatsApp</a>
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
      <a href="{prefix}contact.html" class="btn-white">Book Free Consultation</a>
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
      <li><a href="{prefix}services/individual-psychotherapy.html">Psychotherapy</a></li>
      <li><a href="{prefix}services/family-counseling.html">Family Counseling</a></li>
      <li><a href="{prefix}services/speech-therapy.html">Speech Therapy</a></li>
      <li><a href="{prefix}services/physiotherapy.html">Physiotherapy</a></li>
      <li><a href="{prefix}services/behavioral-therapy.html">Behavioral Therapy</a></li>
      <li><a href="{prefix}services/index.html">All Services</a></li>
    </ul></div>
    <div class="footer-col"><h4>Company</h4><ul>
      <li><a href="{prefix}index.html#about">About Us</a></li>
      <li><a href="{prefix}index.html#journey">How It Works</a></li>
      <li><a href="{prefix}team/index.html">Our Team</a></li>
      <li><a href="{prefix}index.html#faq">FAQ</a></li>
      <li><a href="{prefix}contact.html">Book Appointment</a></li>
    </ul></div>
    <div class="footer-col"><h4>Contact</h4><ul>
      <li><a href="tel:{PHONE}">{PHONE_H}</a></li>
      <li><a href="https://www.instagram.com/mindcare.services/" target="_blank" rel="noopener">@mindcare.services</a></li>
      <li><a href="mailto:traineegenes@gmail.com">traineegenes@gmail.com</a></li>
      <li><a href="{prefix}contact.html">Book Consultation</a></li>
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
         title="Individual Psychotherapy in Karachi | CBT for Anxiety & Depression — MindCare Services®",
         desc="One-on-one psychotherapy in Karachi for anxiety, depression, stress and trauma. Evidence-based CBT and talk therapy for adults and adolescents. Book a free consultation.",
         lede="Confidential, one-on-one talk therapy for adults and adolescents — using proven methods like CBT to work through anxiety, depression, stress and trauma at a pace that feels right for you.",
         helps=["Anxiety, panic and constant worry", "Depression, low mood and loss of motivation",
                "Stress, burnout and overwhelm", "Trauma and difficult past experiences",
                "Self-esteem, identity and life transitions", "Sleep problems linked to your mental state"],
         approach=["Therapy here is a partnership, not a lecture. Your first session is a relaxed conversation where we listen to what's going on and answer your questions — nothing you have to prepare, no pressure.",
                   "From there, your therapist draws on evidence-based approaches — Cognitive Behavioral Therapy (CBT), psychodynamic therapy and motivational techniques — chosen to fit you, not a one-size-fits-all script. You set the goals; we bring the tools and the steady support."],
         included=[("i-brain","Evidence-Based Methods","CBT, psychodynamic and motivational therapy, tailored to your needs."),
                   ("i-lock","Total Confidentiality","Everything you share stays private — always."),
                   ("i-heart-hands","Judgment-Free Space","Come as you are. No problem is too small to bring."),
                   ("i-clock","Flexible Sessions","In-clinic appointments Mon–Sat, scheduled around you.")],
         faqs=[("Do I need a diagnosis to start therapy?","No. You don't need a referral or a diagnosis to begin. Many people come simply because something feels off — that's reason enough. We'll figure out the rest together."),
               ("How long does psychotherapy take?","It varies from person to person. Some concerns ease in a handful of sessions; others benefit from longer support. Your therapist will discuss a realistic plan with you and review it as you progress."),
               ("Is what I share really confidential?","Yes. Your sessions are 100% confidential and never disclosed to anyone. Confidentiality is central to how MindCare works.")]),
    dict(slug="family-counseling", icon="i-family", name="Family & Relationship Counseling",
         title="Family & Relationship Counseling in Karachi — MindCare Services®",
         desc="Family and couples counseling in Karachi to rebuild communication, resolve conflict and navigate change together. Guided, confidential sessions. Book a free consultation.",
         lede="Guided sessions that help families and couples rebuild communication, resolve recurring conflict, and navigate big life transitions — together, with a neutral, caring professional in the room.",
         helps=["Communication breakdowns and repeated arguments", "Parent–child and teenager conflict",
                "Marital and relationship strain", "Adjusting to major life changes together",
                "Blended-family and in-law dynamics", "Grief and loss within the family"],
         approach=["Most family conflict isn't about who's right — it's about patterns that keep repeating. Our counselors help everyone feel heard, then gently surface those patterns so the whole family can change them together.",
                   "Sessions are structured but warm. We set shared goals, teach practical communication skills, and give each person space to be understood — building trust and connection that lasts beyond the room."],
         included=[("i-family","Whole-Family View","We work with the relationships, not against any one person."),
                   ("i-heart-hands","Neutral & Fair","Everyone gets heard — no sides, no blame."),
                   ("i-lock","Private & Safe","A confidential space for honest conversations."),
                   ("i-check","Practical Skills","Communication tools you can actually use at home.")],
         faqs=[("Does everyone in the family need to attend?","Not necessarily. Sessions can include the whole family, a couple, or start with one person. We'll recommend what's most helpful for your situation."),
               ("Can you help with couples as well as families?","Yes. We support couples and married partners as well as parents, children and extended-family relationships."),
               ("What if my family has never done counseling before?","That's completely normal and most families haven't. Your first session is a gentle introduction — there's nothing to prepare and no pressure.")]),
    dict(slug="speech-therapy", icon="i-speech", name="Speech Therapy",
         title="Speech Therapy in Karachi for Children & Adults — MindCare Services®",
         desc="Expert speech therapy in Karachi for language delays, articulation, stammering and communication disorders in children and adults. Book a free assessment today.",
         lede="Expert support for communication — from children's language delays and articulation to adult fluency and speech recovery — with warm, structured therapy that builds real confidence.",
         helps=["Speech and language delays in children", "Articulation and pronunciation difficulties",
                "Stammering and fluency challenges", "Autism-related communication support",
                "Adult speech recovery after illness or injury", "Social communication and expression skills"],
         approach=["Communication is how we connect — and small, consistent steps create big change. Our speech therapists begin with a careful assessment, then build a personalized plan of playful, goal-driven exercises.",
                   "For children, therapy often looks like structured play; for adults, targeted practice and coaching. Families get guidance to reinforce progress at home, so gains carry into everyday life."],
         included=[("i-clipboard","Full Assessment","We start by understanding exactly what's needed."),
                   ("i-speech","Tailored Plans","Personalized, age-appropriate therapy goals."),
                   ("i-family","Family Coaching","We show you how to support progress at home."),
                   ("i-check","Measured Progress","Clear milestones you can see and celebrate.")],
         faqs=[("At what age should my child start speech therapy?","Earlier is better, but it's never too late. If you've noticed a delay or difficulty at any age, an assessment will tell you whether therapy would help."),
               ("Do you offer speech therapy for adults?","Yes. We support adults with fluency, articulation and speech recovery needs, including after illness or injury."),
               ("How is progress tracked?","Your therapist sets clear, measurable goals and reviews them regularly, so you can see improvement over time.")]),
    dict(slug="physiotherapy", icon="i-physio", name="Physiotherapy",
         title="Physiotherapy in Karachi | Pain Relief & Rehabilitation — MindCare Services®",
         desc="Physiotherapy in Karachi for pain relief, rehabilitation and improved mobility. Musculoskeletal and neuro-physiotherapy by experienced physiotherapists. Book today.",
         lede="Rehabilitation, pain management and mobility improvement — assessed and treated by experienced physiotherapists who help you move, recover and feel like yourself again.",
         helps=["Back, neck and joint pain", "Post-injury and post-surgery rehabilitation",
                "Musculoskeletal conditions", "Neurological rehabilitation (neuro-PT)",
                "Posture and movement correction", "Chronic pain management"],
         approach=["Pain and stiffness shouldn't run your life. Our physiotherapists start with a thorough assessment to find the real source of the problem, then build a hands-on treatment and exercise plan around your goals.",
                   "Treatment combines manual therapy, guided exercise and education so you don't just feel better in the session — you keep improving between them, and learn how to prevent the problem returning."],
         included=[("i-clipboard","Thorough Assessment","We diagnose the cause, not just the symptom."),
                   ("i-physio","Hands-On Treatment","Manual therapy plus a tailored exercise plan."),
                   ("i-home","Home Programs","Simple exercises to keep progress going at home."),
                   ("i-check","Recovery Focused","Clear goals to get you back to full function.")],
         faqs=[("Do I need a doctor's referral for physiotherapy?","No referral is required. You can book an assessment directly and we'll advise on the best plan for you."),
               ("What conditions do you treat?","Musculoskeletal pain, sports and post-surgical injuries, neurological conditions, posture issues and chronic pain, among others."),
               ("How many sessions will I need?","It depends on your condition and goals. After your assessment, your physiotherapist will give you a realistic estimate and review it as you improve.")]),
    dict(slug="occupational-therapy", icon="i-hand", name="Occupational Therapy",
         title="Occupational Therapy in Karachi for All Ages — MindCare Services®",
         desc="Occupational therapy in Karachi helping children and adults regain independence in daily activities and life skills. Personalized OT programs. Book a free consultation.",
         lede="Helping individuals of all ages regain independence in the daily activities that matter most — from a child's fine-motor skills to an adult's return to everyday routines.",
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
         title="Behavioral Therapy in Karachi | ASD & ADHD Support — MindCare Services®",
         desc="Structured behavioral therapy in Karachi for ASD support, ADHD and social-skills development using proven frameworks. Individualized programs. Book a free consultation.",
         lede="Structured, evidence-based interventions for autism spectrum support, ADHD and social-skills development — building positive behaviors and skills through proven frameworks.",
         helps=["Autism spectrum (ASD) support", "ADHD and attention-related challenges",
                "Social-skills and communication development", "Managing challenging behaviors",
                "Emotional regulation and coping skills", "Building routines and positive habits"],
         approach=["Behavioral therapy works by understanding what drives a behavior, then teaching and reinforcing positive alternatives in small, consistent steps.",
                   "Our therapists use structured, proven frameworks tailored to each individual, and partner closely with families so strategies stay consistent between sessions — where the real progress happens."],
         included=[("i-cycle","Proven Frameworks","Structured, evidence-based intervention plans."),
                   ("i-puzzle","Individualized","Tailored to each person's strengths and needs."),
                   ("i-family","Family Partnership","Consistent strategies for home and school."),
                   ("i-check","Positive Focus","Building skills, not just reducing behaviors.")],
         faqs=[("What ages do you work with?","We primarily support children and adolescents, with programs individualized to each person's developmental level and goals."),
               ("Do you coordinate with schools or families?","Yes. Consistency matters, so we work closely with families and, where helpful, caregivers and educators."),
               ("Is behavioral therapy evidence-based?","Yes. We use structured, well-researched frameworks and adapt them to each individual.")]),
    dict(slug="remedial-home-sessions", icon="i-home", name="Remedial Home Sessions",
         title="Remedial Home Therapy Sessions in Karachi (Special Needs) — MindCare Services®",
         desc="Specialized home-based remedial therapy in Karachi for individuals with special needs. Professional, one-on-one care delivered to your doorstep. Book a consultation.",
         lede="Specialized, one-on-one therapy for individuals with special needs — delivered in the comfort and familiarity of your own home, by professionals who bring the clinic to you.",
         helps=["Special-needs support in a familiar setting", "Individuals who find clinic visits difficult",
                "Consistent one-on-one attention", "Skill-building within daily home routines",
                "Family involvement and coaching", "Continuity of care between clinic and home"],
         approach=["For many individuals with special needs, home is where they feel safest — and where learning sticks best. Our remedial home sessions bring professional, structured therapy directly to that environment.",
                   "Working in the home lets us build skills into real daily routines and coach families in the moment, creating consistent, meaningful progress that's hard to replicate in a clinic alone."],
         included=[("i-home","Care at Your Door","Professional therapy in a familiar setting."),
                   ("i-heart-hands","One-on-One","Focused, individualized attention every session."),
                   ("i-family","Family Coaching","We guide caregivers to reinforce progress."),
                   ("i-check","Real-Life Skills","Learning built into everyday routines.")],
         faqs=[("Which areas do you cover for home sessions?","We serve families across Karachi. Contact us with your location and we'll confirm availability."),
               ("Who are home sessions best suited for?","Individuals with special needs who benefit from a familiar environment or find travelling to a clinic difficult."),
               ("Are home sessions as effective as clinic sessions?","For many individuals they're more effective, because skills are practiced directly within daily routines and the home environment.")]),
    dict(slug="diagnostic-assessments", icon="i-clipboard", name="Diagnostic Assessments",
         title="Psychological & Diagnostic Assessments in Karachi — MindCare Services®",
         desc="Professional psychological and cognitive diagnostic assessments in Karachi to guide accurate diagnosis and personalized treatment planning. Book an assessment today.",
         lede="Cognitive and psychological evaluations that bring clarity — guiding accurate diagnosis and a personalized, effective treatment plan built around real understanding.",
         helps=["Clarity when symptoms are confusing or overlapping", "Cognitive and psychological evaluation",
                "Developmental and learning assessments", "A clear basis for a treatment plan",
                "Understanding strengths as well as challenges", "Informed next steps and referrals"],
         approach=["A good assessment answers the question 'what's really going on?' — and that clarity is often the turning point. Our evaluations are thorough, professional and explained in plain language.",
                   "You won't be handed a label and sent away. We walk you through what the results mean and translate them into clear, practical recommendations and a personalized plan."],
         included=[("i-clipboard","Thorough Evaluation","Structured cognitive and psychological assessment."),
                   ("i-brain","Expert Interpretation","Results explained clearly, in plain language."),
                   ("i-check","Actionable Plan","Findings turned into concrete next steps."),
                   ("i-lock","Confidential","Your results stay private and secure.")],
         faqs=[("What does a diagnostic assessment involve?","Typically a structured interview and standardized evaluation tools, followed by a clear explanation of the results and recommendations."),
               ("Will I understand the results?","Yes. We explain everything in plain language and give you practical, personalized next steps — no jargon, no confusion."),
               ("Is an assessment confidential?","Absolutely. Your assessment and results are kept strictly confidential.")]),
    dict(slug="dental-consultations", icon="i-tooth", name="Dental Consultations",
         title="Dental Consultations in Karachi | Oral Health Advice — MindCare Services®",
         desc="Professional dental consultations in Karachi — expert advice on oral health, treatment planning and preventive care from a qualified dental consultant. Book today.",
         lede="Expert advice on oral health, treatment planning and preventive care — from a qualified dental consultant, as part of MindCare's whole-person approach to wellbeing.",
         helps=["Oral health check-ups and advice", "Preventive and restorative care guidance",
                "Treatment planning and second opinions", "Understanding your options clearly",
                "Guidance on maintaining long-term oral health", "Referrals where specialist care is needed"],
         approach=["Oral health is part of overall health — and good decisions start with good advice. Our dental consultant offers clear, unhurried guidance so you understand your options before committing to anything.",
                   "Whether you need a check-up, a treatment plan or a second opinion, you'll get honest, professional advice focused on preventive care and long-term wellbeing."],
         included=[("i-tooth","Expert Advice","Guidance from a qualified dental consultant."),
                   ("i-clipboard","Treatment Planning","Clear options explained without pressure."),
                   ("i-shield","Preventive Focus","Care aimed at long-term oral health."),
                   ("i-check","Honest Guidance","Straightforward advice you can trust.")],
         faqs=[("What can I expect from a dental consultation?","A professional assessment of your oral health, clear explanation of any concerns, and honest guidance on your options and next steps."),
               ("Do you focus on preventive care?","Yes. Our emphasis is on preventive advice and long-term oral health, alongside treatment planning where needed."),
               ("Can I get a second opinion here?","Yes. If you'd like clarity on an existing treatment plan, our consultant can provide a professional second opinion.")]),
    dict(slug="awareness-sessions", icon="i-grad", name="Awareness Sessions & Trainings",
         title="Mental Health Awareness Sessions & Corporate Trainings in Karachi — MindCare Services®",
         desc="Certified mental health awareness sessions and trainings in Karachi for workplaces, schools and institutions. Reduce stigma and build resilience. Enquire today.",
         lede="Certified mental health workshops for workplaces, schools and institutions — designed to reduce stigma, build resilience and equip your community with practical wellbeing tools.",
         helps=["Corporate wellness and employee wellbeing", "School and university awareness programs",
                "Reducing mental health stigma", "Building resilience and coping skills",
                "Stress management for teams", "Creating supportive institutional cultures"],
         approach=["Awareness changes everything — when people understand mental health, they seek help sooner and support each other better. Our sessions are engaging, practical and tailored to your audience.",
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
        f'''      <a class="link-card fade-up" href="{r['slug']}.html"><div class="fi">{icon(prefix,r['icon'])}</div><h3>{r['name']}</h3><p>{r['lede'][:96]}…</p><span class="more">Learn more →</span></a>'''
        for r in related)

    out = head(s["title"], s["desc"], url, prefix, schema)
    out += nav(prefix)
    out += f"""<main id="main">
<header class="page-hero">
  <div class="ph-inner">
    <ol class="breadcrumb"><li><a href="{prefix}index.html">Home</a></li><li><a href="index.html">Services</a></li><li aria-current="page">{s['name']}</li></ol>
    <div class="ph-badge">{icon(prefix,'i-shield')} Evidence-based · Confidential · Karachi</div>
    <h1>{s['name']}</h1>
    <p class="lede">{s['lede']}</p>
    <div class="ph-actions">
      <a href="{prefix}contact.html" class="btn-primary">Book Free Consultation</a>
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
          <li>{icon(prefix,'i-clock')} Mon–Sat, 9am–7pm</li>
          <li>{icon(prefix,'i-phone')} {PHONE_H}</li>
        </ul>
        <div class="aside-actions">
          <a href="{prefix}contact.html" class="btn-primary" style="justify-content:center">Book a Consultation</a>
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

{cta_band(prefix, "Not sure if this is right for you?", "That's okay — a free, confidential consultation will help you decide. No pressure.")}
</main>
"""
    out += footer(prefix)
    return out


def services_index():
    prefix = "../"
    url = f"{BASE}/services/"
    schema = {"@context": "https://schema.org", "@graph": [
        {"@type": "CollectionPage", "name": "Our Services — MindCare Services®", "url": url,
         "description": "The full range of psychotherapy, counseling and clinical services offered by MindCare Services® in Karachi."},
        {"@type": "BreadcrumbList", "itemListElement": [
            {"@type": "ListItem", "position": 1, "name": "Home", "item": f"{BASE}/"},
            {"@type": "ListItem", "position": 2, "name": "Services", "item": url}]},
        {"@type": "ItemList", "itemListElement": [
            {"@type": "ListItem", "position": i + 1, "name": s["name"], "url": f"{BASE}/services/{s['slug']}"}
            for i, s in enumerate(SERVICES)]},
    ]}
    cards = "\n".join(
        f'''      <a class="link-card fade-up" href="{s['slug']}.html"><div class="fi">{icon(prefix,s['icon'])}</div><h3>{s['name']}</h3><p>{s['lede'][:120]}…</p><span class="more">Learn more →</span></a>'''
        for s in SERVICES)
    out = head("Our Services | Psychotherapy, Counseling & Therapy in Karachi — MindCare Services®",
               "Explore all MindCare Services® offerings in Karachi: psychotherapy, family counseling, speech therapy, physiotherapy, occupational and behavioral therapy, assessments and more.",
               url, prefix, schema)
    out += nav(prefix)
    out += f"""<main id="main">
<header class="page-hero">
  <div class="ph-inner">
    <ol class="breadcrumb"><li><a href="{prefix}index.html">Home</a></li><li aria-current="page">Services</li></ol>
    <div class="ph-badge">{icon(prefix,'i-puzzle')} 10 services · One caring team</div>
    <h1>Comprehensive care for <em>mind &amp; body</em></h1>
    <p class="lede">A holistic range of therapy and clinical services — all under one roof in Karachi, delivered by experienced professionals. Choose a service to learn more.</p>
    <div class="ph-actions"><a href="{prefix}contact.html" class="btn-primary">Book Free Consultation</a></div>
  </div>
</header>
<section>
  <div class="section-inner">
    <div class="card-grid">
{cards}
    </div>
  </div>
</section>
{cta_band(prefix, "Not sure which service fits?", "Tell us what's going on and we'll guide you to the right support — free and confidential.")}
</main>
"""
    out += footer(prefix)
    return out


# ─────────────────────────── TEAM DATA ───────────────────────────
AV = {
 "shaista": '<svg viewBox="0 0 80 80"><rect width="80" height="80" fill="#c9f0f4"/><circle cx="40" cy="34" r="15" fill="#eaa17a"/><path d="M25 30c0-11 7-19 15-19s15 8 15 19c0 4-1 7-2 9 1-8-1-15-5-18-2 3-6 5-12 5-4 0-6-1-8-2-2 3-3 8-2 13-1-2-1-5-1-7Z" fill="#177585"/><path d="M14 76c3-15 13-23 26-23s23 8 26 23" fill="#0f7482"/><circle cx="35" cy="34" r="1.7" fill="#3c2a20"/><circle cx="45" cy="34" r="1.7" fill="#3c2a20"/><path d="M36 40c2.4 2.2 5.6 2.2 8 0" stroke="#7c4a32" stroke-width="1.8" fill="none" stroke-linecap="round"/></svg>',
 "ribqah": '<svg viewBox="0 0 80 80"><rect width="80" height="80" fill="#e6ddf7"/><circle cx="40" cy="34" r="15" fill="#f0b48e"/><path d="M24 36c-2-13 6-24 16-24s18 11 16 24c-2-9-7-14-16-14s-14 5-16 14Z" fill="#241a12"/><path d="M24 36c0 10 2 16 0 22l6-2c-2-6-2-13 0-20h-6ZM56 36c0 10-2 16 0 22l-6-2c2-6 2-13 0-20h6Z" fill="#241a12"/><path d="M14 76c3-15 13-23 26-23s23 8 26 23" fill="#7b5ea7"/><circle cx="35" cy="34" r="1.7" fill="#241a12"/><circle cx="45" cy="34" r="1.7" fill="#241a12"/><path d="M36 40c2.4 2.2 5.6 2.2 8 0" stroke="#8a5638" stroke-width="1.8" fill="none" stroke-linecap="round"/></svg>',
 "ejaz": '<svg viewBox="0 0 80 80"><rect width="80" height="80" fill="#fde3d1"/><circle cx="40" cy="34" r="15" fill="#eaa17a"/><path d="M26 30c1-10 6-17 14-17s13 7 14 17c0 3 0 6-1 8 0-7-2-13-6-16-3 3-7 4-11 4-3 0-5 0-7-1-2 3-3 7-2 12-1-2-1-4-1-7Z" fill="#5a3b28"/><path d="M14 76c3-15 13-23 26-23s23 8 26 23" fill="#e07b4a"/><circle cx="35" cy="34" r="1.7" fill="#3c2a20"/><circle cx="45" cy="34" r="1.7" fill="#3c2a20"/><path d="M36 40c2.4 2.2 5.6 2.2 8 0" stroke="#7c4a32" stroke-width="1.8" fill="none" stroke-linecap="round"/></svg>',
 "rimsha": '<svg viewBox="0 0 80 80"><rect width="80" height="80" fill="#d3e7f8"/><circle cx="40" cy="34" r="15" fill="#f0b48e"/><path d="M25 32c-1-12 6-21 15-21s16 9 15 21l-3 3c1-9-3-16-12-16s-13 7-12 16l-3-3Z" fill="#241a12"/><path d="M14 76c3-15 13-23 26-23s23 8 26 23" fill="#4a90d9"/><circle cx="35" cy="34" r="1.7" fill="#241a12"/><circle cx="45" cy="34" r="1.7" fill="#241a12"/><path d="M36 40c2.4 2.2 5.6 2.2 8 0" stroke="#8a5638" stroke-width="1.8" fill="none" stroke-linecap="round"/></svg>',
 "hareem": '<svg viewBox="0 0 80 80"><rect width="80" height="80" fill="#fbdae8"/><circle cx="40" cy="34" r="15" fill="#eaa17a"/><path d="M25 33c-2-12 5-22 15-22s17 10 15 22c-1-9-6-15-15-15s-14 6-15 15Z" fill="#3c2a20"/><path d="M14 76c3-15 13-23 26-23s23 8 26 23" fill="#d94a8a"/><circle cx="35" cy="34" r="1.7" fill="#3c2a20"/><circle cx="45" cy="34" r="1.7" fill="#3c2a20"/><path d="M36 40c2.4 2.2 5.6 2.2 8 0" stroke="#7c4a32" stroke-width="1.8" fill="none" stroke-linecap="round"/></svg>',
 "shafeeq": '<svg viewBox="0 0 80 80"><rect width="80" height="80" fill="#dff0d8"/><circle cx="40" cy="35" r="15" fill="#d9a06b"/><path d="M27 30c2-9 6-14 13-14s11 5 13 14c0 2 0 3-1 5 0-6-2-10-5-12-2 2-4 3-7 3s-5-1-7-3c-3 2-5 6-5 12 0-2-1-3-1-5Z" fill="#241a12"/><path d="M14 76c3-15 13-23 26-23s23 8 26 23" fill="#2d6a1f"/><circle cx="35" cy="35" r="1.7" fill="#241a12"/><circle cx="45" cy="35" r="1.7" fill="#241a12"/><path d="M36 41c2.4 2.2 5.6 2.2 8 0" stroke="#7a4a28" stroke-width="1.8" fill="none" stroke-linecap="round"/></svg>',
}

TEAM = [
    dict(slug="shaista-tariq", av="shaista", name="Shaista Tariq", role="Founder & Lead Psychotherapist",
         title="Shaista Tariq — Founder & Lead Psychotherapist (PPA Member) | MindCare Services®",
         desc="Shaista Tariq is the founder and lead psychotherapist of MindCare Services® in Karachi, and a personal Member of the Pakistan Psychological Association (PPA).",
         tags=["PPA Member", "Psychotherapist", "Mental Health Educator"],
         job="Psychotherapist",
         bio=["Shaista Tariq is a Psychotherapist, Mental Health Consultant &amp; Educator, and the founder of MindCare Services®. She is personally a verified Member of the Pakistan Psychological Association (PPA).",
              "She founded MindCare on a single belief: no one should have to struggle alone, or feel that what they're going through isn't \"serious enough\" to ask for help. Under her leadership, MindCare has grown into a multidisciplinary team offering holistic, evidence-based care across Karachi.",
              "Shaista works with adults and adolescents using approaches including Cognitive Behavioral Therapy (CBT), psychodynamic and motivational therapy, and also leads awareness sessions and trainings for workplaces, schools and institutions."],
         focus=["Anxiety, depression and stress", "Trauma and difficult life experiences", "Cognitive Behavioral Therapy (CBT)",
                "Family and relationship counseling", "Mental health education & awareness training"],
         knows=["Psychotherapy", "Cognitive Behavioral Therapy", "Mental Health", "Family Counseling", "Trauma Therapy", "Anxiety", "Depression"],
         member="PPA"),
    dict(slug="ribqah-arshad", av="ribqah", name="Ribqah Arshad", role="Team Coordinator",
         title="Ribqah Arshad — Team Coordinator | MindCare Services® Karachi",
         desc="Ribqah Arshad is the Team Coordinator at MindCare Services® in Karachi, managing operations and client relations so every client's experience is smooth and supportive.",
         tags=["Operations", "Client Relations"], job="Team Coordinator",
         bio=["Ribqah Arshad keeps MindCare running smoothly. As Team Coordinator, she oversees day-to-day operations and client relations — often the first friendly point of contact when you reach out.",
              "Her focus is making sure every client's experience, from the first enquiry to booking the right specialist, feels easy, warm and well-organized."],
         focus=["Client onboarding and support", "Appointment coordination", "Operations and scheduling", "Care continuity across the team"],
         knows=["Operations", "Client Relations", "Coordination"], member=None),
    dict(slug="ejaz-fatima", av="ejaz", name="Ejaz Fatima", role="Physiotherapist",
         title="Ejaz Fatima — Physiotherapist | MindCare Services® Karachi",
         desc="Ejaz Fatima is a physiotherapist at MindCare Services® in Karachi, specialising in rehabilitation and pain management to help clients move and recover.",
         tags=["Physiotherapy", "Rehabilitation", "Pain Management"], job="Physiotherapist",
         bio=["Ejaz Fatima is a physiotherapist focused on rehabilitation and pain management. She helps clients recover from injury, ease persistent pain and rebuild strength and mobility.",
              "Her hands-on, goal-driven approach combines manual therapy with tailored exercise so clients keep improving between sessions and learn to prevent problems returning."],
         focus=["Pain management", "Post-injury and post-surgery rehabilitation", "Musculoskeletal conditions", "Mobility and strength recovery"],
         knows=["Physiotherapy", "Rehabilitation", "Pain Management"], member=None,
         service="physiotherapy"),
    dict(slug="rimsha-pari", av="rimsha", name="Rimsha Pari", role="Consultant Physiotherapist",
         title="Rimsha Pari — Consultant Physiotherapist | MindCare Services® Karachi",
         desc="Rimsha Pari is a consultant physiotherapist at MindCare Services® in Karachi, specialising in musculoskeletal and neurological physiotherapy.",
         tags=["Consultant Physiotherapist", "Musculoskeletal", "Neuro-PT"], job="Consultant Physiotherapist",
         bio=["Rimsha Pari is a consultant physiotherapist with expertise in musculoskeletal and neurological physiotherapy (neuro-PT). She assesses the root cause of movement and pain problems and builds targeted recovery plans.",
              "She works closely with each client to restore function, reduce pain and improve quality of life through evidence-based, individualized treatment."],
         focus=["Musculoskeletal physiotherapy", "Neurological rehabilitation", "Posture and movement correction", "Chronic pain management"],
         knows=["Physiotherapy", "Musculoskeletal Therapy", "Neurological Rehabilitation"], member=None,
         service="physiotherapy"),
    dict(slug="hareem-tariq", av="hareem", name="Hareem Tariq", role="Dental Consultant",
         title="Hareem Tariq — Dental Consultant | MindCare Services® Karachi",
         desc="Hareem Tariq is the dental consultant at MindCare Services® in Karachi, offering preventive and restorative oral-health advice and treatment planning.",
         tags=["Dental Consultant", "Preventive Care", "Restorative Care"], job="Dental Consultant",
         bio=["Hareem Tariq is MindCare's dental consultant, focused on preventive and restorative care. She offers clear, unhurried guidance on oral health, treatment planning and second opinions.",
              "Her emphasis is on prevention and long-term oral health, helping clients understand their options and make confident decisions."],
         focus=["Oral health check-ups and advice", "Preventive care", "Restorative treatment planning", "Second opinions"],
         knows=["Dentistry", "Preventive Care", "Oral Health"], member=None,
         service="dental-consultations"),
    dict(slug="shafeeq-langhar", av="shafeeq", name="Shafeeq Langhar", role="Psychologist",
         title="Shafeeq Langhar — Clinical Psychologist | MindCare Services® Karachi",
         desc="Shafeeq Langhar is a clinical psychologist at MindCare Services® in Karachi, providing individual and group therapy grounded in clinical psychology.",
         tags=["Psychologist", "Clinical Psychology", "Individual & Group Therapy"], job="Psychologist",
         bio=["Shafeeq Langhar is a clinical psychologist providing individual and group therapy. He supports clients through a range of psychological concerns with an evidence-based, compassionate approach.",
              "He believes in meeting each person where they are, and tailors therapy — one-on-one or in groups — to each client's goals and comfort."],
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
    svc = m.get("service")
    svc_link = ""
    if svc:
        sname = SERVICE_BY_SLUG[svc]["name"]
        svc_link = f'<p style="margin-top:18px"><a href="{prefix}services/{svc}.html" class="more" style="font-weight:600">See {sname} →</a></p>'
    out = head(m["title"], m["desc"], url, prefix, schema, og_type="profile")
    out += nav(prefix)
    out += f"""<main id="main">
<header class="page-hero">
  <div class="ph-inner">
    <ol class="breadcrumb"><li><a href="{prefix}index.html">Home</a></li><li><a href="index.html">Team</a></li><li aria-current="page">{m['name']}</li></ol>
    <div class="profile-head">
      <div class="profile-avatar">{AV[m['av']]}</div>
      <div>
        <h1 style="margin-bottom:2px">{m['name']}</h1>
        <div class="role">{m['role']}</div>
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
        {svc_link}
      </div>
      <aside class="aside-card fade-up">
        <h3>Book with {m['name'].split()[0]}</h3>
        <p>Reach out for a free, confidential consultation. We'll help you find the right time and the right support.</p>
        <ul class="aside-list">
          <li>{icon(prefix,'i-clock')} Mon–Sat, 9am–7pm</li>
          <li>{icon(prefix,'i-phone')} {PHONE_H}</li>
          <li>{icon(prefix,'i-lock')} 100% confidential</li>
        </ul>
        <div class="aside-actions">
          <a href="{prefix}contact.html" class="btn-primary" style="justify-content:center">Book a Consultation</a>
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
        {"@type": "CollectionPage", "name": "Our Team — MindCare Services®", "url": url,
         "description": "Meet the multidisciplinary team of specialists at MindCare Services® in Karachi."},
        {"@type": "BreadcrumbList", "itemListElement": [
            {"@type": "ListItem", "position": 1, "name": "Home", "item": f"{BASE}/"},
            {"@type": "ListItem", "position": 2, "name": "Team", "item": url}]},
        {"@type": "ItemList", "itemListElement": [
            {"@type": "ListItem", "position": i + 1, "name": m["name"], "url": f"{BASE}/team/{m['slug']}"}
            for i, m in enumerate(TEAM)]}]}
    cards = "\n".join(
        f'''      <a class="link-card fade-up" href="{m['slug']}.html" style="text-align:center">
        <div class="profile-avatar" style="width:96px;height:96px;border-radius:50%;margin:0 auto 14px">{AV[m['av']]}</div>
        <h3>{m['name']}</h3><p style="color:var(--teal-dark);font-weight:600;margin-bottom:4px">{m['role']}</p>
        <span class="more">View profile →</span></a>''' for m in TEAM)
    out = head("Our Team | Psychotherapists & Specialists in Karachi — MindCare Services®",
               "Meet the MindCare Services® team in Karachi — psychotherapists, physiotherapists, a psychologist, dental consultant and coordinators led by founder Shaista Tariq (PPA Member).",
               url, prefix, schema)
    out += nav(prefix)
    out += f"""<main id="main">
<header class="page-hero">
  <div class="ph-inner">
    <ol class="breadcrumb"><li><a href="{prefix}index.html">Home</a></li><li aria-current="page">Team</li></ol>
    <div class="ph-badge">{icon(prefix,'i-family')} A multidisciplinary team</div>
    <h1>Meet the people behind <em>your care</em></h1>
    <p class="lede">A dedicated group of specialists united by one mission: compassionate, professional, impactful care. Get to know each of them.</p>
    <div class="ph-actions"><a href="{prefix}contact.html" class="btn-primary">Book Free Consultation</a></div>
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


def write(path, content):
    full = os.path.join(ROOT, path)
    os.makedirs(os.path.dirname(full), exist_ok=True)
    with open(full, "w", encoding="utf-8") as f:
        f.write(content)
    print("wrote", path)


def build():
    for s in SERVICES:
        write(f"services/{s['slug']}.html", service_page(s))
    write("services/index.html", services_index())
    for m in TEAM:
        write(f"team/{m['slug']}.html", team_page(m))
    write("team/index.html", team_index())
    # sitemap
    urls = [(f"{BASE}/", "1.0"), (f"{BASE}/contact", "0.8"),
            (f"{BASE}/services/", "0.9"), (f"{BASE}/team/", "0.7")]
    urls += [(f"{BASE}/services/{s['slug']}", "0.8") for s in SERVICES]
    urls += [(f"{BASE}/team/{m['slug']}", "0.6") for m in TEAM]
    body = "\n".join(
        f"  <url><loc>{u}</loc><lastmod>{TODAY}</lastmod><changefreq>monthly</changefreq><priority>{p}</priority></url>"
        for u, p in urls)
    sitemap = ('<?xml version="1.0" encoding="UTF-8"?>\n'
               '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n'
               f"{body}\n</urlset>\n")
    write("sitemap.xml", sitemap)
    print(f"\nDone: {len(SERVICES)} services + {len(TEAM)} team + 2 index + sitemap")


if __name__ == "__main__":
    build()
