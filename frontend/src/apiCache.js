import axios from 'axios';


export const CLIENT_CACHE_MS = 120000; // 2 menit, di bawah cache server (10 menit)
const PREFIX = 'wildfire-cache:';

const memory = new Map();
const pending = new Map();

function storage(persist) {
  if (persist !== 'local') return null;
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

export function readCache(key, persist) {
  const hit = memory.get(key);
  if (hit) return hit;
  const store = storage(persist);
  if (!store) return null;
  try {
    const raw = store.getItem(PREFIX + key);
    if (!raw) return null;
    const entry = JSON.parse(raw);
    if (!entry || !entry.data || typeof entry.storedAt !== 'number') return null;
    memory.set(key, entry);
    return entry;
  } catch {
    return null;
  }
}

export function writeCache(key, data, persist) {
  const entry = { data, storedAt: Date.now() };
  memory.set(key, entry);
  const store = storage(persist);
  if (!store) return entry;
  try {
    store.setItem(PREFIX + key, JSON.stringify(entry));
  } catch {
    // Kuota penuh atau mode privat: data tetap tersedia di memori.
  }
  return entry;
}

export function clearCache(key, persist) {
  memory.delete(key);
  pending.delete(key);
  const store = storage(persist);
  if (!store) return;
  try {
    store.removeItem(PREFIX + key);
  } catch {
    // Tidak ada yang perlu dibersihkan.
  }
}

/**
 * Ambil data dengan pola cache-first.
 * @returns {{cached: {data: any, storedAt: number} | null,
 *            fresh: Promise<{data: any, fromCache: boolean}>}}
 * `cached` dipakai untuk render seketika; `fresh` selalu dijalankan agar data
 * diperbarui, kecuali salinan cache masih lebih baru dari `maxAgeMs`.
 */
export function cachedGet(key, url, { persist, maxAgeMs = 0, ...config } = {}) {
  const cached = readCache(key, persist);
  if (cached && maxAgeMs > 0 && Date.now() - cached.storedAt < maxAgeMs) {
    return { cached, fresh: Promise.resolve({ data: cached.data, fromCache: true }) };
  }
  let request = pending.get(key);
  if (!request) {
    request = axios
      .get(url, config)
      .then((response) => {
        writeCache(key, response.data, persist);
        return { data: response.data, fromCache: false };
      })
      .finally(() => {
        pending.delete(key);
      });
    pending.set(key, request);
  }
  return { cached, fresh: request };
}
