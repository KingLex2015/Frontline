import * as THREE from 'three';

const $ = (id) => document.getElementById(id);
const rand = (a, b) => a + Math.random() * (b - a);
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const lerp = (a, b, t) => a + (b - a) * t;
const damp = (a, b, k, dt) => lerp(a, b, 1 - Math.exp(-k * dt));
const V3 = THREE.Vector3;

/* ============================== DATA ============================== */

const WEAPONS = {
  m4:      { name: 'M4 VANGUARD', cls: 'Assault Rifle',     dmg: 28,  head: 1.6, rpm: 760, auto: true,  mag: 30,  reserve: 150, reload: 2.1, hip: 0.032, ads: 0.003, recoil: 0.011, kick: 0.06, adsFov: 52, adsTime: 0.22, move: 1.0,  range: 45,  snd: { f: 2600, d: 0.22, thump: 0.9 }, model: 'ar' },
  viper:   { name: 'VIPER-9',     cls: 'SMG',               dmg: 21,  head: 1.4, rpm: 980, auto: true,  mag: 32,  reserve: 192, reload: 1.7, hip: 0.024, ads: 0.007, recoil: 0.008, kick: 0.045, adsFov: 60, adsTime: 0.15, move: 1.1,  range: 22,  snd: { f: 3400, d: 0.15, thump: 0.6 }, model: 'smg' },
  titan:   { name: 'TITAN LMG',   cls: 'Light Machine Gun', dmg: 31,  head: 1.5, rpm: 680, auto: true,  mag: 100, reserve: 200, reload: 4.6, hip: 0.05,  ads: 0.005, recoil: 0.013, kick: 0.07, adsFov: 50, adsTime: 0.38, move: 0.86, range: 55,  snd: { f: 1900, d: 0.3,  thump: 1.3 }, model: 'lmg' },
  longbow: { name: 'LONGBOW .50', cls: 'Sniper Rifle',      dmg: 115, head: 2.0, rpm: 48,  auto: false, mag: 5,   reserve: 25,  reload: 3.3, hip: 0.09,  ads: 0,     recoil: 0.06,  kick: 0.22, adsFov: 18, adsTime: 0.32, move: 0.9,  range: 999, snd: { f: 1500, d: 0.6,  thump: 1.7 }, model: 'sniper', scope: true },
  ranger:  { name: 'RANGER DMR',  cls: 'Marksman Rifle',    dmg: 52,  head: 2.1, rpm: 320, auto: false, mag: 12,  reserve: 60,  reload: 2.6, hip: 0.06,  ads: 0.001, recoil: 0.03,  kick: 0.12, adsFov: 30, adsTime: 0.27, move: 0.94, range: 999, snd: { f: 2100, d: 0.4,  thump: 1.2 }, model: 'dmr', scope: true },
  p11:     { name: 'P-11',        cls: 'Pistol',            dmg: 30,  head: 1.5, rpm: 420, auto: false, mag: 12,  reserve: 60,  reload: 1.4, hip: 0.02,  ads: 0.006, recoil: 0.016, kick: 0.08, adsFov: 65, adsTime: 0.12, move: 1.05, range: 18,  snd: { f: 3000, d: 0.14, thump: 0.5 }, model: 'pistol' },
};

const LOADOUTS = {
  assault:  { name: 'ASSAULT',  desc: 'M4 rifle + pistol. All-rounder.',      weapons: ['m4', 'p11'] },
  smg:      { name: 'SMG',      desc: 'Viper-9 + pistol. Fast and close.',     weapons: ['viper', 'p11'] },
  gunner:   { name: 'GUNNER',   desc: 'Titan LMG + pistol. 100-round big gun.', weapons: ['titan', 'p11'] },
  marksman: { name: 'MARKSMAN', desc: 'Two snipers: Longbow .50 + Ranger DMR.', weapons: ['longbow', 'ranger'] },
};

const PLAYER_COLORS = [0x4a5e3a, 0x6a5638, 0x3e5068, 0x6a3c36, 0x584270, 0x3c625c, 0x6c6a3c, 0x7a5030, 0x2e4e72, 0x50642e, 0x6a3058, 0x484848];

const settings = Object.assign({ sens: 1, fov: 80, vol: 0.7, name: '', loadout: 'assault', offMap: 'harbor', offBots: 5, offDiff: 'normal' },
  (() => { try { return JSON.parse(localStorage.getItem('frontline-settings')) || {}; } catch { return {}; } })());
function saveSettings() { try { localStorage.setItem('frontline-settings', JSON.stringify(settings)); } catch {} }

/* ============================ RENDERER ============================ */

const canvas = $('c');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.setSize(innerWidth, innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.autoClear = false;

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(settings.fov, innerWidth / innerHeight, 0.05, 600);
camera.rotation.order = 'YXZ';
scene.add(camera);

const vmScene = new THREE.Scene();
const vmCamera = new THREE.PerspectiveCamera(55, innerWidth / innerHeight, 0.01, 10);
vmScene.add(new THREE.HemisphereLight(0xdde6ff, 0x3a3530, 1.6));
const vmSun = new THREE.DirectionalLight(0xffffff, 2.2);
vmSun.position.set(1, 2, 1.5);
vmScene.add(vmSun);
const vmRoot = new THREE.Group();
vmScene.add(vmRoot);

const sun = new THREE.DirectionalLight(0xffffff, 3);
sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048);
sun.shadow.bias = -0.0004;
sun.shadow.normalBias = 0.03;
scene.add(sun, sun.target);
const hemi = new THREE.HemisphereLight(0xffffff, 0x444444, 1);
scene.add(hemi);
const muzzleLight = new THREE.PointLight(0xffb060, 0, 9, 2);
scene.add(muzzleLight);

const sky = new THREE.Mesh(new THREE.SphereGeometry(450, 32, 16), new THREE.ShaderMaterial({
  side: THREE.BackSide, depthWrite: false,
  uniforms: { top: { value: new THREE.Color() }, bottom: { value: new THREE.Color() } },
  vertexShader: 'varying vec3 vP; void main(){ vP = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
  fragmentShader: 'uniform vec3 top; uniform vec3 bottom; varying vec3 vP; void main(){ float h = clamp(vP.y * 1.4 + 0.08, 0.0, 1.0); gl_FragColor = vec4(mix(bottom, top, pow(h, 0.6)), 1.0);\n#include <tonemapping_fragment>\n#include <colorspace_fragment>\n}',
}));
sky.renderOrder = -1;
scene.add(sky);

addEventListener('resize', () => {
  renderer.setSize(innerWidth, innerHeight);
  camera.aspect = vmCamera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
  vmCamera.updateProjectionMatrix();
});

/* ============================ TEXTURES ============================ */

const maxAniso = renderer.capabilities.getMaxAnisotropy();
function canvasTex(size, draw) {
  const c = document.createElement('canvas');
  c.width = c.height = size;
  draw(c.getContext('2d'), size);
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = maxAniso;
  return t;
}
function grain(g, s, n, a) {
  for (let i = 0; i < n; i++) {
    const l = Math.random() < 0.5 ? 0 : 255;
    g.fillStyle = `rgba(${l},${l},${l},${Math.random() * a})`;
    const r = 0.5 + Math.random() * 2;
    g.fillRect(Math.random() * s, Math.random() * s, r, r);
  }
}
function blotch(g, s, n, rgb, a, maxR) {
  for (let i = 0; i < n; i++) {
    const x = Math.random() * s, y = Math.random() * s, r = maxR * (0.3 + Math.random() * 0.7);
    const gr = g.createRadialGradient(x, y, 0, x, y, r);
    gr.addColorStop(0, `rgba(${rgb},${a * Math.random()})`);
    gr.addColorStop(1, `rgba(${rgb},0)`);
    g.fillStyle = gr;
    g.fillRect(x - r, y - r, r * 2, r * 2);
  }
}
const TEX = {
  concrete: () => canvasTex(512, (g, s) => {
    g.fillStyle = '#8e8c87'; g.fillRect(0, 0, s, s);
    blotch(g, s, 40, '50,45,40', 0.2, 140); blotch(g, s, 20, '210,205,200', 0.12, 100); grain(g, s, 14000, 0.14);
    g.fillStyle = 'rgba(30,30,30,0.35)'; g.fillRect(0, 0, s, 3); g.fillRect(0, 0, 3, s);
  }),
  asphalt: () => canvasTex(512, (g, s) => {
    g.fillStyle = '#3e3f41'; g.fillRect(0, 0, s, s);
    grain(g, s, 30000, 0.25); blotch(g, s, 25, '15,15,15', 0.35, 120); blotch(g, s, 10, '120,110,90', 0.1, 90);
  }),
  sand: () => canvasTex(512, (g, s) => {
    g.fillStyle = '#c4a271'; g.fillRect(0, 0, s, s);
    blotch(g, s, 30, '150,115,70', 0.3, 130); blotch(g, s, 20, '235,210,165', 0.25, 110);
    g.strokeStyle = 'rgba(120,90,50,0.12)'; g.lineWidth = 3;
    for (let y = 0; y < s; y += 22) { g.beginPath(); for (let x = 0; x <= s; x += 16) g.lineTo(x, y + Math.sin((x / s) * Math.PI * 4) * 5); g.stroke(); }
    grain(g, s, 20000, 0.18);
  }),
  plaster: () => canvasTex(512, (g, s) => {
    g.fillStyle = '#cdb690'; g.fillRect(0, 0, s, s);
    blotch(g, s, 35, '150,115,75', 0.25, 120); blotch(g, s, 15, '240,225,195', 0.3, 90); grain(g, s, 12000, 0.12);
    g.strokeStyle = 'rgba(90,70,45,0.35)'; g.lineWidth = 1.2;
    for (let i = 0; i < 6; i++) { let x = Math.random() * s, y = Math.random() * s; g.beginPath(); g.moveTo(x, y); for (let j = 0; j < 8; j++) { x += rand(-18, 18); y += rand(4, 16); g.lineTo(x, y); } g.stroke(); }
  }),
  brick: () => canvasTex(512, (g, s) => {
    g.fillStyle = '#4a433d'; g.fillRect(0, 0, s, s);
    const bw = 64, bh = 28;
    for (let row = 0; row < s / bh + 1; row++) for (let col = -1; col < s / bw + 1; col++) {
      const x = col * bw + (row % 2) * bw / 2, y = row * bh;
      const r = 110 + Math.random() * 40, gg = 50 + Math.random() * 20, b = 38 + Math.random() * 15;
      g.fillStyle = `rgb(${r},${gg},${b})`; g.fillRect(x + 2, y + 2, bw - 4, bh - 4);
    }
    blotch(g, s, 25, '20,15,10', 0.3, 100); grain(g, s, 12000, 0.15);
  }),
  metal: () => canvasTex(512, (g, s) => {
    g.fillStyle = '#5c6167'; g.fillRect(0, 0, s, s);
    for (let y = 0; y < s; y += 2) { g.fillStyle = `rgba(255,255,255,${Math.random() * 0.05})`; g.fillRect(0, y, s, 1); }
    g.fillStyle = 'rgba(0,0,0,0.4)'; for (let i = 0; i < s; i += 128) { g.fillRect(i, 0, 3, s); g.fillRect(0, i, s, 3); }
    g.fillStyle = 'rgba(200,200,200,0.4)'; for (let x = 12; x < s; x += 128) for (let y = 12; y < s; y += 128) { g.beginPath(); g.arc(x, y, 3, 0, 7); g.fill(); }
    blotch(g, s, 20, '80,50,30', 0.25, 70); grain(g, s, 6000, 0.1);
  }),
  rack: () => canvasTex(512, (g, s) => {
    g.fillStyle = '#1e2124'; g.fillRect(0, 0, s, s);
    const shelves = 3, sh = s / shelves;
    for (let i = 0; i < shelves; i++) {
      let x = 10;
      while (x < s - 40) {
        const w = rand(50, 120), h = rand(sh * 0.4, sh * 0.85);
        const c = Math.random() < 0.7 ? `hsl(${rand(25, 38)},${rand(30, 50)}%,${rand(35, 55)}%)` : `hsl(${rand(190, 220)},45%,35%)`;
        g.fillStyle = c; g.fillRect(x, (i + 1) * sh - 14 - h, w, h);
        g.fillStyle = 'rgba(0,0,0,0.25)'; g.fillRect(x, (i + 1) * sh - 14 - h, w, 4);
        x += w + rand(4, 16);
      }
      g.fillStyle = '#d06a20'; g.fillRect(0, (i + 1) * sh - 14, s, 14);
    }
    g.fillStyle = '#2b5c9a'; g.fillRect(0, 0, 14, s); g.fillRect(s - 14, 0, 14, s);
    grain(g, s, 6000, 0.12);
  }),
  crate: () => canvasTex(256, (g, s) => {
    g.fillStyle = '#9a7446'; g.fillRect(0, 0, s, s);
    for (let i = 0; i < 6; i++) {
      g.fillStyle = `rgba(${Math.random() < 0.5 ? 60 : 150},${Math.random() < 0.5 ? 40 : 105},20,0.25)`; g.fillRect(0, i * s / 6, s, s / 6 - 2);
      g.fillStyle = 'rgba(40,25,10,0.6)'; g.fillRect(0, (i + 1) * s / 6 - 2, s, 2);
    }
    grain(g, s, 3000, 0.15);
    const b = 22; g.fillStyle = '#76522c';
    g.fillRect(0, 0, s, b); g.fillRect(0, s - b, s, b); g.fillRect(0, 0, b, s); g.fillRect(s - b, 0, b, s);
    g.save(); g.translate(s / 2, s / 2); g.rotate(Math.PI / 4); g.fillRect(-s * 0.68, -b / 2, s * 1.36, b); g.restore();
    g.strokeStyle = 'rgba(30,18,8,0.7)'; g.lineWidth = 2; g.strokeRect(b, b, s - 2 * b, s - 2 * b); g.strokeRect(1, 1, s - 2, s - 2);
  }),
  wood: () => canvasTex(256, (g, s) => {
    g.fillStyle = '#7d5a36'; g.fillRect(0, 0, s, s);
    for (let x = 0; x < s; x += 32) { g.fillStyle = `rgba(${Math.random() < 0.5 ? 40 : 150},${Math.random() < 0.5 ? 25 : 100},10,0.3)`; g.fillRect(x, 0, 30, s); g.fillStyle = 'rgba(30,18,8,0.7)'; g.fillRect(x + 30, 0, 2, s); }
    grain(g, s, 3000, 0.15);
  }),
  roof: () => canvasTex(256, (g, s) => { g.fillStyle = '#5a524b'; g.fillRect(0, 0, s, s); blotch(g, s, 15, '20,20,20', 0.3, 60); grain(g, s, 6000, 0.2); }),
  hazard: () => canvasTex(128, (g, s) => {
    g.fillStyle = '#d9a520'; g.fillRect(0, 0, s, s); g.fillStyle = '#1a1a1a';
    for (let i = -s; i < s * 2; i += 32) { g.beginPath(); g.moveTo(i, 0); g.lineTo(i + 16, 0); g.lineTo(i + 16 - s, s); g.lineTo(i - s, s); g.fill(); }
    grain(g, s, 1500, 0.2);
  }),
  paint_y: () => canvasTex(256, (g, s) => { g.fillStyle = '#d4a017'; g.fillRect(0, 0, s, s); blotch(g, s, 20, '70,50,20', 0.35, 40); grain(g, s, 4000, 0.15); }),
  sandbag: () => canvasTex(256, (g, s) => {
    g.fillStyle = '#6e6046'; g.fillRect(0, 0, s, s);
    const bw = 64, bh = 32;
    for (let r = 0; r < s / bh; r++) for (let c = -1; c < s / bw + 1; c++) {
      const x = c * bw + (r % 2) * bw / 2, y = r * bh;
      g.fillStyle = `hsl(42,${rand(20, 30)}%,${rand(42, 52)}%)`;
      g.beginPath(); g.roundRect(x + 2, y + 2, bw - 4, bh - 4, 12); g.fill();
    }
    grain(g, s, 4000, 0.2);
  }),
  cloth_r: () => canvasTex(128, (g, s) => { for (let x = 0; x < s; x += 32) { g.fillStyle = '#8c2a22'; g.fillRect(x, 0, 16, s); g.fillStyle = '#d8c9a8'; g.fillRect(x + 16, 0, 16, s); } grain(g, s, 1500, 0.2); }),
  cloth_b: () => canvasTex(128, (g, s) => { for (let x = 0; x < s; x += 32) { g.fillStyle = '#2a4e7c'; g.fillRect(x, 0, 16, s); g.fillStyle = '#d8c9a8'; g.fillRect(x + 16, 0, 16, s); } grain(g, s, 1500, 0.2); }),
};
function containerTex(hex) {
  return () => canvasTex(512, (g, s) => {
    g.fillStyle = hex; g.fillRect(0, 0, s, s);
    const step = s / 10;
    for (let x = 0; x < s; x += step) {
      g.fillStyle = 'rgba(255,255,255,0.10)'; g.fillRect(x, 0, step * 0.45, s);
      g.fillStyle = 'rgba(0,0,0,0.25)'; g.fillRect(x + step * 0.45, 0, step * 0.12, s);
      g.fillStyle = 'rgba(0,0,0,0.08)'; g.fillRect(x + step * 0.57, 0, step * 0.43, s);
    }
    blotch(g, s, 25, '90,50,25', 0.4, 50); blotch(g, s, 15, '40,30,20', 0.3, 80); grain(g, s, 8000, 0.12);
  });
}

