// ===== RSVP Reader — Main App =====

import { getAllTexts, addText, deleteText, getText, saveText, clearAll, getSetting, setSetting } from './storage.js';
import { readClipboard } from './clipboard.js';
import { Reader } from './reader.js';

// ===== DOM refs =====
const libraryScreen = document.getElementById('library-screen');
const readerScreen = document.getElementById('reader-screen');
const textList = document.getElementById('text-list');
const emptyState = document.getElementById('empty-state');
const pasteBtn = document.getElementById('paste-btn');
const settingsBtn = document.getElementById('settings-btn');

// Reader
const backBtn = document.getElementById('back-btn');
const wordPre = document.getElementById('word-pre');
const wordORP = document.getElementById('word-orp');
const wordPost = document.getElementById('word-post');
const wordDisplay = document.getElementById('word-display');
const focusGuide = wordDisplay.querySelector('.focus-guide');
const wordCounter = document.getElementById('word-counter');
const progressBar = document.getElementById('reader-progress-bar');
const readerTopBar = document.getElementById('reader-top-bar');
const readerControls = document.getElementById('reader-controls');
const speedDown = document.getElementById('speed-down');
const speedUp = document.getElementById('speed-up');
const wpmDisplay = document.getElementById('wpm-display');
const playPauseBtn = document.getElementById('play-pause-btn');
const playIcon = document.getElementById('play-icon');
const pauseIcon = document.getElementById('pause-icon');

// Settings modal
const settingsModal = document.getElementById('settings-modal');
const settingsClose = document.getElementById('settings-close');
const setWpm = document.getElementById('set-wpm');
const setWpmVal = document.getElementById('set-wpm-val');
const setFontsize = document.getElementById('set-fontsize');
const setFontsizeVal = document.getElementById('set-fontsize-val');
const setOrp = document.getElementById('set-orp');
const setGuide = document.getElementById('set-guide');
const clearDataBtn = document.getElementById('clear-data-btn');

// Paste modal (fallback)
const pasteModal = document.getElementById('paste-modal');
const pasteModalClose = document.getElementById('paste-modal-close');
const pasteTextarea = document.getElementById('paste-textarea');
const pasteSaveBtn = document.getElementById('paste-save-btn');


// ===== State =====
let currentTextId = null;
let controlsTimeout = null;

// ===== Reader engine =====
const reader = new Reader({
  onWord({ pre, orp, post, index, total }) {
    wordPre.textContent = pre;
    wordORP.textContent = orp;
    wordPost.textContent = post;
    wordCounter.textContent = `${index + 1} / ${total}`;
  },
  onProgress(pct) {
    progressBar.style.width = (pct * 100) + '%';
  },
  onEnd() {
    updatePlayPauseUI(false);
    savePosition();
  },
  onStateChange(playing) {
    updatePlayPauseUI(playing);
    if (!playing) savePosition();
  },
});

// ===== Init =====
async function init() {
  loadSettings();
  await renderLibrary();
  registerServiceWorker();
}

// ===== Settings =====
function loadSettings() {
  const wpm = getSetting('sr_wpm');
  const fontSize = getSetting('sr_fontSize');
  const showORP = getSetting('sr_showORP');
  const showGuide = getSetting('sr_showGuide');

  reader.setWPM(wpm);
  applyWPM(wpm);
  applyFontSize(fontSize);
  applyORP(showORP);
  applyGuide(showGuide);

  setWpm.value = wpm;
  setWpmVal.textContent = wpm + ' WPM';
  setFontsize.value = fontSize;
  setFontsizeVal.textContent = fontSize + 'px';
  setOrp.checked = showORP;
  setGuide.checked = showGuide;
}

function applyWPM(wpm) {
  reader.setWPM(wpm);
  wpmDisplay.textContent = wpm + ' WPM';
}

function applyFontSize(px) {
  wordDisplay.querySelectorAll('span').forEach(s => s.style.fontSize = px + 'px');
}

function applyORP(show) {
  wordDisplay.classList.toggle('no-orp', !show);
}

function applyGuide(show) {
  focusGuide.classList.toggle('hidden', !show);
}

// ===== Library =====
async function renderLibrary() {
  const texts = await getAllTexts();
  // Remove old cards
  textList.querySelectorAll('.text-card').forEach(c => c.remove());

  if (texts.length === 0) {
    emptyState.style.display = 'flex';
    return;
  }
  emptyState.style.display = 'none';

  // Sort by lastReadAt desc, then createdAt desc
  texts.sort((a, b) => {
    const da = a.lastReadAt || a.createdAt;
    const db = b.lastReadAt || b.createdAt;
    return db.localeCompare(da);
  });

  for (const t of texts) {
    const card = createCard(t);
    textList.appendChild(card);
  }
}

function createCard(t) {
  const card = document.createElement('div');
  card.className = 'text-card';
  card.dataset.id = t.id;

  const progress = t.wordCount > 0 ? Math.round((t.currentWord / t.wordCount) * 100) : 0;

  card.innerHTML = `
    <button class="text-card-delete-icon" aria-label="Delete">
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/></svg>
    </button>
    <div class="text-card-title">${escapeHtml(t.title)}</div>
    <div class="text-card-meta">
      <span>${t.wordCount} words</span>
      <span>${progress}%</span>
    </div>
    <div class="text-card-progress">
      <div class="text-card-progress-fill" style="width: ${progress}%"></div>
    </div>
  `;

  // Tap to open
  card.addEventListener('click', (e) => {
    if (e.target.closest('.text-card-delete-icon')) return;
    openReader(t.id);
  });

  // Delete button
  card.querySelector('.text-card-delete-icon').addEventListener('click', async () => {
    if (confirm('Delete this text?')) {
      await deleteText(t.id);
      await renderLibrary();
    }
  });

  return card;
}

