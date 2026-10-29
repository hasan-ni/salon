import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// In development, /api and the live socket are forwarded to the server,
// so the browser sees one origin and the login cookie just works.
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      '/api': 'http://localhost:4000',
      '/socket.io': { target: 'http://localhost:4000', ws: true },
    },
  },
});