const MATDEFS = {
  concrete: { tex: TEX.concrete, ts: 4, rough: 0.95, surf: 'dust' },
  asphalt:  { tex: TEX.asphalt, ts: 7, rough: 1, surf: 'dust' },
  sand:     { tex: TEX.sand, ts: 8, rough: 1, surf: 'sand' },
  plaster:  { tex: TEX.plaster, ts: 3, rough: 0.95, surf: 'sand' },
  brick:    { tex: TEX.brick, ts: 2.5, rough: 0.9, surf: 'dust' },
  metal:    { tex: TEX.metal, ts: 2, rough: 0.55, metal: 0.35, surf: 'metal' },
  rack:     { tex: TEX.rack, ts: 3.8, rough: 0.8, surf: 'wood' },
  crate:    { tex: TEX.crate, ts: 1.2, rough: 0.9, surf: 'wood' },
  wood:     { tex: TEX.wood, ts: 2, rough: 0.9, surf: 'wood' },
  roof:     { tex: TEX.roof, ts: 3, rough: 1, surf: 'dust' },
  hazard:   { tex: TEX.hazard, ts: 1, rough: 0.8, surf: 'metal' },
  paint_y:  { tex: TEX.paint_y, ts: 2, rough: 0.6, metal: 0.25, surf: 'metal' },
  sandbag:  { tex: TEX.sandbag, ts: 1, rough: 1, surf: 'sand' },
  cloth_r:  { tex: TEX.cloth_r, ts: 1.5, rough: 1, surf: 'wood' },
  cloth_b:  { tex: TEX.cloth_b, ts: 1.5, rough: 1, surf: 'wood' },
  lamp:     { color: 0xfff2cc, emissive: 0xffe6a8, ei: 4, surf: 'metal' },
  cont_red:    { tex: containerTex('#8f2a1f'), ts: 2.6, rough: 0.65, metal: 0.25, surf: 'metal' },
  cont_blue:   { tex: containerTex('#24467a'), ts: 2.6, rough: 0.65, metal: 0.25, surf: 'metal' },
  cont_green:  { tex: containerTex('#2f5e3a'), ts: 2.6, rough: 0.65, metal: 0.25, surf: 'metal' },
  cont_orange: { tex: containerTex('#b8611f'), ts: 2.6, rough: 0.65, metal: 0.25, surf: 'metal' },
  cont_gray:   { tex: containerTex('#6b6f73'), ts: 2.6, rough: 0.65, metal: 0.25, surf: 'metal' },
  cont_white:  { tex: containerTex('#b9b5aa'), ts: 2.6, rough: 0.65, metal: 0.25, surf: 'metal' },
};
const MATS = {};
function mat(key) {
  if (MATS[key]) return MATS[key];
  const d = MATDEFS[key];
  const m = new THREE.MeshStandardMaterial({
    map: d.tex ? d.tex() : null, color: d.color ?? 0xffffff, roughness: d.rough ?? 0.9, metalness: d.metal ?? 0,
    emissive: d.emissive ?? 0x000000, emissiveIntensity: d.ei ?? 1,
  });
  m.userData.ts = d.ts || 1;
  m.userData.surf = d.surf || 'dust';
  return (MATS[key] = m);
}

// Box geometry whose UVs tile in world units so textures keep a consistent scale.
function boxGeo(w, h, d, ts) {
  const g = new THREE.BoxGeometry(w, h, d);
  const uv = g.attributes.uv;
  const dims = [[d, h], [d, h], [w, d], [w, d], [w, h], [w, h]];
  for (let f = 0; f < 6; f++) for (let i = 0; i < 4; i++) {
    const k = f * 4 + i;
    uv.setXY(k, uv.getX(k) * dims[f][0] / ts, uv.getY(k) * dims[f][1] / ts);
  }
  return g;
}

/* ============================== MAPS ============================== */

function mulberry32(a) {
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

class Builder {
  constructor(group) { this.group = group; this.colliders = []; this.meshes = []; }
  box(x, y, z, w, h, d, m, o = {}) {
    const material = mat(m);
    const mesh = new THREE.Mesh(boxGeo(w, h, d, o.ts || material.userData.ts), material);
    mesh.position.set(x, y + h / 2, z);
    mesh.castShadow = o.shadow !== false;
    mesh.receiveShadow = true;
    mesh.userData.surf = material.userData.surf;
    this.group.add(mesh);
    if (o.ray !== false) this.meshes.push(mesh);
    if (o.collide !== false) this.colliders.push(new THREE.Box3(new V3(x - w / 2, y, z - d / 2), new V3(x + w / 2, y + h, z + d / 2)));
    return mesh;
  }
  ground(m, size) { this.box(0, -1, 0, size, 1, size, m, { collide: false, shadow: false }); }
  perimeter(half, h, m) {
    const t = 1.2;
    this.box(0, 0, -half - t / 2, 2 * half + 2 * t, h, t, m);
    this.box(0, 0, half + t / 2, 2 * half + 2 * t, h, t, m);
    this.box(-half - t / 2, 0, 0, t, h, 2 * half, m);
    this.box(half + t / 2, 0, 0, t, h, 2 * half, m);
  }
  container(x, z, rot, color, level = 0) {
    const L = 6.06, H = 2.59, W = 2.44;
    const [w, d] = rot ? [W, L] : [L, W];
    this.box(x, level * H, z, w, H, d, 'cont_' + color);
  }
  crate(x, z, s, stack = 1, y = 0) { for (let i = 0; i < stack; i++) this.box(x, y + i * s, z, s, s, s, 'crate', { ts: s }); }
  barrel(x, z, color = 0x2f5a8a) {
    const mesh = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.3, 0.9, 14), new THREE.MeshStandardMaterial({ color, roughness: 0.5, metalness: 0.3 }));
    mesh.position.set(x, 0.45, z); mesh.castShadow = mesh.receiveShadow = true; mesh.userData.surf = 'metal';
    this.group.add(mesh); this.meshes.push(mesh);
    this.colliders.push(new THREE.Box3(new V3(x - 0.3, 0, z - 0.3), new V3(x + 0.3, 0.9, z + 0.3)));
  }
  wall(x0, z0, x1, z1, h, t, m, door) {
    const alongX = Math.abs(x1 - x0) > Math.abs(z1 - z0);
    const len = alongX ? Math.abs(x1 - x0) : Math.abs(z1 - z0);
    const cx = (x0 + x1) / 2, cz = (z0 + z1) / 2, c0 = alongX ? cx : cz;
    const seg = (c, l, y, hh) => (alongX ? this.box(c, y, cz, l, hh, t, m) : this.box(cx, y, c, t, hh, l, m));
    if (!door) { seg(c0, len, 0, h); return; }
    const DW = 1.8, DH = 2.5, side = (len - DW) / 2;
    seg(c0 - len / 2 + side / 2, side, 0, h);
    seg(c0 + len / 2 - side / 2, side, 0, h);
    if (h > DH) seg(c0, DW, DH, h - DH);
  }
  building(x, z, w, d, h, doors, m = 'plaster', roof = 'roof') {
    const t = 0.35, hw = w / 2, hd = d / 2;
    this.wall(x - hw, z - hd + t / 2, x + hw, z - hd + t / 2, h, t, m, doors.includes('n'));
    this.wall(x - hw, z + hd - t / 2, x + hw, z + hd - t / 2, h, t, m, doors.includes('s'));
    this.wall(x - hw + t / 2, z - hd + t, x - hw + t / 2, z + hd - t, h, t, m, doors.includes('w'));
    this.wall(x + hw - t / 2, z - hd + t, x + hw - t / 2, z + hd - t, h, t, m, doors.includes('e'));
    this.box(x, h, z, w + 0.4, 0.3, d + 0.4, roof);
    this.box(x, h + 0.3, z - hd - 0.1, w + 0.4, 0.4, 0.2, m);
    this.box(x, h + 0.3, z + hd + 0.1, w + 0.4, 0.4, 0.2, m);
  }
  // Steps descending outward from (x,z) in direction (dx,dz).
  stairs(x, z, dx, dz, width, height, m) {
    const n = Math.ceil(height / 0.3), sd = 0.42;
    for (let k = 0; k < n; k++) {
      const hh = height * (n - k) / n, off = (k + 0.5) * sd;
      if (dx !== 0) this.box(x + dx * off, 0, z, sd, hh, width, m);
      else this.box(x, 0, z + dz * off, width, hh, sd, m);
    }
  }
  decal(x, z, w, d, m) { this.box(x, 0, z, w, 0.015, d, m, { collide: false, ray: false, shadow: false }); }
  lamp(x, z, h = 6) {
    this.box(x, 0, z, 0.18, h, 0.18, 'metal');
    this.box(x, h, z, 0.5, 0.18, 0.9, 'metal', { collide: false });
    this.box(x, h - 0.05, z, 0.35, 0.06, 0.7, 'lamp', { collide: false, ray: false, shadow: false });
  }
}

const MAPS = {
  harbor: {
    name: 'HARBOR', desc: 'Container yard • mid-range lanes', half: 44,
    env: { sky: [0x4f86c9, 0xd8e4ee], fog: [0xc4d2de, 50, 200], sun: [0xfff0d8, 3.2, [45, 70, 30]], hemi: [0xbcd4ff, 0x5c5244, 1.1], exposure: 1.0 },
    build(b) {
      const r = mulberry32(1337);
      b.ground('asphalt', 160);
      b.perimeter(44, 5, 'concrete');
      const colors = ['red', 'blue', 'green', 'orange', 'gray', 'white'];
      const pick = () => colors[Math.floor(r() * colors.length)];
      for (let gx = -4; gx <= 4; gx++) for (let gz = -4; gz <= 4; gz++) {
        if (Math.abs(gx) <= 1 && Math.abs(gz) <= 1 && !(gx === 0 && gz === 0) && r() < 0.5) continue;
        if (gx === 0 && gz === 0) continue;
        const x = gx * 9 + (r() - 0.5) * 2, z = gz * 9 + (r() - 0.5) * 2;
        const roll = r(), rot = r() < 0.5 ? 0 : 1;
        if (roll < 0.33) b.container(x, z, rot, pick());
        else if (roll < 0.53) { b.container(x, z, rot, pick()); b.container(x, z, rot, pick(), 1); }
        else if (roll < 0.68) {
          if (rot) { b.container(x - 1.25, z, 1, pick()); b.container(x + 1.25, z, 1, pick()); }
          else { b.container(x, z - 1.25, 0, pick()); b.container(x, z + 1.25, 0, pick()); }
        } else if (roll < 0.86) {
          b.crate(x, z, 1.3, 1 + Math.floor(r() * 2)); b.crate(x + 1.45, z + 0.2, 1.3); b.crate(x + 0.4, z - 1.5, 1.1);
        } else if (roll < 0.93) { b.barrel(x, z); b.barrel(x + 0.7, z + 0.2, 0x8a3a2a); b.barrel(x + 0.3, z + 0.8); }
      }
      // Crane landmark in the middle.
      for (const sx of [-5, 5]) for (const sz of [-3.5, 3.5]) b.box(sx, 0, sz, 0.8, 13, 0.8, 'paint_y');
      for (const sz of [-3.5, 3.5]) b.box(0, 13, sz, 12, 0.8, 1, 'paint_y');
      b.box(0, 13.8, 0, 2.2, 1.4, 8, 'paint_y');
      b.crate(-1.5, 0.5, 1.2); b.crate(1.8, -0.8, 1.2, 2);
      b.decal(0, 0, 14, 0.3, 'hazard'); b.decal(0, 0, 0.3, 10, 'hazard');
      for (const [x, z] of [[-40, -40], [40, -40], [-40, 40], [40, 40], [0, -40], [0, 40]]) b.lamp(x, z);
    },
  },
  dust: {
    name: 'DUST', desc: 'Desert town • streets & buildings', half: 48,
    env: { sky: [0x6f9ccf, 0xf2dcb4], fog: [0xe6d3b0, 45, 190], sun: [0xffe2b0, 3.6, [-50, 60, 20]], hemi: [0xd8e4f0, 0x8a6a44, 1.0], exposure: 1.0 },
    build(b) {
      const r = mulberry32(42);
      b.ground('sand', 170);
      b.perimeter(48, 7, 'plaster');
      const B = [
        [-32, -32, 13, 10, 4.2, 'se'], [-12, -34, 10, 8, 3.6, 'ns'], [10, -32, 14, 10, 4.6, 'ws'], [33, -31, 11, 12, 4, 'wn'],
        [-34, -8, 10, 14, 4, 'en'], [-14, -10, 8, 8, 3.5, 'ews'], [14, 10, 8, 8, 3.5, 'wne'], [34, 6, 10, 12, 4.4, 'ws'],
        [-32, 22, 12, 10, 4, 'ne'], [-10, 33, 12, 10, 4.2, 'sw'], [12, 32, 10, 10, 3.6, 'se'], [33, 31, 11, 11, 4, 'wn'],
      ];
      for (const [x, z, w, d, h, doors] of B) {
        b.building(x, z, w, d, h, doors.split(''));
        b.crate(x + w / 2 - 1.3, z - d / 2 + 1.3, 1.1);
        if (w > 9) b.crate(x - w / 2 + 1.3, z + d / 2 - 1.3, 1.1, 2);
      }
      // Market square
      b.box(0, 0, 0, 4.5, 0.8, 4.5, 'concrete');
      b.box(0, 0.8, 0, 1, 1.4, 1, 'concrete');
      for (const [x, z, cl] of [[-7, -7, 'cloth_r'], [7, -7, 'cloth_b'], [-7, 7, 'cloth_b'], [7, 7, 'cloth_r']]) {
        b.box(x, 0, z, 3, 1.1, 1.4, 'wood');
        for (const px of [-1.5, 1.5]) b.box(x + px, 0, z + (z > 0 ? -1 : 1), 0.1, 2.5, 0.1, 'wood');
        b.box(x, 2.5, z, 3.4, 0.06, 2.6, cl, { collide: false });
      }
      // Sandbag positions and low walls
      for (const [x, z, w, d] of [[-22, 0, 0.9, 4], [22, -2, 0.9, 4], [0, -20, 4, 0.9], [0, 20, 4, 0.9], [-24, -20, 3, 0.9], [24, 20, 3, 0.9]]) b.box(x, 0, z, w, 1, d, 'sandbag');
      for (const [x, z, w, d] of [[-22, 14, 6, 0.5], [22, -14, 6, 0.5], [-4, -26, 0.5, 6], [4, 24, 0.5, 6]]) b.box(x, 0, z, w, 1.2, d, 'plaster');
      for (let i = 0; i < 18; i++) {
        const x = (r() * 2 - 1) * 42, z = (r() * 2 - 1) * 42;
        if (Math.abs(x) < 9 && Math.abs(z) < 9) continue;
        if (b.colliders.some((c) => x + 1.5 > c.min.x && x - 1.5 < c.max.x && z + 1.5 > c.min.z && z - 1.5 < c.max.z)) continue;
        if (r() < 0.6) b.crate(x, z, 1.2, 1 + Math.floor(r() * 2)); else b.barrel(x, z, 0x7a5a30);
      }
    },
  },
  foundry: {
    name: 'FOUNDRY', desc: 'Warehouse at dusk • close quarters & raised deck', half: 38,
    env: { sky: [0x2e3a5a, 0xe08a4a], fog: [0x7a6050, 30, 150], sun: [0xffb070, 2.8, [-40, 38, -30]], hemi: [0x8090b0, 0x4a3a30, 1.0], exposure: 1.05 },
    build(b) {
      b.ground('concrete', 150);
      b.perimeter(38, 9, 'brick');
      // Central raised deck with stairs and railings
      b.box(0, 0, 0, 16, 3, 8, 'metal');
      b.box(0, 3, -3.95, 16, 1, 0.1, 'metal'); b.box(0, 3, 3.95, 16, 1, 0.1, 'metal');
      for (const x of [-7.95, 7.95]) { b.box(x, 3, -2.75, 0.1, 1, 2.5, 'metal'); b.box(x, 3, 2.75, 0.1, 1, 2.5, 'metal'); }
      b.stairs(8, 0, 1, 0, 3, 3, 'metal'); b.stairs(-8, 0, -1, 0, 3, 3, 'metal');
      b.decal(13, 0, 1, 3, 'hazard'); b.decal(-13, 0, 1, 3, 'hazard');
      // Storage racks
      for (const x of [-28, 28]) for (const z of [-26, -17, -8, 8, 17, 26]) b.box(x, 0, z, 1.6, 3.8, 6, 'rack');
      for (const z of [-31, 31]) for (const x of [-14, -5, 5, 14]) b.box(x, 0, z, 6, 3.8, 1.6, 'rack', { ts: 3.8 });
      // Pillars
      for (const x of [-18, 18]) for (const z of [-20, -8, 8, 20]) b.box(x, 0, z, 0.9, 9, 0.9, 'concrete');
      // Machinery
      b.box(-33, 0, 0, 4, 2.6, 7, 'metal'); b.box(33, 0, 0, 4, 2.6, 7, 'metal');
      b.box(-33, 2.6, 0, 2, 1.6, 3, 'paint_y'); b.box(33, 2.6, 0, 2, 1.6, 3, 'paint_y');
      // Cover clusters
      for (const [x, z] of [[-10, -14], [10, 14], [-10, 14], [10, -14], [0, -22], [0, 22], [-22, 0], [22, 0]]) {
        b.crate(x, z, 1.2, 2); b.crate(x + 1.3, z + 0.3, 1.2); b.barrel(x - 0.9, z + 1.1, 0x8a3a2a); b.barrel(x - 0.2, z + 1.4);
      }
      b.container(-12, -24, 0, 'gray'); b.container(12, 24, 0, 'orange');
      // Overhead beams
      for (const z of [-24, -12, 0, 12, 24]) b.box(0, 8.6, z, 76, 0.5, 0.4, 'metal', { collide: false });
      for (const x of [-18, 18]) b.box(x, 8.4, 0, 0.4, 0.4, 76, 'metal', { collide: false });
      for (const z of [-24, 0, 24]) for (const x of [-30, -10, 10, 30]) b.box(x, 8.1, z, 0.6, 0.08, 1.6, 'lamp', { collide: false, ray: false, shadow: false });
    },
  },
};

let mapGroup = null, colliders = [], mapMeshes = [], spawns = [], navPts = [], currentMap = null, mapHalf = 44, radarImg = null;

function clearArea(x, z, r) {
  for (const b of colliders) if (x + r > b.min.x && x - r < b.max.x && z + r > b.min.z && z - r < b.max.z && b.min.y < 2 && b.max.y > 0.05) return false;
  return true;
}
function computeSpawns(half) {
  const r = mulberry32(99), pts = [];
  for (let i = 0; i < 1500 && pts.length < 250; i++) {
    const x = (r() * 2 - 1) * (half - 3), z = (r() * 2 - 1) * (half - 3);
    if (clearArea(x, z, 1.2)) pts.push(new V3(x, 0, z));
  }
  if (!pts.length) pts.push(new V3(0, 0, 0));
  navPts = pts;
  // Farthest-point sampling: the first N spawns are as spread out as possible.
  const out = [pts[0]];
  while (out.length < 20 && out.length < pts.length) {
    let best = null, bd = -1;
    for (const p of pts) { let d = Infinity; for (const o of out) d = Math.min(d, p.distanceToSquared(o)); if (d > bd) { bd = d; best = p; } }
    out.push(best);
  }
  return out;
}
function buildRadarImage(half) {
  const c = document.createElement('canvas'), S = 512, k = S / (2 * half);
  c.width = c.height = S;
  const g = c.getContext('2d');
  g.fillStyle = 'rgba(30,42,34,0.9)'; g.fillRect(0, 0, S, S);
  for (const b of colliders) {
    if (b.max.y < 0.6) continue;
    g.fillStyle = b.max.y > 2.2 ? 'rgba(170,190,170,0.9)' : 'rgba(110,130,110,0.8)';
    g.fillRect((b.min.x + half) * k, (b.min.z + half) * k, (b.max.x - b.min.x) * k, (b.max.z - b.min.z) * k);
  }
  return c;
}

