import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { splitChars } from '../utils/splitText.js';
import { revealOnScroll } from '../utils/scrollReveal.js';
import { crearCapaTrigo } from '../utils/wheatField.js';
import {
  initAudio, reproducirNarracion, reproducirNarracionConDebounce,
  cancelarDebounce, unlockAudioContext, crossfadeMusica, subirMusica,
  NARRACION, MUSICA, VOLUMEN,
} from '../utils/audioManager.js';

gsap.registerPlugin(ScrollTrigger);

const rm = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;

// ── SVG helpers ───────────────────────────────────────────────

// Destello de 4 puntas (rombo de lados cóncavos) — eco de los ✦ del Acto 2.
function estrellaPunta(cx, cy, r, color, op, filtro) {
  const k = (r * 0.3).toFixed(2);
  const a = cx.toFixed(2), b = cy.toFixed(2);
  const d =
    `M${a} ${(cy - r).toFixed(2)} Q${(cx + +k).toFixed(2)} ${(cy - +k).toFixed(2)} ${(cx + r).toFixed(2)} ${b}` +
    ` Q${(cx + +k).toFixed(2)} ${(cy + +k).toFixed(2)} ${a} ${(cy + r).toFixed(2)}` +
    ` Q${(cx - +k).toFixed(2)} ${(cy + +k).toFixed(2)} ${(cx - r).toFixed(2)} ${b}` +
    ` Q${(cx - +k).toFixed(2)} ${(cy - +k).toFixed(2)} ${a} ${(cy - r).toFixed(2)} Z`;
  return `<path d="${d}" fill="${color}" opacity="${op}" filter="url(#${filtro})"/>`;
}

function estrellasSVG(count = 80) {
  // Temperatura de color variada: la mayoría crema, unas frías (azuladas)
  // y unas pocas cálidas (oro) — antes todas eran #FBF3E0 idénticas.
  const palette = ['#FBF3E0', '#FBF3E0', '#FBF3E0', '#FFF8E7', '#F4D06A', '#E7B24C', '#CFE3E6'];
  const uid = 'sg' + Math.random().toString(36).slice(2, 7);
  let stars = '';
  for (let i = 0; i < count; i++) {
    const x = +(Math.random() * 100).toFixed(2);
    const y = +(Math.random() * 100).toFixed(2);
    const color = palette[(Math.random() * palette.length) | 0];
    if (Math.random() < 0.08) {
      // ~8% son destellos de 4 puntas con halo
      const r = 1.1 + Math.random() * 1.5;
      const op = (0.55 + Math.random() * 0.4).toFixed(2);
      stars += estrellaPunta(x, y, r, color, op, uid);
    } else {
      const r = (0.4 + Math.random() * 1.1).toFixed(2);
      const op = (0.35 + Math.random() * 0.6).toFixed(2);
      stars += `<circle cx="${x}" cy="${y}" r="${r}" fill="${color}" opacity="${op}"/>`;
    }
  }
  return `<svg class="stars-bg" viewBox="0 0 100 100" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
    <defs>
      <filter id="${uid}" x="-300%" y="-300%" width="700%" height="700%">
        <feGaussianBlur stdDeviation="0.45" result="b"/>
        <feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge>
      </filter>
    </defs>${stars}</svg>`;
}

function principitoSVG(clases = '') {
  return `<svg class="principito-2d ${clases}" viewBox="0 0 60 110" aria-hidden="true">
    <defs>
      <linearGradient id="cape" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0%" stop-color="#2C5660"/>
        <stop offset="100%" stop-color="#0B1A20"/>
      </linearGradient>
      <radialGradient id="face" cx="50%" cy="50%" r="50%">
        <stop offset="60%" stop-color="#FAD6A5"/>
        <stop offset="100%" stop-color="#E8A87C"/>
      </radialGradient>
      <linearGradient id="hair" x1="0" y1="0" x2="1" y2="0">
        <stop offset="0%" stop-color="#F4D068"/>
        <stop offset="50%" stop-color="#F2A65A"/>
        <stop offset="100%" stop-color="#D9A05B"/>
      </linearGradient>
      <linearGradient id="scarf" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0%" stop-color="#E7B24C"/>
        <stop offset="100%" stop-color="#C8923A"/>
      </linearGradient>
    </defs>
    <!-- Capa: tela que cae y se abre en el dobladillo (antes un trapecio rígido) -->
    <path d="M22 64 C16 76 12 90 9 104 Q15 109 22 105 Q30 110 38 105 Q45 109 51 104
             C48 90 44 76 38 64 C33 67 27 67 22 64 Z" fill="url(#cape)"/>
    <!-- Lado en sombra -->
    <path d="M22 64 C17 76 13 90 10.5 103 Q16 107 22 104 C23 90 24 76 25.5 65
             C24 65 23 64.6 22 64 Z" fill="#16323A" opacity="0.55"/>
    <!-- Pliegues -->
    <path d="M30 67 C30 80 30 92 30 105" fill="none" stroke="#0B1A20" stroke-width="0.7" opacity="0.4"/>
    <path d="M37 68 C39 82 41 93 44 104" fill="none" stroke="#0B1A20" stroke-width="0.6" opacity="0.3"/>
    <!-- Head -->
    <circle cx="30" cy="50" r="14" fill="url(#face)"/>
    <!-- Hair (wavy top) -->
    <path d="M15 46 Q22 30 30 36 Q38 30 45 46" fill="url(#hair)"/>
    <path d="M17 48 Q22 34 30 40 Q38 34 43 48" fill="#F4D068" opacity="0.6"/>
    <!-- Eyes -->
    <circle cx="25" cy="50" r="2.5" fill="#0A1128"/>
    <circle cx="35" cy="50" r="2.5" fill="#0A1128"/>
    <circle cx="26" cy="49" r="1" fill="#FFF8E7"/>
    <circle cx="36" cy="49" r="1" fill="#FFF8E7"/>
    <!-- Scarf -->
    <ellipse cx="30" cy="64" rx="11" ry="5" fill="url(#scarf)"/>
    <path d="M40 64 Q46 68 44 76 Q38 72 40 64" fill="url(#scarf)"/>
    <!-- Brazo del abrigo que baja a sostener el libro -->
    <path d="M27 69 C20 71 15 76 13 82 C16 84 20 83 23 79 C25 75 28 73 31 72 Z" fill="url(#cape)"/>
    <!-- Libro sostenido (papel crema, no blanco puro; con páginas) -->
    <g transform="rotate(-12 15 82)">
      <rect x="8.5" y="74" width="13" height="16" rx="1.2" fill="#FBF3E0" stroke="#C9B88A" stroke-width="0.6"/>
      <line x1="15" y1="74" x2="15" y2="90" stroke="#C9B88A" stroke-width="0.9"/>
      <line x1="10.5" y1="78.5" x2="13.5" y2="78.5" stroke="#D9C9A0" stroke-width="0.5"/>
      <line x1="10.5" y1="81.5" x2="13.5" y2="81.5" stroke="#D9C9A0" stroke-width="0.5"/>
    </g>
    <!-- Mano -->
    <circle cx="13" cy="80.5" r="2.6" fill="url(#face)"/>
  </svg>`;
}

