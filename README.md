# 🌹 Para Isabela — Guía de Aldemar

Una historia que cabe en el cielo.

---

## Antes de compartirla, necesitas hacer dos cosas

### 1. Grabar los audios y ponerlos en su lugar

Los audios van en dos carpetas dentro de `public/audio/`. Ahí ya hay archivos de prueba (silencio) para que la app funcione mientras grabas. Cuando tengas las grabaciones reales, **reemplaza** cada archivo con el mismo nombre exacto.

#### Narración — `public/audio/narracion/`

| Archivo | Qué dice |
|---------|----------|
| `escena1.mp3` | Apertura: "Para Isabela, una historia que cabe en el cielo" |
| `escena2.mp3` | El piloto en el desierto |
| `escena3.mp3` | "Dibújame un cordero" |
| `escena4.mp3` | La rosa |
| `escena5.mp3` | El encuentro con el zorro |
| `escena6-fragmento1.mp3` | El trigo y el zorro — parte 1 |
| `escena6-fragmento2.mp3` | El trigo y el zorro — parte 2 |
| `escena6-fragmento3.mp3` | El trigo y el zorro — parte 3 |
| `escena7.mp3` | "Lo esencial es invisible a los ojos" |
| `escena8.mp3` | Cierre y dedicatoria personal ← **grabar ÚLTIMO**, después de escribir el texto de abajo |

> ⚠️ Los nombres deben coincidir **exactamente**: minúsculas, guiones, sin espacios, con `.mp3` al final.

#### Música — `public/audio/musica/`

Estas son pistas de fondo (royalty-free). Consíguelas en [Pixabay Music](https://pixabay.com/music/), [YouTube Audio Library](https://studio.youtube.com/), o [Free Music Archive](https://freemusicarchive.org/).  
**No uses música de ninguna película o serie de El Principito** — tiene copyright.

| Archivo | Para qué escena |
|---------|-----------------|
| `mood-apertura.mp3` | Escenas 1-2 |
| `mood-desierto.mp3` | Escena 2-3 (desierto) |
| `mood-zorro.mp3` | Escenas 5-6 (zorro y trigal) |
| `mood-climax.mp3` | Escena 7 (frase clave) |
| `mood-cierre.mp3` | Escena 8 (cierre) |

---

### 2. Escribir la dedicatoria final

Abre el archivo:
```
src/acts/story.js
```

Busca este comentario (puedes usar Ctrl+F para encontrarlo):
```html
<!-- DEDICATORIA: reemplazar este texto por el mensaje final -->
```

Está justo encima de la línea con `[Aquí va tu mensaje personal para Isabela]`.  
Reemplaza ese texto con tu mensaje real. Puede ser tan corto o largo como quieras.

> 📌 **Importante**: graba el audio `escena8.mp3` **después** de escribir este texto, para que tu voz coincida con lo que se lee en pantalla.

---

## Cómo probarlo antes de enviarlo

1. Abre una terminal en la carpeta del proyecto
2. Ejecuta:
   ```
   npm install
   npm run dev
   ```
3. Abre en el navegador: `http://localhost:5173`
4. Pruébalo de principio a fin con sonido activado

---

## Cómo grabarte a ti mismo

- Graba en un espacio silencioso, sin eco — un clóset con ropa o una habitación con cortinas funciona muy bien
- El grabador de voz de tu celular es suficiente, no necesitas equipo profesional
- Lee pausado, dejando respirar las frases — no tienes que leer rápido
- Graba cada escena como un archivo separado (no un audio largo que luego cortarás)
- Si quieres limpiar el audio gratis: [Audacity](https://www.audacityteam.org/) en computadora, o el editor de voz nativo de tu celular

---

## Cómo hacer el deploy (publicar en internet)

### Opción A — Netlify (recomendada, más privada)
1. Crea una cuenta gratis en [netlify.com](https://netlify.com)
2. Conecta tu repositorio de GitHub (puede ser privado — nadie verá el código)
3. Configuración de build:
   - **Build command**: `npm run build`
   - **Publish directory**: `dist`
4. Netlify te dará un link como `https://tu-proyecto.netlify.app`

### Opción B — GitHub Pages (requiere repo público)
1. Ejecuta `npm run build`
2. Sube la carpeta `dist/` a la rama `gh-pages` de tu repositorio
3. Activa GitHub Pages en la configuración del repo, apuntando a `gh-pages`

---

## Cómo compartirlo con Isabela

Cuando tengas el link listo, acompáñalo de un mensaje como:

> *"Esto es para ti. Ábrelo cuando tengas un momento a solas y con audio — es una historia corta."*

La experiencia tiene sonido y está pensada para verse de corrido (unos 8-10 minutos).

---

## Checklist antes de compartir

Marca cada punto antes de enviarle el link:

- [ ] Probé el flujo completo (intro → sistema planetario → historia) en un celular real, no solo en computadora
- [ ] Probé con el celular en silencio — la experiencia visual funciona igual de bien sin audio
- [ ] Los 15 archivos de audio cargan y suenan en el orden correcto, sin solapamientos raros
- [ ] La escena del trigal (escena 6) se ve fluida en el celular
- [ ] La dedicatoria final tiene el texto real, no el placeholder
- [ ] El audio de `escena8.mp3` fue grabado **después** de escribir la dedicatoria y coincide con lo que se lee
- [ ] Probé el botón de mute/unmute (🔊 en la esquina superior derecha)
- [ ] Abrí el link final desde el celular para una última revisión

---

## Notas sobre copyright

- Los textos son paráfrasis propias, no citas literales del libro (salvo la frase corta de la escena 7)
- Las ilustraciones son diseños originales estilizados, no trazados del libro
- La música es royalty-free (no de ninguna película de El Principito)
- La narración es tu voz — original
