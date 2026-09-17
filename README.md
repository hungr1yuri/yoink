# yoink

A small downloader I run locally. Paste a TikTok or YouTube link, get the best
file the site actually has. No ads, no account, no API key.

## Why this exists

Most "no watermark" TikTok downloaders give you a heavily compressed copy.
TikTok keeps two versions of every video: a light web stream around 1 to 2 Mbps,
and the original upload (the `*_original.mp4`) that runs 13 to 14 Mbps at 60fps.
Plain yt-dlp only sees the light one. yoink pulls the original.

Same video, three ways:

| Got it from | Codec | Resolution | Bitrate |
|-------------|-------|------------|---------|
| ssstik | H.264 | 1080x1920 | 13.4 Mbps |
| yoink | H.264 | 1080x1920 | 13.4 Mbps |
| plain yt-dlp | HEVC | 1080x1920 | 1.9 Mbps |

The yoink and ssstik files came out byte for byte identical (same MD5), so it's
literally the same source file, not a re-encode. 1080p is the ceiling on TikTok
either way since it has no 4K, but the bitrate is the part that was missing.

YouTube is a different problem and gets a different answer. Nothing is hidden
there, so yt-dlp already reaches everything. What matters instead is which
format you want, and that turns out to be a real choice. See below.

## What you can pull

| Source | Type | Output |
|--------|------|--------|
| TikTok | Video | mp4, the original upload at its own full bitrate |
| TikTok | Photo post | zip of the slides, in the order they appear in the post |
| TikTok | Audio | mp3 |
| YouTube video or Short | Video | mp4, either H.264 up to 1080p or the tallest format available |
| YouTube video or Short | Audio | mp3 |

**TikTok photo posts** (the slideshows) come down as a zip, one file per slide,
numbered in post order. The frames are usually WebP and sometimes JPEG, so yoink
asks the server what each one is rather than assuming, and names the file to
match. A 7 slide deck came out as seven 1170x2080 WebP files.

**YouTube gives you two video buttons**, because there is no single best answer:

| Button | What you get | Measured on a 35s Short |
|--------|--------------|-------------------------|
| Video (H.264) | H.264 + AAC in mp4, capped at 1080p | 1080x1920, 3.1 Mbps, 14 MB |
| Max quality | The tallest format there is, which above 1080p means VP9 or AV1 video and Opus audio | 2160x3840 AV1, 11.2 Mbps, 48 MB |

YouTube serves no H.264 at all above 1080p, so 1440p and 4K are only reachable
as VP9 or AV1. Those play fine in a browser and in VLC, but QuickTime will not
open them and a lot of editors will not import them. The H.264 file goes
anywhere. The page shows the real resolution, codec and approximate size on each
button before you click, so you can decide per video.

The second button only appears when it would actually get you something taller.

The mp3 is LAME VBR at the highest quality setting. That lands around 256 kbps
on these sources, and it is limited by the audio the site served in the first
place, which is typically 128k AAC or 130k Opus. Re-encoding cannot add back
what was never there.

## Running it

```bash
cd ~/Documents/Projects/Personal/yoink
npm install      # also fetches yt-dlp + ffmpeg into bin/ (postinstall)
npm start        # http://localhost:3001
```

Open the page, paste a link, pick a format.

If a download breaks after a site change, refresh the local engine with
`npm run update-engine`. YouTube in particular breaks yt-dlp every few weeks, so
that is the first thing to try.

## How it gets the file

**TikTok** uses two engines, picked automatically:

1. `@tobyg74/tiktok-api-dl` is the main one. It reaches TikTok's original HD
   source plus metadata, music and photo post images. Free, no key. It does go
   through a third party backend (the same kind ssstik uses), so it depends on
   that staying up.
2. Vendored `yt-dlp` is the backup. Fully local and works offline. If the API
   path fails, yoink quietly drops to this.

**YouTube** only ever uses the vendored `yt-dlp`. The TikTok API knows nothing
about YouTube, so it is skipped entirely rather than asked and failed.

You can turn either engine off in `src/config.js`.

One thing worth knowing about the YouTube path: yt-dlp now needs a JavaScript
runtime to solve YouTube's player challenges. It looks for Deno by default and
does not bundle one. yoink is a Node app, so it hands yt-dlp the exact Node
already running the server. There is nothing extra to install.

## Security

`npm start` runs the whole thing inside a macOS sandbox (Seatbelt). The server
and anything it spawns are blocked from reading your SSH keys, Keychain, GitHub
token, browser data and cookies, and your Desktop/Downloads/Pictures, and from
writing any login or startup item. The sandbox is inherited by child processes,
so a dependency can't escape it by launching a shell. Normal stuff (network, the
project folder, the bundled yt-dlp/ffmpeg) keeps working.

This matters because of one dependency in particular. `@tobyg74/tiktok-api-dl`
is a single maintainer package, and to sign its requests it runs two of TikTok's
own browser scripts, `webmssdk.js` and `signature.js`. Those are 324 KB and
65 KB of minified code with lines up to 52,000 characters long, so nobody is
realistically reading them. They ship inside the package rather than being
fetched at runtime, and they are evaluated inside a jsdom window rather than in
Node's own scope, which is the right way to do it. The package itself has no
install hooks and is not obfuscated.

So there is no sign of anything malicious, and there is also no way to fully
verify those two blobs. The sandbox is the answer to that. It is why the YouTube
support added no new dependency: yt-dlp was already here.

Notes:
- macOS only. On other systems `npm start` runs without the sandbox and prints a
  notice.
- The project lives in `~/Documents`, so files elsewhere in Documents stay
  readable to the app. Everything else personal is off-limits.
- Escape hatch if you ever need it: `npm run start:raw` (no sandbox), or
  `YOINK_NO_SANDBOX=1 npm start`.
- The profile lives in `scripts/yoink.sb` if you want to tighten it further.

## Layout

```
src/
  server.js          express: the UI plus /api/resolve and /api/download
  config.js          paths, engine toggles, the JS runtime handed to yt-dlp
  engines/
    tobyApi.js       TikTok HD source, metadata, photo post images
    ytdlp.js         local engine: TikTok fallback, all of YouTube, mp3
  lib/
    resolve.js       detects the site, picks an engine, normalizes metadata
    download.js      video / audio / images streaming
    util.js          link detection, slug, fetch, image type, cleanup
scripts/setup.mjs    fetches yt-dlp + ffmpeg into bin/ on install
public/              index.html, style.css, app.js
bin/                 yt-dlp, ffmpeg, ffprobe (gitignored, fetched on install)
```

## One caveat

Saving and reposting other people's videos can run against a site's terms and a
creator's copyright. I use this for personal stuff. Don't put it online as a
public service.
