// app.js: paste, resolve, show options, download. Vanilla, no framework.
const $ = sel => document.querySelector(sel);
const form = $('#form');
const urlInput = $('#url');
const go = $('#go');
const statusEl = $('#status');
const result = $('#result');

function setStatus(msg, kind = '') {
  statusEl.textContent = msg;
  statusEl.className = 'status' + (kind ? ' ' + kind : '');
}

function fmtDuration(s) {
  if (!s) return null;
  const m = Math.floor(s / 60), sec = s % 60;
  return `${m}:${String(sec).padStart(2, '0')}`;
}

// yt-dlp's own figure, so it's an estimate. Say so with the tilde.
function fmtSize(bytes) {
  if (!bytes) return null;
  const mb = bytes / 1048576;
  if (mb >= 1024) return `~${(mb / 1024).toFixed(1)} GB`;
  return `~${Math.round(mb)} MB`;
}

function dlLink({ kind, name, hint, url, caption }) {
  const a = document.createElement('a');
  a.className = 'dl';
  a.href = `/api/download?kind=${kind}&url=${encodeURIComponent(url)}&caption=${encodeURIComponent(caption || '')}`;
  a.setAttribute('download', '');
  a.innerHTML = `<span class="name">${name}</span><span class="hint">${hint}</span>`;
  return a;
}

function joinHint(parts) {
  return parts.filter(Boolean).join(' · ');
}

function render(data) {
  const { type, author, caption, cover, duration, imageCount, quality, source, url,
          platform, variants = {}, hasMax } = data;

  $('#thumb').src = cover || '';
  $('#thumb').alt = caption || 'thumbnail';
  $('#badge').textContent = type === 'images' ? 'PHOTO' : (quality || 'HD');
  $('#author').textContent = author || platform || 'source';
  $('#caption').textContent = caption || '(no caption)';

  const dur = $('#fact-dur');
  if (type === 'images') dur.textContent = `${imageCount} image${imageCount === 1 ? '' : 's'}`;
  else dur.textContent = fmtDuration(duration) ? `length ${fmtDuration(duration)}` : '';
  $('#fact-src').textContent = `${platform || ''} · engine: ${source}`.replace(/^ · /, '');

  const links = $('#links');
  links.innerHTML = '';

  if (type === 'images') {
    links.appendChild(dlLink({ kind: 'images', name: 'Images (.zip)', hint: `${imageCount} files, in post order`, url, caption }));
    links.appendChild(dlLink({ kind: 'audio', name: 'Audio only', hint: 'mp3 · VBR, around 256k', url, caption }));
    result.hidden = false;
    return;
  }

  if (platform === 'youtube') {
    const h = variants.h264;
    links.appendChild(dlLink({
      kind: 'video',
      name: h ? `Video (H.264 ${h.height}p)` : 'Video (H.264)',
      hint: joinHint(['mp4', h && `h264 + ${h.acodec || 'aac'}`, 'plays and edits everywhere', h && fmtSize(h.size)]),
      url, caption,
    }));
    if (hasMax) {
      const m = variants.max;
      links.appendChild(dlLink({
        kind: 'video-max',
        name: `Max quality (${m.height}p)`,
        hint: joinHint(['mp4', `${m.vcodec} + ${m.acodec || 'opus'}`, 'QuickTime may refuse it', fmtSize(m.size)]),
        url, caption,
      }));
    }
  } else {
    const hd = quality === 'HD';
    links.appendChild(dlLink({
      kind: 'video',
      name: hd ? 'Video (HD source)' : 'Video (no watermark)',
      hint: hd ? 'mp4 · the original upload, full bitrate' : 'mp4 · web stream',
      url, caption,
    }));
  }

  links.appendChild(dlLink({ kind: 'audio', name: 'Audio only', hint: 'mp3 · VBR, around 256k', url, caption }));
  result.hidden = false;
}

form.addEventListener('submit', async (e) => {
  e.preventDefault();
  const url = urlInput.value.trim();
  if (!url) { setStatus('Paste a TikTok or YouTube link first.', 'err'); return; }

  go.disabled = true;
  result.hidden = true;
  setStatus('reading source', 'work');

  try {
    const res = await fetch('/api/resolve', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url }),
    });
    const data = await res.json();
    if (!res.ok || !data.ok) throw new Error(data.error || 'Could not read that link.');
    setStatus('found it, pick a format below', '');
    render(data);
  } catch (err) {
    setStatus(err.message, 'err');
  } finally {
    go.disabled = false;
  }
});

// little affordance: clicking a download link shows progress text. The YouTube
// paths mux locally, so a big file genuinely takes a while before the save
// dialog appears and the page looks idle in the meantime.
document.addEventListener('click', (e) => {
  const a = e.target.closest('.dl');
  if (!a) return;
  const big = /max|GB/.test(a.textContent);
  setStatus(big ? 'downloading and muxing, this one can take a few minutes' : 'preparing file, your download will start shortly', 'work');
});
