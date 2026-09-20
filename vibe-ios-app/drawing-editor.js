/* A local canvas composition becomes a normal attachment only on Done. */
window.createDrawingEditor = function (onSave) {
  const dialog = document.createElement('dialog');
  dialog.className = 'drawing-editor';
  dialog.setAttribute('aria-label', 'Draw image');
  dialog.innerHTML = '<canvas aria-label="Draw in red. Use two fingers to move or resize a pasted image."></canvas><button type="button" class="drawing-done">Done</button><button type="button" class="drawing-paste" hidden>Paste</button><p class="drawing-message" role="status"></p>';
  document.body.appendChild(dialog);
  const canvas = dialog.querySelector('canvas');
  const ctx = canvas.getContext('2d');
  const done = dialog.querySelector('.drawing-done');
  const paste = dialog.querySelector('.drawing-paste');
  const message = dialog.querySelector('.drawing-message');
  const pointers = new Map();
  let strokes = [], pictures = [], stroke = null, gesture = null;
  let width = 0, height = 0, timer = null, held = false, busy = false;
  let previousOverflow, previousFocus, session = 0;
  const distance = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
  const center = (a, b) => ({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 });
  const point = e => { const r = canvas.getBoundingClientRect(); return { x: e.clientX - r.left, y: e.clientY - r.top }; };
  function render() {
    ctx.fillStyle = '#fff';
    ctx.fillRect(0, 0, width, height);
    pictures.forEach(p => ctx.drawImage(p.image, p.x, p.y, p.w, p.h));
    ctx.strokeStyle = ctx.fillStyle = '#ed2344';
    ctx.lineWidth = 3; ctx.lineCap = ctx.lineJoin = 'round';
    [...strokes, ...(stroke ? [stroke] : [])].forEach(points => {
      if (points.length === 1) {
        ctx.beginPath(); ctx.arc(points[0].x, points[0].y, 1.5, 0, Math.PI * 2); ctx.fill();
      } else {
        ctx.beginPath(); ctx.moveTo(points[0].x, points[0].y);
        points.slice(1).forEach(p => ctx.lineTo(p.x, p.y)); ctx.stroke();
      }
    });
  }
  function resize() {
    if (!dialog.open) return;
    const r = canvas.getBoundingClientRect();
    if (!r.width || !r.height) return;
    if (width && height) {
      const sx = r.width / width, sy = r.height / height;
      strokes.forEach(s => s.forEach(p => { p.x *= sx; p.y *= sy; }));
      pictures.forEach(p => { p.x *= sx; p.y *= sy; p.w *= sx; p.h *= sy; });
    }
    width = r.width; height = r.height;
    const ratio = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.round(width * ratio); canvas.height = Math.round(height * ratio);
    ctx.setTransform(ratio, 0, 0, ratio, 0, 0); render();
  }
  function clearHold() { clearTimeout(timer); timer = null; }
  function showPaste(p) {
    stroke = null; held = true; render();
    paste.style.left = Math.max(8, Math.min(width - 90, p.x - 40)) + 'px';
    paste.style.top = Math.max(60, Math.min(height - 50, p.y - 55)) + 'px';
    paste.hidden = false;
  }
  canvas.addEventListener('pointerdown', e => {
    if (busy) return;
    e.preventDefault(); paste.hidden = true; message.textContent = '';
    canvas.setPointerCapture(e.pointerId);
    const p = point(e); pointers.set(e.pointerId, p); clearHold();
    if (pointers.size === 1) {
      held = false; stroke = [p];
      timer = setTimeout(() => showPaste(p), 550);
    } else {
      stroke = null; held = true;
      if (pointers.size === 2 && pictures.length) {
        const [a, b] = [...pointers.values()], c = center(a, b);
        const picture = [...pictures].reverse().find(q => c.x >= q.x && c.x <= q.x + q.w && c.y >= q.y && c.y <= q.y + q.h) || pictures[pictures.length - 1];
        gesture = { picture, x: picture.x, y: picture.y, w: picture.w, h: picture.h, center: c, distance: Math.max(1, distance(a, b)) };
      }
      render();
    }
  });
  canvas.addEventListener('pointermove', e => {
    if (!pointers.has(e.pointerId) || busy) return;
    e.preventDefault(); const p = point(e); pointers.set(e.pointerId, p);
    if (gesture && pointers.size === 2) {
      const [a, b] = [...pointers.values()], c = center(a, b);
      const g = gesture, scale = Math.max(24 / Math.min(g.w, g.h), Math.min(4 * Math.max(width, height) / Math.max(g.w, g.h), distance(a, b) / g.distance));
      Object.assign(g.picture, { x: c.x + (g.x - g.center.x) * scale, y: c.y + (g.y - g.center.y) * scale, w: g.w * scale, h: g.h * scale });
      render();
    } else if (stroke && !held && pointers.size === 1) {
      if (timer && distance(stroke[0], p) < 6) return;
      clearHold(); stroke.push(p); render();
    }
  });
  function release(e) {
    if (!pointers.has(e.pointerId)) return;
    clearHold();
    if (stroke && !held && e.type !== 'pointercancel') strokes.push(stroke);
    stroke = null; pointers.delete(e.pointerId); gesture = null;
    if (pointers.size === 0) held = false;
    render();
  }
  ['pointerup', 'pointercancel', 'lostpointercapture'].forEach(name => canvas.addEventListener(name, release));
  canvas.addEventListener('contextmenu', e => { e.preventDefault(); if (!busy) { clearHold(); showPaste(point(e)); } });
  async function insertImage(blob) {
    if (!blob || !blob.type.startsWith('image/')) throw new Error('Copy an image first, then choose Paste.');
    if (blob.size > 50 * 1024 * 1024) throw new Error('Image is too large. Maximum size is 50 MB.');
    const current = session, url = URL.createObjectURL(blob);
    try {
      const image = new Image(); image.src = url; await image.decode();
      if (!dialog.open || current !== session) return;
      const scale = Math.min(1, width * .65 / image.naturalWidth, height * .5 / image.naturalHeight);
      const w = image.naturalWidth * scale, h = image.naturalHeight * scale;
      pictures.push({ image, x: (width - w) / 2, y: (height - h) / 2, w, h }); render();
    } finally { URL.revokeObjectURL(url); }
  }
  paste.addEventListener('click', async () => {
    paste.hidden = true;
    if (!navigator.clipboard || !navigator.clipboard.read) { message.textContent = 'Clipboard access is unavailable in this browser.'; return; }
    busy = true; done.disabled = true;
    try {
      // Called directly during a click, not from the long-press timer: required by iOS.
      const items = await navigator.clipboard.read();
      let found = false;
      for (const item of items) {
        const type = item.types.find(t => t.startsWith('image/'));
        if (type) { await insertImage(await item.getType(type)); found = true; break; }
      }
      if (!found) message.textContent = 'Copy an image first, then choose Paste.';
    } catch (error) { message.textContent = 'Could not paste the image. Copy it and allow clipboard access, then try again.'; }
    finally { busy = false; done.disabled = false; }
  });
  dialog.addEventListener('paste', async e => {
    const file = [...(e.clipboardData?.items || [])].find(i => i.type.startsWith('image/'))?.getAsFile();
    if (!file || busy) return;
    e.preventDefault(); busy = true; done.disabled = true;
    try { await insertImage(file); } catch (error) { message.textContent = error.message; }
    finally { busy = false; done.disabled = false; }
  });
  function close() {
    session++; clearHold(); pointers.clear(); stroke = gesture = null;
    dialog.close(); document.body.style.overflow = previousOverflow;
    strokes = []; pictures = []; previousFocus?.focus({ preventScroll: true });
  }
  async function finish() {
    if (busy) return;
    clearHold(); stroke = null; render();
    if (!strokes.length && !pictures.length) { close(); return; }
    busy = true; done.disabled = true;
    try {
      const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/png'));
      if (!blob) throw new Error('Could not save the drawing. Try Done again.');
      if (blob.size > 50 * 1024 * 1024) throw new Error('Drawing exceeds the 50 MB attachment limit.');
      const accepted = onSave(new File([blob], 'drawing-' + Date.now() + '.png', { type: 'image/png' }));
      if (accepted === false) throw new Error('You can attach up to 5 images and files.');
      close();
    } catch (error) { message.textContent = error.message; }
    finally { busy = false; done.disabled = false; }
  }
  done.addEventListener('click', finish);
  dialog.addEventListener('cancel', e => { e.preventDefault(); finish(); });
  new ResizeObserver(resize).observe(canvas);
  return { open() {
    if (dialog.open) return;
    previousFocus = document.activeElement; previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    strokes = []; pictures = []; stroke = gesture = null; width = height = 0;
    pointers.clear(); paste.hidden = true; message.textContent = ''; busy = false; done.disabled = false;
    dialog.showModal(); resize(); done.focus({ preventScroll: true });
  } };
};
