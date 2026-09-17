// Central config + paths. One place to flip behaviour.
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import fs from 'node:fs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
export const ROOT = path.resolve(__dirname, '..');

export const BIN = path.join(ROOT, 'bin');
export const YTDLP = path.join(BIN, 'yt-dlp');
export const FFMPEG = path.join(BIN, 'ffmpeg');
export const PUBLIC = path.join(ROOT, 'public');
export const DOWNLOADS = path.join(ROOT, 'downloads');

export const PORT = process.env.PORT || 3001;

// yt-dlp needs a JavaScript runtime to solve YouTube's player challenges. It
// looks for Deno by default and doesn't bundle one, but yoink is a Node app, so
// hand it the exact Node that is already running the server. Nothing to install.
export const JS_RUNTIME = process.execPath;

// Engine toggles
export const ENABLE_API = true;     // tobyg74 (TikTok HD source), the quality win
export const ENABLE_YTDLP = true;   // local yt-dlp, TikTok fallback and the whole YouTube path

fs.mkdirSync(DOWNLOADS, { recursive: true });
