// Download orchestration. Each function writes to the Express response.
import { Readable } from 'node:stream';
import { ZipArchive } from 'archiver';
import * as api from '../engines/tobyApi.js';
import * as ytdlp from '../engines/ytdlp.js';
import { ENABLE_API, ENABLE_YTDLP } from '../config.js';
import { slug, fetchStream, fetchBuffer, imageExt, cleanup, detectPlatform } from './util.js';

const stamp = () => `${Date.now()}-${Math.floor(Math.random() * 1e6)}`;

function disposition(name, ext) {
  return `attachment; filename="${name}.${ext}"`;
}

// VIDEO.
//   TikTok: the API's HD original first, local yt-dlp behind it.
//   YouTube: yt-dlp, with the format set the caller asked for.
// `want` is 'h264' (plays and edits everywhere) or 'max' (tallest available,
// which above 1080p means VP9/AV1 video and Opus audio).
export async function sendVideo(url, caption, res, want = 'h264') {
  const name = slug(caption);
  const platform = detectPlatform(url);

  if (platform === 'tiktok' && ENABLE_API) {
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
      // else fall through to the local engine
    }
  }

  // The h264/max choice is a YouTube thing, where H.264 stops at 1080p and the
  // taller formats are VP9/AV1. TikTok doesn't work that way: it lists a 720p
  // H.264 but its best web format is 1080p HEVC, and both selectors land on that
  // HEVC anyway because the H.264 one ends in a plain /b fallback. Asking for
  // 'max' here says that outright instead of leaning on the fallback to save it.
  const pick = platform === 'tiktok' ? 'max' : want;
  const s = stamp();
  const filePath = await ytdlp.downloadVideo(url, s, pick);
  const suffix = pick === 'max' && platform !== 'tiktok' ? '-max' : '';
  res.download(filePath, `${name}${suffix}.mp4`, () => cleanup(filePath));
}

// AUDIO: yt-dlp + ffmpeg pull the post's own audio track out to mp3.
export async function sendAudio(url, caption, res) {
  const name = slug(caption);
  const s = stamp();
  const filePath = await ytdlp.downloadAudio(url, s);
  res.download(filePath, `${name}.mp3`, () => cleanup(filePath));
}

// IMAGES: a TikTok photo post (slideshow) becomes a zip of its frames, in the
// order they appear in the post.
export async function sendImages(url, caption, res) {
  const name = slug(caption);
  const images = await api.getImages(url);
  res.setHeader('Content-Type', 'application/zip');
  res.setHeader('Content-Disposition', disposition(name, 'zip'));
  const zip = new ZipArchive({ zlib: { level: 6 } });
  // A stream error can't be caught by the caller's try/catch, so surface it as a
  // rejection instead of throwing inside the emitter (which would kill the process).
  const failed = new Promise((_, reject) => zip.on('error', reject));
  zip.pipe(res);
  for (let i = 0; i < images.length; i++) {
    const { buf, type } = await Promise.race([fetchBuffer(images[i]), failed]);
    const n = String(i + 1).padStart(2, '0');
    zip.append(buf, { name: `${name}-${n}.${imageExt(type, images[i])}` });
  }
  await Promise.race([zip.finalize(), failed]);
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