function loadMap(id) {
  if (mapGroup) {
    scene.remove(mapGroup);
    mapGroup.traverse((o) => { if (o.geometry) o.geometry.dispose(); });
  }
  const def = MAPS[id];
  mapGroup = new THREE.Group();
  scene.add(mapGroup);
  const b = new Builder(mapGroup);
  def.build(b);
  colliders = b.colliders;
  mapMeshes = b.meshes;
  mapHalf = def.half;
  const e = def.env;
  sky.material.uniforms.top.value.set(e.sky[0]);
  sky.material.uniforms.bottom.value.set(e.sky[1]);
  scene.fog = new THREE.Fog(e.fog[0], e.fog[1], e.fog[2]);
  sun.color.set(e.sun[0]); sun.intensity = e.sun[1]; sun.position.set(...e.sun[2]);
  const sc = sun.shadow.camera, ext = def.half + 8;
  sc.left = -ext; sc.right = ext; sc.top = ext; sc.bottom = -ext; sc.near = 1; sc.far = 250;
  sc.updateProjectionMatrix();
  hemi.color.set(e.hemi[0]); hemi.groundColor.set(e.hemi[1]); hemi.intensity = e.hemi[2];
  renderer.toneMappingExposure = e.exposure;
  spawns = computeSpawns(def.half);
  radarImg = buildRadarImage(def.half);
  currentMap = id;
  clearEffects();
  clearGrenades();
}

/* ============================== AUDIO ============================== */

let AC = null, master = null, noiseBuf = null;
function initAudio() {
  if (AC) { if (AC.state === 'suspended') AC.resume(); return; }
  AC = new (window.AudioContext || window.webkitAudioContext)();
  const comp = AC.createDynamicsCompressor();
  comp.connect(AC.destination);
  master = AC.createGain();
  master.gain.value = settings.vol;
  master.connect(comp);
  noiseBuf = AC.createBuffer(1, AC.sampleRate, AC.sampleRate);
  const d = noiseBuf.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
}
function outNode(vol, pan) {
  const g = AC.createGain();
  g.gain.value = vol;
  if (pan) { const p = AC.createStereoPanner(); p.pan.value = clamp(pan, -1, 1); g.connect(p); p.connect(master); } else g.connect(master);
  return g;
}
function playGun(snd, vol = 1, pan = 0, muffle = 1) {
  if (!AC || vol < 0.01) return;
  const t = AC.currentTime, out = outNode(vol, pan);
  const src = AC.createBufferSource();
  src.buffer = noiseBuf; src.playbackRate.value = rand(0.85, 1.05);
  const f = AC.createBiquadFilter();
  f.type = 'lowpass';
  f.frequency.setValueAtTime(snd.f * 1.6 * muffle, t);
  f.frequency.exponentialRampToValueAtTime(Math.max(80, snd.f * 0.25 * muffle), t + snd.d);
  const g = AC.createGain();
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(0.9, t + 0.003);
  g.gain.exponentialRampToValueAtTime(0.001, t + snd.d);
  src.connect(f); f.connect(g); g.connect(out);
  src.start(t, Math.random() * 0.5); src.stop(t + snd.d + 0.05);
  const o = AC.createOscillator(), og = AC.createGain();
  o.frequency.setValueAtTime(160, t); o.frequency.exponentialRampToValueAtTime(40, t + 0.12);
  og.gain.setValueAtTime(snd.thump * 0.7, t); og.gain.exponentialRampToValueAtTime(0.001, t + 0.16);
  o.connect(og); og.connect(out); o.start(t); o.stop(t + 0.17);
}
function playTone(freq, dur, vol = 0.2, type = 'square', delay = 0, endFreq) {
  if (!AC) return;
  const t = AC.currentTime + delay, o = AC.createOscillator(), g = AC.createGain();
  o.type = type; o.frequency.setValueAtTime(freq, t);
  if (endFreq) o.frequency.exponentialRampToValueAtTime(endFreq, t + dur);
  g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.001, t + dur);
  o.connect(g); g.connect(master); o.start(t); o.stop(t + dur + 0.02);
}
function playNoise(dur, freq, vol, delay = 0) {
  if (!AC) return;
  const t = AC.currentTime + delay, src = AC.createBufferSource(), f = AC.createBiquadFilter(), g = AC.createGain();
  src.buffer = noiseBuf; f.type = 'bandpass'; f.frequency.value = freq; f.Q.value = 1.2;
  g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.001, t + dur);
  src.connect(f); f.connect(g); g.connect(master); src.start(t, Math.random() * 0.5); src.stop(t + dur + 0.02);
}
const sfx = {
  hit: () => playTone(2400, 0.05, 0.18, 'square'),
  head: () => { playTone(3000, 0.05, 0.2, 'square'); playTone(1500, 0.08, 0.15, 'triangle', 0.02); },
  kill: () => { playTone(880, 0.12, 0.2, 'triangle'); playTone(1320, 0.2, 0.2, 'triangle', 0.08); },
  hurt: () => playNoise(0.18, 300, 0.5),
  empty: () => playTone(900, 0.03, 0.15, 'square'),
  reload: (dur) => { playNoise(0.06, 2500, 0.4, dur * 0.25); playNoise(0.06, 1800, 0.45, dur * 0.65); playNoise(0.05, 3500, 0.35, dur * 0.92); },
  step: (hard) => playNoise(0.07, hard ? 500 : 350, 0.12),
  swap: () => playNoise(0.06, 2000, 0.25),
  bolt: () => { playNoise(0.05, 2800, 0.3, 0.35); playNoise(0.05, 2200, 0.3, 0.6); },
  boom: (dist, big) => {
    if (!AC) return;
    const t = AC.currentTime, vol = big ? 1.6 : 1.3 / (1 + dist / 12), dur = big ? 4 : 1.2;
    const src = AC.createBufferSource(), f = AC.createBiquadFilter(), g = AC.createGain();
    src.buffer = noiseBuf; src.loop = true;
    f.type = 'lowpass';
    f.frequency.setValueAtTime(big ? 1200 : 1600 / (1 + dist / 30), t);
    f.frequency.exponentialRampToValueAtTime(60, t + dur);
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    src.connect(f); f.connect(g); g.connect(master);
    src.start(t); src.stop(t + dur + 0.05);
    const o = AC.createOscillator(), og = AC.createGain();
    o.frequency.setValueAtTime(big ? 50 : 80, t);
    o.frequency.exponentialRampToValueAtTime(20, t + dur * 0.6);
    og.gain.setValueAtTime(vol * 0.9, t);
    og.gain.exponentialRampToValueAtTime(0.001, t + dur * 0.6);
    o.connect(og); og.connect(master);
    o.start(t); o.stop(t + dur);
  },
  smoke: (dist) => playNoise(1.6, 4000, 0.35 / (1 + dist / 10)),
  siren: () => playTone(520, 0.85, 0.12, 'sawtooth', 0, 980),
};

/* ============================= EFFECTS ============================= */

function radialTex(stops) {
  return canvasTex(64, (g, s) => {
    const gr = g.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 2);
    for (const [o, c] of stops) gr.addColorStop(o, c);
    g.fillStyle = gr; g.fillRect(0, 0, s, s);
  });
}
const flashTex = radialTex([[0, 'rgba(255,255,230,1)'], [0.25, 'rgba(255,200,90,0.9)'], [0.6, 'rgba(255,120,30,0.35)'], [1, 'rgba(255,80,0,0)']]);
const holeTex = radialTex([[0, 'rgba(10,10,10,1)'], [0.35, 'rgba(20,18,15,0.9)'], [0.6, 'rgba(40,35,30,0.4)'], [1, 'rgba(0,0,0,0)']]);

const MAXP = 600;
const pPos = new Float32Array(MAXP * 3), pCol = new Float32Array(MAXP * 3);
const pGeo = new THREE.BufferGeometry();
pGeo.setAttribute('position', new THREE.BufferAttribute(pPos, 3));
pGeo.setAttribute('color', new THREE.BufferAttribute(pCol, 3));
const particles = new THREE.Points(pGeo, new THREE.PointsMaterial({ size: 0.06, vertexColors: true, transparent: true, depthWrite: false }));
particles.frustumCulled = false;
scene.add(particles);
const pData = Array.from({ length: MAXP }, () => ({ vx: 0, vy: 0, vz: 0, life: 0, g: 0 }));
let pIdx = 0;
for (let i = 0; i < MAXP; i++) pPos[i * 3 + 1] = -999;
const SURF_COLORS = { dust: [0.6, 0.58, 0.55], sand: [0.85, 0.72, 0.5], wood: [0.55, 0.4, 0.22], metal: [1, 0.8, 0.35], blood: [0.6, 0.04, 0.03] };
function emit(pos, normal, surf, n) {
  const c = SURF_COLORS[surf] || SURF_COLORS.dust, spark = surf === 'metal';
  for (let i = 0; i < n; i++) {
    const k = pIdx; pIdx = (pIdx + 1) % MAXP;
    const p = pData[k], sp = spark ? rand(3, 7) : rand(1, 3.5);
    p.vx = (normal.x + rand(-0.7, 0.7)) * sp; p.vy = (normal.y + rand(-0.3, 1)) * sp; p.vz = (normal.z + rand(-0.7, 0.7)) * sp;
    p.life = spark ? rand(0.15, 0.35) : rand(0.3, 0.7); p.g = spark ? 9 : 4;
    pPos[k * 3] = pos.x; pPos[k * 3 + 1] = pos.y; pPos[k * 3 + 2] = pos.z;
    const v = rand(0.8, 1.1);
    pCol[k * 3] = c[0] * v; pCol[k * 3 + 1] = c[1] * v; pCol[k * 3 + 2] = c[2] * v;
  }
  pGeo.attributes.color.needsUpdate = true;
}
function updateParticles(dt) {
  for (let i = 0; i < MAXP; i++) {
    const p = pData[i];
    if (p.life <= 0) continue;
    p.life -= dt;
    if (p.life <= 0) { pPos[i * 3 + 1] = -999; continue; }
    p.vy -= p.g * dt;
    pPos[i * 3] += p.vx * dt; pPos[i * 3 + 1] += p.vy * dt; pPos[i * 3 + 2] += p.vz * dt;
  }
  pGeo.attributes.position.needsUpdate = true;
}

const decals = [];
const decalGeo = new THREE.PlaneGeometry(0.11, 0.11);
const decalMat = new THREE.MeshBasicMaterial({ map: holeTex, transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -4 });
let decalIdx = 0;
function addDecal(point, normal) {
  let m = decals[decalIdx];
  if (!m) { m = new THREE.Mesh(decalGeo, decalMat); decals[decalIdx] = m; scene.add(m); }
  decalIdx = (decalIdx + 1) % 120;
  m.visible = true;
  m.position.copy(point).addScaledVector(normal, 0.01);
  m.lookAt(point.clone().add(normal));
  m.rotateZ(Math.random() * 6.28);
}

const tracers = [];
const tracerGeo = new THREE.CylinderGeometry(0.008, 0.008, 1, 4, 1, true).rotateX(Math.PI / 2).translate(0, 0, 0.5);
for (let i = 0; i < 40; i++) {
  const m = new THREE.Mesh(tracerGeo, new THREE.MeshBasicMaterial({ color: 0xffd890, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false }));
  m.visible = false; m.userData.life = 0; m.frustumCulled = false;
  scene.add(m); tracers.push(m);
}
let tracerIdx = 0;
function tracer(from, to) {
  const m = tracers[tracerIdx]; tracerIdx = (tracerIdx + 1) % tracers.length;
  const len = from.distanceTo(to);
  if (len < 1) return;
  m.position.copy(from); m.lookAt(to); m.scale.set(1, 1, len);
  m.visible = true; m.userData.life = 0.07; m.material.opacity = 0.9;
}
function updateTracers(dt) {
  for (const m of tracers) {
    if (!m.visible) continue;
    m.userData.life -= dt;
    m.material.opacity = Math.max(0, m.userData.life / 0.07) * 0.9;
    if (m.userData.life <= 0) m.visible = false;
  }
}
function clearEffects() {
  for (const d of decals) if (d) d.visible = false;
  for (const p of pData) p.life = 0;
  for (let i = 0; i < MAXP; i++) pPos[i * 3 + 1] = -999;
}

/* ============================ GUN MODELS ============================ */

const GUN_SPECS = {
  ar:     { recv: [0.06, 0.08, 0.36], hg: [0.058, 0.065, 0.26], barrel: 0.16, mag: 'stick', stock: 0.22, sight: 'dot', accent: 0x5b5040 },
  smg:    { recv: [0.055, 0.075, 0.26], hg: [0.05, 0.055, 0.12], barrel: 0.08, mag: 'stick', stock: 0.15, sight: 'dot', accent: 0x2a2c2f },
  lmg:    { recv: [0.08, 0.1, 0.42], hg: [0.07, 0.07, 0.3], barrel: 0.24, mag: 'box', stock: 0.24, sight: 'dot', accent: 0x4c5238, bipod: true },
  sniper: { recv: [0.06, 0.075, 0.44], hg: [0.055, 0.06, 0.34], barrel: 0.34, mag: 'small', stock: 0.28, sight: 'scope', accent: 0x3e4a34, bolt: true },
  dmr:    { recv: [0.06, 0.08, 0.38], hg: [0.056, 0.062, 0.28], barrel: 0.22, mag: 'small', stock: 0.24, sight: 'scope', accent: 0x6a5a40 },
};
const gunMetal = new THREE.MeshStandardMaterial({ color: 0x26282b, roughness: 0.45, metalness: 0.5 });
const gunPoly = new THREE.MeshStandardMaterial({ color: 0x1b1c1e, roughness: 0.8, metalness: 0.1 });
const sleeveMat = new THREE.MeshStandardMaterial({ color: 0x4a5236, roughness: 0.95 });
const gloveMat = new THREE.MeshStandardMaterial({ color: 0x24221f, roughness: 0.9 });
const lensMat = new THREE.MeshBasicMaterial({ color: 0xff3020 });
const glassMat = new THREE.MeshStandardMaterial({ color: 0x223344, roughness: 0.1, metalness: 0.8, transparent: true, opacity: 0.6 });

