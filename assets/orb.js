/* Immersive meditation orb — reacts to the global background audio stream. */
(function () {
  var canvas = document.getElementById("orb-canvas");
  var section = document.getElementById("orb-scene");
  if (!canvas || !section || typeof THREE === "undefined") return;

  var reduce = false;
  try { reduce = matchMedia("(prefers-reduced-motion: reduce)").matches; } catch (e) {}

  // ---- performance tier / particle budgets ----
  var w = innerWidth, dpr = Math.min(devicePixelRatio || 1, 2);
  var lowPerf = w < 760 || (navigator.hardwareConcurrency || 4) <= 4;
  var FIELD = reduce ? 1400 : (lowPerf ? 2600 : 6000);
  var DUST = reduce ? 260 : (lowPerf ? 500 : 1200);
  var ORBIT = reduce ? 220 : (lowPerf ? 500 : 1100);
  if (lowPerf) dpr = Math.min(dpr, 1.5);

  // ---- renderer / scene / camera ----
  var renderer = new THREE.WebGLRenderer({ canvas: canvas, antialias: !lowPerf, alpha: false });
  renderer.setPixelRatio(dpr);
  renderer.setClearColor(0x000000, 1);
  var scene = new THREE.Scene();
  scene.fog = new THREE.FogExp2(0x001108, 0.05);
  var camera = new THREE.PerspectiveCamera(46, 1, 0.1, 100);
  camera.position.set(0, 0, 7.2);

  var GREEN = new THREE.Color(0x2fe6a6);
  var group = new THREE.Group();
  scene.add(group);

  // ---- audio analysis (shared global stream) ----
  var audio = document.getElementById("bgm");
  var analyser = null, freq = null, actx = null;
  function initAudio() {
    if (analyser || !audio) return;
    try {
      var AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      actx = new AC();
      var src = actx.createMediaElementSource(audio);
      analyser = actx.createAnalyser();
      analyser.fftSize = 256;
      analyser.smoothingTimeConstant = 0.85;
      freq = new Uint8Array(analyser.frequencyBinCount);
      src.connect(analyser);
      analyser.connect(actx.destination);
    } catch (e) { analyser = null; }
  }
  ["pointerdown", "keydown", "touchstart"].forEach(function (ev) {
    window.addEventListener(ev, function () {
      initAudio();
      if (actx && actx.state === "suspended") actx.resume();
    }, { passive: true });
  });

  // smoothed audio metrics
  var amp = 0, low = 0, mid = 0, high = 0;
  function readAudio() {
    if (!analyser) return;
    analyser.getByteFrequencyData(freq);
    var n = freq.length, s = 0, lo = 0, md = 0, hi = 0, a = Math.floor(n * 0.15), b = Math.floor(n * 0.55);
    for (var i = 0; i < n; i++) { var v = freq[i] / 255; s += v; if (i < a) lo += v; else if (i < b) md += v; else hi += v; }
    var tAmp = s / n, tLow = lo / a, tMid = md / (b - a), tHigh = hi / (n - b);
    // heavy smoothing, no jitter
    amp += (tAmp - amp) * 0.08;
    low += (tLow - low) * 0.08;
    mid += (tMid - mid) * 0.10;
    high += (tHigh - high) * 0.12;
  }

  // ---- noise (glsl simplex) ----
  var NOISE = [
    "vec3 mod289(vec3 x){return x-floor(x*(1.0/289.0))*289.0;}",
    "vec4 mod289(vec4 x){return x-floor(x*(1.0/289.0))*289.0;}",
    "vec4 permute(vec4 x){return mod289(((x*34.0)+1.0)*x);}",
    "vec4 taylorInvSqrt(vec4 r){return 1.79284291400159-0.85373472095314*r;}",
    "float snoise(vec3 v){const vec2 C=vec2(1.0/6.0,1.0/3.0);const vec4 D=vec4(0.0,0.5,1.0,2.0);",
    "vec3 i=floor(v+dot(v,C.yyy));vec3 x0=v-i+dot(i,C.xxx);",
    "vec3 g=step(x0.yzx,x0.xyz);vec3 l=1.0-g;vec3 i1=min(g.xyz,l.zxy);vec3 i2=max(g.xyz,l.zxy);",
    "vec3 x1=x0-i1+C.xxx;vec3 x2=x0-i2+C.yyy;vec3 x3=x0-D.yyy;i=mod289(i);",
    "vec4 p=permute(permute(permute(i.z+vec4(0.0,i1.z,i2.z,1.0))+i.y+vec4(0.0,i1.y,i2.y,1.0))+i.x+vec4(0.0,i1.x,i2.x,1.0));",
    "float ns=0.142857142857;vec3 nsx=ns*D.wyz-D.xzx;vec4 j=p-49.0*floor(p*nsx.z*nsx.z);",
    "vec4 x_=floor(j*nsx.z);vec4 y_=floor(j-7.0*x_);vec4 x=x_*nsx.x+nsx.yyyy;vec4 y=y_*nsx.x+nsx.yyyy;",
    "vec4 h=1.0-abs(x)-abs(y);vec4 b0=vec4(x.xy,y.xy);vec4 b1=vec4(x.zw,y.zw);",
    "vec4 s0=floor(b0)*2.0+1.0;vec4 s1=floor(b1)*2.0+1.0;vec4 sh=-step(h,vec4(0.0));",
    "vec4 a0=b0.xzyw+s0.xzyw*sh.xxyy;vec4 a1=b1.xzyw+s1.xzyw*sh.zzww;",
    "vec3 p0=vec3(a0.xy,h.x);vec3 p1=vec3(a0.zw,h.y);vec3 p2=vec3(a1.xy,h.z);vec3 p3=vec3(a1.zw,h.w);",
    "vec4 norm=taylorInvSqrt(vec4(dot(p0,p0),dot(p1,p1),dot(p2,p2),dot(p3,p3)));",
    "p0*=norm.x;p1*=norm.y;p2*=norm.z;p3*=norm.w;",
    "vec4 m=max(0.6-vec4(dot(x0,x0),dot(x1,x1),dot(x2,x2),dot(x3,x3)),0.0);m=m*m;",
    "return 42.0*dot(m*m,vec4(dot(p0,x0),dot(p1,x1),dot(p2,x2),dot(p3,x3)));}"
  ].join("\n");

  // ---- orb core (displaced shader sphere) ----
  var uniforms = {
    uTime: { value: 0 }, uAmp: { value: 0 }, uLow: { value: 0 },
    uMid: { value: 0 }, uHigh: { value: 0 }, uColor: { value: GREEN }
  };
  var orbGeo = new THREE.IcosahedronGeometry(1.35, lowPerf ? 4 : 6);
  var orbMat = new THREE.ShaderMaterial({
    uniforms: uniforms,
    transparent: true,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    vertexShader: NOISE + [
      "uniform float uTime,uAmp,uLow,uMid;varying float vN;varying vec3 vView;",
      "void main(){",
      " vec3 p=normalize(position);",
      " float n=snoise(p*1.6+uTime*0.25);",
      " float ripple=snoise(p*4.5+uTime*0.6)*(0.12+uMid*0.5);",
      " float disp=1.35+0.10*n+ripple+uAmp*0.55+uLow*0.35;",
      " vN=n*0.5+0.5;",
      " vec3 np=p*disp;",
      " vec4 mv=modelViewMatrix*vec4(np,1.0);",
      " vView=normalize(-mv.xyz);",
      " gl_Position=projectionMatrix*mv;}"
    ].join("\n"),
    fragmentShader: [
      "uniform vec3 uColor;uniform float uAmp,uHigh;varying float vN;varying vec3 vView;",
      "void main(){",
      " float fres=pow(1.0-abs(vView.z),2.2);",
      " float plasma=0.4+0.6*vN;",
      " vec3 col=uColor*(plasma+fres*1.4);",
      " col+=vec3(0.05,0.35,0.22)*uHigh*2.0;",
      " float a=0.18+fres*0.8+uAmp*0.4;",
      " gl_FragColor=vec4(col,a);}"
    ].join("\n")
  });
  var orb = new THREE.Mesh(orbGeo, orbMat);
  group.add(orb);

  // translucent energy shells
  var shells = [];
  [1.7, 2.15, 2.6].forEach(function (r, i) {
    var m = new THREE.Mesh(
      new THREE.IcosahedronGeometry(r, 2),
      new THREE.MeshBasicMaterial({
        color: GREEN, transparent: true, opacity: 0.05 - i * 0.012,
        blending: THREE.AdditiveBlending, depthWrite: false,
        wireframe: true
      })
    );
    shells.push(m); group.add(m);
  });

  // soft bloom-ish core glow sprite
  function glowTex() {
    var c = document.createElement("canvas"); c.width = c.height = 128;
    var g = c.getContext("2d");
    var rg = g.createRadialGradient(64, 64, 0, 64, 64, 64);
    rg.addColorStop(0, "rgba(90,255,200,1)");
    rg.addColorStop(0.25, "rgba(47,230,166,0.55)");
    rg.addColorStop(1, "rgba(0,40,25,0)");
    g.fillStyle = rg; g.fillRect(0, 0, 128, 128);
    var t = new THREE.CanvasTexture(c); return t;
  }
  var gtex = glowTex();
  var glow = new THREE.Sprite(new THREE.SpriteMaterial({
    map: gtex, color: 0x2fe6a6, transparent: true, opacity: 0.55,
    blending: THREE.AdditiveBlending, depthWrite: false
  }));
  glow.scale.set(7, 7, 1); scene.add(glow);

  // light-ray sprite (soft vertical volumetric feel)
  var ray = new THREE.Sprite(new THREE.SpriteMaterial({
    map: gtex, color: 0x1f7a5a, transparent: true, opacity: 0.16,
    blending: THREE.AdditiveBlending, depthWrite: false
  }));
  ray.scale.set(4, 16, 1); ray.position.z = -3; scene.add(ray);

  // ---- particle helpers ----
  function pointTex() {
    var c = document.createElement("canvas"); c.width = c.height = 32;
    var g = c.getContext("2d");
    var rg = g.createRadialGradient(16, 16, 0, 16, 16, 16);
    rg.addColorStop(0, "rgba(160,255,220,1)");
    rg.addColorStop(0.5, "rgba(47,230,166,0.6)");
    rg.addColorStop(1, "rgba(0,0,0,0)");
    g.fillStyle = rg; g.fillRect(0, 0, 32, 32);
    return new THREE.CanvasTexture(c);
  }
  var ptex = pointTex();

  // ---- circular energy field (organic audio spectrum) ----
  var fGeo = new THREE.BufferGeometry();
  var fPos = new Float32Array(FIELD * 3);
  var fBase = new Float32Array(FIELD);   // base radius
  var fAng = new Float32Array(FIELD);
  var fBin = new Int16Array(FIELD);
  var fY = new Float32Array(FIELD);
  for (var i = 0; i < FIELD; i++) {
    var ang = Math.random() * Math.PI * 2;
    var rad = 3.0 + Math.random() * 2.6;
    fAng[i] = ang; fBase[i] = rad;
    fBin[i] = Math.floor((Math.abs(Math.sin(ang * 3.0)) ) * 63);
    fY[i] = (Math.random() - 0.5) * 1.4;
    fPos[i * 3] = Math.cos(ang) * rad;
    fPos[i * 3 + 1] = fY[i];
    fPos[i * 3 + 2] = Math.sin(ang) * rad;
  }
  fGeo.setAttribute("position", new THREE.BufferAttribute(fPos, 3));
  var field = new THREE.Points(fGeo, new THREE.PointsMaterial({
    size: lowPerf ? 0.05 : 0.035, map: ptex, color: 0x2fe6a6,
    transparent: true, opacity: 0.85, blending: THREE.AdditiveBlending,
    depthWrite: false, sizeAttenuation: true
  }));
  group.add(field);

  // ---- orbiting particles ----
  var oGeo = new THREE.BufferGeometry();
  var oPos = new Float32Array(ORBIT * 3);
  var oAng = new Float32Array(ORBIT), oRad = new Float32Array(ORBIT),
      oSpd = new Float32Array(ORBIT), oTilt = new Float32Array(ORBIT), oY = new Float32Array(ORBIT);
  for (var k = 0; k < ORBIT; k++) {
    oAng[k] = Math.random() * Math.PI * 2;
    oRad[k] = 2.0 + Math.random() * 1.4;
    oSpd[k] = 0.1 + Math.random() * 0.4;
    oTilt[k] = Math.random() * Math.PI;
    oY[k] = (Math.random() - 0.5) * 2.2;
  }
  oGeo.setAttribute("position", new THREE.BufferAttribute(oPos, 3));
  var orbit = new THREE.Points(oGeo, new THREE.PointsMaterial({
    size: 0.06, map: ptex, color: 0x7affd0, transparent: true,
    opacity: 0.9, blending: THREE.AdditiveBlending, depthWrite: false
  }));
  group.add(orbit);

  // ---- floating dust ----
  var dGeo = new THREE.BufferGeometry();
  var dPos = new Float32Array(DUST * 3);
  for (var d = 0; d < DUST; d++) {
    dPos[d * 3] = (Math.random() - 0.5) * 20;
    dPos[d * 3 + 1] = (Math.random() - 0.5) * 12;
    dPos[d * 3 + 2] = (Math.random() - 0.5) * 12 - 2;
  }
  dGeo.setAttribute("position", new THREE.BufferAttribute(dPos, 3));
  var dust = new THREE.Points(dGeo, new THREE.PointsMaterial({
    size: 0.04, map: ptex, color: 0x2fbf8f, transparent: true,
    opacity: 0.4, blending: THREE.AdditiveBlending, depthWrite: false
  }));
  scene.add(dust);

  // ---- resize ----
  function resize() {
    var r = section.getBoundingClientRect();
    var ww = r.width || innerWidth, hh = r.height || innerHeight;
    renderer.setSize(ww, hh, false);
    camera.aspect = ww / hh; camera.updateProjectionMatrix();
  }
  resize();
  addEventListener("resize", resize, { passive: true });

  // ---- visibility gating ----
  var visible = true, running = false;
  if ("IntersectionObserver" in window) {
    new IntersectionObserver(function (es) {
      visible = es[0].isIntersecting;
      if (visible && !running) { running = true; requestAnimationFrame(loop); }
    }, { threshold: 0.02 }).observe(section);
  }

  // ---- render loop ----
  var t0 = performance.now(), last = t0;
  function loop(now) {
    if (!visible) { running = false; return; }
    running = true;
    var t = (now - t0) / 1000;
    var dt = Math.min((now - last) / 1000, 0.05); last = now;
    readAudio();

    uniforms.uTime.value = t;
    uniforms.uAmp.value = amp; uniforms.uLow.value = low;
    uniforms.uMid.value = mid; uniforms.uHigh.value = high;

    // orb breathing
    var pulse = 1 + amp * 0.28 + low * 0.15;
    orb.scale.setScalar(pulse);
    for (var s = 0; s < shells.length; s++) {
      shells[s].rotation.y = t * (0.05 + s * 0.03);
      shells[s].rotation.x = t * 0.02 * (s + 1);
      shells[s].scale.setScalar(1 + amp * 0.12 + Math.sin(t * 0.5 + s) * 0.02);
    }
    glow.scale.setScalar(6.5 + amp * 4 + low * 2);
    glow.material.opacity = 0.4 + amp * 0.5;

    // energy field: organic radial spectrum
    for (var i = 0; i < FIELD; i++) {
      var b = analyser ? freq[fBin[i]] / 255 : 0;
      var breathe = 0.12 * Math.sin(t * 0.6 + fAng[i] * 5.0);
      var rad = fBase[i] + b * 1.6 + amp * 0.6 + breathe;
      var a2 = fAng[i] + t * 0.05;
      fPos[i * 3] = Math.cos(a2) * rad;
      fPos[i * 3 + 1] = fY[i] + Math.sin(t * 0.4 + fAng[i] * 3.0) * 0.25;
      fPos[i * 3 + 2] = Math.sin(a2) * rad;
    }
    fGeo.attributes.position.needsUpdate = true;
    field.material.opacity = 0.6 + high * 0.4;

    // orbiting particles drift outward on peaks
    var push = 1 + amp * 0.5;
    for (var k = 0; k < ORBIT; k++) {
      oAng[k] += oSpd[k] * dt * (0.6 + amp);
      var rr = oRad[k] * push;
      var ca = Math.cos(oAng[k]) * rr, sa = Math.sin(oAng[k]) * rr;
      var ct = Math.cos(oTilt[k]), st = Math.sin(oTilt[k]);
      oPos[k * 3] = ca;
      oPos[k * 3 + 1] = oY[k] * 0.5 + sa * st;
      oPos[k * 3 + 2] = sa * ct;
    }
    oGeo.attributes.position.needsUpdate = true;

    dust.rotation.y = t * 0.01;

    // idle rotation + subtle cinematic camera drift
    group.rotation.y = t * 0.06;
    group.rotation.x = Math.sin(t * 0.1) * 0.05;
    camera.position.x = Math.sin(t * 0.08) * 0.35;
    camera.position.y = Math.cos(t * 0.06) * 0.22;
    camera.lookAt(0, 0, 0);

    renderer.render(scene, camera);
    requestAnimationFrame(loop);
  }
  requestAnimationFrame(loop);
})();
