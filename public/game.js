import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import * as SkeletonUtils from 'three/addons/utils/SkeletonUtils.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

const $ = (id) => document.getElementById(id);
const rand = (a, b) => a + Math.random() * (b - a);
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const lerp = (a, b, t) => a + (b - a) * t;
const damp = (a, b, k, dt) => lerp(a, b, 1 - Math.exp(-k * dt));
const V3 = THREE.Vector3;
// Google Analytics event (no-op until GA_ID is set in index.html).
const track = (name, params) => { try { window.track?.(name, params); } catch {} };

/* ============================== DATA ============================== */

const WEAPONS = {
  m4:      { name: 'M4 VANGUARD', cls: 'Assault Rifle',     dmg: 28,  head: 1.6, rpm: 760, auto: true,  mag: 30,  reserve: 150, reload: 2.1, hip: 0.032, ads: 0.003, recoil: 0.011, kick: 0.06, adsFov: 52, adsTime: 0.22, move: 1.0,  range: 45,  snd: { f: 2600, d: 0.22, thump: 0.9 }, model: 'ar' },
  viper:   { name: 'VIPER-9',     cls: 'SMG',               dmg: 21,  head: 1.4, rpm: 980, auto: true,  mag: 32,  reserve: 192, reload: 1.7, hip: 0.024, ads: 0.007, recoil: 0.008, kick: 0.045, adsFov: 60, adsTime: 0.15, move: 1.1,  range: 22,  snd: { f: 3400, d: 0.15, thump: 0.6 }, model: 'smg' },
  titan:   { name: 'TITAN LMG',   cls: 'Light Machine Gun', dmg: 31,  head: 1.5, rpm: 680, auto: true,  mag: 100, reserve: 200, reload: 4.6, hip: 0.05,  ads: 0.005, recoil: 0.013, kick: 0.07, adsFov: 50, adsTime: 0.38, move: 0.86, range: 55,  snd: { f: 1900, d: 0.3,  thump: 1.3 }, model: 'lmg' },
  longbow: { name: 'LONGBOW .50', cls: 'Sniper Rifle',      dmg: 115, head: 2.0, rpm: 48,  auto: false, mag: 5,   reserve: 25,  reload: 3.3, hip: 0.09,  ads: 0,     recoil: 0.06,  kick: 0.22, adsFov: 18, adsTime: 0.32, move: 0.9,  range: 999, snd: { f: 1500, d: 0.6,  thump: 1.7 }, model: 'sniper', scope: true },
  ranger:  { name: 'RANGER DMR',  cls: 'Marksman Rifle',    dmg: 52,  head: 2.1, rpm: 320, auto: false, mag: 12,  reserve: 60,  reload: 2.6, hip: 0.06,  ads: 0.001, recoil: 0.03,  kick: 0.12, adsFov: 30, adsTime: 0.27, move: 0.94, range: 999, snd: { f: 2100, d: 0.4,  thump: 1.2 }, model: 'dmr', scope: true },
  knife:   { name: 'COMBAT KNIFE', cls: 'Melee',            dmg: 150, head: 1,   rpm: 100, auto: true,  mag: 1,   reserve: 0,   reload: 0,   hip: 0,     ads: 0,     recoil: 0,     kick: 0,    adsFov: 80, adsTime: 0.2,  move: 0.82,  range: 2.6, snd: { f: 1800, d: 0.12, thump: 0 },   model: 'knife', melee: true },
  p11:     { name: 'P-11',        cls: 'Pistol',            dmg: 30,  head: 1.5, rpm: 420, auto: false, mag: 12,  reserve: 60,  reload: 1.4, hip: 0.02,  ads: 0.006, recoil: 0.016, kick: 0.08, adsFov: 65, adsTime: 0.12, move: 1.05, range: 18,  snd: { f: 3000, d: 0.14, thump: 0.5 }, model: 'pistol' },
};

const LOADOUTS = {
  assault:  { name: 'ASSAULT',  desc: 'M4 rifle + pistol. All-rounder.',      weapons: ['m4', 'p11'] },
  smg:      { name: 'SMG',      desc: 'Viper-9 + pistol. Fast and close.',     weapons: ['viper', 'p11'] },
  gunner:   { name: 'GUNNER',   desc: 'Titan LMG + pistol. 100-round big gun.', weapons: ['titan', 'p11'] },
  marksman: { name: 'MARKSMAN', desc: 'Two snipers: Longbow .50 + Ranger DMR.', weapons: ['longbow', 'ranger'] },
};

const MODES = {
  ffa: { name: 'DEATHMATCH', desc: 'Free-for-all. Every soldier for themselves. First to 30 kills.', teams: false },
  dom: { name: 'DOMINATION', desc: 'Two teams fight over flags A, B and C. Each flag you hold scores. First to 200.', teams: true },
  hp:  { name: 'HARDPOINT',  desc: 'Stand in the hill to score. It moves every minute. First to 150.', teams: true },
  dday: { name: 'D-DAY', desc: '50 vs 50 on Normandy. Pick your role: storm the beach by boat, drop in by parachute, or fly a fighter and bomb. Hold flags A to E. First to 500.', teams: true, map: 'normandy' },
  inf: { name: 'INFECTED',   desc: 'One slow zombie with a knife. Survivors are fast. Everyone it kills turns. Survive 5 minutes.', teams: true },
};
const TEAM_NAMES = { dday: ['ALLIES', 'AXIS'], dom: ['RANGERS', 'SPECTRE'], hp: ['RANGERS', 'SPECTRE'], inf: ['SURVIVORS', 'INFECTED'] };
const TEAM_COLORS = ['#4aa3ff', '#ff4a3d'];
const ZOMBIE_GREEN = '#8fdc3a';
const INF_SURVIVOR_SPEED = 1.18; // Infected: survivors get a speed boost, zombies are slowed by the knife's move value
const DOM_R = 3.5, HP_R = 4, HP_ROTATE_MS = 60000, DDAY_R = 8; // must match server.py
// D-Day plays its flags like Domination, with bigger flag zones for 100 players.
const isDom = (mode) => mode === 'dom' || mode === 'dday';
const domR = (mode) => (mode === 'dday' ? DDAY_R : DOM_R);


