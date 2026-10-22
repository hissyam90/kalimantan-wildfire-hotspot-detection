import axios from 'axios';

const configured = (import.meta.env.VITE_API_URL || '').trim().replace(/\/+$/, '');
const fallback = import.meta.env.DEV ? 'http://127.0.0.1:7860' : window.location.origin;

export const API_URL = configured || fallback;
export const IS_TUNNEL = /ngrok/i.test(API_URL);
export const TUNNEL_HEADERS = IS_TUNNEL ? { 'ngrok-skip-browser-warning': '1' } : {};

if (IS_TUNNEL) {
  axios.defaults.headers.common['ngrok-skip-browser-warning'] = '1';
}
