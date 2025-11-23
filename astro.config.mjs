// @ts-check
import { defineConfig } from 'astro/config';
import svelte from '@astrojs/svelte';
import node from '@astrojs/node';
import tailwindcss from '@tailwindcss/vite';

// https://astro.build/config
export default defineConfig({
  integrations: [svelte()],
  vite: {
    plugins: [tailwindcss()],
  },
  output: 'server',
  adapter: node({
    mode: 'standalone',
  }),
});
