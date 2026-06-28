// Generador de trigal cinematográfico (2D, SVG) — usado por las escenas 5 y 6.
//
// Antes el campo era una sola fila de espigas estiradas con
// preserveAspectRatio="none" (se aplastaban a "rayas con bolitas"). Ahora:
//  · espiga realista (tallo curvo + cabeza de granos plenos + barbas) con
//    3 variantes de silueta;
//  · sin deformación: cada capa escala uniforme (xMidYMax slice);
//  · cada espiga es un grupo .espiga meneable por el viento (origen en la base)
//    y, a la vez, la unidad de color que enciende la "ola dorada" de la escena 6.
//
// CONTRATO preservado: crearCampoDeTrigo(contenedor, cantidad, color) sigue
// devolviendo el array de elementos .espiga cuyo fill/stroke anima la ola.

const NS = 'http://www.w3.org/2000/svg';

// Grano de trigo: almendra de punta inferior y cima redondeada, longitud L.
// Apunta hacia arriba (de 0,0 a 0,-L); luego se rota/traslada sobre la espiga.
function unitGrain(L, w) {
  const b = (-L * 0.35).toFixed(2);
  const d = (-L).toFixed(2);
  const c = (w * 0.42).toFixed(2);
  const nc = (-w * 0.42).toFixed(2);
  const nw = (-w).toFixed(2);
  const pw = w.toFixed(2);
  return `M0 0C${pw} ${b} ${c} ${d} 0 ${d}C${nc} ${d} ${nw} ${b} 0 0Z`;
}

// Siluetas: joven erguida / madura vencida / media. droop = inclinación de la
// cabeza; lean = desvío del tallo; plump = grosor del grano.
const VARIANTES = [
  { stemFrac: 0.50, lean: 0,  droop: -3, grainPairs: 7, plump: 1.00, awnLen: 0.34, awnFan: 9 },
  { stemFrac: 0.42, lean: 4,  droop: 11, grainPairs: 8, plump: 1.16, awnLen: 0.24, awnFan: 12 },
  { stemFrac: 0.46, lean: -3, droop: -9, grainPairs: 7, plump: 1.08, awnLen: 0.30, awnFan: 10 },
];

// Dibuja una espiga completa en coordenadas locales (base en 0,0, crece hacia -y).
// data-cx guarda su x mundial para poder ordenar la ola de izquierda a derecha.
function espigaMarkup(height, color, variant, cx) {
  const stemH = height * variant.stemFrac;
  const headH = height - stemH;

  const P0 = [variant.lean, -stemH];
  const P1 = [variant.lean + variant.droop * 0.4, -stemH - headH * 0.5];
  const P2 = [variant.lean + variant.droop, -stemH - headH];

  const quad = (t) => {
    const u = 1 - t;
    return [
      u * u * P0[0] + 2 * u * t * P1[0] + t * t * P2[0],
      u * u * P0[1] + 2 * u * t * P1[1] + t * t * P2[1],
    ];
  };

  const tiltDeg = ((P2[0] - P0[0]) / headH) * 38;
  const pairs = variant.grainPairs;
  let grains = '';
  for (let i = 0; i < pairs; i++) {
    const t = (i + 0.55) / pairs;
    const [px, py] = quad(t);
    const L = (headH / pairs) * 1.9 * (1 - 0.4 * t) * variant.plump;
    const w = L * 0.34;
    const spread = 24 - 13 * t;
    const op = (0.84 + 0.16 * (1 - t)).toFixed(2);
    const at = `translate(${px.toFixed(1)} ${py.toFixed(1)})`;
    grains += `<path d="${unitGrain(L, w)}" transform="${at} rotate(${(-spread + tiltDeg).toFixed(1)})" opacity="${op}"/>`;
    grains += `<path d="${unitGrain(L, w)}" transform="${at} rotate(${(spread + tiltDeg).toFixed(1)})" opacity="${op}"/>`;
  }
  // Grano terminal en la punta.
  const tg = (headH / pairs) * 1.7 * variant.plump;
  grains += `<path d="${unitGrain(tg, tg * 0.32)}" transform="translate(${P2[0].toFixed(1)} ${P2[1].toFixed(1)}) rotate(${tiltDeg.toFixed(1)})"/>`;

  // Barbas (awns): abanico fino desde la punta hacia arriba.
  const al = variant.awnLen * height;
  const awnW = (height * 0.006).toFixed(2);
  let awns = '';
  for (let k = -2; k <= 2; k++) {
    const ang = ((tiltDeg + k * variant.awnFan) * Math.PI) / 180;
    const ex = (P2[0] + Math.sin(ang) * al).toFixed(1);
    const ey = (P2[1] - Math.cos(ang) * al).toFixed(1);
    awns += `<line x1="${P2[0].toFixed(1)}" y1="${P2[1].toFixed(1)}" x2="${ex}" y2="${ey}"/>`;
  }

  const stemW = Math.max(1, height * 0.016).toFixed(2);
  const stem = `<path d="M0 0Q${(P0[0] * 0.6).toFixed(1)} ${(-stemH * 0.5).toFixed(1)} ${P0[0].toFixed(1)} ${(-stemH).toFixed(1)}" fill="none" stroke-width="${stemW}"/>`;

  return `<g class="espiga" data-cx="${Math.round(cx)}" fill="${color}" stroke="${color}" stroke-linecap="round">
    ${stem}
    <g stroke-width="${awnW}">${awns}</g>
    <g stroke="none">${grains}</g>
  </g>`;
}

