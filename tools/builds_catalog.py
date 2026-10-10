"""Rebuild the Ad Hoc app catalog and histories from immutable build metadata."""
from datetime import datetime
import html
import json
from pathlib import Path
import re
from urllib.parse import quote

BASE = "https://aleksanderfigiel.pl/builds"
TRICHO_ICON = "/builds/ai-trichoscopy/icon.png"


def page(title, cards, catalog=False):
    back = '' if catalog else '<a class="back" href="/builds/">‹ Ad Hoc builds (.ipa)</a>'
    script = '<script src="/builds/catalog.js" defer></script>' if catalog else ''
    return '<!doctype html><html lang="pl"><head><meta charset="utf-8">' + \
        '<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">' + \
        '<meta name="robots" content="noindex,nofollow"><meta name="color-scheme" content="dark">' + \
        '<title>' + html.escape(title) + '</title><link rel="stylesheet" href="/builds/style.css">' + \
        script + '</head><body><main>' + back + '<h1>' + html.escape(title) + \
        '</h1><ul' + (' id="apps"' if catalog else '') + '>' + ''.join(cards) + '</ul></main></body></html>\n'


def app_card(app):
    icon = '<img src="' + html.escape(app['icon'], quote=True) + '" alt="" width="64" height="64">' if app['icon'] else ''
    label = html.escape(app['version'] + ' (' + app['build'] + ')')
    return '<li><a class="app" href="' + html.escape(app['url'], quote=True) + '">' + \
        '<span class="icon">' + icon + '</span><span class="details"><span class="name">' + \
        html.escape(app['name']) + '</span><span class="version">' + label + '</span></span></a></li>'


def order(entry):
    if 'source_run_id' in entry:
        return (int(entry['source_run_id']), int(entry['sign_run_id']), int(entry['sign_attempt']))
    return (datetime.fromisoformat(entry['created_at'].replace('Z', '+00:00')).timestamp(),)


def render(builds):
    apps = []
    for folder in sorted(builds.iterdir()):
        if not folder.is_dir() or not re.fullmatch(r'[a-zA-Z0-9_-]+(?:\.[a-zA-Z0-9_-]+)*', folder.name):
            continue
        entries = []
        for path in folder.rglob('metadata.json'):
            relative = path.parent.relative_to(folder).as_posix()
            if not re.fullmatch(r'(?:apps/[0-9]+/)?[0-9]+(?:-[0-9]+){1,2}', relative):
                continue
            entry = json.loads(path.read_text(encoding='utf-8'))
            if 'relative' in entry and entry['relative'] != relative:
                raise ValueError('Metadata location mismatch: ' + str(path))
            entry['path'] = '/builds/' + folder.name + '/' + relative
            entries.append(entry)
        if not entries:
            continue
        entries.sort(key=order, reverse=True)
        latest = entries[0]
        name = latest.get('name') or ('AI Trichoscopy & Dermatology' if folder.name == 'ai-trichoscopy' else folder.name)
        icon = latest['path'] + '/icon.png' if (builds.parent / latest['path'].lstrip('/') / 'icon.png').exists() else ''
        if folder.name == 'ai-trichoscopy' and not icon:
            icon = TRICHO_ICON
        cards = []
        for entry in entries:
            label = html.escape(str(entry['version']) + ' (' + str(entry['build']) + ')')
            install = 'itms-services://?action=download-manifest&url=' + quote('https://aleksanderfigiel.pl' + entry['path'] + '/manifest.plist', safe='')
            cards.append('<li class="build"><span>' + label + '</span><a class="install" href="' + \
                html.escape(install, quote=True) + '" aria-label="Zainstaluj wersję ' + label + '">Zainstaluj</a></li>')
        (folder / 'index.html').write_text(page(name, cards), encoding='utf-8')
        apps.append({'name': name, 'version': str(latest['version']), 'build': str(latest['build']),
                     'url': '/builds/' + folder.name + '/index.html', 'icon': icon})
    apps.sort(key=lambda app: app['name'].casefold())
    cards = [app_card(app) for app in apps] or ['<li class="empty">Brak buildów Ad Hoc.</li>']
    (builds / 'index.html').write_text(page('Ad Hoc builds (.ipa)', cards, True), encoding='utf-8')
    (builds / 'catalog.json').write_text(json.dumps(apps, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
    return apps


if __name__ == '__main__':
    render(Path(__file__).resolve().parents[1] / 'builds')
