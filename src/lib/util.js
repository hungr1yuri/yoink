// Small shared helpers.
import fs from 'node:fs';

const UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 ' +
  '(KHTML, like Gecko) Chrome/120.0 Safari/537.36';

// Safe, short filename slug from a caption.
export function slug(str = '') {
  return (str || 'video')
    .replace(/https?:\/\/\S+/g, '')
    .replace(/[#@]\S+/g, '')
    .normalize('NFKD').replace(/[^\w\s-]/g, '')
    .trim().replace(/\s+/g, '-').slice(0, 50) || 'video';
}

// Which site a link belongs to, or null if we don't handle it.
// Only http(s) counts: new URL() is happy with file:// and other schemes, and
// the hostname alone would otherwise let one through.
export function detectPlatform(u) {
  try {
    const { protocol, hostname } = new URL(u);
    if (protocol !== 'http:' && protocol !== 'https:') return null;
    const h = hostname.toLowerCase();
    // vt./vm. short links already end in .tiktok.com
    if (/(^|\.)tiktok\.com$|(^|\.)douyin\.com$/.test(h)) return 'tiktok';
    if (/(^|\.)youtube\.com$|(^|\.)youtu\.be$|(^|\.)youtube-nocookie\.com$/.test(h)) return 'youtube';
    return null;
  } catch { return null; }
}

export function isSupportedUrl(u) {
  return detectPlatform(u) !== null;
}

export function isTikTokUrl(u) {
  return detectPlatform(u) === 'tiktok';
}

// pick first usable string from a value that may be string | string[].
export function firstUrl(v) {
  if (!v) return null;
  if (Array.isArray(v)) return v.find(Boolean) || null;
  return typeof v === 'string' ? v : null;
}

export async function fetchStream(url) {
  const res = await fetch(url, { headers: { 'User-Agent': UA }, redirect: 'follow' });
  if (!res.ok || !res.body) throw new Error(`fetch ${res.status} for media`);
  return res;
}

export async function fetchBuffer(url) {
  const res = await fetch(url, { headers: { 'User-Agent': UA }, redirect: 'follow' });
  if (!res.ok) throw new Error(`fetch ${res.status}`);
  const type = (res.headers.get('content-type') || '').split(';')[0].trim().toLowerCase();
  const buf = Buffer.from(await res.arrayBuffer());
  return { buf, type };
}

// TikTok serves slideshow frames as webp about as often as jpeg, and the URL
// doesn't always say which. Take the server's word for it, fall back to the
// extension, and only then guess.
export function imageExt(contentType, url) {
  const known = { 'image/webp': 'webp', 'image/png': 'png', 'image/heic': 'heic', 'image/jpeg': 'jpg' };
  if (known[contentType]) return known[contentType];
  const m = /\.(webp|png|jpe?g|heic)(?:[?#]|$)/i.exec(url || '');
  if (m) return m[1].toLowerCase() === 'jpeg' ? 'jpg' : m[1].toLowerCase();
  return 'jpg';
}

export function cleanup(filePath) {
  if (filePath) fs.rm(filePath, { force: true }, () => {});
}

export { UA };
