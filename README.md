# yoink

A small TikTok downloader I run locally. Paste a link, get the original
full-bitrate file with no watermark. No ads, no account, no API key.

## Why this exists

Most "no watermark" downloaders give you a heavily compressed copy. TikTok
actually keeps two versions of every video: a light web stream around 1 to 2
Mbps, and the original upload (the `*_original.mp4`) that runs 13 to 14 Mbps at
60fps. Plain yt-dlp only sees the light one. yoink pulls the original.

Same video, three ways:

| Got it from | Codec | Resolution | Bitrate |
|-------------|-------|------------|---------|
| ssstik | H.264 | 1080x1920 | 13.4 Mbps |
| yoink | H.264 | 1080x1920 | 13.4 Mbps |
| plain yt-dlp | HEVC | 1080x1920 | 1.9 Mbps |

The yoink and ssstik files came out byte for byte identical (same MD5), so it's
literally the same source file, not a re-encode. 1080p is the ceiling either way
since TikTok has no 4K, but the bitrate is the part that was actually missing.

## Running it

```bash
cd ~/Projects/yoink
npm install      # also fetches yt-dlp + ffmpeg into bin/ (postinstall)
npm start        # http://localhost:3000
```

Open the page, paste a link, pick a format. If a download breaks after some
TikTok change, refresh the local fallback with `npm run update-engine`.

## How it gets the file

Two engines, picked automatically:

1. `@tobyg74/tiktok-api-dl` is the main one. It reaches TikTok's original HD
   source plus metadata, music and photo-post images. Free, no key. It does go
   through a third-party backend (the same kind ssstik uses), so it depends on
   that staying up.
2. Vendored `yt-dlp` is the backup. Fully local, works offline, and handles the
   mp3 extraction with ffmpeg. If the API path fails, yoink quietly drops to this.

You can turn either off in `src/config.js`.

## What you can pull

| Type | Output |
|------|--------|
| Video | mp4, H.264, original 1080p bitrate |
| Audio | mp3, 320k |
| Photo post | zip of the images |

The video is H.264, so it plays everywhere and imports cleanly into editors.

## Layout

```
src/
  server.js          express: the UI plus /api/resolve and /api/download
  config.js          paths and engine toggles
  engines/
    tobyApi.js       HD source, metadata, images
    ytdlp.js         local fallback video and mp3
  lib/
    resolve.js       picks an engine, returns normalized metadata
    download.js      video / audio / images streaming
    util.js          slug, fetch, cleanup
scripts/setup.mjs    fetches yt-dlp + ffmpeg into bin/ on install
public/              index.html, style.css, app.js
bin/                 yt-dlp, ffmpeg, ffprobe (gitignored, fetched on install)
```

## One caveat

Saving and reposting other people's TikToks can run against TikTok's terms and a
creator's copyright. I use this for personal stuff. Don't put it online as a
public service.
