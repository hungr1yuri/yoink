// Engine: @tobyg74/tiktok-api-dl
//
// This is the quality win. It reaches TikTok's ORIGINAL source file
// (`*_original.mp4`, ~13 Mbps H.264) that ssstik/snaptik serve, the same file
// that yt-dlp's web path can't see. Free, no key.
//
//   v1 -> rich metadata, music, photo-post images, SD playAddr
//   v3 -> videoHD (the original source), videoSD, videoWatermark
//
// We use v1 for "what is this" and v3 for the HD bytes.

import TiktokModule from '@tobyg74/tiktok-api-dl';
import { firstUrl } from '../lib/util.js';

// the package's default export shape varies by loader; normalize it.
const Tiktok = TiktokModule.default || TiktokModule;

async function v1(url) {
  const r = await Tiktok.Downloader(url, { version: 'v1' });
  if (r?.status !== 'success' || !r.result) throw new Error(r?.message || 'v1 failed');
  return r.result;
}

async function v3(url) {
  const r = await Tiktok.Downloader(url, { version: 'v3' });
  if (r?.status !== 'success' || !r.result) throw new Error(r?.message || 'v3 failed');
  return r.result;
}

// Normalized metadata for the UI + a record of what's downloadable.
export async function resolve(url) {
  const d = await v1(url);
  const isImages = d.type === 'image' || (Array.isArray(d.images) && d.images.length > 0);
  return {
    ok: true,
    source: 'tiktok-api-dl',
    type: isImages ? 'images' : 'video',
    author: d.author?.uniqueId || d.author?.username || d.author?.nickname || 'tiktok',
    nickname: d.author?.nickname || '',
    caption: d.desc || '',
    cover: firstUrl(d.video?.cover) || firstUrl(d.video?.originCover) || firstUrl(d.author?.avatarThumb) || '',
    duration: Math.round((d.video?.duration || d.music?.duration || 0) / (d.video?.duration > 1000 ? 1000 : 1)) || 0,
    imageCount: isImages ? d.images.length : 0,
    quality: 'HD',          // we fetch the original source for video
    _images: isImages ? d.images : null,
    _musicUrl: firstUrl(d.music?.playUrl) || null,
    _sdUrl: firstUrl(d.video?.playAddr) || null,
  };
}

// Returns the best (HD/original) direct video URL, with SD as fallback.
export async function getVideoUrl(url) {
  try {
    const d = await v3(url);
    const hd = firstUrl(d.videoHD);
    const sd = firstUrl(d.videoSD);
    if (hd) return { url: hd, quality: 'HD' };
    if (sd) return { url: sd, quality: 'SD' };
  } catch { /* fall through to v1 */ }
  const d = await v1(url);
  const sd = firstUrl(d.video?.playAddr) || firstUrl(d.video?.downloadAddr);
  if (!sd) throw new Error('No video URL available from API.');
  return { url: sd, quality: 'SD' };
}

export async function getImages(url) {
  const d = await v1(url);
  if (!Array.isArray(d.images) || !d.images.length) throw new Error('No images on this post.');
  return d.images.map(firstUrl).filter(Boolean);
}
