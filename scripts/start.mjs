// Launches the yoink server. On macOS it wraps the process in a Seatbelt
// sandbox (scripts/yoink.sb) so neither yoink nor any dependency can read your
// secrets/keychain/browser data or plant startup items. On other platforms, or
// if sandbox-exec is missing, it runs the server directly.

import { spawn } from 'node:child_process';
import os from 'node:os';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const server = path.join(root, 'src', 'server.js');
const node = process.execPath;

function run(cmd, args) {
  const child = spawn(cmd, args, { stdio: 'inherit' });
  child.on('exit', code => process.exit(code ?? 0));
  process.on('SIGINT', () => child.kill('SIGINT'));
  process.on('SIGTERM', () => child.kill('SIGTERM'));
}

const sandboxAvailable = os.platform() === 'darwin' && fs.existsSync('/usr/bin/sandbox-exec');

if (!sandboxAvailable || process.env.YOINK_NO_SANDBOX === '1') {
  if (!sandboxAvailable) console.log('[yoink] no macOS sandbox available, running unconfined');
  else console.log('[yoink] YOINK_NO_SANDBOX=1, running unconfined');
  run(node, [server]);
} else {
  const profile = fs.readFileSync(path.join(root, 'scripts', 'yoink.sb'), 'utf8')
    .replaceAll('__HOME__', os.homedir())
    .replaceAll('__PROJECT__', root);
  const profilePath = path.join(root, '.yoink-sandbox.sb');
  fs.writeFileSync(profilePath, profile, { mode: 0o600 });
  console.log('[yoink] sandboxed: secrets, keychain, browser data and startup files are off-limits');
  run('/usr/bin/sandbox-exec', ['-f', profilePath, node, server]);
}
