// Small shared helpers.
import fs from 'node:fs';

const UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 ' +
  '(KHTML, like Gecko) Chrome/120.0 Safari/537.36';

// Safe, short filename slug from a caption.
export function slug(str = '') {
  return (str || 'tiktok')
    .replace(/https?:\/\/\S+/g, '')
    .replace(/[#@]\S+/g, '')
    .normalize('NFKD').replace(/[^\w\s-]/g, '')
    .trim().replace(/\s+/g, '-').slice(0, 50) || 'tiktok';
}

export function isTikTokUrl(u) {
  try {
    const h = new URL(u).hostname;
    return /(^|\.)tiktok\.com$|(^|\.)vt\.tiktok\.com$|(^|\.)vm\.tiktok\.com$|douyin\.com$/.test(h);
  } catch { return false; }
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
  return Buffer.from(await res.arrayBuffer());
}

export function cleanup(filePath) {
  if (filePath) fs.rm(filePath, { force: true }, () => {});
}

export { UA };