function part(g, w, h, d, x, y, z, m, rx = 0) {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m);
  mesh.position.set(x, y, z); mesh.rotation.x = rx; g.add(mesh); return mesh;
}
function cyl(g, r, len, x, y, z, m) {
  const mesh = new THREE.Mesh(new THREE.CylinderGeometry(r, r, len, 12).rotateX(Math.PI / 2), m);
  mesh.position.set(x, y, z); g.add(mesh); return mesh;
}
function addArms(g, rightHand, leftHand) {
  part(g, 0.06, 0.06, 0.07, ...rightHand, gloveMat);
  const ra = part(g, 0.075, 0.075, 0.34, rightHand[0] + 0.07, rightHand[1] - 0.07, rightHand[2] + 0.17, sleeveMat);
  ra.rotation.set(0.35, -0.35, 0);
  part(g, 0.06, 0.06, 0.08, ...leftHand, gloveMat);
  const la = part(g, 0.075, 0.075, 0.38, leftHand[0] - 0.1, leftHand[1] - 0.08, leftHand[2] + 0.16, sleeveMat);
  la.rotation.set(0.3, 0.6, 0);
}
function addFlash(g, z, y) {
  const muzzle = new THREE.Object3D(); muzzle.position.set(0, y, z); g.add(muzzle);
  const flash = new THREE.Sprite(new THREE.SpriteMaterial({ map: flashTex, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true }));
  flash.scale.set(0.22, 0.22, 1); flash.visible = false; muzzle.add(flash);
  g.userData.flash = flash;
}
function buildGun(id) {
  const def = WEAPONS[id], g = new THREE.Group();
  if (def.model === 'pistol') {
    part(g, 0.034, 0.04, 0.19, 0, 0.03, -0.07, gunMetal);
    part(g, 0.03, 0.03, 0.17, 0, 0.0, -0.06, gunPoly);
    part(g, 0.03, 0.11, 0.045, 0, -0.06, 0.0, gunPoly, -0.25);
    part(g, 0.006, 0.012, 0.01, 0, 0.056, -0.155, gunMetal);
    part(g, 0.02, 0.012, 0.01, 0, 0.056, 0.015, gunMetal);
    addArms(g, [0, -0.06, 0.02], [0, -0.08, 0.0]);
    addFlash(g, -0.18, 0.03);
    g.userData.sightY = 0.062; g.userData.adsZ = -0.3; g.userData.hip = new V3(0.14, -0.15, -0.34);
    return g;
  }
  const s = GUN_SPECS[def.model];
  const accent = new THREE.MeshStandardMaterial({ color: s.accent, roughness: 0.7, metalness: 0.15 });
  const [rw, rh, rl] = s.recv, [hw, hh, hl] = s.hg;
  const z0 = 0.1, recvEnd = z0 - rl, hgEnd = recvEnd - hl, barEnd = hgEnd - s.barrel;
  part(g, rw, rh, rl, 0, 0, z0 - rl / 2, gunMetal);
  part(g, rw * 0.7, 0.014, rl * 0.9, 0, rh / 2 + 0.007, z0 - rl / 2, gunMetal);
  part(g, hw, hh, hl, 0, 0.003, recvEnd - hl / 2, accent);
  cyl(g, 0.011, s.barrel, 0, 0.01, hgEnd - s.barrel / 2, gunMetal);
  cyl(g, 0.018, 0.05, 0, 0.01, barEnd - 0.02, gunMetal);
  part(g, 0.035, 0.1, 0.045, 0, -rh / 2 - 0.04, 0.04, gunPoly, -0.35);
  part(g, rw * 0.8, rh * 0.85, s.stock, 0, -0.005, z0 + s.stock / 2, accent);
  part(g, rw * 0.85, rh * 1.3, 0.025, 0, -0.01, z0 + s.stock, gunPoly);
  const magZ = z0 - rl * 0.55;
  if (s.mag === 'stick') part(g, 0.045, 0.16, 0.07, 0, -rh / 2 - 0.07, magZ, gunPoly, 0.22);
  else if (s.mag === 'box') { part(g, 0.1, 0.12, 0.12, 0.02, -rh / 2 - 0.06, magZ, accent); part(g, 0.03, 0.02, 0.08, -0.05, rh / 2 - 0.01, magZ, gunMetal); }
  else part(g, 0.045, 0.07, 0.08, 0, -rh / 2 - 0.035, magZ, gunPoly);
  if (s.bipod) { part(g, 0.012, 0.012, 0.12, 0.025, -0.04, hgEnd + 0.06, gunMetal, 0.3); part(g, 0.012, 0.012, 0.12, -0.025, -0.04, hgEnd + 0.06, gunMetal, 0.3); }
  if (s.bolt) { const k = part(g, 0.012, 0.012, 0.05, 0.05, 0.01, z0 - 0.08, gunMetal); k.rotation.y = 0.5; }
  const sightZ = z0 - rl * 0.45;
  if (s.sight === 'dot') {
    part(g, 0.04, 0.012, 0.07, 0, rh / 2 + 0.02, sightZ, gunMetal);
    part(g, 0.006, 0.05, 0.05, 0.017, rh / 2 + 0.045, sightZ, gunMetal);
    part(g, 0.006, 0.05, 0.05, -0.017, rh / 2 + 0.045, sightZ, gunMetal);
    part(g, 0.04, 0.008, 0.05, 0, rh / 2 + 0.07, sightZ, gunMetal);
    part(g, 0.004, 0.004, 0.001, 0, rh / 2 + 0.045, sightZ - 0.015, lensMat);
    g.userData.sightY = rh / 2 + 0.045;
  } else {
    cyl(g, 0.026, 0.3, 0, rh / 2 + 0.045, sightZ, gunMetal);
    cyl(g, 0.032, 0.06, 0, rh / 2 + 0.045, sightZ - 0.15, gunMetal);
    cyl(g, 0.03, 0.05, 0, rh / 2 + 0.045, sightZ + 0.14, gunMetal);
    part(g, 0.035, 0.03, 0.04, 0, rh / 2 + 0.012, sightZ - 0.06, gunMetal);
    part(g, 0.035, 0.03, 0.04, 0, rh / 2 + 0.012, sightZ + 0.06, gunMetal);
    const lens = new THREE.Mesh(new THREE.CircleGeometry(0.03, 16), glassMat); lens.position.set(0, rh / 2 + 0.045, sightZ + 0.166); g.add(lens);
    g.userData.sightY = rh / 2 + 0.045;
  }
  addArms(g, [0, -rh / 2 - 0.05, 0.05], [0, -0.04, recvEnd - hl * 0.5]);
  addFlash(g, barEnd - 0.05, 0.01);
  g.userData.adsZ = -0.2 - (sightZ - 0.0) * 0.4;
  g.userData.hip = new V3(0.17, -0.17, -0.36);
  return g;
}
const vmModels = {};
for (const id of Object.keys(WEAPONS)) { vmModels[id] = buildGun(id); vmModels[id].visible = false; vmRoot.add(vmModels[id]); }

/* ========================== REMOTE PLAYERS ========================== */

const remotes = new Map();
const playersGroup = new THREE.Group();
scene.add(playersGroup);

function makeNameTag(name) {
  const c = document.createElement('canvas'); c.width = 256; c.height = 64;
  const g = c.getContext('2d');
  g.font = '700 36px Rajdhani, Arial, sans-serif'; g.textAlign = 'center';
  g.fillStyle = 'rgba(0,0,0,0.6)'; g.fillText(name, 129, 44);
  g.fillStyle = '#ff6a55'; g.fillText(name, 128, 42);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: t, transparent: true, depthWrite: false }));
  s.scale.set(1.3, 0.33, 1);
  return s;
}
function makeSoldier(color) {
  const g = new THREE.Group();
  g.rotation.order = 'YXZ';
  const cloth = new THREE.MeshStandardMaterial({ color, roughness: 0.92 });
  const dark = new THREE.MeshStandardMaterial({ color: 0x2b2e29, roughness: 0.85 });
  const skin = new THREE.MeshStandardMaterial({ color: 0xc09676, roughness: 0.8 });
  const box = (w, h, d, m) => { const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m); mesh.castShadow = true; return mesh; };
  const hips = new THREE.Group(); hips.position.y = 0.9; g.add(hips);
  const legL = box(0.2, 0.9, 0.24, dark); legL.geometry.translate(0, -0.45, 0); legL.position.x = -0.13; hips.add(legL);
  const legR = box(0.2, 0.9, 0.24, dark); legR.geometry.translate(0, -0.45, 0); legR.position.x = 0.13; hips.add(legR);
  const torso = new THREE.Group(); torso.position.y = 0.9; g.add(torso);
  const chest = box(0.52, 0.62, 0.3, cloth); chest.position.y = 0.33; torso.add(chest);
  const vest = box(0.56, 0.42, 0.36, dark); vest.position.y = 0.38; torso.add(vest);
  const pack = box(0.4, 0.4, 0.14, cloth); pack.position.set(0, 0.36, 0.24); torso.add(pack);
  const headG = new THREE.Group(); headG.position.y = 0.72; torso.add(headG);
  const head = box(0.26, 0.28, 0.27, skin); head.position.y = 0.12; headG.add(head);
  const helmet = box(0.32, 0.14, 0.34, cloth); helmet.position.y = 0.28; headG.add(helmet);
  const visor = box(0.24, 0.05, 0.02, new THREE.MeshStandardMaterial({ color: 0x111111, roughness: 0.3 })); visor.position.set(0, 0.15, -0.14); headG.add(visor);
  const arms = new THREE.Group(); arms.position.set(0, 0.55, 0); torso.add(arms);
  const armR = box(0.13, 0.13, 0.5, cloth); armR.position.set(0.24, -0.08, -0.18); arms.add(armR);
  const armL = box(0.13, 0.13, 0.5, cloth); armL.position.set(-0.18, -0.06, -0.26); armL.rotation.y = 0.4; arms.add(armL);
  const gun = box(0.08, 0.12, 0.8, new THREE.MeshStandardMaterial({ color: 0x1c1c1c, roughness: 0.5, metalness: 0.4 })); gun.position.set(0.1, 0, -0.5); arms.add(gun);
  const flash = new THREE.Sprite(new THREE.SpriteMaterial({ map: flashTex, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true }));
  flash.scale.set(0.5, 0.5, 1); flash.position.set(0.1, 0, -0.95); flash.visible = false; arms.add(flash);
  const hitboxes = [chest, vest, pack, legL, legR, head, helmet, armR, armL];
  for (const m of hitboxes) m.userData.part = 'body';
  legL.userData.part = legR.userData.part = 'leg';
  head.userData.part = helmet.userData.part = 'head';
  return { group: g, hips, torso, legL, legR, arms, headG, hitboxes, flash };
}
function ensureRemote(info) {
  if (info.id === myId) return null;
  let rp = remotes.get(info.id);
  if (!rp) {
    const s = makeSoldier(PLAYER_COLORS[info.id % PLAYER_COLORS.length]);
    s.group.visible = false;
    playersGroup.add(s.group);
    for (const m of s.hitboxes) m.userData.pid = info.id;
    rp = Object.assign(s, { id: info.id, name: info.name, target: new V3(), yaw: 0, tyaw: 0, pitch: 0, crouch: false, crouchT: 0, speed: 0, phase: 0, alive: false, deadT: -1, lastShot: -1e9, has: false, flashT: 0, tag: null });
    remotes.set(info.id, rp);
  }
  if (!rp.tag || rp.name !== info.name) {
    if (rp.tag) rp.group.remove(rp.tag);
    rp.name = info.name;
    rp.tag = makeNameTag(info.name); rp.tag.position.y = 2.2; rp.group.add(rp.tag);
  }
  return rp;
}
function removeRemote(id) {
  const rp = remotes.get(id);
  if (!rp) return;
  playersGroup.remove(rp.group);
  remotes.delete(id);
}
function setRemoteAlive(rp, alive) {
  rp.alive = alive;
  if (alive) { rp.has = false; rp.deadT = -1; rp.group.rotation.x = 0; rp.group.position.y = 0; rp.group.visible = false; }
  else rp.deadT = 0;
}
function updateRemotes(dt, now) {
  for (const rp of remotes.values()) {
    if (!rp.alive) {
      if (rp.deadT >= 0 && rp.group.visible) {
        rp.deadT += dt;
        rp.group.rotation.x = Math.min(1, rp.deadT / 0.45) * Math.PI / 2;
        if (rp.deadT > 2.5) rp.group.visible = false;
      }
      continue;
    }
    if (!rp.has) continue;
    rp.group.visible = true;
    const k = 1 - Math.exp(-16 * dt);
    rp.group.position.lerp(rp.target, k);
    let dy = rp.tyaw - rp.yaw;
    dy = Math.atan2(Math.sin(dy), Math.cos(dy));
    rp.yaw += dy * k;
    rp.group.rotation.y = rp.yaw;
    rp.phase += dt * rp.speed * 1.7;
    const sw = Math.sin(rp.phase) * 0.7 * Math.min(1, rp.speed / 5);
    rp.legL.rotation.x = sw; rp.legR.rotation.x = -sw;
    rp.crouchT = damp(rp.crouchT, rp.crouch ? 1 : 0, 12, dt);
    const hy = lerp(0.9, 0.55, rp.crouchT);
    rp.hips.position.y = hy; rp.torso.position.y = hy;
    rp.legL.scale.y = rp.legR.scale.y = lerp(1, 0.62, rp.crouchT);
    rp.arms.rotation.x = rp.pitch;
    rp.headG.rotation.x = rp.pitch * 0.6;
    if (rp.flashT > 0) { rp.flashT -= dt; rp.flash.visible = rp.flashT > 0; rp.flash.material.rotation = Math.random() * 6; }
    rp.tag.visible = rp.group.position.distanceTo(camera.position) < 70;
  }
}
function aliveHitboxes() {
  const arr = [];
  for (const rp of remotes.values()) if (rp.alive && rp.has && rp.group.visible) arr.push(...rp.hitboxes);
  return arr;
}

/* ============================= GRENADES ============================= */

const FRAG = { fuse: 5, radius: 7.5, maxDmg: 160 }; // explodes on impact; fuse is only a safety net
const SMOKE = { pop: 1.4, life: 13, radius: 5 };
const NUKE_KILLS = 20;
const grenades = [], smokes = [], booms = [];
const fragGeo = new THREE.SphereGeometry(0.07, 10, 8);
const smokeCanGeo = new THREE.CylinderGeometry(0.05, 0.05, 0.16, 10);
const fragMat = new THREE.MeshStandardMaterial({ color: 0x3a4a2a, roughness: 0.6, metalness: 0.3 });
const smokeCanMat = new THREE.MeshStandardMaterial({ color: 0x8a8f94, roughness: 0.5, metalness: 0.4 });
const smokeTex = radialTex([[0, 'rgba(225,225,225,0.95)'], [0.45, 'rgba(205,205,205,0.6)'], [1, 'rgba(190,190,190,0)']]);

function grenadeInSolid(p) {
  if (p.y < 0.07) return true;
  for (const b of colliders) {
    if (p.x > b.min.x - 0.07 && p.x < b.max.x + 0.07 && p.y > b.min.y - 0.07 && p.y < b.max.y + 0.07 && p.z > b.min.z - 0.07 && p.z < b.max.z + 0.07) return true;
  }
  return false;
}
function spawnGrenade(kind, owner, pos, vel) {
  const mesh = new THREE.Mesh(kind === 'frag' ? fragGeo : smokeCanGeo, kind === 'frag' ? fragMat : smokeCanMat);
  mesh.castShadow = true;
  mesh.position.copy(pos);
  scene.add(mesh);
  grenades.push({ kind, owner, pos: pos.clone(), vel: vel.clone(), t: 0, mesh, lastClink: 0 });
}
function explodeFrag(g) {
  const p = g.pos, up = new V3(0, 1, 0);
  const fl = new THREE.Sprite(new THREE.SpriteMaterial({ map: flashTex, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true }));
  fl.position.set(p.x, p.y + 0.5, p.z);
  fl.scale.set(5, 5, 1);
  scene.add(fl);
  booms.push({ s: fl, t: 0 });
  muzzleLight.position.set(p.x, p.y + 0.6, p.z);
  muzzleLight.intensity = 300;
  emit(p, up, 'dust', 45);
  emit(p, up, 'metal', 30);
  const dist = p.distanceTo(camera.position);
  sfx.boom(dist, false);
  if (dist < 16) P.shake = Math.max(P.shake, (1 - dist / 16) * 0.8);
  // Damage is worked out by whoever threw it (bots are owned by the offline match).
  const src = new V3(p.x, p.y + 0.3, p.z);
  if (g.owner === myId) {
    let hitSomeone = false;
    for (const rp of remotes.values()) {
      if (!rp.alive || !rp.has) continue;
      const chest = rp.group.position.clone().setY(rp.group.position.y + 1.0);
      const d = src.distanceTo(chest);
      if (d >= FRAG.radius || !segmentClear(src, chest)) continue;
      net.send({ t: 'hit', target: rp.id, dmg: Math.round(FRAG.maxDmg * (1 - d / FRAG.radius)), head: false, w: 'frag' });
      hitSomeone = true;
    }
    if (hitSomeone) { showHitmarker(false); sfx.hit(); }
  } else if (offline) offline.fragDamage(g.owner, src);
}
function popSmoke(g) {
  const sprites = [];
  for (let i = 0; i < 28; i++) {
    const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: smokeTex, color: 0xc4c7ca, transparent: true, depthWrite: false, opacity: 0 }));
    const a = Math.random() * Math.PI * 2, r = Math.sqrt(Math.random()) * SMOKE.radius * 0.75;
    s.position.set(g.pos.x + Math.cos(a) * r, rand(0.4, 3.2), g.pos.z + Math.sin(a) * r);
    s.userData.base = rand(3.5, 5.5);
    s.userData.spin = rand(-0.2, 0.2);
    scene.add(s);
    sprites.push(s);
  }
  smokes.push({ center: new V3(g.pos.x, 1.6, g.pos.z), t: 0, sprites });
  sfx.smoke(g.pos.distanceTo(camera.position));
}
// True when a sight line passes through an active smoke cloud.
function smokeBlocks(a, b) {
  const ab = new V3().subVectors(b, a), len2 = ab.lengthSq() || 1;
  for (const s of smokes) {
    if (s.t < 0.9 || s.t > SMOKE.life - 1.5) continue;
    const t = clamp(new V3().subVectors(s.center, a).dot(ab) / len2, 0, 1);
    if (a.clone().addScaledVector(ab, t).distanceTo(s.center) < SMOKE.radius * 0.85) return true;
  }
  return false;
}
// A frag that flies into anyone other than its thrower detonates on them.
function grenadeHitsPlayer(g) {
  const touches = (pos) => Math.hypot(g.pos.x - pos.x, g.pos.z - pos.z) < 0.45 && g.pos.y > pos.y && g.pos.y < pos.y + 1.9;
  if (g.owner !== myId && P.alive && touches(P.pos)) return true;
  for (const rp of remotes.values()) if (rp.id !== g.owner && rp.alive && rp.has && touches(rp.group.position)) return true;
  return false;
}
function updateGrenades(dt) {
  for (let i = grenades.length - 1; i >= 0; i--) {
    const g = grenades[i];
    g.t += dt;
    const steps = 3, h = dt / steps;
    for (let s = 0; s < steps && !g.impact; s++) {
      g.vel.y -= 20 * h;
      for (const a of ['x', 'y', 'z']) {
        const prev = g.pos[a];
        g.pos[a] += g.vel[a] * h;
        if (!grenadeInSolid(g.pos)) continue;
        g.pos[a] = prev;
        // Frags are impact grenades: they go off on the first surface they touch.
        if (g.kind === 'frag') { g.impact = true; break; }
        if (Math.abs(g.vel[a]) > 2.5 && g.t - g.lastClink > 0.15) {
          g.lastClink = g.t;
          const d = g.pos.distanceTo(camera.position);
          if (d < 25) playNoise(0.04, 2200, 0.25 / (1 + d / 5));
        }
        g.vel[a] *= -0.35;
        for (const o of ['x', 'y', 'z']) if (o !== a) g.vel[o] *= 0.75;
      }
    }
    if (g.kind === 'frag' && !g.impact) g.impact = grenadeHitsPlayer(g);
    g.mesh.position.copy(g.pos);
    g.mesh.rotation.x += g.vel.length() * dt * 3;
    if (g.impact || g.t >= (g.kind === 'frag' ? FRAG.fuse : SMOKE.pop)) {
      scene.remove(g.mesh);
      grenades.splice(i, 1);
      if (g.kind === 'frag') explodeFrag(g); else popSmoke(g);
    }
  }
  for (let i = smokes.length - 1; i >= 0; i--) {
    const s = smokes[i];
    s.t += dt;
    const grow = Math.min(1, s.t / 1.8), fade = s.t > SMOKE.life - 2.5 ? Math.max(0, (SMOKE.life - s.t) / 2.5) : 1;
    for (const sp of s.sprites) {
      const k = sp.userData.base * (0.3 + 0.7 * grow);
      sp.scale.set(k, k, 1);
      sp.material.opacity = 0.8 * grow * fade;
      sp.material.rotation += sp.userData.spin * dt;
    }
    if (s.t >= SMOKE.life) {
      for (const sp of s.sprites) { scene.remove(sp); sp.material.dispose(); }
      smokes.splice(i, 1);
    }
  }
  for (let i = booms.length - 1; i >= 0; i--) {
    const b = booms[i];
    b.t += dt;
    b.s.material.opacity = Math.max(0, 1 - b.t / 0.35);
    b.s.scale.setScalar(5 + b.t * 12);
    if (b.t > 0.35) { scene.remove(b.s); b.s.material.dispose(); booms.splice(i, 1); }
  }
}
function clearGrenades() {
  for (const g of grenades) scene.remove(g.mesh);
  for (const s of smokes) for (const sp of s.sprites) scene.remove(sp);
  for (const b of booms) scene.remove(b.s);
  grenades.length = smokes.length = booms.length = 0;
}

