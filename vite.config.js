import { defineConfig } from 'vite';

// Respeta el puerto que asigne el entorno (PORT) para herramientas de
// previsualización; en uso normal cae a 5173 como siempre.
export default defineConfig({
  server: {
    port: process.env.PORT ? Number(process.env.PORT) : 5173,
    strictPort: false,
  },
});
