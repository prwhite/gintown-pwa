import adapter from '@sveltejs/adapter-static';
import { vitePreprocess } from '@sveltejs/vite-plugin-svelte';

const base = process.env.BASE_PATH ?? '';

export default {
  preprocess: vitePreprocess(),
  kit: {
    adapter: adapter({
      pages: 'build',
      assets: 'build',
      fallback: '404.html',
      precompress: false,
      strict: false
    }),
    paths: {
      base
    },
    // /stats isn't linked via a static <a href>, so the prerender crawler
    // doesn't reach it from /. List it explicitly so it gets a 200 instead
    // of relying on the 404.html SPA fallback.
    prerender: {
      entries: ['*', '/stats']
    }
  }
};
