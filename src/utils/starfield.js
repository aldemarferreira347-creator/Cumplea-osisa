import * as THREE from 'three';

export function crearCampoEstrellas(count = 2000, spread = 80) {
  const positions = new Float32Array(count * 3);
  const colors = new Float32Array(count * 3);

  // Temperaturas estelares: crema cálida, casi-blanco, oro tenue y azulado frío.
  const tints = [
    [0.984, 0.953, 0.878], // #FBF3E0 crema
    [1.000, 0.973, 0.906], // #FFF8E7 casi blanco
    [0.957, 0.816, 0.416], // #F4D06A oro
    [0.811, 0.890, 0.902], // #CFE3E6 frío
  ];

  for (let i = 0; i < count; i++) {
    positions[i * 3]     = (Math.random() - 0.5) * spread;
    positions[i * 3 + 1] = (Math.random() - 0.5) * spread;
    positions[i * 3 + 2] = (Math.random() - 0.5) * spread;

    // Mayoría crema/blanca; unas pocas de oro o frías.
    const r = Math.random();
    const t = r < 0.58 ? tints[0] : r < 0.80 ? tints[1] : r < 0.92 ? tints[2] : tints[3];
    // Brillo aleatorio → simula magnitudes distintas (el tamaño del punto
    // es uniforme por capa; el sistema solar usa dos capas con tamaños).
    const b = 0.5 + Math.random() * 0.5;
    colors[i * 3]     = t[0] * b;
    colors[i * 3 + 1] = t[1] * b;
    colors[i * 3 + 2] = t[2] * b;
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));

  const mat = new THREE.PointsMaterial({
    size: 0.18,
    sizeAttenuation: true,
    vertexColors: true,
    transparent: true,
    depthWrite: false,
  });
  return new THREE.Points(geo, mat);
}
