/** Validate navigation in the path while preserving opaque query/fragment data. */
export function safeInternalRedirect(value: string | null | undefined): string | null {
  if (!value || Array.from(value).some(char => char.charCodeAt(0) < 32 || char.charCodeAt(0) === 127)) {
    return null;
  }

  // Query and fragment values may legitimately contain encoded spaces, percent
  // signs, or backslashes. They do not determine the navigation origin.
  let decodedPath = value.split(/[?#]/, 1)[0];
  for (let i = 0; i < 4; i++) {
    if (!decodedPath.startsWith('/') || decodedPath.startsWith('//') || decodedPath.includes('\\') ||
        Array.from(decodedPath).some(char => char.charCodeAt(0) <= 32 || char.charCodeAt(0) === 127)) {
      return null;
    }
    try {
      const next = decodeURIComponent(decodedPath);
      if (next === decodedPath) {
        const url = new URL(value, 'https://ringsnap.invalid');
        return url.origin === 'https://ringsnap.invalid' ? value : null;
      }
      decodedPath = next;
    } catch {
      return null;
    }
  }
  return null;
}