function rosaSVG() {
  // Paleta "Petróleo y Trigo": la rosa es terracota de acuarela vieja
  // (no rojo web), tallo y hojas en el verde-pino del campo (no oliva).
  return `<svg class="rosa-svg" viewBox="0 0 120 200" aria-hidden="true">
    <defs>
      <linearGradient id="stem" x1="0" y1="0" x2="1" y2="0">
        <stop offset="0%" stop-color="#21413A"/>
        <stop offset="55%" stop-color="#3C6B4E"/>
        <stop offset="100%" stop-color="#5E8A5A"/>
      </linearGradient>
      <radialGradient id="rose" cx="42%" cy="30%" r="70%">
        <stop offset="0%" stop-color="#EBA877"/>
        <stop offset="42%" stop-color="#D0654A"/>
        <stop offset="100%" stop-color="#9C3F2C"/>
      </radialGradient>
      <radialGradient id="roseCore" cx="50%" cy="42%" r="60%">
        <stop offset="0%" stop-color="#B84A33"/>
        <stop offset="100%" stop-color="#7E2F20"/>
      </radialGradient>
      <linearGradient id="glass" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0%" stop-color="rgba(251,243,224,0.34)"/>
        <stop offset="50%" stop-color="rgba(251,243,224,0.04)"/>
        <stop offset="100%" stop-color="rgba(244,208,104,0.18)"/>
      </linearGradient>
    </defs>
    <!-- Tallo -->
    <line x1="60" y1="196" x2="60" y2="112" stroke="url(#stem)" stroke-width="4.2" stroke-linecap="round"/>
    <!-- Hojas (verde-pino del campo) -->
    <path d="M60 156 Q40 150 35 134 Q49 138 60 156 Z" fill="url(#stem)"/>
    <path d="M60 168 Q80 162 85 146 Q71 150 60 168 Z" fill="url(#stem)"/>
    <!-- Sépalos -->
    <path d="M60 114 Q52 108 50 98 Q58 104 60 114 Z" fill="#3C6B4E"/>
    <path d="M60 114 Q68 108 70 98 Q62 104 60 114 Z" fill="#3C6B4E"/>
    <!-- Pétalos exteriores (espiral de acuarela terracota) -->
    <ellipse cx="60" cy="96" rx="22" ry="15" fill="url(#rose)" transform="rotate(-22 60 96)"/>
    <ellipse cx="61" cy="92" rx="20" ry="13" fill="url(#rose)" transform="rotate(28 61 92)"/>
    <ellipse cx="59" cy="100" rx="18" ry="11" fill="url(#rose)" transform="rotate(-52 59 100)"/>
    <ellipse cx="62" cy="98" rx="16" ry="10" fill="url(#rose)" transform="rotate(64 62 98)"/>
    <!-- Corazón en espiral -->
    <ellipse cx="60" cy="93" rx="13" ry="9" fill="url(#roseCore)" transform="rotate(-14 60 93)"/>
    <path d="M53 90 Q60 84 67 90 Q63 96 60 95 Q57 96 53 90 Z" fill="#C9573C"/>
    <path d="M56 92 Q60 88 64 92 Q60 97 56 92 Z" fill="#9C3F2C"/>
    <!-- Brillo tenue (luz cálida) -->
    <ellipse cx="53" cy="86" rx="5" ry="3.4" fill="#F0C49C" opacity="0.55" transform="rotate(-22 53 86)"/>
    <!-- Fanal de cristal -->
    <path d="M22 190 Q22 52 60 42 Q98 52 98 190" fill="url(#glass)"
      stroke="rgba(244,208,104,0.45)" stroke-width="1.4"/>
    <path d="M27 184 Q27 60 60 47" fill="none" stroke="rgba(251,243,224,0.38)" stroke-width="2" stroke-linecap="round"/>
    <circle cx="60" cy="40" r="3.4" fill="rgba(244,208,104,0.6)"/>
    <line x1="22" y1="190" x2="98" y2="190" stroke="rgba(244,208,104,0.45)" stroke-width="2.4" stroke-linecap="round"/>
  </svg>`;
}

// Zorro ilustrado plano y cálido (estilo de la referencia): cara clásica con
// máscara naranja, mejillas y hocico claros, orejas grandes con interior oscuro,
// ojos pequeños y serenos. Pensado para ASOMAR entre el trigo (el pecho que
// cuelga abajo queda oculto tras las espigas, así no parece una cabeza flotando).
// `p` = prefijo único de gradientes (fp/ff) para que convivan las 2 instancias.
function foxHeadSVG(p, clase = '') {
  return `<svg class="fox-svg ${clase}" viewBox="0 0 200 256" aria-hidden="true">
    <defs>
      <linearGradient id="${p}Fur" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stop-color="#F09A4A"/><stop offset="1" stop-color="#D9722F"/>
      </linearGradient>
      <linearGradient id="${p}Ear" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stop-color="#ED9344"/><stop offset="1" stop-color="#C75F2A"/>
      </linearGradient>
      <linearGradient id="${p}Cream" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stop-color="#FCF5E6"/><stop offset="1" stop-color="#EBDABA"/>
      </linearGradient>
    </defs>
    <g class="fox-breath">
      <!-- Pecho claro que asoma (el trigo lo cubre por abajo) -->
      <path d="M100 184 C76 188 64 208 66 232 C68 250 86 256 100 256
               C114 256 132 250 134 232 C136 208 124 188 100 184 Z" fill="url(#${p}Cream)"/>

      <!-- Orejas: grandes, separadas, apuntando arriba y un poco hacia fuera -->
      <g class="fox-ear-l">
        <path d="M58 80 L48 12 L96 64 Z" fill="url(#${p}Ear)"/>
        <path d="M62 74 L56 30 L88 62 Z" fill="#7A2E18"/>
        <path d="M64 69 L60 41 L82 60 Z" fill="url(#${p}Cream)" opacity=".62"/>
      </g>
      <g class="fox-ear-r">
        <path d="M142 80 L152 12 L104 64 Z" fill="url(#${p}Ear)"/>
        <path d="M138 74 L144 30 L112 62 Z" fill="#7A2E18"/>
        <path d="M136 69 L140 41 L118 60 Z" fill="url(#${p}Cream)" opacity=".62"/>
      </g>

      <!-- Cara: base clara (mejillas + hocico), más ancha que la máscara -->
      <path d="M100 78 C66 78 44 96 42 126 C40 150 54 178 78 194
               C88 199 100 202 100 202 C100 202 112 199 122 194
               C146 178 160 150 158 126 C156 96 134 78 100 78 Z" fill="url(#${p}Cream)"/>

      <!-- Máscara naranja: frente + caballete hasta la nariz -->
      <path d="M100 66 C72 66 50 84 50 112 C50 126 60 132 74 130
               C84 129 90 138 94 150 C96 156 98 160 100 164
               C102 160 104 156 106 150 C110 138 116 129 126 130
               C140 132 150 126 150 112 C150 84 128 66 100 66 Z" fill="url(#${p}Fur)"/>

      <!-- Ojos pequeños y serenos (como la referencia) -->
      <g class="fox-eyes">
        <path d="M66 123 C70 117 80 117 84 124 C80 129 70 129 66 123 Z" fill="#241410"/>
        <path d="M134 123 C130 117 120 117 116 124 C120 129 130 129 134 123 Z" fill="#241410"/>
        <circle cx="78" cy="121.4" r="1.3" fill="#FBE8C0" opacity=".85"/>
        <circle cx="122" cy="121.4" r="1.3" fill="#FBE8C0" opacity=".85"/>
      </g>

      <!-- Nariz -->
      <path d="M100 152 C92 152 86 158 90 164 C94 169 100 171 100 171
               C100 171 106 169 110 164 C114 158 108 152 100 152 Z" fill="#2A1A12"/>
      <ellipse cx="96.5" cy="157" rx="1.6" ry="1.1" fill="#6E5847" opacity=".6"/>
    </g>
  </svg>`;
}

