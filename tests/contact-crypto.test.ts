import { randomBytes } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { createContactSecret, encryptContact, readContactDetails, xorBytes } from '../src/lib/contact-crypto';
import { decryptContact, fromBase64Url } from '../src/lib/contact-decrypt';

const details = { email: 'jane@example.org', phone: '+1 (416) 555-0199', location: 'Toronto, ON' };

describe('contact encryption', () => {
  it('round-trips through the browser decryption code', async () => {
    const secret = createContactSecret(details);
    await expect(decryptContact(secret.cipher, secret.maskedKey, secret.mask)).resolves.toEqual(details);
  });

  it('does not contain the plaintext in any public artefact', () => {
    const secret = createContactSecret(details);
    const publicData = [secret.cipher, secret.mask, secret.maskedKey.toString('latin1'), secret.fileName].join('|');
    for (const value of [details.email, 'jane', '416', '555-0199', 'Toronto']) {
      expect(publicData).not.toContain(value);
    }
    expect(Buffer.from(fromBase64Url(secret.cipher)).toString('latin1')).not.toContain('jane');
  });

  it('uses a fresh key, IV and file name per build', () => {
    const a = createContactSecret(details);
    const b = createContactSecret(details);
    expect(a.cipher).not.toBe(b.cipher);
    expect(a.maskedKey.equals(b.maskedKey)).toBe(false);
    expect(a.fileName).not.toBe(b.fileName);
    expect(a.fileName).toMatch(/^[0-9a-f]{32}$/);
  });

  it('fails with a wrong key or tampered ciphertext', async () => {
    const secret = createContactSecret(details);
    const wrongKey = randomBytes(32);
    await expect(decryptContact(secret.cipher, wrongKey, secret.mask)).rejects.toThrow();

    const key = randomBytes(32);
    const mask = randomBytes(32);
    const data = Buffer.from(fromBase64Url(encryptContact(details, key)));
    data[20] = data[20]! ^ 0xff;
    await expect(
      decryptContact(data.toString('base64url'), xorBytes(key, mask), mask.toString('base64url')),
    ).rejects.toThrow();
  });
});

describe('readContactDetails', () => {
  const env = { CV_EMAIL: 'a@b.ca', CV_PHONE: '123', CV_LOCATION: 'Ottawa' };

  it('reads the environment variables', () => {
    expect(readContactDetails(env, { strict: true })).toEqual({
      details: { email: 'a@b.ca', phone: '123', location: 'Ottawa' },
      missing: [],
    });
  });

  it('falls back to placeholders locally', () => {
    const result = readContactDetails({}, { strict: false });
    expect(result.missing).toEqual(['CV_EMAIL', 'CV_PHONE', 'CV_LOCATION']);
    expect(result.details.email).toContain('@example.com');
  });

  it('fails in CI when secrets are missing', () => {
    expect(() => readContactDetails({ CV_EMAIL: 'a@b.ca' }, { strict: true })).toThrow(/CV_PHONE, CV_LOCATION/);
  });
});
