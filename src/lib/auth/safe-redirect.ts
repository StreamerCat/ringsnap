/** Accept only internal paths, including after URL decoding and normalization. */
export function safeInternalRedirect(value: string | null | undefined): string | null {
  if (!value) return null;
  let decoded = value;
  for (let i = 0; i < 4; i++) {
    if (!decoded.startsWith('/') || decoded.startsWith('//') || decoded.includes('\\') ||
        Array.from(decoded).some(char => char.charCodeAt(0) <= 32 || char.charCodeAt(0) === 127)) {
      return null;
    }
    try {
      const next = decodeURIComponent(decoded);
      if (next === decoded) {
        const url = new URL(value, 'https://ringsnap.invalid');
        return url.origin === 'https://ringsnap.invalid' ? value : null;
      }
      decoded = next;
    } catch {
      return null;
    }
  }
  return null;
}
