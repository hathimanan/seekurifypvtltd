// src/utils/encryptForShare.ts

export async function encryptForShare(plainText: string, secret: string) {
  if (!secret) throw new Error('A secret is required to derive the encryption key');

  const enc = new TextEncoder();

  // Import secret as key material for PBKDF2
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    enc.encode(secret),
    'PBKDF2',
    false,
    ['deriveKey']
  );

  // Generate a random salt and derive AES-GCM key
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const key = await crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt,
      iterations: 100000,
      hash: 'SHA-256',
    },
    keyMaterial,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt']
  );

  // IV for AES-GCM
  const iv = crypto.getRandomValues(new Uint8Array(12));

  // Encrypt plaintext
  const encryptedBuffer = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    key,
    enc.encode(plainText)
  );

  return {
    encryptedData: btoa(String.fromCharCode(...new Uint8Array(encryptedBuffer))),
    iv: btoa(String.fromCharCode(...iv)),
    salt: btoa(String.fromCharCode(...salt)),
  };
}
