// Fetches the local engine binaries into bin/ so the repo itself stays light.
// Runs automatically after `npm install` (see package.json "postinstall"),
// or by hand with `npm run setup`.
//
// ffmpeg + ffprobe come from the npm packages already in node_modules.
// yt-dlp is downloaded from its official GitHub release for your platform.

import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const bin = path.join(root, 'bin');
fs.mkdirSync(bin, { recursive: true });

function copyBinary(srcPath, name) {
  const dest = path.join(bin, name);
  fs.copyFileSync(srcPath, dest);
  fs.chmodSync(dest, 0o755);
  console.log(`  bin/${name}  <-  ${path.relative(root, srcPath)}`);
}

// ffmpeg + ffprobe from npm
const ffmpegPath = require('ffmpeg-static');
const ffprobePath = require('ffprobe-static').path;
copyBinary(ffmpegPath, 'ffmpeg');
copyBinary(ffprobePath, 'ffprobe');

// yt-dlp from its GitHub release
const isMac = os.platform() === 'darwin';
const isWin = os.platform() === 'win32';
const asset = isWin ? 'yt-dlp.exe' : isMac ? 'yt-dlp_macos' : 'yt-dlp';
const ytdlpDest = path.join(bin, isWin ? 'yt-dlp.exe' : 'yt-dlp');

if (fs.existsSync(ytdlpDest)) {
  console.log('  bin/yt-dlp already present, skipping download');
} else {
  const url = `https://github.com/yt-dlp/yt-dlp/releases/latest/download/${asset}`;
  console.log(`  downloading ${asset} ...`);
  const res = await fetch(url, { redirect: 'follow' });
  if (!res.ok) throw new Error(`yt-dlp download failed: ${res.status}`);
  fs.writeFileSync(ytdlpDest, Buffer.from(await res.arrayBuffer()));
  fs.chmodSync(ytdlpDest, 0o755);
  console.log(`  bin/${path.basename(ytdlpDest)}  <-  ${url}`);
}

console.log('setup done.');
