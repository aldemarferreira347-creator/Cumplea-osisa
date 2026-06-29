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

// Rampa suave 0→1 entre a y b (con clamp). Base de los cross-fades continuos
// guiados por el progreso del scroll (evita cortes duros "entrecortados").
const ramp = (p, a, b) => Math.min(1, Math.max(0, (p - a) / (b - a)));

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

// Zorro SENTADO de cuerpo entero (escena 6), mismo estilo ilustrado plano y la
// misma cara amable que foxHeadSVG, pero con ancas, patas, pecho y cola. Pensado
// para verse COMPLETO sobre el trigo (no tapado). Grupos idle: .fox-tail (cola),
// .fox-breath (respira), .fox-ear-l/.fox-ear-r (tic), .fox-eyes (parpadeo).
function foxSittingSVG(p, clase = '') {
  return `<svg class="fox-svg ${clase}" viewBox="0 0 220 340" aria-hidden="true">
    <defs>
      <linearGradient id="${p}Fur" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stop-color="#F09A4A"/><stop offset="1" stop-color="#D9722F"/>
      </linearGradient>
      <linearGradient id="${p}Ear" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stop-color="#ED9344"/><stop offset="1" stop-color="#C75F2A"/>
      </linearGradient>
      <linearGradient id="${p}Body" x1="0" y1="0" x2="0.2" y2="1">
        <stop offset="0" stop-color="#E58A3C"/><stop offset="1" stop-color="#BC5E27"/>
      </linearGradient>
      <linearGradient id="${p}Tail" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0" stop-color="#E88E3E"/><stop offset="1" stop-color="#B0531F"/>
      </linearGradient>
      <linearGradient id="${p}Cream" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stop-color="#FCF5E6"/><stop offset="1" stop-color="#EBDABA"/>
      </linearGradient>
    </defs>

    <!-- COLA frondosa al costado (se mece) -->
    <g class="fox-tail">
      <path d="M148 170 C192 176 214 222 202 266 C193 300 162 314 150 305
               C160 286 162 258 154 232 C148 212 144 190 148 170 Z" fill="url(#${p}Tail)"/>
      <path d="M150 302 C147 292 152 282 163 281 C174 280 181 291 177 301 C172 311 156 311 150 302 Z" fill="url(#${p}Cream)"/>
    </g>

    <g class="fox-breath">
      <!-- ANCAS / cuerpo sentado -->
      <path d="M110 150 C80 152 60 188 60 236 C60 284 82 312 110 312
               C140 312 162 284 162 236 C162 188 142 152 110 150 Z" fill="url(#${p}Body)"/>
      <!-- patas delanteras + zarpas -->
      <path d="M94 246 C90 276 90 298 94 312 L110 312 C108 298 108 276 109 248 Z" fill="url(#${p}Body)"/>
      <path d="M123 248 C123 276 123 298 126 312 L142 312 C144 298 144 276 138 246 Z" fill="url(#${p}Body)"/>
      <ellipse cx="101" cy="311" rx="12" ry="5.5" fill="#B85E2A"/>
      <ellipse cx="135" cy="311" rx="12" ry="5.5" fill="#B85E2A"/>
      <!-- pecho / vientre claro -->
      <path d="M110 162 C88 176 80 214 86 256 C90 288 110 302 110 302
               C110 302 130 288 134 256 C140 214 132 176 110 162 Z" fill="url(#${p}Cream)"/>

      <!-- CABEZA -->
      <g class="fox-ear-l">
        <path d="M76 78 L66 14 L114 60 Z" fill="url(#${p}Ear)"/>
        <path d="M80 72 L74 32 L106 58 Z" fill="#7A2E18"/>
        <path d="M82 67 L78 43 L100 56 Z" fill="url(#${p}Cream)" opacity=".62"/>
      </g>
      <g class="fox-ear-r">
        <path d="M144 78 L154 14 L106 60 Z" fill="url(#${p}Ear)"/>
        <path d="M140 72 L146 32 L114 58 Z" fill="#7A2E18"/>
        <path d="M138 67 L142 43 L120 56 Z" fill="url(#${p}Cream)" opacity=".62"/>
      </g>
      <!-- cara: base clara (mejillas + hocico) -->
      <path d="M110 72 C80 72 60 88 58 114 C56 136 68 160 88 176
               C97 182 110 186 110 186 C110 186 123 182 132 176
               C152 160 164 136 162 114 C160 88 140 72 110 72 Z" fill="url(#${p}Cream)"/>
      <!-- máscara naranja: frente + caballete -->
      <path d="M110 62 C84 62 64 78 64 104 C64 117 73 123 86 121
               C95 120 100 128 104 139 C106 145 108 149 110 153
               C112 149 114 145 116 139 C120 128 125 120 134 121
               C147 123 156 117 156 104 C156 78 136 62 110 62 Z" fill="url(#${p}Fur)"/>
      <!-- ojos pequeños y serenos -->
      <g class="fox-eyes">
        <path d="M76 116 C80 110 90 110 94 117 C90 122 80 122 76 116 Z" fill="#241410"/>
        <path d="M144 116 C140 110 130 110 126 117 C130 122 140 122 144 116 Z" fill="#241410"/>
        <circle cx="88" cy="114.4" r="1.3" fill="#FBE8C0" opacity=".85"/>
        <circle cx="132" cy="114.4" r="1.3" fill="#FBE8C0" opacity=".85"/>
      </g>
      <!-- nariz -->
      <path d="M110 144 C102 144 96 150 100 156 C104 161 110 163 110 163
               C110 163 116 161 120 156 C124 150 118 144 110 144 Z" fill="#2A1A12"/>
      <ellipse cx="106.5" cy="149" rx="1.6" ry="1.1" fill="#6E5847" opacity=".6"/>
    </g>
  </svg>`;
}

