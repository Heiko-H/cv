import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseEnv } from 'node:util';
import type { AstroIntegration } from 'astro';
import { createContactSecret, readContactDetails } from '../src/lib/contact-crypto';

const KEY_DIR = '_k';

function loadEnv(root: string): Record<string, string | undefined> {
  const file = resolve(root, '.env');
  const fromFile = existsSync(file) ? parseEnv(readFileSync(file, 'utf8')) : {};
  // Real environment variables (e.g. GitHub Secrets) win over the local .env file.
  return { ...fromFile, ...process.env };
}

/**
 * Encrypts the contact details once per build/dev-server start and
 * - injects the ciphertext (server) and key URL + mask (client script) via Vite `define`,
 * - serves the masked key in dev and writes it to `dist/_k/<random>.bin` on build.
 */
export default function contactKey(): AstroIntegration {
  let maskedKey: Buffer;
  let fileName: string;

  return {
    name: 'contact-key',
    hooks: {
      'astro:config:setup': ({ config, updateConfig, logger }) => {
        const root = fileURLToPath(config.root);
        const strict = process.env.GITHUB_ACTIONS === 'true' || process.env.CV_REQUIRE_CONTACT === 'true';
        const { details, missing } = readContactDetails(loadEnv(root), { strict });
        if (missing.length > 0) {
          logger.warn(`Using placeholder contact details – missing ${missing.join(', ')} (see .env.example)`);
        }

        const secret = createContactSecret(details);
        maskedKey = secret.maskedKey;
        fileName = secret.fileName;
        const keyUrl = `${config.base.replace(/\/$/, '')}/${KEY_DIR}/${fileName}.bin`;

        updateConfig({
          vite: {
            define: {
              __CV_CONTACT_CIPHER__: JSON.stringify(secret.cipher),
              __CV_KEY_URL__: JSON.stringify(keyUrl),
              __CV_KEY_MASK__: JSON.stringify(secret.mask),
            },
          },
        });
      },

      'astro:server:setup': ({ server }) => {
        server.middlewares.use((req, res, next) => {
          if (req.url?.split('?')[0]?.endsWith(`/${KEY_DIR}/${fileName}.bin`)) {
            res.setHeader('Content-Type', 'application/octet-stream');
            res.setHeader('Cache-Control', 'no-store');
            res.setHeader('X-Robots-Tag', 'noindex');
            res.end(maskedKey);
            return;
          }
          next();
        });
      },

      'astro:build:done': ({ dir, logger }) => {
        const keyDir = fileURLToPath(new URL(`${KEY_DIR}/`, dir));
        mkdirSync(keyDir, { recursive: true });
        writeFileSync(resolve(keyDir, `${fileName}.bin`), maskedKey);
        logger.info(`Wrote contact key file ${KEY_DIR}/${fileName}.bin`);
      },
    },
  };
}