// Zorro asomado (escena 5) y zorro de la escena 6 — el MISMO diseño ilustrado,
// solo cambia el prefijo de gradientes y la clase (el tamaño/posición van en CSS).
function foxPeekSVG() {
  return foxHeadSVG('fp', 'fox-peek');
}

function foxFullSVG() {
  return foxHeadSVG('ff', 'fox-full');
}

function principitoSentadoSVG(clases = '') {
  // Principito sentado mirando a la derecha (hacia el zorro), para la escena 6.
  // Reusa el lenguaje del principitoSVG: abrigo petróleo, pelo dorado, bufanda.
  return `<svg class="principito-2d principito-sentado ${clases}" viewBox="0 0 150 180" aria-hidden="true">
    <defs>
      <linearGradient id="psCoat" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0" stop-color="#2C5660"/><stop offset="1" stop-color="#0B1A20"/>
      </linearGradient>
      <radialGradient id="psFace" cx="50%" cy="48%" r="55%">
        <stop offset="60%" stop-color="#FAD6A5"/><stop offset="100%" stop-color="#E8A87C"/>
      </radialGradient>
      <linearGradient id="psHair" x1="0" y1="0" x2="1" y2="0">
        <stop offset="0" stop-color="#F4D068"/><stop offset="0.5" stop-color="#F2A65A"/><stop offset="1" stop-color="#D9A05B"/>
      </linearGradient>
      <linearGradient id="psScarf" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0" stop-color="#E7B24C"/><stop offset="1" stop-color="#C8923A"/>
      </linearGradient>
    </defs>
    <!-- piernas sentadas (pantalón verde-pino del campo) -->
    <path d="M58 150 C70 142 98 142 118 150 C122 158 120 167 110 169 C92 165 74 165 58 169 C52 162 54 154 58 150 Z" fill="#3C6B4E"/>
    <ellipse cx="113" cy="161" rx="10" ry="6" fill="#21413A"/>
    <!-- abrigo (torso sentado) -->
    <path d="M58 96 C49 110 45 132 52 151 C70 143 98 143 118 151 C122 132 117 110 104 98 C90 89 70 88 58 96 Z" fill="url(#psCoat)"/>
    <path d="M58 96 C52 112 50 132 55 149 C59 132 61 112 67 100 C63 98 60 97 58 96 Z" fill="#16323A" opacity=".5"/>
    <!-- brazo que se apoya hacia el zorro -->
    <path d="M100 104 C113 106 121 117 120 129 C115 132 109 130 105 124 C102 117 99 112 95 110 Z" fill="url(#psCoat)"/>
    <circle cx="119" cy="129" r="5" fill="url(#psFace)"/>
    <!-- bufanda al viento -->
    <ellipse cx="80" cy="92" rx="15" ry="6" fill="url(#psScarf)"/>
    <path d="M66 92 C57 100 55 113 60 123 C66 113 69 100 73 94 Z" fill="url(#psScarf)"/>
    <!-- cabeza (mira a la derecha) -->
    <circle cx="82" cy="64" r="20" fill="url(#psFace)"/>
    <!-- pelo dorado -->
    <path d="M62 62 C64 40 80 34 92 42 C103 36 111 49 108 63 C100 53 92 51 86 55 C78 49 68 52 62 62 Z" fill="url(#psHair)"/>
    <path d="M64 60 C68 46 80 42 90 48 C84 46 76 48 70 56 Z" fill="#F4D068" opacity=".55"/>
    <!-- cara: mirada hacia el zorro + sonrisa -->
    <circle cx="86" cy="64" r="2.4" fill="#0A1128"/>
    <circle cx="95" cy="64" r="2.4" fill="#0A1128"/>
    <circle cx="86.8" cy="63" r="0.9" fill="#FFF8E7"/>
    <circle cx="95.8" cy="63" r="0.9" fill="#FFF8E7"/>
    <path d="M85 72 C89 76 95 76 99 72" fill="none" stroke="#C8794F" stroke-width="1.4" stroke-linecap="round"/>
    <ellipse cx="79" cy="71" rx="3" ry="2" fill="#E8A87C" opacity=".5"/>
  </svg>`;
}

