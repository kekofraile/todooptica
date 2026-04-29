#!/usr/bin/env python3

from __future__ import annotations

import html
import os
import posixpath
import subprocess
from http import HTTPStatus
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import urlparse


ROOT = Path(__file__).resolve().parent.parent
SIMULATOR_DIR = ROOT / "OpticalStoreSimulator"
UNITY_HUB_APP = "/Applications/Unity Hub.app"
HOST = "0.0.0.0"
PORT = int(os.environ.get("PORT", "5173"))


def get_project_editor_version() -> str | None:
    project_version_file = SIMULATOR_DIR / "ProjectSettings" / "ProjectVersion.txt"
    if not project_version_file.exists():
        return None

    for line in project_version_file.read_text(encoding="utf-8").splitlines():
        if line.startswith("m_EditorVersion:"):
            return line.split(":", 1)[1].strip()

    return None


def get_installed_unity_editor_app() -> Path | None:
    version = get_project_editor_version()
    if not version:
        return None

    app_path = Path(f"/Applications/Unity/Hub/Editor/{version}/Unity.app")
    return app_path if app_path.exists() else None


class DevRequestHandler(SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=str(ROOT), **kwargs)

    def do_GET(self) -> None:
        parsed = urlparse(self.path)
        if parsed.path == "/launch-optical-store-simulator":
            self._launch_simulator()
            return

        super().do_GET()

    def do_HEAD(self) -> None:
        parsed = urlparse(self.path)
        if parsed.path == "/launch-optical-store-simulator":
            self.send_response(HTTPStatus.OK)
            self.end_headers()
            return

        super().do_HEAD()

    def translate_path(self, path: str) -> str:
        path = urlparse(path).path
        path = posixpath.normpath(path)
        words = [word for word in path.split("/") if word]
        translated = ROOT
        for word in words:
            translated = translated / word
        return str(translated)

    def _launch_simulator(self) -> None:
        status_code = HTTPStatus.OK
        title = "Optical Store Simulator"
        message = ""
        details = ""
        launch_target = ""

        if not SIMULATOR_DIR.exists():
            status_code = HTTPStatus.NOT_FOUND
            message = "No se ha encontrado la carpeta del proyecto Unity."
            details = str(SIMULATOR_DIR)
        else:
            unity_editor_app = get_installed_unity_editor_app()
            unity_hub_app = Path(UNITY_HUB_APP)

            if unity_editor_app is not None:
                try:
                    subprocess.Popen(
                        [
                            "open",
                            "-a",
                            str(unity_editor_app),
                            "--args",
                            "-projectPath",
                            str(SIMULATOR_DIR),
                            "-executeMethod",
                            "OpticalStoreEditorLauncher.OpenStoreDayScene",
                        ],
                        cwd=str(ROOT),
                        stdout=subprocess.DEVNULL,
                        stderr=subprocess.DEVNULL,
                    )
                    launch_target = unity_editor_app.name
                    message = "Se ha enviado la orden para abrir el proyecto en Unity."
                    details = str(SIMULATOR_DIR)
                except Exception as exc:  # pragma: no cover
                    status_code = HTTPStatus.INTERNAL_SERVER_ERROR
                    message = "No se pudo abrir Unity."
                    details = str(exc)
            elif not unity_hub_app.exists():
                status_code = HTTPStatus.SERVICE_UNAVAILABLE
                message = "No se ha encontrado una instalación local de Unity ni Unity Hub."
                details = "Instala Unity 2022.3 LTS o Unity Hub y vuelve a pulsar el lanzador."
            else:
                try:
                    subprocess.Popen(
                        ["open", "-a", str(unity_hub_app), str(SIMULATOR_DIR)],
                        cwd=str(ROOT),
                        stdout=subprocess.DEVNULL,
                        stderr=subprocess.DEVNULL,
                    )
                    launch_target = unity_hub_app.name
                    message = "Se ha enviado la orden para abrir el proyecto en Unity Hub."
                    details = str(SIMULATOR_DIR)
                except Exception as exc:  # pragma: no cover
                    status_code = HTTPStatus.INTERNAL_SERVER_ERROR
                    message = "No se pudo abrir Unity Hub."
                    details = str(exc)

        if not message:
            status_code = HTTPStatus.SERVICE_UNAVAILABLE
            message = "No se pudo resolver el lanzador local."
            details = "Revisa la instalación de Unity y vuelve a intentarlo."

        body = f"""<!doctype html>
<html lang="es">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>{html.escape(title)}</title>
    <style>
      body {{
        margin: 0;
        font-family: ui-sans-serif, system-ui, sans-serif;
        background: linear-gradient(180deg, #fbfbf7, #eef5ef);
        color: #07160f;
      }}
      main {{
        max-width: 760px;
        margin: 0 auto;
        padding: 48px 20px 72px;
      }}
      .panel {{
        background: rgba(255,255,255,.88);
        border: 1px solid rgba(7,22,15,.1);
        border-radius: 24px;
        padding: 28px;
        box-shadow: 0 18px 36px rgba(7,22,15,.08);
      }}
      h1 {{
        margin: 0 0 10px;
        font-size: 32px;
      }}
      p {{
        margin: 0 0 14px;
        line-height: 1.6;
      }}
      code {{
        display: inline-block;
        padding: 6px 10px;
        border-radius: 999px;
        background: rgba(11,156,76,.08);
      }}
      a {{
        color: #08753a;
        font-weight: 700;
        text-decoration: none;
      }}
    </style>
  </head>
  <body>
    <main>
      <div class="panel">
        <h1>{html.escape(message)}</h1>
        <p><code>{html.escape(details)}</code></p>
        <p>{html.escape(launch_target)}</p>
        <p><a href="/simulador-optica.html">Volver al lanzador</a></p>
      </div>
    </main>
  </body>
</html>
"""

        encoded = body.encode("utf-8")
        self.send_response(status_code)
        self.send_header("Content-Type", "text/html; charset=utf-8")
        self.send_header("Content-Length", str(len(encoded)))
        self.end_headers()
        self.wfile.write(encoded)


def main() -> None:
    server = ThreadingHTTPServer((HOST, PORT), DevRequestHandler)
    print(f"Serving Todo Óptica on http://{HOST}:{PORT}/ from {ROOT}", flush=True)
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        pass
    finally:
        server.server_close()


if __name__ == "__main__":
    main()
