#!/usr/bin/env python3
import json
import shutil
import subprocess
import time
import urllib.parse
from pathlib import Path
from typing import Any


SPACE_ROOT = "https://stabilityai-stable-diffusion-3-5-large.hf.space"
POLLINATIONS_ROOT = "https://image.pollinations.ai/prompt"
CURL_CONNECT_TIMEOUT = 15
CURL_MAX_TIME = 180


def _ensure_command(name: str) -> None:
    if shutil.which(name) is None:
        raise RuntimeError(f"Required command not found: {name}")


def _run_curl(
    args: list[str],
    *,
    timeout: int = CURL_MAX_TIME,
    capture_output: bool = True,
    text: bool = True,
) -> subprocess.CompletedProcess[str]:
    return subprocess.run(
        [
            "curl",
            "-sSL",
            "--fail",
            "--connect-timeout",
            str(CURL_CONNECT_TIMEOUT),
            "--max-time",
            str(timeout),
            *args,
        ],
        check=True,
        capture_output=capture_output,
        text=text,
    )


def _curl_json(args: list[str]) -> dict[str, Any]:
    res = _run_curl(args)
    return json.loads(res.stdout)


def _curl_text(args: list[str]) -> str:
    res = _run_curl(args)
    return res.stdout


def _download_with_retries(url: str, dest: Path, *, attempts: int = 6) -> None:
    delay = 1.5
    last_err: Exception | None = None
    for i in range(attempts):
        try:
            _run_curl(["-o", str(dest), url], capture_output=False, text=False)
            return
        except Exception as e:
            last_err = e
            if i == attempts - 1:
                break
            time.sleep(delay)
            delay = min(delay * 2, 18)
    raise RuntimeError(f"Failed to download after {attempts} attempts: {url}") from last_err


def _generate(prompt: str, out_path: Path, *, width: int = 1024, height: int = 768) -> None:
    negative = (
        "text, watermark, logo, signature, blurry, low quality, jpeg artifacts, "
        "real person, face, extra fingers, deformed, gore"
    )

    payload = {
        "data": [
            prompt,
            negative,
            0,  # seed
            True,  # randomize seed
            width,
            height,
            4.5,  # guidance
            22,  # steps
        ]
    }

    event = _curl_json(
        [
            "-X",
            "POST",
            f"{SPACE_ROOT}/gradio_api/call/infer",
            "-H",
            "Content-Type: application/json",
            "--data-raw",
            json.dumps(payload),
        ]
    )
    event_id = event["event_id"]

    # Poll for completion (SSE output).
    deadline = time.time() + 240
    url: str | None = None
    while time.time() < deadline:
        sse = _curl_text([f"{SPACE_ROOT}/gradio_api/call/infer/{event_id}"])
        if "event: error" in sse:
            raise RuntimeError(sse.strip())

        if "event: complete" in sse:
            # The Space returns something like: data: [{"url":"..."}]
            for line in sse.splitlines():
                if not line.startswith("data: "):
                    continue
                try:
                    data = json.loads(line[len("data: ") :])
                except json.JSONDecodeError:
                    continue
                if isinstance(data, list) and data and isinstance(data[0], dict):
                    url = data[0].get("url") or url
            break

        time.sleep(1.2)

    if not url:
        raise RuntimeError(f"Timeout waiting for image (event_id={event_id})")

    out_path.parent.mkdir(parents=True, exist_ok=True)
    _download_with_retries(url, out_path)


def _generate_pollinations(
    prompt: str, out_path: Path, *, width: int = 1024, height: int = 768, seed: int = 0
) -> None:
    out_path.parent.mkdir(parents=True, exist_ok=True)

    # Pollinations returns a JPEG; convert to WEBP for consistency with the rest of the site.
    tmp_jpg = out_path.with_suffix(".jpg")
    url = f"{POLLINATIONS_ROOT}/{urllib.parse.quote(prompt)}?width={width}&height={height}&seed={seed}&nologo=true"
    try:
        _download_with_retries(url, tmp_jpg)
        subprocess.run(
            ["magick", str(tmp_jpg), "-strip", "-quality", "82", str(out_path)],
            check=True,
        )
    finally:
        tmp_jpg.unlink(missing_ok=True)


