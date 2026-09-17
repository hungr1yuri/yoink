// Engine: local yt-dlp (vendored). Fully local, no key, no third-party backend.
//
// For TikTok it's the fallback: it only sees the light web stream, never the
// original source file, but it always works and it does the mp3 extraction.
// For YouTube it's the only engine, and there it is the best path there is.

import { execFile } from 'node:child_process';
import { YTDLP, BIN, DOWNLOADS, JS_RUNTIME } from '../config.js';
import path from 'node:path';
import fs from 'node:fs';

const COMMON = [
  '--no-warnings', '--no-playlist',
  '--ffmpeg-location', BIN,
  '--js-runtimes', `node:${JS_RUNTIME}`,
];

// H.264 + AAC in mp4: plays on anything and imports into any editor. On YouTube
// this caps at 1080p, because YouTube serves nothing above it in H.264.
const F_H264 = 'bv*[vcodec^=avc1]+ba[acodec^=mp4a]/bv*[vcodec^=avc1]+ba/b[vcodec^=avc1]/b';
// Highest resolution available, whatever the codec. On YouTube that means VP9
// or AV1 video and Opus audio above 1080p.
const F_BEST = 'bv*+ba/b';

export const FORMATS = { h264: F_H264, max: F_BEST };

function run(args, { maxBuffer = 64 * 1024 * 1024 } = {}) {
  return new Promise((resolve, reject) => {
    execFile(YTDLP, args, { maxBuffer }, (err, stdout, stderr) => {
      if (err) { err.stderr = stderr; return reject(err); }
      resolve(stdout);
    });
  });
}

const shortEdge = f => Math.min(f.width, f.height);

// yt-dlp emits its format list already sorted worst to best by its OWN ranking,
// so the last match is the one its selector would actually download. Scanning
// from the end is therefore ground truth; sorting them again by bitrate is not,
// and picked a different format than yt-dlp did.
function lastMatch(formats, ok) {
  for (let i = formats.length - 1; i >= 0; i--) if (ok(formats[i])) return formats[i];
  return null;
}

const isVideo = f => f.width && f.height && f.vcodec && f.vcodec !== 'none';
const isAudioOnly = f => (!f.vcodec || f.vcodec === 'none') && f.acodec && f.acodec !== 'none';

// Codec strings differ by which YouTube client answered (avc1.640028, vp09.00.50.08,
// vp9, av01..., mp4a.40.2). Reduce them to the name a person would recognise.
function codecName(raw) {
  const c = String(raw || '').toLowerCase();
  if (c.startsWith('avc1') || c.startsWith('h264')) return 'h264';
  if (c.startsWith('av01')) return 'av1';
  if (c.startsWith('vp09') || c.startsWith('vp9')) return 'vp9';
  if (c.startsWith('vp08') || c.startsWith('vp8')) return 'vp8';
  if (c.startsWith('mp4a')) return 'aac';
  if (c.startsWith('opus')) return 'opus';
  if (c.startsWith('none') || !c) return null;
  return c.split('.')[0];
}

const isAvc = f => codecName(f.vcodec) === 'h264';
const isAac = f => codecName(f.acodec) === 'aac';

// Some clients answer without any size at all. Report nothing rather than a
// number that is really just the audio track.
function totalSize(...picks) {
  let n = 0;
  for (const f of picks) {
    if (!f) continue;
    const b = f.filesize || f.filesize_approx || 0;
    if (!b) return 0;
    n += b;
  }
  return n;
}

// What each of the two buttons would actually get.
function variants(formats) {
  const h264V = lastMatch(formats, f => isVideo(f) && isAvc(f));
  const maxV = lastMatch(formats, isVideo);
  const aacA = lastMatch(formats, f => isAudioOnly(f) && isAac(f));
  const anyA = lastMatch(formats, isAudioOnly);

  const out = {};
  if (h264V) {
    const a = aacA || anyA;
    out.h264 = {
      height: shortEdge(h264V),
      vcodec: 'h264',
      acodec: codecName(h264V.acodec) || (a ? codecName(a.acodec) : null),
      size: totalSize(h264V, h264V.acodec && h264V.acodec !== 'none' ? null : a),
    };
  }
  if (maxV) {
    out.max = {
      height: shortEdge(maxV),
      vcodec: codecName(maxV.vcodec),
      acodec: codecName(maxV.acodec) || (anyA ? codecName(anyA.acodec) : null),
      size: totalSize(maxV, maxV.acodec && maxV.acodec !== 'none' ? null : anyA),
    };
  }
  return out;
}

export async function resolve(url, platform = 'tiktok') {
  const j = JSON.parse(await run([...COMMON, '-J', '--', url]));
  const formats = j.formats || [];
  const v = variants(formats);
  const edges = formats.filter(f => f.width && f.height).map(shortEdge);

  return {
    ok: true,
    source: 'yt-dlp',
    type: 'video',
    author: j.uploader || j.uploader_id || j.channel || platform,
    nickname: j.channel || j.uploader || '',
    caption: j.title || j.description || '',
    cover: j.thumbnail || '',
    duration: Math.round(j.duration || 0),
    imageCount: 0,
    quality: edges.length ? `${Math.max(...edges)}p` : 'SD',
    variants: v,
    // Only worth showing two buttons when they'd actually differ.
    hasMax: !!(v.h264 && v.max && v.max.height > v.h264.height),
  };
}

// Download to a temp file and hand back the path. `want` is a key of FORMATS.
export async function downloadVideo(url, stamp, want = 'h264') {
  const base = path.join(DOWNLOADS, stamp);
  await run([
    ...COMMON,
    '-f', FORMATS[want] || FORMATS.h264,
    '--merge-output-format', 'mp4',
    '-o', `${base}.%(ext)s`, '--', url,
  ]);
  const f = fs.readdirSync(DOWNLOADS).find(n => n.startsWith(stamp));
  if (!f) throw new Error('yt-dlp produced no file');
  return path.join(DOWNLOADS, f);
}

// Extract the audio track to mp3. --audio-quality 0 is LAME VBR V0, which lands
// around 245-260 kbps on these sources; it is not a fixed 320.
export async function downloadAudio(url, stamp) {
  const base = path.join(DOWNLOADS, stamp);
  await run([...COMMON, '-x', '--audio-format', 'mp3', '--audio-quality', '0', '-o', `${base}.%(ext)s`, '--', url]);
  return `${base}.mp3`;
}
