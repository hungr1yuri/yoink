// Orchestrates the engines into one normalized result.
//
// TikTok: the API first (it reaches the original source file, photo posts and
// the richer metadata), local yt-dlp behind it.
// YouTube: yt-dlp only. The TikTok API knows nothing about YouTube, so asking it
// would just cost a round trip and a misleading error.
import * as api from '../engines/tobyApi.js';
import * as ytdlp from '../engines/ytdlp.js';
import { ENABLE_API, ENABLE_YTDLP } from '../config.js';
import { detectPlatform } from './util.js';

const NOT_OURS = 'That link isn\'t a TikTok or YouTube one.';

export async function resolve(url) {
  const platform = detectPlatform(url);
  if (!platform) throw new Error(NOT_OURS);

  const errors = [];

  if (platform === 'tiktok' && ENABLE_API) {
    try { return { ...(await api.resolve(url)), platform }; }
    catch (e) { errors.push(`api: ${e.message}`); }
  }

  if (ENABLE_YTDLP) {
    try { return { ...(await ytdlp.resolve(url, platform)), platform }; }
    catch (e) { errors.push(`yt-dlp: ${e.message}`); }
  }

  throw new Error(`Could not read this link. ${errors.join(' | ')}`);
}
