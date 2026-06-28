import gsap from 'gsap';
import { goToSolarSystem } from '../utils/stateMachine.js';

function estrellasFondo(count = 72) {
  // Temperatura variada (crema, oro tenue, azulado frío) en vez de un
  // único #FBF3E0 plano — el cielo gana profundidad.
  const palette = ['#FBF3E0', '#FBF3E0', '#FBF3E0', '#F4D06A', '#E7B24C', '#CFE3E6'];
  let s = '';
  for (let i = 0; i < count; i++) {
    const x = (Math.random() * 100).toFixed(2);
    const y = (Math.random() * 100).toFixed(2);
    const r = (0.4 + Math.random() * 1.1).toFixed(2);
    const o = (0.22 + Math.random() * 0.5).toFixed(2);
    const c = palette[(Math.random() * palette.length) | 0];
    s += `<circle cx="${x}%" cy="${y}%" r="${r}" fill="${c}" opacity="${o}"/>`;
  }
  return `<svg class="welcome-stars" aria-hidden="true" viewBox="0 0 100 100" preserveAspectRatio="xMidYMid slice">${s}</svg>`;
}

export function init(container) {
  container.innerHTML = `
    <div class="welcome-wrap">
      ${estrellasFondo()}
      <svg class="welcome-star" viewBox="0 0 60 60" aria-hidden="true" focusable="false">
        <defs>
          <radialGradient id="star-glow" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stop-color="#FBF3E0" stop-opacity="1"/>
            <stop offset="55%" stop-color="#F4D06A" stop-opacity="0.45"/>
            <stop offset="100%" stop-color="#E7B24C" stop-opacity="0"/>
          </radialGradient>
          <filter id="star-blur" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="3" result="blur"/>
            <feMerge>
              <feMergeNode in="blur"/>
              <feMergeNode in="SourceGraphic"/>
            </feMerge>
          </filter>
        </defs>
        <circle cx="30" cy="30" r="28" fill="url(#star-glow)" opacity="0.6"/>
        <!-- Estrella real de 4 puntas (antes solo dos círculos) -->
        <path d="M30 5 Q32.8 27.2 55 30 Q32.8 32.8 30 55 Q27.2 32.8 5 30 Q27.2 27.2 30 5 Z"
              fill="#FBF3E0" filter="url(#star-blur)"/>
        <circle cx="30" cy="30" r="2.4" fill="#FFF8E7"/>
      </svg>

      <h1 class="welcome-title">Feliz cumpleaños,&nbsp;Isabela</h1>
      <p class="welcome-sub">una historia que cabe en el cielo</p>

      <button class="welcome-btn" type="button" id="btn-comenzar">
        Toca para comenzar
      </button>
    </div>
  `;

  const wrap = container.querySelector('.welcome-wrap');
  const star = container.querySelector('.welcome-star');
  const title = container.querySelector('.welcome-title');
  const sub = container.querySelector('.welcome-sub');
  const btn = container.querySelector('#btn-comenzar');

  gsap.set([star, title, sub, btn], { opacity: 0 });
  gsap.set(title, { y: 20 });
  gsap.set(sub, { y: 10 });
  gsap.set(btn, { y: 8 });
  gsap.set(star, { scale: 0.8, transformOrigin: '50% 50%' });

  const tl = gsap.timeline();

  // Absolute positions match the spec: star@0.3s, title 1s after star, sub@1.6s, btn@2.2s
  tl.to(star, { opacity: 1, scale: 1, duration: 2, ease: 'power2.out' }, 0.3)
    .to(title, { opacity: 1, y: 0, duration: 1.1, ease: 'power2.out' }, 1.3)
    .to(sub, { opacity: 0.7, y: 0, duration: 0.9, ease: 'power2.out' }, 1.6)
    .to(btn, { opacity: 1, y: 0, duration: 0.8, ease: 'power2.out' }, 2.2);

  // Parpadeo tenue de unas pocas estrellas de fondo (ambiente, no ruido)
  if (!window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    const estrellas = Array.from(container.querySelectorAll('.welcome-stars circle'));
    estrellas
      .sort(() => Math.random() - 0.5)
      .slice(0, 16)
      .forEach((c) => {
        gsap.to(c, {
          opacity: 0.1,
          duration: 1.6 + Math.random() * 2.4,
          repeat: -1,
          yoyo: true,
          ease: 'sine.inOut',
          delay: Math.random() * 3,
        });
      });
  }

  btn.addEventListener('click', () => {
    // TODO: este gesto desbloqueará audio context — ver prompt 09-audio-sistema.md
    gsap.to(wrap, {
      opacity: 0,
      duration: 0.6,
      ease: 'power2.inOut',
      onComplete: () => goToSolarSystem(),
    });
  });
}
