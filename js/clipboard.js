// ===== Clipboard handler with fallback =====

/**
 * Attempt to read text from clipboard.
 * Tries readText() first, then read() with ClipboardItem (better Safari support).
 * Returns { ok: true, text } or { ok: false } if denied/unavailable.
 */
export async function readClipboard() {
  // Approach 1: readText() — works on Chrome, Firefox, some Safari
  try {
    if (navigator.clipboard?.readText) {
      const text = await navigator.clipboard.readText();
      if (text?.trim()) return { ok: true, text: text.trim() };
    }
  } catch { /* denied or unavailable */ }

  // Approach 2: read() with ClipboardItem — better Safari iOS support
  try {
    if (navigator.clipboard?.read) {
      const items = await navigator.clipboard.read();
      for (const item of items) {
        if (item.types.includes('text/plain')) {
          const blob = await item.getType('text/plain');
          const text = await blob.text();
          if (text?.trim()) return { ok: true, text: text.trim() };
        }
      }
    }
  } catch { /* denied or unavailable */ }

  return { ok: false };
}