/* ============================== PLAYER ============================== */

const P = {
  pos: new V3(), vel: new V3(), yaw: 0, pitch: 0, grounded: false, crouch: false, crouchT: 0, slideT: 0, slideDir: new V3(),
  hp: 100, alive: false, loadout: settings.loadout, pendingLoadout: null, weapons: [], cur: 0, adsT: 0, sprintT: 0,
  reloadUntil: 0, reloadStart: 0, swapUntil: 0, nextFire: 0, wantShot: false, bloom: 0, kick: 0, camKick: 0,
  bobPhase: 0, stepDist: 0, viewY: 0, sprinting: false, jumpReady: 0, deathAt: 0, killerId: null, swayX: 0, swayY: 0,
  equip: { frag: 0, smoke: 0 }, throwReady: 0, throwUntil: 0, shake: 0,
};
if (!LOADOUTS[P.loadout]) P.loadout = 'assault';
const RADIUS = 0.38, GRAVITY = 22;
const curW = () => P.weapons[P.cur];
const heightNow = () => lerp(1.8, 1.15, P.crouchT);

function overlaps(x, y, z, h, b) {
  return x + RADIUS > b.min.x && x - RADIUS < b.max.x && z + RADIUS > b.min.z && z - RADIUS < b.max.z && y + h > b.min.y && y < b.max.y;
}
function freeAt(x, y, z, h) { for (const b of colliders) if (overlaps(x, y, z, h, b)) return false; return true; }
// Shared by the local player and bots: anything with pos, vel and grounded.
function moveAxis(e, axis, amount, h) {
  if (amount === 0) return;
  e.pos[axis] += amount;
  for (const b of colliders) {
    if (!overlaps(e.pos.x, e.pos.y, e.pos.z, h, b)) continue;
    const stepH = b.max.y - e.pos.y;
    if (stepH > 0 && stepH <= 0.5 && e.grounded && freeAt(e.pos.x, b.max.y + 0.001, e.pos.z, h)) { e.pos.y = b.max.y + 0.001; continue; }
    e.pos[axis] = amount > 0 ? b.min[axis] - RADIUS - 0.001 : b.max[axis] + RADIUS + 0.001;
    e.vel[axis] = 0;
  }
}
function physicsStep(e, h, dt) {
  moveAxis(e, 'x', e.vel.x * dt, h);
  moveAxis(e, 'z', e.vel.z * dt, h);
  e.vel.y -= GRAVITY * dt;
  e.pos.y += e.vel.y * dt;
  e.grounded = false;
  for (const b of colliders) {
    if (!overlaps(e.pos.x, e.pos.y, e.pos.z, h, b)) continue;
    if (e.vel.y <= 0) { e.pos.y = b.max.y; e.grounded = true; } else e.pos.y = b.min.y - h - 0.001;
    e.vel.y = 0;
  }
  if (e.pos.y <= 0) { e.pos.y = 0; e.vel.y = 0; e.grounded = true; }
  e.pos.x = clamp(e.pos.x, -mapHalf + RADIUS, mapHalf - RADIUS);
  e.pos.z = clamp(e.pos.z, -mapHalf + RADIUS, mapHalf - RADIUS);
}

function spawnMe(sp) {
  P.loadout = P.pendingLoadout || P.loadout;
  P.pendingLoadout = null;
  P.weapons = LOADOUTS[P.loadout].weapons.map((id) => ({ id, def: WEAPONS[id], mag: WEAPONS[id].mag, reserve: WEAPONS[id].reserve }));
  P.cur = 0; P.hp = 100; P.alive = true;
  P.pos.copy(sp); P.vel.set(0, 0, 0); P.viewY = sp.y;
  P.yaw = Math.atan2(sp.x, sp.z); P.pitch = 0;
  P.crouch = false; P.crouchT = 0; P.slideT = 0; P.adsT = 0; P.sprintT = 0;
  P.reloadUntil = 0; P.swapUntil = performance.now() + 400; P.wantShot = false; P.bloom = 0;
  P.equip = { frag: 2, smoke: 2 }; P.throwUntil = 0;
  showViewmodel();
  $('death').classList.add('hidden');
  sendState(true);
}
function bestSpawn() {
  const enemies = [...remotes.values()].filter((r) => r.alive && r.has).map((r) => r.group.position);
  if (!enemies.length) return spawns[Math.floor(Math.random() * spawns.length)];
  const scored = spawns.map((s) => ({ s, d: Math.min(...enemies.map((e) => e.distanceToSquared(s))) })).sort((a, b) => b.d - a.d);
  return scored[Math.floor(Math.random() * Math.min(3, scored.length))].s;
}
function showViewmodel() {
  for (const [id, m] of Object.entries(vmModels)) m.visible = P.alive && curW() && id === curW().id;
}

function swapTo(i, now) {
  if (!P.alive || i === P.cur || i < 0 || i >= P.weapons.length) return;
  P.cur = i; P.reloadUntil = 0; P.swapUntil = now + 450; P.adsT = Math.min(P.adsT, 0.3); P.wantShot = false;
  showViewmodel(); sfx.swap();
}
function startReload(now) {
  const w = curW();
  if (!w || P.reloadUntil || w.mag >= w.def.mag || w.reserve <= 0 || now < P.swapUntil) return;
  P.reloadStart = now; P.reloadUntil = now + w.def.reload * 1000;
  sfx.reload(w.def.reload);
}
function finishReload() {
  const w = curW(), take = Math.min(w.def.mag - w.mag, w.reserve);
  w.mag += take; w.reserve -= take; P.reloadUntil = 0;
}

function throwGrenade(kind, now) {
  if (!P.alive || now < P.throwReady || now < P.swapUntil) return;
  if (P.equip[kind] <= 0) { sfx.empty(); return; }
  P.equip[kind]--;
  P.throwReady = now + 900; P.throwUntil = now + 450; P.reloadUntil = 0; P.adsT = 0;
  camera.updateMatrixWorld();
  const dir = camera.getWorldDirection(new V3());
  const origin = camera.position.clone().addScaledVector(dir, 0.4);
  if (grenadeInSolid(origin)) origin.copy(camera.position);
  const vel = dir.multiplyScalar(kind === 'frag' ? 16 : 14).add(new V3(P.vel.x * 0.5, 3.5, P.vel.z * 0.5));
  spawnGrenade(kind, myId, origin, vel);
  const r2 = (v) => Math.round(v * 100) / 100;
  net.send({ t: 'throw', k: kind, p: [r2(origin.x), r2(origin.y), r2(origin.z)], v: [r2(vel.x), r2(vel.y), r2(vel.z)] });
  playNoise(0.12, 900, 0.3);
}

function toggleCrouch() {
  if (!P.alive) return;
  if (P.sprinting && P.grounded && P.slideT <= 0) {
    const sp = Math.hypot(P.vel.x, P.vel.z);
    if (sp > 5) { P.slideT = 0.75; P.slideDir.set(P.vel.x / sp, 0, P.vel.z / sp); P.crouch = true; playNoise(0.4, 600, 0.25); return; }
  }
  if (P.crouch) { if (freeAt(P.pos.x, P.pos.y, P.pos.z, 1.8)) P.crouch = false; }
  else P.crouch = true;
}

function updateMovement(dt, now, canMove) {
  const fwdIn = canMove ? (keys.has('KeyW') ? 1 : 0) - (keys.has('KeyS') ? 1 : 0) : 0;
  const strafe = canMove ? (keys.has('KeyD') ? 1 : 0) - (keys.has('KeyA') ? 1 : 0) : 0;
  const d = curW().def;
  const wantSprint = canMove && (keys.has('ShiftLeft') || keys.has('ShiftRight')) && fwdIn > 0 && !aiming() && !mouseL;
  if (wantSprint && P.crouch && P.slideT <= 0 && freeAt(P.pos.x, P.pos.y, P.pos.z, 1.8)) P.crouch = false;
  P.sprinting = wantSprint && !P.crouch;
  const sinY = Math.sin(P.yaw), cosY = Math.cos(P.yaw);
  let wx = -sinY * fwdIn + cosY * strafe, wz = -cosY * fwdIn - sinY * strafe;
  const len = Math.hypot(wx, wz);
  if (len > 0) { wx /= len; wz /= len; }
  let speed = P.sprinting ? 8.4 : P.crouch ? 3.0 : 5.6;
  speed *= d.move * lerp(1, 0.55, P.adsT);
  if (P.slideT > 0) {
    P.slideT -= dt;
    const s = 10.5 * Math.max(0, P.slideT / 0.75) + 2.5;
    P.vel.x = P.slideDir.x * s; P.vel.z = P.slideDir.z * s;
  } else {
    const accel = P.grounded ? 14 : 3;
    P.vel.x = damp(P.vel.x, wx * speed, accel, dt);
    P.vel.z = damp(P.vel.z, wz * speed, accel, dt);
  }
  if (canMove && keys.has('Space') && P.grounded && now > P.jumpReady) {
    if (P.crouch && freeAt(P.pos.x, P.pos.y, P.pos.z, 1.8)) P.crouch = false;
    if (!P.crouch) { P.vel.y = 7.2; P.grounded = false; P.slideT = 0; P.jumpReady = now + 300; }
  }
  P.crouchT = damp(P.crouchT, P.crouch || P.slideT > 0 ? 1 : 0, 14, dt);
  const h = heightNow();
  const wasGrounded = P.grounded;
  physicsStep(P, h, dt);
  if (P.grounded && !wasGrounded) sfx.step(true);
  P.viewY = P.pos.y > P.viewY ? damp(P.viewY, P.pos.y, 18, dt) : P.pos.y;
  const sp = Math.hypot(P.vel.x, P.vel.z);
  if (P.grounded && sp > 2 && P.slideT <= 0) {
    P.stepDist += sp * dt;
    if (P.stepDist > (P.sprinting ? 2.6 : 2.0)) { P.stepDist = 0; if (!P.crouch) sfx.step(false); }
  }
}

const raycaster = new THREE.Raycaster();
function muzzleWorld() {
  return new V3(0.16 * (1 - P.adsT), -0.12 * (1 - P.adsT) - 0.04, -0.9).applyMatrix4(camera.matrixWorld);
}
function fire(now) {
  const w = curW(), d = w.def;
  if (w.mag <= 0) { sfx.empty(); P.wantShot = false; startReload(now); return; }
  w.mag--;
  P.nextFire = now + 60000 / d.rpm;
  const moving = Math.hypot(P.vel.x, P.vel.z) > 1;
  let spread = lerp(d.hip, d.ads, P.adsT) * (moving ? 1.5 : 1) * (P.grounded ? 1 : 2.2) * (P.crouch ? 0.75 : 1);
  if (d.scope && P.adsT < 0.95) spread = Math.max(spread, d.hip * 0.8);
  spread += P.bloom * (1 - P.adsT);
  P.bloom = Math.min(P.bloom + d.recoil * 0.5, d.hip);

  camera.updateMatrixWorld();
  playersGroup.updateMatrixWorld(true);
  const origin = camera.getWorldPosition(new V3());
  const fwd = camera.getWorldDirection(new V3());
  const right = new V3().setFromMatrixColumn(camera.matrixWorld, 0);
  const up = new V3().setFromMatrixColumn(camera.matrixWorld, 1);
  const a = Math.random() * Math.PI * 2, r = Math.sqrt(Math.random()) * spread;
  const dir = fwd.addScaledVector(right, Math.cos(a) * r).addScaledVector(up, Math.sin(a) * r).normalize();
  raycaster.set(origin, dir);
  raycaster.far = 400;
  const hits = raycaster.intersectObjects(mapMeshes.concat(aliveHitboxes()), false);
  let end = origin.clone().addScaledVector(dir, 400);
  if (hits.length) {
    const h = hits[0], ud = h.object.userData;
    end = h.point;
    const back = dir.clone().negate();
    if (ud.pid) {
      let dmg = d.dmg * (h.distance > d.range ? 0.72 : 1);
      if (ud.part === 'head') dmg *= d.head; else if (ud.part === 'leg') dmg *= 0.85;
      net.send({ t: 'hit', target: ud.pid, dmg: Math.round(dmg), head: ud.part === 'head', w: w.id });
      showHitmarker(false);
      if (ud.part === 'head') sfx.head(); else sfx.hit();
      emit(h.point, back, 'blood', 10);
    } else {
      const n = h.face ? h.face.normal.clone() : back;
      addDecal(h.point, n);
      emit(h.point, n, h.object.userData.surf, h.object.userData.surf === 'metal' ? 8 : 12);
    }
  }
  const from = muzzleWorld();
  tracer(from, end);
  const r2 = (v) => Math.round(v * 100) / 100;
  net.send({ t: 'shot', f: [r2(from.x), r2(from.y), r2(from.z)], e: [r2(end.x), r2(end.y), r2(end.z)], w: w.id });

  const rk = d.recoil * (1 - 0.4 * P.adsT) * (P.crouch ? 0.8 : 1);
  P.pitch = clamp(P.pitch + rk * rand(0.8, 1.2), -1.5, 1.5);
  P.yaw += rk * rand(-0.5, 0.5);
  P.camKick += rk * 0.6;
  P.kick = Math.min(P.kick + d.kick, 0.35);
  playGun(d.snd, 0.55);
  const fl = vmModels[w.id].userData.flash;
  fl.visible = true; fl.material.rotation = Math.random() * 6; fl.userData.t = 0.045;
  muzzleLight.position.copy(from); muzzleLight.intensity = 12;
  if (d.bolt) sfx.bolt();
  if (w.mag === 0 && w.reserve > 0) setTimeout(() => { if (P.alive && curW() === w) startReload(performance.now()); }, 220);
}

function updateWeapon(dt, now, canMove) {
  const w = curW(), d = w.def;
  const adsWanted = aiming() && canMove && !P.sprinting && now >= P.swapUntil;
  P.adsT = clamp(P.adsT + (adsWanted ? 1 : -1) * dt / d.adsTime, 0, 1);
  P.sprintT = damp(P.sprintT, P.sprinting ? 1 : 0, 10, dt);
  if (P.reloadUntil && now >= P.reloadUntil) finishReload();
  const triggering = d.auto ? mouseL : P.wantShot;
  if (triggering && canMove && now >= P.nextFire && !P.reloadUntil && now >= P.swapUntil && now >= P.throwUntil && P.sprintT < 0.35) {
    fire(now);
    if (!d.auto) P.wantShot = false;
  }
  P.bloom = damp(P.bloom, 0, 5, dt);
  P.kick = damp(P.kick, 0, 14, dt);
  P.camKick = damp(P.camKick, 0, 9, dt);
  const fl = vmModels[w.id].userData.flash;
  if (fl.visible) { fl.userData.t -= dt; if (fl.userData.t <= 0) fl.visible = false; }
  muzzleLight.intensity = damp(muzzleLight.intensity, 0, 40, dt);
}

const easeInOut = (t) => t * t * (3 - 2 * t);
function updateViewmodel(dt, now) {
  const w = curW(), m = vmModels[w.id], d = w.def;
  const a = easeInOut(P.adsT);
  const pos = m.userData.hip.clone().lerp(new V3(0, -m.userData.sightY, m.userData.adsZ), a);
  const sp = Math.hypot(P.vel.x, P.vel.z);
  const bobAmt = P.grounded ? Math.min(1, sp / 6) : 0;
  P.bobPhase += dt * sp * (P.sprinting ? 1.45 : 1.8);
  const ba = 1 - 0.85 * a;
  pos.x += Math.sin(P.bobPhase) * 0.012 * bobAmt * ba + P.swayX * ba;
  pos.y += -Math.abs(Math.cos(P.bobPhase)) * 0.014 * bobAmt * ba + P.swayY * ba;
  const rot = new THREE.Euler(0, 0, 0, 'YXZ');
  const s = P.sprintT;
  pos.x -= 0.06 * s; pos.y -= 0.04 * s; pos.z += 0.04 * s;
  rot.y += 0.65 * s; rot.x -= 0.2 * s; rot.z += 0.15 * s;
  if (P.reloadUntil) {
    const ph = clamp((now - P.reloadStart) / (P.reloadUntil - P.reloadStart), 0, 1), r = Math.sin(ph * Math.PI);
    pos.y -= 0.07 * r; rot.x -= 0.45 * r; rot.z += 0.4 * r;
  }
  if (now < P.swapUntil) { const r = (P.swapUntil - now) / 450; pos.y -= 0.3 * r; rot.x -= 0.7 * r; }
  if (now < P.throwUntil) { const r = Math.sin(((P.throwUntil - now) / 450) * Math.PI); pos.y -= 0.22 * r; pos.x -= 0.05 * r; rot.x -= 0.5 * r; rot.z -= 0.3 * r; }
  if (P.crouchT > 0.5 && P.slideT > 0) rot.z += 0.25;
  pos.z += P.kick * 0.25;
  rot.x += P.kick * 0.5;
  vmRoot.position.copy(pos);
  vmRoot.rotation.copy(rot);
  vmRoot.visible = !(d.scope && P.adsT > 0.85);
  P.swayX = damp(P.swayX, 0, 8, dt);
  P.swayY = damp(P.swayY, 0, 8, dt);
}

function updateCamera(dt, now) {
  const d = curW().def;
  const eye = lerp(1.62, 1.02, P.crouchT);
  const sp = Math.hypot(P.vel.x, P.vel.z);
  const bob = P.grounded && P.slideT <= 0 ? Math.sin(P.bobPhase * 2) * 0.035 * Math.min(1, sp / 6) * (1 - P.adsT) : 0;
  camera.position.set(P.pos.x, P.viewY + eye + bob, P.pos.z);
  let swayP = 0, swayYw = 0;
  if (d.scope && P.adsT > 0.85) {
    const steady = keys.has('ShiftLeft') ? 0.15 : 1, t = now / 1000;
    swayP = Math.sin(t * 1.3) * 0.004 * steady; swayYw = Math.cos(t * 0.9) * 0.005 * steady;
  }
  const sh = P.shake * 0.03;
  P.shake = damp(P.shake, 0, 3, dt);
  camera.rotation.set(P.pitch + P.camKick + swayP + rand(-sh, sh), P.yaw + swayYw + rand(-sh, sh), P.slideT > 0 ? 0.04 : 0);
  const fov = lerp(settings.fov, d.adsFov * (d.scope ? 1 : settings.fov / 80), easeInOut(P.adsT)) + P.sprintT * 4;
  if (Math.abs(camera.fov - fov) > 0.01) { camera.fov = fov; camera.updateProjectionMatrix(); }
}

