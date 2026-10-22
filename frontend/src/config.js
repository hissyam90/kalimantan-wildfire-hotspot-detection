import axios from 'axios';

const DEV_FALLBACK = 'http://127.0.0.1:7860';

function normalizeBase(value) {
  try {
    const url = new URL(value.trim().replace(/^['"]|['"]$/g, ''));
    if (url.protocol !== 'http:' && url.protocol !== 'https:') return '';
    return url.origin + url.pathname.replace(/\/+$/, '');
  } catch {
    return '';
  }
}

const rawBase = import.meta.env.VITE_API_URL || '';
const configured = normalizeBase(rawBase);
const fallback = import.meta.env.DEV ? DEV_FALLBACK : window.location.origin;
const base = configured || fallback;

if (rawBase && !configured) {
  console.warn(`VITE_API_URL diabaikan karena bukan URL http/https yang valid: ${rawBase}`);
}

export const API_URL = window.location.protocol === 'https:' && base.startsWith('http://')
  ? window.location.origin
  : base;
export const IS_TUNNEL = /ngrok/i.test(API_URL);
export const TUNNEL_HEADERS = IS_TUNNEL ? { 'ngrok-skip-browser-warning': '1' } : {};

if (IS_TUNNEL) {
  axios.defaults.headers.common['ngrok-skip-browser-warning'] = '1';
}
