// Engine: local yt-dlp (vendored). Fully offline-capable fallback + MP3 extractor.
// Never sees TikTok's HD source (web path only) but always available and key-free.

import { execFile } from 'node:child_process';
import { YTDLP, BIN, DOWNLOADS } from '../config.js';
import path from 'node:path';
import fs from 'node:fs';

const COMMON = ['--no-warnings', '--no-playlist', '--ffmpeg-location', BIN];

function run(args, { maxBuffer = 64 * 1024 * 1024 } = {}) {
  return new Promise((resolve, reject) => {
    execFile(YTDLP, args, { maxBuffer }, (err, stdout, stderr) => {
      if (err) { err.stderr = stderr; return reject(err); }
      resolve(stdout);
    });
  });
}

export async function resolve(url) {
  const j = JSON.parse(await run([...COMMON, '-J', '--', url]));
  const shortEdges = (j.formats || [])
    .filter(f => f.width && f.height).map(f => Math.min(f.width, f.height));
  return {
    ok: true,
    source: 'yt-dlp',
    type: 'video',
    author: j.uploader || j.uploader_id || 'tiktok',
    nickname: j.uploader || '',
    caption: j.title || j.description || '',
    cover: j.thumbnail || '',
    duration: Math.round(j.duration || 0),
    imageCount: 0,
    quality: shortEdges.length ? `${Math.max(...shortEdges)}p` : 'SD',
  };
}

// Download best video locally -> temp file path.
export async function downloadVideo(url, stamp) {
  const base = path.join(DOWNLOADS, stamp);
  await run([...COMMON, '-f', 'bv*+ba/b', '--merge-output-format', 'mp4', '-o', `${base}.%(ext)s`, '--', url]);
  const f = fs.readdirSync(DOWNLOADS).find(n => n.startsWith(stamp));
  return path.join(DOWNLOADS, f);
}

// Extract MP3 from the post's audio -> temp file path.
export async function downloadAudio(url, stamp) {
  const base = path.join(DOWNLOADS, stamp);
  await run([...COMMON, '-x', '--audio-format', 'mp3', '--audio-quality', '0', '-o', `${base}.%(ext)s`, '--', url]);
  return `${base}.mp3`;
}
