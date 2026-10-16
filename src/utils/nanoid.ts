/**
 * Tiny nanoid-compatible ID generator — avoids adding a dependency.
 * Generates a 21-character URL-safe random string.
 */

const ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789_-";

export function nanoid(size = 21): string {
  const bytes =
    typeof crypto !== "undefined" && crypto.getRandomValues
      ? crypto.getRandomValues(new Uint8Array(size))
      : Array.from({ length: size }, () => Math.floor(Math.random() * 64));

  return Array.from(bytes as Uint8Array | number[], (b) => ALPHABET[b & 63]!).join("");
}