/* ============================= NETWORK ============================= */

let ws = null, myId = null, room = null, clockOffset = 0, bestRtt = 1e9, pingTimer = null;
const net = { send(o) { if (offline) offline.handle(o); else if (ws && ws.readyState === 1) ws.send(JSON.stringify(o)); } };
const serverNow = () => Date.now() + clockOffset;

function connect() {
  if (ws && ws.readyState === 1) return Promise.resolve();
  return new Promise((resolve, reject) => {
    const proto = location.protocol === 'https:' ? 'wss' : 'ws';
    ws = new WebSocket(`${proto}://${location.host}`);
    ws.onopen = () => {
      bestRtt = 1e9;
      clearInterval(pingTimer);
      net.send({ t: 'ping', c: Date.now() });
      pingTimer = setInterval(() => net.send({ t: 'ping', c: Date.now() }), 2000);
      resolve();
    };
    ws.onerror = () => reject(new Error('Could not reach the game server'));
    ws.onclose = () => {
      clearInterval(pingTimer);
      if (myId !== null && !offline) { myId = null; room = null; goMenu('Lost connection to the server.'); }
    };
    ws.onmessage = (e) => onMsg(JSON.parse(e.data));
  });
}

let match = null, mapReady = false, pendingGo = null, respawnTimer = null, lastStateSent = 0, nukeState = null;

function callNuke() {
  if (!match || nukeState || (pInfo(myId)?.kills ?? 0) < NUKE_KILLS) return;
  net.send({ t: 'nuke' });
}
function detonateNuke() {
  if (!nukeState) nukeState = { by: null, at: serverNow(), lastBeep: -1, boomed: false };
  if (nukeState.boomed) return;
  nukeState.boomed = true;
  $('nuke').classList.add('hidden');
  const fl = $('nukeflash');
  fl.classList.remove('boom'); void fl.offsetWidth; fl.classList.add('boom');
  sfx.boom(0, true);
  P.shake = 2.5;
}
const pInfo = (id) => room?.players.find((p) => p.id === id);
const pName = (id) => (id === myId ? (pInfo(id)?.name || 'You') : (pInfo(id)?.name || remotes.get(id)?.name || '???'));

function onMsg(m) {
  const now = performance.now();
  switch (m.t) {
    case 'pong': {
      const rtt = Date.now() - m.c;
      if (rtt <= bestRtt + 15) { bestRtt = Math.min(bestRtt, rtt); clockOffset = m.s - (m.c + rtt / 2); }
      $('ping').textContent = `${rtt} ms`;
      break;
    }
    case 'welcome':
      myId = m.id;
      history.replaceState(null, '', `?code=${m.code}`);
      showScreen('lobby');
      break;
    case 'error':
      $('menuErr').textContent = m.msg;
      break;
    case 'lobby': {
      const prev = room;
      room = m;
      const ids = new Set(m.players.map((p) => p.id));
      for (const id of [...remotes.keys()]) if (!ids.has(id)) removeRemote(id);
      for (const p of m.players) ensureRemote(p);
      if (ui === 'lobby') renderLobby(prev);
      break;
    }
    case 'load':
      startLoading(m.map);
      break;
    case 'loadProgress':
      if (ui === 'loading') $('loadText').textContent = `WAITING FOR PLAYERS  ${m.loaded}/${m.total}`;
      break;
    case 'go':
      if (mapReady) applyGo(m); else pendingGo = m;
      break;
    case 'state': {
      const rp = remotes.get(m.id);
      if (!rp || !rp.alive || !Array.isArray(m.p)) break;
      rp.target.fromArray(m.p);
      if (!rp.has) { rp.group.position.copy(rp.target); rp.yaw = m.y; rp.has = true; }
      rp.tyaw = m.y; rp.pitch = m.x; rp.crouch = !!m.c; rp.speed = m.s || 0;
      break;
    }
    case 'shot': {
      const rp = remotes.get(m.id);
      if (!rp || !Array.isArray(m.f) || !Array.isArray(m.e)) break;
      rp.lastShot = now; rp.flashT = 0.05;
      const from = new V3().fromArray(m.f), to = new V3().fromArray(m.e);
      tracer(from, to);
      const def = WEAPONS[m.w] || WEAPONS.m4;
      const rel = from.clone().sub(camera.position), dist = rel.length();
      const right = new V3().setFromMatrixColumn(camera.matrixWorld, 0);
      playGun(def.snd, 0.5 / (1 + dist / 14), rel.normalize().dot(right) * 0.8, dist > 30 ? 0.5 : 1);
      break;
    }
    case 'damage':
      if (m.target === myId && P.alive) { P.hp = m.hp; onHurt(m.from); }
      break;
    case 'hp':
      if (P.alive) P.hp = m.hp;
      break;
    case 'kill': {
      const k = pInfo(m.killer), v = pInfo(m.victim);
      if (k) k.kills = m.kk;
      if (v) { v.deaths = m.vd; v.alive = false; }
      addKillfeed(m.killer, m.victim, m.w, m.head);
      if (m.victim === myId) onMyDeath(m.killer, m.head);
      else { const rp = remotes.get(m.victim); if (rp) setRemoteAlive(rp, false); }
      if (m.killer === myId && m.victim !== myId) { showHitmarker(true); sfx.kill(); notify(`${m.head ? 'HEADSHOT  ' : ''}ELIMINATED ${pName(m.victim)}`, m.head ? '+150' : '+100'); }
      if (ui === 'hud' && !$('scoreboard').classList.contains('hidden')) renderScoreboard();
      break;
    }
    case 'spawned': {
      const info = pInfo(m.id);
      if (info) { info.alive = true; info.hp = 100; }
      if (m.id === myId) { if (mapReady && match) spawnMe(bestSpawn()); }
      else { const rp = remotes.get(m.id); if (rp) setRemoteAlive(rp, true); }
      break;
    }
    case 'left':
      addFeedText(`${m.name} left the match`);
      removeRemote(m.id);
      break;
    case 'throw':
      if ((m.k === 'frag' || m.k === 'smoke') && Array.isArray(m.p) && Array.isArray(m.v) && m.id !== myId) {
        spawnGrenade(m.k, m.id, new V3().fromArray(m.p), new V3().fromArray(m.v));
        const rp = remotes.get(m.id);
        if (rp) rp.lastShot = now;
      }
      break;
    case 'nuke':
      nukeState = { by: m.by, at: m.at, lastBeep: -1, boomed: false };
      addFeedText(`☢ ${pName(m.by)} called in a TACTICAL NUKE`);
      break;
    case 'end':
      if (m.nukeBy != null) {
        // Let everyone see the blast before the results appear.
        detonateNuke();
        clearTimeout(respawnTimer);
        setTimeout(() => showEnd(m.players, m.nukeBy), 3200);
      } else showEnd(m.players, null);
      break;
  }
}

function sendState(force) {
  const now = performance.now();
  if (!force && now - lastStateSent < 50) return;
  lastStateSent = now;
  const r2 = (v) => Math.round(v * 100) / 100;
  net.send({ t: 'state', p: [r2(P.pos.x), r2(P.pos.y), r2(P.pos.z)], y: r2(P.yaw), x: r2(P.pitch), c: P.crouch || P.slideT > 0 ? 1 : 0, s: r2(Math.hypot(P.vel.x, P.vel.z)), w: curW()?.id });
}

/* ======================= OFFLINE DEATHMATCH (BOTS) ======================= */

// Runs the same message protocol as server.py, in the browser, so the rest of the
// client can't tell an offline bot match from an online one.
const BOT_NAMES = ['Ghost', 'Reaper', 'Havoc', 'Nomad', 'Saber', 'Raven', 'Blitz', 'Cobra', 'Specter', 'Onyx', 'Drifter', 'Talon'];
const BOT_DIFF = {
  easy:     { label: 'RECRUIT',  react: 750, acc: 0.2,  turn: 2.5, head: 0.05, burst: [3, 5] },
  normal:   { label: 'REGULAR',  react: 450, acc: 0.33, turn: 4.5, head: 0.1,  burst: [4, 7] },
  hard:     { label: 'HARDENED', react: 260, acc: 0.48, turn: 8,   head: 0.18, burst: [6, 10] },
};
const BOT_RANGE = { ar: 20, smg: 10, lmg: 24, sniper: 40, dmr: 32, pistol: 10 };
const randInt = ([a, b]) => a + Math.floor(Math.random() * (b - a + 1));

// Segment vs. every collider (slab test) — cheap line-of-sight for bots.
function segmentClear(a, b) {
  const d = [b.x - a.x, b.y - a.y, b.z - a.z], o = [a.x, a.y, a.z];
  outer: for (const c of colliders) {
    if (c.max.y < 0.3) continue;
    const mn = [c.min.x, c.min.y, c.min.z], mx = [c.max.x, c.max.y, c.max.z];
    let t0 = 0, t1 = 1;
    for (let i = 0; i < 3; i++) {
      if (Math.abs(d[i]) < 1e-9) { if (o[i] < mn[i] || o[i] > mx[i]) continue outer; continue; }
      let ta = (mn[i] - o[i]) / d[i], tb = (mx[i] - o[i]) / d[i];
      if (ta > tb) [ta, tb] = [tb, ta];
      if (ta > t0) t0 = ta;
      if (tb < t1) t1 = tb;
      if (t0 > t1) continue outer;
    }
    return false;
  }
  return true;
}

let offline = null;

