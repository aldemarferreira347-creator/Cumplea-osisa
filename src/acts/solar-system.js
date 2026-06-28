import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import gsap from 'gsap';
import { goToStory } from '../utils/stateMachine.js';
import { crearCampoEstrellas } from '../utils/starfield.js';

// Module-level handles reset on each init
let renderer = null;
let controls = null;
let rafId = null;
let resizeHandler = null;
let activeTweens = [];
let glowTex = null;
let sparkleTex = null;
let envTex = null;

const raycaster = new THREE.Raycaster();
const pointerNDC = new THREE.Vector2();

// ── Glow helpers (bloom falso, fiable sobre canvas transparente) ─────
function makeGlowTexture() {
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const ctx = c.getContext('2d');
  const g = ctx.createRadialGradient(64, 64, 0, 64, 64, 64);
  g.addColorStop(0, 'rgba(255,255,255,1)');
  g.addColorStop(0.25, 'rgba(255,255,255,0.55)');
  g.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 128, 128);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function makeGlow(color, scale, opacity) {
  const s = new THREE.Sprite(new THREE.SpriteMaterial({
    map: glowTex,
    color,
    transparent: true,
    opacity,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  }));
  s.scale.set(scale, scale, 1);
  return s;
}

// ── Destellos de 4 puntas (los "✦" del cielo de la referencia) ───────
function makeSparkleTexture() {
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const ctx = c.getContext('2d');
  ctx.translate(64, 64);
  // núcleo suave
  const g = ctx.createRadialGradient(0, 0, 0, 0, 0, 30);
  g.addColorStop(0, 'rgba(255,255,255,1)');
  g.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = g;
  ctx.beginPath(); ctx.arc(0, 0, 30, 0, Math.PI * 2); ctx.fill();
  // estrella de 4 puntas (rombo de lados cóncavos)
  ctx.fillStyle = 'rgba(255,255,255,0.95)';
  ctx.beginPath();
  ctx.moveTo(0, -62);
  ctx.quadraticCurveTo(7, -7, 62, 0);
  ctx.quadraticCurveTo(7, 7, 0, 62);
  ctx.quadraticCurveTo(-7, 7, -62, 0);
  ctx.quadraticCurveTo(-7, -7, 0, -62);
  ctx.closePath(); ctx.fill();
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function makeSparkle(color, scale, opacity) {
  const s = new THREE.Sprite(new THREE.SpriteMaterial({
    map: sparkleTex, color, transparent: true, opacity,
    blending: THREE.AdditiveBlending, depthWrite: false,
  }));
  s.scale.set(scale, scale, 1);
  return s;
}

// ── Roca low-poly irregular (asteroide). Ruido por POSICIÓN, no por
//    vértice, para que las facetas no se rasguen. ──────────────────────
function makeRock(r, color, detail = 1) {
  const geo = new THREE.IcosahedronGeometry(r, detail);
  const p = geo.attributes.position;
  const v = new THREE.Vector3();
  const seed = Math.random() * 10;
  for (let i = 0; i < p.count; i++) {
    v.fromBufferAttribute(p, i);
    const n = 1
      + 0.26 * Math.sin(v.x * 4 + seed) * Math.cos(v.y * 4)
      + 0.16 * Math.sin(v.z * 5 + seed);
    v.multiplyScalar(n);
    p.setXYZ(i, v.x, v.y, v.z);
  }
  geo.computeVertexNormals();
  return new THREE.Mesh(geo, new THREE.MeshStandardMaterial({
    color, roughness: 1, metalness: 0, flatShading: true,
  }));
}

function createMesh(geometry, color, position = new THREE.Vector3(), opts = {}) {
  const mesh = new THREE.Mesh(
    geometry,
    new THREE.MeshStandardMaterial({
      color,
      roughness: opts.roughness ?? 0.8,
      metalness: opts.metalness ?? 0.05,
      flatShading: opts.flatShading ?? true,
      emissive: opts.emissive ?? 0x000000,
      emissiveIntensity: opts.emissiveIntensity ?? 1,
      side: opts.side ?? THREE.FrontSide,
    })
  );
  mesh.position.copy(position);
  return mesh;
}

// ── Árbol estilizado (tronco + copas cónicas) ────────────────────────
function makeTree(s = 1) {
  const g = new THREE.Group();
  const cast = (m) => { m.castShadow = true; return m; };
  g.add(cast(createMesh(new THREE.CylinderGeometry(0.02 * s, 0.032 * s, 0.15 * s, 7),
    0x6E4A2C, new THREE.Vector3(0, 0.075 * s, 0), { flatShading: false, roughness: 0.9 })));
  const greens = [0x49873E, 0x3E7634, 0x55A347];
  for (let k = 0; k < 3; k++) {
    g.add(cast(createMesh(new THREE.ConeGeometry((0.125 - 0.03 * k) * s, 0.14 * s, 10),
      greens[k % greens.length], new THREE.Vector3(0, (0.18 + 0.075 * k) * s, 0),
      { flatShading: false, roughness: 0.85 })));
  }
  return g;
}

// ── Arbusto (racimo de esferas) ──────────────────────────────────────
function makeBush(s = 1) {
  const g = new THREE.Group();
  for (let i = 0; i < 4; i++) {
    const b = createMesh(new THREE.SphereGeometry((0.05 + Math.random() * 0.03) * s, 12, 10),
      0x4C8A40, new THREE.Vector3((Math.random() - 0.5) * 0.09 * s, 0.03 * s, (Math.random() - 0.5) * 0.09 * s),
      { flatShading: false, roughness: 0.9 });
    b.castShadow = true;
    g.add(b);
  }
  return g;
}

// ════════════════════════════════════════════════════════════════════
//  El Principito — figura articulada (proporciones, ropa, libro, pose)
// ════════════════════════════════════════════════════════════════════
function buildPrince() {
  const g = new THREE.Group();

  // ── Paleta cartoon cohesiva (cálida, de acuarela) ─────────────────
  const COAT = 0x2E6B66, COAT_DK = 0x214E4A, TROUSER = 0x294D52,
        BOOT = 0x4A352A, BOOT_DK = 0x35261E,
        SKIN = 0xF2C79B, SKIN_DK = 0xE3AC7E,
        HAIR = 0xF6C13C, HAIR_DK = 0xDFA42A, HAIR_LT = 0xF8CC55,
        SCARF = 0xF7C948, GOLD = 0xF4C84A, CREAM = 0xF3E7C6,
        BROW = 0xCB922F, EYE = 0x2C231B, CHEEK = 0xE8906F, LIP = 0xA85942,
        BOOK_COVER = 0x8E3B2E;

  const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
  const V2 = (x, y) => new THREE.Vector2(x, y);

  // helper: malla suave que proyecta sombra
  const pm = (geo, color, pos = V(), opts = {}) => {
    const m = createMesh(geo, color, pos, { flatShading: false, ...opts });
    m.castShadow = true;
    return m;
  };
  // helper: detalle pequeño sin sombra (rasgos de la cara)
  const sm = (geo, color, pos = V(), opts = {}) =>
    createMesh(geo, color, pos, { flatShading: false, ...opts });
  // helper: cinta fina a lo largo de una curva (ceja / sonrisa)
  const stroke = (pts, radius, color) => new THREE.Mesh(
    new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 14, radius, 6, false),
    new THREE.MeshStandardMaterial({ color, roughness: 0.55 })
  );
  // helper: cápsula que une dos puntos -> miembros SIN costuras ni huecos
  const limb = (a, b, radius, color, opts = {}) => {
    const dir = new THREE.Vector3().subVectors(b, a);
    const len = dir.length();
    const m = pm(new THREE.CapsuleGeometry(radius, Math.max(0.001, len), 6, 12), color, V(), opts);
    m.position.copy(a).add(b).multiplyScalar(0.5);
    m.quaternion.setFromUnitVectors(V(0, 1, 0), dir.normalize());
    return m;
  };
  const hairBits = { roughness: 0.55, emissive: 0xC8911D, emissiveIntensity: 0.22 };

  // ── Piernas + botas ───────────────────────────────────────────────
  function makeBoot() {
    const b = new THREE.Group();
    b.add(pm(new THREE.CylinderGeometry(0.05, 0.057, 0.105, 14), BOOT, V(0, 0.07, 0), { roughness: 0.72 })); // caña
    const foot = pm(new THREE.SphereGeometry(0.058, 16, 12), BOOT, V(0, 0.032, 0.05), { roughness: 0.72 });   // empeine + puntera
    foot.scale.set(0.9, 0.72, 1.62);
    b.add(foot);
    b.add(pm(new THREE.BoxGeometry(0.1, 0.022, 0.165), BOOT_DK, V(0, 0.012, 0.046), { roughness: 0.85 }));    // suela
    return b;
  }
  [-1, 1].forEach((sx) => {
    g.add(limb(V(sx * 0.066, 0.305, 0), V(sx * 0.072, 0.1, 0), 0.053, TROUSER, { roughness: 0.78 })); // pierna
    const boot = makeBoot();
    boot.position.set(sx * 0.072, 0, 0);
    boot.rotation.y = sx * 0.13;
    g.add(boot);
  });

  // ── Abrigo: lathe con cintura marcada y vuelo moderado (deja ver las
  //    piernas). Mucho menos "campana" que antes. ─────────────────────
  const robe = pm(new THREE.LatheGeometry([
    V2(0.0, 0.250), V2(0.156, 0.258), V2(0.150, 0.300), V2(0.128, 0.370),
    V2(0.117, 0.440), V2(0.131, 0.510), V2(0.143, 0.565), V2(0.120, 0.602),
    V2(0.074, 0.628), V2(0.0, 0.634),
  ], 48), COAT, V(), { roughness: 0.6, side: THREE.DoubleSide });
  robe.receiveShadow = true;
  g.add(robe);

  // Cinturón de cuero + hebilla
  const belt = pm(new THREE.TorusGeometry(0.121, 0.015, 10, 36), BOOT, V(0, 0.438, 0), { roughness: 0.6 });
  belt.rotation.x = Math.PI / 2;
  g.add(belt);
  g.add(pm(new THREE.BoxGeometry(0.036, 0.03, 0.016), GOLD, V(0, 0.438, 0.123), { roughness: 0.4, metalness: 0.4 }));

  // Botonadura doble dorada
  [-1, 1].forEach((sx) => {
    for (let i = 0; i < 3; i++) {
      g.add(pm(new THREE.SphereGeometry(0.0105, 10, 10), GOLD,
        V(sx * 0.036, 0.49 + i * 0.045, 0.13), { roughness: 0.4, metalness: 0.4 }));
    }
  });

  // Cuello alto del abrigo
  g.add(pm(new THREE.CylinderGeometry(0.06, 0.08, 0.055, 20, 1, true), COAT_DK,
    V(0, 0.648, 0), { roughness: 0.6, side: THREE.DoubleSide }));
  // Cuello (piel)
  g.add(pm(new THREE.CylinderGeometry(0.043, 0.05, 0.08, 14), SKIN, V(0, 0.64, 0), { roughness: 0.6 }));

  // ── Libro abierto (tapa, lomo, hojas, renglones) ──────────────────
  const book = new THREE.Group();
  book.position.set(0, 0.452, 0.16);
  book.rotation.set(-0.5, 0, 0);
  const pw = 0.088, ph = 0.132;
  [-1, 1].forEach((sx) => {
    const side = new THREE.Group();
    side.rotation.y = sx * 0.34;             // abre las dos páginas en V
    const cx = sx * (pw / 2 + 0.005);
    side.add(pm(new THREE.BoxGeometry(pw + 0.012, ph + 0.012, 0.012), BOOK_COVER, V(cx, 0, -0.005), { roughness: 0.5 })); // tapa
    side.add(pm(new THREE.BoxGeometry(pw, ph, 0.01), CREAM, V(cx, 0, 0.004), { roughness: 0.9 }));                        // hojas
    for (let r = 0; r < 4; r++) {            // renglones de texto
      side.add(sm(new THREE.BoxGeometry(pw * 0.6, 0.005, 0.002), 0xB7A06B, V(cx, 0.036 - r * 0.022, 0.0105), { roughness: 0.8 }));
    }
    book.add(side);
  });
  book.add(pm(new THREE.BoxGeometry(0.02, ph + 0.014, 0.03), BOOK_COVER, V(0, 0, -0.007), { roughness: 0.5 })); // lomo
  book.userData.isClickable = true;
  g.add(book);

  // ── Brazos: hombro→codo→muñeca con articulaciones (sin huecos), las
  //    dos manos sostienen el libro frente al pecho (postura de lectura).
  function makeHand() {
    const h = new THREE.Group();
    const palm = pm(new THREE.SphereGeometry(0.042, 14, 12), SKIN, V(), { roughness: 0.6 });
    palm.scale.set(1.05, 0.78, 0.85);
    h.add(palm);
    const fingers = pm(new THREE.SphereGeometry(0.04, 12, 10), SKIN, V(0, -0.008, 0.028), { roughness: 0.6 });
    fingers.scale.set(1.0, 0.55, 0.7);
    h.add(fingers);
    return h;
  }
  [-1, 1].forEach((sx) => {
    const shoulder = V(sx * 0.137, 0.560, 0.012);
    const elbow    = V(sx * 0.134, 0.452, 0.085);
    const wrist    = V(sx * 0.096, 0.408, 0.158);
    g.add(pm(new THREE.SphereGeometry(0.05, 14, 12), COAT, shoulder, { roughness: 0.62 }));  // hombro (integra brazo↔torso)
    g.add(limb(shoulder, elbow, 0.041, COAT, { roughness: 0.62 }));                          // brazo
    g.add(pm(new THREE.SphereGeometry(0.042, 12, 12), COAT, elbow, { roughness: 0.62 }));    // codo
    g.add(limb(elbow, wrist, 0.037, COAT, { roughness: 0.62 }));                             // antebrazo
    const cuff = elbow.clone().lerp(wrist, 0.82);
    g.add(pm(new THREE.SphereGeometry(0.044, 12, 10), COAT_DK, cuff, { roughness: 0.6 }));   // puño
    const hand = makeHand();
    hand.position.copy(wrist);
    g.add(hand);
  });

  // ── Cabeza + orejas ───────────────────────────────────────────────
  const head = pm(new THREE.SphereGeometry(0.135, 32, 28), SKIN, V(0, 0.79, 0), { roughness: 0.5 });
  head.scale.set(0.99, 1.05, 0.98);
  g.add(head);
  [-1, 1].forEach((sx) => {
    const ear = pm(new THREE.SphereGeometry(0.026, 12, 10), SKIN, V(sx * 0.132, 0.785, -0.004), { roughness: 0.55 });
    ear.scale.set(0.6, 1.0, 0.8);
    g.add(ear);
  });

  // ── Rostro: ojos amables, cejas suaves, mejillas, nariz, sonrisa ──
  [-1, 1].forEach((sx) => {
    // Ojo redondo y despierto: base oscura + iris ámbar + pupila + dos
    // brillos -> mirada viva (modelado con pupila, sin quedar saltón).
    const ex = sx * 0.052;
    const eye = sm(new THREE.SphereGeometry(0.03, 18, 16), 0x241B12, V(ex, 0.809, 0.117), { roughness: 0.25 });
    eye.scale.set(0.96, 1.0, 0.5);
    g.add(eye);
    const iris = sm(new THREE.SphereGeometry(0.016, 14, 12), 0x9A6A2D, V(ex, 0.807, 0.127), { roughness: 0.3 });
    iris.scale.set(1, 1, 0.5);
    g.add(iris);
    g.add(sm(new THREE.SphereGeometry(0.009, 12, 12), 0x100A06, V(ex, 0.806, 0.132), { roughness: 0.25 })); // pupila
    g.add(sm(new THREE.SphereGeometry(0.009, 10, 10), 0xFFFFFF, V(ex - sx * 0.008, 0.816, 0.137),
      { roughness: 0.1, emissive: 0xFFFFFF, emissiveIntensity: 0.7 }));  // brillo principal
    g.add(sm(new THREE.SphereGeometry(0.0042, 8, 8), 0xFFFFFF, V(ex + sx * 0.006, 0.802, 0.136),
      { roughness: 0.1, emissive: 0xFFFFFF, emissiveIntensity: 0.5 })); // brillo inferior
    // Ceja: arco suave y cálido (sin gesto de enfado)
    g.add(stroke([V(sx * 0.026, 0.846, 0.121), V(sx * 0.052, 0.853, 0.125), V(sx * 0.079, 0.847, 0.116)], 0.0064, BROW));
    // Mejilla sonrojada (disco translúcido)
    const cheek = sm(new THREE.SphereGeometry(0.03, 12, 12), CHEEK, V(sx * 0.085, 0.762, 0.1), { roughness: 0.7 });
    cheek.scale.z = 0.28; cheek.material.transparent = true; cheek.material.opacity = 0.5;
    g.add(cheek);
  });
  // Nariz pequeña y redondeada (visible, capta luz)
  const nose = sm(new THREE.SphereGeometry(0.018, 12, 10), SKIN_DK, V(0, 0.781, 0.135), { roughness: 0.55 });
  nose.scale.set(0.85, 0.72, 0.98);
  g.add(nose);
  // Sonrisa amable (curva ∪, comisuras arriba)
  g.add(stroke([V(-0.04, 0.758, 0.121), V(0, 0.746, 0.136), V(0.04, 0.758, 0.121)], 0.0065, LIP));

  // ── Pelo dorado, suave y revuelto, con mechones barridos ──────────
  // El pelo NO proyecta sombra: así no oscurece la frente ni los ojos.
  const noShadow = (m) => { m.castShadow = false; return m; };
  // Casquete base: domo suave; el borde frontal forma una línea de pelo
  // limpia por encima de las cejas (frente despejada, no tapa los ojos).
  const cap = noShadow(pm(new THREE.SphereGeometry(0.15, 28, 22, 0, Math.PI * 2, 0, Math.PI * 0.52), HAIR, V(0, 0.852, -0.022), hairBits));
  cap.scale.set(1.05, 1.0, 1.12);
  g.add(cap);
  // Nuca: masa amplia centrada y desplazada atrás -> envuelve todo el
  // hemisferio trasero de la cabeza (queda tras la cara, no la tapa).
  g.add(noShadow(pm(new THREE.SphereGeometry(0.14, 22, 18), HAIR, V(0, 0.815, -0.04), hairBits)));
  g.add(noShadow(pm(new THREE.SphereGeometry(0.062, 14, 12), HAIR, V(0, 0.72, -0.08), hairBits))); // remate sobre el cuello

  // Mechón "gota": esfera alargada orientada hacia una dirección
  const hairCols = [HAIR, HAIR_DK, HAIR_LT];
  const lock = (pos, dir, length, width, col) => {
    const m = noShadow(pm(new THREE.SphereGeometry(width, 10, 8), col, pos, hairBits));
    m.scale.set(1, length / width, 1);                       // alarga -> gota suave
    m.quaternion.setFromUnitVectors(V(0, 1, 0), dir.clone().normalize());
    g.add(m);
  };
  // Corona: mechones suaves barridos hacia arriba y afuera (frente→nuca)
  const M = 14;
  for (let i = 0; i < M; i++) {
    const a = (i / M) * Math.PI * 2;
    const px = Math.cos(a) * 0.092, pz = Math.sin(a) * 0.092 - 0.012;
    const dir = V(px * 1.5, 0.85, pz * 1.5 - 0.08);          // sube y se abre
    lock(V(px, 0.918, pz), dir, 0.07 + (i % 3) * 0.014, 0.031, hairCols[i % 3]);
  }
  // Patillas: mechones que enmarcan la cara junto a las sienes
  [-1, 1].forEach((sx) => {
    const fr = noShadow(pm(new THREE.SphereGeometry(0.042, 12, 10), HAIR, V(sx * 0.124, 0.858, 0.03), hairBits));
    fr.scale.set(0.8, 1.3, 0.95);
    g.add(fr);
  });
  // Flequillo: mechones suaves en la línea del pelo (frente despejada)
  [-0.05, 0.0, 0.05].forEach((xo, i) => {
    const fr = noShadow(pm(new THREE.SphereGeometry(0.032, 12, 10), i === 1 ? HAIR : HAIR_DK, V(xo, 0.868, 0.097), hairBits));
    fr.scale.set(1.15, 0.8, 0.8);
    g.add(fr);
  });
  // Remolino: un mechón que se alza al frente (rizo icónico, sin lazo)
  lock(V(0.012, 0.965, 0.045), V(0.16, 1, 0.32), 0.115, 0.027, HAIR_LT);
  lock(V(-0.03, 0.96, 0.02), V(-0.1, 1, 0.15), 0.085, 0.024, HAIR);
  // Halo cálido
  const hairGlow = makeGlow(0xF7C948, 0.66, 0.34);
  hairGlow.position.set(0, 0.9, 0);
  g.add(hairGlow);

  // ── Bufanda dorada ondeante (cola larga al viento + cola corta) ───
  const scarf = new THREE.Group();
  scarf.position.set(0, 0.6, 0);
  const scarfMat = () => new THREE.MeshStandardMaterial({ color: SCARF, roughness: 0.6, emissive: 0x7A5212, emissiveIntensity: 0.2 });
  const tail = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3([
    V(0.0, 0.02, 0.06), V(-0.17, 0.05, 0.0), V(-0.34, 0.11, -0.07),
    V(-0.5, 0.04, -0.2), V(-0.66, 0.13, -0.34), V(-0.85, 0.05, -0.52),
  ]), 60, 0.05, 9, false), scarfMat());
  tail.scale.set(1, 1, 0.66);   // sección aplanada -> lee como cinta, no cordón
  tail.castShadow = true;
  scarf.add(tail);
  const front = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3([
    V(0.03, 0.01, 0.07), V(0.06, -0.08, 0.09), V(0.04, -0.17, 0.07),
  ]), 20, 0.038, 8, false), scarfMat());
  front.scale.set(1, 1, 0.66);
  front.castShadow = true;
  scarf.add(front);
  g.add(scarf);
  g.add(pm(new THREE.SphereGeometry(0.05, 16, 12), SCARF, V(0.02, 0.604, 0.055), { roughness: 0.55 })); // nudo

  g.userData.scarf = scarf;
  g.userData.book = book;
  return g;
}

