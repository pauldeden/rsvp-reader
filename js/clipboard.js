// ===== Clipboard handler with fallback =====

/**
 * Attempt navigator.clipboard.readText().
 * Returns { ok: true, text } or { ok: false } if denied/unavailable.
 */
export async function readClipboard() {
  try {
    if (navigator.clipboard && navigator.clipboard.readText) {
      const text = await navigator.clipboard.readText();
      if (text && text.trim().length > 0) {
        return { ok: true, text: text.trim() };
      }
    }
  } catch {
    // Permission denied or not available
  }
  return { ok: false };
}
