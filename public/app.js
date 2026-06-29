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

function dlLink({ kind, name, hint, url, caption }) {
  const a = document.createElement('a');
  a.className = 'dl';
  a.href = `/api/download?kind=${kind}&url=${encodeURIComponent(url)}&caption=${encodeURIComponent(caption || '')}`;
  a.setAttribute('download', '');
  a.innerHTML = `<span class="name">${name}</span><span class="hint">${hint}</span>`;
  return a;
}

function render(data) {
  const { type, author, caption, cover, duration, imageCount, quality, source, url } = data;

  $('#thumb').src = cover || '';
  $('#thumb').alt = caption || 'thumbnail';
  $('#badge').textContent = type === 'images' ? 'PHOTO' : (quality || 'HD');
  $('#author').textContent = author || 'tiktok';
  $('#caption').textContent = caption || '(no caption)';

  const dur = $('#fact-dur');
  if (type === 'images') dur.textContent = `${imageCount} image${imageCount === 1 ? '' : 's'}`;
  else dur.textContent = fmtDuration(duration) ? `length ${fmtDuration(duration)}` : '';
  $('#fact-src').textContent = `engine: ${source}`;

  const links = $('#links');
  links.innerHTML = '';
  if (type === 'images') {
    links.appendChild(dlLink({ kind: 'images', name: 'Images (.zip)', hint: `${imageCount} files`, url, caption }));
  } else {
    const hd = quality === 'HD';
    links.appendChild(dlLink({ kind: 'video', name: hd ? 'Video (HD source)' : 'Video (no watermark)', hint: hd ? 'mp4 · original 1080p, full bitrate' : 'mp4 · 1080p', url, caption }));
    links.appendChild(dlLink({ kind: 'audio', name: 'Audio only', hint: 'mp3 · 320k', url, caption }));
  }

  result.hidden = false;
}

form.addEventListener('submit', async (e) => {
  e.preventDefault();
  const url = urlInput.value.trim();
  if (!url) { setStatus('Paste a TikTok link first.', 'err'); return; }

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

// little affordance: clicking a download link shows progress text
document.addEventListener('click', (e) => {
  const a = e.target.closest('.dl');
  if (a) setStatus('preparing file, your download will start shortly', 'work');
});
