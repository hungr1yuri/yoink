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

export const PORT = process.env.PORT || 3000;

// Engine toggles
export const ENABLE_API = true;     // tobyg74 (HD source), the quality win
export const ENABLE_YTDLP = true;   // local yt-dlp, offline-capable fallback

fs.mkdirSync(DOWNLOADS, { recursive: true });
