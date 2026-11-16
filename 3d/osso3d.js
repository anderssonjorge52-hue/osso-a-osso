// Osso a Osso · visualizador 3D do esqueleto (v2, alta qualidade).
// Modelo: BodyParts3D © DBCLS (CC BY-SA) — ver 3d/LICENCA-MODELOS.txt. Biblioteca: three.js (MIT).
import * as THREE from 'three';
import { GLTFLoader } from './jsm/loaders/GLTFLoader.js';
import { OrbitControls } from './jsm/controls/OrbitControls.js';
import { MeshoptDecoder } from './jsm/libs/meshopt_decoder.module.js';
import { RoomEnvironment } from './jsm/environments/RoomEnvironment.js';
import { MAPA } from './mapa3d.js';

const norm = s => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();
const STRUCT = {}; for (const k of Object.keys(MAPA.struct)) STRUCT[norm(k)] = MAPA.struct[k];
const BASE = {}; // nome da peça sem o lado -> ids
for (const [id, nome] of Object.entries(MAPA.parts)) {
  const b = norm(nome).replace(/\s+(direit[oa]|esquerd[oa])$/, '').replace(/^\d+[ªº]\s+/, m => m);
  (BASE[b] = BASE[b] || []).push(id);
}
const ladoDe = id => /direit[oa]$/.test(norm(MAPA.parts[id])) ? 'd' : /esquerd[oa]$/.test(norm(MAPA.parts[id])) ? 'e' : '';
const ALIAS = {
  'falanges proximais': ['falange proximal'], 'falanges medias': ['falange media'], 'falanges distais': ['falange distal'],
  'metacarpos': ['metacarpo'], 'metatarsos': ['metatarso'], 'hioide': ['osso hioide'], 'frontal': ['osso frontal'],
  'trapezio': ['trapezio (osso do carpo)'], 'esterno': ['esterno'], 'quadril': ['pelve'], 'osso do quadril': ['osso do quadril'],
  'cartilagens costais': ['cartilagem costal', '1ª cartilagem costal', '2ª cartilagem costal', '3ª cartilagem costal', '4ª cartilagem costal', '5ª cartilagem costal', '6ª cartilagem costal', '7ª cartilagem costal'], 'manubrio': ['manubrio do esterno'],
  'primeiro metacarpo': ['1º metacarpo'], 'segundo metacarpo': ['2º metacarpo'], 'terceiro metacarpo': ['3º metacarpo'], 'quarto metacarpo': ['4º metacarpo'], 'quinto metacarpo': ['5º metacarpo'],
  'primeiro metatarso': ['1º metatarso'], 'segundo metatarso': ['2º metatarso'], 'terceiro metatarso': ['3º metatarso'], 'quarto metatarso': ['4º metatarso'], 'quinto metatarso': ['5º metatarso'],
  'sesamoides': ['sesamoide do pe'], 'coluna vertebral': ['cervical', 'toracica', 'lombar', 'sacro'],
  'costelas verdadeiras': ['1ª costela', '2ª costela', '3ª costela', '4ª costela', '5ª costela', '6ª costela', '7ª costela'],
  'costelas falsas': ['8ª costela', '9ª costela', '10ª costela'], 'costelas flutuantes': ['11ª costela', '12ª costela'],
};
const STRUCT_DE = {};
const PRIOR = ['atlas','áxis','C3','C4','C5','C6','C7','T1','T2','T3','T4','T5','T6','T7','T8','T9','T10','T11','T12','L1','L2','L3','L4','L5','sacro','disco intervertebral'];
for (const [k, ids] of Object.entries(MAPA.struct)) for (const id of ids) {
  if (['cervical','torácica','lombar'].includes(k)) continue;
  if (!STRUCT_DE[id] || PRIOR.includes(k)) STRUCT_DE[id] = k;
}