function dunesSVG() {
  return `<svg class="dunes-svg" viewBox="0 0 800 300" preserveAspectRatio="none"
    aria-hidden="true">
    <defs>
      <linearGradient id="dune-bg" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stop-color="#28505A"/>
        <stop offset="100%" stop-color="#0B1A20"/>
      </linearGradient>
      <linearGradient id="dune-fg" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stop-color="#CE9A56"/>
        <stop offset="100%" stop-color="#B85A3D"/>
      </linearGradient>
      <linearGradient id="planeBody" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stop-color="#EA4E3E"/>
        <stop offset="100%" stop-color="#A41F14"/>
      </linearGradient>
      <linearGradient id="planeWing" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stop-color="#D63A2C"/>
        <stop offset="100%" stop-color="#7E160F"/>
      </linearGradient>
    </defs>
    <!-- Back dune -->
    <path class="dune-back"
      d="M0 300 L0 180 Q100 130 200 160 Q350 200 500 150 Q650 100 800 140 L800 300 Z"
      fill="url(#dune-bg)" opacity="0.8"/>
    <!-- Sombra del avión sobre la arena (queda en el suelo mientras el
         avión aterriza; crece con el scroll). -->
    <ellipse class="airplane-shadow" cx="547" cy="192" rx="60" ry="8" fill="#071217" opacity="0.32"/>
    <!-- Biplano rojo del piloto. El grupo EXTERIOR (.airplane) lo anima GSAP
         (aterrizaje); el INTERIOR (.airplane-place) fija posición/escala.
         Partes legibles: perfiles de ala + montantes + capó + hélice. -->
    <g class="airplane">
      <g class="airplane-place" transform="translate(547 152) rotate(-5) scale(1.34)">
        <!-- COLA: deriva + estabilizador, con estrella dorada del Principito -->
        <path d="M-46 -2 L-61 -24 L-43 -7 Z" fill="url(#planeWing)" stroke="#5E120C" stroke-width="1"/>
        <path d="M-46 3 L-63 5 L-43 8 Z" fill="#9E1E13" stroke="#5E120C" stroke-width="1"/>
        <path d="M-51 -15.2 Q-50.04 -12.96 -47.8 -12 Q-50.04 -11.04 -51 -8.8 Q-51.96 -11.04 -54.2 -12 Q-51.96 -12.96 -51 -15.2 Z" fill="#F4D06A"/>
        <!-- ALA INFERIOR (perfil aerodinámico) -->
        <path d="M-34 13 C-12 10 22 10 37 13 C22 16.5 -12 16.5 -34 14 Z" fill="url(#planeWing)" stroke="#5E120C" stroke-width="1"/>
        <path d="M-34 13 C-12 10 22 10 37 13" fill="none" stroke="#FBF3E0" stroke-width="1" opacity="0.45"/>
        <!-- TREN DE ATERRIZAJE + RUEDAS -->
        <path d="M-6 13 L-12 31 M-6 13 L1 31" stroke="#3A0E0A" stroke-width="2.6" fill="none" stroke-linecap="round"/>
        <path d="M16 13 L11 31 M16 13 L23 31" stroke="#3A0E0A" stroke-width="2.6" fill="none" stroke-linecap="round"/>
        <line x1="-12" y1="32" x2="23" y2="32" stroke="#2A0A07" stroke-width="2"/>
        <circle cx="-12" cy="32" r="7" fill="#15151A" stroke="#CDBF9E" stroke-width="2.2"/>
        <circle cx="23" cy="32" r="7" fill="#15151A" stroke="#CDBF9E" stroke-width="2.2"/>
        <circle cx="-12" cy="32" r="2" fill="#E7B24C"/>
        <circle cx="23" cy="32" r="2" fill="#E7B24C"/>
        <!-- FUSELAJE -->
        <path d="M-55 0 C-48 -8 -10 -12 24 -11 C40 -10 50 -6 56 0 C50 6 40 9 24 10 C-10 11 -48 8 -55 0 Z"
              fill="url(#planeBody)" stroke="#5E120C" stroke-width="1.2"/>
        <path d="M-45 -6 C-12 -9 26 -9 47 -4 C26 -6.5 -12 -6.5 -45 -5.5 Z" fill="#F2715F" opacity="0.6"/>
        <path d="M-50 1 C-20 4 30 4 52 1" fill="none" stroke="#FBF3E0" stroke-width="1.6" opacity="0.5"/>
        <!-- CABINA / parabrisas -->
        <path d="M5 -10 C9 -18 19 -18 22 -10 Z" fill="#0B1A20" stroke="#5E120C" stroke-width="1"/>
        <ellipse cx="13.2" cy="-12" rx="6" ry="2.8" fill="#9FD0D6" opacity="0.9"/>
        <!-- MONTANTES (cabane + interplano): unen alas al cuerpo -->
        <line x1="-24" y1="-20" x2="-23" y2="13" stroke="#4A0E08" stroke-width="2"/>
        <line x1="30" y1="-20" x2="31" y2="13" stroke="#4A0E08" stroke-width="2"/>
        <line x1="-2" y1="-10" x2="-3" y2="-20" stroke="#4A0E08" stroke-width="2"/>
        <line x1="14" y1="-10" x2="13" y2="-20" stroke="#4A0E08" stroke-width="2"/>
        <!-- ALA SUPERIOR (perfil) -->
        <path d="M-32 -20 C-8 -24 26 -24 40 -20 C26 -16.5 -8 -16.5 -32 -18 Z" fill="url(#planeWing)" stroke="#5E120C" stroke-width="1.1"/>
        <path d="M-32 -20 C-8 -24 26 -24 40 -20" fill="none" stroke="#FBF3E0" stroke-width="1.1" opacity="0.5"/>
        <!-- CAPÓ / morro -->
        <path d="M49 -7 C57 -6 61 -2 61 0 C61 2 57 6 49 7 C53 3 53 -3 49 -7 Z" fill="#8E1A10" stroke="#5E120C" stroke-width="1"/>
        <!-- HÉLICE (gira: .airplane-prop) -->
        <g transform="translate(62 0)">
          <ellipse cx="0" cy="0" rx="5" ry="23" fill="#F4D06A" opacity="0.16"/>
          <g class="airplane-prop">
            <rect x="-2" y="-22" width="4" height="44" rx="2" fill="#3A0E0A"/>
            <rect x="-22" y="-2" width="44" height="4" rx="2" fill="#3A0E0A" opacity="0.45"/>
          </g>
          <circle cx="0" cy="0" r="3.8" fill="#2A0E0A"/>
          <circle cx="-0.9" cy="-1" r="1.4" fill="#E7B24C"/>
        </g>
      </g>
    </g>
    <!-- Front dune -->
    <path class="dune-front"
      d="M0 300 L0 220 Q80 190 180 205 Q300 225 420 200 Q550 175 680 195 Q740 205 800 185 L800 300 Z"
      fill="url(#dune-fg)" opacity="0.92"/>
  </svg>`;
}

// Kicker de capítulo editorial: "I · El piloto"
function kicker(n, label) {
  return `<p class="kicker"><span class="kicker__n">${n}</span><span>${label}</span></p>`;
}

// ── HTML builders ───────────────────────────────────────────

function scene1HTML() {
  return `<section class="scene" data-scene="1" style="min-height:100vh;background:var(--color-noche)">
    <div class="scene-inner scene1-inner">
      ${estrellasSVG(90)}
      <div class="scene1-text">
        <h2 class="s1-title">Para Isabela</h2>
        <p class="s1-sub">una historia que cabe en el cielo</p>
      </div>
      <div class="scroll-hint" aria-hidden="true">
        <svg viewBox="0 0 24 36" width="24" fill="none" stroke="currentColor" stroke-width="1.5">
          <rect x="4" y="2" width="16" height="28" rx="8"/>
          <line x1="12" y1="8" x2="12" y2="16"/>
        </svg>
      </div>
    </div>
  </section>`;
}

function scene2HTML() {
  return `<section class="scene" data-scene="2" style="min-height:150vh;position:relative;overflow:hidden">
    <div class="scene2-bg"></div>
    ${dunesSVG()}
    <div class="scene-text-block s2-text">
      ${kicker('I', 'El piloto')}
      <p class="scene-text">Hace mucho tiempo, un piloto cayó en medio del desierto del Sahara,
        a miles de kilómetros de cualquier lugar habitado.</p>
    </div>
  </section>`;
}

function scene3HTML() {
  return `<section class="scene" data-scene="3" style="min-height:120vh">
    <div class="scene3-inner">
      <div class="s3-principito">${principitoSVG()}</div>
      <div class="scene-text-block">
        ${kicker('II', 'La voz')}
        <p class="scene-text s3-text">De la nada, una vocecita le pidió:
          «Por favor… dibújame un cordero.»</p>
      </div>
    </div>
  </section>`;
}

function scene4HTML() {
  return `<section class="scene" data-scene="4" style="min-height:120vh">
    <div class="scene4-inner">
      <div class="s4-rosa">${rosaSVG()}</div>
      <div class="scene-text-block">
        ${kicker('III', 'La rosa')}
        <p class="scene-text s4-text">El principito venía de un planeta diminuto,
          donde había dejado una flor que creía la única de todo el universo.</p>
      </div>
    </div>
  </section>`;
}

