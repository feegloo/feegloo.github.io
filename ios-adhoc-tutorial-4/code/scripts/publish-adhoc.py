"""Publish immutable OTA builds and rebuild a multi-app catalog.

Standalone example. Publishes only to the website repository's /adhoc/ directory.
"""
from datetime import datetime, timezone
import html
import json
import os
from pathlib import Path
import plistlib
import re
import shutil
import subprocess
import sys
from urllib.parse import quote
import zipfile

BASE = os.environ.get("ADHOC_BASE_URL", "").rstrip("/")


def install_url(relative):
    return "itms-services://?action=download-manifest&url=" + quote(BASE + "/" + relative + "/manifest.plist", safe="")


def page(title, cards, back=False):
    return '<!doctype html><html lang="en"><head><meta charset="utf-8">' + \
        '<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">' + \
        '<meta name="robots" content="noindex,nofollow"><meta name="color-scheme" content="dark">' + \
        '<title>' + html.escape(title) + '</title><link rel="stylesheet" href="' + html.escape(BASE, quote=True) + '/style.css">' + \
        '</head><body><main>' + ('<a class="back" href="' + html.escape(BASE, quote=True) + '/">‹ Apps</a>' if back else '') + \
        '<h1>' + html.escape(title) + '</h1><ul>' + ''.join(cards) + '</ul></main></body></html>\n'


def card(entry, app_link=None):
    label = html.escape(str(entry["version"]) + " (" + str(entry["build"]) + ")")
    relative = entry["relative"]
    if not re.fullmatch(r"apps/[0-9]+/[0-9]+-[0-9]+-[0-9]+", relative):
        raise ValueError("Invalid catalog path")
    text = '<span class="version">' + label + '</span>'
    if app_link:
        title = html.escape(entry["name"])
        text = '<a class="app" href="' + html.escape(app_link, quote=True) + '">' + \
            '<img src="' + html.escape(BASE, quote=True) + '/' + relative + '/icon.png" alt="" width="64" height="64">' + \
            '<span class="details"><span class="name">' + title + '</span>' + text + '</span></a>'
    return '<li>' + text + '<a class="install" href="' + html.escape(install_url(relative), quote=True) + \
        '" aria-label="Install version ' + label + '">Install</a></li>'


def render_catalog(root):
    apps = []
    for app in (root / "apps").glob("*"):
        if not app.is_dir() or not app.name.isdigit():
            continue
        entries = []
        for path in app.glob("*/metadata.json"):
            item = json.loads(path.read_text())
            expected = path.parent.relative_to(root).as_posix()
            if item["relative"] != expected:
                raise ValueError("Metadata location mismatch")
            entries.append(item)
        # Source run ordering avoids an old delayed publication becoming the latest app.
        entries.sort(key=lambda e: (int(e["source_run_id"]), int(e["sign_run_id"]), int(e["sign_attempt"])), reverse=True)
        if entries:
            (app / "index.html").write_text(page(entries[0]["name"], [card(e) for e in entries], True))
            apps.append((entries[0], BASE + "/apps/" + app.name + "/"))
    apps.sort(key=lambda a: a[0]["name"].casefold())
    cards = [card(entry, link) for entry, link in apps]
    if not cards:
        cards = ['<li class="empty">No Ad Hoc builds yet.</li>']
    (root / "index.html").write_text(page("Apps", cards))