function foxFullSVG() {
  return foxSittingSVG('ff', 'fox-full');
}

function principitoSentadoSVG(clases = '') {
  // El Principito SENTADO en el trigal, mirando a la derecha (hacia el zorro).
  // Rediseño 2 (desde cero, más grande y robusto a tamaño chico): cabeza
  // grande de cuento, pelo dorado en mechones audaces, abrigo petróleo con
  // cuello/botones/cinturón, bufanda terracota al viento, brazo apoyado hacia
  // el zorro y luz cálida de borde del lado del sol (derecha). viewBox 200×250.
  return `<svg class="principito-2d principito-sentado ${clases}" viewBox="0 0 200 250" aria-hidden="true">
    <defs>
      <linearGradient id="psCoat" x1="0" y1="0" x2="0.3" y2="1">
        <stop offset="0" stop-color="#3C7B86"/><stop offset="0.55" stop-color="#22515B"/><stop offset="1" stop-color="#123139"/>
      </linearGradient>
      <radialGradient id="psFace" cx="44%" cy="40%" r="64%">
        <stop offset="55%" stop-color="#FBDDB4"/><stop offset="100%" stop-color="#E6A179"/>
      </radialGradient>
      <linearGradient id="psHair" x1="0.1" y1="0" x2="0.9" y2="1">
        <stop offset="0" stop-color="#FADF84"/><stop offset="0.55" stop-color="#EEB958"/><stop offset="1" stop-color="#D5963F"/>
      </linearGradient>
      <linearGradient id="psScarf" x1="0" y1="0" x2="1" y2="0.7">
        <stop offset="0" stop-color="#EC9159"/><stop offset="1" stop-color="#BE4530"/>
      </linearGradient>
      <linearGradient id="psBoot" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stop-color="#714C33"/><stop offset="1" stop-color="#392316"/>
      </linearGradient>
    </defs>

    <!-- ░ BUFANDA: cola larga al viento (izq), tras el cuerpo ░ -->
    <path d="M104 110 C74 100 44 106 14 96 C30 110 16 124 2 122 C26 132 56 127 80 120 C94 116 102 114 110 116 Z" fill="url(#psScarf)" opacity="0.96"/>
    <path d="M100 110 C72 102 46 106 22 99" fill="none" stroke="#F5B387" stroke-width="2" opacity="0.55" stroke-linecap="round"/>

    <!-- ░ PIERNA/BOTA TRASERA asoma (izq) ░ -->
    <path d="M84 214 C74 214 66 221 67 229 C68 237 80 238 90 233 L94 224 Z" fill="url(#psBoot)" opacity="0.92"/>

    <!-- ░ ABRIGO: torso + faldón sentado (petróleo) ░ -->
    <path d="M82 100 C62 114 52 154 51 198 C50 222 66 236 100 236 C134 236 150 222 149 198 C148 154 138 114 118 100 C107 92 93 92 82 100 Z" fill="url(#psCoat)"/>
    <path d="M82 100 C64 116 55 156 54 198 C53 218 62 230 80 234 C71 208 70 160 73 126 C75 110 78 104 85 101 Z" fill="#11303A" opacity="0.5"/>
    <path d="M118 101 C135 116 144 156 145 198 C146 217 138 229 121 234 C130 208 131 160 128 127 C126 111 122 104 117 101 Z" fill="#47848F" opacity="0.42"/>

    <!-- ░ PIERNA/BOTA DELANTERA (doblada, apunta al zorro) ░ -->
    <path d="M104 216 C126 211 150 217 168 228 C173 234 166 243 156 241 C137 234 116 230 103 230 C96 228 97 219 104 216 Z" fill="#2F5B4D"/>
    <path d="M154 228 C170 226 182 232 182 239 C181 245 168 246 159 243 L148 238 Z" fill="url(#psBoot)"/>
    <path d="M154 229 C164 228 174 231 179 235" fill="none" stroke="#9A663A" stroke-width="2.2" opacity="0.55" stroke-linecap="round"/>

    <!-- ░ CUELLO ALTO del abrigo ░ -->
    <path d="M86 98 C94 89 106 89 114 98 L110 110 C104 103 96 103 90 110 Z" fill="#40757F"/>

    <!-- ░ BOTONADURA dorada ░ -->
    <line x1="100" y1="120" x2="100" y2="188" stroke="#10303A" stroke-width="1.7" opacity="0.5"/>
    <circle cx="100" cy="128" r="3" fill="#F4D06A" stroke="#B07F2C" stroke-width="0.7"/>
    <circle cx="100" cy="144" r="3" fill="#F4D06A" stroke="#B07F2C" stroke-width="0.7"/>
    <circle cx="100" cy="160" r="3" fill="#F4D06A" stroke="#B07F2C" stroke-width="0.7"/>
    <circle cx="100" cy="176" r="3" fill="#F4D06A" stroke="#B07F2C" stroke-width="0.7"/>

    <!-- ░ CINTURÓN + hebilla ░ -->
    <path d="M58 184 C82 192 122 192 144 184 L144 196 C122 204 82 204 58 196 Z" fill="#10303A"/>
    <rect x="92" y="185" width="14" height="9" rx="2" fill="#E7B24C"/>

    <!-- ░ BRAZO apoyado hacia el zorro (der) ░ -->
    <path d="M118 106 C136 114 150 142 154 174 C155 187 148 197 140 197 C135 178 130 148 116 126 C112 116 112 108 118 106 Z" fill="url(#psCoat)"/>
    <path d="M135 188 C143 189 150 191 150 196 C149 201 142 201 137 198 Z" fill="#40757F"/>
    <ellipse cx="146" cy="195" rx="7.5" ry="6.2" fill="url(#psFace)"/>

    <!-- ░ BUFANDA: nudo + cola corta al frente ░ -->
    <path d="M92 100 C97 112 109 112 114 100 C113 111 111 118 103 121 C96 118 92 110 92 100 Z" fill="url(#psScarf)"/>
    <path d="M101 119 C95 132 97 146 105 154 C99 140 101 127 107 121 Z" fill="url(#psScarf)"/>
    <path d="M94 102 C99 108 107 108 112 102" fill="none" stroke="#F5B387" stroke-width="1.6" opacity="0.5" stroke-linecap="round"/>

    <!-- ░ CUELLO (piel) ░ -->
    <path d="M91 84 L91 100 C91 107 113 107 113 100 L113 84 Z" fill="url(#psFace)"/>
    <path d="M91 92 C97 97 113 97 113 92 L113 100 C106 106 96 105 91 100 Z" fill="#D6896A" opacity="0.4"/>

    <!-- ░ OREJA (atrás, izq) ░ -->
    <ellipse cx="69" cy="62" rx="6" ry="8.4" fill="url(#psFace)"/>
    <ellipse cx="70" cy="62" rx="2.6" ry="4.6" fill="#D6896A" opacity="0.55"/>

    <!-- ░ CABEZA grande (óvalo) ░ -->
    <path d="M66 56 C66 34 81 20 100 20 C120 20 134 37 134 58 C134 80 119 95 100 95 C80 95 66 78 66 56 Z" fill="url(#psFace)"/>

    <!-- ░ PELO dorado: melena en mechones puntiagudos ░ -->
    <path d="M63 60 C59 36 77 16 101 15 C99 6 112 2 116 11 C124 4 136 9 133 21
             C143 24 146 43 140 62 C134 50 124 45 115 47 C118 35 107 31 102 39
             C105 26 92 24 89 35 C84 25 72 30 75 43 C68 35 64 44 66 56 Z" fill="url(#psHair)"/>
    <path d="M68 50 C72 56 72 64 67 68 C63 63 63 54 68 50 Z" fill="url(#psHair)"/>
    <path d="M132 49 C137 55 137 64 131 68 C127 62 127 53 132 49 Z" fill="url(#psHair)"/>
    <path d="M80 26 C90 20 108 21 119 28" fill="none" stroke="#FDEBAB" stroke-width="2.4" opacity="0.5" stroke-linecap="round"/>
    <path d="M76 40 C82 36 90 36 95 39" fill="none" stroke="#FDEBAB" stroke-width="1.6" opacity="0.4" stroke-linecap="round"/>

    <!-- ░ CARA: ojos hacia el zorro, cejas, naricita, sonrisa, mejillas ░ -->
    <ellipse cx="100" cy="60" rx="2.8" ry="3.6" fill="#1A2230"/>
    <ellipse cx="113" cy="60" rx="2.8" ry="3.6" fill="#1A2230"/>
    <circle cx="101" cy="58.6" r="1" fill="#FFF8E7"/>
    <circle cx="114" cy="58.6" r="1" fill="#FFF8E7"/>
    <path d="M95 53 Q100 50 105 53" fill="none" stroke="#C79A55" stroke-width="1.5" stroke-linecap="round"/>
    <path d="M109 53 Q114 50 118 53" fill="none" stroke="#C79A55" stroke-width="1.5" stroke-linecap="round"/>
    <path d="M107 62 C109 64 109 67 107 69" fill="none" stroke="#D6896A" stroke-width="1.3" stroke-linecap="round"/>
    <path d="M99 73 C105 78 114 77 119 72" fill="none" stroke="#C26B45" stroke-width="1.8" stroke-linecap="round"/>
    <ellipse cx="96" cy="69" rx="4" ry="2.6" fill="#E8896A" opacity="0.45"/>
    <ellipse cx="120" cy="68" rx="3.4" ry="2.2" fill="#E8896A" opacity="0.4"/>

    <!-- ░ LUZ CÁLIDA DE BORDE (sol a la derecha) ░ -->
    <path d="M133 42 C139 50 139 70 129 84" fill="none" stroke="#F6D27A" stroke-width="2.2" opacity="0.5" stroke-linecap="round"/>
    <path d="M152 130 C155 146 155 164 150 178" fill="none" stroke="#6CA0AC" stroke-width="1.8" opacity="0.5" stroke-linecap="round"/>
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
      style="min-height:105vh;position:relative;overflow:hidden">
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
  return `<section class="scene scene-trigal scene-trigal--art" data-scene="6"
      style="height:100vh;position:relative;overflow:hidden">
    <!-- ESCENA PINTADA (híbrido): la lámina 'trigal.png' trae fondo + trigo +
         principito + zorro (SIN texto). El trigo/figuras SVG y el cielo SVG se
         OCULTAN por CSS (.scene-trigal--art); las cajas de texto HTML van ENCIMA
         (nítidas y responsivas), más glow + motas + banda de luz + leve zoom. -->
    <div class="s6-art"><img src="/trigal.png" alt="El principito y el zorro entre el trigo dorado" /></div>
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
    <!-- Principito (izq): asoma entre la capa media y la cercana -->
    <div class="s6-figuras">
      <div class="s6-principito">${principitoSentadoSVG()}</div>
    </div>
    <!-- Capas delanteras del trigo -->
    <div class="trigo-capa trigo-capa--cercana" data-capa="cercana"></div>
    <div class="trigo-capa trigo-capa--frente" data-capa="frente"></div>
    <!-- Zorro de cuerpo entero, POR DELANTE del trigo (no queda tapado) -->
    <div class="s6-fox">${foxFullSVG()}</div>
    <!-- Banda de luz viajera: la "ola dorada" literal que barre el campo -->
    <div class="trigal-ola" aria-hidden="true"></div>
    <!-- Texto: oculto a la vista (ya está en la lámina) pero disponible para
         lectores de pantalla (sr-only vía CSS). -->
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
    // La capa "frente" pasó de baseHeightFrac 1.3 (espigas gigantes que, al
    // difuminarse, se leían como manchas oscuras flotando a media pantalla) a
    // una franja baja y suave que solo enmarca el borde inferior.
    lejana:  { cantidad: Math.round(20 * m), baseHeightFrac: 0.46, color, rotJitter: 4 },
    media:   { cantidad: Math.round(32 * m), baseHeightFrac: 0.70, color, rotJitter: 6 },
    cercana: { cantidad: Math.round(22 * m), baseHeightFrac: 0.92, color, rotJitter: 7 },
    frente:  { cantidad: Math.max(5, Math.round(8 * m)), baseHeightFrac: 0.72, color, rotJitter: 9 },
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

  // Modo PINTADO (híbrido): el trigo y las figuras ya están en la lámina, así
  // que no generamos los SVG de trigo ni los animamos (ahorra DOM/perf). Solo
  // mantenemos las motas + el pin que dispara glow, banda de luz y narración.
  const art = s.classList.contains('scene-trigal--art');

  const byLayer = art
    ? { lejana: [], media: [], cercana: [], frente: [] }
    : poblarTrigal(s, { densidad: mobile ? 0.55 : 1, color: '#B2A878' });
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
    // Marca la escena para que el CSS achique/baje las figuras a las esquinas
    // y el texto apilado (3 fragmentos a la vez) tenga sitio sin solaparlas.
    s.classList.add('scene6-static');
    s.querySelector('.s6-fragments').classList.add('s6-fragments--static');
    gsap.set(frags, { opacity: 1, y: 0 });
    return;
  }

  if (!art) { vientoTrigal(byLayer); vidaZorro(s); }
  if (principito) gsap.set(principito, { opacity: 0, y: 26 });

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

        // Fragmentos: cross-fade CONTINUO guiado por el progreso. Antes eran
        // cortes duros booleanos (opacity 0/1 de golpe) → la narración "saltaba"
        // entrecortada. Ahora cada frase entra y sale con una rampa suave y los
        // relevos se solapan un poco, sin parpadeos ni huecos en negro.
        const o1 = ramp(p, 0.05, 0.12) * (1 - ramp(p, 0.34, 0.42));
        const o2 = ramp(p, 0.40, 0.48) * (1 - ramp(p, 0.70, 0.78));
        const o3 = ramp(p, 0.76, 0.85);
        gsap.set(frag1, { opacity: o1, y: (1 - o1) * 10 });
        gsap.set(frag2, { opacity: o2, y: (1 - o2) * 10 });
        gsap.set(frag3, { opacity: o3, y: (1 - o3) * 10 });

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

        // Entrada del principito: rampa suave en el beat de "domesticar"
        // (antes aparecía/desaparecía de golpe con un flag booleano).
        if (principito) {
          const pr = ramp(p, 0.34, 0.5);
          gsap.set(principito, { opacity: pr, y: (1 - pr) * 26 });
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
