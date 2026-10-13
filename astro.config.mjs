// @ts-check
import { defineConfig } from 'astro/config';
import contactKey from './integrations/contact-key';
import { buildBase, PUBLIC_SITE } from './src/lib/site';

export default defineConfig({
  site: PUBLIC_SITE,
  // `/` locally, `/cv` on GitHub Pages (CV_BASE is set in the deploy workflow).
  base: buildBase(),
  trailingSlash: 'ignore',
  output: 'static',
  build: {
    format: 'directory',
  },
  devToolbar: {
    enabled: false,
  },
  integrations: [contactKey()],
  vite: {
    build: {
      // Never inline scripts into the HTML: the key location must only live in the external bundle.
      assetsInlineLimit: 0,
    },
  },
});