function scene5HTML() {
  return `<section class="scene scene-trigal scene-trigal--prev" data-scene="5"
      style="min-height:130vh;position:relative;overflow:hidden">
    <!-- Atmósfera: cielo de anochecer + sol bajo frío + rayos -->
    <div class="trigal-cielo trigal-cielo--prev" aria-hidden="true">
      <div class="trigal-sol trigal-sol--prev"></div>
      <div class="trigal-rayos"></div>
    </div>
    <div class="trigal-motas" aria-hidden="true"></div>
    <!-- Texto narrativo -->
    <div class="scene-text-block s5-textblock">
      ${kicker('IV', 'El zorro')}
      <p class="scene-text s5-text">En su camino por la Tierra, conoció a un zorro
        que vivía escondido entre el trigo, y le enseñó algo que cambiaría
        su forma de ver el mundo.</p>
    </div>
    <!-- Capas de trigo (parallax). Se llenan en initScene5. -->
    <div class="trigo-capa trigo-capa--lejana" data-capa="lejana"></div>
    <div class="trigo-capa trigo-capa--media" data-capa="media"></div>
    <!-- Zorro asomado entre la capa media y la cercana -->
    <div class="s5-fox">${foxPeekSVG()}</div>
    <div class="trigo-capa trigo-capa--cercana" data-capa="cercana"></div>
    <div class="trigo-capa trigo-capa--frente" data-capa="frente"></div>
  </section>`;
}

function scene6HTML() {
  return `<section class="scene scene-trigal" data-scene="6"
      style="height:100vh;position:relative;overflow:hidden">
    <!-- Atmósfera: cielo de atardecer + sol bajo + rayos de luz -->
    <div class="trigal-cielo" aria-hidden="true">
      <div class="trigal-sol"></div>
      <div class="trigal-rayos"></div>
    </div>
    <!-- Resplandor cálido tras el trigo (crece con el scroll) -->
    <div class="s6-glow" aria-hidden="true"></div>
    <!-- Motas de polen flotando (se llenan en initScene6) -->
    <div class="trigal-motas" aria-hidden="true"></div>
    <!-- Capas de trigo (parallax + ola dorada). Se llenan en initScene6. -->
    <div class="trigo-capa trigo-capa--lejana" data-capa="lejana"></div>
    <div class="trigo-capa trigo-capa--media" data-capa="media"></div>
    <!-- Figuras: principito (izq) + zorro (der), sobre el horizonte -->
    <div class="s6-figuras">
      <div class="s6-principito">${principitoSentadoSVG()}</div>
      <div class="s6-fox">${foxFullSVG()}</div>
    </div>
    <!-- Capas delanteras: ocluyen las patas e integran las figuras en el campo -->
    <div class="trigo-capa trigo-capa--cercana" data-capa="cercana"></div>
    <div class="trigo-capa trigo-capa--frente" data-capa="frente"></div>
    <!-- Banda de luz viajera: la "ola dorada" literal que barre el campo -->
    <div class="trigal-ola" aria-hidden="true"></div>
    <div class="s6-fragments">
      <p class="scene-frag" data-frag="1" style="opacity:0;transform:translateY(12px)">
        El zorro le explicó que, hasta entonces, el trigo no significaba nada para él.</p>
      <p class="scene-frag" data-frag="2" style="opacity:0;transform:translateY(12px)">
        Pero si el principito lo domesticaba, todo cambiaría.</p>
      <p class="scene-frag" data-frag="3" style="opacity:0;transform:translateY(12px)">
        «Ahora el trigo dorado me hará pensar en ti. Y amaré el sonido del viento entre las espigas.»</p>
    </div>
  </section>`;
}

function scene7HTML() {
  return `<section class="scene" data-scene="7" style="min-height:100vh">
    <div class="scene7-inner">
      <p class="quote-main" aria-label="Cita de El Principito">Lo esencial es invisible a los ojos.</p>
      <div class="quote-sep" aria-hidden="true"><span class="quote-sep__star">✦</span></div>
      <p class="quote-sub">solo se ve bien con el corazón</p>
    </div>
  </section>`;
}

function scene8HTML() {
  return `<section class="scene" data-scene="8" style="min-height:150vh">
    <div class="scene8-inner">
      ${estrellasSVG(100)}
      <div class="s8-principito">${principitoSVG('s8-figure')}</div>
      <article class="letter" aria-label="Carta para Isabela">
        <div class="letter__paper">
          <p class="letter__kicker">Para ti</p>
          <h2 class="letter__title birthday-text">Feliz cumpleaños, Isabela</h2>
          <!-- DEDICATORIA: escribe tu mensaje real aquí y quita la clase
               "dedicatoria--placeholder" para dejar el estilo definitivo. -->
          <p class="dedicatoria dedicatoria--placeholder letter__body">Escribe aquí tu mensaje para Isabela… Aquí van las palabras que solo tú sabes decirle: lo que significa, lo que recuerdas, lo que deseas para ella.</p>
          <p class="letter__sign">— con cariño</p>
        </div>
        <div class="letter__seal" aria-hidden="true">✦</div>
      </article>
    </div>
  </section>`;
}

// ── Diorama del trigal: helpers compartidos por escenas 5 y 6 ─────

// Llena las 4 capas de trigo de una escena. Devuelve { lejana, media, cercana, frente }
// con los arrays de elementos .espiga de cada capa.
function poblarTrigal(scene, { densidad = 1, color = '#B2A878' } = {}) {
  const m = densidad;
  const cfg = {
    lejana:  { cantidad: Math.round(22 * m), baseHeightFrac: 0.5,  color, rotJitter: 4 },
    media:   { cantidad: Math.round(30 * m), baseHeightFrac: 0.72, color, rotJitter: 6 },
    cercana: { cantidad: Math.round(18 * m), baseHeightFrac: 0.95, color, rotJitter: 7 },
    frente:  { cantidad: Math.max(4, Math.round(6 * m)), baseHeightFrac: 1.3, color, rotJitter: 11 },
  };
  const byLayer = {};
  for (const key of Object.keys(cfg)) {
    const el = scene.querySelector(`.trigo-capa--${key}`);
    byLayer[key] = el ? crearCapaTrigo(el, cfg[key]) : [];
  }
  return byLayer;
}

// Viento: balanceo por espiga en las capas media y cercana (las que dan vida),
// con fase aleatoria. Las capas lejana/frente se mecen como bloque vía CSS.
function vientoTrigal(byLayer) {
  if (rm()) return;
  const amp = { media: 2.4, cercana: 3.8 };
  ['media', 'cercana'].forEach((key) => {
    const espigas = byLayer[key];
    if (!espigas || !espigas.length) return;
    gsap.fromTo(espigas,
      { rotation: -amp[key] },
      {
        rotation: amp[key],
        transformOrigin: '50% 100%',
        duration: () => 2.4 + Math.random() * 1.8,
        ease: 'sine.inOut',
        repeat: -1,
        yoyo: true,
        stagger: { each: 0.04, from: 'random' },
      });
  });
}

