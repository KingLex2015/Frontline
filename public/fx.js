// Cinematic rendering: HDR scene target, bloom, sun flare, filmic grade, grain; a cloud sky;
// normal maps made from the painted textures; sky reflections; a reverb tail for the audio.
import * as THREE from 'three';

const VERT = 'varying vec2 vUv; void main(){ vUv = position.xy * 0.5 + 0.5; gl_Position = vec4(position.xy, 0.0, 1.0); }';

const DOWN = `
uniform sampler2D tSrc; uniform vec2 uTexel; uniform float uPre; varying vec2 vUv;
vec3 s(float x, float y){ return texture2D(tSrc, vUv + vec2(x, y) * uTexel).rgb; }
void main(){
  vec3 c = (s(-1.0, -1.0) + s(1.0, -1.0) + s(-1.0, 1.0) + s(1.0, 1.0)) * 0.25;
  if (uPre > 0.5) {
    // keep a little of everything (soft haze) and all of the really bright parts (glow)
    c = min(c, vec3(40.0));
    float m = max(c.r, max(c.g, c.b));
    c *= 0.05 + smoothstep(0.9, 2.4, m);
  }
  gl_FragColor = vec4(c, 1.0);
}`;

const UP = `
uniform sampler2D tSrc, tAdd; uniform vec2 uTexel; varying vec2 vUv;
vec3 s(float x, float y){ return texture2D(tSrc, vUv + vec2(x, y) * uTexel).rgb; }
void main(){
  vec3 c = s(0.0, 0.0) * 4.0 + (s(-1.0, 0.0) + s(1.0, 0.0) + s(0.0, -1.0) + s(0.0, 1.0)) * 2.0
         + s(-1.0, -1.0) + s(1.0, -1.0) + s(-1.0, 1.0) + s(1.0, 1.0);
  gl_FragColor = vec4(texture2D(tAdd, vUv).rgb + c / 16.0, 1.0);
}`;

const FINAL = `
uniform sampler2D tScene, tBloom;
uniform vec2 uSunUv; uniform vec3 uSunCol;
uniform float uSunOn, uAspect, uTime, uExposure, uBloom, uHurt, uLowHp, uAds;
varying vec2 vUv;
float luma(vec3 c){ return dot(c, vec3(0.2126, 0.7152, 0.0722)); }
float hash(vec2 p){ vec3 q = fract(vec3(p.xyx) * 0.1031); q += dot(q, q.yzx + 33.33); return fract((q.x + q.y) * q.z); }
// ACES filmic curve (Stephen Hill's fit, the same one three.js uses)
vec3 rrt(vec3 v){ vec3 a = v * (v + 0.0245786) - 0.000090537; vec3 b = v * (0.983729 * v + 0.4329510) + 0.238081; return a / b; }
vec3 aces(vec3 c){
  const mat3 inM = mat3(vec3(0.59719, 0.07600, 0.02840), vec3(0.35458, 0.90834, 0.13383), vec3(0.04823, 0.01566, 0.83777));
  const mat3 outM = mat3(vec3(1.60475, -0.10208, -0.00327), vec3(-0.53108, 1.10813, -0.07276), vec3(-0.07367, -0.00605, 1.07602));
  return clamp(outM * rrt(inM * c), 0.0, 1.0);
}
vec3 toSRGB(vec3 c){ return mix(c * 12.92, 1.055 * pow(max(c, vec3(0.0)), vec3(1.0 / 2.4)) - 0.055, step(vec3(0.0031308), c)); }
float sunSeen(){
  if (uSunOn < 0.5) return 0.0;
  float v = 0.0;
  for (int i = 0; i < 5; i++) {
    vec2 o = i == 0 ? vec2(0.0) : vec2(i == 1 ? -1.0 : i == 2 ? 1.0 : 0.0, i == 3 ? -1.0 : i == 4 ? 1.0 : 0.0);
    vec2 uv = uSunUv + o * vec2(0.006, 0.006 * uAspect);
    if (uv.x > 0.0 && uv.x < 1.0 && uv.y > 0.0 && uv.y < 1.0) v += step(6.0, luma(texture2D(tScene, uv).rgb));
  }
  return v * 0.2;
}
vec3 flare(vec2 uv, float vis){
  vec2 asp = vec2(uAspect, 1.0);
  vec2 p = (uv - 0.5) * asp, s = (uSunUv - 0.5) * asp, d = p - s;
  float r = length(d);
  vec3 c = uSunCol * (0.014 / (r * r * 8.0 + 0.012) + 0.07 * exp(-r * 3.5));
  c += vec3(0.5, 0.65, 1.0) * exp(-abs(d.y) * 70.0) * exp(-abs(d.x) * 2.2) * 0.10;
  c += vec3(0.35, 0.8, 0.6) * smoothstep(0.07, 0.05, length(p + s * 0.45)) * 0.035;
  c += vec3(0.9, 0.5, 0.3) * smoothstep(0.04, 0.025, length(p + s * 0.9)) * 0.05;
  c += vec3(0.4, 0.5, 0.95) * smoothstep(0.15, 0.11, length(p + s * 1.4)) * 0.025;
  return c * vis;
}
void main(){
  vec2 c = vUv - 0.5;
  float r2 = dot(c, c) * 2.0;                       // 0 centre .. 1 corner
  vec2 off = c * r2 * (0.0035 + uHurt * 0.012);     // lens fringing, stronger when hit
  vec3 col = vec3(texture2D(tScene, vUv + off).r, texture2D(tScene, vUv).g, texture2D(tScene, vUv - off).b);
  vec3 bloom = texture2D(tBloom, vUv).rgb;
  col += bloom * uBloom;
  float vis = sunSeen();
  if (vis > 0.0) col += flare(vUv, vis);
  col = aces(col * uExposure / 0.6);
  // grade: cool shadows, warm highlights, a gentle S-curve
  float l = luma(col);
  col *= mix(vec3(0.90, 1.0, 1.08), vec3(1.05, 1.0, 0.93), smoothstep(0.03, 0.6, l));
  col = mix(col, col * col * (3.0 - 2.0 * col), 0.18);
  l = luma(col);
  col = mix(vec3(l), col, 1.08 * (1.0 - 0.6 * uLowHp));
  float vr = smoothstep(0.15 - uAds * 0.08, 1.05, r2);
  col *= 1.0 - (0.30 + uAds * 0.22 + uLowHp * 0.3) * vr * vr * (3.0 - 2.0 * vr);
  col = toSRGB(clamp(col, 0.0, 1.0));
  // film grain (less in the highlights) and a dither against banding in the sky
  vec2 seed = gl_FragCoord.xy + fract(uTime * vec2(7.31, 3.17)) * vec2(311.7, 173.3);
  float g = hash(seed) + hash(seed + 57.3) - 1.0;
  col += g * 0.022 * mix(1.0, 0.3, smoothstep(0.25, 0.9, luma(col)));
  col += (hash(gl_FragCoord.xy * 1.37 + 11.0) - 0.5) / 255.0;
  gl_FragColor = vec4(col, 1.0);
}`;

