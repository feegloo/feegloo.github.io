/* A local canvas composition becomes a normal attachment only on Done. */
window.createDrawingEditor = function (onSave) {
  const dialog = document.createElement('dialog');
  dialog.className = 'drawing-editor';
  dialog.setAttribute('aria-label', 'Draw image');
  dialog.innerHTML = '<canvas aria-label="Draw in red. Tap an image to move it or resize it using its corner handles."></canvas><button type="button" class="drawing-done">Done</button><div class="drawing-paste-target" contenteditable="true" inputmode="none" tabindex="-1" aria-label="Paste image" style="position:absolute;width:1px;height:1px;overflow:hidden;opacity:.01;caret-color:transparent;font-size:16px"></div><p class="drawing-message" role="status"></p>';
  document.body.appendChild(dialog);
  const canvas = dialog.querySelector('canvas');
  const ctx = canvas.getContext('2d');
  const done = dialog.querySelector('.drawing-done');
  const pasteTarget = dialog.querySelector('.drawing-paste-target');
  let pastePending = false, pasteTask = null;
  let selectedPicture = null, imageDrag = null;
  const message = dialog.querySelector('.drawing-message');
  const pointers = new Map();
  let strokes = [], pictures = [], stroke = null, gesture = null;
  let width = 0, height = 0, timer = null, held = false, busy = false;
  let previousOverflow, previousFocus, session = 0;
  const distance = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
  const center = (a, b) => ({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 });
  const point = e => { const r = canvas.getBoundingClientRect(); return { x: e.clientX - r.left, y: e.clientY - r.top }; };
  function render(showSelection = true) {
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
    if (showSelection && selectedPicture) {
      const p = selectedPicture;
      ctx.strokeStyle = '#0071e3'; ctx.lineWidth = 1.5;
      ctx.strokeRect(p.x, p.y, p.w, p.h);
      for (const [x, y] of [[p.x, p.y], [p.x + p.w, p.y], [p.x, p.y + p.h], [p.x + p.w, p.y + p.h]]) {
        ctx.beginPath(); ctx.arc(x, y, 6, 0, Math.PI * 2);
        ctx.fillStyle = '#fff'; ctx.fill(); ctx.stroke();
      }
    }
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
  function preparePaste() {
    imageDrag = null;
    stroke = null; held = true; pastePending = true; render();
  }
  canvas.addEventListener('pointerdown', e => {
    if (busy) return;
    e.preventDefault(); pastePending = false; message.textContent = '';
    canvas.setPointerCapture(e.pointerId);
    const p = point(e); pointers.set(e.pointerId, p); clearHold();
    if (pointers.size === 1) {
      held = false; imageDrag = null;
      const selected = selectedPicture;
      const corners = selected ? [
        { x: selected.x, y: selected.y, sx: -1, sy: -1 },
        { x: selected.x + selected.w, y: selected.y, sx: 1, sy: -1 },
        { x: selected.x, y: selected.y + selected.h, sx: -1, sy: 1 },
        { x: selected.x + selected.w, y: selected.y + selected.h, sx: 1, sy: 1 }
      ] : [];
      const corner = corners.find(c => distance(c, p) <= 22);
      const hit = corner ? selected : [...pictures].reverse().find(q =>
        p.x >= q.x && p.x <= q.x + q.w && p.y >= q.y && p.y <= q.y + q.h);
      selectedPicture = hit || null;
      if (hit) {
        stroke = null;
        imageDrag = { picture: hit, start: p, x: hit.x, y: hit.y, w: hit.w, h: hit.h, corner };
      } else if (selected) {
        // Consume this gesture to deselect, without leaving a dot or starting a stroke.
        stroke = null;
        held = true;
        render();
        return;
      } else { stroke = [p]; }
      render();
      timer = setTimeout(preparePaste, 550);
    } else {
      stroke = null; imageDrag = null; held = true; pastePending = false;
      if (pointers.size === 2 && pictures.length) {
        const [a, b] = [...pointers.values()], c = center(a, b);
        const picture = [...pictures].reverse().find(q => c.x >= q.x && c.x <= q.x + q.w && c.y >= q.y && c.y <= q.y + q.h) || pictures[pictures.length - 1];
        selectedPicture = picture;
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
    } else if (imageDrag && !held && pointers.size === 1) {
      const g = imageDrag;
      if (timer && distance(g.start, p) < 6) return;
      clearHold();
      const dx = p.x - g.start.x, dy = p.y - g.start.y;
      if (g.corner) {
        const { sx, sy } = g.corner;
        const scale = Math.max(24 / Math.min(g.w, g.h), Math.min(
          4 * Math.max(width, height) / Math.max(g.w, g.h),
          1 + (sx * dx * g.w + sy * dy * g.h) / (g.w * g.w + g.h * g.h)));
        const w = g.w * scale, h = g.h * scale;
        Object.assign(g.picture, { w, h, x: sx < 0 ? g.x + g.w - w : g.x, y: sy < 0 ? g.y + g.h - h : g.y });
      } else {
        Object.assign(g.picture, { x: g.x + dx, y: g.y + dy });
      }
      render();
    } else if (stroke && !held && pointers.size === 1) {
      if (timer && distance(stroke[0], p) < 6) return;
      clearHold(); stroke.push(p); render();
    }
  });
  function release(e) {
    if (!pointers.has(e.pointerId)) return;
    const shouldPaste = pastePending && e.type === 'pointerup' && pointers.size === 1;
    pastePending = false;
    clearHold();
    if (stroke && !held && e.type !== 'pointercancel') strokes.push(stroke);
    stroke = null; imageDrag = null; pointers.delete(e.pointerId); gesture = null;
    if (pointers.size === 0) held = false;
    render();
    if (shouldPaste) readClipboard(point(e));
  }
  ['pointerup', 'pointercancel', 'lostpointercapture'].forEach(name => canvas.addEventListener(name, release));
  canvas.addEventListener('contextmenu', e => {
    e.preventDefault();
    if (busy || pointers.size) return;
    clearHold(); stroke = null; imageDrag = null; render(); readClipboard(point(e));
  });
  async function insertImage(blob) {
    if (!blob) throw new Error('The browser did not provide image data.');
    if (blob.size > 50 * 1024 * 1024) throw new Error('Image is too large. Maximum size is 50 MB.');
    const current = session, url = URL.createObjectURL(blob);
    try {
      const image = new Image(); image.src = url; await image.decode();
      if (!dialog.open || current !== session) return;
      const scale = Math.min(1, width * .65 / image.naturalWidth, height * .5 / image.naturalHeight);
      const w = image.naturalWidth * scale, h = image.naturalHeight * scale;
      selectedPicture = { image, x: (width - w) / 2, y: (height - h) / 2, w, h };
      pictures.push(selectedPicture); render();
    } finally { URL.revokeObjectURL(url); }
  }
  function clipboardFile(data) {
    // Photos can expose a file without an image MIME type in DataTransfer.items.
    const files = [...(data?.files || []), ...Array.from(data?.items || [])
      .filter(item => item.kind === 'file').map(item => item.getAsFile()).filter(Boolean)];
    return files.find(file => file.type.startsWith('image/')) ||
      files.find(file => !file.type || /\.(png|jpe?g|heic|heif|webp|tiff?)$/i.test(file.name));
  }
  async function imageFromHTML(html) {
    const doc = new DOMParser().parseFromString(html, 'text/html');
    const src = doc.querySelector('img')?.getAttribute('src') || '';
    // Never fetch arbitrary external URLs from pasted markup.
    if (!/^data:image\//i.test(src)) return null;
    return (await fetch(src)).blob();
  }
  async function readClipboard(p) {
    if (busy) return;
    pasteTarget.style.left = Math.min(width - 1, p.x) + 'px';
    pasteTarget.style.top = Math.min(height - 1, p.y) + 'px';
    pasteTarget.focus({ preventScroll: true });
    if (!navigator.clipboard?.read) {
      message.textContent = 'Use your browser’s Paste command to insert the image.';
      return;
    }
    busy = true; done.disabled = true; pasteTask = null;
    try {
      // Pointerup is the user gesture: the only Paste menu now belongs to iOS.
      const items = await navigator.clipboard.read();
      if (pasteTask) { await pasteTask; return; }
      let blob = null;
      for (const item of items) {
        for (const type of item.types.filter(t => t.startsWith('image/'))) {
          try { blob = await item.getType(type); } catch (_) { continue; }
          if (blob) break;
        }
        if (!blob && item.types.includes('text/html')) {
          blob = await imageFromHTML(await (await item.getType('text/html')).text());
        }
        if (blob) break;
      }
      if (pasteTask) { await pasteTask; return; }
      if (blob) await insertImage(blob);
      else message.textContent = 'The browser did not share image data. Try native Paste again, or attach the photo with Add File.';
    } catch (error) {
      if (pasteTask) {
        try { await pasteTask; } catch (_) { message.textContent = 'The copied image could not be decoded.'; }
      } else if (error.name !== 'NotAllowedError' && error.name !== 'AbortError') {
        message.textContent = 'The copied image could not be read. Try copying it again.';
      }
    } finally { busy = false; done.disabled = false; pasteTarget.textContent = ''; pasteTask = null; }
  }
  dialog.addEventListener('paste', e => {
    // Do not discard native paste while clipboard.read() is awaiting iOS approval.
    const file = clipboardFile(e.clipboardData);
    const html = e.clipboardData?.getData('text/html') || '';
    e.preventDefault();
    if (pasteTask) return;
    const wasBusy = busy;
    busy = true; done.disabled = true; message.textContent = '';
    pasteTask = (async () => {
      const blob = file || await imageFromHTML(html);
      if (!blob) throw new Error('The browser did not share image data.');
      await insertImage(blob);
    })();
    pasteTask.catch(error => { message.textContent = error.message; }).finally(() => {
      pasteTarget.textContent = '';
      if (!wasBusy) { busy = false; done.disabled = false; pasteTask = null; }
    });
  });
  function close() {
    session++; clearHold(); pointers.clear(); stroke = gesture = null;
    dialog.close(); document.body.style.overflow = previousOverflow;
    strokes = []; pictures = []; selectedPicture = imageDrag = null; previousFocus?.focus({ preventScroll: true });
  }
  async function finish() {
    if (busy) return;
    clearHold(); stroke = null; render(false);
    if (!strokes.length && !pictures.length) { close(); return; }
    busy = true; done.disabled = true;
    try {
      const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/png'));
      if (!blob) throw new Error('Could not save the drawing. Try Done again.');
      if (blob.size > 50 * 1024 * 1024) throw new Error('Drawing exceeds the 50 MB attachment limit.');
      const accepted = onSave(new File([blob], 'drawing-' + Date.now() + '.png', { type: 'image/png' }));
      if (accepted === false) throw new Error('You can attach up to 5 images and files.');
      close();
    } catch (error) { message.textContent = error.message; render(); }
    finally { busy = false; done.disabled = false; }
  }
  done.addEventListener('click', finish);
  dialog.addEventListener('cancel', e => { e.preventDefault(); finish(); });
  new ResizeObserver(resize).observe(canvas);
  return { open() {
    if (dialog.open) return;
    previousFocus = document.activeElement; previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    strokes = []; pictures = []; selectedPicture = imageDrag = null; stroke = gesture = null; width = height = 0;
    pointers.clear(); pastePending = false; pasteTask = null; pasteTarget.textContent = ''; message.textContent = ''; busy = false; done.disabled = false;
    dialog.showModal(); resize(); done.focus({ preventScroll: true });
  } };
};
