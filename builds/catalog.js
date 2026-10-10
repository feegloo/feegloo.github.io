// The generated HTML remains usable offline or when this refresh fails.
(async () => {
  const list = document.getElementById('apps');
  const hideBrokenIcons = () => list.querySelectorAll('img').forEach(image => {
    image.addEventListener('error', () => image.remove());
    if (image.complete && !image.naturalWidth) image.remove();
  });
  hideBrokenIcons();
  try {
    const response = await fetch('/builds/catalog.json', { cache: 'no-store' });
    if (!response.ok) return;
    const apps = await response.json();
    if (!Array.isArray(apps) || !apps.length || !apps.every(app =>
      typeof app.name === 'string' && typeof app.version === 'string' &&
      typeof app.build === 'string' && /^\/builds\/[a-zA-Z0-9_-]+(?:\.[a-zA-Z0-9_-]+)*\/index\.html$/.test(app.url) &&
      typeof app.icon === 'string' && (!app.icon || app.icon.startsWith('/builds/') ||
        app.icon.startsWith('https://raw.githubusercontent.com/feegloo/')))) return;
    const cards = apps.map(app => {
      const card = document.createElement('li');
      const link = document.createElement('a');
      link.className = 'app'; link.href = app.url;
      const icon = document.createElement('span'); icon.className = 'icon';
      if (app.icon) {
        const image = document.createElement('img');
        image.src = app.icon; image.alt = ''; image.width = image.height = 64;
        icon.append(image);
      }
      const details = document.createElement('span'); details.className = 'details';
      const name = document.createElement('span'); name.className = 'name'; name.textContent = app.name;
      const version = document.createElement('span'); version.className = 'version';
      version.textContent = `${app.version} (${app.build})`;
      details.append(name, version); link.append(icon, details); card.append(link);
      return card;
    });
    list.replaceChildren(...cards);
    hideBrokenIcons();
  } catch (_) { /* Keep the published static catalog. */ }
})();