class LocalMatch {
  constructor(cfg) {
    this.cfg = cfg;
    this.diff = BOT_DIFF[cfg.diff] || BOT_DIFF.normal;
    this.state = 'loading';
    this.startAt = 0; this.endAt = 0; this.scoreLimit = 30;
    this.nukeAt = 0; this.nukeBy = null;
    this.me = { id: 1, name: cfg.name, loadout: cfg.loadout, kills: 0, deaths: 0, hp: 100, alive: false, diedAt: 0, lastHit: 0, lastShot: -1e9, isMe: true };
    const names = [...BOT_NAMES].sort(() => Math.random() - 0.5), los = Object.keys(LOADOUTS);
    this.bots = [];
    for (let i = 0; i < cfg.bots; i++) {
      const loadout = los[Math.floor(Math.random() * los.length)];
      const wid = LOADOUTS[loadout].weapons[loadout === 'marksman' ? Math.floor(Math.random() * 2) : 0];
      this.bots.push({ id: i + 2, name: names[i % names.length], loadout, wid, w: WEAPONS[wid], kills: 0, deaths: 0, hp: 100, alive: false, diedAt: 0, lastHit: 0, lastShot: -1e9,
        pos: new V3(), vel: new V3(), grounded: true, yaw: 0, pitch: 0, mag: WEAPONS[wid].mag, ai: null, sentAt: 0 });
    }
    this.all = [this.me, ...this.bots];
  }
  send(m) { queueMicrotask(() => onMsg(m)); }
  pub(p) { return { id: p.id, name: p.name, loadout: p.loadout, kills: p.kills, deaths: p.deaths, hp: Math.round(p.hp), alive: p.alive }; }
  begin() {
    myId = 1;
    this.send({ t: 'lobby', code: 'OFFLINE', hostId: 1, map: this.cfg.map, state: 'loading', players: this.all.map((p) => this.pub(p)) });
    this.send({ t: 'load', map: this.cfg.map });
  }
  handle(m) {
    const now = serverNow();
    switch (m.t) {
      case 'loaded':
        if (this.state !== 'loading') return;
        this.state = 'playing';
        this.startAt = now + 4000;
        this.endAt = this.startAt + 10 * 60 * 1000;
        for (const p of this.all) { p.alive = true; p.hp = 100; }
        this.bots.forEach((b, i) => this.spawnBot(b, spawns[(i + 1) % spawns.length]));
        this.send({ t: 'go', startAt: this.startAt, endAt: this.endAt, scoreLimit: this.scoreLimit, nukeAt: 0, players: this.all.map((p) => this.pub(p)) });
        break;
      case 'shot': this.me.lastShot = now; break;
      case 'hit': { const t = this.bots.find((b) => b.id === m.target); if (t) this.applyHit(this.me, t, m.dmg, m.head, m.w); break; }
      case 'respawn':
        if (this.state === 'playing' && !this.me.alive && now - this.me.diedAt >= 2600) { this.me.alive = true; this.me.hp = 100; this.send({ t: 'spawned', id: 1 }); }
        break;
      case 'setLoadout': if (LOADOUTS[m.loadout]) this.me.loadout = m.loadout; break;
      case 'nuke': if (this.me.kills >= NUKE_KILLS) this.callNuke(1); break;
    }
  }
  callNuke(id) {
    if (this.state !== 'playing' || this.nukeAt) return;
    this.nukeAt = serverNow() + 10000;
    this.nukeBy = id;
    this.send({ t: 'nuke', by: id, at: this.nukeAt });
  }
  fragDamage(ownerId, src) {
    const owner = this.all.find((p) => p.id === ownerId);
    if (!owner) return;
    for (const t of this.targets(owner)) {
      const chest = new V3(t.pos.x, t.pos.y + 1.0, t.pos.z), d = src.distanceTo(chest);
      if (d < FRAG.radius && segmentClear(src, chest)) this.applyHit(owner, t.ent, FRAG.maxDmg * (1 - d / FRAG.radius), false, 'frag');
    }
  }
  botThrow(b, T, now) {
    const eye = new V3(b.pos.x, b.pos.y + 1.55, b.pos.z);
    const dx = T.pos.x - eye.x, dz = T.pos.z - eye.z, dy = T.pos.y + 0.2 - eye.y;
    const tf = clamp(Math.hypot(dx, dz) / 14, 0.6, 1.4);
    const vel = new V3(dx / tf, (dy + 0.5 * 20 * tf * tf) / tf, dz / tf);
    const origin = eye.clone().addScaledVector(vel.clone().normalize(), 0.5);
    if (grenadeInSolid(origin)) return;
    b.nades--;
    b.ai.nadeReady = now + 8000;
    spawnGrenade('frag', b.id, origin, vel);
  }
  applyHit(att, t, dmg, head, w) {
    const now = serverNow();
    if (this.state !== 'playing' || now < this.startAt || !att.alive || !t.alive || att === t) return;
    t.hp -= clamp(Number(dmg) || 0, 0, 250);
    t.lastHit = now;
    if (t.ai) { t.ai.alertId = att.id; t.ai.alertUntil = now + 3000; }
    if (t.hp <= 0) {
      t.hp = 0; t.alive = false; t.deaths++; t.diedAt = now; att.kills++;
      this.send({ t: 'kill', killer: att.id, victim: t.id, head: !!head, w, kk: att.kills, vd: t.deaths });
      if (!att.isMe && att.kills >= NUKE_KILLS) this.callNuke(att.id);
      if (att.kills >= this.scoreLimit) this.end();
    } else this.send({ t: 'damage', target: t.id, from: att.id, hp: Math.round(t.hp) });
  }
  end() {
    if (this.state === 'ended') return;
    this.state = 'ended';
    const nb = this.nukeAt ? this.nukeBy : null;
    const standings = this.all.map((p) => this.pub(p)).sort((a, b) => (b.id === nb) - (a.id === nb) || b.kills - a.kills || a.deaths - b.deaths);
    this.send({ t: 'end', players: standings, nukeBy: nb });
  }
  // Everyone alive except `self`, with live position references.
  targets(self) {
    const list = [];
    if (self !== this.me && this.me.alive && P.alive) list.push({ id: 1, ent: this.me, pos: P.pos });
    for (const b of this.bots) if (b !== self && b.alive) list.push({ id: b.id, ent: b, pos: b.pos });
    return list;
  }
  spawnBot(b, sp) {
    b.pos.copy(sp); b.vel.set(0, 0, 0); b.grounded = true;
    b.yaw = Math.atan2(sp.x, sp.z); b.pitch = 0; b.mag = b.w.mag; b.sentAt = 0; b.nades = 1;
    b.ai = { wp: null, target: null, visible: false, reactAt: 0, lastSeen: -1e9, lastSeenPos: new V3(), nextFire: 0, reloadUntil: 0,
      burst: 0, burstLen: randInt(this.diff.burst), nadeReady: 0, strafe: 0, strafeT: 0, thinkT: 0, stuckT: 0, lastPos: sp.clone(), alertId: null, alertUntil: 0 };
  }
  farSpawn(self) {
    const others = this.targets(self).map((t) => t.pos);
    if (!others.length) return spawns[Math.floor(Math.random() * spawns.length)];
    const scored = spawns.map((s) => ({ s, d: Math.min(...others.map((o) => o.distanceToSquared(s))) })).sort((a, b) => b.d - a.d);
    return scored[Math.floor(Math.random() * Math.min(3, scored.length))].s;
  }
  pickWaypoint(b, goal) {
    const knee = new V3(b.pos.x, b.pos.y + 0.6, b.pos.z), chest = new V3(b.pos.x, b.pos.y + 1.4, b.pos.z);
    if (goal && segmentClear(knee, new V3(goal.x, goal.y + 0.6, goal.z))) return goal.clone();
    for (let i = 0; i < 30; i++) {
      const p = navPts[Math.floor(Math.random() * navPts.length)], dist = p.distanceTo(b.pos);
      if (dist < 6 || dist > 32) continue;
      if (segmentClear(knee, new V3(p.x, 0.6, p.z)) && segmentClear(chest, new V3(p.x, 1.4, p.z))) return p.clone();
    }
    return navPts[Math.floor(Math.random() * navPts.length)].clone();
  }
  tick(dt, paused) {
    if (this.state !== 'playing') return;
    if (paused) {
      // Offline matches freeze while the pause menu is open.
      const ms = dt * 1000;
      this.startAt += ms; this.endAt += ms;
      for (const b of this.bots) b.diedAt += ms;
      if (match) { match.startAt = this.startAt; match.endAt = this.endAt; }
      if (this.nukeAt) { this.nukeAt += ms; if (nukeState) nukeState.at = this.nukeAt; }
      this.pushStates();
      return;
    }
    const now = serverNow();
    if (now >= this.endAt || (this.nukeAt && now >= this.nukeAt)) { this.end(); return; }
    if (now >= this.startAt) {
      for (const p of this.all) {
        if (p.alive && p.hp < 100 && now - p.lastHit > 4000) {
          p.hp = Math.min(100, p.hp + 48 * dt);
          if (p.isMe && P.alive) P.hp = Math.round(p.hp);
        }
      }
      for (const b of this.bots) {
        if (!b.alive) {
          if (now - b.diedAt >= 3000) { b.alive = true; b.hp = 100; this.spawnBot(b, this.farSpawn(b)); this.send({ t: 'spawned', id: b.id }); }
          continue;
        }
        this.updateBot(b, dt, now);
      }
    }
    this.pushStates();
  }
  pushStates() {
    const t = performance.now(), r2 = (v) => Math.round(v * 100) / 100;
    for (const b of this.bots) {
      if (!b.alive || t - b.sentAt < 50) continue;
      b.sentAt = t;
      this.send({ t: 'state', id: b.id, p: [r2(b.pos.x), r2(b.pos.y), r2(b.pos.z)], y: b.yaw, x: b.pitch, c: 0, s: Math.hypot(b.vel.x, b.vel.z), w: b.wid });
    }
  }
  updateBot(b, dt, now) {
    const ai = b.ai, d = this.diff, w = b.w;
    const eye = new V3(b.pos.x, b.pos.y + 1.55, b.pos.z);

    // --- Perception: nearest enemy it can see (in view, heard firing, or shot it) ---
    ai.thinkT -= dt;
    if (ai.thinkT <= 0) {
      ai.thinkT = 0.15 + Math.random() * 0.05;
      const fx = -Math.sin(b.yaw), fz = -Math.cos(b.yaw);
      let best = null, bd = Infinity;
      for (const t of this.targets(b)) {
        const tp = new V3(t.pos.x, t.pos.y + 1.2, t.pos.z), dist = eye.distanceTo(tp);
        if (dist > 75) continue;
        const inView = ((tp.x - eye.x) * fx + (tp.z - eye.z) * fz) / dist > -0.15;
        const heard = now - t.ent.lastShot < 1500 && dist < 40;
        const alerted = ai.alertId === t.id && now < ai.alertUntil;
        if (!(inView || heard || alerted) || !segmentClear(eye, tp) || smokeBlocks(eye, tp)) continue;
        if (dist < bd) { bd = dist; best = t; }
      }
      if (best) {
        if (!ai.target || ai.target.id !== best.id || now - ai.lastSeen > 1200) ai.reactAt = now + d.react * rand(0.7, 1.3);
        ai.target = best; ai.lastSeen = now; ai.lastSeenPos.copy(best.pos); ai.visible = true;
        if (b.nades > 0 && now >= ai.nadeReady && now >= ai.reactAt && bd > 7 && bd < 24 && Math.random() < 0.06) this.botThrow(b, best, now);
      } else {
        ai.visible = false;
        if (ai.target && now - ai.lastSeen > 2500) ai.target = null;
      }
    }
    if (ai.target && !ai.target.ent.alive) { ai.target = null; ai.visible = false; ai.wp = null; }
    const T = ai.target;

    // --- Movement: strafe and hold range in a fight, otherwise roam / hunt ---
    let wx = 0, wz = 0, sprint = false;
    if (T && ai.visible) {
      const dx = T.pos.x - b.pos.x, dz = T.pos.z - b.pos.z, dist = Math.hypot(dx, dz) || 1, fx = dx / dist, fz = dz / dist;
      ai.strafeT -= dt;
      if (ai.strafeT <= 0) {
        ai.strafeT = rand(0.4, 1.4);
        ai.strafe = w.scope && Math.random() < 0.5 ? 0 : [-1, 0, 1][Math.floor(Math.random() * 3)];
        if (Math.random() < 0.12 && b.grounded && !w.scope) b.vel.y = 6.5;
      }
      const pref = BOT_RANGE[w.model] || 18;
      const adv = dist > pref * 1.3 ? 0.7 : dist < pref * 0.5 ? -0.6 : 0;
      wx = fx * adv - fz * ai.strafe;
      wz = fz * adv + fx * ai.strafe;
      ai.wp = null;
    } else {
      const goal = T ? ai.lastSeenPos : null;
      if (!ai.wp || b.pos.distanceTo(ai.wp) < 1.5) ai.wp = this.pickWaypoint(b, goal);
      const dx = ai.wp.x - b.pos.x, dz = ai.wp.z - b.pos.z, dl = Math.hypot(dx, dz) || 1;
      wx = dx / dl; wz = dz / dl; sprint = !goal;
    }
    ai.stuckT += dt;
    if (ai.stuckT > 1.2) {
      if (b.pos.distanceTo(ai.lastPos) < 0.8 && (wx || wz) && !(T && ai.visible)) {
        ai.wp = this.pickWaypoint(b, null);
        if (b.grounded) b.vel.y = 7;
      }
      ai.stuckT = 0; ai.lastPos.copy(b.pos);
    }
    const wl = Math.hypot(wx, wz);
    if (wl > 1) { wx /= wl; wz /= wl; }
    const speed = 5.4 * w.move * (sprint ? 1.35 : 1) * (T && ai.visible ? 0.8 : 1);
    const accel = b.grounded ? 10 : 2;
    b.vel.x = damp(b.vel.x, wx * speed, accel, dt);
    b.vel.z = damp(b.vel.z, wz * speed, accel, dt);
    physicsStep(b, 1.8, dt);

    // --- Aim: turn toward the target at a difficulty-limited speed ---
    let wantYaw = b.yaw, wantPitch = 0;
    if (T) {
      const dx = T.pos.x - b.pos.x, dz = T.pos.z - b.pos.z, dy = T.pos.y + 1.2 - (b.pos.y + 1.55);
      wantYaw = Math.atan2(-dx, -dz); wantPitch = Math.atan2(dy, Math.hypot(dx, dz));
    } else if (Math.hypot(b.vel.x, b.vel.z) > 0.5) wantYaw = Math.atan2(-b.vel.x, -b.vel.z);
    const dyaw = Math.atan2(Math.sin(wantYaw - b.yaw), Math.cos(wantYaw - b.yaw));
    const maxTurn = (T ? d.turn : 6) * dt;
    b.yaw += clamp(dyaw, -maxTurn, maxTurn);
    b.pitch = damp(b.pitch, wantPitch, 8, dt);

    // --- Fire ---
    if (T && ai.visible && now >= ai.reactAt && Math.abs(dyaw) < 0.12 && now >= ai.nextFire && now >= ai.reloadUntil) {
      if (b.mag <= 0) { ai.reloadUntil = now + w.reload * 1000; b.mag = w.mag; }
      else this.botFire(b, T, now);
    }
  }
  botFire(b, T, now) {
    const ai = b.ai, w = b.w, d = this.diff;
    b.mag--; b.lastShot = now;
    ai.nextFire = now + (60000 / w.rpm) * (w.auto ? 1 : rand(1.2, 2.2));
    if (w.auto && ++ai.burst >= ai.burstLen) { ai.burst = 0; ai.burstLen = randInt(d.burst); ai.nextFire = now + rand(300, 700); }
    const eye = new V3(b.pos.x, b.pos.y + 1.55, b.pos.z);
    const isMe = T.ent.isMe, crouch = isMe && P.crouch;
    const tp = new V3(T.pos.x, T.pos.y + (crouch ? 0.8 : 1.2), T.pos.z);
    const dist = eye.distanceTo(tp);
    const falloff = clamp(1 - dist / (w.range > 100 ? 140 : w.range * 2.5), 0.15, 1);
    const moving = isMe ? Math.hypot(P.vel.x, P.vel.z) > 1 : Math.hypot(T.ent.vel.x, T.ent.vel.z) > 1;
    let chance = d.acc * falloff * (moving ? 0.75 : 1) * (crouch ? 0.85 : 1) * (w.scope ? 0.7 : 1);
    if (isMe && P.slideT > 0) chance *= 0.6;
    const hit = Math.random() < chance, head = hit && Math.random() < d.head;
    const end = tp.clone();
    if (!hit) end.add(new V3(rand(-1, 1), rand(-0.6, 0.9), rand(-1, 1))).sub(eye).multiplyScalar(1.6).add(eye);
    const fx = -Math.sin(b.yaw), fz = -Math.cos(b.yaw);
    const muzzle = [b.pos.x + fx * 0.95 + Math.cos(b.yaw) * 0.1, b.pos.y + 1.45, b.pos.z + fz * 0.95 - Math.sin(b.yaw) * 0.1];
    this.send({ t: 'shot', id: b.id, f: muzzle, e: [end.x, end.y, end.z], w: b.wid });
    if (hit) this.applyHit(b, T.ent, w.dmg * (head ? w.head : 1) * (dist > w.range ? 0.72 : 1), head, b.wid);
  }
}

/* ========================== GAME FLOW / UI ========================== */

let ui = 'menu';
function showScreen(id) {
  for (const s of ['menu', 'lobby', 'offline', 'loading', 'end']) $(s).classList.toggle('hidden', s !== id);
  $('hud').classList.toggle('hidden', id !== 'hud');
  ui = id;
  if (id !== 'hud' && document.pointerLockElement) document.exitPointerLock();
}

function goMenu(err) {
  clearTimeout(respawnTimer);
  offline = null;
  match = null; mapReady = false; pendingGo = null; P.alive = false;
  for (const id of [...remotes.keys()]) removeRemote(id);
  showViewmodel();
  history.replaceState(null, '', location.pathname);
  showScreen('menu');
  $('menuErr').textContent = err || '';
}

function loadoutCards(container, selected, onPick, keysHint) {
  container.innerHTML = '';
  Object.entries(LOADOUTS).forEach(([key, lo], i) => {
    const el = document.createElement('button');
    el.className = 'card' + (key === selected ? ' sel' : '');
    const guns = lo.weapons.map((id) => `<div class="gun"><b>${WEAPONS[id].name}</b><span>${WEAPONS[id].cls}</span></div>`).join('');
    el.innerHTML = `<div class="ct">${keysHint ? `<kbd>${i + 1}</kbd>` : ''}${lo.name}</div><div class="cd">${lo.desc}</div>${guns}`;
    el.onclick = () => onPick(key);
    container.appendChild(el);
  });
}
function pickLoadout(key) {
  if (!LOADOUTS[key]) return;
  settings.loadout = key; saveSettings();
  if (match && P.alive) P.pendingLoadout = key; else { P.loadout = key; P.pendingLoadout = null; }
  net.send({ t: 'setLoadout', loadout: key });
  refreshLoadoutViews();
}
function refreshLoadoutViews() {
  const sel = P.pendingLoadout || P.loadout;
  if (ui === 'lobby') loadoutCards($('loadouts'), sel, pickLoadout);
  if (ui === 'offline') loadoutCards($('offLoadouts'), sel, pickLoadout);
  loadoutCards($('deathLoadouts'), sel, pickLoadout, true);
  loadoutCards($('pauseLoadouts'), sel, pickLoadout);
  $('pauseLoNote').textContent = P.pendingLoadout && P.alive ? `${LOADOUTS[P.pendingLoadout].name} equips on your next spawn.` : '';
}

function renderLobby(prev) {
  if (!room) return;
  const isHost = room.hostId === myId;
  $('codeText').textContent = room.code;
  $('pcount').textContent = `${room.players.length}/12`;
  $('plist').innerHTML = room.players.map((p) =>
    `<li class="${p.id === myId ? 'me' : ''}"><span class="pn">${p.id === room.hostId ? '<i class="crown">★</i>' : ''}${escapeHtml(p.name)}${p.id === myId ? ' <em>(you)</em>' : ''}</span><span class="pl">${LOADOUTS[p.loadout]?.name || ''}</span></li>`).join('');
  const maps = $('maps');
  maps.innerHTML = '';
  for (const [key, mp] of Object.entries(MAPS)) {
    const el = document.createElement('button');
    el.className = 'card map' + (room.map === key ? ' sel' : '') + (isHost ? '' : ' locked');
    el.innerHTML = `<div class="ct">${mp.name}</div><div class="cd">${mp.desc}</div>`;
    el.onclick = () => { if (isHost) net.send({ t: 'setMap', map: key }); };
    maps.appendChild(el);
  }
  $('mapHint').textContent = isHost ? '(you pick)' : '(host picks)';
  refreshLoadoutViews();
  $('btnStart').classList.toggle('hidden', !isHost);
  $('waitHost').classList.toggle('hidden', isHost);
  if (room.state !== 'lobby') $('waitHost').textContent = 'Match in progress — joining…';
  else $('waitHost').textContent = 'Waiting for the host to start the match…';
  if (!prev || prev.map !== room.map || currentMap !== room.map) loadMap(room.map);
}

const TIPS = [
  'Sprint + C to slide into cover.', 'Hold SHIFT while scoped to steady your aim.', 'Headshots deal bonus damage with every weapon.',
  'Health regenerates after 4 seconds out of combat.', 'Enemies show on your radar when they fire.', 'Crouching reduces recoil and spread.',
  'The Marksman Ranger DMR is a one-shot headshot. The Longbow one-shots anywhere above the legs.',
];
function startLoading(mapId) {
  showScreen('loading');
  mapReady = false; pendingGo = null; match = null; P.alive = false;
  clearTimeout(respawnTimer);
  showViewmodel();
  for (const rp of remotes.values()) { rp.alive = false; rp.has = false; rp.group.visible = false; }
  $('loadMap').textContent = MAPS[mapId].name;
  $('loadText').textContent = 'BUILDING MAP…';
  $('loadBar').style.width = '15%';
  $('loadTip').textContent = TIPS[Math.floor(Math.random() * TIPS.length)];
  setTimeout(() => {
    loadMap(mapId);
    $('loadBar').style.width = '55%';
    $('loadText').textContent = 'COMPILING SHADERS…';
    camera.position.set(0, 2, 0);
    renderer.compile(scene, camera);
    renderer.compile(vmScene, vmCamera);
    // A timer rather than requestAnimationFrame: rAF never fires in a background tab,
    // which would leave everyone else stuck waiting on this player.
    setTimeout(() => {
      $('loadBar').style.width = '100%';
      $('loadText').textContent = 'WAITING FOR PLAYERS…';
      mapReady = true;
      net.send({ t: 'loaded' });
      if (pendingGo) { applyGo(pendingGo); pendingGo = null; }
    }, 30);
  }, 60);
}

function applyGo(m) {
  if (ui === 'hud' && match && match.startAt === m.startAt) return;
  match = { startAt: m.startAt, endAt: m.endAt, scoreLimit: m.scoreLimit };
  nukeState = m.nukeAt ? { by: m.nukeBy, at: m.nukeAt, lastBeep: -1, boomed: false } : null;
  $('nukeflash').classList.remove('boom');
  if (room) room.players = m.players;
  for (const p of m.players) {
    const rp = ensureRemote(p);
    if (rp) setRemoteAlive(rp, p.alive);
  }
  $('killfeed').innerHTML = '';
  showScreen('hud');
  $('pause').classList.remove('hidden');
  $('pauseTitle').textContent = 'CLICK TO DEPLOY';
  const me = m.players.find((p) => p.id === myId);
  if (me && me.alive) {
    const late = serverNow() > m.startAt;
    const order = [...m.players].sort((a, b) => a.id - b.id).findIndex((p) => p.id === myId);
    spawnMe(late ? bestSpawn() : spawns[order % spawns.length]);
  }
  refreshLoadoutViews();
}

function onMyDeath(killerId) {
  P.alive = false; P.deathAt = performance.now(); P.killerId = killerId;
  P.adsT = 0; P.reloadUntil = 0; mouseL = false; mouseR = false;
  showViewmodel();
  $('scope').classList.add('hidden');
  $('death').classList.remove('hidden');
  $('deathBy').textContent = killerId === myId ? 'You eliminated yourself' : `Eliminated by ${pName(killerId)}`;
  refreshLoadoutViews();
  clearTimeout(respawnTimer);
  respawnTimer = setTimeout(() => net.send({ t: 'respawn' }), 3000);
}

function onHurt(fromId) {
  sfx.hurt();
  const rp = remotes.get(fromId);
  $('flash').style.opacity = 0.35;
  if (!rp) return;
  const dx = rp.group.position.x - P.pos.x, dz = rp.group.position.z - P.pos.z;
  const f = dx * -Math.sin(P.yaw) + dz * -Math.cos(P.yaw), r = dx * Math.cos(P.yaw) + dz * -Math.sin(P.yaw);
  const el = document.createElement('div');
  el.className = 'dmgarrow';
  el.style.transform = `translate(-50%,-50%) rotate(${Math.atan2(r, f)}rad)`;
  $('dmgdirs').appendChild(el);
  setTimeout(() => el.remove(), 1500);
}

function showEnd(players, nukeBy) {
  clearTimeout(respawnTimer);
  match = null; P.alive = false; mapReady = false; nukeState = null;
  $('nuke').classList.add('hidden');
  $('nukeReady').classList.add('hidden');
  showViewmodel();
  for (const rp of remotes.values()) { rp.alive = false; rp.group.visible = false; }
  const winner = players[0];
  if (nukeBy != null) {
    $('endTitle').textContent = nukeBy === myId ? 'NUKED THEM ALL' : 'NUKED';
    $('endWinner').textContent = `${winner?.name ?? pName(nukeBy)} ended the match with a TACTICAL NUKE`;
  } else {
    $('endTitle').textContent = winner?.id === myId ? 'VICTORY' : 'MATCH OVER';
    $('endWinner').textContent = winner ? `${winner.name} wins with ${winner.kills} kills` : '';
  }
  $('endTable').innerHTML = '<tr><th>#</th><th>PLAYER</th><th>K</th><th>D</th><th>K/D</th></tr>' + players.map((p, i) =>
    `<tr class="${p.id === myId ? 'me' : ''}"><td>${i + 1}</td><td>${escapeHtml(p.name)}</td><td>${p.kills}</td><td>${p.deaths}</td><td>${(p.kills / Math.max(1, p.deaths)).toFixed(2)}</td></tr>`).join('');
  showScreen('end');
}

/* =============================== HUD =============================== */

