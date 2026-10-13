/**
 * Decryption of the contact details with the WebCrypto API.
 * Shared by the browser script and the unit tests (Node ≥ 20 provides `crypto.subtle`).
 */

export interface ContactDetails {
  email: string;
  phone: string;
  location: string;
}

export function fromBase64Url(value: string): Uint8Array<ArrayBuffer> {
  const base64 = value.replace(/-/g, '+').replace(/_/g, '/').padEnd(Math.ceil(value.length / 4) * 4, '=');
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

export async function decryptContact(
  cipher: string,
  maskedKey: Uint8Array,
  mask: string,
  subtle: SubtleCrypto = globalThis.crypto.subtle,
): Promise<ContactDetails> {
  const maskBytes = fromBase64Url(mask);
  if (maskedKey.length !== maskBytes.length) throw new Error('Invalid key');

  const rawKey = new Uint8Array(maskedKey.length);
  for (let i = 0; i < rawKey.length; i++) rawKey[i] = maskedKey[i]! ^ maskBytes[i]!;

  const data = fromBase64Url(cipher);
  const key = await subtle.importKey('raw', rawKey, { name: 'AES-GCM' }, false, ['decrypt']);
  const plain = await subtle.decrypt({ name: 'AES-GCM', iv: data.slice(0, 12) }, key, data.slice(12));
  const details = JSON.parse(new TextDecoder().decode(plain)) as Partial<ContactDetails>;

  if (typeof details.email !== 'string' || typeof details.phone !== 'string' || typeof details.location !== 'string') {
    throw new Error('Invalid contact payload');
  }
  return { email: details.email, phone: details.phone, location: details.location };
}
