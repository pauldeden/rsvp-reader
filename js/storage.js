// ===== IndexedDB wrapper for texts + localStorage for settings =====

const DB_NAME = 'rsvp-reader-db';
const DB_VERSION = 1;
const STORE_NAME = 'texts';

let dbPromise = null;

function openDB() {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'id', autoIncrement: true });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
  return dbPromise;
}

function tx(mode) {
  return openDB().then(db => {
    const t = db.transaction(STORE_NAME, mode);
    return t.objectStore(STORE_NAME);
  });
}

export async function getAllTexts() {
  const store = await tx('readonly');
  return new Promise((resolve, reject) => {
    const req = store.getAll();
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export async function getText(id) {
  const store = await tx('readonly');
  return new Promise((resolve, reject) => {
    const req = store.get(id);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export async function saveText(record) {
  const store = await tx('readwrite');
  return new Promise((resolve, reject) => {
    const req = store.put(record);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

function firstNonBlankLine(text) {
  const line = text.split('\n').find(l => l.trim().length > 0);
  return line ? line.trim().substring(0, 80) : 'Untitled';
}

export async function addText(title, content) {
  const words = content.trim().split(/\s+/);
  const record = {
    title: title || firstNonBlankLine(content),
    content,
    wordCount: words.length,
    currentWord: 0,
    createdAt: new Date().toISOString(),
    lastReadAt: null,
  };
  const store = await tx('readwrite');
  return new Promise((resolve, reject) => {
    const req = store.add(record);
    req.onsuccess = () => {
      record.id = req.result;
      resolve(record);
    };
    req.onerror = () => reject(req.error);
  });
}

export async function deleteText(id) {
  const store = await tx('readwrite');
  return new Promise((resolve, reject) => {
    const req = store.delete(id);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
}

export async function clearAll() {
  const store = await tx('readwrite');
  return new Promise((resolve, reject) => {
    const req = store.clear();
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
}

// ===== Settings via localStorage =====

const DEFAULTS = {
  sr_wpm: 300,
  sr_fontSize: 44,
  sr_showORP: true,
  sr_showGuide: true,
};

export function getSetting(key) {
  const raw = localStorage.getItem(key);
  if (raw === null) return DEFAULTS[key];
  try {
    return JSON.parse(raw);
  } catch {
    return raw;
  }
}

export function setSetting(key, value) {
  localStorage.setItem(key, JSON.stringify(value));
}