def main() -> None:
    _ensure_command("curl")
    _ensure_command("magick")

    root = Path(".")
    out_dir = root / "assets" / "blog"
    out_dir.mkdir(parents=True, exist_ok=True)

    brand_style = (
        "high-end editorial 3d illustration, minimal, warm cream background, "
        "brand colors teal-green and lime accents, soft shadows, clean composition, "
        "no text, no watermark, sharp, modern health clinic branding"
    )

    jobs: list[tuple[str, str]] = [
        (
            "2026-01-24-vision-educacion.webp",
            f"{brand_style}, child studying at a desk with a notebook and stylish glasses, subtle classroom elements",
        ),
        (
            "2026-02-14-san-valentin-vision.webp",
            f"{brand_style}, heart-shaped eyeglasses and a small gift box, romantic but minimal",
        ),
        (
            "2026-02-17-carnaval-lentillas.webp",
            f"{brand_style}, carnival mask with contact lens case and solution bottle, safe and clean medical vibe",
        ),
        (
            "2026-03-08-salud-visual-femenina.webp",
            f"{brand_style}, elegant abstract feminine silhouette profile with a stylized eye motif and floral geometry",
        ),
        (
            "2026-03-12-glaucoma.webp",
            f"{brand_style}, stylized eye with a subtle pressure gauge / dial concept, medical and calm",
        ),
        (
            "2026-03-19-dia-del-padre.webp",
            f"{brand_style}, classic men's eyeglasses next to a tie and a small card, clean flat-lay composition",
        ),
        (
            "2026-04-07-dia-salud.webp",
            f"{brand_style}, health cross icon blended with an eye and a gentle grid, modern medical illustration",
        ),
        (
            "2026-04-23-dia-del-libro.webp",
            f"{brand_style}, open book with reading glasses on top, soft light, cozy and minimal",
        ),
        (
            "2026-05-03-dia-de-la-madre.webp",
            f"{brand_style}, elegant sunglasses with a flower and a gift ribbon, warm and caring",
        ),
        (
            "2026-05-17-dia-internet.webp",
            f"{brand_style}, computer screen glow with an eye icon and gentle lighting diagram, digital wellness",
        ),
        (
            "2026-06-05-eco-optica.webp",
            f"{brand_style}, eyeglass frames made of recycled material and leaves, eco friendly vibe",
        ),
        (
            "2026-06-27-gafas-de-sol.webp",
            f"{brand_style}, sunglasses with bright sun rays and UV shield icon, summer vibe",
        ),
        (
            "2026-07-10-verano-ojos.webp",
            f"{brand_style}, beach essentials with sunglasses, swim goggles, and a small bottle of eye drops",
        ),
        (
            "2026-07-26-dia-abuelos.webp",
            f"{brand_style}, warm scene of a pair of classic reading glasses with a knitted texture and gentle light",
        ),
        (
            "2026-08-15-varilux-xr.webp",
            f"{brand_style}, futuristic progressive lens concept with AI grid and motion trails, premium eyewear tech",
        ),
        (
            "2026-09-01-vuelta-al-cole.webp",
            f"{brand_style}, school backpack, pencils and kids glasses, checklist paper, minimal",
        ),
        (
            "2026-09-06-daltonismo.webp",
            f"{brand_style}, color wheel and an eye icon with subtle accessibility symbols, clean and modern",
        ),
        (
            "2026-10-08-dia-mundial-vision.webp",
            f"{brand_style}, globe with an eye overlay, hopeful global health vibe",
        ),
        (
            "2026-10-15-ambliopia.webp",
            f"{brand_style}, playful child eye patch and glasses, pediatric healthcare illustration",
        ),
        (
            "2026-10-31-halloween-ojos.webp",
            f"{brand_style}, halloween makeup palette and contact lens case, spooky but safe and clean",
        ),
        (
            "2026-11-14-diabetes-vision.webp",
            f"{brand_style}, blood glucose droplet icon with retina / eye diagram, medical illustration",
        ),
        (
            "2026-11-27-black-friday.webp",
            f"{brand_style}, price tag and stylish glasses, black friday sale concept but no text",
        ),
        (
            "2026-12-05-regalos-navidad.webp",
            f"{brand_style}, wrapped gift box with glasses and snowflake patterns, festive but minimal",
        ),
        (
            "2026-12-20-fiestas-ojos-sanos.webp",
            f"{brand_style}, holiday lights bokeh with an eye icon and a small water glass, winter dry eye concept",
        ),
    ]

    for filename, prompt in jobs:
        out_path = out_dir / filename
        if out_path.exists():
            print(f"skip {out_path}")
            continue
        print(f"gen {filename}")
        seed = int(filename[:10].replace("-", "")) if len(filename) >= 10 else 0
        _generate_pollinations(prompt, out_path, seed=seed)

    print("done")


if __name__ == "__main__":
    main()
