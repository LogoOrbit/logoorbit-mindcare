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
  // swap meditation audio to match the chosen language, keeping playback state
  var medi=document.getElementById("medi");
  if(medi){
    var src=medi.getAttribute(lang==="ur"?"data-src-ur":"data-src-en");
    if(src && medi.getAttribute("src")!==src){
      var wasPlaying=!medi.paused, vol=medi.volume;
      medi.setAttribute("src",src);
      medi.load();
      medi.volume=vol;
      if(wasPlaying) medi.play().catch(function(){});
    }
  }
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
  window.__mcMuted=!enabled;
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
    if(!enabled || hidden || window.__mcVideoPlaying){ el.volume=0; if(!el.paused) el.pause(); return (hidden||window.__mcVideoPlaying)?ref:0; }
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
  // page video takes priority: fade ambient audio out while it plays, back in when it stops
  document.addEventListener("mc-video",schedule);
  schedule();
  if(btn) btn.addEventListener("click",function(e){
    e.stopPropagation();
    enabled=!enabled;
    window.__mcMuted=!enabled;
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
    ov.innerHTML='<button type="button" class="ag-btn" aria-label="Enter"><span class="ag-ring"></span><span class="ag-ring ag-ring2"></span><span class="ag-lbl">ENTER</span></button>';
    var s=document.createElement("style");
    s.textContent='#audio-gate{position:fixed;top:0;left:0;width:100vw;height:100vh;z-index:2147483000;'
      +'display:flex;align-items:center;justify-content:center;'
      +'background:rgba(5,12,10,.86);backdrop-filter:blur(8px);-webkit-backdrop-filter:blur(8px);'
      +'transition:opacity .7s ease;opacity:1;will-change:opacity}'
      +'#audio-gate.hide{opacity:0;pointer-events:none}'
      +'#audio-gate .ag-btn{position:relative;width:180px;height:180px;border-radius:50%;cursor:pointer;'
      +'background:radial-gradient(circle at 50% 42%,rgba(90,255,206,.5),rgba(20,70,52,.85) 68%);'
      +'border:2px solid rgba(120,255,214,.85);color:#f2fffb;font:700 1.4rem/1 inherit;letter-spacing:.24em;'
      +'display:flex;align-items:center;justify-content:center;isolation:isolate;text-shadow:0 0 18px rgba(90,255,206,.7);'
      +'box-shadow:0 0 70px rgba(47,230,166,.55),inset 0 0 45px rgba(47,230,166,.3);'
      +'transition:transform .35s cubic-bezier(.2,.9,.25,1),box-shadow .35s ease;'
      +'will-change:transform;animation:agFloat 3.6s ease-in-out infinite}'
      +'#audio-gate .ag-btn:hover{transform:scale(1.09);box-shadow:0 0 110px rgba(47,230,166,.8),inset 0 0 60px rgba(47,230,166,.45)}'
      +'#audio-gate .ag-btn:active{transform:scale(.94)}'
      +'#audio-gate .ag-lbl{position:relative;z-index:2;padding-left:.24em}'
      +'#audio-gate .ag-ring{position:absolute;inset:0;border-radius:50%;border:2px solid rgba(120,255,214,.7);'
      +'transform:scale(1);opacity:.9;pointer-events:none;animation:agp 2.6s ease-out infinite;will-change:transform,opacity}'
      +'#audio-gate .ag-ring2{animation-delay:1.3s}'
      +'@keyframes agp{0%{transform:scale(.92);opacity:.9}100%{transform:scale(1.95);opacity:0}}'
      +'@keyframes agFloat{0%,100%{transform:translateY(-6px)}50%{transform:translateY(6px)}}'
      +'@media(prefers-reduced-motion:reduce){#audio-gate .ag-btn{animation:none}#audio-gate .ag-ring{animation:none;opacity:0}}';
    function gate(){
      enabled=true; started=false; start(); schedule(); setBtn();
      ov.classList.add("hide"); setTimeout(function(){ if(ov.parentNode) ov.parentNode.removeChild(ov); },800);
    }
    function mount(){
      document.head.appendChild(s);
      // append to <html>, not <body>: body has a running animation that would make
      // position:fixed resolve against the whole page instead of the viewport
      document.documentElement.appendChild(ov);
      ov.querySelector(".ag-btn").addEventListener("click",gate);
    }
    if(document.readyState==="loading") document.addEventListener("DOMContentLoaded",mount);
    else mount();
  }
})();

