/* MindCare Services® — interactive 3D psychology brain (hero) */
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
function frame(){
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
  ctx.lineWidth=1;
  for(i=0;i<links.length;i++){
    var a=pr[links[i][0]], b=pr[links[i][1]];
    var al=0.22*((a.d+b.d)/2-0.6); if(al<=0.01) continue;
    ctx.strokeStyle="rgba("+cL+","+Math.min(al,0.4).toFixed(3)+")";
    ctx.beginPath(); ctx.moveTo(a.x,a.y); ctx.lineTo(b.x,b.y); ctx.stroke();
  }
  for(i=0;i<pr.length;i++){
    var q=pr[i];
    var r2=Math.max(0.5, 2.5*q.d-1);
    ctx.fillStyle = q.h===1 ? "rgba("+cA+","+Math.min(q.o*q.d,1).toFixed(3)+")"
                  : q.h===0 ? "rgba("+cB+","+Math.min(q.o*q.d,1).toFixed(3)+")"
                  :           "rgba("+cC+","+Math.min(q.o*q.d*0.9,1).toFixed(3)+")";
    ctx.beginPath(); ctx.arc(q.x,q.y,r2,0,6.284); ctx.fill();
  }
  requestAnimationFrame(frame);
}
if(reduce){
  // draw one static frame
  frame = (function(f){ return function(){ /* no loop */ }; })();
  (function(){ var cy=Math.cos(rotY),sy=Math.sin(rotY),cx=Math.cos(rotX),sx=Math.sin(rotX);
    var scale=Math.min(W,H)*0.34, ox=W/2, oy=H/2; ctx.clearRect(0,0,W,H);
    for(var i=0;i<pts.length;i++){var p=pts[i];var x1=p.x*cy+p.z*sy,z1=-p.x*sy+p.z*cy;var y1=p.y*cx-z1*sx,z2=p.y*sx+z1*cx;var d=1/(1+z2*0.32);pr[i]={x:ox+x1*scale*d,y:oy+y1*scale*d,d:d,h:p.h,o:p.o};}
    for(i=0;i<pr.length;i++){var q=pr[i];ctx.fillStyle="rgba(43,189,201,"+Math.min(q.o*q.d,1).toFixed(3)+")";ctx.beginPath();ctx.arc(q.x,q.y,Math.max(.5,2.5*q.d-1),0,6.284);ctx.fill();}
  })();
} else {
  requestAnimationFrame(frame);
}
})();
