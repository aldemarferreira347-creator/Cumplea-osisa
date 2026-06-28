import gsap from 'gsap';
import { NARRACION, MUSICA, VOLUMEN } from './audioConfig.js';

let narAudio = null;
let musicAudio = null;
let isMuted = false;
let audioUnlocked = false;
let narrativeDebounce = null;
let currentMusicVol = VOLUMEN.musicaConVoz; // tracks actual target so mute/unmute restores correctly

function createAudio(src, loop = false, volume = 1) {
  const a = new Audio();
  a.preload = 'auto';
  a.loop = loop;
  a.volume = volume;
  a.src = src;
  return a;
}

function safePlay(audio) {
  if (!audio || isMuted) return Promise.resolve();
  return audio.play().catch(() => {});
}

export function unlockAudioContext() {
  if (audioUnlocked) return;
  audioUnlocked = true;
  // Create and immediately pause a silent audio to satisfy browser autoplay policies
  const silent = new Audio();
  silent.src = 'data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEARKwAAIhYAQACABAAZGF0YQAAAAA=';
  silent.play().then(() => silent.pause()).catch(() => {});
}

export function precargar(archivos) {
  for (const src of archivos) {
    const a = new Audio();
    a.preload = 'auto';
    a.src = src;
  }
}

export function reproducirNarracion(src) {
  if (narAudio) {
    narAudio.pause();
    narAudio.currentTime = 0;
  }
  narAudio = createAudio(src, false, VOLUMEN.narracion);
  if (isMuted) narAudio.volume = 0;

  // When narration ends, gently raise music back to sin-voz level
  narAudio.addEventListener('ended', () => {
    subirMusica(VOLUMEN.musicaSinVoz, 2);
  }, { once: true });

  safePlay(narAudio);
}

export function reproducirNarracionConDebounce(src, delay = 1500) {
  clearTimeout(narrativeDebounce);
  narrativeDebounce = setTimeout(() => reproducirNarracion(src), delay);
}

export function cancelarDebounce() {
  clearTimeout(narrativeDebounce);
}

export function crossfadeMusica(src, duracion = 1.5) {
  // Don't restart if same track is already playing
  if (musicAudio && musicAudio.src.endsWith(src.replace(/^\//, ''))) return;

  const prev = musicAudio;

  musicAudio = createAudio(src, true, 0);
  safePlay(musicAudio);

  const targetVol = isMuted ? 0 : VOLUMEN.musicaConVoz;
  currentMusicVol = VOLUMEN.musicaConVoz;
  gsap.to(musicAudio, { volume: targetVol, duration: duracion });

  if (prev) {
    gsap.to(prev, {
      volume: 0, duration: duracion,
      onComplete: () => { prev.pause(); },
    });
  }
}

export function subirMusica(targetVol, dur = 1) {
  if (!musicAudio) return;
  currentMusicVol = targetVol;
  if (isMuted) return;
  gsap.to(musicAudio, { volume: targetVol, duration: dur });
}

export function bajarMusica(targetVol = VOLUMEN.musicaConVoz, dur = 1) {
  if (!musicAudio) return;
  currentMusicVol = targetVol;
  if (isMuted) return;
  gsap.to(musicAudio, { volume: targetVol, duration: dur });
}

export function setMuted(muted) {
  isMuted = muted;
  if (narAudio) narAudio.volume = muted ? 0 : VOLUMEN.narracion;
  if (musicAudio) musicAudio.volume = muted ? 0 : currentMusicVol;
}

export function initAudio(container, muteButtonEl) {
  // Preload first scene's audio immediately
  precargar([NARRACION.escena1, MUSICA.apertura]);

  // Preload the rest lazily while user reads the first scenes
  setTimeout(() => {
    precargar([
      NARRACION.escena2, NARRACION.escena3, NARRACION.escena4,
      NARRACION.escena5, NARRACION.escena6fragmento1, NARRACION.escena6fragmento2,
      NARRACION.escena6fragmento3, NARRACION.escena7, NARRACION.escena8,
      MUSICA.desierto, MUSICA.zorro, MUSICA.climax, MUSICA.cierre,
    ]);
  }, 2000);

  if (muteButtonEl) {
    muteButtonEl.addEventListener('click', () => {
      isMuted = !isMuted;
      setMuted(isMuted);
      muteButtonEl.setAttribute('aria-label', isMuted ? 'Activar audio' : 'Silenciar audio');
      muteButtonEl.textContent = isMuted ? '🔇' : '🔊';
    });
  }
}

export { NARRACION, MUSICA, VOLUMEN };