const settings = Object.assign({ sens: 1, fov: 80, vol: 0.7, name: '', loadout: 'assault', char: 'bulwark', offMap: 'harbor', offMode: 'ffa', offBots: 5, offDiff: 'normal', ddayRole: 'random' },
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
  grass: () => canvasTex(512, (g, s) => {
    g.fillStyle = '#5f7f3a'; g.fillRect(0, 0, s, s);
    blotch(g, s, 40, '70,95,40', 0.35, 110); blotch(g, s, 25, '140,150,80', 0.2, 90);
    for (let i = 0; i < 9000; i++) { g.fillStyle = `rgba(${Math.random() < 0.5 ? '40,70,25' : '130,160,80'},${Math.random() * 0.5})`; g.fillRect(Math.random() * s, Math.random() * s, 1, 2 + Math.random() * 4); }
  }),
  hedge: () => canvasTex(256, (g, s) => {
    g.fillStyle = '#34471f'; g.fillRect(0, 0, s, s);
    for (let i = 0; i < 2600; i++) {
      const x = Math.random() * s, y = Math.random() * s, r = 2 + Math.random() * 7;
      g.fillStyle = `hsl(${rand(80, 110)},${rand(30, 50)}%,${rand(14, 32)}%)`;
      g.beginPath(); g.arc(x, y, r, 0, 7); g.fill();
    }
  }),
  sidewalk: () => canvasTex(512, (g, s) => {
    g.fillStyle = '#b3aea4'; g.fillRect(0, 0, s, s);
    blotch(g, s, 25, '120,115,105', 0.2, 100); grain(g, s, 12000, 0.12);
    g.fillStyle = 'rgba(70,65,60,0.5)'; for (let i = 0; i < s; i += 128) { g.fillRect(i, 0, 3, s); g.fillRect(0, i, s, 3); }
  }),
  shingle: () => canvasTex(256, (g, s) => {
    g.fillStyle = '#3d3532'; g.fillRect(0, 0, s, s);
    for (let y = 0; y < s; y += 16) for (let x = -(y % 32); x < s; x += 32) {
      const v = 50 + Math.random() * 25; g.fillStyle = `rgb(${v + 12},${v},${v - 4})`; g.fillRect(x + 1, y + 1, 30, 14);
    }
    grain(g, s, 4000, 0.15);
  }),
  woodfloor: () => canvasTex(256, (g, s) => {
    g.fillStyle = '#8a6440'; g.fillRect(0, 0, s, s);
    for (let y = 0; y < s; y += 21) { g.fillStyle = `rgba(${Math.random() < 0.5 ? 60 : 170},${Math.random() < 0.5 ? 40 : 120},20,0.25)`; g.fillRect(0, y, s, 20); g.fillStyle = 'rgba(40,25,10,0.6)'; g.fillRect(0, y + 20, s, 1); g.fillRect(Math.random() * s, y, 1, 20); }
    grain(g, s, 3000, 0.12);
  }),
  picket: () => canvasTex(256, (g, s) => {
    g.clearRect(0, 0, s, s); g.fillStyle = '#ecebe4';
    for (let x = 4; x < s; x += 32) { g.beginPath(); g.moveTo(x, s); g.lineTo(x, 26); g.lineTo(x + 10, 6); g.lineTo(x + 20, 26); g.lineTo(x + 20, s); g.fill(); }
    g.fillRect(0, 70, s, 14); g.fillRect(0, 190, s, 14);
    g.fillStyle = 'rgba(0,0,0,0.12)'; for (let x = 4; x < s; x += 32) g.fillRect(x + 16, 26, 4, s);
  }),
  chain: () => canvasTex(128, (g, s) => {
    g.clearRect(0, 0, s, s); g.strokeStyle = '#9aa0a4'; g.lineWidth = 2;
    for (let i = -s; i < s * 2; i += 16) { g.beginPath(); g.moveTo(i, 0); g.lineTo(i + s, s); g.stroke(); g.beginPath(); g.moveTo(i, s); g.lineTo(i + s, 0); g.stroke(); }
  }),
};
function sidingTex(hex) {
  return () => canvasTex(256, (g, s) => {
    g.fillStyle = hex; g.fillRect(0, 0, s, s);
    for (let y = 0; y < s; y += 16) { g.fillStyle = 'rgba(0,0,0,0.18)'; g.fillRect(0, y + 14, s, 2); g.fillStyle = 'rgba(255,255,255,0.08)'; g.fillRect(0, y, s, 3); }
    blotch(g, s, 12, '90,80,60', 0.15, 60); grain(g, s, 4000, 0.1);
  });
}
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
  grass:     { tex: TEX.grass, ts: 6, rough: 1, surf: 'dust' },
  hedge:     { tex: TEX.hedge, ts: 2.5, rough: 1, surf: 'wood' },
  steel:     { color: 0x3b3a38, rough: 0.7, metal: 0.5, surf: 'metal' },
  hull:      { color: 0x5f6a70, rough: 0.6, metal: 0.4, surf: 'metal' },
  sidewalk:  { tex: TEX.sidewalk, ts: 3, rough: 0.95, surf: 'dust' },
  shingle:   { tex: TEX.shingle, ts: 2, rough: 0.95, surf: 'wood' },
  woodfloor: { tex: TEX.woodfloor, ts: 2.5, rough: 0.8, surf: 'wood' },
  picket:    { tex: TEX.picket, ts: 1.2, rough: 0.8, surf: 'wood', alpha: true },
  chain:     { tex: TEX.chain, ts: 1.4, rough: 0.5, metal: 0.5, surf: 'metal', alpha: true },
  siding_mint:  { tex: sidingTex('#9fc9b4'), ts: 2.4, rough: 0.85, surf: 'wood' },
  siding_cream: { tex: sidingTex('#e1d3a8'), ts: 2.4, rough: 0.85, surf: 'wood' },
  siding_rose:  { tex: sidingTex('#c99a8c'), ts: 2.4, rough: 0.85, surf: 'wood' },
  trim:      { color: 0xf1efe8, rough: 0.6, surf: 'wood' },
  drywall:   { color: 0xd9d2c3, rough: 0.95, surf: 'dust' },
  ceiling:   { color: 0xe8e2d4, emissive: 0x6e675c, ei: 1, rough: 0.95, surf: 'dust' },
  paint_teal:  { color: 0x2f8a86, rough: 0.35, metal: 0.4, surf: 'metal' },
  paint_red:   { color: 0x9a2a22, rough: 0.35, metal: 0.4, surf: 'metal' },
  paint_cream: { color: 0xe7dcc0, rough: 0.35, metal: 0.4, surf: 'metal' },
  paint_sky:   { color: 0x7fb2cf, rough: 0.35, metal: 0.4, surf: 'metal' },
  chrome:    { color: 0xc8ccd0, rough: 0.2, metal: 0.9, surf: 'metal' },
  glass:     { color: 0x1d2a33, rough: 0.05, metal: 0.8, surf: 'metal' },
  rubber:    { color: 0x1a1a1a, rough: 0.9, surf: 'dust' },
  rock:      { color: 0xb08a63, rough: 1, surf: 'sand' },
};
const MATS = {};
function mat(key) {
  if (MATS[key]) return MATS[key];
  const d = MATDEFS[key];
  const m = new THREE.MeshStandardMaterial({
    map: d.tex ? d.tex() : null, color: d.color ?? 0xffffff, roughness: d.rough ?? 0.9, metalness: d.metal ?? 0,
    emissive: d.emissive ?? 0x000000, emissiveIntensity: d.ei ?? 1,
    alphaTest: d.alpha ? 0.5 : 0, side: d.alpha ? THREE.DoubleSide : THREE.FrontSide,
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
  // Decoration only: any mesh, no collision, no bullet impacts.
  deco(geo, m, x, y, z, ry = 0, rx = 0, rz = 0) {
    const mesh = new THREE.Mesh(geo, typeof m === 'string' ? mat(m) : m);
    mesh.position.set(x, y, z); mesh.rotation.set(rx, ry, rz);
    mesh.castShadow = mesh.receiveShadow = true;
    this.group.add(mesh); return mesh;
  }
  // A straight wall along X or Z with door/window holes: openings are { c, w, y0, y1 }.
  wallOpen(axis, fixed, from, to, y0, y1, t, m, openings = []) {
    const seg = (a, b, ya, yb) => {
      if (b - a < 0.02 || yb - ya < 0.02) return;
      if (axis === 'x') this.box((a + b) / 2, ya, fixed, b - a, yb - ya, t, m);
      else this.box(fixed, ya, (a + b) / 2, t, yb - ya, b - a, m);
    };
    let cur = from;
    for (const o of [...openings].sort((p, q) => p.c - q.c)) {
      const a = o.c - o.w / 2, b = o.c + o.w / 2;
      seg(cur, a, y0, y1);
      seg(a, b, y0, o.y0);
      seg(a, b, o.y1, y1);
      // White frame around the opening.
      const fy = (o.y0 + o.y1) / 2, fh = o.y1 - o.y0;
      if (axis === 'x') { for (const e of [a, b]) this.box(e, o.y0, fixed, 0.08, fh, t + 0.06, 'trim', { collide: false }); this.box(o.c, o.y1, fixed, o.w + 0.16, 0.08, t + 0.06, 'trim', { collide: false }); }
      else { for (const e of [a, b]) this.box(fixed, o.y0, e, t + 0.06, fh, 0.08, 'trim', { collide: false }); this.box(fixed, o.y1, o.c, t + 0.06, 0.08, o.w + 0.16, 'trim', { collide: false }); }
      void fy;
      cur = b;
    }
    seg(cur, to, y0, y1);
  }
  // Floor slab over [x0,x1]x[z0,z1] with a rectangular stairwell hole.
  slab(x0, x1, z0, z1, y, th, m, hole) {
    const piece = (a, b, c, d) => { if (b - a > 0.02 && d - c > 0.02) this.box((a + b) / 2, y, (c + d) / 2, b - a, th, d - c, m); };
    if (!hole) return piece(x0, x1, z0, z1);
    const [hx0, hx1, hz0, hz1] = hole;
    piece(x0, x1, z0, hz0); piece(x0, x1, hz1, z1);
    piece(x0, hx0, hz0, hz1); piece(hx1, x1, hz0, hz1);
  }
  // Straight flight of stairs climbing `height` toward +X or -X (dir), starting at x0.
  flight(x0, z, dir, width, height, m) {
    const n = Math.ceil(height / 0.3), sd = 0.42;
    for (let k = 0; k < n; k++) this.box(x0 + dir * (k + 0.5) * sd, 0, z, sd, height * (k + 1) / n, width, m);
    return x0 + dir * n * sd;
  }
  // Two-storey house you can walk through. Walls are 0.3 thick; floor 2 sits at y = 3.
  // cfg.open: { n|s|e|w: [ { c, w, y0, y1 } ] } holes per side for each floor (open1, open2).
  house(cfg) {
    const { x0, x1, z0, z1, siding } = cfg, t = 0.3, F = 3, H = 5.8;
    const sides = (y0, y1, open) => {
      this.wallOpen('x', z0 + t / 2, x0, x1, y0, y1, t, siding, open.n);
      this.wallOpen('x', z1 - t / 2, x0, x1, y0, y1, t, siding, open.s);
      this.wallOpen('z', x0 + t / 2, z0 + t, z1 - t, y0, y1, t, siding, open.w);
      this.wallOpen('z', x1 - t / 2, z0 + t, z1 - t, y0, y1, t, siding, open.e);
    };
    sides(0, F - 0.25, cfg.open1);
    sides(F, H, cfg.open2);
    this.box((x0 + x1) / 2, 0, (z0 + z1) / 2, x1 - x0 - 2 * t, 0.03, z1 - z0 - 2 * t, 'woodfloor', { collide: false, shadow: false });
    // Floor band between storeys, the upstairs slab with its stairwell, and the stairs.
    this.box((x0 + x1) / 2, F - 0.25, z0 - 0.02, x1 - x0 + 0.1, 0.25, 0.06, 'trim', { collide: false });
    this.box((x0 + x1) / 2, F - 0.25, z1 + 0.02, x1 - x0 + 0.1, 0.25, 0.06, 'trim', { collide: false });
    const st = cfg.stairs, len = Math.ceil(F / 0.3) * 0.42;
    const sx0 = st.dir > 0 ? st.x : st.x - len, sx1 = st.dir > 0 ? st.x + len : st.x;
    this.slab(x0 + t, x1 - t, z0 + t, z1 - t, F - 0.25, 0.25, 'woodfloor', [sx0 - 0.1, sx1 + 0.1, st.z - st.w / 2 - 0.1, st.z + st.w / 2 + 0.1]);
    this.flight(st.x, st.z, st.dir, st.w, F, 'woodfloor');
    // Painted ceilings so the rooms aren't dark wood caves.
    const ceil = (y, hole) => {
      const c = (a, b2, e, f) => { if (b2 - a > 0.02 && f - e > 0.02) this.box((a + b2) / 2, y, (e + f) / 2, b2 - a, 0.02, f - e, 'ceiling', { collide: false, ray: false, shadow: false }); };
      if (!hole) return c(x0 + t, x1 - t, z0 + t, z1 - t);
      const [a, b2, e, f] = hole;
      c(x0 + t, x1 - t, z0 + t, e); c(x0 + t, x1 - t, f, z1 - t); c(x0 + t, a, e, f); c(b2, x1 - t, e, f);
    };
    ceil(F - 0.27, [sx0 - 0.1, sx1 + 0.1, st.z - st.w / 2 - 0.1, st.z + st.w / 2 + 0.1]);
    ceil(H - 0.02);
    // Railing along the open side of the stairwell upstairs.
    const railZ = st.rail === 'n' ? st.z - st.w / 2 - 0.15 : st.z + st.w / 2 + 0.15;
    this.box((sx0 + sx1) / 2 - st.dir * 0.4, F, railZ, sx1 - sx0 - 0.8, 1, 0.08, 'trim');
    // Interior divider wall downstairs with a doorway.
    if (cfg.divider) this.wallOpen('z', cfg.divider, z0 + t, z1 - t, 0, F - 0.25, 0.15, 'drywall', [{ c: cfg.dividerDoor, w: 1.2, y0: 0, y1: 2.3 }]);
    // Flat roof you can't reach, under a pitched shingle roof for the look.
    this.slab(x0 - 0.3, x1 + 0.3, z0 - 0.3, z1 + 0.3, H, 0.2, 'trim');
    const cx = (x0 + x1) / 2, cz = (z0 + z1) / 2, w = x1 - x0 + 0.9, d = z1 - z0 + 0.9, rise = 2.6;
    const slope = Math.hypot(d / 2, rise), ang = Math.atan2(rise, d / 2);
    for (const sgn of [-1, 1]) this.deco(boxGeo(w, 0.12, slope, 2), 'shingle', cx, H + 0.2 + rise / 2, cz + sgn * d / 4, 0, sgn * ang);
    const gable = new THREE.BufferGeometry().setFromPoints([new V3(0, 0, -d / 2), new V3(0, 0, d / 2), new V3(0, rise, 0)]);
    gable.computeVertexNormals();
    for (const gx of [x0 - 0.3, x1 + 0.3]) this.deco(gable, new THREE.MeshStandardMaterial({ color: 0xf1efe8, roughness: 0.7, side: THREE.DoubleSide }), gx, H + 0.2, cz);
    if (cfg.chimney) this.box(cfg.chimney[0], H, cfg.chimney[1], 0.8, 2.4, 0.8, 'brick', { collide: false });
  }
  fence(x0, z0, x1, z1, h, m) {
    const alongX = Math.abs(x1 - x0) > Math.abs(z1 - z0);
    if (alongX) this.box((x0 + x1) / 2, 0, z0, Math.abs(x1 - x0), h, 0.08, m, { ts: h });
    else this.box(x0, 0, (z0 + z1) / 2, 0.08, h, Math.abs(z1 - z0), m, { ts: h });
  }
  wheels(x, z, alongX, len, wid, r = 0.38) {
    const geo = new THREE.CylinderGeometry(r, r, 0.26, 16);
    for (const a of [-1, 1]) for (const b of [-1, 1]) {
      const px = alongX ? x + a * len : x + b * wid, pz = alongX ? z + b * wid : z + a * len;
      this.deco(geo, 'rubber', px, r, pz, 0, alongX ? Math.PI / 2 : 0, alongX ? 0 : Math.PI / 2);
    }
  }
  pickup(x, z, alongX, paint) {
    const L = 5.2, W = 2.0, ax = (a) => (alongX ? [x + a, z] : [x, z + a]);
    const B = (a, y, l, h, w, m, o) => { const [px, pz] = ax(a); return alongX ? this.box(px, y, pz, l, h, w, m, o) : this.box(px, y, pz, w, h, l, m, o); };
    B(0, 0.45, L, 0.55, W, paint);                     // chassis
    B(0.55, 1.0, 1.7, 0.85, W - 0.1, paint);           // cab
    B(0.55, 1.3, 1.72, 0.45, W - 0.05, 'glass', { collide: false });
    B(-1.35, 1.0, 2.2, 0.5, W, paint);                 // bed sides
    B(2.1, 1.0, 1.0, 0.3, W - 0.1, paint);             // hood
    B(2.62, 0.55, 0.06, 0.35, W, 'chrome', { collide: false });
    this.wheels(x, z, alongX, 1.7, W / 2 - 0.05);
  }
  van(x, z, alongX, paint) {
    const L = 5.6, W = 2.2, ax = (a) => (alongX ? [x + a, z] : [x, z + a]);
    const B = (a, y, l, h, w, m, o) => { const [px, pz] = ax(a); return alongX ? this.box(px, y, pz, l, h, w, m, o) : this.box(px, y, pz, w, h, l, m, o); };
    B(-0.3, 0.4, L - 0.6, 2.3, W, paint);
    B(2.45, 0.4, 0.9, 1.3, W, paint);
    B(2.0, 1.75, 0.06, 0.6, W - 0.2, 'glass', { collide: false });
    B(-0.3, 1.45, L - 0.62, 0.35, W + 0.02, 'paint_red', { collide: false });
    this.wheels(x, z, alongX, 1.9, W / 2 - 0.05);
  }
  trailer(x, z, alongX) {
    const L = 6, W = 2.3;
    this.box(x, 0.45, z, alongX ? L : W, 2.1, alongX ? W : L, 'paint_cream');
    this.box(x, 1.05, z, alongX ? L + 0.02 : W + 0.02, 0.22, alongX ? W + 0.02 : L + 0.02, 'paint_teal', { collide: false });
    const [wx, wz] = alongX ? [x, z + W / 2 + 0.01] : [x + W / 2 + 0.01, z];
    for (const o of [-1.5, 0.3, 1.8]) this.box(alongX ? wx + o : wx, 1.35, alongX ? wz : wz + o, alongX ? 0.9 : 0.04, 0.55, alongX ? 0.04 : 0.9, 'glass', { collide: false });
    this.wheels(x, z, alongX, 0.5, W / 2 - 0.05, 0.36);
  }
  sedan(x, z, alongX, paint) {
    const L = 4.6, W = 1.9;
    this.box(x, 0.35, z, alongX ? L : W, 0.65, alongX ? W : L, paint);
    this.box(alongX ? x - 0.2 : x, 1.0, alongX ? z : z - 0.2, alongX ? 2.2 : W - 0.2, 0.55, alongX ? W - 0.2 : 2.2, 'glass');
    this.wheels(x, z, alongX, 1.45, W / 2 - 0.05, 0.33);
  }
  pole(x, z, h = 8) {
    this.box(x, 0, z, 0.25, h, 0.25, 'wood');
    this.box(x, h - 0.8, z, 0.12, 0.12, 2.2, 'wood', { collide: false });
  }
  sign(x, z, a, b) {
    this.box(x, 0, z, 0.08, 3.2, 0.08, 'metal');
    for (const [txt, y, rot] of [[a, 3.0, 0], [b, 2.7, Math.PI / 2]]) {
      const c = document.createElement('canvas'); c.width = 256; c.height = 64;
      const g = c.getContext('2d'); g.fillStyle = '#1f6b3a'; g.fillRect(0, 0, 256, 64); g.strokeStyle = '#fff'; g.lineWidth = 4; g.strokeRect(4, 4, 248, 56);
      g.fillStyle = '#fff'; g.font = '700 34px Rajdhani, Arial'; g.textAlign = 'center'; g.fillText(txt, 128, 44);
      const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
      this.deco(new THREE.BoxGeometry(1.2, 0.28, 0.03), new THREE.MeshStandardMaterial({ map: t }), x, y, z, rot);
    }
  }
  mailbox(x, z) { this.box(x, 0, z, 0.08, 1.0, 0.08, 'wood'); this.box(x, 1.0, z, 0.25, 0.25, 0.45, 'paint_sky'); }
  lamp(x, z, h = 6) {
    this.box(x, 0, z, 0.18, h, 0.18, 'metal');
    this.box(x, h, z, 0.5, 0.18, 0.9, 'metal', { collide: false });
    this.box(x, h - 0.05, z, 0.35, 0.06, 0.7, 'lamp', { collide: false, ray: false, shadow: false });
  }
}

const MAPS = {
  harbor: {
    name: 'HARBOR', desc: 'Container yard • mid-range lanes', half: 44,
    zones: { dom: [[-23.5, -6], [-4.5, 7.5], [32, 0]], hp: [[-4.5, 7.5], [5.5, -25.5], [32, 0], [0, 23], [-23.5, -6]] },
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
    zones: { dom: [[-30, 2.5], [-6, 0], [30, -3.5]], hp: [[-6, 0], [0, -16], [18, 0], [0, 24], [-18, 0]] },
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
  sundown: {
    name: 'SUNDOWN', desc: '1960s desert town • two houses, fast & close', half: 34,
    zones: { dom: [[-24, 0], [0, -2], [24, 0]], hp: [[0, -2], [-24, 0], [24, 0], [-15.5, -23.5], [5.5, 31]] },
    env: { sky: [0x5b9ae0, 0xf3dfc2], fog: [0xead9c0, 70, 280], sun: [0xfff0d4, 3.4, [40, 75, 25]], hemi: [0xcfe0ff, 0x8a7458, 1.05], exposure: 1.05 },
    build(b) {
      const W = (c, w = 1.4) => ({ c, w, y0: 1.0, y1: 2.15 });         // ground-floor window
      const U = (c, w = 1.3) => ({ c, w, y0: 4.0, y1: 5.15 });         // upstairs window
      const D = (c, w = 1.3) => ({ c, w, y0: 0, y1: 2.3 });            // doorway
      b.ground('sand', 260);
      b.perimeter(34, 3, 'chain');
      // Street, sidewalks, lawns and driveways.
      b.decal(0, 0, 68, 12, 'asphalt');
      for (let x = -30; x <= 30; x += 6) b.box(x, 0.016, 0, 3, 0.005, 0.18, 'paint_y', { collide: false, ray: false, shadow: false });
      b.decal(0, -7, 68, 2, 'sidewalk'); b.decal(0, 7, 68, 2, 'sidewalk');
      b.decal(0, -21, 68, 26, 'grass'); b.decal(0, 21, 68, 26, 'grass');
      b.box(3, 0.02, -11.2, 3.6, 0.02, 6.4, 'sidewalk', { collide: false, shadow: false });
      b.box(-1, 0.02, 11.4, 3.6, 0.02, 6.8, 'sidewalk', { collide: false, shadow: false });
      b.box(-8, 0.02, -11, 1.4, 0.02, 6, 'sidewalk', { collide: false, shadow: false });
      b.box(5, 0.02, 11, 1.4, 0.02, 6, 'sidewalk', { collide: false, shadow: false });

      // --- House A (north side, mint): front door faces the street.
      b.house({ x0: -12, x1: 0, z0: -24, z1: -14, siding: 'siding_mint',
        open1: { s: [D(-8), W(-3.2), W(-10.6, 1.1)], n: [D(-2), W(-5)], w: [W(-18)], e: [D(-16, 1.1)] },
        open2: { s: [U(-10), U(-6), U(-2.2)], n: [U(-9), U(-3.5)], w: [U(-19)], e: [U(-21)] },
        stairs: { x: -11.6, z: -22.6, dir: 1, w: 1.2, rail: 's' }, divider: -5, dividerDoor: -17, chimney: [-10.5, -15.5] });
      // Garage A with an open door, then its flat roof.
      b.wallOpen('x', -14.65, 0, 6, 0, 3.2, 0.3, 'siding_mint', [{ c: 3, w: 3.2, y0: 0, y1: 2.6 }]);
      b.wallOpen('x', -22.85, 0, 6, 0, 3.2, 0.3, 'siding_mint');
      b.wallOpen('z', 5.85, -22.7, -14.8, 0, 3.2, 0.3, 'siding_mint', [W(-19, 1.2)]);
      b.box(3, 3.2, -18.75, 6.6, 0.22, 8.8, 'shingle');
      b.crate(1.2, -21.6, 1.1, 2); b.barrel(4.8, -21.8, 0x8a3a2a); b.box(4.6, 0, -16.2, 1.6, 0.9, 0.7, 'wood');

      // --- House B (south side, cream): different floor plan, porch out front.
      b.house({ x0: 2, x1: 13, z0: 14, z1: 25, siding: 'siding_cream',
        open1: { n: [D(5), W(10.2)], s: [D(4), W(7.2)], e: [W(19.5)], w: [D(22, 1.1), W(17)] },
        open2: { n: [U(4), U(8), U(11.4)], s: [U(5), U(10)], e: [U(20)], w: [U(18)] },
        stairs: { x: 12.6, z: 24.0, dir: -1, w: 1.2, rail: 'n' }, divider: 6.5, dividerDoor: 17.5, chimney: [11.5, 15.5] });
      for (const px of [2.4, 7.6]) b.box(px, 0, 12.4, 0.2, 2.7, 0.2, 'trim');
      b.box(5, 2.7, 13, 6, 0.18, 2.2, 'shingle');
      b.box(5, 0, 12.9, 5.4, 0.18, 2, 'wood', { collide: false });
      // Garage B
      b.wallOpen('x', 15.15, -4.5, 2, 0, 3.2, 0.3, 'siding_cream', [{ c: -1.25, w: 3.2, y0: 0, y1: 2.6 }]);
      b.wallOpen('x', 24.35, -4.5, 2, 0, 3.2, 0.3, 'siding_cream');
      b.wallOpen('z', -4.35, 15.3, 24.2, 0, 3.2, 0.3, 'siding_cream', [W(19.5, 1.2)]);
      b.box(-1.25, 3.2, 19.75, 7.1, 0.22, 9.6, 'shingle');
      b.crate(-3.2, 22.8, 1.1); b.barrel(0.8, 23.2); b.box(-3, 0, 17, 0.7, 1.4, 1.8, 'metal');

      // --- Street cover: vehicles of my own design.
      b.pickup(-15, -2.6, true, 'paint_teal');
      b.van(15, 2.6, true, 'paint_sky');
      b.trailer(-1.5, 3.0, true);
      b.sedan(6.5, -3.0, true, 'paint_red');
      b.sedan(3, -10.5, false, 'paint_cream');
      b.pickup(-1.2, 10.8, false, 'paint_red');

      // --- Front yards: picket fences with gaps for the paths.
      b.fence(-26, -9, -9, -9, 1.0, 'picket'); b.fence(-7, -9, 0.8, -9, 1.0, 'picket');
      b.fence(5.4, -9, 26, -9, 1.0, 'picket');
      b.fence(-26, 9, -3.4, 9, 1.0, 'picket'); b.fence(1.6, 9, 4, 9, 1.0, 'picket'); b.fence(6, 9, 26, 9, 1.0, 'picket');
      b.mailbox(-9.6, -8.4); b.mailbox(6.6, 8.4);
      b.sign(-19.5, -7.6, 'MESA DR', 'CACTUS LN');
      for (const [x, z] of [[-26, -7.6], [-4, 7.6], [12, -7.6], [27, 7.6]]) b.lamp(x, z, 5.5);
      for (const [x, z] of [[-30, 8.2], [-10, -8.2], [10, 8.2], [30, -8.2]]) b.pole(x, z);

      // --- Back yards: sheds, fences, clutter.
      b.fence(-26, -27.5, -14, -27.5, 1.0, 'picket'); b.fence(-10, -27.5, 10, -27.5, 1.0, 'picket');
      b.building(-18, -31, 4.5, 3.4, 2.6, ['e'], 'siding_rose', 'shingle');
      b.box(-4, 0, -31, 2.2, 0.75, 1.0, 'wood'); for (const dz of [-0.9, 0.9]) b.box(-4, 0, -31 + dz, 2.2, 0.45, 0.35, 'wood');
      b.crate(6, -31, 1.2, 2); b.crate(7.4, -30.6, 1.2); b.barrel(9, -32);
      b.fence(-10, 27.5, 0, 27.5, 1.0, 'picket'); b.fence(4, 27.5, 26, 27.5, 1.0, 'picket');
      b.building(19, 30.5, 4.5, 3.4, 2.6, ['w'], 'siding_rose', 'shingle');
      b.box(9, 0, 31, 0.9, 0.9, 0.9, 'metal'); b.crate(-6, 30.5, 1.2, 2); b.crate(-4.6, 31, 1.2); b.barrel(-8, 31.5, 0x8a3a2a);
      // --- Side lots at each end of the street.
      b.container(-29.5, -18, 1, 'orange'); b.crate(-27.5, 16, 1.3, 2); b.crate(-29, 18, 1.3); b.barrel(-26.5, 20);
      b.container(29.5, 18, 1, 'gray'); b.crate(27.5, -16, 1.3, 2); b.crate(29, -18.2, 1.3); b.barrel(26.5, -20, 0x8a3a2a);
      b.box(-22, 0, 14, 0.9, 1, 4, 'sandbag'); b.box(22, 0, -14, 0.9, 1, 4, 'sandbag');

      // --- Backdrop: a water tower and desert mesas beyond the fence.
      for (const [lx, lz] of [[-2, -2], [2, -2], [-2, 2], [2, 2]]) b.deco(new THREE.CylinderGeometry(0.15, 0.15, 14, 6), 'metal', 12 + lx, 7, -48 + lz);
      b.deco(new THREE.CylinderGeometry(3.2, 3.2, 4, 18), 'cont_white', 12, 16, -48);
      b.deco(new THREE.ConeGeometry(3.4, 1.4, 18), 'metal', 12, 18.7, -48);
      const r = mulberry32(77);
      for (let i = 0; i < 16; i++) {
        const a = (i / 16) * Math.PI * 2 + r() * 0.3, dist = 120 + r() * 40, h = 14 + r() * 26;
        b.deco(new THREE.CylinderGeometry(10 + r() * 14, 22 + r() * 18, h, 7), 'rock', Math.cos(a) * dist, h / 2 - 1, Math.sin(a) * dist, r() * 3);
      }
    },
  },
  foundry: {
    name: 'FOUNDRY', desc: 'Warehouse at dusk • close quarters & raised deck', half: 38,
    zones: { dom: [[-27, 0], [0, -7.5], [27.5, 0]], hp: [[0, -7.5], [0, -26.5], [22, -4.5], [0, 17.5], [-22, -4.5]] },
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
  normandy: {
    name: 'NORMANDY', desc: 'D-Day • long beach, bunkers, two villages, a manor, hedgerows & a gun battery', half: 240, dday: true,
    // A and B: bunkers on the bluff. C: the village. D: the farm. E: the gun battery.
    zones: { dom: [[-25, -120], [-25, 100], [25, 10], [110, 110], [150, -90]], hp: [[-25, -120], [-25, 100], [25, 10], [110, 110], [150, -90]] },
    env: { sky: [0x7890a8, 0xd5d8d4], fog: [0xb7bfc3, 110, 420], sun: [0xfff0d8, 2.9, [-70, 95, 45]], hemi: [0xc8d4e2, 0x6b6450, 1.15], exposure: 1.0 },
    build(b) {
      const r = mulberry32(1944);
      const H = 240;
      // Hedgerows stay out of the villages, the farm, the battery and the rear camp.
      const keep = [[-2, -180, 60, 72], [84, 84, 140, 136], [126, -140, 178, -40], [26, 148, 80, 196], [196, -60, 236, 90]];
      const open = (x0, z0, x1, z1) => !keep.some(([a, c, e, f]) => x1 > a && x0 < e && z1 > c && z0 < f);
      // Beach sand to the west (sea floor too), fields inland.
      // Ground runs far past the fog so you never see an edge, even from a plane.
      b.box(-390, -1, 0, 720, 1, 1800, 'sand', { collide: false, shadow: false });
      b.box(435, -1, 0, 930, 1, 1800, 'grass', { collide: false, shadow: false });
      // The sea: a moving water surface over the shallow sand.
      const water = new THREE.Mesh(new THREE.PlaneGeometry(1100, 1800, 1, 1).rotateX(-Math.PI / 2),
        new THREE.MeshStandardMaterial({ color: 0x31586a, roughness: 0.25, metalness: 0.2, transparent: true, opacity: 0.88 }));
      water.position.set(-645, 0.12, 0);
      water.receiveShadow = true;
      water.userData.water = true;
      b.group.add(water);
      b.decal(-92, 0, 6, 2 * H, 'sand');
      // Czech hedgehogs: steel beach obstacles, merged into one mesh because there are hundreds.
      const beam = new THREE.BoxGeometry(0.18, 0.18, 2.3), beams = [];
      const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), one = new V3(1, 1, 1);
      const beamAt = (x, y, z, ry, rx, rz) => beams.push(beam.clone().applyMatrix4(m4.compose(new V3(x, y, z), q.setFromEuler(new THREE.Euler(rx, ry, rz)), one)));
      for (let x = -86; x <= -50; x += 9) {
        for (let z = -H + 8; z <= H - 8; z += 11) {
          if (r() < 0.35) continue;
          const hx = x + (r() - 0.5) * 4, hz = z + (r() - 0.5) * 5;
          beamAt(hx, 0.65, hz, 0.4, 0.75, 0);
          beamAt(hx, 0.65, hz, -0.4, -0.75, 0);
          beamAt(hx, 0.65, hz, Math.PI / 2, 0, 0.8);
          b.colliders.push(new THREE.Box3(new V3(hx - 0.6, 0, hz - 0.6), new V3(hx + 0.6, 1.2, hz + 0.6)));
        }
      }
      b.deco(mergeGeometries(beams), 'steel', 0, 0, 0);
      // Wrecked landing craft: cover on the open sand.
      for (let i = 0; i < 15; i++) {
        const cx = -82 + r() * 26, cz = (r() * 2 - 1) * (H - 20);
        b.box(cx, 0, cz, 7.5, 1.5, 0.3, 'hull'); b.box(cx, 0, cz + 3.1, 7.5, 1.5, 0.3, 'hull');
        b.box(cx + 3.6, 0, cz + 1.55, 0.3, 1.5, 2.8, 'hull');
      }
      // Seawall with gaps to push through.
      for (let z = -H; z < H; z += 32) b.box(-42, 0, z + 13, 1.1, 1.4, 26, 'concrete');
      // Bunkers on the bluff: open firing slit facing the sea, door at the back.
      const bunker = (x, z) => {
        const W = 8, D = 6, Hh = 2.7, t = 0.55;
        b.wall(x + D / 2 - t / 2, z - W / 2, x + D / 2 - t / 2, z + W / 2, Hh, t, 'concrete', true);
        b.box(x, 0, z - W / 2 + t / 2, D, Hh, t, 'concrete');
        b.box(x, 0, z + W / 2 - t / 2, D, Hh, t, 'concrete');
        b.box(x - D / 2 + t / 2, 0, z, t, 1.15, W, 'concrete');
        b.box(x + D / 4, Hh, z, D / 2 + 0.6, 0.45, W + 0.4, 'concrete');
        b.box(x - D / 2 - 1, 0, z, 0.9, 0.9, W + 3, 'sandbag');
      };
      for (const z of [-205, -160, -120, -78, -38, 20, 60, 100, 145, 195]) bunker(-28, z);
      // Trench lines behind the bunkers.
      for (let z = -H + 10; z < H - 10; z += 20) {
        if (r() < 0.2) continue;
        b.box(-14, 0, z, 0.9, 1.05, 12 + r() * 4, 'sandbag');
      }
      for (const z of [-185, -140, -100, -58, -5, 40, 80, 122, 170]) { b.box(-20, 0, z, 3, 1, 0.9, 'sandbag'); b.box(-21.5, 0, z + 1.4, 0.9, 1, 3.6, 'sandbag'); }
      // Village around flag C.
      const town = [[10, -18, 9, 8, 5.5, 'se', 'plaster'], [24, -22, 8, 7, 4.5, 'nw', 'brick'], [40, -16, 10, 9, 6, 'sw', 'plaster'],
        [8, 30, 10, 8, 5, 'ne', 'brick'], [26, 32, 9, 9, 4.5, 'nw', 'plaster'], [44, 30, 8, 10, 5.5, 'sw', 'brick'],
        [52, 8, 8, 8, 4.5, 'wn', 'plaster'], [2, 6, 7, 8, 4.5, 'es', 'plaster']];
      for (const [x, z, w, d, h, doors, m] of town) {
        b.building(x, z, w, d, h, doors.split(''), m, 'roof');
        b.crate(x + w / 2 - 1.3, z - d / 2 + 1.3, 1.1);
      }
      // Church with a bell tower: the landmark you can see from the beach.
      b.building(33, 52, 12, 18, 7, ['s', 'w'], 'plaster', 'roof');
      b.box(33, 0, 64, 5, 18, 5, 'plaster');
      b.box(33, 18, 64, 5.6, 1.6, 5.6, 'roof', { collide: false });
      // Square: rubble, a cart and sandbags.
      b.box(25, 0, 10, 4, 0.7, 4, 'concrete'); b.box(25, 0.7, 10, 1, 1.3, 1, 'concrete');
      for (const [x, z] of [[17, 4], [33, 16], [19, 18], [32, 2]]) b.box(x, 0, z, 2.6, 1, 0.9, 'sandbag');
      b.crate(14, 14, 1.2, 2); b.crate(36, 6, 1.2); b.barrel(30, 20, 0x4a5a3a); b.barrel(30.7, 20.4, 0x4a5a3a);
      // A hamlet on the southern flank.
      for (const [x, z, w, d, h, doors, m] of [[12, -138, 9, 8, 5, 'ne', 'plaster'], [30, -146, 8, 7, 4.5, 'nw', 'brick'],
        [47, -136, 9, 9, 5, 'sw', 'plaster'], [18, -166, 8, 8, 4.5, 'en', 'brick'], [40, -168, 10, 8, 5.5, 'ws', 'plaster']]) {
        b.building(x, z, w, d, h, doors.split(''), m, 'roof');
      }
      b.box(30, 0, -156, 2.6, 1, 0.9, 'sandbag'); b.crate(24, -152, 1.2, 2); b.barrel(36, -155, 0x4a5a3a);
      // A walled manor on the northern flank.
      b.building(52, 172, 16, 12, 8, ['s', 'w'], 'brick', 'roof');
      b.box(42, 0, 150, 16, 1.3, 0.6, 'brick'); b.box(64, 0, 150, 20, 1.3, 0.6, 'brick');
      b.box(34, 0, 160, 0.6, 1.3, 20, 'brick'); b.box(34, 0, 185, 0.6, 1.3, 18, 'brick');
      b.box(74, 0, 160, 0.6, 1.3, 20, 'brick'); b.box(74, 0, 186, 0.6, 1.3, 16, 'brick');
      b.box(54, 0, 194, 40, 1.3, 0.6, 'brick');
      b.crate(40, 158, 1.2, 2); b.crate(66, 186, 1.2);
      // Hedgerow fields inland.
      for (let x = 70; x <= 226; x += 26) {
        for (let z = -H + 6; z < H - 6; z += 30) {
          if (r() < 0.3) continue;
          const len = 16 + r() * 6;
          if (open(x - 1, z + 9 - len / 2, x + 1, z + 9 + len / 2)) b.box(x, 0, z + 9, 2, 2.4, len, 'hedge');
        }
      }
      for (let z = -H + 30; z <= H - 30; z += 52) {
        for (let x = 75; x <= 215; x += 28) if (r() < 0.6 && open(x + 4, z - 1, x + 22, z + 1)) b.box(x + 13, 0, z, 18, 2.4, 2, 'hedge');
      }
      // Farm at flag D.
      b.building(126, 122, 14, 10, 6, ['w', 's'], 'wood', 'roof');
      b.building(98, 126, 9, 8, 5, ['e', 's'], 'brick', 'roof');
      for (const [x, z] of [[102, 98], [116, 96], [108, 104]]) b.crate(x, z, 1.3, 1 + Math.floor(r() * 2));
      b.box(112, 0, 90, 6, 1.2, 0.5, 'wood');
      // Coastal gun battery at flag E: open gun pits facing the sea, a command post behind them.
      const barrel = new THREE.CylinderGeometry(0.2, 0.32, 7, 10).rotateZ(Math.PI / 2);
      const gunPit = (x, z) => {
        b.box(x + 4, 0, z, 0.8, 1.6, 10.6, 'concrete');
        b.box(x, 0, z - 5, 8, 1.6, 0.8, 'concrete'); b.box(x, 0, z + 5, 8, 1.6, 0.8, 'concrete');
        b.box(x - 4.4, 0, z, 0.9, 0.9, 5, 'sandbag');
        b.box(x, 0, z, 2.6, 1.2, 2.2, 'steel');
        b.box(x - 1, 1.2, z, 0.3, 1.5, 2.8, 'steel');
        b.deco(barrel, 'steel', x - 4.5, 1.85, z);
      };
      for (const z of [-126, -90, -54]) gunPit(136, z);
      b.building(166, -90, 10, 8, 3.2, ['w', 'e'], 'concrete', 'concrete');
      b.box(150, 0, -100, 4, 1, 0.9, 'sandbag'); b.box(147, 0, -82, 3.5, 1, 0.9, 'sandbag');
      b.crate(153, -95, 1.2, 2); b.crate(158, -104, 1.2, 2); b.crate(158, -76, 1.2);
      // Rear Axis lines: trenches and the camp the Axis infantry start from.
      for (let z = -210; z <= 210; z += 26) b.box(212, 0, z, 0.9, 1.1, 14, 'sandbag');
      b.building(222, -30, 12, 7, 3.5, ['w'], 'wood', 'roof');
      b.building(222, 40, 12, 7, 3.5, ['w'], 'wood', 'roof');
      for (const [x, z] of [[206, 5], [208, 12], [216, -50], [216, 72]]) b.crate(x, z, 1.2, 1 + Math.floor(r() * 2));
      // Allied fleet on the horizon.
      for (const [x, z, l] of [[-300, -260, 70], [-330, -150, 90], [-290, -40, 60], [-345, 60, 80], [-305, 170, 70], [-335, 280, 55]]) {
        b.box(x, 0, z, 14, 6, l, 'hull', { collide: false, ray: false });
        b.box(x, 6, z + l * 0.1, 8, 7, l * 0.25, 'hull', { collide: false, ray: false });
        b.box(x, 13, z + l * 0.1, 1.2, 9, 1.2, 'hull', { collide: false, ray: false });
      }
    },
  },
};

let mapGroup = null, colliders = [], mapMeshes = [], spawns = [], navPts = [], currentMap = null, mapHalf = 44, radarImg = null;
const sunOffset = new V3(), _sunLook = new V3();
let shadowFollow = false;

// Colliders bucketed into a 12 m grid, so collision and sight checks only look at nearby walls.
const GRID = 12;
let colGrid = new Map(), colStamp = 0;
const cellKey = (i, j) => (i + 2048) * 4096 + (j + 2048);
function buildColliderGrid() {
  colGrid = new Map();
  for (const c of colliders) {
    for (let i = Math.floor(c.min.x / GRID); i <= Math.floor(c.max.x / GRID); i++) {
      for (let j = Math.floor(c.min.z / GRID); j <= Math.floor(c.max.z / GRID); j++) {
        const k = cellKey(i, j);
        if (!colGrid.has(k)) colGrid.set(k, []);
        colGrid.get(k).push(c);
      }
    }
  }
}
// Every collider whose grid cells touch the given x/z rectangle, each listed once.
function collidersIn(x0, z0, x1, z1) {
  const out = [], stamp = ++colStamp;
  for (let i = Math.floor(Math.min(x0, x1) / GRID); i <= Math.floor(Math.max(x0, x1) / GRID); i++) {
    for (let j = Math.floor(Math.min(z0, z1) / GRID); j <= Math.floor(Math.max(z0, z1) / GRID); j++) {
      const list = colGrid.get(cellKey(i, j));
      if (!list) continue;
      for (const c of list) if (c._s !== stamp) { c._s = stamp; out.push(c); }
    }
  }
  return out;
}
const collidersNear = (x, z, r) => collidersIn(x - r, z - r, x + r, z + r);

function clearArea(x, z, r) {
  for (const b of collidersNear(x, z, r)) if (x + r > b.min.x && x - r < b.max.x && z + r > b.min.z && z - r < b.max.z && b.min.y < 2 && b.max.y > 0.05) return false;
  return true;
}
function computeSpawns(half) {
  const r = mulberry32(99), pts = [];
  const want = half > 200 ? 1800 : half > 80 ? 900 : 250;
  for (let i = 0; i < want * 6 && pts.length < want; i++) {
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
  const c = document.createElement('canvas'), S = half > 100 ? 1024 : 512, k = S / (2 * half);
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
  buildColliderGrid();
  mapMeshes = b.meshes;
  mapHalf = def.half;
  const e = def.env;
  sky.material.uniforms.top.value.set(e.sky[0]);
  sky.material.uniforms.bottom.value.set(e.sky[1]);
  scene.fog = new THREE.Fog(e.fog[0], e.fog[1], e.fog[2]);
  sun.color.set(e.sun[0]); sun.intensity = e.sun[1]; sun.position.set(...e.sun[2]);
  // Big maps get a shadow box that follows the camera (the sun sits further out so planes
  // cast shadows too), which keeps shadows as sharp as on the small maps.
  shadowFollow = def.half > 100;
  sunOffset.set(...e.sun[2]).multiplyScalar(shadowFollow ? 2 : 1);
  const sc = sun.shadow.camera, ext = shadowFollow ? 150 : def.half + 8;
  sc.left = -ext; sc.right = ext; sc.top = ext; sc.bottom = -ext; sc.near = 1; sc.far = shadowFollow ? 520 : 250;
  sc.updateProjectionMatrix();
  hemi.color.set(e.hemi[0]); hemi.groundColor.set(e.hemi[1]); hemi.intensity = e.hemi[2];
  renderer.toneMappingExposure = e.exposure;
  spawns = computeSpawns(def.half);
  radarImg = buildRadarImage(def.half);
  currentMap = id;
  clearEffects();
  clearGrenades();
  clearObjectives();
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
  swish: (vol = 0.35) => playNoise(0.14, 1700, vol),
  stab: () => { playNoise(0.08, 400, 0.6); playTone(180, 0.12, 0.25, 'sine', 0, 70); },
  capture: (good) => { playTone(good ? 660 : 440, 0.18, 0.2, 'triangle'); playTone(good ? 990 : 330, 0.3, 0.2, 'triangle', 0.15); },
  infected: () => { playTone(140, 0.6, 0.3, 'sawtooth', 0, 60); playNoise(0.5, 300, 0.4); },
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
  if (def.model === 'knife') {
    const blade = new THREE.MeshStandardMaterial({ color: 0xb8bcc0, roughness: 0.25, metalness: 0.9 });
    part(g, 0.03, 0.035, 0.12, 0, 0, 0.0, gunPoly);
    part(g, 0.07, 0.015, 0.02, 0, 0.005, -0.07, gunMetal);
    part(g, 0.008, 0.04, 0.2, 0, 0.008, -0.17, blade);
    part(g, 0.006, 0.02, 0.05, 0, 0.0, -0.285, blade, 0.5);
    part(g, 0.06, 0.06, 0.08, 0, -0.01, 0.01, gloveMat);
    const arm = part(g, 0.075, 0.075, 0.36, 0.05, -0.06, 0.2, sleeveMat); arm.rotation.set(0.3, -0.25, 0);
    g.rotation.set(0.15, 0.25, -0.35);
    g.userData.sightY = 0; g.userData.adsZ = -0.4; g.userData.hip = new V3(0.2, -0.2, -0.38);
    const dummy = new THREE.Sprite(new THREE.SpriteMaterial()); dummy.visible = false; g.add(dummy); g.userData.flash = dummy;
    return g;
  }
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

function makeNameTag(name, color = '#ff6a55') {
  const c = document.createElement('canvas'); c.width = 256; c.height = 64;
  const g = c.getContext('2d');
  g.font = '700 36px Rajdhani, Arial, sans-serif'; g.textAlign = 'center';
  g.fillStyle = 'rgba(0,0,0,0.6)'; g.fillText(name, 129, 44);
  g.fillStyle = color; g.fillText(name, 128, 42);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: t, transparent: true, depthWrite: false }));
  s.scale.set(1.3, 0.33, 1);
  return s;
}

// Camo and fabric textures for the operator outfits (cached, shared by every model).
const camoCache = {};
function camoTex(key, base, blobs, scale = 1) {
  if (camoCache[key]) return camoCache[key];
  const t = canvasTex(256, (g, s) => {
    g.fillStyle = base; g.fillRect(0, 0, s, s);
    const r = mulberry32(key.length * 977 + base.length);
    for (const [col, n, size] of blobs) {
      g.fillStyle = col;
      for (let i = 0; i < n; i++) {
        const x = r() * s, y = r() * s, w = size * (0.5 + r()), h = size * (0.3 + r() * 0.6);
        g.beginPath();
        // Lumpy blobs drawn three times so they wrap across the tile edges.
        for (const [ox, oy] of [[0, 0], [-s, 0], [0, -s], [s, 0], [0, s]]) {
          g.moveTo(x + ox + w, y + oy);
          for (let a = 0; a <= 6.3; a += 0.7) g.lineTo(x + ox + Math.cos(a) * w * (0.7 + r() * 0.4), y + oy + Math.sin(a) * h * (0.7 + r() * 0.4));
        }
        g.fill();
      }
    }
    grain(g, s, 5000, 0.12);
  });
  t.repeat.set(scale, scale);
  return (camoCache[key] = t);
}
const CAMO = {
  woodland: () => camoTex('woodland', '#4d5a3a', [['#2f3a26', 22, 26], ['#6b7550', 16, 22], ['#1f241a', 10, 14]], 2),
  multicam: () => camoTex('multicam', '#7d7558', [['#5c573f', 20, 24], ['#9a9070', 16, 20], ['#3e3a2a', 12, 12], ['#6e7a52', 8, 16]], 2),
  urban: () => camoTex('urban', '#5d6064', [['#3c3f43', 18, 24], ['#7c8085', 14, 20], ['#26282b', 10, 12]], 2),
  fleece: () => camoTex('fleece', '#6c6f74', [['#62656a', 60, 6], ['#76797e', 60, 5]], 3),
  khaki: () => camoTex('khaki', '#7b6c50', [['#6f6147', 40, 8], ['#86775a', 40, 7]], 3),
};

// Four original operators. Every colour is a hex; `camo` names a CAMO texture.
const CHARACTERS = {
  bulwark: {
    name: 'BULWARK', desc: 'Heavy armour, urban grey.',
    top: 0x3a3d40, pants: { camo: 'woodland' }, armor: 0x6e7378, rig: 0x2c2f31, boots: 0x1b1c1d, gloves: 0x1e1f20,
    head: 'visorHelmet', shoulderPads: true, armPlates: true, kneePads: 0x161718, sleeve: 0x3a3d40,
  },
  viper: {
    name: 'VIPER', desc: 'SWAT. Helmet, goggles, tactical vest.',
    top: 0x4f5446, pants: { camo: 'khaki' }, rig: 0x5a5a3c, boots: 0x6b5a40, gloves: 0x6e5a42, skin: 0xd2a07e,
    head: 'cap', shortSleeves: true, kneePads: 0x6b5f45, ponytail: 0x4a3222, sleeve: 0x4f5446,
  },
  wraith: {
    name: 'WRAITH', desc: 'Black ops. Gas mask, all-black gear.',
    top: { camo: 'fleece' }, pants: { camo: 'multicam' }, rig: { camo: 'multicam' }, boots: 0x2a2a28, gloves: 0x2b2c2e,
    head: 'hood', thighPouch: true, sleeve: 0x6c6f74,
  },
  hawk: {
    name: 'HAWK', desc: 'Heavy armour, blacked out.',
    top: 0x3b2f2b, topRough: 0.55, pants: 0x2e2a2c, rig: 0x8a8d90, boots: 0x1d1a19, gloves: 0x1c1c1e,
    head: 'flightHelmet', harness: true, tallBoots: true, sleeve: 0x3b2f2b,
  },
};
const CHAR_IDS = Object.keys(CHARACTERS);

const hitMat = new THREE.MeshBasicMaterial({ visible: false });
const upY = new V3(0, 1, 0);

// Builds a rigged-by-hand operator: the same group layout the animation code drives
// (hips/legs/torso/arms/head), plus invisible boxes used as hitboxes.
function makeOperator(charId) {
  if (soldierGltf) return makeRealOperator(charId);
  const C = CHARACTERS[charId] || CHARACTERS.bulwark;
  const mats = [];
  const M = (spec, rough = 0.9, metal = 0) => {
    const o = typeof spec === 'object' ? { map: CAMO[spec.camo](), color: 0xffffff } : { color: spec };
    const m = new THREE.MeshStandardMaterial({ ...o, roughness: rough, metalness: metal });
    m.userData.base = m.color.clone();
    mats.push(m);
    return m;
  };
  const top = M(C.top, C.topRough ?? 0.92), pants = M(C.pants), rig = M(C.rig, 0.85), boots = M(C.boots, 0.7);
  const gloves = M(C.gloves, 0.8), skin = M(C.skin ?? 0xc09676, 0.75), dark = M(0x1a1b1c, 0.6, 0.2);
  const gunMat = new THREE.MeshStandardMaterial({ color: 0x1e1f21, roughness: 0.45, metalness: 0.55 });
  const band = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.7, emissive: 0x000000 });

  const g = new THREE.Group();
  g.rotation.order = 'YXZ';
  const add = (parent, geo, mat, x = 0, y = 0, z = 0, shadow = true) => {
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.set(x, y, z); mesh.castShadow = shadow; mesh.receiveShadow = true;
    parent.add(mesh); return mesh;
  };
  const rbox = (w, h, d, r = 0.02) => new RoundedBoxGeometry(w, h, d, 2, Math.min(r, w / 2, h / 2, d / 2));
  // A capsule stretched between two points, for limbs.
  const limb = (parent, a, b, r, mat) => {
    const dir = new V3().subVectors(b, a), len = dir.length();
    const mesh = add(parent, new THREE.CapsuleGeometry(r, Math.max(0.01, len - r * 2), 4, 10), mat);
    mesh.position.copy(a).add(b).multiplyScalar(0.5);
    mesh.quaternion.setFromUnitVectors(upY, dir.normalize());
    return mesh;
  };
  const hitbox = (parent, w, h, d, x, y, z, part) => {
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), hitMat);
    m.position.set(x, y, z); m.userData.part = part; parent.add(m); return m;
  };

  // --- Legs (pivot at the hip, 0.9 m long) ---
  const hips = new THREE.Group(); hips.position.y = 0.9; g.add(hips);
  const makeLeg = (side) => {
    const leg = new THREE.Group(); leg.position.x = side * 0.11; hips.add(leg);
    limb(leg, new V3(0, -0.02, 0), new V3(0, -0.42, -0.01), 0.088, pants);
    limb(leg, new V3(0, -0.44, -0.01), new V3(0, -0.8, 0.01), 0.07, pants);
    if (C.kneePads) add(leg, rbox(0.13, 0.13, 0.06, 0.03), M(C.kneePads, 0.6), 0, -0.45, -0.08);
    if (C.thighPouch && side > 0) add(leg, rbox(0.06, 0.16, 0.14, 0.02), rig, 0.09, -0.25, 0);
    if (C.tallBoots) add(leg, rbox(0.15, 0.3, 0.17, 0.03), boots, 0, -0.72, 0);
    add(leg, rbox(0.14, 0.11, 0.29, 0.035), boots, 0, -0.85, -0.05);
    add(leg, rbox(0.145, 0.025, 0.3, 0.01), dark, 0, -0.9, -0.05);
    return leg;
  };
  const legL = makeLeg(-1), legR = makeLeg(1);
  const legBoxL = hitbox(legL, 0.2, 0.9, 0.26, 0, -0.45, 0, 'leg'), legBoxR = hitbox(legR, 0.2, 0.9, 0.26, 0, -0.45, 0, 'leg');

  // --- Torso ---
  const torso = new THREE.Group(); torso.position.y = 0.9; g.add(torso);
  add(torso, rbox(0.36, 0.2, 0.22, 0.06), pants, 0, 0.0, 0);                       // pelvis
  add(torso, rbox(0.4, 0.06, 0.25, 0.02), dark, 0, 0.06, 0);                        // belt
  for (const x of [-0.13, 0.13]) add(torso, rbox(0.08, 0.09, 0.07, 0.015), rig, x, 0.04, -0.14);
  add(torso, rbox(0.38, 0.5, 0.24, 0.08), top, 0, 0.35, 0);                         // chest/shirt
  if (C.harness) {
    for (const x of [-0.09, 0.09]) add(torso, rbox(0.045, 0.56, 0.27, 0.01), rig, x, 0.34, 0);
    add(torso, rbox(0.4, 0.045, 0.27, 0.01), rig, 0, 0.18, 0);
    add(torso, rbox(0.09, 0.09, 0.03, 0.01), M(0x9a9da0, 0.4, 0.6), 0, 0.3, -0.14);
  } else {
    add(torso, rbox(0.42, 0.36, 0.3, 0.04), rig, 0, 0.38, 0);                      // plate carrier
    for (let i = -1; i <= 1; i++) add(torso, rbox(0.1, 0.13, 0.06, 0.015), rig, i * 0.12, 0.3, -0.17); // mag pouches
    add(torso, rbox(0.3, 0.06, 0.03, 0.01), dark, 0, 0.47, -0.16);
    add(torso, rbox(0.32, 0.34, 0.12, 0.03), rig, 0, 0.36, 0.2);                   // back panel
    if (C.armor) add(torso, rbox(0.3, 0.26, 0.04, 0.02), M(C.armor, 0.45, 0.5), 0, 0.42, -0.165);
  }
  add(torso, new THREE.CylinderGeometry(0.06, 0.07, 0.1, 10), C.head === 'hood' || C.head === 'visorHelmet' || C.head === 'flightHelmet' ? dark : skin, 0, 0.64, 0);
  const torsoBox = hitbox(torso, 0.5, 0.68, 0.36, 0, 0.32, 0, 'body');

  // --- Head ---
  const headG = new THREE.Group(); headG.position.y = 0.68; torso.add(headG);
  const skull = add(headG, new THREE.SphereGeometry(0.105, 16, 12), skin, 0, 0.13, 0);
  skull.scale.set(1, 1.18, 1.05);
  const faceDetails = () => {
    for (const x of [-0.04, 0.04]) add(headG, new THREE.SphereGeometry(0.012, 8, 6), dark, x, 0.15, -0.095, false);
    add(headG, rbox(0.025, 0.04, 0.03, 0.01), skin, 0, 0.12, -0.105, false);
  };
  if (C.head === 'visorHelmet') {
    const shell = add(headG, new THREE.SphereGeometry(0.135, 18, 14), M(0x1c1d1f, 0.4, 0.3), 0, 0.15, 0); shell.scale.set(1, 1.08, 1.12);
    const visor = add(headG, new THREE.SphereGeometry(0.128, 18, 10, -Math.PI * 0.8, Math.PI * 0.6, Math.PI * 0.32, Math.PI * 0.32), M(0x0c0f12, 0.08, 0.8), 0, 0.15, 0);
    visor.scale.set(1.04, 1.1, 1.17);
    add(headG, rbox(0.16, 0.08, 0.06, 0.02), M(0x2a2c2e, 0.5, 0.4), 0, 0.06, -0.12);
    add(headG, rbox(0.05, 0.04, 0.03, 0.01), M(0xd06a20, 0.5), 0.1, 0.22, -0.06);
  } else if (C.head === 'cap') {
    faceDetails();
    const cap = add(headG, new THREE.SphereGeometry(0.115, 16, 10, 0, Math.PI * 2, 0, Math.PI / 2), M(0xb8a886, 0.85), 0, 0.18, 0); cap.scale.set(1, 0.85, 1.08);
    add(headG, rbox(0.17, 0.012, 0.09, 0.005), M(0xb8a886, 0.85), 0, 0.19, -0.13);
    for (const x of [-0.115, 0.115]) add(headG, new THREE.CylinderGeometry(0.045, 0.045, 0.035, 14).rotateZ(Math.PI / 2), M(0x3a3d30, 0.6), x, 0.13, 0);
    add(headG, rbox(0.24, 0.02, 0.02, 0.008), M(0x3a3d30, 0.6), 0, 0.27, 0);
    if (C.ponytail) { const tail = limb(headG, new V3(0, 0.15, 0.1), new V3(0, -0.02, 0.15), 0.035, M(C.ponytail, 0.8)); tail.castShadow = true; }
  } else if (C.head === 'hood') {
    add(headG, new THREE.SphereGeometry(0.108, 16, 12), M(0x232426, 0.95), 0, 0.13, 0).scale.set(1, 1.18, 1.06);  // balaclava
    const shades = add(headG, rbox(0.17, 0.035, 0.03, 0.012), M(0x050505, 0.05, 0.9), 0, 0.155, -0.1);
    shades.rotation.x = 0.1;
    const hood = add(headG, new THREE.SphereGeometry(0.145, 16, 12, 0, Math.PI * 2, 0, Math.PI * 0.62), M(0x5f6267, 0.95), 0, 0.12, 0.02);
    hood.scale.set(1, 1.15, 1.1); hood.rotation.x = -0.35;
    for (const x of [-0.13, 0.13]) add(headG, new THREE.CylinderGeometry(0.05, 0.05, 0.04, 14).rotateZ(Math.PI / 2), M(0x4b5038, 0.6), x, 0.13, 0);
  } else {
    const shell = add(headG, new THREE.SphereGeometry(0.14, 18, 14), M(0x3d4044, 0.35, 0.4), 0, 0.15, 0.01); shell.scale.set(1, 1.08, 1.1);
    const visor = add(headG, new THREE.SphereGeometry(0.132, 18, 10, -Math.PI * 0.8, Math.PI * 0.6, Math.PI * 0.3, Math.PI * 0.2), M(0x223040, 0.05, 0.9), 0, 0.15, 0);
    visor.scale.set(1.05, 1.1, 1.14);
    add(headG, rbox(0.11, 0.09, 0.08, 0.035), M(0x1a1b1c, 0.6), 0, 0.06, -0.12);   // oxygen mask
    limb(headG, new V3(0.04, 0.04, -0.12), new V3(0.12, -0.08, 0.02), 0.015, M(0x2a2b2c, 0.8));
  }
  const headBox = hitbox(headG, 0.28, 0.32, 0.3, 0, 0.14, 0, 'head');

  // --- Arms holding the rifle (arms group pitches with aim) ---
  const arms = new THREE.Group(); arms.position.set(0, 0.55, 0); torso.add(arms);
  const sleeve = C.shortSleeves ? skin : top;
  const armSide = (sh, el, ha, side) => {
    limb(arms, sh, el, 0.065, top);
    limb(arms, el, ha, 0.055, sleeve);
    if (C.shortSleeves) limb(arms, sh, sh.clone().lerp(el, 0.55), 0.068, top);
    add(arms, new THREE.SphereGeometry(0.05, 10, 8), gloves, ha.x, ha.y, ha.z);
    if (C.shoulderPads) add(arms, rbox(0.12, 0.06, 0.14, 0.025), M(C.armor, 0.45, 0.5), sh.x, sh.y + 0.05, sh.z);
    if (C.armPlates) limb(arms, el.clone().lerp(ha, 0.2), el.clone().lerp(ha, 0.75), 0.062, M(C.armor, 0.45, 0.5));
  };
  const shR = new V3(0.23, 0, 0), elR = new V3(0.27, -0.22, -0.1), haR = new V3(0.12, -0.08, -0.3);
  const shL = new V3(-0.23, 0, 0), elL = new V3(-0.2, -0.2, -0.24), haL = new V3(0.07, -0.04, -0.55);
  armSide(shR, elR, haR, 1);
  armSide(shL, elL, haL, -1);
  // Team armband on the upper left arm.
  const bandMesh = limb(arms, shL.clone().lerp(elL, 0.35), shL.clone().lerp(elL, 0.6), 0.07, band);
  bandMesh.visible = false;
  const armsBox = hitbox(arms, 0.62, 0.3, 0.5, 0.02, -0.1, -0.2, 'body');

  // Rifle: receiver, handguard, barrel, magazine, stock and optic.
  const gun = new THREE.Group(); gun.position.set(0.1, 0, 0); arms.add(gun);
  add(gun, rbox(0.06, 0.09, 0.34, 0.012), gunMat, 0, 0, -0.32);
  add(gun, rbox(0.055, 0.065, 0.26, 0.012), gunMat, 0, 0.005, -0.6);
  add(gun, new THREE.CylinderGeometry(0.012, 0.012, 0.18, 8).rotateX(Math.PI / 2), gunMat, 0, 0.01, -0.82);
  add(gun, rbox(0.045, 0.16, 0.07, 0.01), gunMat, 0, -0.1, -0.36).rotation.x = 0.2;
  add(gun, rbox(0.035, 0.1, 0.045, 0.008), gunMat, 0, -0.08, -0.22).rotation.x = -0.3;
  add(gun, rbox(0.05, 0.08, 0.22, 0.012), gunMat, 0, -0.01, -0.06);
  add(gun, new THREE.CylinderGeometry(0.022, 0.022, 0.12, 10).rotateX(Math.PI / 2), gunMat, 0, 0.075, -0.34);
  const flash = new THREE.Sprite(new THREE.SpriteMaterial({ map: flashTex, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true }));
  flash.scale.set(0.5, 0.5, 1); flash.position.set(0.1, 0.01, -0.95); flash.visible = false; arms.add(flash);

  return { group: g, hips, torso, legL, legR, arms, headG, flash, gun, band: bandMesh, bandMat: band, mats, skin,
    hitboxes: [legBoxL, legBoxR, torsoBox, headBox, armsBox], char: charId };
}