// Motas de polen/luz flotando en el aire.
function poblarMotas(scene, n) {
  const cont = scene.querySelector('.trigal-motas');
  if (!cont) return;
  const motas = [];
  for (let i = 0; i < n; i++) {
    const d = document.createElement('span');
    d.className = 'mota';
    const size = (2 + Math.random() * 4).toFixed(1);
    d.style.left = (Math.random() * 100).toFixed(1) + '%';
    d.style.bottom = (Math.random() * 66).toFixed(1) + '%';
    d.style.width = size + 'px';
    d.style.height = size + 'px';
    d.style.opacity = (0.18 + Math.random() * 0.5).toFixed(2);
    cont.appendChild(d);
    motas.push(d);
  }
  if (rm()) return;
  motas.forEach((mota) => {
    const baseOp = parseFloat(mota.style.opacity);
    gsap.to(mota, {
      y: -(40 + Math.random() * 130),
      x: (Math.random() - 0.5) * 70,
      opacity: 0,
      duration: 7 + Math.random() * 9,
      repeat: -1,
      delay: Math.random() * 9,
      ease: 'none',
      onRepeat() { gsap.set(mota, { y: 0, x: 0, opacity: baseOp }); },
    });
  });
}

// Parallax de capas durante el scroll (solo escena 5; la 6 lo hace en su onUpdate).
function parallaxCapas(scene) {
  if (rm()) return;
  const offsets = { lejana: -4, media: -9, cercana: -16, frente: -24 };
  Object.entries(offsets).forEach(([k, y]) => {
    const el = scene.querySelector(`.trigo-capa--${k}`);
    if (el) {
      gsap.to(el, {
        yPercent: y, ease: 'none',
        scrollTrigger: { trigger: scene, start: 'top bottom', end: 'bottom top', scrub: true },
      });
    }
  });
}

// Vida idle del zorro: respiración, parpadeo, vaivén de cola y tic de orejas.
// Cada pieza está protegida (la versión "peek" no tiene cuerpo ni cola).
function vidaZorro(scene) {
  if (rm()) return;
  const q = (sel) => scene.querySelector(sel);
  const breath = q('.fox-breath');
  const tail = q('.fox-tail');
  const eyes = q('.fox-eyes');
  const earL = q('.fox-ear-l');
  const earR = q('.fox-ear-r');

  if (breath) gsap.to(breath, { scaleY: 1.025, scaleX: 1.012, transformOrigin: '50% 100%', duration: 2.3, repeat: -1, yoyo: true, ease: 'sine.inOut' });
  if (tail) gsap.to(tail, { rotation: 4.5, transformOrigin: '70% 6%', duration: 2.9, repeat: -1, yoyo: true, ease: 'sine.inOut' });
  if (earL) gsap.to(earL, { rotation: -3.5, transformOrigin: '70% 100%', duration: 3.6, repeat: -1, yoyo: true, ease: 'sine.inOut', delay: 1 });
  if (earR) gsap.to(earR, { rotation: 3.5, transformOrigin: '30% 100%', duration: 4.1, repeat: -1, yoyo: true, ease: 'sine.inOut', delay: 1.6 });
  if (eyes) {
    const blink = () => gsap.to(eyes, {
      scaleY: 0.08, transformOrigin: '50% 50%', duration: 0.09, yoyo: true, repeat: 1,
      onComplete: () => gsap.delayedCall(2.4 + Math.random() * 4, blink),
    });
    gsap.delayedCall(2 + Math.random() * 3, blink);
  }
}

// ── Scene init functions ─────────────────────────────────────

function initScene1(container) {
  const s = container.querySelector('[data-scene="1"]');
  const title = s.querySelector('.s1-title');
  const sub = s.querySelector('.s1-sub');
  const hint = s.querySelector('.scroll-hint');

  gsap.set([title, sub, hint], { opacity: 0 });
  gsap.set(title, { y: 16 });

  const tl = gsap.timeline({ delay: 0.4 });
  tl.to(title, { opacity: 1, y: 0, duration: 1.1, ease: 'power2.out' })
    .to(sub, { opacity: 0.7, duration: 0.8, ease: 'power2.out' }, '-=0.4')
    .to(hint, { opacity: 0.5, duration: 0.6 }, '-=0.2');

  // Scroll hint bounce
  if (!rm()) {
    gsap.to(hint, { y: 8, duration: 1.2, repeat: -1, yoyo: true, ease: 'sine.inOut', delay: 2.5 });
  }

  ScrollTrigger.create({
    trigger: s,
    start: 'top top',
    onEnter: () => {
      reproducirNarracion(NARRACION.escena1);
      crossfadeMusica(MUSICA.apertura);
    },
    onEnterBack: () => {
      crossfadeMusica(MUSICA.apertura);
      reproducirNarracionConDebounce(NARRACION.escena1);
    },
    onLeave: cancelarDebounce,
    onLeaveBack: cancelarDebounce,
  });
}

function initScene2(container) {
  const s = container.querySelector('[data-scene="2"]');
  const bg = s.querySelector('.scene2-bg');
  const dBack = s.querySelector('.dune-back');
  const dFront = s.querySelector('.dune-front');
  const airplane = s.querySelector('.airplane');
  const text = s.querySelector('.s2-text');

  if (!rm()) {
    // Fade in the crepusculo overlay as user scrolls through scene 2
    gsap.to(bg, {
      opacity: 1,
      scrollTrigger: { trigger: s, start: 'top bottom', end: 'center top', scrub: true },
    });
    gsap.to(dBack, {
      y: -22,
      scrollTrigger: { trigger: s, start: 'top bottom', end: 'bottom top', scrub: true },
    });
    gsap.to(dFront, {
      y: -40,
      scrollTrigger: { trigger: s, start: 'top bottom', end: 'bottom top', scrub: true },
    });
    // ATERRIZAJE: el biplano baja del cielo y se posa en la duna conforme
    // se desliza (planea desde arriba-izquierda hasta su posición de reposo).
    const shadow = s.querySelector('.airplane-shadow');
    gsap.fromTo(airplane,
      { y: -150, x: -70, rotation: -3 },
      {
        y: 0, x: 0, rotation: 0, ease: 'power1.in', immediateRender: true,
        scrollTrigger: { trigger: s, start: 'top top', end: '+=720', scrub: true },
      });
    // La sombra crece y se oscurece a medida que el avión toca tierra.
    gsap.fromTo(shadow,
      { opacity: 0.05, scaleX: 0.45 },
      {
        opacity: 0.3, scaleX: 1, ease: 'power1.in', transformOrigin: 'center', immediateRender: true,
        scrollTrigger: { trigger: s, start: 'top top', end: '+=720', scrub: true },
      });
  }

  revealOnScroll(text, { y: 24 });

  ScrollTrigger.create({
    trigger: s,
    start: 'top 60%',
    onEnter: () => {
      reproducirNarracion(NARRACION.escena2);
      crossfadeMusica(MUSICA.desierto);
    },
    onEnterBack: () => {
      crossfadeMusica(MUSICA.desierto);
      reproducirNarracionConDebounce(NARRACION.escena2);
    },
    onLeave: cancelarDebounce,
    onLeaveBack: cancelarDebounce,
  });
}