// ════════════════════════════════════════════════════════════════════
//  La rosa — la rosa preservada de "La Bella y la Bestia" / El Principito.
//  Construcción realista: cabeza de pétalos enrollados en espiral
//  filotáctica (ángulo áureo), hojas dentadas, pétalos caídos y fanal de
//  cristal nítido con reflejos de entorno. Estética premium, no cartoon.
// ════════════════════════════════════════════════════════════════════

// smoothstep auxiliar para mezclar curvaturas de pétalo/hoja.
function smooth01(x, a, b) {
  const t = THREE.MathUtils.clamp((x - a) / (b - a), 0, 1);
  return t * t * (3 - 2 * t);
}

// Malla de pétalo de rosa parametrizable. Dos variantes:
//  · "core": estrecho y muy acopado → capullo enrollado del corazón.
//  · "open": ancho, borde superior amplio y romo, poca copa → pétalos
//    externos que se solapan como tejas formando la rosa abierta.
// Eje +Y = largo (base→punta), -Z = cara cóncava interior (mira al centro).
function makeRosePetalGeometry(o) {
  const { length, widthMax, cup, lip, neckBase, domeStart, domeMin } = o;
  const nU = 18, nV = 18;
  const pos = [], idx = [];
  for (let v = 0; v < nV; v++) {
    const fv = v / (nV - 1);
    const neck = neckBase + (1 - neckBase) * smooth01(fv, 0.0, 0.24);
    // cima roma: arco que cae sólo hasta domeMin (no converge a un punto)
    const dome = fv <= domeStart
      ? 1
      : domeMin + (1 - domeMin) * Math.sqrt(Math.max(0, 1 - ((fv - domeStart) / (1 - domeStart)) ** 2));
    const w = widthMax * neck * dome;
    for (let u = 0; u < nU; u++) {
      const uu = (u / (nU - 1)) * 2 - 1;
      const x = uu * w * 0.5;
      const y = fv * length;
      const zCup = -cup * (uu * uu) * (0.45 + 0.55 * fv);  // cuchara que abraza
      const zLip =  lip * smooth01(fv, 0.58, 1.0);          // labio superior reclinado
      pos.push(x, y, zCup + zLip);
    }
  }
  for (let v = 0; v < nV - 1; v++) {
    for (let u = 0; u < nU - 1; u++) {
      const a = v * nU + u, b = a + 1, c = a + nU, d = c + 1;
      idx.push(a, c, b, b, c, d);
    }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setIndex(idx);
  geo.computeVertexNormals();
  return geo;
}

// Hoja de rosa: rejilla con nervadura central, copa y caída natural.
function makeLeafGeometry() {
  const nU = 10, nV = 16;
  const length = 0.16, widthMax = 0.082;
  const pos = [], idx = [];
  for (let v = 0; v < nV; v++) {
    const fv = v / (nV - 1);
    const w = Math.sin(Math.PI * Math.pow(fv, 0.72)) * widthMax * (1 - 0.18 * fv);
    for (let u = 0; u < nU; u++) {
      const uu = (u / (nU - 1)) * 2 - 1;
      const x = uu * w * 0.5;
      const y = fv * length;
      const crease = 0.045 * (1 - Math.abs(uu));   // nervadura central elevada
      const zCup   = -0.16 * (uu * uu);            // sección en V
      const droop  = -0.12 * Math.pow(fv, 1.5);    // la punta cae
      pos.push(x, y, crease + zCup + droop);
    }
  }
  for (let v = 0; v < nV - 1; v++) {
    for (let u = 0; u < nU - 1; u++) {
      const a = v * nU + u, b = a + 1, c = a + nU, d = c + 1;
      idx.push(a, c, b, b, c, d);
    }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setIndex(idx);
  geo.computeVertexNormals();
  return geo;
}

function buildRose(env) {
  const g = new THREE.Group();
  const cast = (m) => { m.castShadow = true; return m; };
  // Suelo interior del fanal (cara superior de la base negra).
  const FLOOR = 0.10;

  // ── Materiales PBR realistas ─────────────────────────────────────
  // Pétalos: satén rojo con leve sangrado profundo (emissive) para que la
  // rosa "respire" bajo el cristal. Gama de rojos del corazón al borde.
  const PETAL_COLORS = [0x8E0712, 0xAE0C19, 0xC8101E, 0xDA1422, 0xE81C2A, 0xF42836];
  const petalMats = PETAL_COLORS.map((color) => new THREE.MeshStandardMaterial({
    color, roughness: 0.72, metalness: 0.0,        // aterciopelado, no cristalino
    emissive: 0x1E0204, emissiveIntensity: 0.22,
    side: THREE.DoubleSide, envMap: env, envMapIntensity: 0.15,
  }));
  const petalMatFor = (t) => petalMats[Math.min(PETAL_COLORS.length - 1, Math.floor(t * PETAL_COLORS.length))];

  const stemMat = new THREE.MeshStandardMaterial({ color: 0x2F6B30, roughness: 0.62, metalness: 0.0, envMap: env, envMapIntensity: 0.3 });
  const leafMat = new THREE.MeshStandardMaterial({ color: 0x2E7D32, roughness: 0.5, metalness: 0.0, emissive: 0x06180A, emissiveIntensity: 0.25, side: THREE.DoubleSide, envMap: env, envMapIntensity: 0.45 });
  const sepalMat = new THREE.MeshStandardMaterial({ color: 0x3C7A2E, roughness: 0.55, metalness: 0.0, side: THREE.DoubleSide, envMap: env, envMapIntensity: 0.35 });

  const petalCoreGeo = makeRosePetalGeometry({ length: 0.170, widthMax: 0.175, cup: 0.42, lip: -0.03, neckBase: 0.34, domeStart: 0.60, domeMin: 0.46 });
  const petalOpenGeo = makeRosePetalGeometry({ length: 0.215, widthMax: 0.330, cup: 0.30, lip: -0.07, neckBase: 0.48, domeStart: 0.50, domeMin: 0.70 });
  const leafGeo = makeLeafGeometry();

  // ── Grupo de la flor (tallo + hojas + corola). Pivota desde la base
  //    para el vaivén de brisa y se apoya en el suelo del fanal. ──────
  const flower = new THREE.Group();
  flower.position.y = FLOOR;
  g.add(flower);

  // ── Tallo erguido, cónico, con curvatura muy sutil ───────────────
  const STEM_H = 0.30, R_BOTTOM = 0.022, R_TOP = 0.014, BEND = 0.018;
  const stemGeo = new THREE.CylinderGeometry(R_TOP, R_BOTTOM, STEM_H, 16, 14);
  stemGeo.translate(0, STEM_H / 2, 0);
  const sAttr = stemGeo.attributes.position, sv = new THREE.Vector3();
  for (let i = 0; i < sAttr.count; i++) {
    sv.fromBufferAttribute(sAttr, i);
    const t = sv.y / STEM_H;
    sAttr.setX(i, sv.x + BEND * t * t);
  }
  stemGeo.computeVertexNormals();
  flower.add(cast(new THREE.Mesh(stemGeo, stemMat)));
  const BLOOM_Y = STEM_H + 0.04;   // la corola corona el tallo

  // ── Follaje: hojas que brotan del tallo hacia los lados, ligeramente
  //    caídas (no tapan la flor). Tamaño contenido y natural. ─────────
  const addLeaf = (atY, yaw, scale, droop) => {
    const xAt = BEND * (atY / STEM_H) * (atY / STEM_H);
    const pivot = new THREE.Object3D();
    pivot.position.set(xAt, atY, 0);
    pivot.rotation.y = yaw;            // dirección alrededor del tallo
    const leaf = cast(new THREE.Mesh(leafGeo, leafMat));
    leaf.rotation.z = Math.PI / 2 - 0.35; // tiende la hoja hacia el lado (horizontal)
    leaf.rotation.x = droop;           // leve caída
    leaf.scale.setScalar(scale);
    pivot.add(leaf);
    flower.add(pivot);
  };
  addLeaf(STEM_H * 0.66, 0.5,        1.0,  0.5);
  addLeaf(STEM_H * 0.52, Math.PI + 0.2, 1.1, 0.45);
  addLeaf(STEM_H * 0.40, Math.PI * 0.5, 0.9, 0.6);

  // ── Corola: pétalos en espiral filotáctica (ángulo áureo) ────────
  const bloom = new THREE.Group();
  bloom.position.set(BEND, BLOOM_Y, 0);
  flower.add(bloom);

  // Corazón: capullo enrollado (cono rojo profundo) para que el centro se
  // vea denso y sin huecos.
  const core = new THREE.Mesh(new THREE.ConeGeometry(0.038, 0.15, 14),
    new THREE.MeshStandardMaterial({ color: 0x6E0812, roughness: 0.6, emissive: 0x1C0204, emissiveIntensity: 0.35, envMap: env, envMapIntensity: 0.15 }));
  core.position.y = 0.145;
  bloom.add(core);

  // Pétalos en ANILLOS solapados (como tejas). Flor más bien cerrada (tipo
  // capullo abierto a medias, como la rosa preservada): capas casi verticales
  // que se reclinan poco a poco. Internos acopados, externos anchos.
  const addPetal = (geo, ang, radius, y, tilt, scale, band) => {
    const pivot = new THREE.Object3D();
    pivot.rotation.y = ang;
    const petal = new THREE.Mesh(geo, petalMatFor(band));
    petal.castShadow = band > 0.6;
    petal.position.set(0, y, radius);
    petal.rotation.x = tilt;
    petal.scale.setScalar(scale);
    pivot.add(petal);
    bloom.add(pivot);
  };
  // capullo central: 3 pétalos verticales enrollados que envuelven el cono
  for (let i = 0; i < 3; i++) addPetal(petalCoreGeo, (i / 3) * Math.PI * 2 + i * 0.3, 0.012, 0.135, 0.05, 0.62, 0.08);
  // POCOS pétalos GRANDES muy solapados → se lee como rosa (no como dalia
  // de muchos pétalos finos). Espiral que se abre poco a poco.
  const rings = [
    { n: 3, r: 0.034, y: 0.122, tilt: 0.22, s: 0.85, band: 0.30, geo: petalCoreGeo },
    { n: 4, r: 0.060, y: 0.100, tilt: 0.42, s: 1.05, band: 0.50, geo: petalOpenGeo },
    { n: 5, r: 0.086, y: 0.072, tilt: 0.60, s: 1.18, band: 0.68, geo: petalOpenGeo },
    { n: 6, r: 0.110, y: 0.044, tilt: 0.74, s: 1.22, band: 0.86, geo: petalOpenGeo },
    { n: 7, r: 0.130, y: 0.016, tilt: 0.86, s: 1.18, band: 1.0, geo: petalOpenGeo },
  ];
  rings.forEach((R, ri) => {
    const offset = ri * 0.62;                           // desfase áureo: tapa huecos
    for (let i = 0; i < R.n; i++) {
      addPetal(R.geo, (i / R.n) * Math.PI * 2 + offset, R.r, R.y, R.tilt, R.s, R.band);
    }
  });

  // Cáliz: sépalos verdes cortos que apenas asoman bajo los pétalos.
  const sepalGeo = new THREE.ConeGeometry(0.014, 0.09, 5);
  for (let i = 0; i < 5; i++) {
    const piv = new THREE.Object3D();
    piv.rotation.y = (i / 5) * Math.PI * 2 + 0.3;
    const sep = new THREE.Mesh(sepalGeo, sepalMat);
    sep.position.set(0, -0.085, 0.055);
    sep.rotation.x = 2.75;                              // apuntan hacia abajo
    piv.add(sep);
    bloom.add(piv);
  }

  // Resplandor cálido muy sutil dentro de la cúpula (sigue al vaivén).
  const glow = makeGlow(0xFF5A4A, 0.7, 0.28);
  glow.position.set(BEND, BLOOM_Y + 0.02, 0);
  flower.add(glow);

  // ── Pétalos caídos sobre la base (detalle de la rosa preservada) ──
  const fallen = [
    { x:  0.20, z:  0.16, ry: 0.6,  s: 0.95 },
    { x: -0.22, z:  0.10, ry: 2.3,  s: 1.05 },
    { x:  0.06, z: -0.24, ry: 4.1,  s: 0.9  },
    { x: -0.10, z: -0.16, ry: 5.2,  s: 0.85 },
  ];
  fallen.forEach((f) => {
    const petal = cast(new THREE.Mesh(petalOpenGeo, petalMatFor(0.9)));
    petal.position.set(f.x, FLOOR + 0.012, f.z);
    petal.rotation.x = -Math.PI / 2 + 0.18;            // casi plano sobre la base
    petal.rotation.y = f.ry;
    petal.scale.setScalar(f.s);
    g.add(petal);
  });

  // ── Fanal de cristal nítido (reflejos de entorno, casi invisible) ─
  // Vidrio "limpio": baja opacidad + clearcoat + envMap = cristal real,
  // sin el aspecto lechoso de la transmisión sobre lienzo transparente.
  const glassMat = new THREE.MeshPhysicalMaterial({
    color: 0xFFFFFF, metalness: 0.0, roughness: 0.02,
    transparent: true, opacity: 0.16,
    clearcoat: 1.0, clearcoatRoughness: 0.02,
    envMap: env, envMapIntensity: 1.25,
    side: THREE.DoubleSide, depthWrite: false,
    premultipliedAlpha: true,
  });
  const cR = 0.5, cH = 0.66;
  const body = new THREE.Mesh(new THREE.CylinderGeometry(cR, cR, cH, 48, 1, true), glassMat);
  body.position.y = FLOOR + cH / 2;
  body.renderOrder = 2;
  g.add(body);
  const cap = new THREE.Mesh(new THREE.SphereGeometry(cR, 48, 28, 0, Math.PI * 2, 0, Math.PI / 2), glassMat);
  cap.position.y = FLOOR + cH;
  cap.renderOrder = 2;
  g.add(cap);
  // Aro metálico fino donde el cristal se asienta en la base.
  const rim = new THREE.Mesh(new THREE.TorusGeometry(cR, 0.018, 12, 48),
    new THREE.MeshStandardMaterial({ color: 0x1A1A1E, roughness: 0.35, metalness: 0.6, envMap: env, envMapIntensity: 0.8 }));
  rim.rotation.x = Math.PI / 2;
  rim.position.y = FLOOR + 0.005;
  g.add(rim);

  // ── Base negra biselada (pedestal) ───────────────────────────────
  const baseMat = new THREE.MeshStandardMaterial({ color: 0x0C0C0F, roughness: 0.4, metalness: 0.25, envMap: env, envMapIntensity: 0.7 });
  const baseProfile = [
    new THREE.Vector2(0.0,  0.0),
    new THREE.Vector2(0.56, 0.0),
    new THREE.Vector2(0.585, 0.025),
    new THREE.Vector2(0.585, 0.075),
    new THREE.Vector2(0.55, FLOOR),
    new THREE.Vector2(0.0,  FLOOR),
  ];
  const base = new THREE.Mesh(new THREE.LatheGeometry(baseProfile, 56), baseMat);
  base.receiveShadow = true;
  g.add(base);

  g.userData.bloom = bloom;
  g.userData.glow = glow;
  g.userData.flower = flower;
  return g;
}

export function init(container) {
  // ── Entrance fade ────────────────────────────────────────────────
  container.style.opacity = '0';
  gsap.to(container, { opacity: 1, duration: 1.2, ease: 'power2.out', delay: 0.1 });

  const w = container.clientWidth  || window.innerWidth;
  const h = container.clientHeight || window.innerHeight;

  const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  glowTex = makeGlowTexture();

  // ── Scene + Camera ──────────────────────────────────────────────
  // Encuadre cercano: el planeta B-612 con el Principito ES el héroe.
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(42, w / h, 0.1, 200);
  camera.position.set(0, 0.75, 6.0);

  renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  renderer.setSize(w, h);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setClearColor(0x000000, 0);
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.12;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.domElement.style.cssText = 'position:absolute;inset:0;z-index:1;display:block;';
  container.appendChild(renderer.domElement);

  // Mapa de entorno (PMREM de un cuarto neutro): da reflejos creíbles al
  // cristal y un brillo de satén a los pétalos. Solo lo usan los materiales
  // de la rosa — no altera el planeta ni el Principito.
  const pmrem = new THREE.PMREMGenerator(renderer);
  envTex = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
  pmrem.dispose();

  // ── OrbitControls ───────────────────────────────────────────────
  controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  controls.dampingFactor = 0.06;
  controls.enablePan = false;
  controls.minDistance = 3.4;
  controls.maxDistance = 13;
  controls.target.set(0, 0.45, 0);   // mira al planeta+principito
  controls.autoRotate = !prefersReducedMotion;
  controls.autoRotateSpeed = 0.32;
  renderer.domElement.addEventListener('pointerdown', () => { controls.autoRotate = false; }, { once: true });

  // ── Iluminación cinematográfica ─────────────────────────────────
  // Cielo frío + suelo cálido (rebote), relleno bajo para no lavar sombras.
  scene.add(new THREE.HemisphereLight(0x9DBFD8, 0x3A3320, 0.5));
  scene.add(new THREE.AmbientLight(0x2A3E52, 0.22));

  // Clave dorada y mágica — proyecta sombras suaves sobre el planeta.
  const sun = new THREE.DirectionalLight(0xFFE0AA, 3.0);
  sun.position.set(4.5, 7.5, 5);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  sun.shadow.camera.near = 1;
  sun.shadow.camera.far = 22;
  sun.shadow.camera.left = -3.2;
  sun.shadow.camera.right = 3.2;
  sun.shadow.camera.top = 3.2;
  sun.shadow.camera.bottom = -3.2;
  sun.shadow.bias = -0.0004;
  sun.shadow.normalBias = 0.02;
  sun.shadow.radius = 5;
  scene.add(sun);

  // Contraluz frío que recorta el héroe contra la noche.
  const rimLight = new THREE.DirectionalLight(0x7FB7D8, 1.5);
  rimLight.position.set(-7, 2.5, -6);
  scene.add(rimLight);

  // Niebla suave: el fondo lejano se funde con la noche (profundidad).
  scene.fog = new THREE.Fog(0x0a1a2c, 11, 27);

  // ── Estrellas en dos capas (tamaño/tinte variados) ──────────────
  scene.add(crearCampoEstrellas(1800, 120));
  const farStars = crearCampoEstrellas(900, 90);
  farStars.material.size = 0.09;
  farStars.material.color.set(0xCFE3E6); // tenues, frías
  scene.add(farStars);

  // Destellos de 4 puntas, repartidos por el cielo (como la referencia)
  sparkleTex = makeSparkleTexture();
  const sparkleDefs = [
    [ 6.2, 3.4, -9, 0.95, 0xFBF3E0], [-7.4, 2.2, -8, 0.7, 0xF4D06A],
    [ 8.6, -2.0, -10, 0.6, 0xFBF3E0], [-6.0, -3.2, -7, 0.55, 0xFBF3E0],
    [ 3.0, 4.4, -11, 0.5, 0xF4D06A], [-3.6, 4.0, -9, 0.45, 0xFBF3E0],
    [ 9.2, 1.0, -8, 0.5, 0xFBF3E0], [-9.2, -0.6, -9, 0.6, 0xF4D06A],
    [ 1.5, -4.4, -8, 0.4, 0xFBF3E0], [ 5.0, -3.8, -11, 0.45, 0xFBF3E0],
  ];
  sparkleDefs.forEach(([x, y, z, sc, col]) => {
    const s = makeSparkle(col, sc, 0.9);
    s.position.set(x, y, z);
    scene.add(s);
  });

  // ── Planetas decorativos low-poly (fondo con carácter) ───────────
  const moonPivots = [];

  function lowPolyPlanet(r, color, detail, emissive) {
    return new THREE.Mesh(
      new THREE.IcosahedronGeometry(r, detail),
      new THREE.MeshStandardMaterial({
        color, roughness: 0.9, metalness: 0, flatShading: true,
        emissive: emissive ?? 0x000000, emissiveIntensity: 0.6,
      })
    );
  }

  const planetDefs = [
    { pos: [-6.4, 1.6, -5.5], r: 0.62, color: 0xCDBB8C, detail: 3, ring: true, moon: true }, // Saturno (arena)
    { pos: [7.0, 2.8, -6.5],  r: 0.72, color: 0xD0742E, detail: 3 },                          // gigante naranja
    { pos: [6.6, -1.6, -4.5], r: 0.34, color: 0xB0492C, detail: 2 },                          // Marte rojo
    { pos: [-5.6, -2.9, -3.5],r: 0.44, color: 0xE0913A, detail: 3, emissive: 0x4A2A06 },      // mundo ámbar
    { pos: [3.4, -2.6, 0.4],  r: 0.22, color: 0xACA597, detail: 2, craters: true },           // luna gris craterizada
    { pos: [-3.0, 3.2, -7.5], r: 0.30, color: 0x4E8A90, detail: 3 },                          // mundo teal lejano
  ];
  const planets = planetDefs.map((d) => {
    const m = lowPolyPlanet(d.r, d.color, d.detail, d.emissive);
    m.position.set(...d.pos);

    if (d.craters) {
      for (let i = 0; i < 5; i++) {
        const cr = new THREE.Mesh(
          new THREE.IcosahedronGeometry(d.r * (0.16 + Math.random() * 0.12), 1),
          new THREE.MeshStandardMaterial({ color: 0x807866, roughness: 1, flatShading: true })
        );
        const dir = new THREE.Vector3().randomDirection();
        cr.position.copy(dir.multiplyScalar(d.r * 0.95));
        cr.scale.z = 0.35;
        cr.lookAt(0, 0, 0);
        m.add(cr);
      }
    }
    if (d.ring) {
      const ring = new THREE.Mesh(
        new THREE.RingGeometry(d.r * 1.45, d.r * 2.35, 64),
        new THREE.MeshBasicMaterial({ color: 0xB89F6E, transparent: true, opacity: 0.35, side: THREE.DoubleSide })
      );
      ring.rotation.x = Math.PI * 0.46;
      ring.rotation.y = 0.25;
      m.add(ring);
    }
    if (d.moon) {
      const pivot = new THREE.Object3D();
      const moon = makeRock(d.r * 0.2, 0xCBBE9A, 1);
      moon.position.set(d.r * 2.7, 0, 0);
      pivot.add(moon);
      pivot.rotation.x = 0.4;
      m.add(pivot);
      moonPivots.push(pivot);
    }
    scene.add(m);
    return m;
  });

  // Asteroides grises sueltos (las rocas pequeñas de la referencia)
  const rockDefs = [
    [-4.4, 0.6, -2.2, 0.16], [4.6, 0.9, -2.6, 0.13], [-2.2, -3.2, -1.5, 0.12],
    [2.0, 3.2, -3.5, 0.11], [-7.0, -1.0, -4.5, 0.14], [8.0, -0.2, -5.5, 0.12],
  ];
  const rocks = rockDefs.map(([x, y, z, r]) => {
    const rock = makeRock(r, 0x9E978B, 1);
    rock.position.set(x, y, z);
    rock.rotation.set(Math.random() * 3, Math.random() * 3, Math.random() * 3);
    scene.add(rock);
    return rock;
  });

  // ════════════════════════════════════════════════════════════════
  //  B-612 — el planeta del Principito (el héroe)
  // ════════════════════════════════════════════════════════════════
  const lunaPrincipito = new THREE.Group();
  const R = 1.12; // radio del planeta

  // Coloca un objeto sobre la superficie, orientado según la normal.
  function placeOnSurface(obj, dir, sink = 0.04) {
    const n = dir.clone().normalize();
    obj.position.copy(n.clone().multiplyScalar(R - sink));
    obj.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), n);
  }

  // Planeta REDONDO y suave: alta resolución + relieve de baja amplitud
  // (no rompe la silueta esférica) + biomas por color de vértice.
  const planetGeo = new THREE.IcosahedronGeometry(R, 16);
  const pgPos = planetGeo.attributes.position;
  const pgV = new THREE.Vector3();
  const cLow = new THREE.Color(0x3A6A30), cMid = new THREE.Color(0x5C9B43), cHigh = new THREE.Color(0x8AC25C);
  const pgColors = [];
  for (let i = 0; i < pgPos.count; i++) {
    pgV.fromBufferAttribute(pgPos, i);
    const hgt = 0.045 * Math.sin(pgV.x * 3.6) * Math.cos(pgV.z * 3.6)
              + 0.028 * Math.sin(pgV.y * 5.5 + pgV.x * 2)
              + 0.016 * Math.cos(pgV.z * 9);
    pgV.multiplyScalar(1 + hgt);
    pgPos.setXYZ(i, pgV.x, pgV.y, pgV.z);
    const t = THREE.MathUtils.clamp((hgt + 0.05) / 0.14, 0, 1);
    const col = t < 0.5 ? cLow.clone().lerp(cMid, t / 0.5) : cMid.clone().lerp(cHigh, (t - 0.5) / 0.5);
    pgColors.push(col.r, col.g, col.b);
  }
  planetGeo.setAttribute('color', new THREE.Float32BufferAttribute(pgColors, 3));
  planetGeo.computeVertexNormals();
  const planetMesh = new THREE.Mesh(planetGeo, new THREE.MeshStandardMaterial({
    vertexColors: true, roughness: 0.95, metalness: 0.0, flatShading: false,
  }));
  planetMesh.receiveShadow = true;
  planetMesh.castShadow = true;
  lunaPrincipito.add(planetMesh);

  // Lagunas / charcos: discos oscuros hundidos. Posiciones fijas LEJOS de
  // la rosa (frente-derecha 0.4,0.7,0.55) — nada de cráteres junto al fanal.
  [
    new THREE.Vector3(-0.55, -0.30, 0.45),
    new THREE.Vector3(0.20, -0.60, -0.55),
    new THREE.Vector3(-0.70, 0.15, -0.35),
    new THREE.Vector3(-0.25, -0.45, 0.62),
  ].forEach((dir, i) => {
    const pond = createMesh(new THREE.SphereGeometry(R * (0.13 + (i % 2) * 0.05), 18, 14),
      i % 2 ? 0x2E5A4A : 0x356030, new THREE.Vector3(), { flatShading: false, roughness: 0.6 });
    pond.position.copy(dir.normalize().multiplyScalar(R * 0.99));
    pond.scale.z = 0.16;
    pond.lookAt(0, 0, 0);
    pond.receiveShadow = true;
    lunaPrincipito.add(pond);
  });

  // Atmósfera: halo verde suave en el borde del planeta
  lunaPrincipito.add(makeGlow(0x9FE08A, R * 2.5, 0.1));

  // Vegetación en el hemisferio visible (vistos desde arriba leen como
  // árboles, no como púas en la silueta). Lejos del polo (Principito) y
  // del frente-derecha (rosa).
  [
    new THREE.Vector3(-0.55, 0.6, 0.55),
    new THREE.Vector3(-0.72, 0.32, -0.2), new THREE.Vector3(0.3, 0.5, -0.55),
    new THREE.Vector3(-0.15, 0.45, 0.82),
  ].forEach((d) => {
    const t = makeTree(0.75 + Math.random() * 0.35);
    placeOnSurface(t, d, 0.02);
    lunaPrincipito.add(t);
  });
  [
    new THREE.Vector3(-0.35, 0.72, 0.5),
    new THREE.Vector3(-0.6, 0.4, -0.5),
  ].forEach((d) => {
    const b = makeBush(0.9 + Math.random() * 0.5);
    placeOnSurface(b, d, 0.01);
    lunaPrincipito.add(b);
  });

  // ── El Principito (de pie sobre el polo norte) ──────────────────
  const prince = buildPrince();
  const scarf = prince.userData.scarf;
  const book = prince.userData.book;
  prince.position.y = R - 0.02;
  prince.scale.setScalar(1.18);
  lunaPrincipito.add(prince);

  // ── La rosa bajo su fanal, al frente, junto al Principito ───────
  const rosaGroup = buildRose(envTex);
  const bloom = rosaGroup.userData.bloom;
  const rosaGlow = rosaGroup.userData.glow;
  const rosaFlower = rosaGroup.userData.flower;
  rosaGroup.scale.setScalar(0.95);
  // hundir base negra en superficie → plataforma apoyada, sin flotar
  placeOnSurface(rosaGroup, new THREE.Vector3(0.4, 0.7, 0.55), 0.07);
  lunaPrincipito.add(rosaGroup);

  // Luz cálida que baña la rosa (caída suave, sin proyectar sombra)
  const roseLight = new THREE.PointLight(0xFFB066, 1.8, 3.4, 2);
  roseLight.position.copy(rosaGroup.position).add(new THREE.Vector3(0, 0.45, 0.15));
  lunaPrincipito.add(roseLight);

  // ── Volcanes (el Principito limpia sus volcanes cada mañana) ────
  [
    new THREE.Vector3(0.6, 0.45, 0.7),
    new THREE.Vector3(-0.55, 0.5, -0.5),
  ].forEach((dir, i) => {
    const volcano = new THREE.Group();
    const cone = createMesh(new THREE.CylinderGeometry(0.06, 0.14, 0.18, 16),
      i === 0 ? 0x7A5443 : 0x5F4A44, new THREE.Vector3(0, 0.09, 0), { flatShading: false, roughness: 0.95 });
    cone.castShadow = true;
    volcano.add(cone);
    const mouth = createMesh(new THREE.CylinderGeometry(0.05, 0.058, 0.03, 16), 0xF2A03A,
      new THREE.Vector3(0, 0.18, 0), { flatShading: false, roughness: 0.5, emissive: 0xF2741A, emissiveIntensity: 1.5 });
    volcano.add(mouth);
    const ember = makeGlow(0xFF7A2A, 0.26, 0.7);
    ember.position.y = 0.2;
    volcano.add(ember);
    placeOnSurface(volcano, dir, 0.03);
    lunaPrincipito.add(volcano);
  });

  scene.add(lunaPrincipito);

  // ── Polvo cósmico (stardust) ────────────────────────────────────
  const stardustGeo = new THREE.BufferGeometry();
  const stardustCount = 700;
  const positions = new Float32Array(stardustCount * 3);
  for (let i = 0; i < stardustCount; i++) {
    const r = 2.6 + Math.random() * 6;
    const theta = Math.random() * Math.PI * 2;
    const phi = Math.acos((Math.random() * 2) - 1);
    positions[i * 3]     = r * Math.sin(phi) * Math.cos(theta);
    positions[i * 3 + 1] = r * Math.sin(phi) * Math.sin(theta);
    positions[i * 3 + 2] = r * Math.cos(phi);
  }
  stardustGeo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  const stardust = new THREE.Points(stardustGeo, new THREE.PointsMaterial({
    color: 0xF4D06A, size: 0.045, transparent: true, opacity: 0.55, blending: THREE.AdditiveBlending,
    depthWrite: false,
  }));
  scene.add(stardust);

  // ── Animations ──────────────────────────────────────────────────
  if (!prefersReducedMotion) {
    activeTweens.push(
      gsap.to(bloom.scale, { x: 1.06, y: 1.06, z: 1.06, duration: 3, repeat: -1, yoyo: true, ease: 'sine.inOut' }),
      gsap.to(rosaGlow.material, { opacity: 0.75, duration: 2.4, repeat: -1, yoyo: true, ease: 'sine.inOut' })
    );
    // Cinematic pull-in en la entrada (un solo momento orquestado)
    controls.autoRotate = false;
    gsap.fromTo(camera.position,
      { x: 0, y: 1.4, z: 8.6 },
      { x: 0, y: 0.75, z: 6.0, duration: 2.4, ease: 'power2.out',
        onComplete: () => { controls.autoRotate = true; } }
    );
    if ('ontouchstart' in window) {
      activeTweens.push(
        gsap.to(book.scale, { x: 1.12, y: 1.12, z: 1.12, duration: 1.3, repeat: -1, yoyo: true, ease: 'sine.inOut' })
      );
    }
  }

  // ── Render loop ─────────────────────────────────────────────────
  function animate() {
    rafId = requestAnimationFrame(animate);
    controls.update();
    planets.forEach((p, i) => { p.rotation.y += 0.0025 + i * 0.0008; });
    moonPivots.forEach((pv, i) => { pv.rotation.y += 0.01 + i * 0.004; });
    rocks.forEach((rk, i) => { rk.rotation.y += 0.002 + i * 0.0006; rk.rotation.x += 0.0012; });
    stardust.rotation.y += 0.0008;
    stardust.rotation.z += 0.0004;

    // bufanda al viento
    const t = Date.now() * 0.0025;
    scarf.rotation.z = Math.sin(t) * 0.12;
    scarf.rotation.y = Math.cos(t * 0.8) * 0.08;

    // la rosa: giro lento de la corola + vaivén del tallo (brisa)
    if (!prefersReducedMotion) {
      bloom.rotation.y += 0.0035;
      const tr = Date.now() * 0.0011;
      rosaFlower.rotation.z = Math.sin(tr) * 0.045;
      rosaFlower.rotation.x = Math.cos(tr * 0.8) * 0.03;
    }

    renderer.render(scene, camera);
  }
  animate();

  // ── Interaction hint ─────────────────────────────────────────────
  const hint = document.createElement('div');
  hint.className = 'solar-hint';
  hint.setAttribute('aria-hidden', 'true');
  hint.innerHTML = `
    <span class="solar-hint__icon">✦</span>
    <span class="solar-hint__text">Toca al Principito para comenzar</span>
  `;
  container.appendChild(hint);
  gsap.fromTo(hint,
    { opacity: 0, y: 12 },
    { opacity: 1, y: 0, duration: 0.9, ease: 'power2.out', delay: 2.6 }
  );
  gsap.to(hint, { opacity: 0, duration: 1, ease: 'power2.in', delay: 8 });
  renderer.domElement.addEventListener('pointerdown', () => {
    gsap.to(hint, { opacity: 0, duration: 0.4 });
  }, { once: true });

  // ── Resize ──────────────────────────────────────────────────────
  resizeHandler = () => {
    const w = container.clientWidth  || window.innerWidth;
    const h = container.clientHeight || window.innerHeight;
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    renderer.setSize(w, h);
  };
  window.addEventListener('resize', resizeHandler);

  // ── Raycasting / Pointer events ─────────────────────────────────
  let downX = 0, downY = 0;

  renderer.domElement.addEventListener('pointerdown', (e) => {
    downX = e.clientX;
    downY = e.clientY;
  });

  renderer.domElement.addEventListener('pointerup', (e) => {
    if (Math.abs(e.clientX - downX) > 5 || Math.abs(e.clientY - downY) > 5) return;

    const rect = renderer.domElement.getBoundingClientRect();
    pointerNDC.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
    pointerNDC.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
    raycaster.setFromCamera(pointerNDC, camera);

    if (raycaster.intersectObject(lunaPrincipito, true).length > 0) {
      showConfirmPanel(container);
    }
  });

  // Desktop hover — throttled
  if (!('ontouchstart' in window)) {
    let hoverTimer = null;
    renderer.domElement.addEventListener('pointermove', (e) => {
      if (hoverTimer) return;
      hoverTimer = setTimeout(() => { hoverTimer = null; }, 50);

      const rect = renderer.domElement.getBoundingClientRect();
      pointerNDC.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      pointerNDC.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
      raycaster.setFromCamera(pointerNDC, camera);

      renderer.domElement.style.cursor =
        raycaster.intersectObject(lunaPrincipito, true).length > 0 ? 'pointer' : 'grab';
    });
  }

  // ── Screen-reader fallback button ────────────────────────────────
  const srBtn = document.createElement('button');
  srBtn.textContent = 'Ir a la historia del Principito';
  srBtn.className = 'sr-only';
  srBtn.addEventListener('click', () => showConfirmPanel(container));
  container.appendChild(srBtn);
}