// ---- regiões: o que fica visível em cada módulo do jogo ----
const pega = re => Object.keys(MAPA.parts).filter(id => re.test(norm(MAPA.parts[id])));
const REGIOES = {
  esqueleto: null,
  coluna: [...new Set([...(STRUCT.cervical || []), ...(STRUCT.toracica || []), ...(STRUCT.lombar || []), ...(STRUCT.sacro || []), ...(STRUCT['disco intervertebral'] || [])])],
  cranio: [...new Set([...(STRUCT.cranio || []), ...(STRUCT.mandibula || [])])],
  mao: pega(/((carpo\)|escafoide|semilunar|piramidal|pisiforme|trapezoide|capitato|hamato|metacarpo|da mao) direit[oa])$/),
  pe: pega(/((talus|calcaneo|navicular|cuneiforme \w+|cuboide|metatarso|do pe) direit[oa])$/),
  torax: [...new Set([...(STRUCT.costelas || []), ...(STRUCT.esterno || []), ...(STRUCT.toracica || [])])],
};
const DIR_REG = { esqueleto: [0.25, 0.08, 1], coluna: [0.9, 0.1, 0.55], cranio: [0.45, 0.12, 1], mao: [1, 0.12, 0.3], pe: [0.6, 0.85, 0.75], torax: [0.3, 0.1, 1] };

function resolver(nome, visiveis) {
  const k = norm(nome || ''); if (!k) return [];
  let ids = [];
  const tenta = c => { if (STRUCT[c]) ids = ids.concat(STRUCT[c]); if (BASE[c]) ids = ids.concat(BASE[c]);
    if (!STRUCT[c] && !BASE[c]) for (const b of Object.keys(BASE)) if (b.startsWith(c + ' ') || b.endsWith(' ' + c)) ids = ids.concat(BASE[b]); };
  if (ALIAS[k]) ALIAS[k].forEach(tenta);
  if (!ids.length) tenta(k);
  ids = [...new Set(ids)];
  if (visiveis) ids = ids.filter(id => visiveis.has(id));
  return ids;
}
export function tem3D(nome, regiao) {
  const r = REGIOES[regiao]; return resolver(nome, r ? new Set(r) : null).length > 0;
}

// ---- relevo: escurece as reentrâncias de cada osso (dá o aspecto de peça esculpida) ----
function relevo(geo, ao, ini) {
  const pos = geo.getAttribute('position'), idx = geo.index; if (!idx) return;
  const n = pos.count, nor = geo.getAttribute('normal');
  const soma = new Float32Array(n * 3), cont = new Uint16Array(n), P = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) { P[i * 3] = pos.getX(i); P[i * 3 + 1] = pos.getY(i); P[i * 3 + 2] = pos.getZ(i); }
  let aresta = 0, na = 0;
  const liga = (a, b) => { soma[a * 3] += P[b * 3]; soma[a * 3 + 1] += P[b * 3 + 1]; soma[a * 3 + 2] += P[b * 3 + 2]; cont[a]++; };
  const ia = idx.array;
  for (let t = 0; t < ia.length; t += 3) {
    const a = ia[t], b = ia[t + 1], c = ia[t + 2];
    liga(a, b); liga(b, c); liga(c, a); liga(b, a); liga(c, b); liga(a, c);
    if (t % 30 === 0) { aresta += Math.hypot(P[a * 3] - P[b * 3], P[a * 3 + 1] - P[b * 3 + 1], P[a * 3 + 2] - P[b * 3 + 2]); na++; }
  }
  aresta = aresta / Math.max(1, na) || 1;
  let cav = new Float32Array(n);
  for (let i = 0; i < n; i++) { const c = cont[i] || 1;
    const lx = soma[i * 3] / c - P[i * 3], ly = soma[i * 3 + 1] / c - P[i * 3 + 1], lz = soma[i * 3 + 2] / c - P[i * 3 + 2];
    cav[i] = (lx * nor.getX(i) + ly * nor.getY(i) + lz * nor.getZ(i)) / aresta; }
  for (let passo = 0; passo < 2; passo++) { // suaviza
    const s = new Float32Array(n), q = new Uint16Array(n);
    for (let t = 0; t < ia.length; t += 3) { const a = ia[t], b = ia[t + 1], c = ia[t + 2];
      s[a] += cav[b] + cav[c]; s[b] += cav[a] + cav[c]; s[c] += cav[a] + cav[b]; q[a] += 2; q[b] += 2; q[c] += 2; }
    const o = new Float32Array(n); for (let i = 0; i < n; i++) o[i] = q[i] ? 0.5 * cav[i] + 0.5 * s[i] / q[i] : cav[i]; cav = o;
  }
  const cor = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) { const c = cav[i];
    let v = c > 0 ? 1 - Math.min(0.42, c * 2.2) : 1 + Math.min(0.06, -c * 0.5);
    if (ao) { const a = ao[ini + i] / 255; v *= 0.30 + 0.70 * Math.pow(a, 0.85); }
    cor[i * 3] = v; cor[i * 3 + 1] = v * (c > 0 ? 0.985 : 1); cor[i * 3 + 2] = v * (c > 0 ? 0.955 : 1); }
  geo.setAttribute('color', new THREE.BufferAttribute(cor, 3));
}

