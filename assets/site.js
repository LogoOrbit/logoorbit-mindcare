/* MindCare Services — shared interactions: theme, language, menu, faq, reveal */
(function(){
"use strict";
var doc=document.documentElement;
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
  var m=document.querySelector('meta[name="theme-color"]'); if(m) m.content=(t==="dark"?"#0e1b13":"#e8ecf1"); }
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

/* ---------- scroll progress + reveal ---------- */
var prog=document.getElementById("progress");
window.addEventListener("scroll",function(){
  if(!prog) return;
  var h=document.documentElement, s=h.scrollTop/(h.scrollHeight-h.clientHeight||1);
  prog.style.width=Math.min(s*100,100)+"%";
},{passive:true});

if("IntersectionObserver" in window){
  var io=new IntersectionObserver(function(es){
    es.forEach(function(e){ if(e.isIntersecting){ e.target.classList.add("vis"); io.unobserve(e.target); } });
  },{threshold:.12});
  document.querySelectorAll(".fade-up").forEach(function(el){io.observe(el);});
}else{
  document.querySelectorAll(".fade-up").forEach(function(el){el.classList.add("vis");});
}
})();
