/* MindCare Services®: interactive 3D psychology brain (hero) */
(function(){
"use strict";
var reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
var cv = document.getElementById("brain");
if(!cv) return;
var ctx = cv.getContext("2d");
var DPR = Math.min(window.devicePixelRatio||1, 2);
var W, H, pts=[], links=[];
var rotY=0, rotX=-0.12, velY=0.004, dragging=false, px=0, py=0, lastScroll=window.scrollY, t=0;

// point cloud shaped like two wrinkled hemispheres + brain-stem
var N = window.innerWidth < 700 ? 380 : 560;
for(var i=0;i<N;i++){
  var u=Math.random()*Math.PI*2, v=Math.acos(2*Math.random()-1);
  var x=Math.sin(v)*Math.cos(u), y=Math.sin(v)*Math.sin(u), z=Math.cos(v);
  var wr=1+0.09*Math.sin(7*u+3*v)*Math.sin(5*v);   // cortical folds
  x*=1.25*wr; y*=0.92*wr; z*=1.02*wr;
  x+=(x>0?0.13:-0.13);        // hemisphere gap
  y+=0.18*x*x-0.12;           // brain profile
  pts.push({x:x,y:y,z:z,h:(x>0?1:0),o:0.4+Math.random()*0.6});
}
for(i=0;i<24;i++){            // stem
  var s=i/24;
  pts.push({x:0.1+(Math.random()-0.5)*0.22, y:0.85+s*0.55, z:-0.25+(Math.random()-0.5)*0.22, h:2, o:0.55});
}
for(i=0;i<pts.length;i++) for(var j=i+1;j<pts.length;j++){
  var dx=pts[i].x-pts[j].x, dy=pts[i].y-pts[j].y, dz=pts[i].z-pts[j].z;
  if(dx*dx+dy*dy+dz*dz<0.055 && links.length<1400) links.push([i,j]);
}

function size(){
  var r=cv.parentElement.getBoundingClientRect();
  W=r.width; H=Math.max(r.height, 300);
  cv.width=W*DPR; cv.height=H*DPR; cv.style.height=H+"px";
  ctx.setTransform(DPR,0,0,DPR,0,0);
}
size(); window.addEventListener("resize", size);

cv.addEventListener("pointerdown", function(e){ dragging=true; px=e.clientX; py=e.clientY; cv.setPointerCapture(e.pointerId); });
cv.addEventListener("pointermove", function(e){
  if(!dragging) return;
  rotY+=(e.clientX-px)*0.008; rotX+=(e.clientY-py)*0.005;
  rotX=Math.max(-1.1, Math.min(1.1, rotX)); px=e.clientX; py=e.clientY;
});
cv.addEventListener("pointerup", function(){ dragging=false; });
cv.addEventListener("pointercancel", function(){ dragging=false; });

var pr=[];

// The loop only has to run while the hero is on screen and the tab is in front.
// Scrolling past it used to leave a full-rate canvas animation burning the main
// thread for the whole visit.
var onScreen=true, running=false;
try{
  new IntersectionObserver(function(es){
    onScreen=es[es.length-1].isIntersecting;
    if(onScreen)start();
  },{rootMargin:"120px 0px"}).observe(cv);
}catch(e){}
document.addEventListener("visibilitychange",function(){ if(!document.hidden)start(); });

// Every line and dot used to be its own stroke()/fill(): around 2000 canvas
// calls a frame. Alpha is quantised into a handful of buckets instead, so each
// frame is a couple of dozen calls over pre-built paths. Ten steps is finer
// than the eye can pick out at these opacities.
var STEPS=10, MAXA=0.4;
function bucket(a){ return Math.min(STEPS-1, Math.max(0, Math.round(a/MAXA*(STEPS-1)))); }

// 30fps unless a finger or pointer is actually on it, where the extra
// smoothness is worth the frames.
var MIN_DT=1000/30, last=0;

function draw(){
  var dy=window.scrollY-lastScroll; lastScroll=window.scrollY;
  velY+=dy*0.00002; velY=Math.max(0.002, Math.min(0.02, Math.abs(velY)))*(velY<0?-1:1);
  if(!dragging) rotY+=velY;
  velY*=0.98; if(Math.abs(velY)<0.004) velY=0.004*(velY<0?-1:1);
  t+=0.016;
  var pulse=1+0.025*Math.sin(t*1.6);
  var cy=Math.cos(rotY), sy=Math.sin(rotY), cx=Math.cos(rotX), sx=Math.sin(rotX);
  var scale=Math.min(W,H)*0.34*pulse, ox=W/2, oy=H/2;
  ctx.clearRect(0,0,W,H);

  for(var i=0;i<pts.length;i++){
    var p=pts[i];
    var x1=p.x*cy+p.z*sy, z1=-p.x*sy+p.z*cy;
    var y1=p.y*cx-z1*sx, z2=p.y*sx+z1*cx;
    var d=1/(1+z2*0.32);
    pr[i]={x:ox+x1*scale*d, y:oy+y1*scale*d, d:d, h:p.h, o:p.o};
  }
  // teal / green / coral psychology palette on light background
  var cA="43,189,201", cB="45,106,31", cC="239,131,84", cL="26,154,170";
  var k, lines=[], dots=[[],[],[]];
  ctx.lineWidth=1;
  for(i=0;i<links.length;i++){
    var a=pr[links[i][0]], b=pr[links[i][1]];
    var al=0.22*((a.d+b.d)/2-0.6); if(al<=0.01) continue;
    k=bucket(Math.min(al,MAXA));
    (lines[k]||(lines[k]=new Path2D())).moveTo(a.x,a.y);
    lines[k].lineTo(b.x,b.y);
  }
  for(k=0;k<STEPS;k++){
    if(!lines[k]) continue;
    ctx.strokeStyle="rgba("+cL+","+(k/(STEPS-1)*MAXA).toFixed(3)+")";
    ctx.stroke(lines[k]);
  }
  for(i=0;i<pr.length;i++){
    var q=pr[i];
    var r2=Math.max(0.5, 2.5*q.d-1);
    var alpha=Math.min(q.o*q.d*(q.h===2?0.9:1),1);
    k=Math.min(STEPS-1, Math.max(0, Math.round(alpha*(STEPS-1))));
    var slot=dots[q.h], pth=slot[k]||(slot[k]=new Path2D());
    pth.moveTo(q.x+r2, q.y);
    pth.arc(q.x,q.y,r2,0,6.284);
  }
  var hue=[cB,cA,cC];   // h: 0 = green, 1 = teal, 2 = coral stem
  for(var h=0;h<3;h++) for(k=0;k<STEPS;k++){
    if(!dots[h][k]) continue;
    ctx.fillStyle="rgba("+hue[h]+","+(k/(STEPS-1)).toFixed(3)+")";
    ctx.fill(dots[h][k]);
  }
}

function frame(now){
  running=true;
  if(!onScreen||document.hidden){ running=false; return; }
  if(dragging||now-last>=MIN_DT-1){ last=now; draw(); }
  requestAnimationFrame(frame);
}
function start(){ if(!running&&!reduce){ running=true; requestAnimationFrame(frame); } }
if(reduce){
  // draw one static frame
  frame = (function(f){ return function(){ /* no loop */ }; })();
  (function(){ var cy=Math.cos(rotY),sy=Math.sin(rotY),cx=Math.cos(rotX),sx=Math.sin(rotX);
    var scale=Math.min(W,H)*0.34, ox=W/2, oy=H/2; ctx.clearRect(0,0,W,H);
    for(var i=0;i<pts.length;i++){var p=pts[i];var x1=p.x*cy+p.z*sy,z1=-p.x*sy+p.z*cy;var y1=p.y*cx-z1*sx,z2=p.y*sx+z1*cx;var d=1/(1+z2*0.32);pr[i]={x:ox+x1*scale*d,y:oy+y1*scale*d,d:d,h:p.h,o:p.o};}
    for(i=0;i<pr.length;i++){var q=pr[i];ctx.fillStyle="rgba(43,189,201,"+Math.min(q.o*q.d,1).toFixed(3)+")";ctx.beginPath();ctx.arc(q.x,q.y,Math.max(.5,2.5*q.d-1),0,6.284);ctx.fill();}
  })();
} else {
  // Let the page paint and settle first; the hero is decorative until then.
  if(document.readyState==="complete") start();
  else addEventListener("load", start);
}
})();