function fundo() {
  const c = document.createElement('canvas'); c.width = 64; c.height = 512; const g = c.getContext('2d');
  const gr = g.createLinearGradient(0, 0, 0, 512);
  gr.addColorStop(0, '#1b2a3c'); gr.addColorStop(0.5, '#111c29'); gr.addColorStop(1, '#070c12');
  g.fillStyle = gr; g.fillRect(0, 0, 64, 512);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}

export async function criar(container, { onPick, onReady } = {}) {
  const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
  const DPR = Math.min(window.devicePixelRatio || 1, 2);
  renderer.setPixelRatio(DPR);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.02;
  renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.domElement.style.cssText = 'display:block;width:100%;height:100%;touch-action:none;outline:none';
  const scene = new THREE.Scene(); scene.background = fundo();
  const pm = new THREE.PMREMGenerator(renderer); scene.environment = pm.fromScene(new RoomEnvironment(), 0.04).texture; pm.dispose();
  const camera = new THREE.PerspectiveCamera(30, 1, 0.01, 100);

  const key = new THREE.DirectionalLight(0xfff1dc, 1.55); key.castShadow = true; key.shadow.mapSize.set(2048, 2048); key.shadow.radius = 5; key.shadow.blurSamples = 12;
  scene.add(key, key.target);
  const rim = new THREE.DirectionalLight(0xffb066, 1.1); scene.add(rim, rim.target);
  const fill = new THREE.DirectionalLight(0x8fb4e6, 0.4); scene.add(fill, fill.target);

  const controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true; controls.dampingFactor = 0.1; controls.enablePan = false;
  controls.rotateSpeed = 0.85; controls.zoomSpeed = 0.9;

  const env = 0.5;
  const mats = {
    osso: new THREE.MeshPhysicalMaterial({ color: 0xece2cf, roughness: 0.58, metalness: 0, vertexColors: true, envMapIntensity: env, sheen: 0.35, sheenRoughness: 0.6, sheenColor: 0xfff0d8, clearcoat: 0.12, clearcoatRoughness: 0.55 }),
    apagado: new THREE.MeshPhysicalMaterial({ color: 0x8d94a0, roughness: 0.8, metalness: 0, vertexColors: true, envMapIntensity: env * 0.6 }),
    on: new THREE.MeshPhysicalMaterial({ color: 0xf6a34f, roughness: 0.42, vertexColors: true, envMapIntensity: env, emissive: 0xc2590c, emissiveIntensity: 0.34, clearcoat: 0.3, clearcoatRoughness: 0.4 }),
    win: new THREE.MeshPhysicalMaterial({ color: 0x7fd6b2, roughness: 0.42, vertexColors: true, envMapIntensity: env, emissive: 0x0f6d4c, emissiveIntensity: 0.34, clearcoat: 0.3, clearcoatRoughness: 0.4 }),
    pick: new THREE.MeshPhysicalMaterial({ color: 0xffd08f, roughness: 0.45, vertexColors: true, envMapIntensity: env, emissive: 0x8a5210, emissiveIntensity: 0.3 }),
  };
  const halo = { on: new THREE.MeshBasicMaterial({ color: 0xffa040, transparent: true, opacity: 0.2, depthTest: false, depthWrite: false }),
    win: new THREE.MeshBasicMaterial({ color: 0x6fe0b4, transparent: true, opacity: 0.2, depthTest: false, depthWrite: false }) };

  // ---- carrega o modelo ----
  const loader = new GLTFLoader(); loader.setMeshoptDecoder(MeshoptDecoder);
  const [gltf, AO] = await Promise.all([
    loader.loadAsync(new URL('./esqueleto.glb', import.meta.url).href),
    fetch(new URL('./ao.bin', import.meta.url).href).then(r => r.ok ? r.arrayBuffer() : null).then(b => b ? new Uint8Array(b) : null).catch(() => null),
  ]);
  let total = 0; gltf.scene.traverse(o => { if (o.isMesh) { let p = o, ok = false; while (p) { if (p.name && MAPA.parts[p.name]) { ok = true; break; } p = p.parent; } if (ok) total += o.geometry.getAttribute('position').count; } });
  const ao = AO && AO.length === total ? AO : null; let ini = 0;
  const root = new THREE.Group(); root.add(gltf.scene); scene.add(root);
  const meshesDe = {}; const todas = [];
  gltf.scene.traverse(o => {
    if (!o.isMesh) return;
    let p = o, id = null; while (p) { if (p.name && MAPA.parts[p.name]) { id = p.name; break; } p = p.parent; }
    if (!id) { o.visible = false; return; }
    if (!o.geometry.getAttribute('normal')) o.geometry.computeVertexNormals();
    try { relevo(o.geometry, ao, ini); } catch (e) { /* sem relevo: segue liso */ }
    ini += o.geometry.getAttribute('position').count;
    o.userData.part = id; o.material = mats.osso; o.castShadow = true; o.receiveShadow = true;
    (meshesDe[id] = meshesDe[id] || []).push(o); todas.push(o);
  });
  root.updateMatrixWorld(true);
  const caixaDe = ids => { const b = new THREE.Box3(); for (const id of ids) for (const m of meshesDe[id] || []) if (m.visible || true) b.expandByObject(m); return b; };
  const c = v => caixaDe(v).getCenter(new THREE.Vector3());
  // orientação: crânio para cima, esterno para a frente
  const up = c(MAPA.struct['crânio']).sub(c(MAPA.struct['pelve'])).normalize();
  let ant = c(MAPA.struct['esterno']).sub(c(MAPA.struct['T6'] || MAPA.struct['torácica']));
  ant.sub(up.clone().multiplyScalar(ant.dot(up))).normalize();
  const lado = new THREE.Vector3().crossVectors(up, ant).normalize();
  gltf.scene.applyMatrix4(new THREE.Matrix4().makeBasis(lado, up, ant).invert()); root.updateMatrixWorld(true);
  const meio = new THREE.Box3().setFromObject(gltf.scene).getCenter(new THREE.Vector3());
  gltf.scene.position.sub(meio); root.updateMatrixWorld(true);
  const corpo = new THREE.Box3().setFromObject(gltf.scene); const ALT = corpo.getSize(new THREE.Vector3()).y;

  // chão que só recebe sombra
  const chao = new THREE.Mesh(new THREE.CircleGeometry(ALT * 0.9, 48), new THREE.ShadowMaterial({ opacity: 0.26 }));
  chao.rotation.x = -Math.PI / 2; chao.position.y = corpo.min.y - ALT * 0.002; chao.receiveShadow = true; scene.add(chao);

  // ---- região visível, luz e sombra ajustadas ao que está na tela ----
  let regiao = 'esqueleto', visiveis = null, caixaReg = corpo.clone(), TAM = ALT;
  // as luzes giram junto com a câmera: a peça nunca fica no escuro, de qualquer lado
  let luzR = 1; const luzM = new THREE.Vector3(), _f = new THREE.Vector3(), _d = new THREE.Vector3(), _u = new THREE.Vector3(), UP = new THREE.Vector3(0, 1, 0);
  function posLuz() {
    _f.copy(camera.position).sub(controls.target); if (_f.lengthSq() < 1e-9) _f.set(0, 0, 1); _f.normalize();
    _d.crossVectors(UP, _f); if (_d.lengthSq() < 1e-6) _d.set(1, 0, 0); _d.normalize(); _u.crossVectors(_f, _d).normalize();
    const poe = (L, a, b, c) => { L.target.position.copy(luzM); L.position.copy(luzM).addScaledVector(_d, a * luzR * 3).addScaledVector(_u, b * luzR * 3).addScaledVector(_f, c * luzR * 3); L.target.updateMatrixWorld(); };
    poe(key, 0.5, 0.75, 0.75); poe(rim, -0.8, 0.45, -0.75); poe(fill, -0.75, -0.15, 0.6);
  }
  function ajustaLuz() {
    const m = caixaReg.getCenter(new THREE.Vector3()), r = caixaReg.getSize(new THREE.Vector3()).length() / 2;
    luzR = r; luzM.copy(m); posLuz();
    const sc = key.shadow.camera; sc.left = sc.bottom = -r * 1.05; sc.right = sc.top = r * 1.05; sc.near = r * 0.5; sc.far = r * 6; sc.updateProjectionMatrix();
    key.shadow.bias = -0.0004; key.shadow.normalBias = r * 0.004;
    chao.visible = regiao === 'esqueleto';
    controls.minDistance = TAM * 0.22; controls.maxDistance = TAM * 3.4;
  }
  const dist = tam => (tam / 2) / Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)) * 1.1 / Math.min(1, camera.aspect || 1);

  // ---- câmera ----
  let anim = null, dirty = true;
  function voar(alvo, dir, d, ms = 750) {
    const p1 = alvo.clone().add(dir.clone().normalize().multiplyScalar(d));
    if (!ms) { camera.position.copy(p1); controls.target.copy(alvo); controls.update(); dirty = true; return; }
    anim = { p0: camera.position.clone(), p1, t0: controls.target.clone(), t1: alvo.clone(), ini: performance.now(), ms }; dirty = true;
  }
  const dirAtual = () => camera.position.clone().sub(controls.target).normalize();
  // mão e pé: olha de frente para o "plano" da peça (dorso), descoberto pelos centros dos ossos
  const planoDe = {};
  function normalDoPlano(ids) {
    const cs = ids.map(id => caixaDe([id]).getCenter(new THREE.Vector3())), m = new THREE.Vector3(); cs.forEach(q => m.add(q)); m.divideScalar(cs.length || 1);
    const C = [0, 0, 0, 0, 0, 0]; for (const q of cs) { const x = q.x - m.x, y = q.y - m.y, z = q.z - m.z; C[0] += x * x; C[1] += x * y; C[2] += x * z; C[3] += y * y; C[4] += y * z; C[5] += z * z; }
    const mul = v => new THREE.Vector3(C[0] * v.x + C[1] * v.y + C[2] * v.z, C[1] * v.x + C[3] * v.y + C[4] * v.z, C[2] * v.x + C[4] * v.y + C[5] * v.z);
    let a = new THREE.Vector3(1, 0.3, 0.2).normalize(); for (let i = 0; i < 40; i++) a = mul(a).normalize();
    let b2 = new THREE.Vector3(0.2, 1, 0.3); for (let i = 0; i < 40; i++) { b2 = mul(b2); b2.addScaledVector(a, -b2.dot(a)).normalize(); }
    return new THREE.Vector3().crossVectors(a, b2).normalize();
  }
  const dirReg = () => {
    if ((regiao === 'mao' || regiao === 'pe') && REGIOES[regiao].length) {
      const n = planoDe[regiao] || (planoDe[regiao] = normalDoPlano(REGIOES[regiao])), cx = caixaReg.getCenter(new THREE.Vector3());
      const fora = regiao === 'pe' ? new THREE.Vector3(0, 1, 0.2) : new THREE.Vector3(Math.sign(cx.x) || 1, 0, -0.15);
      const d = n.clone(); if (d.dot(fora) < 0) d.negate();
      return d.add(new THREE.Vector3(0, regiao === 'pe' ? 0 : 0.12, regiao === 'pe' ? 0.3 : 0.1)).normalize();
    }
    return new THREE.Vector3(...(DIR_REG[regiao] || DIR_REG.esqueleto)).normalize();
  };
  function enquadrar(ids, ms) {
    const b = caixaDe(ids); if (b.isEmpty()) return;
    const s = b.getSize(new THREE.Vector3()), m = b.getCenter(new THREE.Vector3());
    const tam = Math.max(s.x, s.y, s.z);
    // olha o osso pelo lado de fora dele (um occipital pede a vista de trás)
    const plano = regiao === 'mao' || regiao === 'pe', inteiro = regiao === 'esqueleto' || regiao === 'torax';
    if (plano) { const cR = caixaReg.getCenter(new THREE.Vector3()), d0 = dirReg(), n = planoDe[regiao];
      const lado = n ? m.clone().sub(cR).dot(n) * Math.sign(d0.dot(n) || 1) : 0; // osso do outro lado do plano: vira a peça
      if (n && lado < -TAM * 0.035) d0.addScaledVector(n, -2 * d0.dot(n)).normalize();
      voar(cR, d0, dist(TAM), ms); return; }
    const fora = m.clone().sub(caixaReg.getCenter(new THREE.Vector3())); fora.y *= inteiro ? 0.12 : 0.45; if (inteiro) fora.x *= 0.35;
    const rel = fora.length() / (TAM * 0.5);
    let dir = dirAtual().multiplyScalar(0.55).add(dirReg().multiplyScalar(0.25));
    if (rel > 0.12) dir.add(fora.normalize().multiplyScalar(Math.min(1.5, rel * 2.2)));
    if (dir.lengthSq() < 1e-4) dir = dirReg();
    dir.normalize(); dir.y = THREE.MathUtils.clamp(dir.y, -0.2, regiao === 'cranio' ? 0.45 : 0.22); dir.normalize();
    if (regiao !== 'esqueleto') { voar(caixaReg.getCenter(new THREE.Vector3()), dir, dist(TAM), ms); return; }
    voar(m, dir, dist(Math.min(Math.max(tam * 2.6, TAM * 0.5), TAM * 1.05)), ms);
  }

  // ---- destaque ----
  let marcados = [], modo = 'on'; const halos = [];
  function pinta() {
    for (const h of halos) h.parent && h.parent.remove(h); halos.length = 0;
    const tem = marcados.length > 0 && modo !== 'pick';
    for (const m of todas) m.material = tem ? mats.apagado : mats.osso;
    for (const id of marcados) for (const m of meshesDe[id] || []) { m.material = mats[modo];
      if (halo[modo]) { const h = new THREE.Mesh(m.geometry, halo[modo]); h.renderOrder = 5; h.raycast = () => {}; h.userData.halo = true; m.add(h); halos.push(h); } }
    dirty = true;
  }
  function destacar(nome, estado = 'on', { enquadrar: enq = true } = {}) {
    marcados = nome ? resolver(nome, visiveis) : []; modo = estado; pinta();
    if (enq && marcados.length) enquadrar(marcados);
    return marcados.length;
  }
  function definirRegiao(r, { ms = 0 } = {}) {
    if (!(r in REGIOES)) r = 'esqueleto';
    regiao = r; const ids = REGIOES[r]; visiveis = ids ? new Set(ids) : null;
    for (const m of todas) m.visible = !visiveis || visiveis.has(m.userData.part);
    caixaReg = ids ? caixaDe(ids) : corpo.clone(); const s = caixaReg.getSize(new THREE.Vector3()); TAM = ids ? s.length() * 0.96 : s.y;
    ajustaLuz(); marcados = []; pinta();
    voar(caixaReg.getCenter(new THREE.Vector3()), dirReg(), dist(TAM), ms);
  }

  // ---- toque/clique para identificar ----
  const ray = new THREE.Raycaster(), ptr = new THREE.Vector2(); let down = null;
  renderer.domElement.addEventListener('pointerdown', e => { down = [e.clientX, e.clientY]; });
  renderer.domElement.addEventListener('pointerup', e => {
    if (!down || Math.hypot(e.clientX - down[0], e.clientY - down[1]) > 6 || !onPick) return;
    const r = renderer.domElement.getBoundingClientRect();
    ptr.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
    ray.setFromCamera(ptr, camera); const hit = ray.intersectObjects(todas.filter(m => m.visible), false)[0];
    if (!hit) { onPick(null); return; }
    const id = hit.object.userData.part; marcados = [id]; modo = 'pick'; pinta();
    onPick({ id, nome: MAPA.parts[id], estrutura: STRUCT_DE[id] || null });
  });

  // ---- tamanho e laço de desenho (só desenha quando algo muda) ----
  let host = container;
  function medir() { const w = host.clientWidth || 300, h = host.clientHeight || 300; renderer.setSize(w, h, false);
    camera.aspect = w / h; camera.updateProjectionMatrix(); dirty = true; }
  const ro = new ResizeObserver(medir);
  function anexar(el) { if (host === el && renderer.domElement.parentNode === el) { medir(); return; } if (host) ro.unobserve(host); host = el; el.appendChild(renderer.domElement); ro.observe(el); medir(); }
  anexar(container);
  controls.addEventListener('change', () => { dirty = true; });
  let vivo = true;
  const desenha = () => { posLuz(); renderer.render(scene, camera); };
  (function laco() {
    if (!vivo) return; requestAnimationFrame(laco);
    if (anim) { const u = Math.min(1, (performance.now() - anim.ini) / anim.ms), e = u < .5 ? 4 * u * u * u : 1 - Math.pow(-2 * u + 2, 3) / 2;
      camera.position.lerpVectors(anim.p0, anim.p1, e); controls.target.lerpVectors(anim.t0, anim.t1, e); if (u >= 1) anim = null; dirty = true; }
    if (controls.update()) dirty = true;
    if (dirty && host && host.isConnected && host.getClientRects().length) { desenha(); dirty = false; }
  })();

  definirRegiao('esqueleto');
  const api = {
    destacar, tem3D: n => resolver(n, visiveis).length > 0, regiao: definirRegiao, regiaoAtual: () => regiao,
    vista(v) { const d = { frente: [0, 0.05, 1], lado: [1, 0.05, 0], costas: [0, 0.05, -1], cima: [0, 1, 0.25], baixo: [0, -1, 0.25] }[v] || [0, 0, 1];
      const ids = marcados.length && modo !== 'pick' ? marcados : null;
      if (ids && regiao === 'esqueleto') { const b = caixaDe(ids), s = b.getSize(new THREE.Vector3()); voar(b.getCenter(new THREE.Vector3()), new THREE.Vector3(...d), dist(Math.max(Math.max(s.x, s.y, s.z) * 2.4, TAM * 0.42))); }
      else voar(caixaReg.getCenter(new THREE.Vector3()), new THREE.Vector3(...d), dist(TAM)); },
    centralizar() { voar(caixaReg.getCenter(new THREE.Vector3()), dirReg(), dist(TAM)); },
    limpar() { marcados = []; pinta(); },
    anexar, redesenhar() { medir(); },
    destruir() { vivo = false; ro.disconnect(); renderer.dispose(); },
  };
  onReady && onReady(api);
  return api;
}