export function createPost(renderer) {
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array([-1, -1, 0, 3, -1, 0, -1, 3, 0]), 3));
  const tri = new THREE.Mesh(geo, null);
  tri.frustumCulled = false;
  const quad = new THREE.Scene();
  quad.add(tri);
  const cam = new THREE.Camera();
  const shader = (frag, uniforms) => new THREE.ShaderMaterial({ vertexShader: VERT, fragmentShader: frag, uniforms, depthTest: false, depthWrite: false, toneMapped: false });
  const down = shader(DOWN, { tSrc: { value: null }, uTexel: { value: new THREE.Vector2() }, uPre: { value: 0 } });
  const up = shader(UP, { tSrc: { value: null }, tAdd: { value: null }, uTexel: { value: new THREE.Vector2() } });
  const fin = shader(FINAL, {
    tScene: { value: null }, tBloom: { value: null }, uSunUv: { value: new THREE.Vector2() }, uSunCol: { value: new THREE.Color(1, 1, 1) },
    uSunOn: { value: 0 }, uAspect: { value: 1 }, uTime: { value: 0 }, uExposure: { value: 1 }, uBloom: { value: 0.3 },
    uHurt: { value: 0 }, uLowHp: { value: 0 }, uAds: { value: 0 },
  });
  const MIPS = 5;
  let rt = null, downs = [], ups = [], scale = 1;
  const size = new THREE.Vector2(), _v = new THREE.Vector3(), _d = new THREE.Vector3();
  const half = (w, h) => new THREE.WebGLRenderTarget(w, h, { type: THREE.HalfFloatType, depthBuffer: false });
  function setSize() {
    renderer.getDrawingBufferSize(size);
    // The HDR target is capped at about 2.3 megapixels so Retina screens stay fast.
    const k = Math.min(1, Math.sqrt(2.3e6 / (size.x * size.y))) * scale;
    const w = Math.max(2, Math.round(size.x * k)), h = Math.max(2, Math.round(size.y * k));
    for (const t of [rt, ...downs, ...ups]) if (t) t.dispose();
    rt = new THREE.WebGLRenderTarget(w, h, { type: THREE.HalfFloatType, samples: 4 });
    downs = []; ups = [];
    for (let i = 0; i < MIPS; i++) {
      const mw = Math.max(2, w >> (i + 1)), mh = Math.max(2, h >> (i + 1));
      downs.push(half(mw, mh));
      if (i < MIPS - 1) ups.push(half(mw, mh));
    }
    fin.uniforms.uAspect.value = w / h;
  }
  function pass(material, target) {
    tri.material = material;
    renderer.setRenderTarget(target);
    renderer.render(quad, cam);
  }
  let slowFor = 0;
  return {
    setSize,
    // st: { time, dt, hurt, lowHp, ads, sunDir, sunCol }
    render(scene, camera, vmScene, vmCamera, st) {
      if (!rt) setSize();
      // Three slow seconds in a row: render the scene smaller (the HUD stays sharp).
      slowFor = st.dt > 0.034 ? slowFor + st.dt : 0;
      if (slowFor > 3 && scale > 0.6) { scale -= 0.2; slowFor = 0; setSize(); }
      renderer.setRenderTarget(rt);
      renderer.clear();
      renderer.render(scene, camera);
      if (vmScene) { renderer.clearDepth(); renderer.render(vmScene, vmCamera); }
      let src = rt;
      for (let i = 0; i < MIPS; i++) {
        down.uniforms.tSrc.value = src.texture;
        down.uniforms.uTexel.value.set(1 / src.width, 1 / src.height);
        down.uniforms.uPre.value = i === 0 ? 1 : 0;
        pass(down, downs[i]);
        src = downs[i];
      }
      for (let i = MIPS - 2; i >= 0; i--) {
        up.uniforms.tSrc.value = src.texture;
        up.uniforms.uTexel.value.set(1 / src.width, 1 / src.height);
        up.uniforms.tAdd.value = downs[i].texture;
        pass(up, ups[i]);
        src = ups[i];
      }
      const u = fin.uniforms;
      u.tScene.value = rt.texture; u.tBloom.value = src.texture;
      u.uTime.value = st.time; u.uExposure.value = renderer.toneMappingExposure;
      u.uHurt.value = st.hurt; u.uLowHp.value = st.lowHp; u.uAds.value = st.ads;
      u.uSunCol.value.copy(st.sunCol);
      camera.getWorldDirection(_d);
      u.uSunOn.value = _d.dot(st.sunDir) > 0.15 ? 1 : 0;
      _v.copy(st.sunDir).multiplyScalar(400).add(camera.position).project(camera);
      u.uSunUv.value.set(_v.x * 0.5 + 0.5, _v.y * 0.5 + 0.5);
      pass(fin, null);
    },
  };
}

