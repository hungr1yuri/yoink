// Download orchestration. Each function writes to the Express response.
import { Readable } from 'node:stream';
import fs from 'node:fs';
import { createRequire } from 'node:module';
import * as api from '../engines/tobyApi.js';
import * as ytdlp from '../engines/ytdlp.js';
import { ENABLE_API, ENABLE_YTDLP } from '../config.js';
import { slug, fetchStream, fetchBuffer, cleanup } from './util.js';

const require = createRequire(import.meta.url);
const archiver = require('archiver');

const stamp = () => `${Date.now()}-${Math.floor(Math.random() * 1e6)}`;

function disposition(name, ext) {
  return `attachment; filename="${name}.${ext}"`;
}

// VIDEO: prefer API HD (original source), fall back to local yt-dlp.
export async function sendVideo(url, caption, res) {
  const name = slug(caption);

  if (ENABLE_API) {
    try {
      const { url: mediaUrl, quality } = await api.getVideoUrl(url);
      const upstream = await fetchStream(mediaUrl);
      res.setHeader('Content-Type', 'video/mp4');
      res.setHeader('X-Yoink-Quality', quality);
      if (upstream.headers.get('content-length'))
        res.setHeader('Content-Length', upstream.headers.get('content-length'));
      res.setHeader('Content-Disposition', disposition(`${name}${quality === 'HD' ? '-HD' : ''}`, 'mp4'));
      await streamWeb(upstream.body, res);
      return;
    } catch (e) {
      if (!ENABLE_YTDLP) throw e;
      // else fall through to local engine
    }
  }

  // local fallback
  const s = stamp();
  const filePath = await ytdlp.downloadVideo(url, s);
  res.download(filePath, `${name}.mp4`, () => cleanup(filePath));
}

// AUDIO: extract MP3 locally with yt-dlp + ffmpeg (faithful to the post's audio).
export async function sendAudio(url, caption, res) {
  const name = slug(caption);
  const s = stamp();
  const filePath = await ytdlp.downloadAudio(url, s);
  res.download(filePath, `${name}.mp3`, () => cleanup(filePath));
}

// IMAGES: photo/slideshow posts become a zip of JPEGs.
export async function sendImages(url, caption, res) {
  const name = slug(caption);
  const images = await api.getImages(url);
  res.setHeader('Content-Type', 'application/zip');
  res.setHeader('Content-Disposition', disposition(name, 'zip'));
  const zip = archiver('zip', { zlib: { level: 6 } });
  zip.on('error', err => { throw err; });
  zip.pipe(res);
  for (let i = 0; i < images.length; i++) {
    const buf = await fetchBuffer(images[i]);
    zip.append(buf, { name: `${name}-${String(i + 1).padStart(2, '0')}.jpg` });
  }
  await zip.finalize();
}

// pipe a web ReadableStream to an Express response, resolving on finish.
function streamWeb(webBody, res) {
  return new Promise((resolve, reject) => {
    const node = Readable.fromWeb(webBody);
    node.on('error', reject);
    res.on('finish', resolve);
    res.on('error', reject);
    node.pipe(res);
  });
}