// Construye UNA capa de trigo dentro de `contenedor` (un <svg> que cubre el div).
// Devuelve el array de elementos .espiga de esa capa.
export function crearCapaTrigo(contenedor, opts = {}) {
  const {
    cantidad = 40,
    color = '#B2A878',
    baseHeightFrac = 0.62, // alto de espiga relativo al alto de la capa
    heightJitter = 0.32,
    rotJitter = 6,
  } = opts;

  const W = contenedor.clientWidth || 800;
  const H = contenedor.clientHeight || 240;

  const svg = document.createElementNS(NS, 'svg');
  svg.setAttribute('viewBox', `0 0 ${W} ${H}`);
  // slice + anclaje inferior: escala uniforme (sin aplastar) y enraizada abajo.
  svg.setAttribute('preserveAspectRatio', 'xMidYMax slice');
  svg.setAttribute('aria-hidden', 'true');
  svg.style.width = '100%';
  svg.style.height = '100%';
  svg.style.display = 'block';

  const baseH = H * baseHeightFrac;
  let markup = '';
  for (let i = 0; i < cantidad; i++) {
    const cx = ((i + 0.5) / cantidad) * W + (Math.random() - 0.5) * (W / cantidad) * 0.7;
    const h = baseH * (1 - heightJitter / 2 + Math.random() * heightJitter);
    const variant = { ...VARIANTES[(Math.random() * VARIANTES.length) | 0] };
    if (Math.random() < 0.5) { variant.droop *= -1; variant.lean *= -1; }
    const rot = (Math.random() - 0.5) * rotJitter;
    markup += `<g transform="translate(${cx.toFixed(1)} ${H + 4}) rotate(${rot.toFixed(1)})">${espigaMarkup(h, color, variant, cx)}</g>`;
  }
  svg.innerHTML = markup;
  contenedor.appendChild(svg);

  return Array.from(svg.querySelectorAll('.espiga'));
}

// Wrapper compatible con la firma histórica (lo usan las escenas 5 y 6).
export function crearCampoDeTrigo(contenedor, cantidadEspigas = 42, color = '#C7B179') {
  return crearCapaTrigo(contenedor, { cantidad: cantidadEspigas, color, baseHeightFrac: 0.7 });
}