/* ------------------------------- sky ------------------------------- */

export function skyMaterial() {
  return new THREE.ShaderMaterial({
    side: THREE.BackSide, depthWrite: false, toneMapped: false,
    uniforms: {
      top: { value: new THREE.Color() }, bottom: { value: new THREE.Color() }, ground: { value: new THREE.Color(0x444444) },
      sunDir: { value: new THREE.Vector3(0, 1, 0) }, sunCol: { value: new THREE.Color(1, 1, 1) },
      uTime: { value: 0 }, uCloud: { value: 0.5 }, uGain: { value: 1 }, uEnv: { value: 0 },
    },
    vertexShader: 'varying vec3 vP; void main(){ vP = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
    fragmentShader: `
uniform vec3 top, bottom, ground, sunDir, sunCol; uniform float uTime, uCloud, uGain, uEnv; varying vec3 vP;
float h21(vec2 p){ p = fract(p * vec2(123.34, 456.21)); p += dot(p, p + 45.32); return fract(p.x * p.y); }
float vn(vec2 p){ vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
  return mix(mix(h21(i), h21(i + vec2(1.0, 0.0)), f.x), mix(h21(i + vec2(0.0, 1.0)), h21(i + vec2(1.0, 1.0)), f.x), f.y); }
float fbm(vec2 p){ float a = 0.5, v = 0.0; for (int i = 0; i < 5; i++) { v += a * vn(p); p = p * 2.03 + vec2(17.0, 9.0); a *= 0.5; } return v; }
void main(){
  vec3 d = normalize(vP);
  vec3 col = mix(bottom, top, pow(clamp(d.y * 1.4 + 0.08, 0.0, 1.0), 0.6));
  float sd = max(dot(d, sunDir), 0.0);
  col += sunCol * (pow(sd, 8.0) * 0.10 + pow(sd, 64.0) * 0.30);
  float cover = 0.0;
  if (d.y > 0.0) {
    vec2 uv = d.xz / (d.y + 0.12) * 1.2 + uTime * vec2(0.006, 0.002);
    float n = fbm(uv);
    cover = smoothstep(1.0 - uCloud, 1.28 - uCloud, n) * smoothstep(0.0, 0.16, d.y) * 0.92;
    float lit = clamp(0.55 + (n - fbm(uv + sunDir.xz * 0.14)) * 3.2, 0.0, 1.0);
    vec3 cc = mix(mix(bottom, top, 0.4) * 0.7, mix(vec3(1.0), sunCol, 0.5) * 1.12, lit);
    cc += sunCol * pow(sd, 14.0) * 0.5;
    col = mix(col, cc, cover);
  }
  // the sun disc is far brighter than white, so it blooms and flares
  col += sunCol * smoothstep(0.9993, 0.9997, sd) * 30.0 * (1.0 - cover) * (1.0 - uEnv);
  // for reflections the lower half is the ground, not more sky
  col = mix(col, ground, uEnv * smoothstep(0.02, -0.12, d.y));
  gl_FragColor = vec4(col * uGain, 1.0);
}`,
  });
}

