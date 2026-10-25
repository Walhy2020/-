import importlib.util
import tempfile
import unittest
from pathlib import Path

spec = importlib.util.spec_from_file_location("game_server", Path(__file__).resolve().parents[1] / "scripts/serve.py")
module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)


class VersionTests(unittest.TestCase):
    def test_runtime_changes_update_version_and_reverts_restore_it(self):
        with tempfile.TemporaryDirectory() as folder:
            root = Path(folder)
            (root / "src").mkdir()
            (root / "assets").mkdir()
            (root / "index.html").write_text("<html></html>")
            (root / "styles.css").write_text("body{}")
            source = root / "src/game.js"
            source.write_text("const x=1;")
            versions = module.GameVersion(root)
            first = versions.get()
            self.assertEqual(first, versions.get())
            self.assertEqual(versions.release(), "0.1.0")
            source.write_text("const x=200;")
            self.assertNotEqual(first, versions.get())
            source.write_text("const x=1;")
            self.assertEqual(first, versions.get())
            (root / "README.md").write_text("Documentation only")
            self.assertEqual(first, versions.get())
            (root / "src/new.js").write_text("export const x=1;")
            self.assertNotEqual(first, versions.get())
            before_release = versions.get()
            (root / "package.json").write_text('{"version":"0.2.0"}')
            self.assertEqual(versions.release(), "0.2.0")
            self.assertNotEqual(before_release, versions.get())


if __name__ == "__main__":
    unittest.main()
