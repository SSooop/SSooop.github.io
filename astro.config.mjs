import { defineConfig } from 'astro/config';
import tailwindcss from '@tailwindcss/vite';
import react from '@astrojs/react';
import mdx from '@astrojs/mdx';
import { unified } from '@astrojs/markdown-remark';
import rehypeKatex from 'rehype-katex';
import remarkMath from 'remark-math';

const siteUrl = (process.env.SITE_URL || 'https://ssooop.github.io').replace(/\/+$/, '');
const basePath = process.env.PUBLIC_BASE || '/';

function normalizeBasePath(value) {
  if (!value || value === '/') {
    return '/';
  }

  const withLeadingSlash = value.startsWith('/') ? value : `/${value}`;
  return withLeadingSlash.replace(/\/+$/, '');
}

// https://astro.build/config
export default defineConfig({
  site: siteUrl,
  base: normalizeBasePath(basePath),

  output: 'static',

  integrations: [react(), mdx()],

  markdown: {
    processor: unified({
      remarkPlugins: [[remarkMath, { singleDollarTextMath: false }]],
      rehypePlugins: [rehypeKatex],
    }),
  },

  // Build optimizations
  build: {
    inlineStylesheets: 'auto',
  },

  // Vite configuration
  vite: {
    plugins: [tailwindcss()],
    // Ensure environment variables are loaded
    envDir: '.',
    build: {
      // Disable sourcemaps to reduce memory usage
      sourcemap: false,
      // Optimize chunk size
      rollupOptions: {
        output: {
          manualChunks(id) {
            if (id.includes('node_modules/react') || id.includes('node_modules/react-dom')) {
              return 'react-vendor';
            }

            return undefined;
          },
        },
      },
    },
  },

  // Server configuration
  server: {
    port: 3000,
    host: true,
  },

  // Experimental features
  experimental: {
    // Enable client directives
    clientPrerender: true,
  },
});