// Bakes the sky into a reflection map so metal, glass and wet-looking paint mirror it.
export function bakeSkyEnv(renderer, sky, old) {
  const u = sky.material.uniforms;
  const s = new THREE.Scene();
  s.add(new THREE.Mesh(sky.geometry, sky.material));
  u.uEnv.value = 1; u.uGain.value = 0.42;
  const pm = new THREE.PMREMGenerator(renderer);
  const rt = pm.fromScene(s, 0, 1, 1000);
  pm.dispose();
  u.uEnv.value = 0; u.uGain.value = 1;
  if (old) old.dispose();
  return rt;
}

/* --------------------------- surface detail --------------------------- */

// Turns a painted colour texture into a normal map (brightness = height), so flat walls,
// planks and concrete catch the light like rough surfaces.
export function normalFromTex(tex, strength = 1.6) {
  const src = tex.image, w = src.width, h = src.height;
  if (!src.getContext || !w) return null;
  const px = src.getContext('2d').getImageData(0, 0, w, h).data;
  const H = new Float32Array(w * h);
  for (let i = 0; i < w * h; i++) H[i] = (px[i * 4] * 0.3 + px[i * 4 + 1] * 0.59 + px[i * 4 + 2] * 0.11) / 255;
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  const g = c.getContext('2d'), out = g.createImageData(w, h), o = out.data;
  for (let y = 0; y < h; y++) {
    const yu = ((y - 1 + h) % h) * w, yd = ((y + 1) % h) * w, y0 = y * w;
    for (let x = 0; x < w; x++) {
      const xl = (x - 1 + w) % w, xr = (x + 1) % w;
      const dx = (H[y0 + xr] - H[y0 + xl]) * strength, dy = (H[yd + x] - H[yu + x]) * strength;
      const inv = 1 / Math.hypot(dx, dy, 1), k = (y0 + x) * 4;
      o[k] = (-dx * inv * 0.5 + 0.5) * 255; o[k + 1] = (dy * inv * 0.5 + 0.5) * 255; o[k + 2] = (inv * 0.5 + 0.5) * 255; o[k + 3] = 255;
    }
  }
  g.putImageData(out, 0, 0);
  const t = new THREE.CanvasTexture(c);
  t.wrapS = tex.wrapS; t.wrapT = tex.wrapT; t.repeat.copy(tex.repeat); t.anisotropy = tex.anisotropy;
  return t;
}

/* ------------------------------ audio ------------------------------ */

// A short outdoor echo: every sound also feeds a quiet, decaying noise tail.
export function addReverb(AC, from, to, wet = 0.16, seconds = 1.5) {
  const n = Math.floor(AC.sampleRate * seconds), buf = AC.createBuffer(2, n, AC.sampleRate);
  for (let ch = 0; ch < 2; ch++) {
    const d = buf.getChannelData(ch);
    let lp = 0;
    for (let i = 0; i < n; i++) {
      lp += ((Math.random() * 2 - 1) - lp) * 0.35;          // darker tail
      d[i] = lp * Math.pow(1 - i / n, 2.6) * (i < 400 ? i / 400 : 1);
    }
  }
  const conv = AC.createConvolver(), g = AC.createGain();
  conv.buffer = buf; g.gain.value = wet;
  from.connect(conv); conv.connect(g); g.connect(to);
}
