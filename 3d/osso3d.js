// Osso a Osso · visualizador 3D do esqueleto (só Pro).
// Modelo: BodyParts3D © DBCLS (CC BY-SA) — ver 3d/LICENCA-MODELOS.txt. Biblioteca: three.js (MIT).
import * as THREE from 'three';
import { GLTFLoader } from './jsm/loaders/GLTFLoader.js';
import { OrbitControls } from './jsm/controls/OrbitControls.js';
import { MeshoptDecoder } from './jsm/libs/meshopt_decoder.module.js';
import { MAPA } from './mapa3d.js';

const COR = { osso: 0xe6dccb, on: 0xf2a65a, win: 0x86cdb0, pick: 0xffd29a };
const norm = s => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
const STRUCT = {}; for (const k of Object.keys(MAPA.struct)) STRUCT[norm(k)] = MAPA.struct[k];
const STRUCT_DE = {}; // peça -> estrutura principal (para o modo explorar)
const PRIOR = ['atlas','áxis','C3','C4','C5','C6','C7','T1','T2','T3','T4','T5','T6','T7','T8','T9','T10','T11','T12','L1','L2','L3','L4','L5','sacro','disco intervertebral'];
for (const [k, ids] of Object.entries(MAPA.struct)) for (const id of ids) {
  if (['cervical','torácica','lombar'].includes(k)) continue;
  if (!STRUCT_DE[id] || PRIOR.includes(k)) STRUCT_DE[id] = k;
}

export function tem3D(nome) { return !!STRUCT[norm(nome || '')]; }