/* ======================= REALISTIC OPERATOR MODEL ======================= */

// A professionally made, skinned and animated soldier (Mixamo, from the three.js
// examples). Until it has downloaded, players use the simpler built-in operators.
const SOLDIER_URL = 'https://cdn.jsdelivr.net/gh/mrdoob/three.js@r160/examples/models/gltf/Soldier.glb';
// Per-operator colour grade multiplied over the uniform texture.
const REAL_TINT = { bulwark: 0xa9b6c4, viper: 0xe2c690, wraith: 0x9fb07a, hawk: 0x6e6660 };
// Mixamo characters bundled with the game, one per operator. Any that is missing
// falls back to the tinted soldier above.
const CHAR_MODEL_FILES = { viper: 'models/swat.glb', wraith: 'models/gasmask.glb' };
let soldierGltf = null;
const charGltf = {};
function onModelsChanged() {
  if (!soldierGltf) return;
  for (const k of Object.keys(previewCache)) delete previewCache[k];
  for (const rp of remotes.values()) if (rp.char) setBody(rp, rp.char);
  refreshLoadoutViews();
}
const gltfLoader = new GLTFLoader();
gltfLoader.load(SOLDIER_URL, (gltf) => {
  soldierGltf = gltf;
  for (const id of Object.keys(charGltf)) charGltf[id].clips = retargetSoldierClips(charGltf[id]);
  onModelsChanged();
}, undefined, () => {});
for (const [id, url] of Object.entries(CHAR_MODEL_FILES)) gltfLoader.load(url, (gltf) => {
  charGltf[id] = gltf;
  if (soldierGltf) gltf.clips = retargetSoldierClips(gltf);
  onModelsChanged();
}, undefined, () => {});
// Copies the soldier's idle/walk/run onto another Mixamo character: each frame, every
// bone gets the same world-space rotation change (relative to its T-pose) as the
// soldier's matching bone. Rest pose and facing differences then don't matter.
function retargetSoldierClips(gltf) {
  const src = SkeletonUtils.clone(soldierGltf.scene);
  const tgt = SkeletonUtils.clone(gltf.scene);
  const holder = new THREE.Group(); holder.rotation.y = Math.PI; holder.add(tgt);
  const sBones = {}, tBones = [];
  src.traverse((o) => { if (o.isBone) sBones[o.name] = o; });
  tgt.traverse((o) => { if (o.isBone && sBones[o.name]) tBones.push(o); });
  const mixer = new THREE.AnimationMixer(src);
  const tpose = soldierGltf.animations.find((c) => c.name === 'TPose');
  const worldQ = (o) => o.getWorldQuaternion(new THREE.Quaternion());
  if (tpose) { const a = mixer.clipAction(tpose); a.play(); mixer.setTime(0); a.stop(); }
  src.updateMatrixWorld(true); holder.updateMatrixWorld(true);
  const sRestInv = {}, tRest = {};
  for (const b of tBones) { sRestInv[b.name] = worldQ(sBones[b.name]).invert(); tRest[b.name] = worldQ(b); }
  const tLocal0 = tBones.map((b) => b.quaternion.clone());
  const pq = new THREE.Quaternion(), q = new THREE.Quaternion();
  return soldierGltf.animations.filter((c) => c.name !== 'TPose').map((clip) => {
    mixer.stopAllAction();
    const action = mixer.clipAction(clip); action.play();
    const fps = 30, frames = Math.max(2, Math.round(clip.duration * fps) + 1);
    const times = new Float32Array(frames), values = tBones.map(() => new Float32Array(frames * 4));
    for (let f = 0; f < frames; f++) {
      const t = Math.min(clip.duration, f / fps);
      times[f] = t;
      mixer.setTime(t);
      src.updateMatrixWorld(true);
      tBones.forEach((b, i) => b.quaternion.copy(tLocal0[i]));
      holder.updateMatrixWorld(true);
      tBones.forEach((b, i) => {
        // target world = (source world * source rest^-1) * target rest
        q.copy(worldQ(sBones[b.name])).multiply(sRestInv[b.name]).multiply(tRest[b.name]);
        b.parent.getWorldQuaternion(pq).invert();
        b.quaternion.copy(pq.multiply(q));
        b.updateMatrixWorld(true);
        b.quaternion.toArray(values[i], f * 4);
      });
    }
    action.stop();
    return new THREE.AnimationClip(clip.name, clip.duration, tBones.map((b, i) => new THREE.QuaternionKeyframeTrack(`${b.name}.quaternion`, times, values[i])));
  });
}

const _a = new V3(), _b = new V3(), _c = new V3(), _q = new THREE.Quaternion();
// Point a Mixamo bone (which runs along its local +Y) at a world-space point.
function aimBone(bone, target) {
  bone.getWorldPosition(_a);
  _b.subVectors(target, _a).normalize();
  bone.parent.getWorldQuaternion(_q).invert();
  _b.applyQuaternion(_q);
  bone.quaternion.setFromUnitVectors(upY, _b);
  bone.updateMatrixWorld(true);
}
// Analytic two-bone IK: upper bone, lower bone, end effector target, bend hint.
function twoBoneIK(upper, lower, end, target, pole) {
  const S = upper.getWorldPosition(new V3());
  const L1 = upper.userData.len, L2 = lower.userData.len;
  const toT = new V3().subVectors(target, S);
  const d = clamp(toT.length(), 0.05, L1 + L2 - 0.001);
  const dir = toT.normalize();
  const a = (L1 * L1 - L2 * L2 + d * d) / (2 * d), h = Math.sqrt(Math.max(0, L1 * L1 - a * a));
  const perp = pole.clone().addScaledVector(dir, -pole.dot(dir)).normalize();
  const elbow = S.clone().addScaledVector(dir, a).addScaledVector(perp, h);
  aimBone(upper, elbow);
  aimBone(lower, S.addScaledVector(dir, d));
  if (end) end.updateMatrixWorld(true);
}

function makeRealOperator(charId) {
  const g = new THREE.Group();
  g.rotation.order = 'YXZ';
  const own = charGltf[charId]?.clips ? charGltf[charId] : null;
  const model = SkeletonUtils.clone((own || soldierGltf).scene);
  // Mixamo FBX exports face +Z; the game's players face -Z.
  const holder = new THREE.Group(); if (own) holder.rotation.y = Math.PI;
  holder.add(model); g.add(holder);
  const mats = [];
  model.traverse((o) => {
    if (!o.isMesh) return;
    o.castShadow = true; o.receiveShadow = true; o.frustumCulled = false;
    o.material = o.material.clone();
    if (!own && o.material.name === 'VanguardBodyMat') {
      o.material.color.setHex(REAL_TINT[charId] || 0xffffff);
      // Drain most of the texture's own colour so the tint decides the uniform colour.
      o.material.onBeforeCompile = (sh) => {
        sh.fragmentShader = sh.fragmentShader.replace('#include <map_fragment>', `#ifdef USE_MAP
  vec4 sampledDiffuseColor = texture2D( map, vMapUv );
  float lum = dot( sampledDiffuseColor.rgb, vec3( 0.299, 0.587, 0.114 ) );
  sampledDiffuseColor.rgb = mix( sampledDiffuseColor.rgb, vec3( lum ) * 1.25, 0.85 );
  diffuseColor *= sampledDiffuseColor;
#endif`);
      };
      o.material.customProgramCacheKey = () => 'operator-desat';
    }
    o.material.userData.base = o.material.color.clone();
    mats.push(o.material);
  });
  const bone = (n) => model.getObjectByName('mixamorig' + n);
  const B = {};
  for (const n of ['Hips', 'Spine', 'Spine1', 'Spine2', 'Neck', 'Head', 'RightArm', 'RightForeArm', 'RightHand', 'LeftArm', 'LeftForeArm', 'LeftHand',
    'RightUpLeg', 'RightLeg', 'RightFoot', 'LeftUpLeg', 'LeftLeg', 'LeftFoot']) B[n] = bone(n);
  model.updateMatrixWorld(true);
  const dist = (p, c) => p.getWorldPosition(new V3()).distanceTo(c.getWorldPosition(new V3()));
  B.RightArm.userData.len = dist(B.RightArm, B.RightForeArm); B.RightForeArm.userData.len = dist(B.RightForeArm, B.RightHand);
  B.LeftArm.userData.len = dist(B.LeftArm, B.LeftForeArm); B.LeftForeArm.userData.len = dist(B.LeftForeArm, B.LeftHand);
  B.RightUpLeg.userData.len = dist(B.RightUpLeg, B.RightLeg); B.RightLeg.userData.len = dist(B.RightLeg, B.RightFoot);
  B.LeftUpLeg.userData.len = dist(B.LeftUpLeg, B.LeftLeg); B.LeftLeg.userData.len = dist(B.LeftLeg, B.LeftFoot);

  const mixer = new THREE.AnimationMixer(model);
  const actions = {};
  for (const clip of own ? own.clips : soldierGltf.animations) actions[clip.name] = mixer.clipAction(clip);
  actions.Idle.play();

  // Rifle pivots at the right shoulder and pitches with the player's aim.
  const gunPivot = new THREE.Group(); gunPivot.position.set(0.14, 1.42, -0.02); g.add(gunPivot);
  const gunMat = new THREE.MeshStandardMaterial({ color: 0x1e1f21, roughness: 0.42, metalness: 0.6 });
  const accent = new THREE.MeshStandardMaterial({ color: 0x3a3428, roughness: 0.8 });
  const gun = new THREE.Group(); gunPivot.add(gun);
  const gp = (geo, m, x, y, z, rx = 0) => { const mesh = new THREE.Mesh(geo, m); mesh.position.set(x, y, z); mesh.rotation.x = rx; mesh.castShadow = true; gun.add(mesh); return mesh; };
  const rb = (w, h, d, r = 0.01) => new RoundedBoxGeometry(w, h, d, 2, r);
  gp(rb(0.055, 0.08, 0.3), gunMat, 0, 0, -0.27);                       // receiver
  gp(rb(0.05, 0.06, 0.24, 0.012), accent, 0, 0.004, -0.53);             // handguard
  gp(new THREE.CylinderGeometry(0.011, 0.011, 0.2, 8).rotateX(Math.PI / 2), gunMat, 0, 0.01, -0.75);
  gp(new THREE.CylinderGeometry(0.017, 0.017, 0.05, 8).rotateX(Math.PI / 2), gunMat, 0, 0.01, -0.86);
  gp(rb(0.04, 0.15, 0.065), gunMat, 0, -0.1, -0.3, 0.22);              // magazine
  gp(rb(0.032, 0.09, 0.04, 0.008), gunMat, 0, -0.075, -0.17, -0.3);    // grip
  gp(rb(0.045, 0.075, 0.2), accent, 0, -0.012, -0.03);                  // stock
  gp(new THREE.CylinderGeometry(0.02, 0.02, 0.11, 10).rotateX(Math.PI / 2), gunMat, 0, 0.07, -0.3);
  const flash = new THREE.Sprite(new THREE.SpriteMaterial({ map: flashTex, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true }));
  flash.scale.set(0.5, 0.5, 1); flash.position.set(0, 0.01, -0.92); flash.visible = false; gunPivot.add(flash);
  const gripR = new V3(0, -0.05, -0.17), gripL = new V3(0, -0.02, -0.5);

  // Team armband on the left upper arm (bone space is in centimetres).
  const bandMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.7 });
  const band = new THREE.Mesh(new THREE.CylinderGeometry(6.2, 6.2, 5, 14), bandMat);
  band.position.y = 12; band.visible = false; B.LeftArm.add(band);

  const hb = new THREE.Group(); g.add(hb);
  const hit = (w, h, d, x, y, z, part) => { const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), hitMat); m.position.set(x, y, z); m.userData.part = part; hb.add(m); return m; };
  const hitboxes = [hit(0.22, 0.92, 0.28, -0.11, 0.46, 0, 'leg'), hit(0.22, 0.92, 0.28, 0.11, 0.46, 0, 'leg'),
    hit(0.5, 0.62, 0.36, 0, 1.22, 0, 'body'), hit(0.26, 0.3, 0.3, 0, 1.68, 0, 'head'), hit(0.5, 0.25, 0.6, 0.06, 1.35, -0.3, 'body')];

  return { real: true, group: g, model, mixer, actions, act: 'Idle', B, gunPivot, gun, flash, gripR, gripL, band, bandMat, mats, skin: null,
    hb, hitboxes, char: charId, hips: g, torso: g, legL: g, legR: g, arms: gunPivot, headG: g };
}

