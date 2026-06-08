import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// base: './' makes asset URLs relative so the build runs from any path on
// GitHub Pages (user.github.io/<repo>/) without extra config.
export default defineConfig({
  base: './',
  plugins: [react()],
});