function initScene3(container) {
  const s = container.querySelector('[data-scene="3"]');
  const principito = s.querySelector('.s3-principito');
  const textEl = s.querySelector('.s3-text');

  gsap.set(principito, { opacity: 0, scale: 0.7 });
  revealOnScroll(principito, { y: 0 });
  if (!rm()) {
    ScrollTrigger.create({
      trigger: principito, start: 'top 75%', once: true,
      onEnter: () => gsap.to(principito, { opacity: 1, scale: 1, duration: 0.9, ease: 'back.out(1.2)' }),
    });
  } else {
    revealOnScroll(principito);
  }

  const words = splitChars(textEl, 'words');
  gsap.set(words, { opacity: 0 });
  ScrollTrigger.create({
    trigger: textEl, start: 'top 78%',
    onEnter: () => gsap.to(words, { opacity: 1, stagger: 0.08, ease: 'power2.out', duration: 0.5 }),
    onEnterBack: () => gsap.to(words, { opacity: 1, stagger: 0.08, ease: 'power2.out', duration: 0.5 }),
    onLeave: () => gsap.to(words, { opacity: 0, duration: 0.3 }),
    onLeaveBack: () => gsap.to(words, { opacity: 0, duration: 0.3 }),
  });

  ScrollTrigger.create({
    trigger: s, start: 'top 60%',
    onEnter: () => reproducirNarracion(NARRACION.escena3),
    onEnterBack: () => reproducirNarracionConDebounce(NARRACION.escena3),
    onLeave: cancelarDebounce,
    onLeaveBack: cancelarDebounce,
  });
}

function initScene4(container) {
  const s = container.querySelector('[data-scene="4"]');
  const rosa = s.querySelector('.s4-rosa');
  const text = s.querySelector('.s4-text');

  revealOnScroll(rosa, { y: 20 });
  revealOnScroll(text, { y: 20 });

  // Rose breathing — animates the SVG element inside the wrapper
  const rosaSvg = rosa.querySelector('.rosa-svg') ?? rosa;
  if (!rm()) {
    ScrollTrigger.create({
      trigger: rosa, start: 'top 80%',
      onEnter: () => gsap.to(rosaSvg, {
        scale: 1.02, duration: 3, repeat: -1, yoyo: true,
        ease: 'sine.inOut', transformOrigin: 'center bottom',
      }),
    });
  }

  ScrollTrigger.create({
    trigger: s, start: 'top 60%',
    onEnter: () => reproducirNarracion(NARRACION.escena4),
    onEnterBack: () => reproducirNarracionConDebounce(NARRACION.escena4),
    onLeave: cancelarDebounce,
    onLeaveBack: cancelarDebounce,
  });
}

function initScene5(container) {
  const s = container.querySelector('[data-scene="5"]');
  const fox = s.querySelector('.s5-fox');
  const text = s.querySelector('.s5-text');
  const mobile = window.matchMedia('(max-width: 600px)').matches;

  // Diorama "previo": luz fría, trigo aún pálido, zorro asomado.
  const byLayer = poblarTrigal(s, { densidad: mobile ? 0.6 : 1, color: '#A99F71' });
  poblarMotas(s, mobile ? 10 : 20);
  vientoTrigal(byLayer);
  parallaxCapas(s);
  vidaZorro(s);

  gsap.set(fox, { opacity: 0, y: 30 });
  revealOnScroll(fox, { y: 30 });
  revealOnScroll(text, { y: 20 });

  ScrollTrigger.create({
    trigger: s, start: 'top 60%',
    onEnter: () => {
      reproducirNarracion(NARRACION.escena5);
      crossfadeMusica(MUSICA.zorro);
    },
    onEnterBack: () => {
      crossfadeMusica(MUSICA.zorro);
      reproducirNarracionConDebounce(NARRACION.escena5);
    },
    onLeave: cancelarDebounce,
    onLeaveBack: cancelarDebounce,
  });
}

function initScene6(container) {
  const s = container.querySelector('[data-scene="6"]');
  const frags = s.querySelectorAll('.scene-frag');
  const [frag1, frag2, frag3] = frags;

  const glow = s.querySelector('.s6-glow');
  const ola = s.querySelector('.trigal-ola');
  const sol = s.querySelector('.trigal-sol');
  const rayos = s.querySelector('.trigal-rayos');
  const principito = s.querySelector('.s6-principito');
  const capaMedia = s.querySelector('.trigo-capa--media');
  const capas = ['lejana', 'media', 'cercana', 'frente'].map((k) => s.querySelector(`.trigo-capa--${k}`));
  const mobile = window.matchMedia('(max-width: 600px)').matches;

  const byLayer = poblarTrigal(s, { densidad: mobile ? 0.55 : 1, color: '#B2A878' });
  poblarMotas(s, mobile ? 12 : 26);

  // La "ola dorada" enciende las espigas de las capas media + cercana,
  // ordenadas por su x mundial para que el barrido vaya limpio de izq→der.
  const espigas = [...byLayer.media, ...byLayer.cercana]
    .sort((a, b) => (+a.dataset.cx || 0) - (+b.dataset.cx || 0));

  if (rm()) {
    // Reduced motion: trigo dorado + resplandor al instante, sin pin/viento.
    // Los fragmentos se apilan; principito y zorro quedan ya colocados.
    gsap.set(espigas, { fill: '#F4C75A', stroke: '#F4C75A' });
    gsap.set(glow, { opacity: 0.6 });
    if (sol) gsap.set(sol, { opacity: 1 });
    if (rayos) gsap.set(rayos, { opacity: 0.4 });
    if (principito) gsap.set(principito, { opacity: 1, y: 0 });
    s.querySelector('.s6-fragments').classList.add('s6-fragments--static');
    gsap.set(frags, { opacity: 1, y: 0 });
    return;
  }

  vientoTrigal(byLayer);
  vidaZorro(s);
  if (principito) gsap.set(principito, { opacity: 0, y: 26 });
  let princeShown = false;

  const W = s.clientWidth || window.innerWidth;

  // Audio cues: one-shot flags per fragment so they don't re-fire while scrubbing
  let audioFired = [false, false, false];
  const waveEach = 0.02;

  gsap.to(espigas, {
    fill: '#F4C75A',
    stroke: '#F4C75A',   // cubre también los tallos
    // La ola: cada espiga se enciende con un leve in/out — luz que barre
    stagger: { each: waveEach, from: 'start', ease: 'power1.inOut' },
    scrollTrigger: {
      trigger: s,
      pin: true,
      scrub: 1,
      start: 'top top',
      end: '+=200%',
      onUpdate: (self) => {
        const p = self.progress;

        // Fragment 1: 5-40% of scroll
        const showF1 = p >= 0.05 && p < 0.42;
        gsap.set(frag1, { opacity: showF1 ? 1 : 0, y: showF1 ? 0 : 12 });

        // Fragment 2: 42-78% of scroll
        const showF2 = p >= 0.42 && p < 0.78;
        gsap.set(frag2, { opacity: showF2 ? 1 : 0, y: showF2 ? 0 : 12 });

        // Fragment 3: 78%+ of scroll
        const showF3 = p >= 0.78;
        gsap.set(frag3, { opacity: showF3 ? 1 : 0, y: showF3 ? 0 : 12 });

        // Resplandor + sol + rayos CRECEN con la ola (vía progress). Nace al 35%.
        const g = Math.min(1, Math.max(0, (p - 0.35) / 0.6));
        gsap.set(glow, { opacity: g * 0.95 });
        if (sol) gsap.set(sol, { opacity: 0.35 + g * 0.65, scale: 1 + g * 0.12 });
        if (rayos) gsap.set(rayos, { opacity: 0.12 + g * 0.5 });
        gsap.set(capaMedia, { filter: p >= 0.9 ? 'brightness(1.06)' : 'none' });

        // Banda de luz viajera: la "ola" literal barre el campo de izq→der.
        if (ola) {
          const vis = Math.sin(Math.min(1, Math.max(0, p)) * Math.PI); // campana
          gsap.set(ola, { x: (-0.3 + p * 1.6) * W, opacity: 0.12 + vis * 0.6 });
        }

        // Parallax sutil de capas durante el pin (más cercano = más recorrido).
        capas.forEach((el, i) => { if (el) gsap.set(el, { yPercent: -(i * 2.4) * p }); });

        // Entrada del principito en el beat del fragmento 2 ("domesticar").
        if (p >= 0.4 && !princeShown) {
          princeShown = true;
          gsap.to(principito, { opacity: 1, y: 0, duration: 1, ease: 'power2.out' });
        } else if (p < 0.36 && princeShown) {
          princeShown = false;
          gsap.to(principito, { opacity: 0, y: 26, duration: 0.5 });
        }

        // Audio: fire each fragment narration once per forward pass
        if (p >= 0.05 && !audioFired[0]) {
          audioFired[0] = true;
          reproducirNarracion(NARRACION.escena6fragmento1);
        }
        if (p >= 0.42 && !audioFired[1]) {
          audioFired[1] = true;
          reproducirNarracion(NARRACION.escena6fragmento2);
        }
        if (p >= 0.78 && !audioFired[2]) {
          audioFired[2] = true;
          reproducirNarracion(NARRACION.escena6fragmento3);
        }

        // Reset flags when user scrolls back to beginning of scene
        if (p < 0.04) {
          audioFired = [false, false, false];
        }
      },
    },
  });
}