// Plays the right locomotion clip, then overrides arms (rifle grip), aim pitch and crouch.
function poseRealOperator(op, dt, speed, pitch, crouchT) {
  const want = speed < 0.6 ? 'Idle' : speed < 5.6 ? 'Walk' : 'Run';
  if (want !== op.act) { op.actions[want].reset().play(); op.actions[op.act].crossFadeTo(op.actions[want], 0.25, false); op.act = want; }
  if (want === 'Walk') op.actions.Walk.timeScale = clamp(speed / 1.6, 0.6, 2.2);
  if (want === 'Run') op.actions.Run.timeScale = clamp(speed / 5.5, 0.8, 1.5);
  op.mixer.update(dt);
  const drop = 0.38 * crouchT;
  op.model.position.y = -drop;
  op.gunPivot.position.y = 1.42 - drop;
  op.gunPivot.rotation.x = pitch;
  op.hb.scale.y = 1 - crouchT * 0.3;
  const g = op.group, B = op.B;
  g.updateMatrixWorld(true);
  // Lean the upper body into the aim and keep the head on the sights.
  B.Spine2.rotation.x += pitch * 0.35;
  B.Neck.rotation.x += pitch * 0.25;
  B.Spine2.updateMatrixWorld(true);
  const toWorld = (local, out) => op.gunPivot.localToWorld(out.copy(local));
  const side = (x, y, z) => g.localToWorld(new V3(x, y, z)).sub(g.getWorldPosition(new V3())).normalize();
  twoBoneIK(B.RightArm, B.RightForeArm, B.RightHand, toWorld(op.gripR, _c.clone()), side(1, -1, 0.4));
  twoBoneIK(B.LeftArm, B.LeftForeArm, B.LeftHand, toWorld(op.gripL, _c.clone()), side(-0.6, -1, 0.2));
  if (crouchT > 0.02) {
    // Keep the boots planted while the hips drop.
    for (const s of ['Left', 'Right']) {
      const foot = B[s + 'Foot'].getWorldPosition(new V3());
      foot.y += drop;
      twoBoneIK(B[s + 'UpLeg'], B[s + 'Leg'], B[s + 'Foot'], foot, side(0, 0.3, -1));
    }
  }
}

// Zombies: every outfit material shifts toward rotten green, skin goes sickly.
const ZOMBIE_TINT = new THREE.Color(0x4a6a2a), ZOMBIE_MUL = new THREE.Color(0x7f9a5c);
function tintOperator(rp, zombie) {
  for (const m of rp.mats) {
    m.color.copy(m.userData.base);
    if (zombie) { if (m === rp.skin) m.color.lerp(ZOMBIE_TINT, 0.75); else m.color.multiply(ZOMBIE_MUL); }
  }
}

// Card thumbnails: each operator rendered once on a small offscreen canvas.
let previewR = null;
const previewCache = {};
function operatorPreview(charId) {
  if (previewCache[charId]) return previewCache[charId];
  if (!previewR) {
    const c = document.createElement('canvas'); c.width = 200; c.height = 280;
    previewR = new THREE.WebGLRenderer({ canvas: c, antialias: true, alpha: true, preserveDrawingBuffer: true });
    previewR.outputColorSpace = THREE.SRGBColorSpace;
    previewR.toneMapping = THREE.ACESFilmicToneMapping;
  }
  const sc = new THREE.Scene();
  sc.add(new THREE.HemisphereLight(0xdde6ff, 0x3a3530, 1.4));
  const key = new THREE.DirectionalLight(0xffffff, 2.6); key.position.set(-1.5, 2.5, -3); sc.add(key);
  const rim = new THREE.DirectionalLight(0xffd8a8, 1.4); rim.position.set(2, 1.5, 2); sc.add(rim);
  const op = makeOperator(charId);
  op.group.rotation.y = Math.PI + 0.45;
  sc.add(op.group);
  if (op.real) poseRealOperator(op, 0.4, 0, 0, 0);
  const cam = new THREE.PerspectiveCamera(30, 200 / 280, 0.1, 20);
  cam.position.set(0, 1.15, 4.1); cam.lookAt(0, 0.98, 0);
  previewR.setClearColor(0x000000, 0);
  previewR.clear();
  previewR.render(sc, cam);
  return (previewCache[charId] = previewR.domElement.toDataURL());
}

function ensureRemote(info) {
  if (info.id === myId) return null;
  let rp = remotes.get(info.id);
  if (!rp) {
    rp = { id: info.id, name: info.name, look: '', target: new V3(), yaw: 0, tyaw: 0, pitch: 0, crouch: false, crouchT: 0, speed: 0, phase: 0, alive: false, deadT: -1, lastShot: -1e9, has: false, flashT: 0, tag: null, group: null };
    remotes.set(info.id, rp);
  }
  const dday = (match?.mode ?? room?.mode) === 'dday';
  const char = dday ? `trooper${info.team === 1 ? 1 : 0}` : CHARACTERS[info.char] ? info.char : CHAR_IDS[info.id % CHAR_IDS.length];
  if (rp.char !== char) setBody(rp, char);
  rp.name = info.name;
  applyLook(rp);
  return rp;
}
// Swap in a (new) operator model, keeping where the old one was.
function setBody(rp, char) {
  const old = rp.group;
  const s = char.startsWith('trooper') ? makeTrooper(+char.slice(7)) : makeOperator(char);
  for (const m of s.hitboxes) m.userData.pid = rp.id;
  if (old) {
    s.group.position.copy(old.position); s.group.rotation.copy(old.rotation); s.group.visible = old.visible;
    playersGroup.remove(old);
  } else s.group.visible = false;
  playersGroup.add(s.group);
  Object.assign(rp, s);
  rp.look = ''; rp.tag = null;
  rp.plane = rp.chute = rp.boat = null; rp.form = undefined;
}
// Team colours, zombie skin and the name tag follow the player's current team.
function applyLook(rp) {
  const team = teamOf(rp.id), teams = match ? MODES[match.mode]?.teams : false;
  const zombie = match?.mode === 'inf' && team === 1, ally = teams && !isEnemy(rp.id);
  const key = `${rp.name}|${team}|${teams}|${ally}|${myTeam()}`;
  if (rp.look === key) return;
  rp.look = key;
  tintOperator(rp, zombie);
  rp.band.visible = teams && team >= 0;
  if (rp.band.visible) { const c = new THREE.Color(zombie ? ZOMBIE_GREEN : ally ? TEAM_COLORS[0] : TEAM_COLORS[1]); rp.bandMat.color.copy(c); rp.bandMat.emissive.copy(c).multiplyScalar(0.35); }
  rp.gun.visible = !zombie;
  if (rp.tag) rp.group.remove(rp.tag);
  const color = zombie ? ZOMBIE_GREEN : ally ? TEAM_COLORS[0] : '#ff6a55';
  rp.tag = makeNameTag(rp.name, color);
  rp.tag.position.y = 2.2;
  rp.tag.userData.ally = ally;
  // Teammates' names show through walls so you can find your squad.
  if (ally) { rp.tag.material.depthTest = false; rp.tag.renderOrder = 5; }
  rp.group.add(rp.tag);
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
  const dday = isDday();
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
    if (dday) {
      setForm(rp, rp.formWant ?? FORM.ground);
      if (rp.form === FORM.ride) { rp.group.visible = false; continue; }
      const dist = rp.group.position.distanceTo(camera.position);
      rp.group.visible = dist < (rp.form === FORM.plane ? 480 : 200);
      if (rp.form === FORM.plane) {
        rp.plane.rotation.set(rp.pitch, 0, rp.roll || 0);
        rp.plane.userData.prop.rotation.z += dt * 60;
        rp.tag.visible = dist < 140;
        continue;
      }
      rp.tag.visible = dist < 60;
      if (dist > 90 || !rp.group.visible) continue;
    }
    if (rp.real) {
      rp.crouchT = damp(rp.crouchT, rp.crouch ? 1 : 0, 12, dt);
      poseRealOperator(rp, dt, rp.speed, rp.pitch, rp.crouchT);
      if (rp.flashT > 0) { rp.flashT -= dt; rp.flash.visible = rp.flashT > 0; rp.flash.material.rotation = Math.random() * 6; }
      rp.tag.visible = rp.tag.userData.ally || rp.group.position.distanceTo(camera.position) < 70;
      continue;
    }
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
    if (!dday) rp.tag.visible = rp.tag.userData.ally || rp.group.position.distanceTo(camera.position) < 70;
  }
}
function aliveHitboxes() {
  const arr = [];
  for (const rp of remotes.values()) {
    if (!rp.alive || !rp.has || !rp.group.visible || !isEnemy(rp.id)) continue;
    if (rp.form === FORM.plane && rp.plane) arr.push(rp.plane.userData.hit); else arr.push(...rp.hitboxes);
  }
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
  for (const b of collidersNear(p.x, p.z, 1)) {
    if (p.x > b.min.x - 0.07 && p.x < b.max.x + 0.07 && p.y > b.min.y - 0.07 && p.y < b.max.y + 0.07 && p.z > b.min.z - 0.07 && p.z < b.max.z + 0.07) return true;
  }
  return false;
}
function spawnGrenade(kind, owner, pos, vel) {
  const mesh = kind === 'bomb' ? new THREE.Mesh(bombGeo, bombMat) : new THREE.Mesh(kind === 'frag' ? fragGeo : smokeCanGeo, kind === 'frag' ? fragMat : smokeCanMat);
  mesh.castShadow = true;
  mesh.position.copy(pos);
  scene.add(mesh);
  grenades.push({ kind, owner, pos: pos.clone(), vel: vel.clone(), t: 0, mesh, lastClink: 0 });
}
function explodeFrag(g) {
  const p = g.pos, up = new V3(0, 1, 0), spec = g.kind === 'bomb' ? BOMB : FRAG;
  if (g.kind === 'bomb') bigBoom(p, 1);
  else {
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
  }
  // Damage is worked out by whoever threw it (bots are owned by the offline match or the host).
  const src = new V3(p.x, p.y + 0.3, p.z);
  if (g.owner === myId) {
    let hitSomeone = false;
    for (const rp of remotes.values()) {
      if (!rp.alive || !rp.has || !isEnemy(rp.id) || rp.form === FORM.plane) continue;
      const chest = rp.group.position.clone().setY(rp.group.position.y + 1.0);
      const d = src.distanceTo(chest);
      if (d >= spec.radius || !segmentClear(src, chest)) continue;
      net.send({ t: 'hit', target: rp.id, dmg: Math.round(spec.maxDmg * (1 - d / spec.radius)), head: false, w: g.kind });
      hitSomeone = true;
    }
    if (hitSomeone) { showHitmarker(false); sfx.hit(); }
  } else if (offline || botDirector) (offline || botDirector).fragDamage(g.owner, src, spec, g.kind);
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
        if (g.kind === 'frag' || g.kind === 'bomb') { g.impact = true; break; }
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
    if (g.kind === 'bomb') g.mesh.lookAt(g.pos.clone().add(g.vel));
    else g.mesh.rotation.x += g.vel.length() * dt * 3;
    if (g.impact || g.t >= (g.kind === 'smoke' ? SMOKE.pop : g.kind === 'bomb' ? 15 : FRAG.fuse)) {
      scene.remove(g.mesh);
      grenades.splice(i, 1);
      if (g.kind === 'smoke') popSmoke(g); else explodeFrag(g);
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
    const life = b.big ? 0.6 : 0.35;
    b.s.material.opacity = Math.max(0, 1 - b.t / life);
    b.s.scale.setScalar(b.big ? 9 * b.big + b.t * 30 : 5 + b.t * 12);
    if (b.t > life) { scene.remove(b.s); b.s.material.dispose(); booms.splice(i, 1); }
  }
}
function clearGrenades() {
  for (const g of grenades) scene.remove(g.mesh);
  for (const s of smokes) for (const sp of s.sprites) scene.remove(sp);
  for (const b of booms) scene.remove(b.s);
  grenades.length = smokes.length = booms.length = 0;
}

/* =============================== D-DAY =============================== */

// Roles: 'inf' (Allies land by boat, Axis hold the trenches), 'para' (parachute in) and 'jet' (fighter pilot).
const ROLE_NAMES = { inf: 'INFANTRY', para: 'PARATROOPER', jet: 'FIGHTER PILOT' };
// Planes are fragile: every hit on one does hitMul times the damage, so a couple of rifle hits bring one down.
const PLANE = { speed: 55, min: 36, max: 80, turn: 1.3, ceiling: 170, gunDmg: 16, gunRpm: 900, bombMs: 1600, hitMul: 3 };
const BOMB = { radius: 10, maxDmg: 220 };
const CHUTE = { y: 110, fall: 6, steer: 4.5 };
const BOAT = { startX: -158, landX: -90, speed: 11 };
const FORM = { ground: 0, chute: 1, plane: 2, boat: 3, ride: 4 }; // what a soldier currently is, sent as `r` in state; ride = in a troop carrier
const KILL_NAMES = { frag: 'FRAG', bomb: 'BOMB', mg: 'PLANE GUNS', crash: 'CRASHED' };
const isDday = () => match?.mode === 'dday';
const roleOf = (id) => pInfo(id)?.role || 'inf';
const fwdOf = (yaw, pitch = 0) => new V3(-Math.sin(yaw) * Math.cos(pitch), Math.sin(pitch), -Math.cos(yaw) * Math.cos(pitch));

// Fighter flights, after the WWII pattern: the finger-four (the German Schwarm, two pairs spaced like the
// fingertips of a hand), a Vic of three when a flight is a plane short, and a lone pair (Rotte) below that.
// Slots are [right, back, up] from the leader in metres; real spacing was about 200 m, squeezed here to fit the map.
const FLIGHT_SLOTS = {
  1: [[0, 0, 0]],
  2: [[0, 0, 0], [-20, 12, -2]],
  3: [[0, 0, 0], [-20, 14, 0], [20, 14, 0]],
  4: [[0, 0, 0], [-20, 12, -2], [20, 12, 2], [40, 24, 4]],
};
// Troop carriers (Allied C-47s, Axis Ju 52s) cross the map in Vics of three at jump height and speed, about
// 110 mph as on D-Day. Each side sends a Vic every runMs. The light by the door goes red (READY) redMs before
// the drop zone and green (JUMP) over it. It is all worked out from the match clock, so every player sees the
// same planes without any of it going over the network.
const TRANSPORT = { speed: 49, y: CHUTE.y + 2, runMs: 6000, redMs: 3500, greenMs: 2200, wing: 26, back: 20, reach: 760 };
function transportRun(team, k) {
  const flags = MAPS.normandy.zones.dom, flag = (((k * 3 + team * 2) % flags.length) + flags.length) % flags.length, [fx, fz] = flags[flag];
  const dir = team === 0 ? 1 : -1;
  const half = TRANSPORT.speed * TRANSPORT.greenMs / 2000; // the green light is on for this far either side of the flag
  return { dir, flag, z: fz, greenX: dir > 0 ? Math.max(fx - half, -70) : fx + half, greenAt: k * TRANSPORT.runMs + (team ? TRANSPORT.runMs / 2 : 0) };
}
// Plane `slot` of a run (0 lead, 1 left wing, 2 right wing; wingmen fly behind) at match time tau (ms).
// Returns how long since that plane's light went green, negative before.
function transportPose(team, k, slot, tau, out) {
  const r = transportRun(team, k), ph = tau - r.greenAt - (slot ? TRANSPORT.back / TRANSPORT.speed * 1000 : 0);
  const side = slot === 1 ? -1 : slot === 2 ? 1 : 0;
  out.set(r.greenX + r.dir * ph / 1000 * TRANSPORT.speed, TRANSPORT.y + (slot ? 3 : 0) + Math.sin(tau / 1300 + k * 1.7 + slot) * 0.4, r.z + r.dir * side * TRANSPORT.wing);
  return ph;
}
const jumpLight = (ph) => (ph < -TRANSPORT.redMs ? 0 : ph < 0 ? 1 : 2); // off, red, green
// Where a jumper stands: in the open door on the left side, at the back of the cabin.
function jumpDoor(j, tau, out) {
  const ph = transportPose(j.team, j.k, j.slot, tau, out), dir = j.team === 0 ? 1 : -1;
  out.x -= dir * 3; out.z -= dir * 1.65; out.y -= 1.25;
  return ph;
}
// The next Vic far enough out to give a new jumper time to stand up before the red light.
function nextJump(team, tau, slot) {
  const off = team ? TRANSPORT.runMs / 2 : 0;
  return { team, slot, k: Math.ceil((Math.max(tau + TRANSPORT.redMs + 1200, 1000) - off) / TRANSPORT.runMs), light: -1, delay: 0 };
}

// Where each role enters: pilots from their side's sky, paratroopers in a troop carrier,
// Allied infantry in landing craft at sea, Axis infantry in the rear trenches and fields.
function ddaySpawn(role, team, enemies, tau = 0, slot = 2) {
  const toward = team === 0 ? -Math.PI / 2 : Math.PI / 2;
  if (role === 'jet') return { pos: new V3(team === 0 ? -(mapHalf + 25) : mapHalf + 25, rand(75, 115), rand(-200, 200)), yaw: toward, form: FORM.plane };
  if (role === 'para') {
    const jump = nextJump(team, tau, slot), pos = new V3();
    jumpDoor(jump, tau, pos);
    return { pos, yaw: toward, form: FORM.ride, jump };
  }
  if (team === 0) return { pos: new V3(BOAT.startX - rand(0, 25), 0.35, rand(-190, 190)), yaw: toward, form: FORM.boat };
  const rear = navPts.filter((p) => p.x > mapHalf - 55 && Math.abs(p.z) < 170), pool = rear.length ? rear : navPts;
  let best = pool[0], bd = -1;
  for (let i = 0; i < 8; i++) {
    const p = pool[Math.floor(Math.random() * pool.length)];
    let d = 1e9;
    for (const e of enemies) d = Math.min(d, e.distanceToSquared(p));
    if (d > bd) { bd = d; best = p; }
  }
  return { pos: best.clone(), yaw: toward, form: FORM.ground };
}

// ---- Models: cheap enough to draw 200 of ----
const vcMat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.85 });
// Coloured boxes merged into one mesh: [w, h, d, x, y, z, colour].
function colourBoxes(parts) {
  return mergeGeometries(parts.map(([w, h, d, x, y, z, c]) => {
    const g = new THREE.BoxGeometry(w, h, d).translate(x, y, z);
    const col = new THREE.Color(c), n = g.attributes.position.count, arr = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) { arr[i * 3] = col.r; arr[i * 3 + 1] = col.g; arr[i * 3 + 2] = col.b; }
    g.setAttribute('color', new THREE.BufferAttribute(arr, 3));
    return g;
  }));
}
// Allied olive drab and Axis field grey.
const TROOPER = [
  { cloth: 0x5b5a3c, dark: 0x3f3d2a, helmet: 0x4e5236, pack: 0x6b6446 },
  { cloth: 0x5e6466, dark: 0x3d4244, helmet: 0x4a5052, pack: 0x5a564a },
];
const trooperGeo = {};
function trooperGeos(team) {
  if (trooperGeo[team]) return trooperGeo[team];
  const C = TROOPER[team], skin = 0xc09676, boot = 0x1e1a16, wood = 0x6b4a2a, steel = 0x2a2a2a;
  const helmet = team === 0
    ? [[0.34, 0.12, 0.36, 0, 0.27, 0, C.helmet], [0.28, 0.07, 0.3, 0, 0.35, 0, C.helmet]]
    : [[0.4, 0.09, 0.42, 0, 0.23, 0.02, C.helmet], [0.3, 0.13, 0.32, 0, 0.31, 0, C.helmet]];
  return (trooperGeo[team] = {
    leg: colourBoxes([[0.2, 0.75, 0.24, 0, -0.375, 0, C.dark], [0.21, 0.16, 0.3, 0, -0.82, -0.03, boot]]),
    torso: colourBoxes([[0.52, 0.62, 0.3, 0, 0.33, 0, C.cloth], [0.54, 0.08, 0.32, 0, 0.05, 0, 0x2e2a20], [0.38, 0.4, 0.15, 0, 0.36, 0.22, C.pack]]),
    head: colourBoxes([[0.24, 0.27, 0.25, 0, 0.12, 0, skin], ...helmet]),
    arms: colourBoxes([[0.13, 0.13, 0.5, 0.24, -0.08, -0.18, C.cloth], [0.13, 0.13, 0.5, -0.16, -0.06, -0.26, C.cloth],
      [0.06, 0.09, 0.6, 0.1, 0, -0.45, wood], [0.03, 0.03, 0.4, 0.1, 0.03, -0.9, steel]]),
  });
}
const bandGeo = new THREE.BoxGeometry(0.15, 0.1, 0.32);
function makeTrooper(team) {
  const G = trooperGeos(team), g = new THREE.Group();
  g.rotation.order = 'YXZ';
  const mesh = (geo, parent, x, part) => { const m = new THREE.Mesh(geo, vcMat); m.position.x = x; m.userData.part = part; parent.add(m); return m; };
  const hips = new THREE.Group(); hips.position.y = 0.9; g.add(hips);
  const legL = mesh(G.leg, hips, -0.13, 'leg'), legR = mesh(G.leg, hips, 0.13, 'leg');
  const torso = new THREE.Group(); torso.position.y = 0.9; g.add(torso);
  const body = mesh(G.torso, torso, 0, 'body');
  const headG = new THREE.Group(); headG.position.y = 0.72; torso.add(headG);
  const head = mesh(G.head, headG, 0, 'head');
  const arms = new THREE.Group(); arms.position.y = 0.55; torso.add(arms);
  const armMesh = mesh(G.arms, arms, 0, 'body');
  const bandMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.7 });
  const band = new THREE.Mesh(bandGeo, bandMat);
  band.position.set(-0.27, 0.5, 0); band.visible = false; torso.add(band);
  const flash = new THREE.Sprite(new THREE.SpriteMaterial({ map: flashTex, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true }));
  flash.scale.set(0.5, 0.5, 1); flash.position.set(0.1, 0.03, -1.15); flash.visible = false; arms.add(flash);
  return { group: g, hips, torso, legL, legR, arms, headG, flash, gun: new THREE.Object3D(), band, bandMat, mats: [], skin: null,
    hitboxes: [legL, legR, body, head, armMesh], real: false, trooper: true, char: `trooper${team}` };
}
// WWII fighters: Allied olive with black-and-white invasion stripes, Axis grey with yellow wingtips.
const planeGeo = {};
function planeGeos(team) {
  if (planeGeo[team]) return planeGeo[team];
  const body = team === 0 ? 0x5a6340 : 0x6c7770, belly = team === 0 ? 0x8a8f7c : 0x9db0b8, dark = 0x222222, glass = 0x2a3a48;
  const parts = [
    [0.95, 1.0, 6.4, 0, 0, 0.3, body], [1.1, 1.1, 1.2, 0, 0, -3.3, dark], [0.85, 0.3, 5.6, 0, -0.55, 0.4, belly],
    [0.6, 0.45, 1.3, 0, 0.68, -0.6, glass], [10.6, 0.16, 1.9, 0, -0.25, -0.7, body], [3.8, 0.12, 0.95, 0, 0.12, 3.05, body],
    [0.12, 1.3, 1.1, 0, 0.75, 3.05, body],
  ];
  if (team === 0) for (const [x, c] of [[2.2, 0xe8e8e0], [2.5, 0x111111], [2.8, 0xe8e8e0], [3.1, 0x111111], [3.4, 0xe8e8e0]]) parts.push([0.3, 0.17, 1.92, x, -0.25, -0.7, c], [0.3, 0.17, 1.92, -x, -0.25, -0.7, c]);
  else parts.push([0.9, 0.17, 1.92, 4.85, -0.25, -0.7, 0xd8b43a], [0.9, 0.17, 1.92, -4.85, -0.25, -0.7, 0xd8b43a]);
  return (planeGeo[team] = { body: colourBoxes(parts), prop: colourBoxes([[0.12, 2.8, 0.06, 0, 0, 0, dark], [2.8, 0.12, 0.06, 0, 0, 0, dark]]) });
}
function makePlane(team) {
  const G = planeGeos(team), g = new THREE.Group();
  g.rotation.order = 'YXZ';
  const body = new THREE.Mesh(G.body, vcMat);
  body.castShadow = true;
  const prop = new THREE.Mesh(G.prop, vcMat);
  prop.position.z = -3.95;
  // An invisible box a bit bigger than the plane takes the bullets, so near misses still count.
  const hit = new THREE.Mesh(planeHitGeo, planeHitMat);
  hit.visible = false;
  g.add(body, prop, hit);
  g.userData.body = body; g.userData.prop = prop; g.userData.hit = hit;
  return g;
}
const planeHitGeo = new THREE.BoxGeometry(14, 4, 10);
const planeHitMat = new THREE.MeshBasicMaterial();
const chuteGeo = new THREE.SphereGeometry(3.2, 14, 6, 0, Math.PI * 2, 0, Math.PI / 2.4).scale(1, 0.55, 1);
const chuteMats = [0xd9d4c4, 0x8a8a70].map((c) => new THREE.MeshStandardMaterial({ color: c, roughness: 0.9, side: THREE.DoubleSide }));
const chuteLines = new THREE.BufferGeometry().setFromPoints([[2.2, 2.2], [-2.2, 2.2], [2.2, -2.2], [-2.2, -2.2]]
  .flatMap(([x, z]) => [new V3(x, 0.4, z), new V3(0, -3.8, 0)]));
const lineMat = new THREE.LineBasicMaterial({ color: 0x333333 });
function makeChute(team) {
  const g = new THREE.Group();
  g.add(new THREE.Mesh(chuteGeo, chuteMats[team === 1 ? 1 : 0]), new THREE.LineSegments(chuteLines, lineMat));
  g.position.y = 5.4;
  return g;
}
// Higgins boat: open top, ramp at the front (local -Z) that drops on the beach.
let boatGeo = null, rampGeo = null;
function makeBoat() {
  if (!boatGeo) {
    const hull = 0x5c6a6e, inner = 0x4a5458;
    boatGeo = colourBoxes([[3.2, 0.3, 8, 0, 0.15, 0, inner], [0.25, 1.7, 8, 1.6, 0.85, 0, hull], [0.25, 1.7, 8, -1.6, 0.85, 0, hull],
      [3.2, 1.7, 0.25, 0, 0.85, 4, hull], [3.4, 0.25, 8.2, 0, -0.1, 0, 0x3a4246]]);
    rampGeo = colourBoxes([[3.2, 1.7, 0.2, 0, 0.85, 0, hull]]);
  }
  const g = new THREE.Group();
  const ramp = new THREE.Mesh(rampGeo, vcMat);
  ramp.position.set(0, 0.2, -4.05);
  g.add(new THREE.Mesh(boatGeo, vcMat), ramp);
  g.userData.ramp = ramp;
  return g;
}
// Troop carriers: an Allied C-47 in olive drab with invasion stripes, an Axis Ju 52 with three engines and fixed wheels.
const transportGeo = {};
const lampGeo = new THREE.BoxGeometry(0.08, 0.16, 0.16);
const LAMP_COLORS = [0x222222, 0xff2a1a, 0x2aff4a];
function makeTransport(team) {
  if (!transportGeo[team]) {
    const body = team === 0 ? 0x5a6340 : 0x4c5644, belly = team === 0 ? 0x8a8f7c : 0x93a7ae, dark = 0x222222, glass = 0x2a3a48, w = 0xe8e8e0, k = 0x111111;
    const parts = [
      [2.4, 2.5, 13, 0, 0, 0.5, body], [2.0, 2.0, 2.2, 0, -0.1, -6.8, body], [1.7, 0.55, 0.9, 0, 0.85, -6.3, glass],
      [1.5, 1.6, 3.4, 0, 0.35, 8.6, body], [2.2, 0.35, 12.5, 0, -1.25, 0.6, belly],
      [24, 0.3, 3.4, 0, -0.75, -1.6, body], [8.4, 0.22, 2.2, 0, 0.6, 9.4, body], [0.22, 3.2, 2.6, 0, 2.1, 9.4, body],
      [0.06, 1.75, 1.15, -1.22, -0.05, 3, k], // the open door on the left
    ];
    // Engine nacelles with a dark cowling ring at the front.
    for (const x of team === 0 ? [-4.4, 4.4] : [-4.6, 0, 4.6]) parts.push(x ? [1.2, 1.2, 2.8, x, -0.55, -3.3, body] : [1.4, 1.4, 1.2, 0, -0.1, -8.3, body], [1.35, 1.35, 0.45, x, x ? -0.55 : -0.1, x ? -4.75 : -9.0, dark]);
    if (team === 0) {
      for (const [x, c] of [[6.4, w], [6.9, k], [7.4, w], [7.9, k], [8.4, w]]) parts.push([0.5, 0.32, 3.42, x, -0.75, -1.6, c], [0.5, 0.32, 3.42, -x, -0.75, -1.6, c]);
      for (const [z, c] of [[4.4, w], [4.9, k], [5.4, w], [5.9, k], [6.4, w]]) parts.push([2.45, 2.55, 0.5, 0, 0, z, c]);
    } else {
      parts.push([2.45, 2.55, 0.8, 0, 0, 5.4, 0xd8b43a]);
      for (const x of [-2.4, 2.4]) parts.push([0.25, 1.4, 0.25, x, -1.6, -2.2, dark], [0.35, 0.95, 0.95, x, -2.3, -2.2, dark]);
    }
    transportGeo[team] = colourBoxes(parts);
  }
  const g = new THREE.Group();
  g.rotation.order = 'YXZ';
  const body = new THREE.Mesh(transportGeo[team], vcMat);
  body.castShadow = true;
  // The jump light beside the door.
  const lamp = new THREE.Mesh(lampGeo, new THREE.MeshBasicMaterial({ color: LAMP_COLORS[0] }));
  lamp.position.set(-1.25, 0.95, 2.3);
  g.add(body, lamp);
  g.userData.lamp = lamp;
  return g;
}
const transportPool = [[], []], _tp = new V3(), _slotPos = new V3();
function updateTransports() {
  const used = [0, 0];
  if (isDday() && match) {
    const tau = serverNow() - match.startAt, reach = (TRANSPORT.reach + 250) / TRANSPORT.speed * 1000;
    for (const team of [0, 1]) {
      const off = team ? TRANSPORT.runMs / 2 : 0, pool = transportPool[team];
      for (let k = Math.ceil((tau - off - reach) / TRANSPORT.runMs); k * TRANSPORT.runMs + off <= tau + reach; k++) {
        for (let slot = 0; slot < 3; slot++) {
          const ph = transportPose(team, k, slot, tau, _tp);
          if (Math.abs(_tp.x) > TRANSPORT.reach) continue;
          let m = pool[used[team]++];
          if (!m) { m = makeTransport(team); scene.add(m); pool.push(m); }
          m.visible = true;
          m.position.copy(_tp);
          m.rotation.set(0, team === 0 ? -Math.PI / 2 : Math.PI / 2, Math.sin(tau / 1700 + k + slot) * 0.03);
          m.userData.lamp.material.color.setHex(LAMP_COLORS[ph > TRANSPORT.greenMs ? 0 : jumpLight(ph)]);
        }
      }
    }
  }
  for (const team of [0, 1]) for (let i = used[team]; i < transportPool[team].length; i++) transportPool[team][i].visible = false;
}
const bombGeo = new THREE.CapsuleGeometry(0.16, 0.7, 4, 8).rotateX(Math.PI / 2);
const bombMat = new THREE.MeshStandardMaterial({ color: 0x3a3d33, roughness: 0.6, metalness: 0.4 });