/* ---------- subtle UI sound effects (synthesized, no assets) ---------- */
(function(){
  var AC=window.AudioContext||window.webkitAudioContext; if(!AC) return;
  var ctx, master, noiseBuf;
  function ensure(){
    if(window.__mcMuted) return null;
    if(!ctx){
      ctx=new AC(); master=ctx.createGain(); master.gain.value=0.5; master.connect(ctx.destination);
      var len=ctx.sampleRate*1; noiseBuf=ctx.createBuffer(1,len,ctx.sampleRate);
      var d=noiseBuf.getChannelData(0); for(var i=0;i<len;i++) d[i]=Math.random()*2-1;
    }
    if(ctx.state==="suspended") ctx.resume();
    return ctx.state==="running"?ctx:null;
  }
  ["pointerdown","keydown","touchstart"].forEach(function(ev){
    window.addEventListener(ev,function(){ if(!window.__mcMuted && ctx && ctx.state==="suspended") ctx.resume(); },{passive:true});
  });

  function blip(){
    var c=ensure(); if(!c) return; var t=c.currentTime;
    var o=c.createOscillator(), g=c.createGain();
    o.type="sine"; o.frequency.setValueAtTime(500,t); o.frequency.exponentialRampToValueAtTime(760,t+0.06);
    g.gain.setValueAtTime(0.0001,t); g.gain.exponentialRampToValueAtTime(0.045,t+0.012);
    g.gain.exponentialRampToValueAtTime(0.0001,t+0.15);
    o.connect(g); g.connect(master); o.start(t); o.stop(t+0.17);
  }
  function whoosh(amt){
    var c=ensure(); if(!c) return; var t=c.currentTime;
    var src=c.createBufferSource(); src.buffer=noiseBuf;
    var bp=c.createBiquadFilter(); bp.type="bandpass"; bp.Q.value=0.8;
    bp.frequency.setValueAtTime(280,t); bp.frequency.exponentialRampToValueAtTime(1500,t+0.25);
    var g=c.createGain(); var v=Math.min(0.16,0.03+amt*0.16);
    g.gain.setValueAtTime(0.0001,t); g.gain.exponentialRampToValueAtTime(v,t+0.05);
    g.gain.exponentialRampToValueAtTime(0.0001,t+0.4);
    src.connect(bp); bp.connect(g); g.connect(master); src.start(t); src.stop(t+0.45);
  }

  // hover blips on interactive cards / buttons
  var HOVER=".btn,.nav-cta,.icon-btn,a.card,a.person,.faq-q";
  var cur=null;
  document.addEventListener("pointerover",function(e){
    if(e.pointerType==="touch") return;
    var el=e.target.closest&&e.target.closest(HOVER);
    if(el && el!==cur){ cur=el; blip(); }
    else if(!el) cur=null;
  },{passive:true});

  // whoosh while dragging the hero brain
  var brain=document.getElementById("brain");
  if(brain){
    var down=false,lx=0,ly=0,lastW=0;
    function s(x,y){ down=true; lx=x; ly=y; }
    function m(x,y){
      if(!down) return; var dx=x-lx,dy=y-ly; lx=x; ly=y;
      var sp=Math.sqrt(dx*dx+dy*dy), now=performance.now();
      if(sp>7 && now-lastW>170){ lastW=now; whoosh(Math.min(1,sp/55)); }
    }
    brain.addEventListener("pointerdown",function(e){ s(e.clientX,e.clientY); },{passive:true});
    window.addEventListener("pointermove",function(e){ m(e.clientX,e.clientY); },{passive:true});
    window.addEventListener("pointerup",function(){ down=false; },{passive:true});
    brain.addEventListener("touchstart",function(e){ if(e.touches[0]) s(e.touches[0].clientX,e.touches[0].clientY); },{passive:true});
    brain.addEventListener("touchmove",function(e){ if(e.touches[0]) m(e.touches[0].clientX,e.touches[0].clientY); },{passive:true});
    window.addEventListener("touchend",function(){ down=false; },{passive:true});
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
