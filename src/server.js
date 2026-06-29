// yoink server. Serves the UI plus the resolve/download API.
import express from 'express';
import { PORT, PUBLIC } from './config.js';
import { resolve } from './lib/resolve.js';
import { sendVideo, sendAudio, sendImages } from './lib/download.js';
import { isTikTokUrl } from './lib/util.js';

const app = express();
app.use(express.json());
app.use(express.static(PUBLIC));

app.post('/api/resolve', async (req, res) => {
  try {
    const url = (req.body?.url || '').trim();
    if (!url) return res.status(400).json({ ok: false, error: 'No URL provided.' });
    res.json({ ...(await resolve(url)), url });
  } catch (e) {
    res.status(422).json({ ok: false, error: e.message || 'Could not resolve link.' });
  }
});

app.get('/api/download', async (req, res) => {
  const url = (req.query.url || '').toString().trim();
  const kind = (req.query.kind || 'video').toString();
  const caption = (req.query.caption || '').toString();
  if (!url) return res.status(400).send('Missing url');
  if (!isTikTokUrl(url)) return res.status(400).send('Not a valid TikTok link.');
  try {
    if (kind === 'images') return await sendImages(url, caption, res);
    if (kind === 'audio') return await sendAudio(url, caption, res);
    return await sendVideo(url, caption, res);
  } catch (e) {
    if (!res.headersSent) res.status(500).send(e.message || 'Download failed.');
    else res.end();
  }
});

app.listen(PORT, () => {
  console.log(`\n  yoink  ->  http://localhost:${PORT}   (HD source enabled)\n`);
});