export async function criar(container, { onPick, onReady } = {}) {
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.domElement.style.cssText = 'display:block;width:100%;height:100%;touch-action:none;outline:none';
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(32, 1, 0.01, 100);
  scene.add(new THREE.HemisphereLight(0xfff4e6, 0x16222e, 1.25));
  const key = new THREE.DirectionalLight(0xffffff, 1.6); key.position.set(2, 3, 4); scene.add(key);
  const rim = new THREE.DirectionalLight(0xf2a65a, 0.9); rim.position.set(-3, 1.5, -3); scene.add(rim);
  const fill = new THREE.DirectionalLight(0x9fb8d6, 0.5); fill.position.set(-3, -1, 2); scene.add(fill);

  const controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true; controls.dampingFactor = 0.12; controls.enablePan = false;
  controls.rotateSpeed = 0.8; controls.zoomSpeed = 0.9;

  const mats = {
    osso: new THREE.MeshStandardMaterial({ color: COR.osso, roughness: 0.62, metalness: 0.02 }),
    fraco: new THREE.MeshStandardMaterial({ color: COR.osso, roughness: 0.7, metalness: 0, transparent: true, opacity: 0.28, depthWrite: false }),
    on: new THREE.MeshStandardMaterial({ color: COR.on, emissive: 0x7a3f0c, emissiveIntensity: 0.55, roughness: 0.45 }),
    win: new THREE.MeshStandardMaterial({ color: COR.win, emissive: 0x1d5a44, emissiveIntensity: 0.5, roughness: 0.45 }),
    pick: new THREE.MeshStandardMaterial({ color: COR.pick, emissive: 0x7a4a14, emissiveIntensity: 0.5, roughness: 0.45 }),
  };

  // ---- carrega o modelo ----
  const loader = new GLTFLoader(); loader.setMeshoptDecoder(MeshoptDecoder);
  const gltf = await loader.loadAsync(new URL('./esqueleto.glb', import.meta.url).href);
  const root = new THREE.Group(); root.add(gltf.scene); scene.add(root);
  const meshesDe = {}; const todas = [];
  gltf.scene.traverse(o => {
    if (!o.isMesh) return;
    let p = o, id = null; while (p) { if (p.name && MAPA.parts[p.name]) { id = p.name; break; } p = p.parent; }
    if (!id) return;
    // o arquivo vem só com posições: calcula as normais para a luz funcionar
    if (!o.geometry.getAttribute('normal')) o.geometry.computeVertexNormals();
    o.userData.part = id; o.material = mats.osso; (meshesDe[id] = meshesDe[id] || []).push(o); todas.push(o);
  });
  root.updateMatrixWorld(true);
  const centro = ids => { const b = new THREE.Box3(); for (const id of ids) for (const m of meshesDe[id] || []) b.expandByObject(m); return b; };
  // orientação: crânio para cima, esterno para a frente (descoberto pelo próprio modelo)
  const c = v => centro(v).getCenter(new THREE.Vector3());
  const up = c(MAPA.struct['crânio']).sub(c(MAPA.struct['pelve'])).normalize();
  let ant = c(MAPA.struct['esterno']).sub(c(MAPA.struct['T6'] || MAPA.struct['torácica']));
  ant.sub(up.clone().multiplyScalar(ant.dot(up))).normalize();
  const lado = new THREE.Vector3().crossVectors(up, ant).normalize();
  const basis = new THREE.Matrix4().makeBasis(lado, up, ant).invert();
  gltf.scene.applyMatrix4(basis); root.updateMatrixWorld(true);
  const caixa = new THREE.Box3().setFromObject(gltf.scene); const meio = caixa.getCenter(new THREE.Vector3());
  gltf.scene.position.sub(meio); root.updateMatrixWorld(true);
  const corpo = new THREE.Box3().setFromObject(gltf.scene); const ALT = corpo.getSize(new THREE.Vector3()).y;

  // ---- câmera: animação suave entre enquadramentos ----
  let anim = null, dirty = true;
  const dist = (alt) => (alt / 2) / Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)) * 1.12;
  function voar(alvo, dir, d, ms = 700) {
    const p0 = camera.position.clone(), t0 = controls.target.clone();
    const p1 = alvo.clone().add(dir.clone().normalize().multiplyScalar(d));
    anim = { p0, p1, t0, t1: alvo.clone(), ini: performance.now(), ms }; dirty = true;
  }
  const dirAtual = () => camera.position.clone().sub(controls.target).normalize();
  function enquadrar(ids, ms) {
    const b = centro(ids); if (b.isEmpty()) return;
    const s = b.getSize(new THREE.Vector3()), m = b.getCenter(new THREE.Vector3());
    const tam = Math.max(s.x, s.y, s.z, ALT * 0.16);
    voar(m, dirAtual(), Math.max(dist(tam * 1.6), ALT * 0.35), ms);
  }
  camera.position.set(0, 0, dist(ALT)); controls.target.set(0, 0, 0); controls.update();
  controls.minDistance = ALT * 0.12; controls.maxDistance = ALT * 3.2;

  // ---- destaque ----
  let marcados = [], modo = 'on';
  function pinta() { for (const m of todas) m.material = mats.osso; for (const id of marcados) for (const m of meshesDe[id] || []) m.material = mats[modo]; dirty = true; }
  function destacar(nome, estado = 'on', { enquadrar: enq = true } = {}) {
    marcados = nome ? (STRUCT[norm(nome)] || []) : []; modo = estado; pinta();
    if (enq && marcados.length) enquadrar(marcados);
  }

  // ---- toque/clique para identificar ----
  const ray = new THREE.Raycaster(), ptr = new THREE.Vector2(); let down = null;
  renderer.domElement.addEventListener('pointerdown', e => { down = [e.clientX, e.clientY]; });
  renderer.domElement.addEventListener('pointerup', e => {
    if (!down || Math.hypot(e.clientX - down[0], e.clientY - down[1]) > 6 || !onPick) return;
    const r = renderer.domElement.getBoundingClientRect();
    ptr.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
    ray.setFromCamera(ptr, camera); const hit = ray.intersectObjects(todas, false)[0];
    if (!hit) { onPick(null); return; }
    const id = hit.object.userData.part; marcados = [id]; modo = 'pick'; pinta();
    onPick({ id, nome: MAPA.parts[id], estrutura: STRUCT_DE[id] || null });
  });

  // ---- tamanho e laço de desenho (só desenha quando algo muda) ----
  let host = container;
  function medir() { const w = host.clientWidth || 300, h = host.clientHeight || 300; renderer.setSize(w, h, false); camera.aspect = w / h; camera.updateProjectionMatrix(); dirty = true; }
  const ro = new ResizeObserver(medir);
  function anexar(el) { if (host === el && renderer.domElement.parentNode === el) { medir(); return; } if (host) ro.unobserve(host); host = el; el.appendChild(renderer.domElement); ro.observe(el); medir(); }
  anexar(container);
  controls.addEventListener('change', () => { dirty = true; });
  let vivo = true;
  (function laco() {
    if (!vivo) return; requestAnimationFrame(laco);
    if (anim) { const u = Math.min(1, (performance.now() - anim.ini) / anim.ms), e = u < .5 ? 4 * u * u * u : 1 - Math.pow(-2 * u + 2, 3) / 2;
      camera.position.lerpVectors(anim.p0, anim.p1, e); controls.target.lerpVectors(anim.t0, anim.t1, e); if (u >= 1) anim = null; dirty = true; }
    if (controls.update()) dirty = true;
    if (dirty && host && host.offsetParent !== null) { renderer.render(scene, camera); dirty = false; }
  })();

  const api = {
    destacar, tem3D,
    vista(v) { const d = { frente: [0, 0, 1], lado: [1, 0, 0], costas: [0, 0, -1] }[v] || [0, 0, 1];
      const ids = marcados.length && modo !== 'pick' ? marcados : null;
      if (ids) { const b = centro(ids), s = b.getSize(new THREE.Vector3()); voar(b.getCenter(new THREE.Vector3()), new THREE.Vector3(...d), Math.max(dist(Math.max(s.x, s.y, s.z, ALT * .16) * 1.6), ALT * .35)); }
      else voar(new THREE.Vector3(), new THREE.Vector3(...d), dist(ALT)); },
    centralizar() { voar(new THREE.Vector3(), dirAtual().lengthSq() ? dirAtual() : new THREE.Vector3(0, 0, 1), dist(ALT)); },
    limpar() { marcados = []; pinta(); },
    anexar, redesenhar() { medir(); },
    destruir() { vivo = false; ro.disconnect(); renderer.dispose(); },
  };
  onReady && onReady(api);
  return api;
}