def prepare():
    temp = Path(os.environ["RUNNER_TEMP"])
    ipas = list((temp / "export").glob("*.ipa"))
    if len(ipas) != 1 or ipas[0].stat().st_size >= 100 * 1024**2:
        raise ValueError("Expected one IPA smaller than 100 MiB. Larger builds require external binary hosting")
    with zipfile.ZipFile(ipas[0]) as archive:
        infos = [n for n in archive.namelist() if re.fullmatch(r"Payload/[^/]+\.app/Info.plist", n)]
        if len(infos) != 1:
            raise ValueError("Expected one app in exported IPA")
        info = plistlib.loads(archive.read(infos[0]))
    if info["CFBundleIdentifier"] != os.environ["BUNDLE_ID"]:
        raise ValueError("Exported Bundle ID does not match validated archive")
    name = info.get("CFBundleDisplayName") or info.get("CFBundleName") or info["CFBundleIdentifier"]
    values = [os.environ[k] for k in ("SOURCE_REPOSITORY_ID", "SOURCE_RUN_ID", "GITHUB_RUN_ID", "GITHUB_RUN_ATTEMPT")]
    if not all(re.fullmatch(r"[0-9]+", v) for v in values):
        raise ValueError("Invalid publication identity")
    repo, source, run, attempt = values
    relative = f"apps/{repo}/{source}-{run}-{attempt}"
    target = temp / "adhoc-publication" / relative
    target.mkdir(parents=True)
    shutil.copyfile(ipas[0], target / "app.ipa")
    # Read the primary icon from the compiled archive and normalize Apple's PNG format.
    apps = list((Path(os.environ["ARCHIVE_PATH"]) / "Products/Applications").glob("*.app"))
    app = apps[0]
    icon_names = info.get("CFBundleIcons", {}).get("CFBundlePrimaryIcon", {}).get("CFBundleIconFiles", [])
    candidates = []
    for icon in icon_names:
        if Path(icon).name != icon:
            continue
        candidates.extend(app.glob(Path(icon).stem + "*.png"))
    if not candidates:
        candidates = list(app.glob("AppIcon*.png"))
    if candidates:
        chosen = max(candidates, key=lambda p: p.stat().st_size)
        subprocess.run(["sips", "-s", "format", "png", str(chosen), "--out", str(target / "icon.png")], check=True, stdout=subprocess.DEVNULL)
    else:
        # A tiny neutral PNG avoids broken image links in apps with no raster icon.
        import base64
        (target / "icon.png").write_bytes(base64.b64decode("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII="))
    manifest = {"items": [{"assets": [
        {"kind": "software-package", "url": BASE + "/" + relative + "/app.ipa"},
        {"kind": "display-image", "url": BASE + "/" + relative + "/icon.png"}],
        "metadata": {"bundle-identifier": info["CFBundleIdentifier"],
                     "bundle-version": str(info["CFBundleVersion"]), "kind": "software", "title": name}}]}
    (target / "manifest.plist").write_bytes(plistlib.dumps(manifest))
    metadata = {"name": name, "version": str(info["CFBundleShortVersionString"]),
                "build": str(info["CFBundleVersion"]), "bundle_id": info["CFBundleIdentifier"],
                "source_run_id": source, "source_sha": os.environ["SOURCE_SHA"],
                "sign_run_id": run, "sign_attempt": attempt, "relative": relative,
                "created_at": datetime.now(timezone.utc).isoformat()}
    (target / "metadata.json").write_text(json.dumps(metadata, ensure_ascii=False, indent=2) + "\n")
    print("Prepared", relative)


def publish():
    site = Path("website")
    staging = Path(os.environ["RUNNER_TEMP"]) / "adhoc-publication"
    def git(*args, check=True):
        return subprocess.run(["git", "-C", str(site), *args], check=check, capture_output=True, text=True)
    git("config", "user.name", "github-actions[bot]")
    git("config", "user.email", "41898282+github-actions[bot]@users.noreply.github.com")
    for _ in range(5):
        # Reapply only our new version to the latest remote snapshot, then regenerate
        # the whole catalog. A plain rebase can lose another app's catalog entry.
        git("fetch", "origin", "main")
        git("reset", "--hard", "origin/main")
        shutil.copytree(staging, site / "adhoc", dirs_exist_ok=True)
        shutil.copyfile(Path(__file__).with_name("adhoc-style.css"), site / "adhoc/style.css")
        render_catalog(site / "adhoc")
        git("add", "--", "adhoc")
        if git("diff", "--cached", "--quiet", check=False).returncode == 0:
            break
        git("commit", "-m", "Publish Ad Hoc build " + os.environ["GITHUB_RUN_ID"])
        if git("push", "origin", "HEAD:main", check=False).returncode == 0:
            break
    else:
        raise RuntimeError("Website publication failed after 5 attempts; rerun the signer")
    with open(os.environ["GITHUB_STEP_SUMMARY"], "a") as output:
        output.write("Installer: " + BASE + "/ (available after GitHub Pages deployment).\n")


if __name__ == "__main__":
    from urllib.parse import urlsplit
    url = urlsplit(BASE)
    if url.scheme != "https" or not url.hostname or url.username or url.password or url.query or url.fragment or not url.path.endswith("/adhoc"):
        raise SystemExit("Set ADHOC_BASE_URL to your public HTTPS URL ending in /adhoc/")
    archive_path = Path(os.environ["RUNNER_TEMP"]) / (os.environ["XCODE_PROJECT"] + ".xcarchive")
    app_infos = list((archive_path / "Products/Applications").glob("*.app/Info.plist"))
    if len(app_infos) != 1:
        raise SystemExit("Expected one archived application")
    os.environ["ARCHIVE_PATH"] = str(archive_path)
    os.environ["BUNDLE_ID"] = plistlib.loads(app_infos[0].read_bytes())["CFBundleIdentifier"]
    os.environ["SOURCE_REPOSITORY_ID"] = os.environ["GITHUB_REPOSITORY_ID"]
    os.environ["SOURCE_RUN_ID"] = os.environ["GITHUB_RUN_ID"]
    os.environ["SOURCE_SHA"] = os.environ["GITHUB_SHA"]
    prepare()
    publish()
