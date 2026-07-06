/* MindCare Services — interactions */
(function(){
"use strict";
var reduce=matchMedia("(prefers-reduced-motion: reduce)").matches;

/* ---- intro (first open per session, home only) ---- */
var intro=document.getElementById("intro");
if(intro){
  if(sessionStorage.getItem("mc-intro")){intro.remove();}
  else{
    sessionStorage.setItem("mc-intro","1");
    document.documentElement.classList.add("menu-open"); // lock scroll
    setTimeout(function(){
      intro.classList.add("done");
      document.documentElement.classList.remove("menu-open");
      setTimeout(function(){intro.remove();},800);
    },reduce?150:2100);
  }
}

/* ---- click sound ---- */
var actx=null;
function tick(){
  try{
    actx=actx||new (window.AudioContext||window.webkitAudioContext)();
    if(actx.state==="suspended")actx.resume();
    var t=actx.currentTime,o=actx.createOscillator(),g=actx.createGain();
    o.type="sine";o.frequency.setValueAtTime(1900,t);o.frequency.exponentialRampToValueAtTime(700,t+.05);
    g.gain.setValueAtTime(.12,t);g.gain.exponentialRampToValueAtTime(.0001,t+.09);
    o.connect(g).connect(actx.destination);o.start(t);o.stop(t+.1);
  }catch(e){}
}
addEventListener("pointerdown",function(e){
  if(e.target.closest("a,button"))tick();
},{passive:true});

/* ---- nav ---- */
var nav=document.querySelector(".nav");
var burger=document.querySelector(".burger");
if(burger)burger.addEventListener("click",function(){
  document.documentElement.classList.toggle("menu-open");
});
document.querySelectorAll(".sheet a").forEach(function(a){
  a.addEventListener("click",function(){document.documentElement.classList.remove("menu-open");});
});

/* ---- scroll: progress bar, nav state, parallax ---- */
var prog=document.getElementById("progress");
var pll=[].slice.call(document.querySelectorAll("[data-parallax]"));
var ticking=false;
function onScroll(){
  if(ticking)return;ticking=true;
  requestAnimationFrame(function(){
    var y=scrollY,max=document.documentElement.scrollHeight-innerHeight;
    if(prog)prog.style.width=(max>0?y/max*100:0)+"%";
    if(nav)nav.classList.toggle("scrolled",y>40);
    if(!reduce)pll.forEach(function(el){
      el.style.transform="translateY("+(y*parseFloat(el.dataset.parallax||"-0.1")).toFixed(1)+"px)";
    });
    ticking=false;
  });
}
addEventListener("scroll",onScroll,{passive:true});onScroll();

/* ---- reveal on scroll ---- */
var io=new IntersectionObserver(function(es){
  es.forEach(function(e){if(e.isIntersecting){e.target.classList.add("in-view");io.unobserve(e.target);}});
},{threshold:.14,rootMargin:"0px 0px -6% 0px"});
document.querySelectorAll("[data-reveal]").forEach(function(el,i){
  el.style.transitionDelay=(el.dataset.delay||(i%4)*70)+"ms";
  io.observe(el);
});

/* ---- counters ---- */
var cio=new IntersectionObserver(function(es){
  es.forEach(function(e){
    if(!e.isIntersecting)return;cio.unobserve(e.target);
    var el=e.target,end=parseFloat(el.dataset.count),suf=el.dataset.suffix||"",t0=null;
    function run(t){
      if(!t0)t0=t;var p=Math.min((t-t0)/1400,1);p=1-Math.pow(1-p,3);
      el.textContent=Math.round(end*p)+suf;
      if(p<1)requestAnimationFrame(run);
    }
    reduce?el.textContent=end+suf:requestAnimationFrame(run);
  });
},{threshold:.6});
document.querySelectorAll("[data-count]").forEach(function(el){cio.observe(el);});

/* ---- tilt cards ---- */
if(matchMedia("(hover:hover)").matches&&!reduce){
  document.querySelectorAll(".tilt").forEach(function(card){
    card.addEventListener("pointermove",function(e){
      var r=card.getBoundingClientRect(),x=(e.clientX-r.left)/r.width,y=(e.clientY-r.top)/r.height;
      card.style.transform="perspective(800px) rotateX("+((.5-y)*7).toFixed(2)+"deg) rotateY("+((x-.5)*7).toFixed(2)+"deg) translateY(-4px)";
      card.style.setProperty("--gx",x*100+"%");card.style.setProperty("--gy",y*100+"%");
    });
    card.addEventListener("pointerleave",function(){card.style.transform="";});
  });
}

/* ---- 3D particle brain ---- */
var cv=document.getElementById("brain");
if(cv&&!reduce){
  var ctx=cv.getContext("2d"),DPR=Math.min(devicePixelRatio||1,2);
  var W,H,pts=[],links=[];
  var rotY=0,rotX=-.15,velY=.004,dragging=false,px=0,py=0,lastScroll=scrollY;

  // brain-ish point cloud: two wrinkled hemispheres + stem
  var N=innerWidth<700?420:640;
  for(var i=0;i<N;i++){
    var u=Math.random()*Math.PI*2,v=Math.acos(2*Math.random()-1);
    var x=Math.sin(v)*Math.cos(u),y=Math.sin(v)*Math.sin(u),z=Math.cos(v);
    var wr=1+.09*Math.sin(7*u+3*v)*Math.sin(5*v); // cortical wrinkles
    x*=1.25*wr;y*=.92*wr;z*=1.02*wr;
    x+=(x>0?.13:-.13); // hemisphere split
    y+=.18*x*x-.12;    // brain profile
    pts.push({x:x,y:y,z:z,h:x>0?1:0,o:.35+Math.random()*.65});
  }
  // stem
  for(i=0;i<26;i++){
    var s=i/26;
    pts.push({x:.1+(Math.random()-.5)*.22,y:.85+s*.55,z:-.25+(Math.random()-.5)*.22,h:2,o:.5});
  }
  // precompute nearby links
  for(i=0;i<pts.length;i++)for(var j=i+1;j<pts.length;j++){
    var dx=pts[i].x-pts[j].x,dy=pts[i].y-pts[j].y,dz=pts[i].z-pts[j].z;
    if(dx*dx+dy*dy+dz*dz<.055&&links.length<1500)links.push([i,j]);
  }

  function size(){
    var r=cv.parentElement.getBoundingClientRect();
    W=r.width;H=r.height;cv.width=W*DPR;cv.height=H*DPR;ctx.setTransform(DPR,0,0,DPR,0,0);
  }
  size();addEventListener("resize",size);

  cv.addEventListener("pointerdown",function(e){dragging=true;px=e.clientX;py=e.clientY;cv.setPointerCapture(e.pointerId);});
  cv.addEventListener("pointermove",function(e){
    if(!dragging)return;
    rotY+=(e.clientX-px)*.008;rotX+=(e.clientY-py)*.005;
    rotX=Math.max(-1.1,Math.min(1.1,rotX));px=e.clientX;py=e.clientY;
  });
  cv.addEventListener("pointerup",function(){dragging=false;});
  cv.addEventListener("pointercancel",function(){dragging=false;});

  var pr=[],t=0;
  function frame(){
    // scroll adds spin
    var dy=scrollY-lastScroll;lastScroll=scrollY;
    velY+=dy*.00002;velY=Math.max(.002,Math.min(.02,Math.abs(velY)))*(velY<0?-1:1);
    if(!dragging)rotY+=velY;
    velY*=.98;if(Math.abs(velY)<.004)velY=.004*(velY<0?-1:1);
    t+=.016;
    var pulse=1+.025*Math.sin(t*1.6);
    var cy=Math.cos(rotY),sy=Math.sin(rotY),cx=Math.cos(rotX),sx=Math.sin(rotX);
    var scale=Math.min(W,H)*.30*pulse,ox=W/2,oy=H/2;
    ctx.clearRect(0,0,W,H);
    for(var i=0;i<pts.length;i++){
      var p=pts[i];
      var x1=p.x*cy+p.z*sy,z1=-p.x*sy+p.z*cy;
      var y1=p.y*cx-z1*sx,z2=p.y*sx+z1*cx;
      var d=1/(1+z2*.32);
      pr[i]={x:ox+x1*scale*d,y:oy+y1*scale*d,d:d,z:z2,h:p.h,o:p.o};
    }
    ctx.lineWidth=1;
    for(i=0;i<links.length;i++){
      var a=pr[links[i][0]],b=pr[links[i][1]];
      var al=.16*((a.d+b.d)/2-.6);if(al<=.01)continue;
      ctx.strokeStyle="rgba(125,211,252,"+Math.min(al,.35).toFixed(3)+")";
      ctx.beginPath();ctx.moveTo(a.x,a.y);ctx.lineTo(b.x,b.y);ctx.stroke();
    }
    for(i=0;i<pr.length;i++){
      var q=pr[i];
      var r2=Math.max(.4,2.3*q.d-1);
      ctx.fillStyle=q.h===1?"rgba(94,234,212,"+(q.o*q.d*.9).toFixed(3)+")"
                   :q.h===0?"rgba(167,139,250,"+(q.o*q.d*.9).toFixed(3)+")"
                   :"rgba(249,168,212,"+(q.o*q.d*.8).toFixed(3)+")";
      ctx.beginPath();ctx.arc(q.x,q.y,r2,0,6.284);ctx.fill();
    }
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
}
})();
