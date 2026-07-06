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
  var m=document.querySelector('meta[name="theme-color"]'); if(m) m.content=(t==="dark"?"#0e1b13":"#e9ebe6"); }
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

/* ---------- background music: play on landing, fade out on scroll ---------- */
(function(){
  var audio=document.getElementById("bgm"); if(!audio) return;
  var btn=document.getElementById("bgmBtn");
  var MAX=0.4, FADE=750, started=false, enabled=true;
  try{ if(localStorage.getItem("mc-bgm")==="off") enabled=false; }catch(e){}
  function targetVol(){ return MAX*Math.max(0,Math.min(1,1-window.scrollY/FADE)); }
  function refresh(){
    if(!enabled){ audio.volume=0; return; }
    var v=targetVol(); audio.volume=v;
    if(v<0.002){ if(!audio.paused) audio.pause(); }
    else if(started && audio.paused){ audio.play().catch(function(){}); }
  }
  function start(){
    if(started||!enabled) return;
    audio.volume=targetVol();
    var p=audio.play();
    if(p&&p.then) p.then(function(){started=true;}).catch(function(){});
    else started=true;
  }
  function setBtn(){ if(btn){ btn.setAttribute("aria-pressed",String(enabled)); btn.classList.toggle("muted",!enabled); } }
  setBtn();
  // try immediate autoplay; fall back to the first user gesture
  start();
  ["pointerdown","keydown","touchstart"].forEach(function(ev){
    window.addEventListener(ev,function(){ start(); },{passive:true});
  });
  window.addEventListener("scroll",function(){ if(!started) start(); refresh(); },{passive:true});
  refresh();
  if(btn) btn.addEventListener("click",function(e){
    e.stopPropagation();
    enabled=!enabled;
    try{ localStorage.setItem("mc-bgm",enabled?"on":"off"); }catch(err){}
    if(enabled){ started=false; start(); refresh(); } else { audio.pause(); audio.volume=0; }
    setBtn();
  });
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
    e.preventDefault();
    document.body.classList.add("page-exit");
    setTimeout(function(){ window.location.href=a.href; },260);
  });
  window.addEventListener("pageshow",function(ev){ if(ev.persisted) document.body.classList.remove("page-exit"); });
}
})();
