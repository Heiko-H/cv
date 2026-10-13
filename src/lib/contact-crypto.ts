/**
 * Build-time encryption of the private contact details (Node only).
 *
 * The plaintext comes from environment variables (GitHub Secrets in CI, `.env` locally).
 * It is encrypted with AES-256-GCM using a random key that is generated for every build.
 * The page only contains the ciphertext; the key is XOR-masked and written to a separate,
 * randomly named file that the browser fetches only after a verified human click.
 */
import { createCipheriv, randomBytes } from 'node:crypto';
import type { ContactDetails } from './contact-decrypt';

export type { ContactDetails } from './contact-decrypt';

export const CONTACT_ENV = {
  email: 'CV_EMAIL',
  phone: 'CV_PHONE',
  location: 'CV_LOCATION',
} as const satisfies Record<keyof ContactDetails, string>;

const PLACEHOLDERS: ContactDetails = {
  email: 'jane.doe@example.com',
  phone: '+1 555 010 0000',
  location: 'Toronto, ON',
};

export interface ContactSecret {
  /** base64url(iv || ciphertext || auth tag) – safe to embed in HTML. */
  cipher: string;
  /** XOR-masked key, written to the key file. */
  maskedKey: Buffer;
  /** base64url mask, compiled into the client script. */
  mask: string;
  /** Random file name (without extension) of the key file. */
  fileName: string;
}

export function readContactDetails(
  env: Record<string, string | undefined>,
  { strict }: { strict: boolean },
): { details: ContactDetails; missing: string[] } {
  const missing: string[] = [];
  const details = { ...PLACEHOLDERS };

  for (const [field, variable] of Object.entries(CONTACT_ENV) as [keyof ContactDetails, string][]) {
    const value = env[variable]?.trim();
    if (value) details[field] = value;
    else missing.push(variable);
  }

  if (missing.length > 0 && strict) {
    throw new Error(
      `Missing contact secrets: ${missing.join(', ')}. ` +
        'Add them under Settings → Secrets and variables → Actions in your GitHub repository.',
    );
  }
  if (!details.email.includes('@')) {
    throw new Error(`${CONTACT_ENV.email} does not look like an email address`);
  }

  return { details, missing };
}

export function encryptContact(details: ContactDetails, key: Buffer): string {
  if (key.length !== 32) throw new Error('AES-256 requires a 32-byte key');
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', key, iv);
  const ciphertext = Buffer.concat([cipher.update(JSON.stringify(details), 'utf8'), cipher.final()]);
  return Buffer.concat([iv, ciphertext, cipher.getAuthTag()]).toString('base64url');
}

export function xorBytes(data: Uint8Array, mask: Uint8Array): Buffer {
  if (data.length !== mask.length) throw new Error('Mask length must equal data length');
  return Buffer.from(data.map((byte, index) => byte ^ mask[index]!));
}

export function createContactSecret(details: ContactDetails): ContactSecret {
  const key = randomBytes(32);
  const mask = randomBytes(32);
  return {
    cipher: encryptContact(details, key),
    maskedKey: xorBytes(key, mask),
    mask: mask.toString('base64url'),
    fileName: randomBytes(16).toString('hex'),
  };
}
