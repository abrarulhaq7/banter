/**
 * A random version 4 UUID, for row ids made on the phone before a row is saved.
 * These are identifiers, not secrets: access is decided by row-level security.
 */
export function uuid(): string {
  const bytes = new Uint8Array(16);
  const strong = (globalThis as { crypto?: { getRandomValues?: (array: Uint8Array) => unknown } }).crypto;
  if (strong?.getRandomValues) strong.getRandomValues(bytes);
  else for (let index = 0; index < 16; index += 1) bytes[index] = Math.floor(Math.random() * 256);

  bytes[6] = (bytes[6] & 0x0f) | 0x40; // version 4
  bytes[8] = (bytes[8] & 0x3f) | 0x80; // variant
  const hex = Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}
