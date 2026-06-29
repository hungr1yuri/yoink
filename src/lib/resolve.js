// Orchestrates the engines into one normalized result.
// API first (gives HD + photo posts + metadata); yt-dlp as offline fallback.
import * as api from '../engines/tobyApi.js';
import * as ytdlp from '../engines/ytdlp.js';
import { ENABLE_API, ENABLE_YTDLP } from '../config.js';
import { isTikTokUrl } from './util.js';

export async function resolve(url) {
  if (!isTikTokUrl(url)) throw new Error('That doesn\'t look like a TikTok link.');

  const errors = [];
  if (ENABLE_API) {
    try { return await api.resolve(url); }
    catch (e) { errors.push(`api: ${e.message}`); }
  }
  if (ENABLE_YTDLP) {
    try { return await ytdlp.resolve(url); }
    catch (e) { errors.push(`yt-dlp: ${e.message}`); }
  }
  throw new Error(`Could not read this link. ${errors.join(' | ')}`);
}