// ── Confirm panel ────────────────────────────────────────────────────
function showConfirmPanel(container) {
  if (container.querySelector('.confirm-panel')) return;

  const panel = document.createElement('div');
  panel.className = 'confirm-panel';
  panel.innerHTML = `
    <p class="confirm-text">¿Listo para escuchar la historia?</p>
    <div class="confirm-actions">
      <button class="confirm-yes" type="button">Comenzar</button>
      <button class="confirm-no" type="button">Seguir explorando</button>
    </div>
  `;
  container.appendChild(panel);
  gsap.fromTo(panel, { opacity: 0, y: 24 }, { opacity: 1, y: 0, duration: 0.4, ease: 'power2.out' });

  panel.querySelector('.confirm-yes').addEventListener('click', () => {
    gsap.to(panel, {
      opacity: 0, duration: 0.3,
      onComplete: () => {
        gsap.to(container, {
          opacity: 0, duration: 0.6, ease: 'power2.inOut',
          onComplete: () => goToStory(),
        });
      },
    });
  });

  panel.querySelector('.confirm-no').addEventListener('click', () => {
    gsap.to(panel, { opacity: 0, duration: 0.3, onComplete: () => panel.remove() });
  });
}

// ── Dispose ─────────────────────────────────────────────────────────
export function dispose() {
  if (rafId !== null) {
    cancelAnimationFrame(rafId);
    rafId = null;
  }
  activeTweens.forEach(t => t.kill());
  activeTweens = [];

  if (resizeHandler) {
    window.removeEventListener('resize', resizeHandler);
    resizeHandler = null;
  }
  if (controls) {
    controls.dispose();
    controls = null;
  }
  if (glowTex) {
    glowTex.dispose();
    glowTex = null;
  }
  if (sparkleTex) {
    sparkleTex.dispose();
    sparkleTex = null;
  }
  if (envTex) {
    envTex.dispose();
    envTex = null;
  }
  if (renderer) {
    renderer.domElement.parentElement?.removeChild(renderer.domElement);
    renderer.dispose();
    renderer = null;
  }
}