// A remote soldier's look follows what they are: on foot, under a chute, in a plane or in a boat.
function setForm(rp, form) {
  if (rp.form === form) return;
  rp.form = form;
  const team = teamOf(rp.id) === 1 ? 1 : 0;
  if (form === FORM.plane && !rp.plane) {
    rp.plane = makePlane(team);
    rp.plane.userData.hit.userData = { pid: rp.id, part: 'body', plane: true };
    rp.group.add(rp.plane);
  }
  if (form === FORM.chute && !rp.chute) { rp.chute = makeChute(team); rp.group.add(rp.chute); }
  if (form === FORM.boat && !rp.boat) { rp.boat = makeBoat(); rp.boat.position.y = -0.35; rp.group.add(rp.boat); }
  if (rp.hips) rp.hips.visible = rp.torso.visible = form !== FORM.plane;
  if (rp.plane) rp.plane.visible = form === FORM.plane;
  if (rp.chute) rp.chute.visible = form === FORM.chute;
  if (rp.boat) { rp.boat.visible = form === FORM.boat; rp.boat.userData.ramp.rotation.x = 0; }
}

// A big fireball: bombs, and planes going down.
function bigBoom(p, scale = 1) {
  const fl = new THREE.Sprite(new THREE.SpriteMaterial({ map: flashTex, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true }));
  fl.position.set(p.x, p.y + 1, p.z);
  fl.scale.setScalar(9 * scale);
  scene.add(fl);
  booms.push({ s: fl, t: 0, big: scale });
  const up = new V3(0, 1, 0);
  emit(p, up, 'dust', Math.round(60 * scale));
  emit(p, up, 'metal', Math.round(40 * scale));
  const dist = p.distanceTo(camera.position);
  sfx.boom(dist, dist < 40);
  if (dist < 45) P.shake = Math.max(P.shake, (1 - dist / 45) * 1.2);
}

// ---- The local player's roles ----
let myPlane = null;
const beachedBoats = [];
function endRide(beached) {
  if (!P.ride) return;
  const b = P.ride.boat;
  P.ride = null;
  if (beached) { b.userData.ramp.rotation.x = -1.3; beachedBoats.push({ b, t: 0 }); } else scene.remove(b);
}
function clearDday() {
  endRide(false);
  if (myPlane) { scene.remove(myPlane); myPlane = null; }
  for (const x of beachedBoats) scene.remove(x.b);
  beachedBoats.length = 0;
  P.flight = null; P.chute = false; P.form = FORM.ground; P.jump = null; P.chuteAt = 0;
  $('flighthud').classList.add('hidden');
  $('jumplight').className = 'hidden';
}
function setupRoleSpawn() {
  const role = roleOf(myId), team = myTeam() === 1 ? 1 : 0;
  const enemies = [...remotes.values()].filter((r) => r.alive && r.has && isEnemy(r.id)).map((r) => r.group.position);
  // You ride the right wing of the Vic, so the door looks across at the rest of the formation.
  const sp = ddaySpawn(role, team, enemies, serverNow() - match.startAt, 2);
  clearDday();
  P.pos.copy(sp.pos); P.viewY = sp.pos.y; P.yaw = sp.yaw; P.pitch = 0; P.vel.set(0, 0, 0);
  P.form = sp.form;
  P.chute = sp.form === FORM.chute;
  P.jump = sp.jump || null;
  // In the door you face out of it, forward and left, toward the rest of the Vic.
  if (P.jump) { P.yaw = sp.yaw + 1.0; P.pitch = -0.15; }
  if (sp.form === FORM.plane) {
    P.flight = { speed: PLANE.speed, yaw: sp.yaw, pitch: 0, roll: 0, nextGun: 0, nextBomb: 0, side: 1, crashed: false };
    myPlane = makePlane(team);
    scene.add(myPlane);
    camera.position.copy(P.pos).addScaledVector(fwdOf(sp.yaw), -16).y += 4.5;
  }
  if (sp.form === FORM.boat) { P.ride = { x: sp.pos.x, z: sp.pos.z, boat: makeBoat() }; scene.add(P.ride.boat); }
  $('flighthud').classList.toggle('hidden', !P.flight);
  $('ammo').classList.toggle('hidden', !!P.flight);
}
function updateRide(dt, now) {
  const r = P.ride;
  if (serverNow() >= match.startAt) r.x = Math.min(BOAT.landX, r.x + BOAT.speed * dt);
  const bob = Math.sin(now / 420 + r.z) * 0.15;
  r.boat.position.set(r.x, 0.05 + bob, r.z);
  r.boat.rotation.set(0, -Math.PI / 2, Math.sin(now / 600 + r.z) * 0.03);
  P.pos.set(r.x, 0.35 + bob, r.z); P.vel.set(0, 0, 0); P.viewY = P.pos.y; P.grounded = true;
  if (r.x >= BOAT.landX) {
    endRide(true);
    P.form = FORM.ground;
    P.pos.set(BOAT.landX + 3.2, 0, r.z); P.viewY = 0;
    notify('RAMP DOWN — TAKE THE BEACH', 'GO GO GO');
  }
}
// Standing in the door of a troop carrier: red light READY, green light JUMP. Space jumps on the green;
// anyone still aboard when it goes out gets pushed (the jumpmaster clears the plane over the drop zone).
function updateJump(canMove) {
  const j = P.jump, tau = serverNow() - match.startAt;
  let ph = jumpDoor(j, tau, P.pos);
  // After a stall (a hidden tab), still go out over the drop zone rather than wherever the plane is now.
  if (ph > TRANSPORT.greenMs) ph = jumpDoor(j, tau - (ph - TRANSPORT.greenMs), P.pos);
  const light = jumpLight(ph);
  P.vel.set(0, 0, 0); P.viewY = P.pos.y; P.grounded = true;
  P.shake = Math.max(P.shake, 0.3);
  const zone = 'ABCDE'[transportRun(j.team, j.k).flag];
  if (light !== j.light) {
    j.light = light;
    $('jumplight').className = ['', 'red', 'green'][light];
    setText('jlText', ['STAND UP — HOOK UP', 'READY', 'JUMP!'][light]);
    if (light === 1) playTone(480, 0.6, 0.12, 'sine');
    if (light === 2) { playTone(900, 0.18, 0.18, 'square'); playTone(900, 0.18, 0.18, 'square', 0.25); }
  }
  setText('jlSub', light === 2 ? 'Press SPACE to jump' : light === 1 ? `Stand in the door • drop zone ${zone}` : `Drop zone ${zone} in ${Math.ceil(-ph / 1000)}s`);
  if (light === 2 && ((canMove && keys.has('Space')) || ph >= TRANSPORT.greenMs)) jumpOut();
}
function jumpOut() {
  const dir = P.jump.team === 0 ? 1 : -1;
  P.jump = null;
  $('jumplight').className = 'hidden';
  // Out the left door with some of the plane's speed; the static line opens the chute a moment later.
  P.form = FORM.ground; P.grounded = false; P.shake = 0;
  P.vel.set(dir * 9, -1, -dir * 4);
  P.chuteAt = performance.now() + 900;
  playNoise(0.8, 700, 0.35);
  sendState(true);
}
function crashMe() {
  P.flight.crashed = true;
  bigBoom(P.pos, 1.3);
  if (myPlane) myPlane.visible = false;
  net.send({ t: 'crash' });
}
function planeGuns(now) {
  const f = P.flight, r2 = (v) => Math.round(v * 100) / 100;
  f.nextGun = now + 60000 / PLANE.gunRpm;
  f.side = -f.side;
  const fwd = fwdOf(f.yaw, f.pitch), right = new V3(Math.cos(f.yaw), 0, -Math.sin(f.yaw));
  const origin = P.pos.clone().addScaledVector(fwd, 1.5).addScaledVector(right, f.side * 2.4);
  const dir = fwd.clone().add(new V3(rand(-1, 1), rand(-1, 1), rand(-1, 1)).multiplyScalar(0.012)).normalize();
  playersGroup.updateMatrixWorld(true);
  raycaster.set(origin, dir);
  raycaster.far = 350;
  const hits = raycaster.intersectObjects(mapMeshes.concat(aliveHitboxes()), false);
  let end = origin.clone().addScaledVector(dir, 350);
  if (hits.length) {
    const h = hits[0], ud = h.object.userData;
    end = h.point;
    if (ud.pid) {
      net.send({ t: 'hit', target: ud.pid, dmg: PLANE.gunDmg * (ud.plane ? PLANE.hitMul : 1), head: false, w: 'mg' });
      showHitmarker(false); sfx.hit();
      emit(h.point, dir.clone().negate(), ud.plane ? 'metal' : 'blood', 6);
    } else emit(h.point, h.face ? h.face.normal.clone() : dir.clone().negate(), ud.surf, 6);
  }
  tracer(origin, end);
  net.send({ t: 'shot', f: [r2(origin.x), r2(origin.y), r2(origin.z)], e: [r2(end.x), r2(end.y), r2(end.z)], w: 'mg' });
  playGun(WEAPONS.titan.snd, 0.3);
}
function dropBomb(now) {
  const f = P.flight, r2 = (v) => Math.round(v * 100) / 100;
  f.nextBomb = now + PLANE.bombMs;
  const origin = P.pos.clone().add(new V3(0, -1.4, 0));
  const vel = fwdOf(f.yaw, f.pitch).multiplyScalar(f.speed * 0.9).add(new V3(0, -3, 0));
  spawnGrenade('bomb', myId, origin, vel);
  net.send({ t: 'throw', k: 'bomb', p: [r2(origin.x), r2(origin.y), r2(origin.z)], v: [r2(vel.x), r2(vel.y), r2(vel.z)] });
  playNoise(0.3, 400, 0.3);
}
// Mouse picks a heading, the plane turns toward it at a fixed rate. W/S throttle.
function updateFlight(dt, now, canMove) {
  const f = P.flight;
  if (f.crashed) return;
  if (canMove) f.speed = clamp(f.speed + ((keys.has('KeyW') ? 1 : 0) - (keys.has('KeyS') ? 1 : 0)) * 25 * dt, PLANE.min, PLANE.max);
  const edge = mapHalf + 45;
  if (Math.abs(P.pos.x) > edge || Math.abs(P.pos.z) > edge) P.yaw = Math.atan2(P.pos.x, P.pos.z);
  if (P.pos.y > PLANE.ceiling) P.pitch = Math.min(P.pitch, -0.15);
  P.pitch = clamp(P.pitch, -0.9, 0.75);
  const rate = PLANE.turn * dt * (f.speed / PLANE.speed);
  let dyaw = Math.atan2(Math.sin(P.yaw - f.yaw), Math.cos(P.yaw - f.yaw));
  P.yaw = f.yaw + clamp(dyaw, -0.8, 0.8);
  f.yaw += clamp(dyaw, -rate, rate);
  f.pitch += clamp(P.pitch - f.pitch, -rate, rate);
  f.roll = damp(f.roll, clamp(-dyaw * 1.6, -1.1, 1.1), 4, dt);
  const fwd = fwdOf(f.yaw, f.pitch);
  if (canMove) P.pos.addScaledVector(fwd, f.speed * dt);
  P.vel.copy(fwd).multiplyScalar(f.speed);
  myPlane.position.copy(P.pos);
  myPlane.rotation.set(f.pitch, f.yaw, f.roll);
  myPlane.userData.prop.rotation.z += dt * 60;
  if (canMove && (P.pos.y < 1.5 || !freeAt(P.pos.x, P.pos.y - 0.6, P.pos.z, 1.2))) { crashMe(); return; }
  if (canMove && mouseL && now >= f.nextGun) planeGuns(now);
  if (canMove && (aiming() || keys.has('Space')) && now >= f.nextBomb) dropBomb(now);
}
function updateFlightCamera(dt) {
  const f = P.flight, fwd = fwdOf(f.yaw, f.pitch);
  const want = P.pos.clone().addScaledVector(fwd, -16).add(new V3(0, 4.5, 0));
  camera.position.lerp(want, 1 - Math.exp(-8 * dt));
  camera.lookAt(P.pos.clone().addScaledVector(fwd, 45));
  const sh = P.shake * 0.03;
  P.shake = damp(P.shake, 0, 3, dt);
  camera.rotation.x += rand(-sh, sh); camera.rotation.y += rand(-sh, sh);
  if (Math.abs(camera.fov - 75) > 0.01) { camera.fov = 75; camera.updateProjectionMatrix(); }
}
function updateDday(dt, now) {
  for (let i = beachedBoats.length - 1; i >= 0; i--) {
    const x = beachedBoats[i];
    x.t += dt;
    if (x.t > 8) { scene.remove(x.b); beachedBoats.splice(i, 1); }
  }
  if (!P.alive || !isDday()) return;
  if (P.flight) {
    const f = P.flight, ready = now >= f.nextBomb;
    setText('flighthud', `SPEED ${Math.round(f.speed * 3.6)} km/h   ALT ${Math.round(P.pos.y)} m   BOMB ${ready ? 'READY' : '…'}`);
  }
}

/* ============================ OBJECTIVES ============================ */

// Flags (Domination) and the moving hill (Hardpoint), drawn in the world.
let objGroup = null, objMarks = [];
function clearObjectives() {
  if (objGroup) { scene.remove(objGroup); objGroup = null; }
  objMarks = [];
}
const relColor = (team) => (team === 2 ? '#ff9f1a' : team < 0 ? '#e8e8e8' : team === myTeam() ? TEAM_COLORS[0] : TEAM_COLORS[1]);
function makeMark(label, r, flag) {
  const g = new THREE.Group();
  const col = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.8, depthWrite: false, side: THREE.DoubleSide });
  const ring = new THREE.Mesh(new THREE.RingGeometry(r - 0.18, r, 56).rotateX(-Math.PI / 2), col);
  ring.position.y = 0.04; g.add(ring);
  const wallMat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.09, depthWrite: false, side: THREE.DoubleSide });
  g.add(new THREE.Mesh(new THREE.CylinderGeometry(r, r, 2.4, 56, 1, true).translate(0, 1.2, 0), wallMat));
  let cloth = null;
  if (flag) {
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 3.4, 8).translate(0, 1.7, 0), gunMetal);
    pole.castShadow = true; g.add(pole);
    cloth = new THREE.Mesh(new THREE.PlaneGeometry(0.9, 0.55).translate(0.47, 3.05, 0), new THREE.MeshStandardMaterial({ color: 0xffffff, side: THREE.DoubleSide, roughness: 0.9 }));
    g.add(cloth);
  }
  const c = document.createElement('canvas'); c.width = c.height = 128;
  const tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace;
  const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, depthTest: false, depthWrite: false, sizeAttenuation: false, transparent: true }));
  sprite.scale.set(0.055, 0.055, 1); sprite.position.y = 4; sprite.renderOrder = 10; g.add(sprite);
  objGroup.add(g);
  return { g, label, col, wallMat, cloth, c, tex, key: '' };
}
function drawMark(m, fill, ringColor, prog, blink) {
  const key = `${fill}|${ringColor}|${prog.toFixed(2)}|${blink}`;
  if (m.key === key) return;
  m.key = key;
  const g = m.c.getContext('2d');
  g.clearRect(0, 0, 128, 128);
  g.fillStyle = 'rgba(0,0,0,0.55)'; g.beginPath(); g.arc(64, 64, 52, 0, 7); g.fill();
  g.strokeStyle = fill; g.lineWidth = 8; g.beginPath(); g.arc(64, 64, 50, 0, 7); g.stroke();
  if (prog > 0) { g.strokeStyle = ringColor; g.lineWidth = 12; g.beginPath(); g.arc(64, 64, 50, -Math.PI / 2, -Math.PI / 2 + prog * Math.PI * 2); g.stroke(); }
  g.fillStyle = blink ? '#ff9f1a' : fill; g.font = `700 ${m.label.length > 1 ? 44 : 60}px Rajdhani, Arial, sans-serif`;
  g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(m.label, 64, 68);
  m.tex.needsUpdate = true;
  const hex = new THREE.Color(blink ? '#ff9f1a' : fill);
  m.col.color.copy(hex); m.wallMat.color.copy(hex);
  if (m.cloth) m.cloth.material.color.copy(hex);
}
function buildObjectives() {
  clearObjectives();
  if (!match || !(isDom(match.mode) || match.mode === 'hp')) return;
  objGroup = new THREE.Group();
  scene.add(objGroup);
  const z = MAPS[currentMap].zones;
  if (isDom(match.mode)) objMarks = z.dom.map(([x, zz], i) => { const m = makeMark('ABCDE'[i], domR(match.mode), true); m.g.position.set(x, 0, zz); return m; });
  else objMarks = [makeMark('HP', HP_R, false)];
}
// Zone currently being scored in Hardpoint.
const hpZone = () => MAPS[currentMap].zones.hp[(match?.obj?.hp?.[0] ?? 0) % MAPS[currentMap].zones.hp.length];
function updateObjectives(now) {
  if (!match || !objGroup) return;
  const blink = Math.floor(now / 300) % 2 === 0;
  if (isDom(match.mode)) {
    const flags = match.obj?.f || [];
    objMarks.forEach((m, i) => {
      const [owner, cap, prog, contested] = flags[i] || [-1, -1, 0, false];
      drawMark(m, relColor(owner), relColor(cap), prog, contested && blink);
    });
  } else {
    const m = objMarks[0], [x, z] = hpZone(), holder = match.obj?.hp?.[2] ?? -1;
    m.g.position.set(x, 0, z);
    drawMark(m, relColor(holder), '#fff', 0, holder === 2 && blink);
  }
}

/* ============================== PLAYER ============================== */

const P = {
  pos: new V3(), vel: new V3(), yaw: 0, pitch: 0, grounded: false, crouch: false, crouchT: 0, slideT: 0, slideDir: new V3(),
  hp: 100, alive: false, loadout: settings.loadout, pendingLoadout: null, weapons: [], cur: 0, adsT: 0, sprintT: 0,
  reloadUntil: 0, reloadStart: 0, swapUntil: 0, nextFire: 0, wantShot: false, bloom: 0, kick: 0, camKick: 0,
  bobPhase: 0, stepDist: 0, viewY: 0, sprinting: false, jumpReady: 0, deathAt: 0, killerId: null, swayX: 0, swayY: 0,
  equip: { frag: 0, smoke: 0 }, throwReady: 0, throwUntil: 0, shake: 0, meleeUntil: 0,
  form: 0, flight: null, chute: false, ride: null, jump: null, chuteAt: 0,
};
if (!LOADOUTS[P.loadout]) P.loadout = 'assault';
const RADIUS = 0.38, GRAVITY = 22;
const curW = () => P.weapons[P.cur];
const heightNow = () => lerp(1.8, 1.15, P.crouchT);