function initScene7(container) {
  const s = container.querySelector('[data-scene="7"]');
  const quoteEl = s.querySelector('.quote-main');
  const subEl = s.querySelector('.quote-sub');
  const sepEl = s.querySelector('.quote-sep');

  const words = splitChars(quoteEl, 'words');
  gsap.set(words, { opacity: 0, y: 10 });
  gsap.set([sepEl, subEl], { opacity: 0 });

  // Pin so the phrase has time to breathe before scroll resumes.
  // toggleActions: "play none none none" — DELIBERADO:
  // esta frase solo aparece UNA VEZ, no se revierte al hacer scroll hacia atrás,
  // para que sea un momento único, no un loop. Distinto al patrón "reverse" de escenas anteriores.
  ScrollTrigger.create({
    trigger: s,
    pin: true,
    start: 'top top',
    end: '+=50%',
  });

  ScrollTrigger.create({
    trigger: s,
    start: 'top 70%',
    toggleActions: 'play none none none',
    onEnter: () => {
      gsap.to(words, {
        opacity: 1, y: 0,
        stagger: 0.15,
        ease: 'power2.out',
        duration: 0.7,
        onComplete: () => {
          gsap.to(sepEl, { opacity: 1, duration: 0.7, delay: 0.2 });
          gsap.to(subEl, { opacity: 0.6, duration: 0.9, delay: 0.45 });
        },
      });
      reproducirNarracion(NARRACION.escena7);
      crossfadeMusica(MUSICA.climax);
    },
  });
}

function initScene8(container) {
  const s = container.querySelector('[data-scene="8"]');
  const principito = s.querySelector('.s8-principito');
  const paper = s.querySelector('.letter__paper');
  const seal = s.querySelector('.letter__seal');
  const allStars = s.querySelectorAll('.stars-bg circle');

  revealOnScroll(principito, { y: 24 });

  // La carta sube como papel y el sello de lacre estampa al final.
  if (!rm()) {
    gsap.set(paper, { opacity: 0, y: 40, rotateX: 8 });
    gsap.set(seal, { opacity: 0, scale: 0 });
    ScrollTrigger.create({
      trigger: paper, start: 'top 80%', once: true,
      onEnter: () => {
        gsap.to(paper, { opacity: 1, y: 0, rotateX: 0, duration: 1.1, ease: 'power3.out' });
        gsap.to(seal, { opacity: 1, scale: 1, duration: 0.5, ease: 'back.out(2)', delay: 0.7 });
      },
    });
  } else {
    revealOnScroll(paper, { y: 16 });
  }

  // Stars twinkle (infinite — stays alive)
  if (!rm()) {
    allStars.forEach((star) => {
      gsap.to(star, {
        opacity: Math.random() * 0.5 + 0.15,
        duration: 2 + Math.random() * 2.5,
        repeat: -1,
        yoyo: true,
        ease: 'sine.inOut',
        delay: Math.random() * 3,
      });
    });
  }

  ScrollTrigger.create({
    trigger: s, start: 'top 60%',
    onEnter: () => {
      reproducirNarracion(NARRACION.escena8);
      crossfadeMusica(MUSICA.cierre);
      // After narration ends, let music breathe
      setTimeout(() => subirMusica(VOLUMEN.musicaSinVoz, 2), 8000);
    },
    onEnterBack: () => {
      crossfadeMusica(MUSICA.cierre);
      reproducirNarracionConDebounce(NARRACION.escena8);
    },
    onLeave: cancelarDebounce,
    onLeaveBack: cancelarDebounce,
  });
}

// ── Public entry point ───────────────────────────────────────
export function init(container) {
  // Build story HTML
  container.innerHTML = `
    <div class="story-container">
      <div class="story-dust" aria-hidden="true">${estrellasSVG(70)}</div>
      <div class="story-vignette" aria-hidden="true"></div>
      <button class="mute-btn" type="button" aria-label="Silenciar audio">🔊</button>
      ${scene1HTML()}
      ${scene2HTML()}
      ${scene3HTML()}
      ${scene4HTML()}
      ${scene5HTML()}
      ${scene6HTML()}
      ${scene7HTML()}
      ${scene8HTML()}
    </div>
  `;

  // Unlock audio context on first interaction (browser autoplay policy)
  container.addEventListener('pointerdown', unlockAudioContext, { once: true });

  // Init audio system
  const muteBtn = container.querySelector('.mute-btn');
  initAudio(container, muteBtn);

  // Init each scene
  initScene1(container);
  initScene2(container);
  initScene3(container);
  initScene4(container);
  initScene5(container);
  initScene6(container);
  initScene7(container);
  initScene8(container);

  // Refresh ScrollTrigger after DOM is fully built
  ScrollTrigger.refresh();
}
