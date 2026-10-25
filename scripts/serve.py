"""Local game server with content-based version detection; no extra packages."""
import argparse
import hashlib
import html
import json
import re
import threading
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import urlsplit

ROOT = Path(__file__).resolve().parents[1]


class GameVersion:
    def __init__(self, root):
        self.root = Path(root)
        self.cache = {}
        self.lock = threading.Lock()

    def get(self):
        with self.lock:
            files = [self.root / "index.html", self.root / "styles.css"]
            package = self.root / "package.json"
            if package.is_file():
                files.append(package)
            files += list((self.root / "src").rglob("*.js"))
            files += [p for p in (self.root / "assets").glob("*")
                      if p.is_file() and p.suffix.lower() in {".png", ".jpg", ".json", ".webp"}]
            digest = hashlib.sha256()
            for path in sorted(files):
                stat = path.stat()
                signature = (stat.st_mtime_ns, stat.st_size)
                previous = self.cache.get(path)
                if previous is None or previous[0] != signature:
                    previous = (signature, hashlib.sha256(path.read_bytes()).digest())
                    self.cache[path] = previous
                digest.update(path.relative_to(self.root).as_posix().encode() + b"\0" + previous[1])
            return digest.hexdigest()[:16]

    def release(self):
        package = self.root / "package.json"
        if not package.is_file():
            return "0.1.0"
        value = json.loads(package.read_text(encoding="utf-8")).get("version")
        if not isinstance(value, str) or not re.fullmatch(r"\d+\.\d+\.\d+", value):
            raise ValueError("Invalid game version in package.json")
        return value


class GameHandler(SimpleHTTPRequestHandler):
    def __init__(self, *args, versions, **kwargs):
        self.versions = versions
        super().__init__(*args, directory=str(versions.root), **kwargs)

    def end_headers(self):
        self.send_header("Cache-Control", "no-store")
        super().end_headers()

    def special(self, head=False):
        path = urlsplit(self.path).path
        if path not in {"/", "/index.html", "/version.json"}:
            return False
        try:
            version = self.versions.get()
            release = self.versions.release()
            if path == "/version.json":
                data = json.dumps({"version": version, "release": release}).encode()
                content_type = "application/json; charset=utf-8"
            else:
                source = (self.versions.root / "index.html").read_text(encoding="utf-8")
                source = source.replace("</head>", f'<meta name="flystar-build" content="{version}">\n'
                                        f'<meta name="flystar-release" content="{html.escape(release, quote=True)}">\n</head>')
                data = source.encode()
                content_type = "text/html; charset=utf-8"
            self.send_response(200)
            self.send_header("Content-Type", content_type)
            self.send_header("Content-Length", str(len(data)))
            self.end_headers()
            if not head:
                self.wfile.write(data)
        except (OSError, ValueError):
            self.send_error(503, "Game files are being updated; retry shortly")
        return True

    def do_GET(self):
        if not self.special():
            super().do_GET()

    def do_HEAD(self):
        if not self.special(head=True):
            super().do_HEAD()

    def log_message(self, fmt, *args):
        if urlsplit(self.path).path != "/version.json":
            super().log_message(fmt, *args)


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--port", type=int, default=5188)
    parser.add_argument("--bind", default="127.0.0.1")
    args = parser.parse_args()
    handler = partial(GameHandler, versions=GameVersion(ROOT))
    with ThreadingHTTPServer((args.bind, args.port), handler) as server:
        print(f"Game + automatic updates: http://{args.bind}:{args.port}/", flush=True)
        try:
            server.serve_forever()
        except KeyboardInterrupt:
            pass