function overlaps(x, y, z, h, b) {
  return x + RADIUS > b.min.x && x - RADIUS < b.max.x && z + RADIUS > b.min.z && z - RADIUS < b.max.z && y + h > b.min.y && y < b.max.y;
}
function freeAt(x, y, z, h) { for (const b of collidersNear(x, z, 1)) if (overlaps(x, y, z, h, b)) return false; return true; }
// Shared by the local player and bots: anything with pos, vel and grounded.
function moveAxis(e, axis, amount, h) {
  if (amount === 0) return;
  e.pos[axis] += amount;
  for (const b of collidersNear(e.pos.x, e.pos.z, 1)) {
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
  for (const b of collidersNear(e.pos.x, e.pos.z, 1)) {
    if (!overlaps(e.pos.x, e.pos.y, e.pos.z, h, b)) continue;
    if (e.vel.y <= 0) { e.pos.y = b.max.y; e.grounded = true; } else e.pos.y = b.min.y - h - 0.001;
    e.vel.y = 0;
  }
  if (e.pos.y <= 0) { e.pos.y = 0; e.vel.y = 0; e.grounded = true; }
  e.pos.x = clamp(e.pos.x, -mapHalf + RADIUS, mapHalf - RADIUS);
  e.pos.z = clamp(e.pos.z, -mapHalf + RADIUS, mapHalf - RADIUS);
}

const amZombie = () => match?.mode === 'inf' && myTeam() === 1;
function giveKit() {
  const ids = amZombie() ? ['knife'] : LOADOUTS[P.loadout].weapons;
  P.weapons = ids.map((id) => ({ id, def: WEAPONS[id], mag: WEAPONS[id].mag, reserve: WEAPONS[id].reserve }));
  P.cur = 0;
  P.equip = amZombie() ? { frag: 0, smoke: 0 } : { frag: 2, smoke: 2 };
}
function dressViewmodel() {
  const C = CHARACTERS[settings.char] || CHARACTERS.bulwark;
  sleeveMat.color.setHex(C.sleeve); gloveMat.color.setHex(C.gloves);
  if (amZombie()) { sleeveMat.color.lerp(ZOMBIE_TINT, 0.5); gloveMat.color.setHex(0x5a7a3a); }
}
function spawnMe(sp) {
  P.loadout = P.pendingLoadout || P.loadout;
  P.pendingLoadout = null;
  giveKit();
  dressViewmodel();
  P.hp = 100; P.alive = true;
  P.pos.copy(sp); P.vel.set(0, 0, 0); P.viewY = sp.y;
  P.yaw = Math.atan2(sp.x, sp.z); P.pitch = 0;
  P.crouch = false; P.crouchT = 0; P.slideT = 0; P.adsT = 0; P.sprintT = 0;
  P.reloadUntil = 0; P.swapUntil = performance.now() + 400; P.wantShot = false; P.bloom = 0;
  P.throwUntil = 0; P.meleeUntil = 0;
  if (isDday()) setupRoleSpawn();
  showViewmodel();
  $('death').classList.add('hidden');
  sendState(true);
}
// Away from enemies; with an anchor (teammates or the objective), the safe spot closest to it.
function pickSpawn(enemies, anchor) {
  if (!enemies.length && !anchor) return spawns[Math.floor(Math.random() * spawns.length)];
  const scored = spawns.map((s) => ({ s, d: enemies.length ? Math.min(...enemies.map((e) => e.distanceToSquared(s))) : Infinity })).sort((a, b) => b.d - a.d);
  if (anchor) {
    const safe = scored.filter((x) => x.d > 18 * 18);
    const pool = (safe.length >= 3 ? safe : scored.slice(0, 5)).sort((a, b) => a.s.distanceToSquared(anchor) - b.s.distanceToSquared(anchor));
    return pool[Math.floor(Math.random() * Math.min(3, pool.length))].s;
  }
  return scored[Math.floor(Math.random() * Math.min(3, scored.length))].s;
}
function bestSpawn() {
  const alive = [...remotes.values()].filter((r) => r.alive && r.has);
  const enemies = alive.filter((r) => isEnemy(r.id)).map((r) => r.group.position);
  let anchor = null;
  if (match && (isDom(match.mode) || match.mode === 'hp')) {
    const allies = alive.filter((r) => !isEnemy(r.id));
    if (allies.length) anchor = allies.reduce((a, r) => a.add(r.group.position), new V3()).divideScalar(allies.length);
  }
  return pickSpawn(enemies, anchor);
}
function showViewmodel() {
  for (const [id, m] of Object.entries(vmModels)) m.visible = P.alive && !P.flight && curW() && id === curW().id;
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
  if (!P.alive || P.jump || now < P.throwReady || now < P.swapUntil) return;
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
  if (P.chuteAt && now >= P.chuteAt) {
    P.chuteAt = 0;
    if (!P.grounded) { P.chute = true; P.form = FORM.chute; playNoise(0.3, 250, 0.5); }
  }
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
  if (P.chute) speed = CHUTE.steer;
  if (match?.mode === 'inf' && !amZombie()) speed *= INF_SURVIVOR_SPEED;
  if (P.slideT > 0) {
    P.slideT -= dt;
    const s = 10.5 * Math.max(0, P.slideT / 0.75) + 2.5;
    P.vel.x = P.slideDir.x * s; P.vel.z = P.slideDir.z * s;
  } else {
    const accel = P.grounded ? 14 : P.chute ? 4 : 3;
    P.vel.x = damp(P.vel.x, wx * speed, accel, dt);
    P.vel.z = damp(P.vel.z, wz * speed, accel, dt);
  }
  if (canMove && keys.has('Space') && P.grounded && !P.chute && now > P.jumpReady) {
    if (P.crouch && freeAt(P.pos.x, P.pos.y, P.pos.z, 1.8)) P.crouch = false;
    if (!P.crouch) { P.vel.y = 7.2; P.grounded = false; P.slideT = 0; P.jumpReady = now + 300; }
  }
  P.crouchT = damp(P.crouchT, P.crouch || P.slideT > 0 ? 1 : 0, 14, dt);
  const h = heightNow();
  const wasGrounded = P.grounded;
  if (P.chute) P.vel.y = (canMove ? -CHUTE.fall : 0) + GRAVITY * dt;
  physicsStep(P, h, dt);
  if (P.grounded && !wasGrounded) sfx.step(true);
  if (P.chute && P.grounded) { P.chute = false; P.form = FORM.ground; }
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
function melee(now) {
  const d = curW().def;
  P.nextFire = now + 60000 / d.rpm;
  P.meleeUntil = now + 300;
  camera.updateMatrixWorld();
  playersGroup.updateMatrixWorld(true);
  const origin = camera.getWorldPosition(new V3()), dir = camera.getWorldDirection(new V3());
  raycaster.set(origin, dir);
  raycaster.far = d.range;
  const hits = raycaster.intersectObjects(mapMeshes.concat(aliveHitboxes()), false);
  P.vel.x += dir.x * 5; P.vel.z += dir.z * 5;
  sfx.swish();
  const end = hits.length ? hits[0].point : origin.clone().addScaledVector(dir, d.range);
  if (hits.length && hits[0].object.userData.pid) {
    net.send({ t: 'hit', target: hits[0].object.userData.pid, dmg: d.dmg, head: false, w: 'knife' });
    showHitmarker(false); sfx.stab();
    emit(hits[0].point, dir.clone().negate(), 'blood', 16);
  } else if (hits.length) emit(hits[0].point, dir.clone().negate(), hits[0].object.userData.surf, 6);
  const r2 = (v) => Math.round(v * 100) / 100;
  net.send({ t: 'shot', f: [r2(origin.x), r2(origin.y), r2(origin.z)], e: [r2(end.x), r2(end.y), r2(end.z)], w: 'knife' });
}
function fire(now) {
  const w = curW(), d = w.def;
  if (d.melee) { melee(now); return; }
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
      if (ud.plane) dmg *= PLANE.hitMul;
      net.send({ t: 'hit', target: ud.pid, dmg: Math.round(dmg), head: ud.part === 'head', w: w.id });
      showHitmarker(false);
      if (ud.part === 'head') sfx.head(); else sfx.hit();
      emit(h.point, back, ud.plane ? 'metal' : 'blood', 10);
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
  const adsWanted = aiming() && canMove && !P.sprinting && now >= P.swapUntil && !d.melee;
  P.adsT = clamp(P.adsT + (adsWanted ? 1 : -1) * dt / d.adsTime, 0, 1);
  P.sprintT = damp(P.sprintT, P.sprinting ? 1 : 0, 10, dt);
  if (P.reloadUntil && now >= P.reloadUntil) finishReload();
  const triggering = d.auto ? mouseL : P.wantShot;
  if (triggering && canMove && now >= P.nextFire && !P.reloadUntil && now >= P.swapUntil && now >= P.throwUntil && (d.melee || P.sprintT < 0.35)) {
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
  if (now < P.meleeUntil) {
    const r = Math.sin((1 - (P.meleeUntil - now) / 300) * Math.PI);
    pos.x -= 0.16 * r; pos.z -= 0.22 * r; pos.y += 0.04 * r; rot.y += 0.9 * r; rot.z += 0.5 * r;
  }
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
  if (!match || match.mode === 'inf' || nukeState || (pInfo(myId)?.kills ?? 0) < NUKE_KILLS) return;
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
let pIndexOf = null, pIndex = new Map();
const pInfo = (id) => {
  if (!room) return undefined;
  if (pIndexOf !== room.players) { pIndexOf = room.players; pIndex = new Map(room.players.map((p) => [p.id, p])); }
  return pIndex.get(id);
};
const teamOf = (id) => pInfo(id)?.team ?? -1;
const myTeam = () => teamOf(myId);
const isEnemy = (id) => id !== myId && !(match && MODES[match.mode]?.teams && teamOf(id) === myTeam());
const teamName = (t) => TEAM_NAMES[match?.mode]?.[t] ?? '';
function refreshLooks() { for (const rp of remotes.values()) applyLook(rp); }
function setTeam(id, team) {
  const info = pInfo(id);
  if (info) info.team = team;
  refreshLooks();
}
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
    case 'role': {
      const info = pInfo(m.id);
      if (info) info.role = m.role;
      botDirector?.onRole(m.id, m.role);
      if (m.id === myId) { notify(P.alive ? 'Starts on your next spawn' : `Deploying as ${ROLE_NAMES[m.role]}`, ROLE_NAMES[m.role]); refreshRoleViews(); }
      break;
    }
    case 'roleFull':
      notify(`Every ${ROLE_NAMES[m.role]} slot on your team is taken by a player`, 'ROLE FULL');
      break;
    case 'lobby': {
      const prev = room;
      room = m;
      // The host left mid D-Day: the new host's game takes over running the bots.
      if (match && isDday() && !offline && m.hostId === myId && !botDirector && m.state === 'playing') botDirector = new HostBots();
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
      rp.formWant = m.r || 0; rp.roll = m.z || 0;
      break;
    }
    case 'bstate':
      // D-Day bots, batched by the host: [id, x, y, z, yaw, pitch, crouch, speed, weapon, form, roll].
      for (const e of m.b || []) {
        const rp = remotes.get(e[0]);
        if (!rp || !rp.alive) continue;
        rp.target.set(e[1], e[2], e[3]);
        if (!rp.has) { rp.group.position.copy(rp.target); rp.yaw = e[4]; rp.has = true; }
        rp.tyaw = e[4]; rp.pitch = e[5]; rp.crouch = !!e[6]; rp.speed = e[7] || 0; rp.formWant = e[9] || 0; rp.roll = e[10] || 0;
      }
      for (const x of m.s || []) onMsg({ t: 'shot', id: x[0], f: [x[1], x[2], x[3]], e: [x[4], x[5], x[6]], w: x[7] });
      break;
    case 'shot': {
      const rp = remotes.get(m.id);
      if (!rp || !Array.isArray(m.f) || !Array.isArray(m.e)) break;
      rp.lastShot = now;
      const from = new V3().fromArray(m.f), to = new V3().fromArray(m.e);
      if (m.w === 'knife') { sfx.swish(0.35 / (1 + from.distanceTo(camera.position) / 6)); break; }
      rp.flashT = 0.05;
      tracer(from, to);
      const def = WEAPONS[m.w] || WEAPONS.m4;
      const rel = from.clone().sub(camera.position), dist = rel.length();
      const right = new V3().setFromMatrixColumn(camera.matrixWorld, 0);
      playGun(def.snd, 0.5 / (1 + dist / 14), rel.normalize().dot(right) * 0.8, dist > 30 ? 0.5 : 1);
      break;
    }
    case 'damage':
      if (m.target === myId && P.alive) { P.hp = m.hp; onHurt(m.from); }
      botDirector?.onDamage(m);
      break;
    case 'hp':
      if (P.alive) P.hp = m.hp;
      break;
    case 'kill': {
      const k = pInfo(m.killer), v = pInfo(m.victim);
      if (k) k.kills = m.kk;
      if (v) { v.deaths = m.vd; v.alive = false; }
      const turned = match?.mode === 'inf' && m.vt === 1 && v && v.team === 0;
      if (m.vt != null) setTeam(m.victim, m.vt);
      addKillfeed(m.killer, m.victim, m.w, m.head);
      if (turned) {
        addFeedText(`${pName(m.victim)} has been INFECTED`);
        const left = room.players.filter((p) => p.team === 0);
        if (left.length === 1) {
          if (left[0].id === myId) notify('YOU ARE THE LAST SURVIVOR', 'LAST ONE STANDING');
          else addFeedText(`${pName(left[0].id)} is the last survivor`);
        }
      }
      botDirector?.onKilled(m.victim);
      if (m.victim === myId) onMyDeath(m.killer, m.head);
      else {
        const rp = remotes.get(m.victim);
        if (rp?.form === FORM.plane && rp.group.visible) bigBoom(rp.group.position, 1.3);
        if (rp) setRemoteAlive(rp, false);
      }
      if (m.killer === myId && m.victim !== myId) { showHitmarker(true); sfx.kill(); notify(`${m.head ? 'HEADSHOT  ' : ''}ELIMINATED ${pName(m.victim)}`, m.head ? '+150' : '+100'); }
      if (ui === 'hud' && !$('scoreboard').classList.contains('hidden')) renderScoreboard();
      break;
    }
    case 'spawned': {
      const info = pInfo(m.id);
      if (info) { info.alive = true; info.hp = 100; }
      if (m.team != null) setTeam(m.id, m.team);
      botDirector?.onSpawned(m.id);
      if (m.id === myId) { if (mapReady && match) spawnMe(bestSpawn()); }
      else { const rp = remotes.get(m.id); if (rp) setRemoteAlive(rp, true); }
      break;
    }
    case 'left':
      addFeedText(`${m.name} left the match`);
      removeRemote(m.id);
      break;
    case 'throw':
      if ((m.k === 'frag' || m.k === 'smoke' || m.k === 'bomb') && Array.isArray(m.p) && Array.isArray(m.v) && m.id !== myId) {
        spawnGrenade(m.k, m.id, new V3().fromArray(m.p), new V3().fromArray(m.v));
        const rp = remotes.get(m.id);
        if (rp) rp.lastShot = now;
      }
      break;
    case 'team': {
      const wasMe = m.id === myId;
      if (m.role && pInfo(m.id)) pInfo(m.id).role = m.role;
      setTeam(m.id, m.team);
      if (match?.mode === 'inf' && m.team === 1) {
        if (wasMe) { notify('YOU ARE THE INFECTED', 'KNIFE THEM ALL'); sfx.infected(); if (P.alive) { giveKit(); dressViewmodel(); showViewmodel(); } }
        else addFeedText(`${pName(m.id)} is now INFECTED`);
      }
      break;
    }
    case 'obj':
      if (match) match.obj = m;
      break;
    case 'cap':
      if (match) {
        const mine = m.team === myTeam();
        addFeedText(`${teamName(m.team)} captured ${'ABCDE'[m.i]}`);
        sfx.capture(mine);
        notify(`${mine ? 'CAPTURED' : 'LOST'} ${'ABCDE'[m.i]}`, mine ? '+FLAG' : '');
      }
      break;
    case 'hpmove':
      if (match) { if (match.obj?.hp) match.obj.hp[0] = m.i; addFeedText('The HARDPOINT has moved'); sfx.capture(true); }
      break;
    case 'nuke':
      if (m.by === myId) track('nuke_called', { game_type: offline ? 'bots' : 'online' });
      nukeState = { by: m.by, at: m.at, lastBeep: -1, boomed: false };
      addFeedText(`☢ ${pName(m.by)} called in a TACTICAL NUKE`);
      break;
    case 'end':
      if (m.nukeBy != null) {
        // Let everyone see the blast before the results appear.
        detonateNuke();
        clearTimeout(respawnTimer);
        setTimeout(() => showEnd(m.players, m.nukeBy, m), 3200);
      } else showEnd(m.players, null, m);
      break;
  }
}

function sendState(force) {
  const now = performance.now();
  if (!force && now - lastStateSent < 50) return;
  lastStateSent = now;
  const r2 = (v) => Math.round(v * 100) / 100;
  const f = P.flight;
  net.send({ t: 'state', p: [r2(P.pos.x), r2(P.pos.y), r2(P.pos.z)], y: r2(f ? f.yaw : P.yaw), x: r2(f ? f.pitch : P.pitch), c: P.crouch || P.slideT > 0 ? 1 : 0,
    s: r2(Math.hypot(P.vel.x, P.vel.z)), w: curW()?.id, r: P.form || 0, z: f ? r2(f.roll) : 0 });
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
  outer: for (const c of collidersIn(a.x, a.z, b.x, b.z)) {
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

const MODE_LIMITS = { ffa: 30, dom: 200, hp: 150, inf: 0, dday: 500 };

class LocalMatch {
  constructor(cfg) {
    this.cfg = cfg;
    this.mode = cfg.mode || 'ffa';
    this.teams = MODES[this.mode].teams;
    this.diff = BOT_DIFF[cfg.diff] || BOT_DIFF.normal;
    this.state = 'loading';
    this.startAt = 0; this.endAt = 0; this.scoreLimit = MODE_LIMITS[this.mode];
    this.nukeAt = 0; this.nukeBy = null;
    this.scores = [0, 0];
    this.flags = MAPS[cfg.map].zones.dom.map(() => ({ owner: -1, cap: -1, prog: 0, contested: false }));
    this.hpIdx = 0; this.hpUntil = 0; this.hpHolder = -1; this.objT = 0;
    this.me = { id: 1, name: cfg.name, loadout: cfg.loadout, char: cfg.char, team: this.mode === 'inf' ? 0 : this.teams ? 0 : -1, kills: 0, deaths: 0, hp: 100, alive: false, diedAt: 0, lastHit: 0, lastShot: -1e9, isMe: true };
    const names = [...BOT_NAMES].sort(() => Math.random() - 0.5), los = Object.keys(LOADOUTS);
    this.bots = [];
    for (let i = 0; i < cfg.bots; i++) {
      const loadout = los[Math.floor(Math.random() * los.length)];
      const gun = LOADOUTS[loadout].weapons[loadout === 'marksman' ? Math.floor(Math.random() * 2) : 0];
      // Alternate teams so the player's side and the bots' side stay even.
      const team = this.mode === 'inf' ? 0 : this.teams ? (i % 2 === 0 ? 1 : 0) : -1;
      this.bots.push({ id: i + 2, name: names[i % names.length], loadout, char: CHAR_IDS[Math.floor(Math.random() * CHAR_IDS.length)], gun, wid: gun, w: WEAPONS[gun], team, kills: 0, deaths: 0, hp: 100, alive: false, diedAt: 0, lastHit: 0, lastShot: -1e9,
        pos: new V3(), vel: new V3(), grounded: true, yaw: 0, pitch: 0, mag: WEAPONS[gun].mag, ai: null, sentAt: 0 });
    }
    if (this.mode === 'dday' && cfg.roster !== false) {
      const quota = [{ inf: 20, para: 15, jet: 15 }, { inf: 20, para: 15, jet: 15 }];
      this.me.team = Math.random() < 0.5 ? 0 : 1;
      const roles = Object.keys(quota[0]);
      this.me.role = ROLE_NAMES[cfg.role] ? cfg.role : roles[Math.floor(Math.random() * roles.length)];
      quota[this.me.team][this.me.role]--;
      let id = 2;
      for (const team of [0, 1]) for (const [role, n] of Object.entries(quota[team])) for (let i = 0; i < n; i++) this.bots.push(this.makeDdayBot(id++, team, role));
    }
    this.all = [this.me, ...this.bots];
    if (this.mode === 'inf') this.all[Math.floor(Math.random() * this.all.length)].team = 1;
  }
  makeDdayBot(id, team, role, name, loadout) {
    const los = Object.keys(LOADOUTS);
    loadout = LOADOUTS[loadout] ? loadout : los[Math.floor(Math.random() * los.length)];
    const gun = LOADOUTS[loadout].weapons[loadout === 'marksman' ? Math.floor(Math.random() * 2) : 0];
    return { id, name: name || (team === 0 ? 'Pvt. ' : 'Gfr. ') + DDAY_NAMES[Math.floor(Math.random() * DDAY_NAMES.length)], loadout, role, char: 'bulwark', gun, wid: gun, w: WEAPONS[gun],
      team, kills: 0, deaths: 0, hp: 100, alive: false, diedAt: 0, lastHit: 0, lastShot: -1e9, pos: new V3(), vel: new V3(), grounded: true,
      yaw: 0, pitch: 0, roll: 0, mag: WEAPONS[gun].mag, ai: null, sentAt: 0, form: FORM.ground, flight: null, ride: null, jump: null, isBot: true };
  }
  matchStart() { return this.startAt; }
  send(m) { queueMicrotask(() => onMsg(m)); }
  pub(p) { return { id: p.id, name: p.name, loadout: p.loadout, char: p.char, team: p.team, role: p.role || '', bot: !p.isMe, kills: p.kills, deaths: p.deaths, hp: Math.round(p.hp), alive: p.alive }; }
  obj() {
    const s = [Math.floor(this.scores[0]), Math.floor(this.scores[1])];
    if (isDom(this.mode)) return { s, f: this.flags.map((f) => [f.owner, f.cap, Math.round(f.prog * 100) / 100, f.contested]) };
    if (this.mode === 'hp') return { s, hp: [this.hpIdx, this.hpUntil, this.hpHolder] };
    return { s };
  }
  begin() {
    myId = 1;
    this.send({ t: 'lobby', code: 'OFFLINE', hostId: 1, map: this.cfg.map, mode: this.mode, state: 'loading', players: this.all.map((p) => this.pub(p)) });
    this.send({ t: 'load', map: this.cfg.map });
  }
  handle(m) {
    const now = serverNow();
    switch (m.t) {
      case 'loaded': {
        if (this.state !== 'loading') return;
        this.state = 'playing';
        this.startAt = now + 4000;
        this.endAt = this.startAt + (this.mode === 'inf' ? 5 : 10) * 60 * 1000;
        this.hpUntil = this.startAt + HP_ROTATE_MS;
        for (const p of this.all) { p.alive = true; p.hp = 100; }
        const used = new Map();
        for (const b of this.bots) {
          const side = this.sideSpawns(b.team), n = used.get(b.team) || 0;
          used.set(b.team, n + 1);
          this.spawnBot(b, side[(n + 1) % side.length]);
        }
        this.send({ t: 'go', mode: this.mode, startAt: this.startAt, endAt: this.endAt, scoreLimit: this.scoreLimit, obj: this.obj(), nukeAt: 0, players: this.all.map((p) => this.pub(p)) });
        break;
      }
      case 'shot': this.me.lastShot = now; break;
      case 'hit': { const t = this.bots.find((b) => b.id === m.target); if (t) this.applyHit(this.me, t, m.dmg, m.head, m.w); break; }
      case 'respawn':
        if (this.state === 'playing' && !this.me.alive && now - this.me.diedAt >= 2600) { this.me.alive = true; this.me.hp = 100; this.send({ t: 'spawned', id: 1, team: this.me.team }); }
        break;
      case 'setLoadout': if (LOADOUTS[m.loadout]) this.me.loadout = m.loadout; break;
      case 'setChar': if (CHARACTERS[m.char]) this.me.char = m.char; break;
      case 'nuke': if (this.mode !== 'inf' && this.me.kills >= NUKE_KILLS) this.callNuke(1); break;
      case 'crash': if (this.me.alive) this.killSelf(this.me, 'crash'); break;
      case 'setRole': {
        if (this.mode !== 'dday' || !ROLE_NAMES[m.role] || m.role === this.me.role) break;
        const pool = this.bots.filter((b) => b.team === this.me.team && b.role === m.role).sort((a, c) => a.alive - c.alive);
        if (!pool.length) { this.send({ t: 'roleFull', role: m.role }); break; }
        const b = pool[0];
        [b.role, this.me.role] = [this.me.role, m.role];
        this.send({ t: 'role', id: this.me.id, role: this.me.role });
        this.send({ t: 'role', id: b.id, role: b.role });
        break;
      }
    }
  }
  // Deaths with nobody to blame: crashing a plane.
  killSelf(t, w) {
    if (!t.alive) return;
    t.hp = 0; t.alive = false; t.deaths++; t.diedAt = serverNow();
    this.send({ t: 'kill', killer: t.id, victim: t.id, head: false, w, kk: t.kills, vd: t.deaths, vt: t.team });
  }
  // A bot's grenade or bomb leaves its hand (online, the host also tells everyone else).
  throwOut(kind, b, origin, vel) { spawnGrenade(kind, b.id, origin, vel); }
  // Team sides: team 0 starts on the west of the map, team 1 on the east.
  sideSpawns(team) {
    if (!this.teams || this.mode === 'inf' || team < 0) return spawns;
    return [...spawns].sort((a, b) => (team === 0 ? a.x - b.x : b.x - a.x)).slice(0, 8);
  }
  callNuke(id) {
    if (this.state !== 'playing' || this.nukeAt || this.mode === 'inf') return;
    this.nukeAt = serverNow() + 10000;
    this.nukeBy = id;
    this.send({ t: 'nuke', by: id, at: this.nukeAt });
  }
  fragDamage(ownerId, src, spec = FRAG, w = 'frag') {
    const owner = this.all.find((p) => p.id === ownerId);
    if (!owner || owner.isMe) return;
    for (const t of this.targets(owner)) {
      if (t.ent.form === FORM.plane) continue;
      const chest = new V3(t.pos.x, t.pos.y + 1.0, t.pos.z), d = src.distanceTo(chest);
      if (d < spec.radius && segmentClear(src, chest)) this.applyHit(owner, t.ent, spec.maxDmg * (1 - d / spec.radius), false, w);
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
    this.throwOut('frag', b, origin, vel);
  }
  applyHit(att, t, dmg, head, w) {
    const now = serverNow();
    if (this.state !== 'playing' || now < this.startAt || !att.alive || !t.alive || att === t) return;
    if (this.teams && att.team === t.team) return;
    t.hp -= clamp(Number(dmg) || 0, 0, 250);
    t.lastHit = now;
    if (t.ai) { t.ai.alertId = att.id; t.ai.alertUntil = now + 3000; }
    if (t.hp <= 0) {
      t.hp = 0; t.alive = false; t.deaths++; t.diedAt = now; att.kills++;
      if (this.mode === 'inf' && t.team === 0) t.team = 1;
      this.send({ t: 'kill', killer: att.id, victim: t.id, head: !!head, w, kk: att.kills, vd: t.deaths, vt: t.team });
      if (!att.isMe && att.kills >= NUKE_KILLS) this.callNuke(att.id);
      if (this.mode === 'ffa' && att.kills >= this.scoreLimit) this.end();
      if (this.mode === 'inf' && !this.all.some((p) => p.team === 0)) this.end();
    } else this.send({ t: 'damage', target: t.id, from: att.id, hp: Math.round(t.hp) });
  }
  winTeam() {
    const nb = this.nukeAt ? this.all.find((p) => p.id === this.nukeBy) : null;
    if (nb) return nb.team;
    if (this.mode === 'inf') return this.all.some((p) => p.team === 0) ? 0 : 1;
    if (isDom(this.mode) || this.mode === 'hp') {
      const [a, b] = this.scores.map(Math.floor);
      return a === b ? -1 : a > b ? 0 : 1;
    }
    return -1;
  }
  end() {
    if (this.state === 'ended') return;
    this.state = 'ended';
    const nb = this.nukeAt ? this.nukeBy : null;
    const standings = this.all.map((p) => this.pub(p)).sort((a, b) => (b.id === nb) - (a.id === nb) || b.kills - a.kills || a.deaths - b.deaths);
    this.send({ t: 'end', players: standings, nukeBy: nb, mode: this.mode, winTeam: this.winTeam(), scores: this.scores.map(Math.floor) });
  }
  // Enemies of `self` that are alive, with live position references.
  targets(self) {
    const list = [];
    const foe = (p) => p !== self && p.alive && p.form !== FORM.ride && (!this.teams || p.team !== self.team);
    if (foe(this.me) && P.alive) list.push({ id: 1, ent: this.me, pos: P.pos });
    for (const b of this.bots) if (foe(b)) list.push({ id: b.id, ent: b, pos: b.pos });
    return list;
  }
  // Same capture and scoring rules as update_objectives() in server.py.
  objStep(now) {
    const people = [];
    if (this.me.alive && P.alive) people.push({ team: this.me.team, pos: P.pos });
    for (const b of this.bots) if (b.alive) people.push({ team: b.team, pos: b.pos });
    const counts = (x, z, r) => {
      const c = [0, 0];
      for (const p of people) if (p.team >= 0 && p.pos.y < 6 && Math.hypot(p.pos.x - x, p.pos.z - z) < r) c[p.team]++;
      return c;
    };
    const zones = MAPS[this.cfg.map].zones;
    if (isDom(this.mode)) {
      zones.dom.forEach(([x, z], i) => {
        const f = this.flags[i], c = counts(x, z, domR(this.mode));
        f.contested = c[0] > 0 && c[1] > 0;
        if (f.contested) return;
        const team = c[0] ? 0 : c[1] ? 1 : -1;
        if (team < 0 || team === f.owner) { f.prog = Math.max(0, f.prog - 0.25 / 5); if (!f.prog) f.cap = -1; return; }
        if (f.cap !== team) { f.cap = team; f.prog = 0; }
        f.prog += 0.25 / (5 * (f.owner >= 0 ? 1.6 : 1)) * Math.min(3, c[team]);
        if (f.prog >= 1) { f.owner = team; f.cap = -1; f.prog = 0; this.send({ t: 'cap', i, team }); }
      });
      for (const f of this.flags) if (f.owner >= 0) this.scores[f.owner] += 0.25;
    } else {
      if (now >= this.hpUntil) {
        this.hpIdx = (this.hpIdx + 1) % zones.hp.length;
        this.hpUntil += HP_ROTATE_MS;
        this.send({ t: 'hpmove', i: this.hpIdx });
      }
      const [x, z] = zones.hp[this.hpIdx], c = counts(x, z, HP_R);
      this.hpHolder = c[0] && c[1] ? 2 : c[0] ? 0 : c[1] ? 1 : -1;
      if (this.hpHolder === 0 || this.hpHolder === 1) this.scores[this.hpHolder] += 0.25;
    }
    this.send({ t: 'obj', ...this.obj() });
    if (Math.max(...this.scores) >= this.scoreLimit) this.end();
  }
  freshAI(sp) {
    return { wp: null, target: null, visible: false, reactAt: 0, lastSeen: -1e9, lastSeenPos: new V3(), nextFire: 0, reloadUntil: 0, repath: 0,
      burst: 0, burstLen: randInt(this.diff.burst), nadeReady: 0, strafe: 0, strafeT: 0, thinkT: Math.random() * 0.3, stuckT: 0, lastPos: sp.clone(), alertId: null, alertUntil: 0, goalIdx: -1 };
  }
  spawnDdayBot(b) {
    const s = ddaySpawn(b.role, b.team, this.targets(b).map((t) => t.pos), serverNow() - this.matchStart(), 0);
    b.wid = b.gun; b.w = WEAPONS[b.gun]; b.mag = b.w.mag; b.nades = 1;
    b.pos.copy(s.pos); b.vel.set(0, 0, 0); b.grounded = false; b.yaw = s.yaw; b.pitch = 0; b.roll = 0; b.sentAt = 0;
    b.form = s.form;
    const cruise = PLANE.speed * rand(0.9, 1.05);
    b.flight = s.form === FORM.plane ? { speed: cruise, cruise, nextGun: 0, nextBomb: performance.now() + rand(2000, 8000), tgt: null, tgtT: 0, salvoAt: 0 } : null;
    b.ride = s.form === FORM.boat ? { x: s.pos.x, z: s.pos.z } : null;
    b.jump = s.jump || null;
    if (b.jump) {
      // Board the emptiest plane of the Vic; its paratroopers go out one after another (a "stick").
      if (!this.sticks || this.sticks.size > 300) this.sticks = new Map();
      const seat = (slot) => this.sticks.get(`${b.team}:${b.jump.k}:${slot}`) || 0;
      b.jump.slot = [0, 1, 2].sort((x, y) => seat(x) - seat(y))[0];
      jumpDoor(b.jump, serverNow() - this.matchStart(), b.pos);
      b.jump.delay = Math.min(TRANSPORT.greenMs - 150, 200 + this.stickPlace(b.jump) * 380 + rand(0, 120));
    }
    if (b.flight) this.joinFlight(b);
    b.ai = this.freshAI(b.pos);
  }
  stickPlace(j) {
    const key = `${j.team}:${j.k}:${j.slot}`, n = this.sticks.get(key) || 0;
    this.sticks.set(key, n + 1);
    return n;
  }
  // Paratroopers stand in the door until the green light, then jump in turn.
  updateBotJump(b, now) {
    const j = b.jump, tau = now - this.matchStart(), ph = jumpDoor(j, tau, b.pos), dir = j.team === 0 ? 1 : -1;
    b.vel.set(0, 0, 0); b.yaw = dir > 0 ? -Math.PI / 2 : Math.PI / 2;
    if (ph < j.delay) return;
    if (ph > j.delay + 100) jumpDoor(j, tau - (ph - j.delay), b.pos);
    b.jump = null; b.form = FORM.chute; b.grounded = false;
    b.vel.set(dir * 6, 0, -dir * 3);
    b.ai.lastPos.copy(b.pos);
  }
  // Bot fighters fly in flights of four. The first plane of a flight still flying leads: it circles the
  // flags, lines up bomb runs and picks fights. The rest hold their finger-four (or Vic, or pair) slots,
  // bomb when the leader does, and break off only to fight an enemy plane that comes close.
  flightOf(b, now) {
    if (this.flightsAt !== now) {
      this.flightsAt = now;
      this.flights = new Map();
      for (const team of [0, 1]) {
        const jets = this.bots.filter((x) => x.team === team && x.role === 'jet').sort((a, c) => a.id - c.id);
        for (let i = 0; i < jets.length; i += 4) {
          const up = jets.slice(i, i + 4).filter((x) => x.alive && x.flight);
          up.forEach((x, j) => this.flights.set(x, { lead: up[0], mates: up, slot: FLIGHT_SLOTS[up.length][j] }));
        }
      }
    }
    return this.flights.get(b);
  }
  slotPos(lead, [sx, sb, sy], out) {
    const fx = -Math.sin(lead.yaw), fz = -Math.cos(lead.yaw);
    return out.set(lead.pos.x - fz * sx - fx * sb, lead.pos.y + sy, lead.pos.z + fx * sx - fz * sb);
  }
  // A fresh fighter tucks in behind its flight leader if the leader is still coming in from the edge,
  // otherwise it enters level with the leader and catches up.
  joinFlight(b) {
    const jets = this.bots.filter((x) => x.team === b.team && x.role === 'jet').sort((a, c) => a.id - c.id);
    const i = jets.indexOf(b), group = jets.slice(i - (i % 4), i - (i % 4) + 4);
    const lead = group.find((x) => x !== b && x.alive && x.flight && x.form === FORM.plane);
    if (!lead) return;
    const slot = FLIGHT_SLOTS[4][Math.max(1, group.indexOf(b))];
    if (Math.abs(lead.pos.x) > mapHalf - 60) { this.slotPos(lead, slot, b.pos); b.yaw = lead.yaw; }
    else { b.pos.y = clamp(lead.pos.y + slot[2], 60, 140); b.pos.z = clamp(lead.pos.z, -200, 200); }
    b.flight.speed = lead.flight.speed;
  }
  updateBotRide(b, dt) {
    const r = b.ride;
    r.x = Math.min(BOAT.landX, r.x + BOAT.speed * dt);
    b.pos.set(r.x, 0.35, r.z); b.vel.set(0, 0, 0); b.yaw = -Math.PI / 2;
    if (r.x >= BOAT.landX) {
      b.ride = null; b.form = FORM.ground;
      b.pos.set(BOAT.landX + 3.2, 0, r.z); b.grounded = true;
      b.ai.lastPos.copy(b.pos);
    }
  }
  // Bot pilots circle the flags, line up bomb runs on enemy soldiers, and dogfight enemy planes.
  updateBotPlane(b, dt, now) {
    const f = b.flight, d = this.diff, fl = this.flightOf(b, now), lead = fl && fl.lead !== b ? fl.lead : null;
    f.tgtT -= dt;
    if (f.tgtT <= 0 || (f.tgt && !f.tgt.ent.alive) || (lead && f.tgt && now > f.breakUntil)) {
      f.tgtT = rand(4, 8);
      const foes = this.targets(b);
      const planes = foes.filter((t) => t.ent.form === FORM.plane && t.pos.distanceTo(b.pos) < (lead ? 150 : 260));
      const ground = foes.filter((t) => t.ent.form !== FORM.plane && t.pos.y < 8 && Math.abs(t.pos.x) < mapHalf);
      const any = (list) => list[Math.floor(Math.random() * list.length)];
      if (lead) {
        // A wingman fights an enemy fighter that comes close for a few seconds at most, then rejoins.
        f.tgt = !f.tgt && planes.length && Math.random() < 0.5 ? any(planes) : null;
        f.breakUntil = now + 7000;
      } else f.tgt = planes.length && Math.random() < (fl?.mates.length > 1 ? 0.25 : 0.45) ? any(planes) : ground.length ? any(ground) : null;
    }
    const T = f.tgt, dog = T && T.ent.form === FORM.plane, keep = lead && !dog;
    let tx, ty, tz, rate = PLANE.turn * 0.85 * dt;
    if (keep) {
      // Hold the slot: steer for a point ahead of it (and always ahead of us, so an overshoot never
      // turns us round), and speed up or ease off to draw level with it.
      const s = this.slotPos(lead, fl.slot, _slotPos), lf = fwdOf(lead.yaw);
      const ahead = (s.x - b.pos.x) * lf.x + (s.z - b.pos.z) * lf.z, look = 30 + Math.max(0, -ahead);
      tx = s.x + lf.x * look; tz = s.z + lf.z * look; ty = s.y;
      f.speed = Math.cos(lead.yaw - b.yaw) > 0.3 ? clamp(lead.flight.speed + ahead * 0.8, PLANE.min, PLANE.max) : damp(f.speed, lead.flight.speed, 1, dt);
      rate *= 1.25;
    } else {
      // A leader with wingmen flies a little slower and turns gently so the outside planes can hold on.
      const led = fl && fl.mates.length > 1 && !dog;
      f.speed = damp(f.speed, (f.cruise || PLANE.speed) * (led ? 0.92 : 1), 1, dt);
      if (led) rate *= 0.6;
      if (T) { tx = T.pos.x; tz = T.pos.z; ty = dog ? T.pos.y : 60; }
      else { const dom = MAPS[this.cfg.map].zones.dom, zz = dom[Math.floor(now / 9000 + b.id) % dom.length]; tx = zz[0]; tz = zz[1]; ty = 85; }
      const edge = mapHalf + 30;
      if (Math.abs(b.pos.x) > edge || Math.abs(b.pos.z) > edge) { tx = 0; tz = 0; }
    }
    const dx = tx - b.pos.x, dz = tz - b.pos.z, horiz = Math.hypot(dx, dz) || 1;
    // A bomb run passes straight over the target before turning back.
    const wantYaw = T && !dog && !keep && horiz < 30 ? b.yaw : Math.atan2(-dx, -dz);
    let wantPitch = clamp(Math.atan2(ty - b.pos.y, horiz), -0.35, 0.35);
    if (b.pos.y < 40) wantPitch = Math.max(wantPitch, 0.3);
    const dyaw = Math.atan2(Math.sin(wantYaw - b.yaw), Math.cos(wantYaw - b.yaw));
    b.yaw += clamp(dyaw, -rate, rate);
    b.pitch += clamp(wantPitch - b.pitch, -rate, rate);
    b.roll = damp(b.roll || 0, clamp(-dyaw * 1.6, -1, 1), 3, dt);
    const fwd = fwdOf(b.yaw, b.pitch);
    b.pos.addScaledVector(fwd, f.speed * dt);
    b.vel.copy(fwd).multiplyScalar(f.speed);
    if (b.pos.y < 1.5 || (b.pos.y < 25 && !freeAt(b.pos.x, b.pos.y - 0.6, b.pos.z, 1.2))) { this.killSelf(b, 'crash'); return; }
    const bomb = () => this.throwOut('bomb', b, b.pos.clone().add(new V3(0, -1.4, 0)), fwd.clone().multiplyScalar(f.speed * 0.9).add(new V3(0, -3, 0)));
    if (keep) {
      // Wingmen bomb on the leader's release.
      if (f.salvoAt && now >= f.salvoAt) { f.salvoAt = 0; bomb(); }
      return;
    }
    if (!T) return;
    if (!dog && now >= f.nextBomb) {
      // Release when the drop arc lands on the target.
      const throwLen = f.speed * 0.9 * Math.sqrt(Math.max(0, 2 * (b.pos.y - T.pos.y) / 20));
      if (Math.abs(horiz - throwLen) < 10 && Math.abs(dyaw) < 0.2) {
        f.nextBomb = now + rand(5000, 9000);
        bomb();
        if (fl) fl.mates.forEach((m, i) => { if (m !== b) m.flight.salvoAt = now + 140 * i; });
      }
    }
    if (dog && now >= f.nextGun) {
      const to = new V3().subVectors(T.pos, b.pos), dist = to.length();
      if (dist < 220 && fwd.dot(to.normalize()) > 0.985) {
        f.nextGun = now + 90;
        b.lastShot = now;
        const hit = Math.random() < d.acc * 0.55 * clamp(1 - dist / 260, 0.2, 1);
        const end = T.pos.clone().add(hit ? new V3() : new V3(rand(-4, 4), rand(-3, 3), rand(-4, 4)));
        this.send({ t: 'shot', id: b.id, f: [b.pos.x + fwd.x * 3, b.pos.y + fwd.y * 3, b.pos.z + fwd.z * 3], e: [end.x, end.y, end.z], w: 'mg' });
        if (hit) this.applyHit(b, T.ent, PLANE.gunDmg * PLANE.hitMul, false, 'mg');
      }
    }
  }
  spawnBot(b, sp) {
    if (this.mode === 'dday') { this.spawnDdayBot(b); return; }
    const zombie = this.mode === 'inf' && b.team === 1;
    b.wid = zombie ? 'knife' : b.gun; b.w = WEAPONS[b.wid];
    b.pos.copy(sp); b.vel.set(0, 0, 0); b.grounded = true;
    b.yaw = Math.atan2(sp.x, sp.z); b.pitch = 0; b.mag = b.w.mag; b.sentAt = 0; b.nades = zombie ? 0 : 1;
    b.ai = { wp: null, target: null, visible: false, reactAt: 0, lastSeen: -1e9, lastSeenPos: new V3(), nextFire: 0, reloadUntil: 0, repath: 0,
      burst: 0, burstLen: randInt(this.diff.burst), nadeReady: 0, strafe: 0, strafeT: 0, thinkT: 0, stuckT: 0, lastPos: sp.clone(), alertId: null, alertUntil: 0, goalIdx: -1 };
  }
  farSpawn(self) {
    const anchor = isDom(this.mode) || this.mode === 'hp' ? this.objective(self)?.pos : null;
    return pickSpawn(this.targets(self).map((t) => t.pos), anchor);
  }
  // Where a bot heads when it has nobody to fight: a flag, the hill, or the nearest survivor.
  objective(b) {
    const zones = MAPS[this.cfg.map].zones;
    if (isDom(this.mode)) {
      const ai = b.ai;
      const want = this.flags.map((f, i) => ({ i, f, d: Math.hypot(zones.dom[i][0] - b.pos.x, zones.dom[i][1] - b.pos.z) }))
        .filter(({ f }) => f.owner !== b.team || f.contested || (f.cap >= 0 && f.cap !== b.team));
      if (ai.goalIdx < 0 || !want.some((w) => w.i === ai.goalIdx)) {
        if (want.length) {
          // Mostly go for the closest flag, sometimes another, so bots spread out.
          want.sort((a, c) => a.d - c.d);
          ai.goalIdx = want[Math.random() < 0.65 ? 0 : Math.floor(Math.random() * want.length)].i;
        } else ai.goalIdx = Math.floor(Math.random() * zones.dom.length);
      }
      const [x, z] = zones.dom[ai.goalIdx];
      return { pos: new V3(x, 0, z), r: domR(this.mode) };
    }
    if (this.mode === 'hp') { const [x, z] = zones.hp[this.hpIdx]; return { pos: new V3(x, 0, z), r: HP_R }; }
    if (this.mode === 'inf' && b.team === 1) {
      let best = null, bd = Infinity;
      for (const t of this.targets(b)) { const d = t.pos.distanceTo(b.pos); if (d < bd) { bd = d; best = t; } }
      return best ? { pos: best.pos.clone(), r: 0, chase: true } : null;
    }
    return null;
  }
  pickWaypoint(b, goal, r = 0) {
    const knee = new V3(b.pos.x, b.pos.y + 0.6, b.pos.z), chest = new V3(b.pos.x, b.pos.y + 1.4, b.pos.z);
    if (goal && r > 0 && Math.hypot(goal.x - b.pos.x, goal.z - b.pos.z) < r - 0.8) {
      // Inside the zone: shuffle around in it rather than standing still.
      for (let i = 0; i < 10; i++) {
        const a = Math.random() * Math.PI * 2, rr = Math.random() * (r - 1);
        const p = new V3(goal.x + Math.cos(a) * rr, 0, goal.z + Math.sin(a) * rr);
        if (clearArea(p.x, p.z, 0.5) && segmentClear(knee, new V3(p.x, 0.6, p.z))) return p;
      }
      return b.pos.clone();
    }
    if (goal && segmentClear(knee, new V3(goal.x, goal.y + 0.6, goal.z))) return goal.clone();
    let best = null, bd = Infinity;
    for (let i = 0; i < 30; i++) {
      let p = navPts[Math.floor(Math.random() * navPts.length)];
      if (this.mode === 'dday') {
        const base = goal ? Math.atan2(goal.z - b.pos.z, goal.x - b.pos.x) : Math.random() * Math.PI * 2;
        const a = base + (goal ? rand(-1.2, 1.2) : 0), rr = rand(6, 24);
        p = new V3(b.pos.x + Math.cos(a) * rr, 0, b.pos.z + Math.sin(a) * rr);
        if (Math.abs(p.x) > mapHalf - 2 || Math.abs(p.z) > mapHalf - 2 || !clearArea(p.x, p.z, 0.6)) continue;
      }
      const dist = p.distanceTo(b.pos);
      if (dist < 4 || dist > 32) continue;
      if (!segmentClear(knee, new V3(p.x, 0.6, p.z)) || !segmentClear(chest, new V3(p.x, 1.4, p.z))) continue;
      if (!goal) return p.clone();
      // Toward a goal: the visible point that gets closest to it.
      const score = p.distanceTo(goal) + dist * 0.15;
      if (score < bd) { bd = score; best = p; }
    }
    return (best || navPts[Math.floor(Math.random() * navPts.length)]).clone();
  }
  tick(dt, paused) {
    if (this.state !== 'playing') return;
    if (paused) {
      // Offline matches freeze while the pause menu is open.
      const ms = dt * 1000;
      this.startAt += ms; this.endAt += ms; this.hpUntil += ms;
      for (const b of this.bots) b.diedAt += ms;
      if (match) { match.startAt = this.startAt; match.endAt = this.endAt; if (match.obj?.hp) match.obj.hp[1] = this.hpUntil; }
      if (this.nukeAt) { this.nukeAt += ms; if (nukeState) nukeState.at = this.nukeAt; }
      this.pushStates();
      return;
    }
    const now = serverNow();
    this.me.form = P.form || 0;
    if (now >= this.endAt || (this.nukeAt && now >= this.nukeAt)) { this.end(); return; }
    if (now >= this.startAt) {
      if (isDom(this.mode) || this.mode === 'hp') {
        this.objT += dt;
        while (this.objT >= 0.25 && this.state === 'playing') { this.objT -= 0.25; this.objStep(now); }
        if (this.state !== 'playing') return;
      }
      for (const p of this.all) {
        if (p.alive && p.hp < 100 && now - p.lastHit > 4000) {
          p.hp = Math.min(100, p.hp + 48 * dt);
          if (p.isMe && P.alive) P.hp = Math.round(p.hp);
        }
      }
      for (const b of this.bots) {
        if (!b.alive) {
          if (now - b.diedAt >= 3000) { b.alive = true; b.hp = 100; this.spawnBot(b, this.farSpawn(b)); this.send({ t: 'spawned', id: b.id, team: b.team }); }
          continue;
        }
        this.updateBot(b, dt, now);
      }
    }
    this.pushStates();
  }
  pushStates() {
    const t = performance.now(), r2 = (v) => Math.round(v * 100) / 100;
    const every = this.mode === 'dday' ? 66 : 50;
    for (const b of this.bots) {
      if (!b.alive || t - b.sentAt < every) continue;
      b.sentAt = t;
      this.send({ t: 'state', id: b.id, p: [r2(b.pos.x), r2(b.pos.y), r2(b.pos.z)], y: b.yaw, x: b.pitch, c: 0, s: Math.hypot(b.vel.x, b.vel.z), w: b.wid, r: b.form || 0, z: b.roll || 0 });
    }
  }
  updateBot(b, dt, now) {
    if (b.flight) { this.updateBotPlane(b, dt, now); return; }
    if (b.jump) { this.updateBotJump(b, now); return; }
    if (b.ride) { this.updateBotRide(b, dt); return; }
    const ai = b.ai, d = this.diff, w = b.w;
    const eye = new V3(b.pos.x, b.pos.y + 1.55, b.pos.z);

    // --- Perception: nearest enemy it can see (in view, heard firing, or shot it) ---
    ai.thinkT -= dt;
    if (ai.thinkT <= 0) {
      const big = this.mode === 'dday';
      ai.thinkT = (big ? 0.3 : 0.15) + Math.random() * 0.05;
      const fx = -Math.sin(b.yaw), fz = -Math.cos(b.yaw);
      // Closest first (soldiers before planes), and only a few sight-line checks per look.
      const cands = [];
      for (const t of this.targets(b)) {
        const plane = t.ent.form === FORM.plane;
        const dx = t.pos.x - eye.x, dy = t.pos.y + 1.2 - eye.y, dz = t.pos.z - eye.z, d2 = dx * dx + dy * dy + dz * dz;
        if (d2 < (plane ? 130 * 130 : 75 * 75)) cands.push({ t, d2, plane });
      }
      cands.sort((a, c) => (a.plane - c.plane) || (a.d2 - c.d2));
      let best = null, bd = Infinity, checks = 0;
      for (const { t, d2 } of cands) {
        if (checks >= (big ? 4 : 12)) break;
        const tp = new V3(t.pos.x, t.pos.y + 1.2, t.pos.z), dist = Math.sqrt(d2);
        const inView = ((tp.x - eye.x) * fx + (tp.z - eye.z) * fz) / dist > -0.15;
        const heard = now - t.ent.lastShot < 1500 && dist < 40;
        const alerted = ai.alertId === t.id && now < ai.alertUntil;
        if (!(inView || heard || alerted)) continue;
        checks++;
        if (!segmentClear(eye, tp) || smokeBlocks(eye, tp)) continue;
        best = t; bd = dist;
        break;
      }
      if (best) {
        if (!ai.target || ai.target.id !== best.id || now - ai.lastSeen > 1200) ai.reactAt = now + d.react * rand(0.7, 1.3) * (w.melee ? 0.5 : 1);
        ai.target = best; ai.lastSeen = now; ai.lastSeenPos.copy(best.pos); ai.visible = true;
        if (b.nades > 0 && now >= ai.nadeReady && now >= ai.reactAt && bd > 7 && bd < 24 && Math.random() < 0.06) this.botThrow(b, best, now);
      } else {
        ai.visible = false;
        if (ai.target && now - ai.lastSeen > 2500) ai.target = null;
      }
    }
    if (ai.target && !ai.target.ent.alive) { ai.target = null; ai.visible = false; ai.wp = null; }
    const T = ai.target;

    // --- Movement: strafe and hold range in a fight, otherwise play the objective / roam ---
    let wx = 0, wz = 0, sprint = false;
    if (T && ai.visible && w.melee) {
      // Zombies run straight at whoever they can see.
      const dx = T.pos.x - b.pos.x, dz = T.pos.z - b.pos.z, dist = Math.hypot(dx, dz) || 1;
      if (dist > 1.2) { wx = dx / dist; wz = dz / dist; }
      sprint = true; ai.wp = null;
    } else if (T && ai.visible) {
      const dx = T.pos.x - b.pos.x, dz = T.pos.z - b.pos.z, dist = Math.hypot(dx, dz) || 1, fx = dx / dist, fz = dz / dist;
      ai.strafeT -= dt;
      if (ai.strafeT <= 0) {
        ai.strafeT = rand(0.4, 1.4);
        ai.strafe = w.scope && Math.random() < 0.5 ? 0 : [-1, 0, 1][Math.floor(Math.random() * 3)];
        if (Math.random() < 0.12 && b.grounded && !w.scope && b.form !== FORM.chute) b.vel.y = 6.5;
      }
      const pref = BOT_RANGE[w.model] || 18;
      const adv = dist > pref * 1.3 ? 0.7 : dist < pref * 0.5 ? -0.6 : 0;
      wx = fx * adv - fz * ai.strafe;
      wz = fz * adv + fx * ai.strafe;
      ai.wp = null;
    } else {
      const obj = T ? null : this.objective(b);
      const goal = T ? ai.lastSeenPos : obj?.pos || null;
      ai.repath -= dt;
      if (!ai.wp || b.pos.distanceTo(ai.wp) < 1.5 || (obj?.chase && ai.repath <= 0)) { ai.wp = this.pickWaypoint(b, goal, obj?.r || 0); ai.repath = 1; }
      const dx = ai.wp.x - b.pos.x, dz = ai.wp.z - b.pos.z, dl = Math.hypot(dx, dz);
      if (dl > 0.3) { wx = dx / dl; wz = dz / dl; }
      const inZone = obj && obj.r > 0 && Math.hypot(obj.pos.x - b.pos.x, obj.pos.z - b.pos.z) < obj.r;
      sprint = !T && !inZone;
    }
    ai.stuckT += dt;
    if (ai.stuckT > 1.2) {
      if (b.pos.distanceTo(ai.lastPos) < 0.8 && (wx || wz) && !(T && ai.visible)) {
        ai.wp = this.pickWaypoint(b, null);
        if (b.grounded && b.form !== FORM.chute) b.vel.y = 7;
      }
      ai.stuckT = 0; ai.lastPos.copy(b.pos);
    }
    const wl = Math.hypot(wx, wz);
    if (wl > 1) { wx /= wl; wz /= wl; }
    let speed = 5.4 * w.move * (sprint ? 1.35 : 1) * (T && ai.visible && !w.melee ? 0.8 : 1) * (this.mode === 'inf' && b.team === 0 ? INF_SURVIVOR_SPEED : 1);
    if (b.form === FORM.chute) speed = CHUTE.steer;
    const accel = b.grounded ? 10 : b.form === FORM.chute ? 4 : 2;
    b.vel.x = damp(b.vel.x, wx * speed, accel, dt);
    b.vel.z = damp(b.vel.z, wz * speed, accel, dt);
    if (b.form === FORM.chute) b.vel.y = -CHUTE.fall + GRAVITY * dt;
    physicsStep(b, 1.8, dt);
    if (b.form === FORM.chute && b.grounded) b.form = FORM.ground;

    // --- Aim: turn toward the target at a difficulty-limited speed ---
    let wantYaw = b.yaw, wantPitch = 0;
    if (T) {
      const dx = T.pos.x - b.pos.x, dz = T.pos.z - b.pos.z, dy = T.pos.y + 1.2 - (b.pos.y + 1.55);
      wantYaw = Math.atan2(-dx, -dz); wantPitch = Math.atan2(dy, Math.hypot(dx, dz));
    } else if (Math.hypot(b.vel.x, b.vel.z) > 0.5) wantYaw = Math.atan2(-b.vel.x, -b.vel.z);
    const dyaw = Math.atan2(Math.sin(wantYaw - b.yaw), Math.cos(wantYaw - b.yaw));
    const maxTurn = (T ? d.turn * (w.melee ? 1.6 : 1) : 6) * dt;
    b.yaw += clamp(dyaw, -maxTurn, maxTurn);
    b.pitch = damp(b.pitch, wantPitch, 8, dt);

    // --- Attack ---
    if (w.melee) {
      if (T && ai.visible && now >= ai.reactAt && now >= ai.nextFire && Math.hypot(T.pos.x - b.pos.x, T.pos.z - b.pos.z) < 1.9 && Math.abs(T.pos.y - b.pos.y) < 1.5) this.botStab(b, T, now);
    } else if (T && ai.visible && now >= ai.reactAt && Math.abs(dyaw) < 0.12 && now >= ai.nextFire && now >= ai.reloadUntil) {
      if (b.mag <= 0) { ai.reloadUntil = now + w.reload * 1000; b.mag = w.mag; }
      else this.botFire(b, T, now);
    }
  }
  botStab(b, T, now) {
    b.ai.nextFire = now + 650;
    b.lastShot = now;
    const e = [T.pos.x, T.pos.y + 1.2, T.pos.z];
    this.send({ t: 'shot', id: b.id, f: [b.pos.x, b.pos.y + 1.4, b.pos.z], e, w: 'knife' });
    if (Math.random() < 0.55 + this.diff.acc * 0.8) this.applyHit(b, T.ent, WEAPONS.knife.dmg, false, 'knife');
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
    const atPlane = T.ent.form === FORM.plane;
    let chance = d.acc * falloff * (moving ? 0.75 : 1) * (crouch ? 0.85 : 1) * (w.scope ? 0.7 : 1) * (atPlane ? 0.7 : 1);
    if (isMe && P.slideT > 0) chance *= 0.6;
    const hit = Math.random() < chance, head = hit && Math.random() < d.head;
    const end = tp.clone();
    if (!hit) end.add(new V3(rand(-1, 1), rand(-0.6, 0.9), rand(-1, 1))).sub(eye).multiplyScalar(1.6).add(eye);
    const fx = -Math.sin(b.yaw), fz = -Math.cos(b.yaw);
    const muzzle = [b.pos.x + fx * 0.95 + Math.cos(b.yaw) * 0.1, b.pos.y + 1.45, b.pos.z + fz * 0.95 - Math.sin(b.yaw) * 0.1];
    this.send({ t: 'shot', id: b.id, f: muzzle, e: [end.x, end.y, end.z], w: b.wid });
    if (hit) this.applyHit(b, T.ent, w.dmg * (head && !atPlane ? w.head : 1) * (dist > w.range ? 0.72 : 1) * (atPlane ? PLANE.hitMul : 1), head && !atPlane, b.wid);
  }
}

const DDAY_NAMES = ['Miller', 'Baker', 'Carter', 'Hayes', 'Ward', 'Brooks', 'Reed', 'Price', 'Kelly', 'Foster',
  'Wagner', 'Becker', 'Hoffmann', 'Krause', 'Vogel', 'Lang', 'Brandt', 'Keller', 'Roth', 'Frank'];

// Online D-Day: the host's game runs every bot with the same brain as offline play, and
// reports what they do. The server settles hits, deaths and respawns as it does for people.
let botDirector = null;
class HostBots extends LocalMatch {
  constructor() {
    super({ map: currentMap, mode: 'dday', bots: 0, diff: 'normal', name: '', loadout: 'assault', char: 'bulwark', roster: false });
    this.state = 'playing';
    this.me = { id: myId, isMe: true, team: myTeam(), alive: P.alive, lastShot: -1e9, form: 0, vel: P.vel };
    this.humans = new Map();
    this.netAt = 0;
    this.shots = [];
    this.bots = room.players.filter((p) => p.bot).map((p) => this.adopt(p));
    this.all = [this.me, ...this.bots];
  }
  // Take over a bot from the roster, picking it up where it is if it is already in play.
  adopt(info) {
    const b = this.makeDdayBot(info.id, info.team, info.role, info.name, info.loadout);
    b.alive = info.alive;
    b.diedAt = serverNow();
    if (!b.alive) return b;
    const rp = remotes.get(info.id);
    this.spawnDdayBot(b);
    if (rp?.has) {
      b.pos.copy(rp.group.position); b.yaw = rp.yaw; b.form = rp.form ?? b.form;
      if (b.form !== FORM.plane) b.flight = null;
      if (b.form !== FORM.boat) b.ride = null; else b.ride = { x: b.pos.x, z: b.pos.z };
      if (b.form === FORM.plane && !b.flight) b.flight = { speed: PLANE.speed, cruise: PLANE.speed, nextGun: 0, nextBomb: 0, tgt: null, tgtT: 0, salvoAt: 0 };
      if (b.form !== FORM.ride) b.jump = null; else if (!b.jump) b.form = FORM.chute;
    }
    return b;
  }
  send(m) {
    if (m.t === 'state') { queueMicrotask(() => onMsg(m)); return; }
    if (m.t === 'shot') {
      // Bot gunfire rides along with the next position update instead of a message per shot.
      queueMicrotask(() => onMsg(m));
      const r1 = (v) => Math.round(v * 10) / 10;
      this.shots.push([m.id, ...m.f.map(r1), ...m.e.map(r1), m.w]);
    }
    // Kills, flags and the end of the match come from the server.
  }
  applyHit(att, t, dmg, head, w) {
    if (!att.isBot || !att.alive || !t.alive || att.team === t.team) return;
    if (t.ai) { t.ai.alertId = att.id; t.ai.alertUntil = serverNow() + 3000; }
    net.send({ t: 'bhit', id: att.id, target: t.id, dmg: Math.round(clamp(dmg, 0, 250)), head: !!head, w });
  }
  killSelf(t) {
    if (!t.isBot || !t.alive) return;
    t.alive = false; t.diedAt = serverNow();
    net.send({ t: 'bcrash', id: t.id });
  }
  throwOut(kind, b, origin, vel) {
    super.throwOut(kind, b, origin, vel);
    const r2 = (v) => Math.round(v * 100) / 100;
    net.send({ t: 'bthrow', id: b.id, k: kind, p: [r2(origin.x), r2(origin.y), r2(origin.z)], v: [r2(vel.x), r2(vel.y), r2(vel.z)] });
  }
  targets(self) {
    const list = [], foe = (team) => team !== self.team;
    if (P.alive && foe(myTeam()) && P.form !== FORM.ride) {
      Object.assign(this.me, { team: myTeam(), alive: true, form: P.form || 0 });
      list.push({ id: myId, ent: this.me, pos: P.pos });
    }
    for (const rp of remotes.values()) {
      if (!rp.alive || !rp.has || rp.form === FORM.ride || pInfo(rp.id)?.bot || !foe(teamOf(rp.id))) continue;
      let h = this.humans.get(rp.id);
      if (!h) { h = { id: rp.id, vel: new V3(), lastShot: -1e9 }; this.humans.set(rp.id, h); }
      Object.assign(h, { alive: true, team: teamOf(rp.id), form: rp.form || 0, lastShot: serverNow() - (performance.now() - rp.lastShot) });
      list.push({ id: rp.id, ent: h, pos: rp.group.position });
    }
    for (const b of this.bots) if (b !== self && b.alive && b.form !== FORM.ride && foe(b.team)) list.push({ id: b.id, ent: b, pos: b.pos });
    return list;
  }
  tick(dt) {
    if (!match || match.mode !== 'dday') return;
    const now = serverNow();
    this.me.form = P.form || 0;
    // Bots chase the flags the server says they don't hold.
    (match.obj?.f || []).forEach(([owner, cap, prog, contested], i) => { if (this.flags[i]) Object.assign(this.flags[i], { owner, cap, prog, contested }); });
    if (now >= match.startAt) {
      for (const b of this.bots) {
        if (!b.alive) {
          if (!b.asked && now - b.diedAt >= 3000) { b.asked = true; net.send({ t: 'brespawn', id: b.id }); }
          continue;
        }
        this.updateBot(b, dt, now);
      }
    }
    this.pushStates();
  }
  pushStates() {
    super.pushStates();
    const t = performance.now();
    if (t - this.netAt < 110) return;
    this.netAt = t;
    const r1 = (v) => Math.round(v * 10) / 10, r2 = (v) => Math.round(v * 100) / 100;
    const b = this.bots.filter((x) => x.alive).map((x) => [x.id, r1(x.pos.x), r1(x.pos.y), r1(x.pos.z), r2(x.yaw), r2(x.pitch), 0, r1(Math.hypot(x.vel.x, x.vel.z)), x.wid, x.form || 0, r2(x.roll || 0)]);
    if (b.length || this.shots.length) net.send({ t: 'bstate', b, s: this.shots });
    this.shots = [];
  }
  matchStart() { return match?.startAt ?? 0; }
  onKilled(id) { const b = this.bots.find((x) => x.id === id); if (b) { b.alive = false; b.diedAt = serverNow(); b.asked = false; } }
  onSpawned(id) { const b = this.bots.find((x) => x.id === id); if (b && !b.alive) { b.alive = true; b.hp = 100; this.spawnDdayBot(b); } }
  onRole(id, role) { const b = this.bots.find((x) => x.id === id); if (b) b.role = role; }
  onDamage(m) { const b = this.bots.find((x) => x.id === m.target); if (b?.ai) { b.ai.alertId = m.from; b.ai.alertUntil = serverNow() + 3000; } }
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
  offline = null; botDirector = null;
  clearDday();
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
function charCards(container, selected) {
  container.innerHTML = '';
  for (const [key, ch] of Object.entries(CHARACTERS)) {
    const el = document.createElement('button');
    el.className = 'card char' + (key === selected ? ' sel' : '');
    el.innerHTML = `<img alt="" src="${operatorPreview(key)}"><div class="ct">${ch.name}</div><div class="cd">${ch.desc}</div>`;
    el.onclick = () => pickChar(key);
    container.appendChild(el);
  }
}
function pickChar(key) {
  if (!CHARACTERS[key]) return;
  settings.char = key; saveSettings();
  net.send({ t: 'setChar', char: key });
  if (P.alive) dressViewmodel();
  refreshLoadoutViews();
}
function pickLoadout(key) {
  if (!LOADOUTS[key]) return;
  settings.loadout = key; saveSettings();
  if (match && P.alive) P.pendingLoadout = key; else { P.loadout = key; P.pendingLoadout = null; }
  net.send({ t: 'setLoadout', loadout: key });
  refreshLoadoutViews();
}
const ROLE_DESC = { random: 'Let the game pick', inf: 'Allies land by boat, Axis hold the trenches', para: 'Ride a troop plane in and jump', jet: 'Fly a fighter: guns and bombs' };
function roleCards(container, selected, onPick, keysHint) {
  container.innerHTML = '';
  (isDday() ? ['inf', 'para', 'jet'] : ['random', 'inf', 'para', 'jet']).forEach((key, i) => {
    const el = document.createElement('button');
    el.className = 'card' + (key === selected ? ' sel' : '');
    el.innerHTML = `<div class="ct">${keysHint ? `<kbd>${7 + i}</kbd>` : ''}${key === 'random' ? 'RANDOM' : ROLE_NAMES[key]}</div><div class="cd">${ROLE_DESC[key]}</div>`;
    el.onclick = () => onPick(key);
    container.appendChild(el);
  });
}
// Before a match this is your preferred D-Day role; during one it asks to trade roles with a bot.
function pickRole(key) {
  if (key !== 'random' && !ROLE_NAMES[key]) return;
  settings.ddayRole = key; saveSettings();
  if (isDday()) { if (key !== 'random' && key !== roleOf(myId)) net.send({ t: 'setRole', role: key }); }
  else if (room && !offline) net.send({ t: 'setRole', role: key });
  refreshRoleViews();
}
function refreshRoleViews() {
  const inMatch = isDday(), lobby = ui === 'lobby' && room?.mode === 'dday', off = ui === 'offline' && settings.offMode === 'dday';
  $('roleWrap').classList.toggle('hidden', !lobby);
  $('offRoleWrap').classList.toggle('hidden', !off);
  $('deathRoleWrap').classList.toggle('hidden', !inMatch);
  $('pauseRoleWrap').classList.toggle('hidden', !inMatch);
  if (lobby) roleCards($('roles'), settings.ddayRole, pickRole);
  if (off) roleCards($('offRoles'), settings.ddayRole, pickRole);
  if (inMatch) { roleCards($('deathRoles'), roleOf(myId), pickRole, true); roleCards($('pauseRoles'), roleOf(myId), pickRole); }
}
function refreshLoadoutViews() {
  const sel = P.pendingLoadout || P.loadout;
  if (ui === 'lobby') { loadoutCards($('loadouts'), sel, pickLoadout); charCards($('chars'), settings.char); }
  if (ui === 'offline') { loadoutCards($('offLoadouts'), sel, pickLoadout); charCards($('offChars'), settings.char); }
  if (ui === 'hud') charCards($('pauseChars'), settings.char);
  loadoutCards($('deathLoadouts'), sel, pickLoadout, true);
  loadoutCards($('pauseLoadouts'), sel, pickLoadout);
  $('pauseLoNote').textContent = P.pendingLoadout && P.alive ? `${LOADOUTS[P.pendingLoadout].name} equips on your next spawn.` : '';
  refreshRoleViews();
}

function renderLobby(prev) {
  if (!room) return;
  const isHost = room.hostId === myId;
  $('codeText').textContent = room.code;
  const people = room.players.filter((p) => !p.bot);
  $('pcount').textContent = `${people.length}/12`;
  $('plist').innerHTML = people.map((p) =>
    `<li class="${p.id === myId ? 'me' : ''}"><span class="pn">${p.id === room.hostId ? '<i class="crown">★</i>' : ''}${escapeHtml(p.name)}${p.id === myId ? ' <em>(you)</em>' : ''}</span><span class="pl">${LOADOUTS[p.loadout]?.name || ''}</span></li>`).join('');
  const maps = $('maps');
  maps.innerHTML = '';
  for (const [key, mp] of Object.entries(MAPS)) {
    if (!!mp.dday !== (room.mode === 'dday')) continue;
    const el = document.createElement('button');
    el.className = 'card map' + (room.map === key ? ' sel' : '') + (isHost ? '' : ' locked');
    el.innerHTML = `<div class="ct">${mp.name}</div><div class="cd">${mp.desc}</div>`;
    el.onclick = () => { if (isHost) net.send({ t: 'setMap', map: key }); };
    maps.appendChild(el);
  }
  $('mapHint').textContent = isHost ? '(you pick)' : '(host picks)';
  modeCards($('modes'), room.mode || 'ffa', isHost, (key) => net.send({ t: 'setMode', mode: key }));
  $('modeHint').textContent = isHost ? '(you pick)' : '(host picks)';
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
  mapReady = false; pendingGo = null; match = null; P.alive = false; botDirector = null;
  clearDday();
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
  track('match_start', { game_type: offline ? 'bots' : 'online', mode: m.mode || 'ffa', map: currentMap, players: m.players.length });
  match = { mode: m.mode || 'ffa', startAt: m.startAt, endAt: m.endAt, scoreLimit: m.scoreLimit, obj: m.obj || { s: [0, 0] } };
  nukeState = m.nukeAt ? { by: m.nukeBy, at: m.nukeAt, lastBeep: -1, boomed: false } : null;
  $('nukeflash').classList.remove('boom');
  if (room) room.players = m.players;
  for (const p of m.players) {
    const rp = ensureRemote(p);
    if (rp) setRemoteAlive(rp, p.alive);
  }
  refreshLooks();
  buildObjectives();
  clearDday();
  // Online D-Day: the host's game runs the bots.
  botDirector = !offline && match.mode === 'dday' && room?.hostId === myId ? new HostBots() : null;
  $('killfeed').innerHTML = '';
  showScreen('hud');
  $('pause').classList.remove('hidden');
  $('pauseTitle').textContent = 'CLICK TO DEPLOY';
  const me = m.players.find((p) => p.id === myId);
  if (me && me.alive) {
    const late = serverNow() > m.startAt;
    spawnMe(late ? bestSpawn() : startSpawn(m.players));
  }
  refreshLoadoutViews();
  const mode = MODES[match.mode];
  if (match.mode === 'inf') {
    const z = m.players.find((p) => p.team === 1);
    if (z && z.id === myId) { notify('YOU ARE THE INFECTED', 'KNIFE THEM ALL'); }
    else if (z) notify(`${z.name} IS INFECTED — SURVIVE`, 'INFECTED');
  } else if (match.mode === 'dday' && me) {
    const role = me.role || 'inf';
    notify(`${teamName(me.team)} — ${ROLE_NAMES[role]}`, 'D-DAY');
    addFeedText(role === 'jet' ? 'Mouse steers • W/S throttle • Click: guns • Right-click/F/Space: bomb'
      : role === 'para' ? 'Red light: READY. Green light: SPACE to jump. Steer the chute with WASD'
      : me.team === 0 ? 'Ride the landing craft in, then storm the beach' : 'Hold the line against the landing');
  } else if (mode.teams && me) notify(`${mode.name} — YOU ARE ${teamName(me.team)}`, mode.name);
}
// Opening positions: teams start on opposite sides of the map, everyone else spread out.
function startSpawn(players) {
  const teams = MODES[match.mode].teams && match.mode !== 'inf';
  const mine = players.filter((p) => !teams || p.team === myTeam()).sort((a, b) => a.id - b.id);
  const idx = Math.max(0, mine.findIndex((p) => p.id === myId));
  if (!teams) return spawns[idx % spawns.length];
  const side = [...spawns].sort((a, b) => (myTeam() === 0 ? a.x - b.x : b.x - a.x));
  return side[idx % Math.min(side.length, 8)];
}

// Respawn wait after any death ad, long enough to pick a loadout. SPACE deploys early.
const RESPAWN_DELAY = 6000, MIN_RESPAWN = 3000;
let adPlaying = false;

// Google's game ad on the death screen. Calls done() when the ad is over, or right
// away if ads are off, blocked, or Google decides not to show one this time.
function showDeathAd(done) {
  if (typeof window.adBreak !== 'function') { done(); return; }
  let finished = false, started = false;
  const finish = () => {
    if (finished) return;
    finished = true;
    adPlaying = false;
    if (master) master.gain.value = settings.vol;
    done();
  };
  try {
    window.adBreak({
      type: 'next',
      name: 'death',
      beforeAd: () => { started = true; adPlaying = true; if (master) master.gain.value = 0; },
      afterAd: () => { if (master) master.gain.value = settings.vol; },
      adBreakDone: finish,
    });
  } catch { finish(); return; }
  setTimeout(() => { if (!started) finish(); }, 1500);
  setTimeout(finish, 45000);
}
function deployNow() {
  if (P.alive || adPlaying || !match || performance.now() - P.deathAt < MIN_RESPAWN) return;
  clearTimeout(respawnTimer);
  P.respawnAt = Infinity;
  net.send({ t: 'respawn' });
}

function onMyDeath(killerId) {
  if (P.flight && !P.flight.crashed) bigBoom(P.pos, 1.3);
  if (myPlane) { scene.remove(myPlane); myPlane = null; }
  endRide(true);
  P.flight = null; P.chute = false; P.form = FORM.ground; P.jump = null; P.chuteAt = 0;
  $('flighthud').classList.add('hidden'); $('ammo').classList.remove('hidden'); $('jumplight').className = 'hidden';
  P.alive = false; P.deathAt = performance.now(); P.killerId = killerId;
  P.adsT = 0; P.reloadUntil = 0; mouseL = false; mouseR = false;
  showViewmodel();
  $('scope').classList.add('hidden');
  $('death').classList.remove('hidden');
  $('deathBy').textContent = killerId === myId ? 'You eliminated yourself' : `Eliminated by ${pName(killerId)}`;
  if (amZombie()) $('deathBy').textContent += '  —  you are now INFECTED';
  refreshLoadoutViews();
  clearTimeout(respawnTimer);
  P.respawnAt = Infinity;
  const deathAt = P.deathAt;
  showDeathAd(() => {
    if (P.alive || P.deathAt !== deathAt || !match) return;
    P.respawnAt = performance.now() + RESPAWN_DELAY;
    respawnTimer = setTimeout(() => net.send({ t: 'respawn' }), RESPAWN_DELAY);
  });
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

function showEnd(players, nukeBy, m = {}) {
  track('match_end', { game_type: offline ? 'bots' : 'online', mode: match?.mode || 'ffa', map: currentMap, won: players[0]?.id === myId, nuked: nukeBy != null });
  clearTimeout(respawnTimer);
  match = null; P.alive = false; mapReady = false; nukeState = null; botDirector = null;
  clearObjectives();
  clearDday();
  $('nuke').classList.add('hidden');
  $('nukeReady').classList.add('hidden');
  showViewmodel();
  for (const rp of remotes.values()) { rp.alive = false; rp.group.visible = false; }
  const winner = players[0], mode = m.mode || 'ffa', teams = MODES[mode]?.teams;
  const names = TEAM_NAMES[mode] || [], me = players.find((p) => p.id === myId), won = teams && me && me.team === m.winTeam;
  if (nukeBy != null) {
    $('endTitle').textContent = nukeBy === myId ? 'NUKED THEM ALL' : teams && won ? 'VICTORY — NUKED' : 'NUKED';
    $('endWinner').textContent = `${players.find((p) => p.id === nukeBy)?.name ?? pName(nukeBy)} ended the match with a TACTICAL NUKE`;
  } else if (mode === 'inf') {
    $('endTitle').textContent = won ? 'VICTORY' : 'DEFEAT';
    $('endWinner').textContent = m.winTeam === 0 ? `SURVIVORS WIN — ${players.filter((p) => p.team === 0).map((p) => p.name).join(', ')} made it out` : 'INFECTED WIN — nobody survived';
  } else if (teams) {
    const sc = m.scores || [0, 0];
    $('endTitle').textContent = m.winTeam < 0 ? 'DRAW' : won ? 'VICTORY' : 'DEFEAT';
    $('endWinner').textContent = m.winTeam < 0 ? `${names[0]} ${sc[0]} — ${sc[1]} ${names[1]}` : `${names[m.winTeam]} win ${sc[m.winTeam]} — ${sc[1 - m.winTeam]}`;
  } else {
    $('endTitle').textContent = winner?.id === myId ? 'VICTORY' : 'MATCH OVER';
    $('endWinner').textContent = winner ? `${winner.name} wins with ${winner.kills} kills` : '';
  }
  let ordered = teams ? [...players].sort((a, b) => (a.team === m.winTeam ? -1 : 0) - (b.team === m.winTeam ? -1 : 0) || a.team - b.team || b.kills - a.kills) : players;
  if (mode === 'dday') ordered = [...players].sort((a, b) => b.kills - a.kills).filter((p, i) => i < 20 || p.id === myId);
  $('endTable').innerHTML = `<tr><th>#</th><th>PLAYER</th>${teams ? '<th>TEAM</th>' : ''}<th>K</th><th>D</th><th>K/D</th></tr>` + ordered.map((p, i) =>
    `<tr class="${p.id === myId ? 'me' : ''}"><td>${i + 1}</td><td>${escapeHtml(p.name)}</td>${teams ? `<td style="color:${mode === 'inf' && p.team === 1 ? ZOMBIE_GREEN : TEAM_COLORS[p.team] || '#ccc'}">${names[p.team] || ''}</td>` : ''}<td>${p.kills}</td><td>${p.deaths}</td><td>${(p.kills / Math.max(1, p.deaths)).toFixed(2)}</td></tr>`).join('');
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
  const cls = (id) => (id === myId ? 'me' : match && MODES[match.mode]?.teams && !isEnemy(id) ? 'ally' : '');
  el.innerHTML = `<b class="${cls(killer)}">${escapeHtml(pName(killer))}</b><span class="kw">${w === 'knife' ? '🔪' : WEAPONS[w]?.name || KILL_NAMES[w] || ''}${head ? ' ⌖' : ''}</span><b class="${cls(victim)}">${escapeHtml(pName(victim))}</b>`;
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
  const mode = match?.mode || 'ffa', teams = MODES[mode].teams;
  const row = (p) => `<tr class="${p.id === myId ? 'me' : ''}"><td>${escapeHtml(p.name)}</td><td>${mode === 'inf' && p.team === 1 ? 'ZOMBIE' : mode === 'dday' ? ROLE_NAMES[p.role] || '' : LOADOUTS[p.loadout]?.name || ''}</td><td>${p.kills}</td><td>${p.deaths}</td><td>${(p.kills / Math.max(1, p.deaths)).toFixed(2)}</td></tr>`;
  const sort = (arr) => arr.sort((a, b) => b.kills - a.kills || a.deaths - b.deaths);
  let html = '<tr><th>PLAYER</th><th>LOADOUT</th><th>K</th><th>D</th><th>K/D</th></tr>';
  if (!teams) html += sort([...room.players]).map(row).join('');
  else for (const t of [myTeam() === 1 ? 1 : 0, myTeam() === 1 ? 0 : 1]) {
    let list = sort(room.players.filter((p) => p.team === t));
    if (mode === 'dday') list = list.filter((p, i) => i < 10 || p.id === myId);
    const sc = mode === 'inf' ? `${list.length} PLAYERS` : String(match?.obj?.s?.[t] ?? 0);
    const color = mode === 'inf' && t === 1 ? ZOMBIE_GREEN : relColor(t);
    html += `<tr class="team"><td colspan="5" style="color:${color}">${teamName(t)} <span>${sc}</span></td></tr>` + list.map(row).join('');
  }
  $('sbTable').innerHTML = html;
  const goal = mode === 'inf' ? 'SURVIVE 5:00' : `FIRST TO ${match?.scoreLimit || 30}`;
  $('sbMap').textContent = `${MAPS[currentMap]?.name || ''} • ${MODES[mode].name}${offline ? ` VS BOTS (${offline.diff.label})` : ''} • ${goal}`;
}

// The strip under the score bar: flag states, the hill timer, or your infected role.
function renderObjBar(now) {
  let html = '';
  const inZone = (x, z, r) => P.alive && Math.hypot(P.pos.x - x, P.pos.z - z) < r && P.pos.y < 6;
  if (isDom(match.mode)) {
    const flags = match.obj?.f || [];
    html = MAPS[currentMap].zones.dom.map(([x, z], i) => {
      const [owner, cap, prog, contested] = flags[i] || [-1, -1, 0, false];
      const here = inZone(x, z, domR(match.mode));
      const bar = prog > 0 ? `<i style="width:${Math.round(prog * 100)}%;background:${relColor(cap)}"></i>` : '';
      return `<span class="flag${here ? ' here' : ''}${contested ? ' contested' : ''}" style="border-color:${relColor(owner)};color:${relColor(owner)}">${bar}<b>${'ABCDE'[i]}</b></span>`;
    }).join('');
    const here = MAPS[currentMap].zones.dom.findIndex(([x, z]) => inZone(x, z, domR(match.mode)));
    if (here >= 0) {
      const [owner, , , contested] = flags[here] || [];
      const msg = contested ? 'CONTESTED' : owner === myTeam() ? 'DEFENDING' : 'CAPTURING';
      html += `<div class="objmsg">${msg} ${'ABCDE'[here]}</div>`;
    }
  } else if (match.mode === 'hp') {
    const [idx, until, holder] = match.obj?.hp || [0, match.startAt + HP_ROTATE_MS, -1];
    const left = Math.max(0, until - serverNow()), [x, z] = hpZone();
    const status = holder === 2 ? 'CONTESTED' : holder < 0 ? 'NEUTRAL' : holder === myTeam() ? 'SECURED' : 'ENEMY HOLDS';
    html = `<span class="hp" style="border-color:${relColor(holder)};color:${relColor(holder)}">HP ${Math.floor(left / 60000)}:${String(Math.floor(left / 1000) % 60).padStart(2, '0')}</span><div class="objmsg">${inZone(x, z, HP_R) ? 'IN THE HARDPOINT — ' : ''}${status}</div>`;
  } else if (match.mode === 'inf') {
    const left = room.players.filter((p) => p.team === 0).length;
    html = amZombie() ? `<div class="objmsg zombie">INFECT THEM ALL — ${left} LEFT</div>` : `<div class="objmsg">SURVIVE UNTIL THE TIMER RUNS OUT</div>`;
  }
  if (hudCache.obj !== html) { hudCache.obj = html; $('obj').innerHTML = html; }
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
  if (match && objGroup) {
    const zones = isDom(match.mode) ? MAPS[currentMap].zones.dom : [hpZone()];
    zones.forEach(([x, z], i) => {
      const owner = isDom(match.mode) ? match.obj?.f?.[i]?.[0] ?? -1 : match.obj?.hp?.[2] ?? -1;
      g.strokeStyle = relColor(owner); g.lineWidth = 0.8;
      g.beginPath(); g.arc(x - P.pos.x, z - P.pos.z, isDom(match.mode) ? domR(match.mode) : HP_R, 0, Math.PI * 2); g.stroke();
    });
  }
  for (const rp of remotes.values()) {
    if (!rp.alive || !rp.has) continue;
    const ally = !isEnemy(rp.id);
    if (!ally && now - rp.lastShot > 2500) continue;
    g.fillStyle = ally ? TEAM_COLORS[0] : '#ff3b30';
    g.globalAlpha = ally ? 1 : 1 - (now - rp.lastShot) / 2500;
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
    if (MODES[match.mode].teams) {
      const t = Math.max(0, myTeam()), o = 1 - t;
      const val = (team) => (match.mode === 'inf' ? room.players.filter((p) => p.team === team).length : match.obj?.s?.[team] ?? 0);
      setText('scoreMeName', teamName(t)); setText('scoreMe', String(val(t)));
      setText('scoreTopName', teamName(o)); setText('scoreTop', String(val(o)));
    } else {
      setText('scoreMeName', 'YOU');
      setText('scoreMe', String(me?.kills ?? 0));
      setText('scoreTop', String(leader?.kills ?? 0));
      setText('scoreTopName', leader ? leader.name : '—');
    }
    renderObjBar(now);
    const cd = match.startAt - sNow, el = $('countdown');
    if (cd > 0) { el.classList.remove('hidden'); setText('countdown', String(Math.ceil(cd / 1000))); }
    else if (cd > -900) { el.classList.remove('hidden'); setText('countdown', 'GO!'); }
    else el.classList.add('hidden');
    const ready = !nukeState && match.mode !== 'inf' && (me?.kills ?? 0) >= NUKE_KILLS;
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
    setText('mag', d.melee ? '∞' : String(w.mag));
    setText('reserve', d.melee ? '' : String(w.reserve));
    setText('wname', d.name);
    $('mag').classList.toggle('low', !d.melee && w.mag <= Math.ceil(d.mag * 0.25));
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
    const left = Math.max(0, ((P.respawnAt ?? 0) - now) / 1000);
    const early = now - P.deathAt >= MIN_RESPAWN ? '  •  SPACE to deploy now' : '';
    setText('respawnIn', adPlaying ? 'Ad playing…' : P.respawnAt === Infinity ? 'Get ready…' : left > 0 ? `Respawning in ${left.toFixed(1)}${early}` : 'Respawning…');
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
  const ri = ['Digit7', 'Digit8', 'Digit9'].indexOf(e.code);
  if (ri >= 0 && isDday()) pickRole(['inf', 'para', 'jet'][ri]);
  if (!P.alive) {
    const idx = ['Digit1', 'Digit2', 'Digit3', 'Digit4'].indexOf(e.code);
    if (idx >= 0) pickLoadout(Object.keys(LOADOUTS)[idx]);
    if (e.code === 'KeyN') callNuke();
    if (e.code === 'Space') { e.preventDefault(); deployNow(); }
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
$('btnCreate').onclick = () => withServer(() => { track('private_match_create'); net.send({ t: 'create', name: playerName(), loadout: P.loadout, char: settings.char, role: settings.ddayRole }); });
$('btnJoin').onclick = () => {
  const code = $('joinCode').value.trim().toUpperCase();
  if (code.length < 4) { $('menuErr').textContent = 'Enter the 6-character match code.'; return; }
  withServer(() => { track('private_match_join'); net.send({ t: 'join', code, name: playerName(), loadout: P.loadout, char: settings.char, role: settings.ddayRole }); });
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

function modeCards(container, selected, canPick, onPick) {
  container.innerHTML = '';
  for (const [key, md] of Object.entries(MODES)) {
    const el = document.createElement('button');
    el.className = 'card mode' + (selected === key ? ' sel' : '') + (canPick ? '' : ' locked');
    el.innerHTML = `<div class="ct">${md.name}</div><div class="cd">${md.desc}</div>`;
    el.onclick = () => { if (canPick) onPick(key); };
    container.appendChild(el);
  }
}

// Offline bot match setup
function showOfflineSetup() { showScreen('offline'); renderOffline(); }
function renderOffline() {
  const maps = $('offMaps');
  maps.innerHTML = '';
  const dday = settings.offMode === 'dday';
  if (dday) settings.offMap = 'normandy';
  else if (MAPS[settings.offMap]?.dday || !MAPS[settings.offMap]) settings.offMap = 'harbor';
  for (const [key, mp] of Object.entries(MAPS)) {
    if (!!mp.dday !== dday) continue;
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
  modeCards($('offModes'), settings.offMode, true, (key) => { settings.offMode = key; saveSettings(); renderOffline(); });
  if (dday) $('offBots').innerHTML = '<span class="muted">50 vs 50 — bots fill every slot</span>';
  else seg($('offBots'), [1, 3, 5, 7, 9].map((n) => [n, String(n)]), settings.offBots, (v) => (settings.offBots = v));
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
  const mode = MODES[settings.offMode] ? settings.offMode : 'ffa';
  offline = new LocalMatch({ map: mode === 'dday' ? 'normandy' : settings.offMap, mode, bots: mode === 'dday' ? 0 : settings.offBots, role: settings.ddayRole, diff: settings.offDiff, name: playerName(), loadout: P.loadout, char: settings.char });
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
    if (P.alive && curW() && P.flight) {
      updateFlight(dt, now, canMove);
      updateFlightCamera(dt);
      sendState(false);
    } else if (P.alive && curW()) {
      if (P.jump) updateJump(canMove); else if (P.ride) updateRide(dt, now); else updateMovement(dt, now, canMove);
      updateWeapon(dt, now, canMove && !P.ride && !P.jump);
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
  if (offline) offline.tick(dt, (ui === 'hud' && !pointerLocked) || adPlaying);
  if (botDirector) botDirector.tick(dt);
  updateDday(dt, now);
  updateTransports();
  updateRemotes(dt, now);
  updateObjectives(now);
  updateGrenades(dt);
  updateParticles(dt);
  updateTracers(dt);
  sky.position.copy(camera.position);
  if (shadowFollow) {
    // Centred a little ahead of the view, snapped to a coarse grid so shadows don't crawl as you move.
    const look = camera.getWorldDirection(_sunLook).setY(0).normalize().multiplyScalar(60).add(camera.position);
    const sx = Math.round(look.x / 8) * 8, sz = Math.round(look.z / 8) * 8;
    sun.target.position.set(sx, 0, sz);
    sun.position.set(sx + sunOffset.x, sunOffset.y, sz + sunOffset.z);
  } else sun.target.position.set(0, 0, 0);
  renderer.clear();
  renderer.render(scene, camera);
  if (ui === 'hud' && P.alive && vmRoot.visible) {
    renderer.clearDepth();
    renderer.render(vmScene, vmCamera);
  }
}
loadMap('harbor');
requestAnimationFrame(frame);
