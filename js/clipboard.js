// ===== Clipboard handler with iOS-aware fallback =====

const isIOSWebKit =
  /iP(hone|ad|od)/.test(navigator.userAgent) ||
  (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);

/** Returns true if we should skip the async Clipboard API and go straight to native paste flow */
export function shouldUseNativePasteFlow() {
  return isIOSWebKit;
}

/** Try async Clipboard API (works on Chrome, Firefox, desktop Safari) */
export async function readClipboardText() {
  try {
    if (navigator.clipboard?.readText) {
      const text = await navigator.clipboard.readText();
      if (text?.trim()) return { ok: true, text: text.trim() };
    }
  } catch { /* denied or unavailable */ }
  return { ok: false };
}

/** Focus a target element and attempt execCommand('paste') to trigger iOS native paste UI */
export function triggerNativePaste(target) {
  if (!target) return;
  target.focus();
  try { document.execCommand('paste'); } catch { /* ignored */ }
}
