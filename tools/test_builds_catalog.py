import json
from pathlib import Path
import tempfile
import unittest
from urllib.parse import unquote

from builds_catalog import render


class CatalogTests(unittest.TestCase):
    def add(self, root, directory, **metadata):
        folder = root / directory
        folder.mkdir(parents=True, exist_ok=True)
        (folder / 'metadata.json').write_text(json.dumps(metadata))
        return folder

    def test_legacy_and_central_builds_keep_correct_links_and_history(self):
        with tempfile.TemporaryDirectory() as d:
            root = Path(d) / 'builds'; root.mkdir()
            self.add(root, 'ai-trichoscopy/10-1', version='0.1', build='12', created_at='2026-09-17T00:00:00+00:00')
            for source, sign in [(200, 300), (100, 400)]:
                relative = f'apps/1/{source}-{sign}-1'
                folder = self.add(root, 'breathing/' + relative, name='HRV <Breathing>', version='1.1',
                    build=str(source), source_run_id=str(source), sign_run_id=str(sign), sign_attempt='1', relative=relative)
                (folder / 'icon.png').touch()
            apps = render(root)
            self.assertEqual(len(apps), 2)
            self.assertEqual(apps[1]['build'], '200')
            self.assertIn('/builds/breathing/apps/1/200-300-1/icon.png', apps[1]['icon'])
            index = (root / 'index.html').read_text()
            self.assertIn('Ad Hoc builds (.ipa)', index)
            self.assertIn('HRV &lt;Breathing&gt;', index)
            self.assertNotIn('itms-services', index)
            history = (root / 'breathing/index.html').read_text()
            self.assertLess(history.index('1.1 (200)'), history.index('1.1 (100)'))
            self.assertIn('https://aleksanderfigiel.pl/builds/breathing/apps/1/200-300-1/manifest.plist', unquote(history))
            self.assertIn('https://aleksanderfigiel.pl/builds/ai-trichoscopy/10-1/manifest.plist',
                          unquote((root / 'ai-trichoscopy/index.html').read_text()))
            self.assertEqual(json.loads((root / 'catalog.json').read_text()), apps)
            render(root)
            self.assertEqual((root / 'index.html').read_text(), index)

    def test_rejects_mismatched_metadata_path(self):
        with tempfile.TemporaryDirectory() as d:
            root = Path(d)
            self.add(root, 'app/apps/1/2-3-1', relative='../escape', name='App', version='1', build='2')
            with self.assertRaises(ValueError):
                render(root)


if __name__ == '__main__':
    unittest.main()