function escapeHtml(s) { return String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])); }
let hitTimer = null;
function showHitmarker(kill) {
  const el = $('hitmarker');
  el.className = kill ? 'show kill' : 'show';
  clearTimeout(hitTimer);
  hitTimer = setTimeout(() => (el.className = ''), kill ? 350 : 160);
}
function addKillfeed(killer, victim, w, head) {
  const el = document.createElement('div');
  const cls = (id) => (id === myId ? 'me' : '');
  el.innerHTML = `<b class="${cls(killer)}">${escapeHtml(pName(killer))}</b><span class="kw">${WEAPONS[w]?.name || (w === 'frag' ? 'FRAG' : '')}${head ? ' ⌖' : ''}</span><b class="${cls(victim)}">${escapeHtml(pName(victim))}</b>`;
  pushFeed(el);
}
function addFeedText(text) { const el = document.createElement('div'); el.className = 'sys'; el.textContent = text; pushFeed(el); }
function pushFeed(el) {
  const f = $('killfeed');
  f.prepend(el);
  while (f.children.length > 6) f.lastChild.remove();
  setTimeout(() => el.classList.add('fade'), 5000);
  setTimeout(() => el.remove(), 5600);
}
let notifyTimer = null;
function notify(text, pts) {
  const el = $('notify');
  el.innerHTML = `<div class="pts">${pts}</div><div>${escapeHtml(text)}</div>`;
  el.classList.remove('pop'); void el.offsetWidth; el.classList.add('pop');
  clearTimeout(notifyTimer);
  notifyTimer = setTimeout(() => el.classList.remove('pop'), 1800);
}
function renderScoreboard() {
  if (!room) return;
  const sorted = [...room.players].sort((a, b) => b.kills - a.kills || a.deaths - b.deaths);
  $('sbTable').innerHTML = '<tr><th>PLAYER</th><th>LOADOUT</th><th>K</th><th>D</th><th>K/D</th></tr>' + sorted.map((p) =>
    `<tr class="${p.id === myId ? 'me' : ''}"><td>${escapeHtml(p.name)}</td><td>${LOADOUTS[p.loadout]?.name || ''}</td><td>${p.kills}</td><td>${p.deaths}</td><td>${(p.kills / Math.max(1, p.deaths)).toFixed(2)}</td></tr>`).join('');
  $('sbMap').textContent = `${MAPS[currentMap]?.name || ''} • ${offline ? `DEATHMATCH VS BOTS (${offline.diff.label})` : 'FREE-FOR-ALL'} • FIRST TO ${match?.scoreLimit || 30}`;
}

const radarCtx = $('radar').getContext('2d');
function drawRadar(now) {
  const g = radarCtx, S = 180, PX = 2.6;
  g.clearRect(0, 0, S, S);
  g.save();
  g.beginPath(); g.arc(S / 2, S / 2, S / 2 - 2, 0, Math.PI * 2); g.clip();
  g.fillStyle = 'rgba(8,14,10,0.85)'; g.fillRect(0, 0, S, S);
  g.translate(S / 2, S / 2); g.rotate(P.yaw); g.scale(PX, PX);
  if (radarImg) g.drawImage(radarImg, -mapHalf - P.pos.x, -mapHalf - P.pos.z, mapHalf * 2, mapHalf * 2);
  g.fillStyle = '#ff3b30';
  for (const rp of remotes.values()) {
    if (!rp.alive || !rp.has || now - rp.lastShot > 2500) continue;
    g.globalAlpha = 1 - (now - rp.lastShot) / 2500;
    g.beginPath(); g.arc(rp.group.position.x - P.pos.x, rp.group.position.z - P.pos.z, 1.3, 0, Math.PI * 2); g.fill();
  }
  g.restore();
  g.fillStyle = '#f2f2e8';
  g.beginPath(); g.moveTo(S / 2, S / 2 - 7); g.lineTo(S / 2 + 5, S / 2 + 5); g.lineTo(S / 2, S / 2 + 2); g.lineTo(S / 2 - 5, S / 2 + 5); g.fill();
  g.strokeStyle = 'rgba(200,220,200,0.35)'; g.lineWidth = 2;
  g.beginPath(); g.arc(S / 2, S / 2, S / 2 - 2, 0, Math.PI * 2); g.stroke();
}

const hudCache = {};
function setText(id, v) { if (hudCache[id] !== v) { hudCache[id] = v; $(id).textContent = v; } }
function updateHud(now) {
  const sNow = serverNow();
  if (match) {
    const rem = Math.max(0, match.endAt - sNow);
    setText('timer', `${Math.floor(rem / 60000)}:${String(Math.floor(rem / 1000) % 60).padStart(2, '0')}`);
    const sorted = room ? [...room.players].sort((a, b) => b.kills - a.kills) : [];
    const me = pInfo(myId), leader = sorted.find((p) => p.id !== myId);
    setText('scoreMe', String(me?.kills ?? 0));
    setText('scoreTop', String(leader?.kills ?? 0));
    setText('scoreTopName', leader ? leader.name : '—');
    const cd = match.startAt - sNow, el = $('countdown');
    if (cd > 0) { el.classList.remove('hidden'); setText('countdown', String(Math.ceil(cd / 1000))); }
    else if (cd > -900) { el.classList.remove('hidden'); setText('countdown', 'GO!'); }
    else el.classList.add('hidden');
    const ready = !nukeState && (me?.kills ?? 0) >= NUKE_KILLS;
    $('nukeReady').classList.toggle('hidden', !ready);
    if (nukeState && !nukeState.boomed) {
      const left = nukeState.at - sNow;
      if (left <= 0) detonateNuke();
      else {
        const secs = Math.ceil(left / 1000);
        $('nuke').classList.remove('hidden');
        setText('nukeCount', String(secs));
        setText('nukeBy', `Called in by ${pName(nukeState.by)}`);
        if (secs !== nukeState.lastBeep) { nukeState.lastBeep = secs; sfx.siren(); }
      }
    }
  }
  if (P.alive) {
    setText('eqFrag', `T  FRAG ×${P.equip.frag}`);
    setText('eqSmoke', `Y  SMOKE ×${P.equip.smoke}`);
  }
  if (P.alive && curW()) {
    const w = curW(), d = w.def;
    setText('mag', String(w.mag));
    setText('reserve', String(w.reserve));
    setText('wname', d.name);
    $('mag').classList.toggle('low', w.mag <= Math.ceil(d.mag * 0.25));
    const slots = P.weapons.map((x, i) => `<span class="${i === P.cur ? 'on' : ''}">${i + 1} ${x.def.name}</span>`).join('');
    if (hudCache.slots !== slots) { hudCache.slots = slots; $('wslots').innerHTML = slots; }
    const rm = $('reloadmsg');
    if (P.reloadUntil) { rm.classList.remove('hidden'); setText('reloadmsg', 'RELOADING'); }
    else if (w.mag === 0 && w.reserve === 0) { rm.classList.remove('hidden'); setText('reloadmsg', 'NO AMMO — SWAP WEAPON'); }
    else if (w.mag <= Math.ceil(d.mag * 0.25) && w.reserve > 0) { rm.classList.remove('hidden'); setText('reloadmsg', 'PRESS R TO RELOAD'); }
    else rm.classList.add('hidden');
    $('hpfill').style.width = `${P.hp}%`;
    setText('hptext', String(Math.round(P.hp)));
    $('vignette').style.opacity = String(clamp((70 - P.hp) / 70, 0, 1) * 0.9);
    const spread = lerp(d.hip, d.ads, P.adsT) * (Math.hypot(P.vel.x, P.vel.z) > 1 ? 1.5 : 1) * (P.grounded ? 1 : 2.2) + P.bloom;
    const gap = 6 + (spread * innerHeight / 2) / Math.tan((camera.fov * Math.PI) / 360);
    $('crosshair').style.setProperty('--gap', `${gap.toFixed(1)}px`);
    $('crosshair').style.opacity = String(clamp(1 - P.adsT * 2.5 - P.sprintT, 0, 1));
    $('scope').classList.toggle('hidden', !(d.scope && P.adsT > 0.85));
  } else {
    $('crosshair').style.opacity = '0';
    $('scope').classList.add('hidden');
    $('vignette').style.opacity = '0';
  }
  if (!P.alive && match && !$('death').classList.contains('hidden')) {
    const left = Math.max(0, 3 - (now - P.deathAt) / 1000);
    setText('respawnIn', left > 0 ? `Respawning in ${left.toFixed(1)}` : 'Respawning…');
  }
  const fl = $('flash');
  const fo = parseFloat(fl.style.opacity || 0);
  if (fo > 0) fl.style.opacity = String(Math.max(0, fo - 0.02));
  drawRadar(now);
}

/* ============================== INPUT ============================== */

const keys = new Set();
let mouseL = false, mouseR = false, pointerLocked = false;
const aiming = () => mouseR || keys.has('KeyF');

addEventListener('keydown', (e) => {
  if (e.target.tagName === 'INPUT') return;
  if (ui !== 'hud') return;
  if (e.code === 'Tab') { e.preventDefault(); renderScoreboard(); $('scoreboard').classList.remove('hidden'); return; }
  if (!pointerLocked) return;
  keys.add(e.code);
  if (e.repeat) return;
  const now = performance.now();
  if (!P.alive) {
    const idx = ['Digit1', 'Digit2', 'Digit3', 'Digit4'].indexOf(e.code);
    if (idx >= 0) pickLoadout(Object.keys(LOADOUTS)[idx]);
    if (e.code === 'KeyN') callNuke();
    return;
  }
  if (e.code === 'KeyR') startReload(now);
  else if (e.code === 'Digit1') swapTo(0, now);
  else if (e.code === 'Digit2') swapTo(1, now);
  else if (e.code === 'KeyQ') swapTo((P.cur + 1) % P.weapons.length, now);
  else if (e.code === 'KeyC') toggleCrouch();
  else if (e.code === 'KeyT') throwGrenade('frag', now);
  else if (e.code === 'KeyY') throwGrenade('smoke', now);
  else if (e.code === 'KeyN') callNuke();
  if (e.code === 'Space') e.preventDefault();
});
addEventListener('keyup', (e) => {
  keys.delete(e.code);
  if (e.code === 'Tab') $('scoreboard').classList.add('hidden');
});
addEventListener('blur', () => { keys.clear(); mouseL = mouseR = false; });
addEventListener('mousedown', (e) => {
  if (!pointerLocked) return;
  if (e.button === 0) { mouseL = true; P.wantShot = true; }
  if (e.button === 2) mouseR = true;
});
addEventListener('mouseup', (e) => {
  if (e.button === 0) { mouseL = false; if (!curW()?.def.auto) setTimeout(() => (P.wantShot = false), 150); }
  if (e.button === 2) mouseR = false;
});
addEventListener('contextmenu', (e) => e.preventDefault());
addEventListener('wheel', (e) => { if (pointerLocked && P.alive && P.weapons.length > 1) swapTo((P.cur + (e.deltaY > 0 ? 1 : P.weapons.length - 1)) % P.weapons.length, performance.now()); });
addEventListener('mousemove', (e) => {
  if (!pointerLocked || !P.alive) return;
  const sens = 0.0022 * settings.sens * (camera.fov / settings.fov);
  P.yaw -= e.movementX * sens;
  P.pitch = clamp(P.pitch - e.movementY * sens, -1.5, 1.5);
  P.swayX = clamp(P.swayX - e.movementX * 0.00012, -0.03, 0.03);
  P.swayY = clamp(P.swayY + e.movementY * 0.00012, -0.03, 0.03);
});
document.addEventListener('pointerlockchange', () => {
  pointerLocked = document.pointerLockElement === canvas;
  if (ui !== 'hud') return;
  if (pointerLocked) $('pause').classList.add('hidden');
  else { keys.clear(); mouseL = mouseR = false; $('pause').classList.remove('hidden'); $('pauseTitle').textContent = 'PAUSED'; refreshLoadoutViews(); }
});
function lockPointer() { initAudio(); canvas.requestPointerLock()?.catch?.(() => {}); }
$('pause').addEventListener('click', (e) => { if (e.target === $('pause') || e.target.id === 'btnResume' || e.target.id === 'pauseTitle') lockPointer(); });

/* ============================== MENUS ============================== */

$('name').value = settings.name;
const urlCode = new URLSearchParams(location.search).get('code');
if (urlCode) $('joinCode').value = urlCode.toUpperCase();

function playerName() {
  const n = $('name').value.trim();
  settings.name = n; saveSettings();
  return n || 'Soldier' + Math.floor(Math.random() * 900 + 100);
}
async function withServer(fn) {
  initAudio();
  $('menuErr').textContent = '';
  try { await connect(); fn(); } catch (err) { $('menuErr').textContent = err.message; }
}
$('btnCreate').onclick = () => withServer(() => net.send({ t: 'create', name: playerName(), loadout: P.loadout }));
$('btnJoin').onclick = () => {
  const code = $('joinCode').value.trim().toUpperCase();
  if (code.length < 4) { $('menuErr').textContent = 'Enter the 6-character match code.'; return; }
  withServer(() => net.send({ t: 'join', code, name: playerName(), loadout: P.loadout }));
};
$('joinCode').addEventListener('keydown', (e) => { if (e.key === 'Enter') $('btnJoin').click(); });
$('btnCopy').onclick = async () => {
  const link = `${location.origin}/?code=${room.code}`;
  try { await navigator.clipboard.writeText(`Join my FRONTLINE match! Code: ${room.code}  ${link}`); $('btnCopy').textContent = 'COPIED!'; }
  catch { $('btnCopy').textContent = link; }
  setTimeout(() => ($('btnCopy').textContent = 'COPY INVITE'), 1800);
};
$('btnLeave').onclick = () => { net.send({ t: 'leave' }); myId = null; room = null; goMenu(); };
$('btnStart').onclick = () => net.send({ t: 'start' });
$('btnLeaveMatch').onclick = () => { if (!offline) net.send({ t: 'leave' }); myId = null; room = null; goMenu(); };
$('btnEndLobby').onclick = () => {
  if (offline) { offline = null; myId = null; room = null; for (const id of [...remotes.keys()]) removeRemote(id); showOfflineSetup(); }
  else { showScreen('lobby'); renderLobby(null); }
};

// Offline deathmatch setup
function showOfflineSetup() { showScreen('offline'); renderOffline(); }
function renderOffline() {
  const maps = $('offMaps');
  maps.innerHTML = '';
  for (const [key, mp] of Object.entries(MAPS)) {
    const el = document.createElement('button');
    el.className = 'card map' + (settings.offMap === key ? ' sel' : '');
    el.innerHTML = `<div class="ct">${mp.name}</div><div class="cd">${mp.desc}</div>`;
    el.onclick = () => { settings.offMap = key; saveSettings(); renderOffline(); };
    maps.appendChild(el);
  }
  const seg = (container, options, value, set) => {
    container.innerHTML = '';
    for (const [v, label] of options) {
      const b = document.createElement('button');
      b.className = 'btn' + (v === value ? ' primary' : '');
      b.textContent = label;
      b.onclick = () => { set(v); saveSettings(); renderOffline(); };
      container.appendChild(b);
    }
  };
  seg($('offBots'), [1, 3, 5, 7, 9].map((n) => [n, String(n)]), settings.offBots, (v) => (settings.offBots = v));
  seg($('offDiff'), Object.entries(BOT_DIFF).map(([k, d]) => [k, d.label]), settings.offDiff, (v) => (settings.offDiff = v));
  refreshLoadoutViews();
  if (currentMap !== settings.offMap) loadMap(settings.offMap);
}
$('btnOffline').onclick = () => { initAudio(); $('menuErr').textContent = ''; showOfflineSetup(); };
$('btnOffBack').onclick = () => goMenu();
$('btnOffStart').onclick = () => {
  initAudio();
  if (room && ws && ws.readyState === 1) ws.send(JSON.stringify({ t: 'leave' }));
  for (const id of [...remotes.keys()]) removeRemote(id);
  room = null;
  offline = new LocalMatch({ map: settings.offMap, bots: settings.offBots, diff: settings.offDiff, name: playerName(), loadout: P.loadout });
  offline.begin();
};

for (const [id, key, fmt] of [['sens', 'sens', (v) => v.toFixed(2)], ['fov', 'fov', (v) => String(v)], ['vol', 'vol', (v) => `${Math.round(v * 100)}%`]]) {
  const input = $(id), out = $(id + 'Val');
  input.value = settings[key]; out.textContent = fmt(settings[key]);
  input.oninput = () => {
    settings[key] = parseFloat(input.value); out.textContent = fmt(settings[key]); saveSettings();
    if (key === 'vol' && master) master.gain.value = settings.vol;
  };
}

/* =============================== LOOP =============================== */

let last = performance.now();
function frame(now) {
  requestAnimationFrame(frame);
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now;
  if (ui === 'hud' && match) {
    const canMove = serverNow() >= match.startAt && pointerLocked && !nukeState?.boomed;
    if (P.alive && curW()) {
      updateMovement(dt, now, canMove);
      updateWeapon(dt, now, canMove);
      updateCamera(dt, now);
      updateViewmodel(dt, now);
      sendState(false);
    } else {
      const killer = remotes.get(P.killerId);
      camera.position.y = damp(camera.position.y, P.pos.y + 3.5, 2, dt);
      if (killer && killer.group.visible) {
        const look = new THREE.Matrix4().lookAt(camera.position, killer.group.position.clone().setY(killer.group.position.y + 1.4), new V3(0, 1, 0));
        camera.quaternion.slerp(new THREE.Quaternion().setFromRotationMatrix(look), 1 - Math.exp(-3 * dt));
        camera.rotation.setFromQuaternion(camera.quaternion, 'YXZ');
      }
    }
    updateHud(now);
  } else {
    // Cinematic flyover behind the menus.
    const t = now / 1000 * 0.06, R = mapHalf * 0.8;
    camera.position.set(Math.cos(t) * R, 14, Math.sin(t) * R);
    camera.lookAt(0, 2, 0);
    if (camera.fov !== 60) { camera.fov = 60; camera.updateProjectionMatrix(); }
  }
  if (offline) offline.tick(dt, ui === 'hud' && !pointerLocked);
  updateRemotes(dt, now);
  updateGrenades(dt);
  updateParticles(dt);
  updateTracers(dt);
  sky.position.copy(camera.position);
  sun.target.position.set(0, 0, 0);
  renderer.clear();
  renderer.render(scene, camera);
  if (ui === 'hud' && P.alive && vmRoot.visible) {
    renderer.clearDepth();
    renderer.render(vmScene, vmCamera);
  }
}
loadMap('harbor');
requestAnimationFrame(frame);