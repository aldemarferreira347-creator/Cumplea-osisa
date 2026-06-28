import gsap from 'gsap';

export function revealOnScroll(element, opciones = {}) {
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const y = reducedMotion ? 0 : (opciones.y ?? 24);

  // fromTo + immediateRender:false → el elemento nunca queda clavado en
  // opacity 0 si ScrollTrigger.refresh() reordena (bug del "cuadro vacío").
  gsap.fromTo(element,
    { opacity: 0, y },
    {
      opacity: 1,
      y: 0,
      duration: reducedMotion ? 0.3 : (opciones.duration ?? 0.9),
      ease: opciones.ease ?? 'power2.out',
      delay: opciones.delay ?? 0,
      immediateRender: false,
      overwrite: 'auto',
      scrollTrigger: {
        trigger: opciones.trigger ?? element,
        start: opciones.start ?? 'top 82%',
        toggleActions: opciones.toggleActions ?? 'play none none reverse',
      },
    });
}