// ===== Paste Flow =====
pasteBtn.addEventListener('click', async () => {
  const result = await readClipboard();
  if (result.ok) {
    await addText('', result.text);
    await renderLibrary();
  } else {
    showPasteModal();
  }
});

function showPasteModal() {
  pasteTextarea.value = '';
  pasteModal.hidden = false;
  pasteTextarea.focus();
}

pasteModalClose.addEventListener('click', () => { pasteModal.hidden = true; });

pasteSaveBtn.addEventListener('click', async () => {
  const text = pasteTextarea.value.trim();
  if (!text) return;
  await addText('', text);
  pasteModal.hidden = true;
  await renderLibrary();
});

// ===== Reader =====
async function openReader(id) {
  const t = await getText(id);
  if (!t) return;
  currentTextId = id;
  t.lastReadAt = new Date().toISOString();
  await saveText(t);

  showScreen('reader');
  reader.load(t.content, t.currentWord || 0);
  showControls();
}

function showScreen(name) {
  libraryScreen.classList.toggle('active', name === 'library');
  readerScreen.classList.toggle('active', name === 'reader');
}

async function savePosition() {
  if (!currentTextId) return;
  const t = await getText(currentTextId);
  if (!t) return;
  t.currentWord = reader.currentIndex;
  t.lastReadAt = new Date().toISOString();
  await saveText(t);
}

// Back button
backBtn.addEventListener('click', async () => {
  reader.pause();
  await savePosition();
  currentTextId = null;
  showScreen('library');
  await renderLibrary();
  clearWord();
});

function clearWord() {
  wordPre.textContent = '';
  wordORP.textContent = '';
  wordPost.textContent = '';
  progressBar.style.width = '0%';
  wordCounter.textContent = '0 / 0';
}

// Play / Pause — tap on word area
wordDisplay.addEventListener('click', () => {
  reader.toggle();
  showControls();
});

function updatePlayPauseUI(playing) {
  playIcon.style.display = playing ? 'none' : 'block';
  pauseIcon.style.display = playing ? 'block' : 'none';
}

// Speed controls
speedDown.addEventListener('click', (e) => {
  e.stopPropagation();
  changeSpeed(-25);
});

speedUp.addEventListener('click', (e) => {
  e.stopPropagation();
  changeSpeed(25);
});

function changeSpeed(delta) {
  const newWPM = Math.max(100, Math.min(1200, reader.wpm + delta));
  applyWPM(newWPM);
  setSetting('sr_wpm', newWPM);
  setWpm.value = newWPM;
  setWpmVal.textContent = newWPM + ' WPM';
  showControls();
}

// Swipe on reader for speed change
let touchStartX = 0;
let touchStartY = 0;
readerScreen.addEventListener('touchstart', (e) => {
  touchStartX = e.touches[0].clientX;
  touchStartY = e.touches[0].clientY;
}, { passive: true });

readerScreen.addEventListener('touchend', (e) => {
  const dx = e.changedTouches[0].clientX - touchStartX;
  const dy = e.changedTouches[0].clientY - touchStartY;
  // Only trigger if horizontal swipe is dominant and exceeds threshold
  if (Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy) * 1.5) {
    changeSpeed(dx > 0 ? 25 : -25);
  }
});

// Auto-hide controls
function showControls() {
  readerTopBar.classList.remove('hidden');
  readerControls.classList.remove('hidden');
  clearTimeout(controlsTimeout);
  if (reader.playing) {
    controlsTimeout = setTimeout(() => {
      readerTopBar.classList.add('hidden');
      readerControls.classList.add('hidden');
    }, 2000);
  }
}

// Play/pause button
playPauseBtn.addEventListener('click', (e) => {
  e.stopPropagation();
  reader.toggle();
  showControls();
});

// ===== Visibility change: auto-pause =====
document.addEventListener('visibilitychange', () => {
  if (document.hidden && reader.playing) {
    reader.pause();
    savePosition();
  }
});

// ===== Settings Modal =====
settingsBtn.addEventListener('click', () => { settingsModal.hidden = false; });
settingsClose.addEventListener('click', () => { settingsModal.hidden = true; });

settingsModal.addEventListener('click', (e) => {
  if (e.target === settingsModal) settingsModal.hidden = true;
});

setWpm.addEventListener('input', () => {
  const v = parseInt(setWpm.value);
  setWpmVal.textContent = v + ' WPM';
  applyWPM(v);
  setSetting('sr_wpm', v);
});

setFontsize.addEventListener('input', () => {
  const v = parseInt(setFontsize.value);
  setFontsizeVal.textContent = v + 'px';
  applyFontSize(v);
  setSetting('sr_fontSize', v);
});

setOrp.addEventListener('change', () => {
  applyORP(setOrp.checked);
  setSetting('sr_showORP', setOrp.checked);
});

setGuide.addEventListener('change', () => {
  applyGuide(setGuide.checked);
  setSetting('sr_showGuide', setGuide.checked);
});

clearDataBtn.addEventListener('click', async () => {
  if (confirm('Delete all saved texts and reset settings?')) {
    await clearAll();
    localStorage.clear();
    loadSettings();
    settingsModal.hidden = true;
    await renderLibrary();
  }
});

// ===== Helpers =====
function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

// ===== Service Worker =====
function registerServiceWorker() {
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('sw.js').catch(() => {});
  }
}

// ===== Boot =====
init();
