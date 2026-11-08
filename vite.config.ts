import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

// BASE_PATH est défini par le workflow GitHub Pages (ex. /ma-cave-a-vin/)
const base = process.env.BASE_PATH ?? '/';

export default defineConfig({
  base,
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['icon.svg'],
      manifest: {
        name: 'Ma Cave à Vin',
        short_name: 'Ma Cave',
        description: 'Gérer sa cave à vin simplement : stock, emplacements, apogée, dégustations, température.',
        lang: 'fr',
        theme_color: '#6b1f2f',
        background_color: '#faf7f5',
        display: 'standalone',
        start_url: '.',
        icons: [
          { src: 'icon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any maskable' },
        ],
      },
    }),
  ],
});
