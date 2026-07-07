/* MindCare Services — shared interactions: theme, language, menu, faq, reveal */
(function(){
"use strict";
var doc=document.documentElement;
var reduce=matchMedia("(prefers-reduced-motion: reduce)").matches;
var DICT=window.I18N||{en:{},ur:{}};

/* ---------- language ---------- */
var i18nEls=[].slice.call(document.querySelectorAll("[data-i18n],[data-i18n-html]"));
// capture original English once
i18nEls.forEach(function(el){
  var html=el.hasAttribute("data-i18n-html");
  var key=el.getAttribute(html?"data-i18n-html":"data-i18n");
  if(!DICT.en[key]) DICT.en[key]=html?el.innerHTML:el.textContent;
});
function applyLang(lang){
  var map=DICT[lang]||{};
  i18nEls.forEach(function(el){
    var html=el.hasAttribute("data-i18n-html");
    var key=el.getAttribute(html?"data-i18n-html":"data-i18n");
    var val=map[key]||DICT.en[key];
    if(val==null) return;
    if(html) el.innerHTML=val; else el.textContent=val;
  });
  doc.setAttribute("lang",lang);
  doc.setAttribute("dir",lang==="ur"?"rtl":"ltr");
  var lb=document.getElementById("langBtn");
  if(lb) lb.textContent = lang==="ur" ? "EN" : "اردو";
  try{localStorage.setItem("mc-lang",lang);}catch(e){}
}
var startLang=doc.getAttribute("lang")||"en";
applyLang(startLang);
var langBtn=document.getElementById("langBtn");
if(langBtn) langBtn.addEventListener("click",function(){
  applyLang((doc.getAttribute("lang")==="ur")?"en":"ur");
});

/* ---------- theme ---------- */
function setTheme(t){ doc.setAttribute("data-theme",t); try{localStorage.setItem("mc-theme",t);}catch(e){}
  var m=document.querySelector('meta[name="theme-color"]'); if(m) m.content=(t==="dark"?"#0e1b13":"#faf8f3"); }
var themeBtn=document.getElementById("themeBtn");
if(themeBtn) themeBtn.addEventListener("click",function(){
  setTheme(doc.getAttribute("data-theme")==="dark"?"light":"dark");
});

/* ---------- mobile menu ---------- */
var menu=document.getElementById("mobileMenu");
var burger=document.getElementById("hamburger");
function closeMenu(){ if(menu){menu.classList.remove("open");document.body.style.overflow="";} }
if(burger&&menu) burger.addEventListener("click",function(){
  var open=menu.classList.toggle("open");
  document.body.style.overflow=open?"hidden":"";
});
document.querySelectorAll(".mobile-menu a").forEach(function(a){a.addEventListener("click",closeMenu);});

/* ---------- faq ---------- */
document.querySelectorAll(".faq-item").forEach(function(item){
  var q=item.querySelector(".faq-q"), a=item.querySelector(".faq-a");
  if(!q||!a) return;
  q.addEventListener("click",function(){
    var open=item.classList.toggle("open");
    q.setAttribute("aria-expanded",open);
    a.style.maxHeight=open?a.scrollHeight+"px":null;
  });
});

/* ---------- scroll animations: reveal + parallax ---------- */
var prog=document.getElementById("progress");

// auto-tag hero copy, section heads and CTA for reveal
if(!reduce){
  var extra=document.querySelectorAll(".hero-copy > *, .sec-head > *, .about-wrap > *");
  extra.forEach(function(el){ el.classList.add("fade-up"); });
  // directional variety
  document.querySelectorAll(".hero-copy > *").forEach(function(el){ el.classList.add("rv-left"); });
  document.querySelectorAll(".brain-wrap").forEach(function(el){ el.classList.add("fade-up","rv-right"); });
  // stagger cards within each grid
  document.querySelectorAll(".grid-3, .team-grid, .feel-grid, .steps").forEach(function(g){
    [].slice.call(g.children).forEach(function(c,i){ c.style.setProperty("--d",(i%3)*90+"ms"); });
  });
}

var revealEls=[].slice.call(document.querySelectorAll(".fade-up"));
if("IntersectionObserver" in window && !reduce){
  var io=new IntersectionObserver(function(es){
    es.forEach(function(e){ if(e.isIntersecting){ e.target.classList.add("vis"); io.unobserve(e.target); } });
  },{threshold:.14,rootMargin:"0px 0px -6% 0px"});
  revealEls.forEach(function(el){io.observe(el);});
}else{
  revealEls.forEach(function(el){el.classList.add("vis");});
}

/* ---------- audio: hero background music crossfades to the orb meditation,
   then everything fades out below the orb section. Never both at full. ---------- */
(function(){
  var bgm=document.getElementById("bgm"); if(!bgm) return;
  var medi=document.getElementById("medi");
  var orb=document.getElementById("orb-scene");
  var btn=document.getElementById("bgmBtn");
  var BGM_MAX=0.4, MEDI_MAX=0.5, started=false, enabled=true, hidden=false;
  // smoothed volumes to avoid any harsh jump / perceived stutter
  var bgmV=0, mediV=0;
  try{ if(localStorage.getItem("mc-bgm")==="off") enabled=false; }catch(e){}
  function clamp(x){ return x<0?0:(x>1?1:x); }

  function targets(){
    var vh=window.innerHeight||1;
    if(!orb){ // no orb on page: classic hero fade-on-scroll
      return { bgm: clamp(1-window.scrollY/750), medi: 0 };
    }
    var r=orb.getBoundingClientRect();
    var enter=clamp((vh-r.top)/vh);      // 0 = orb below viewport, 1 = orb reached top
    var exit=clamp(r.bottom/vh);          // 1 = orb still on screen, 0 = scrolled past
    // bgm dominates the hero, gone well before meditation rises (no clash)
    var bt=clamp(1-enter*2.2);
    // meditation only inside the orb zone, faded out once scrolled past
    var mt=Math.min(clamp((enter-0.4)/0.6), exit);
    return { bgm: bt, medi: mt };
  }

  function apply(el, target, max, ref){
    if(!el) return ref;
    if(!enabled || hidden){ el.volume=0; if(!el.paused) el.pause(); return hidden?ref:0; }
    ref += (target-ref)*0.12;             // heavy smoothing
    var v=max*ref;
    el.volume=clamp(v);
    if(v<0.004){ if(!el.paused) el.pause(); }
    else if(started && el.paused){ el.play().catch(function(){}); }
    return ref;
  }

  var raf=false;
  function tick(){
    raf=false;
    var t=targets();
    bgmV=apply(bgm, t.bgm, BGM_MAX, bgmV);
    mediV=apply(medi, t.medi, MEDI_MAX, mediV);
    // keep smoothing until both settle
    if(Math.abs(bgmV-t.bgm)>0.002 || Math.abs(mediV-t.medi)>0.002) schedule();
  }
  function schedule(){ if(!raf){ raf=true; requestAnimationFrame(tick); } }

  function start(){
    if(started||!enabled) return;
    started=true;
    // prime both elements within the user gesture so playback is allowed
    [bgm,medi].forEach(function(el){ if(el){ el.volume=0; var p=el.play(); if(p&&p.then) p.catch(function(){}); } });
    schedule();
  }
  function setBtn(){ if(btn){ btn.setAttribute("aria-pressed",String(enabled)); btn.classList.toggle("muted",!enabled); } }
  setBtn();
  start();
  ["pointerdown","keydown","touchstart"].forEach(function(ev){
    window.addEventListener(ev,function(){ start(); schedule(); },{passive:true});
  });
  window.addEventListener("scroll",function(){ if(!started) start(); schedule(); },{passive:true});
  window.addEventListener("resize",schedule,{passive:true});
  schedule();
  if(btn) btn.addEventListener("click",function(e){
    e.stopPropagation();
    enabled=!enabled;
    try{ localStorage.setItem("mc-bgm",enabled?"on":"off"); }catch(err){}
    if(enabled){ started=false; start(); } else { [bgm,medi].forEach(function(el){ if(el){ el.pause(); el.volume=0; } }); bgmV=mediV=0; }
    setBtn();
  });

  // stop audio when the tab is hidden / browser minimized; resume on return
  document.addEventListener("visibilitychange",function(){
    hidden=document.hidden;
    if(hidden){ [bgm,medi].forEach(function(el){ if(el && !el.paused) el.pause(); }); }
    else schedule();
  });
  window.addEventListener("pagehide",function(){ [bgm,medi].forEach(function(el){ if(el && !el.paused) el.pause(); }); });

  // first-visit prompt so audio can start (browsers block autoplay until a gesture)
  if(enabled){
    var ov=document.createElement("div");
    ov.id="audio-gate";
    ov.innerHTML='<button type="button" aria-label="Enter with sound"><span class="ag-ring"></span><span class="ag-txt">Tap to enter<br><small>with sound on</small></span></button>';
    var s=document.createElement("style");
    s.textContent='#audio-gate{position:fixed;inset:0;z-index:2000;display:flex;align-items:center;justify-content:center;'
      +'background:rgba(6,14,11,.72);backdrop-filter:blur(6px);-webkit-backdrop-filter:blur(6px);transition:opacity .6s ease;opacity:1}'
      +'#audio-gate.hide{opacity:0;pointer-events:none}'
      +'#audio-gate button{position:relative;background:none;border:0;cursor:pointer;color:#eafff6;font:inherit;text-align:center;padding:34px}'
      +'#audio-gate .ag-txt{position:relative;font-weight:600;font-size:1.05rem;line-height:1.5;letter-spacing:.02em}'
      +'#audio-gate .ag-txt small{font-weight:400;font-size:.8rem;opacity:.75}'
      +'#audio-gate .ag-ring{position:absolute;inset:50% auto auto 50%;width:150px;height:150px;transform:translate(-50%,-50%);'
      +'border-radius:50%;border:1px solid rgba(47,230,166,.5);box-shadow:0 0 40px rgba(47,230,166,.35),inset 0 0 40px rgba(47,230,166,.2);'
      +'animation:agp 2.4s ease-out infinite}'
      +'@keyframes agp{0%{transform:translate(-50%,-50%) scale(.85);opacity:.9}100%{transform:translate(-50%,-50%) scale(1.35);opacity:0}}';
    function gate(){
      enabled=true; started=false; start(); schedule(); setBtn();
      ov.classList.add("hide"); setTimeout(function(){ if(ov.parentNode) ov.parentNode.removeChild(ov); },700);
      document.removeEventListener("pointerdown",gate);
    }
    document.addEventListener("DOMContentLoaded",function(){
      document.head.appendChild(s); document.body.appendChild(ov);
      ov.addEventListener("click",gate);
    });
    // any first interaction anywhere also satisfies it
    document.addEventListener("pointerdown",gate,{once:true});
  }
})();

// parallax on scroll (hero glow + brain drift)
var hero=document.querySelector(".hero");
var pEls=[].slice.call(document.querySelectorAll("[data-parallax]"));
var ticking=false;
window.addEventListener("scroll",function(){
  var h=document.documentElement, s=h.scrollTop/(h.scrollHeight-h.clientHeight||1);
  if(prog) prog.style.width=Math.min(s*100,100)+"%";
  if(reduce||ticking) return;
  ticking=true;
  requestAnimationFrame(function(){
    var y=window.scrollY;
    if(hero) hero.style.setProperty("--py",(y*0.3).toFixed(1)+"px");
    pEls.forEach(function(el){
      var r=el.getBoundingClientRect();
      var off=(r.top+r.height/2)-window.innerHeight/2;
      el.style.transform="translateY("+(off*parseFloat(el.getAttribute("data-parallax")||"-0.05")).toFixed(1)+"px)";
    });
    ticking=false;
  });
},{passive:true});

/* ---------- smooth page transitions between internal pages ---------- */
if(!reduce){
  document.addEventListener("click",function(e){
    var a=e.target.closest&&e.target.closest("a");
    if(!a||e.defaultPrevented||e.button!==0||e.metaKey||e.ctrlKey||e.shiftKey||e.altKey) return;
    var href=a.getAttribute("href");
    if(!href||a.target==="_blank"||a.hasAttribute("download")) return;
    if(href.charAt(0)==="#"||/^(mailto:|tel:|javascript:)/i.test(href)) return;
    if(a.host&&a.host!==location.host) return;
    if(a.pathname===location.pathname&&a.hash) return;
    if(a.pathname===location.pathname&&a.search===location.search){e.preventDefault();return;}
    e.preventDefault();
    document.body.classList.add("page-exit");
    setTimeout(function(){ window.location.href=a.href; },180);
  });
  window.addEventListener("pageshow",function(ev){ if(ev.persisted) document.body.classList.remove("page-exit"); });
}
})();
