#!/usr/bin/env python3
"""
Generate 2026 editorial-calendar blog posts as static HTML.

This script:
- Calls the Pollinations OpenAI-compatible endpoint to draft long-form content.
- Writes 24 posts to ./blog/*.html
- Rewrites ./blog.html to list the new posts

Notes:
- This uses an external AI service; expect occasional 429s (rate limits). We retry
  with backoff automatically.
- Run `npm run format` afterwards to prettify the generated HTML.
"""

from __future__ import annotations

import json
import re
import shutil
import subprocess
import time
from dataclasses import dataclass
from datetime import date
from pathlib import Path


AI_ENDPOINT = "https://text.pollinations.ai/openai"
BASE_URL = "https://www.todooptica.es"
CURL_CONNECT_TIMEOUT = 15
CURL_MAX_TIME = 240

TARGET_WORDS = 1600
MAX_EXTRA_BLOCKS = 5

SYSTEM_PROMPT = (
    "Eres un redactor SEO de una óptica en España. "
    "Escribe en español claro, profesional y cercano. "
    "No menciones que eres una IA. "
    "No inventes estadísticas ni porcentajes. "
    "Evita el símbolo % y evita cifras o afirmaciones cuantitativas no verificables."
)

MONTHS_ES = {
    1: "Enero",
    2: "Febrero",
    3: "Marzo",
    4: "Abril",
    5: "Mayo",
    6: "Junio",
    7: "Julio",
    8: "Agosto",
    9: "Septiembre",
    10: "Octubre",
    11: "Noviembre",
    12: "Diciembre",
}


@dataclass(frozen=True)
class Post:
    date: str  # YYYY-MM-DD
    slug: str  # file name
    title: str
    description: str
    tag: str
    image: str  # file name under assets/blog/


POSTS: list[Post] = [
    Post(
        date="2026-01-24",
        slug="vision-educacion-aprendizaje.html",
        title="La visión en la educación: por qué cuidar los ojos mejora el aprendizaje",
        description="Cómo influye la salud visual en el rendimiento escolar y qué señales vigilar en niños y jóvenes.",
        tag="Salud visual infantil",
        image="2026-01-24-vision-educacion.webp",
    ),
    Post(
        date="2026-02-14",
        slug="san-valentin-regalos-cuidar-vision.html",
        title="Amor a primera vista: regalos de San Valentín para cuidar la visión",
        description="Ideas útiles y con estilo para regalar visión: gafas de sol, monturas y revisiones en pareja.",
        tag="Gafas y estilo",
        image="2026-02-14-san-valentin-vision.webp",
    ),
    Post(
        date="2026-02-17",
        slug="carnaval-disfraces-lentillas-seguras.html",
        title="Disfraces y lentillas: cómo usar lentes de fantasía de forma segura en Carnaval",
        description="Guía clara para evitar infecciones y molestias al usar lentillas de colores o efectos con tu disfraz.",
        tag="Lentillas",
        image="2026-02-17-carnaval-lentillas.webp",
    ),
    Post(
        date="2026-03-08",
        slug="dia-mujer-salud-visual-femenina.html",
        title="Mujeres con visión: salud ocular femenina en el Día de la Mujer",
        description="Cambios visuales en embarazo y menopausia, ojo seco y claves para cuidar la vista en cada etapa.",
        tag="Salud visual",
        image="2026-03-08-salud-visual-femenina.webp",
    ),
    Post(
        date="2026-03-12",
        slug="dia-mundial-glaucoma-peligro-invisible.html",
        title="Día Mundial del Glaucoma: ver el peligro invisible a tiempo",
        description="Qué es el glaucoma, por qué puede avanzar sin síntomas y cómo las revisiones ayudan a detectarlo pronto.",
        tag="Prevención",
        image="2026-03-12-glaucoma.webp",
    ),
    Post(
        date="2026-03-19",
        slug="dia-padre-cuidar-vision-hombres.html",
        title="Ojos de papá: cuidando la visión de los hombres en el Día del Padre",
        description="Consejos de protección en trabajo y deporte, señales de presbicia y regalos útiles para el día a día.",
        tag="Salud visual",
        image="2026-03-19-dia-del-padre.webp",
    ),
    Post(
        date="2026-04-07",
        slug="dia-mundial-salud-salud-visual-bienestar.html",
        title="Día Mundial de la Salud: la importancia de la salud visual en tu bienestar",
        description="Cómo la vista se relaciona con hábitos, ergonomía y salud general, y cuándo conviene revisarse.",
        tag="Bienestar",
        image="2026-04-07-dia-salud.webp",
    ),
    Post(
        date="2026-04-23",
        slug="dia-libro-cuidar-ojos-lectura.html",
        title="Miradas que leen: cuidando tus ojos en el Día del Libro",
        description="Iluminación, postura y descansos para leer más sin fatiga visual (papel, ebook y pantallas).",
        tag="Lectura",
        image="2026-04-23-dia-del-libro.webp",
    ),
    Post(
        date="2026-05-03",
        slug="dia-madre-regalos-cuidados-vision.html",
        title="Los ojos de mamá: regalos y cuidados visuales en el Día de la Madre",
        description="Ideas de regalo con sentido (sol, progresivos, estuches) y claves de cuidado visual para mujeres adultas.",
        tag="Gafas y estilo",
        image="2026-05-03-dia-de-la-madre.webp",
    ),
    Post(
        date="2026-05-17",
        slug="pantallas-iluminacion-proteger-vista-dia-internet.html",
        title="Pantallas e iluminación: protege tu vista en el Día de Internet",
        description="Fatiga visual digital, regla 20-20-20, ergonomía y lentes para ordenador: guía práctica.",
        tag="Pantallas",
        image="2026-05-17-dia-internet.webp",
    ),
    Post(
        date="2026-06-05",
        slug="eco-optica-gafas-sostenibles.html",
        title="Eco-óptica: gafas sostenibles en el Día Mundial del Medio Ambiente",
        description="Materiales responsables, reciclaje de monturas y cómo elegir gafas con impacto menor sin renunciar a calidad.",
        tag="Sostenibilidad",
        image="2026-06-05-eco-optica.webp",
    ),
    Post(
        date="2026-06-27",
        slug="dia-gafas-sol-proteccion-uv.html",
        title="Día de las Gafas de Sol: veraniega tu mirada con protección UV",
        description="Cómo elegir gafas de sol con UV real, qué es la polarización y consejos para niños y conductores.",
        tag="Gafas de sol",
        image="2026-06-27-gafas-de-sol.webp",
    ),
    Post(
        date="2026-07-10",
        slug="verano-sol-cloro-pantallas-cuidar-ojos.html",
        title="Sol, cloro y pantallas: cuida tus ojos durante las vacaciones",
        description="Guía de verano: UV, piscina, sequedad por aire acondicionado y descanso visual para toda la familia.",
        tag="Verano",
        image="2026-07-10-verano-ojos.webp",
    ),
    Post(
        date="2026-07-26",
        slug="dia-abuelos-salud-visual-mayores.html",
        title="La vista de los abuelos: celebrando el Día de los Abuelos con salud visual",
        description="Afecciones frecuentes en mayores, cómo detectarlas a tiempo y soluciones cómodas para el día a día.",
        tag="Visión senior",
        image="2026-07-26-dia-abuelos.webp",
    ),
    Post(
        date="2026-08-15",
        slug="varilux-xr-lentes-progresivas-ultima-generacion.html",
        title="Tecnología a la vista: descubre las lentes Varilux XR de última generación",
        description="Qué aporta una lente progresiva premium y cómo elegir el mejor diseño según tu rutina y necesidades.",
        tag="Lentes progresivas",
        image="2026-08-15-varilux-xr.webp",
    ),
    Post(
        date="2026-09-01",
        slug="vuelta-al-cole-checklist-visual.html",
        title="Vuelta al cole con buena vista: checklist visual para el nuevo curso",
        description="Señales de problemas visuales en clase, hábitos con pantallas y cuándo hacer una revisión infantil.",
        tag="Miopía infantil",
        image="2026-09-01-vuelta-al-cole.webp",
    ),
    Post(
        date="2026-09-06",
        slug="dia-daltonismo-viendo-mundo-otros-colores.html",
        title="Día del Daltonismo: viendo el mundo en otros colores",
        description="Qué es el daltonismo, cómo detectarlo, mitos comunes y claves de accesibilidad en el día a día.",
        tag="Daltonismo",
        image="2026-09-06-daltonismo.webp",
    ),
    Post(
        date="2026-10-08",
        slug="dia-mundial-vision-ama-tus-ojos.html",
        title="Día Mundial de la Visión: ama tus ojos y cuida tu vista",
        description="Hábitos diarios, protección solar y revisiones para prevenir problemas visuales y ganar calidad de vida.",
        tag="Prevención",
        image="2026-10-08-dia-mundial-vision.webp",
    ),
    Post(
        date="2026-10-15",
        slug="dia-ambliopia-ojo-vago-ojo-al-dato.html",
        title="Ojo vago, ojo al dato: Día Mundial de la Ambliopía",
        description="Señales en la infancia, detección temprana y por qué el tratamiento a tiempo cambia el pronóstico.",
        tag="Visión infantil",
        image="2026-10-15-ambliopia.webp",
    ),
    Post(
        date="2026-10-31",
        slug="halloween-lentillas-maquillaje-seguro.html",
        title="Halloween sin sustos oculares: maquillaje FX y lentillas con seguridad",
        description="Consejos para desmaquillarte bien, evitar irritaciones y usar lentillas cosméticas sin riesgos.",
        tag="Lentillas",
        image="2026-10-31-halloween-ojos.webp",
    ),
    Post(
        date="2026-11-14",
        slug="diabetes-vision-retinopatia-diabetica.html",
        title="Diabetes y visión: la retinopatía diabética y por qué revisar la retina",
        description="Cómo afecta la diabetes a los ojos, síntomas de alerta y por qué las revisiones periódicas importan.",
        tag="Salud ocular",
        image="2026-11-14-diabetes-vision.webp",
    ),
    Post(
        date="2026-11-27",
        slug="black-friday-optica-ofertas-calidad.html",
        title="Black Friday en tu óptica: cómo aprovechar ofertas sin perder de vista la calidad",
        description="Guía para comparar promociones en gafas graduadas y de sol: garantía, asesoramiento y elección inteligente.",
        tag="Consejos de compra",
        image="2026-11-27-black-friday.webp",
    ),
    Post(
        date="2026-12-05",
        slug="guia-regalos-navidad-optica.html",
        title="Guía de regalos navideños: detalles para ver y lucir mejor",
        description="Ideas de regalo de óptica para techies, deportistas y amantes de la moda: útil, bonito y con protección.",
        tag="Regalos",
        image="2026-12-05-regalos-navidad.webp",
    ),
    Post(
        date="2026-12-20",
        slug="ojos-sanos-fiestas-navidad-fin-ano.html",
        title="Ojos sanos en las fiestas: consejos visuales para Navidad y fin de año",
        description="Pantallas, luces, frío y sequedad ocular: trucos prácticos para cuidar la vista en vacaciones.",
        tag="Bienestar",
        image="2026-12-20-fiestas-ojos-sanos.webp",
    ),
]


def _safe(text: str) -> str:
    # Keep ASCII in metadata; content can be UTF-8.
    return text.replace("’", "'").replace("“", '"').replace("”", '"')


def _strip_unsafe_html(html: str) -> str:
    # Defensive: strip tags/attributes that should never survive generated body content.
    html = re.sub(r"<script\b[\s\S]*?</script>", "", html, flags=re.I)
    html = re.sub(r"<style\b[\s\S]*?</style>", "", html, flags=re.I)
    html = re.sub(r"<(?:iframe|object|embed|form)\b[\s\S]*?</(?:iframe|object|embed|form)>", "", html, flags=re.I)
    html = re.sub(r"</?(?:html|head|body)\b[^>]*>", "", html, flags=re.I)
    html = re.sub(r"""\son[a-z-]+\s*=\s*(".*?"|'.*?'|[^\s>]+)""", "", html, flags=re.I | re.S)
    html = re.sub(r"""\s(?:href|src)\s*=\s*(['"])\s*javascript:[\s\S]*?\1""", "", html, flags=re.I)
    html = re.sub(r"""\s(?:href|src)\s*=\s*javascript:[^\s>]+""", "", html, flags=re.I)
    html = re.sub(
        r"Pollinations\.AI free text APIs\.\s*\[Support our mission\]\(https://pollinations\.ai/redirect/kofi\)\s*to keep AI accessible for everyone\.?",
        "",
        html,
        flags=re.I | re.S,
    )
    return html.strip()


def _word_count(html: str) -> int:
    text = re.sub(r"<[^>]+>", " ", html)
    words = [w for w in re.split(r"\s+", text) if w]
    return len(words)


def _read_time_minutes(words: int) -> int:
    # 200 wpm is a reasonable baseline for Spanish web reading.
    return max(4, round(words / 200))


def _ensure_command(name: str) -> None:
    if shutil.which(name) is None:
        raise RuntimeError(f"Required command not found: {name}")


def _extract_message_text(content: object) -> str:
    if isinstance(content, str):
        return content
    if isinstance(content, list):
        chunks: list[str] = []
        for item in content:
            if isinstance(item, dict) and item.get("type") == "text":
                chunks.append(str(item.get("text", "")))
        return "\n".join(part for part in chunks if part)
    return ""


def _api_call(messages: list[dict[str, str]], *, max_tokens: int = 2200) -> str:
    _ensure_command("curl")

    payload = {
        "model": "openai",
        "reasoning_effort": "low",
        "messages": messages,
        "temperature": 0.8,
        "max_tokens": max_tokens,
        "stream": False,
    }

    # Anonymous tier is rate-limited; retry with backoff on 429 / transient errors.
    delay = 2.0
    for attempt in range(10):
        try:
            raw = subprocess.run(
                [
                    "curl",
                    "-sSL",
                    "--fail",
                    "--connect-timeout",
                    str(CURL_CONNECT_TIMEOUT),
                    "--max-time",
                    str(CURL_MAX_TIME),
                    AI_ENDPOINT,
                    "-H",
                    "Content-Type: application/json",
                    "-d",
                    json.dumps(payload),
                ],
                check=True,
                capture_output=True,
                text=True,
                timeout=240,
            ).stdout
            obj = json.loads(raw)
            choices = obj.get("choices") or []
            if not choices:
                raise RuntimeError(f"Unexpected AI response payload: {obj}")
            msg = choices[0].get("message") or {}
            content = _extract_message_text(msg.get("content"))
            if not content:
                # Some models return reasoning_content; as a fallback, use it.
                content = _extract_message_text(msg.get("reasoning_content"))
            return content
        except subprocess.CalledProcessError as e:
            details = f"{e.stderr or ''}\n{e.stdout or ''}".strip()
            msg = details or str(e)
            should_retry = any(
                code in msg
                for code in (
                    "429",
                    "502",
                    "503",
                    "504",
                    "Connection reset",
                    "Empty reply",
                    "timed out",
                    "temporarily",
                )
            )
            if not should_retry or attempt == 9:
                raise
            time.sleep(delay)
            delay = min(delay * 1.8, 30)
        except subprocess.TimeoutExpired as e:
            if attempt == 9:
                raise
            time.sleep(delay)
            delay = min(delay * 1.8, 30)
        except Exception:
            if attempt == 9:
                raise
            time.sleep(delay)
            delay = min(delay * 1.8, 30)

    raise RuntimeError("unreachable")


def _draft_post_body(post: Post) -> str:
    # Part 1: context + core content (no FAQ).
    user_1 = (
        f"TITULO DEL ARTICULO: {post.title}\n"
        f"CONTEXTO/FECHA: {post.date}\n"
        f"ENFOQUE: {post.tag}\n\n"
        "Escribe la PARTE 1/2 del cuerpo del articulo.\n"
        "- Devuelve SOLO HTML (sin <html>, sin <head>, sin <body>).\n"
        "- Usa SOLO estas etiquetas: <h2>, <h3>, <p>, <ul>, <ol>, <li>, <strong>, <em>, <a>.\n"
        "- NO uses <h1>.\n"
        "- No uses porcentajes ni el simbolo %.\n"
        "- Incluye 1-2 parrafos de introduccion y una lista breve de 'en este articulo veras'.\n"
        "- Incluye al menos 4 secciones <h2> con contenido util y accionable.\n"
        "- No incluyas la seccion de Preguntas frecuentes ni la conclusion (eso ira en la parte 2).\n"
        "- Incluye 1 enlace interno como ejemplo (relativo y sin dominio): "
        '<a href="../servicios.html">servicios</a>.'
    )

    part1 = _api_call(
        [{"role": "system", "content": SYSTEM_PROMPT}, {"role": "user", "content": user_1}],
        max_tokens=2200,
    )

    # Part 2: continue + FAQ + conclusion + CTA.
    user_2 = (
        f"TITULO DEL ARTICULO: {post.title}\n"
        f"CONTEXTO/FECHA: {post.date}\n"
        f"ENFOQUE: {post.tag}\n\n"
        "Escribe la PARTE 2/2 del cuerpo del articulo.\n"
        "- Devuelve SOLO HTML (sin <html>, sin <head>, sin <body>).\n"
        "- Usa SOLO estas etiquetas: <h2>, <h3>, <p>, <ul>, <ol>, <li>, <strong>, <em>, <a>.\n"
        "- NO repitas la introduccion ni titulos ya usados; continua con secciones nuevas.\n"
        "- No uses porcentajes ni el simbolo %.\n"
        "- Incluye al menos 3 secciones <h2> adicionales.\n"
        "- Incluye una seccion <h2>Preguntas frecuentes</h2> con 6 preguntas en <h3> y respuesta en <p>.\n"
        "- Termina con una seccion <h2>Conclusion</h2> y un aviso medico en un <p> separado: "
        "\"Este contenido es informativo y no sustituye una valoracion profesional.\".\n"
        "- Incluye al menos 2 enlaces internos (relativos, sin dominio): "
        '<a href="../cita.html">pedir cita</a> y <a href="../centros.html">centros</a>.'
    )

    part2 = _api_call(
        [{"role": "system", "content": SYSTEM_PROMPT}, {"role": "user", "content": user_2}],
        max_tokens=2200,
    )

    body = "\n\n".join([_strip_unsafe_html(part1), _strip_unsafe_html(part2)])

    # Fix any accidental <h1> tags.
    body = re.sub(r"<\s*/?\s*h1\b", lambda m: m.group(0).replace("h1", "h2"), body, flags=re.I)
    return body.strip()


def _render_post(
    post: Post,
    *,
    prev_slug: str | None,
    next_slug: str | None,
    body_html: str,
    read_minutes: int,
) -> str:
    d = date.fromisoformat(post.date)
    month_label = f"{MONTHS_ES[d.month]} {d.year}"

    json_ld = {
        "@context": "https://schema.org",
        "@type": "BlogPosting",
        "headline": post.title,
        "description": post.description,
        "datePublished": post.date,
        "dateModified": post.date,
        "image": f"{BASE_URL}/assets/blog/{post.image}",
        "author": {"@type": "Organization", "name": "Todo Óptica"},
        "publisher": {
            "@type": "Organization",
            "name": "Todo Óptica",
            "logo": {"@type": "ImageObject", "url": f"{BASE_URL}/assets/logo.svg"},
        },
        "mainEntityOfPage": {"@type": "WebPage", "@id": f"{BASE_URL}/blog/{post.slug}"},
    }

    prev_link = (
        f'<a class="btn ghost small" href="{prev_slug}">Anterior</a>' if prev_slug else ""
    )
    next_link = (
        f'<a class="btn ghost small" href="{next_slug}">Siguiente</a>' if next_slug else ""
    )

    nav_row = ""
    if prev_link or next_link:
        nav_row = f'<div class="hero-actions" style="margin-top: 10px">{prev_link}{next_link}</div>'

    # Standard CTA (consistent across posts).
    cta = """
            <h2>¿Quieres una recomendación personalizada?</h2>
            <p>
              En <strong>Todo Óptica</strong> te ayudamos a elegir la mejor solución para tu caso (graduación, lentes,
              monturas y protección). Si quieres revisar tu vista o resolver dudas, pide una cita.
            </p>
            <ul>
              <li><a href="../cita.html">Pedir cita</a> (respuesta rápida por email)</li>
              <li><a href="../servicios.html">Ver servicios</a> y opciones disponibles</li>
              <li><a href="../preguntas-frecuentes.html">Preguntas frecuentes</a> (dudas comunes)</li>
            </ul>
    """.strip()

    return f"""<!doctype html>
<html lang="es">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>{_safe(post.title)} | Blog Todo Óptica</title>
    <meta name="description" content="{_safe(post.description)}" />
    <meta name="theme-color" content="#0b9c4c" />
    <meta name="view-transition" content="same-origin" />
    <meta property="og:title" content="{_safe(post.title)}" />
    <meta property="og:description" content="{_safe(post.description)}" />
    <meta property="og:type" content="article" />
    <meta property="og:locale" content="es_ES" />
    <meta property="og:site_name" content="Todo Óptica" />
    <meta property="og:image" content="../assets/blog/{post.image}" />
    <meta name="twitter:card" content="summary_large_image" />
    <link rel="canonical" href="{BASE_URL}/blog/{post.slug}" />
    <link rel="alternate" type="application/rss+xml" title="Blog Todo Óptica" href="../rss.xml" />
    <link rel="icon" type="image/svg+xml" href="../assets/favicon.svg" />
    <link rel="preconnect" href="https://fonts.googleapis.com" />
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
    <link
      href="https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,600;9..144,700&family=Space+Grotesk:wght@400;500;600;700&display=swap"
      rel="stylesheet"
    />
    <link rel="stylesheet" href="../styles.css" />
    <script type="application/ld+json">
{json.dumps(json_ld, ensure_ascii=False, indent=2)}
    </script>
  </head>
  <body class="blog-body">
    <div class="background-glow" aria-hidden="true"></div>

    <header class="site-header">
      <div class="container nav-wrap">
        <a class="logo" href="../index.html">
          <img class="logo-img" src="../assets/logo.svg" alt="Todo Óptica" width="160" height="35" />
        </a>
        <button class="nav-toggle" aria-expanded="false" aria-controls="site-nav">
          <span class="sr-only">Abrir menú</span>
          <span></span>
          <span></span>
        </button>
        <nav id="site-nav" class="site-nav">
          <a href="../index.html">Inicio</a>
          <a href="../servicios.html">Servicios</a>
          <a href="../control-miopia.html">Control de miopía</a>
          <a href="../tecnologia.html">Tecnología</a>
          <a href="../audiologia.html">Audiología</a>
          <a href="../centros.html">Centros</a>
          <a class="cta" href="../cita.html">Cita previa</a>
          <a class="active" href="../blog.html">Blog</a>
        </nav>
      </div>
    </header>

    <main>
      <section class="hero blog-hero">
        <div class="container hero-grid">
          <div class="hero-copy reveal">
            <p class="eyebrow">Blog</p>
            <h1>{_safe(post.title)}</h1>
            <p class="lead">{_safe(post.description)}</p>
            <div class="hero-actions" style="margin-top: 18px">
              <a class="btn primary" href="../cita.html">Pedir cita</a>
              <a class="btn ghost" href="../blog.html">Volver al blog</a>
            </div>
            {nav_row}
          </div>

          <div class="hero-media reveal" aria-hidden="true">
            <div class="media-card media-card--main blog-hero-media">
              <img
                src="../assets/blog/{post.image}"
                alt=""
                width="1024"
                height="768"
                loading="eager"
                decoding="async"
              />
            </div>
          </div>
        </div>
      </section>

      <section class="section blog-posts">
        <div class="container">
          <article class="post-card reveal">
            <p class="post-meta">{month_label} · {read_minutes} min · {_safe(post.tag)}</p>
            {body_html}
            {cta}
          </article>
        </div>
      </section>
    </main>

    <footer class="site-footer">
      <div class="container footer-grid">
        <div>
          <img
            class="footer-logo"
            src="../assets/logo.svg"
            alt="Todo Óptica"
            width="180"
            height="39"
            loading="lazy"
          />
          <p>Óptica y audiología con tres centros en Valladolid y Madrid.</p>
          <div class="footer-social">
            <a href="https://es-es.facebook.com/TodoOpticaLabradores/" target="_blank" rel="noreferrer">Facebook</a>
            <a href="https://www.instagram.com/todooptica.va/" target="_blank" rel="noreferrer">Instagram</a>
          </div>
        </div>
        <div>
          <h4>Enlaces</h4>
          <p><a href="../servicios.html">Servicios</a></p>
          <p><a href="../centros.html">Centros</a></p>
          <p><a href="../cita.html">Cita previa</a></p>
          <p><a href="../preguntas-frecuentes.html">Preguntas frecuentes</a></p>
        </div>
        <div>
          <h4>Datos legales</h4>
          <p>TODO ÓPTICA, S.L. · CIF B47245063</p>
          <p>Domicilio: Paseo de Zorrilla 62, 47008 Valladolid</p>
          <p>Email legal: todooptica.zo@gmail.com</p>
        </div>
      </div>
      <div class="footer-bottom">
        <p>© 2026 Todo Óptica. Todos los derechos reservados.</p>
        <p><a href="../blog.html">Blog</a></p>
      </div>
    </footer>

    <script src="../script.js"></script>
  </body>
</html>
"""


def _render_blog_index(posts: list[Post]) -> str:
    cards = []
    for p in posts:
        cards.append(
            f"""
            <a class="blog-card reveal" href="blog/{p.slug}">
              <img class="blog-thumb" src="assets/blog/{p.image}" alt="" width="1024" height="768" loading="lazy" />
              <div class="blog-card-body">
                <span class="blog-tag">{_safe(p.tag)}</span>
                <h3>{_safe(p.title)}</h3>
                <p>{_safe(p.description)}</p>
              </div>
            </a>
            """.strip()
        )

    return f"""<!doctype html>
<html lang="es">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Blog | Todo Óptica</title>
    <meta
      name="description"
      content="Blog de Todo Óptica: calendario editorial 2026 con 24 artículos optimizados para SEO sobre salud visual, pantallas, lentillas y bienestar."
    />
    <meta name="theme-color" content="#0b9c4c" />
    <meta name="view-transition" content="same-origin" />
    <meta property="og:title" content="Blog | Todo Óptica" />
    <meta property="og:description" content="Calendario editorial 2026: 24 guías prácticas para ver mejor." />
    <meta property="og:type" content="website" />
    <meta property="og:locale" content="es_ES" />
    <meta property="og:site_name" content="Todo Óptica" />
    <meta property="og:image" content="assets/ai-hero-eyeglasses.webp" />
    <meta name="twitter:card" content="summary_large_image" />
    <link rel="canonical" href="{BASE_URL}/blog.html" />
    <link rel="alternate" type="application/rss+xml" title="Blog Todo Óptica" href="rss.xml" />
    <link rel="icon" type="image/svg+xml" href="assets/favicon.svg" />
    <link rel="preconnect" href="https://fonts.googleapis.com" />
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
    <link
      href="https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,600;9..144,700&family=Space+Grotesk:wght@400;500;600;700&display=swap"
      rel="stylesheet"
    />
    <link rel="stylesheet" href="styles.css" />
  </head>
  <body class="blog-body">
    <div class="background-glow" aria-hidden="true"></div>

    <header class="site-header">
      <div class="container nav-wrap">
        <a class="logo" href="index.html">
          <img class="logo-img" src="assets/logo.svg" alt="Todo Óptica" width="160" height="35" />
        </a>
        <button class="nav-toggle" aria-expanded="false" aria-controls="site-nav">
          <span class="sr-only">Abrir menú</span>
          <span></span>
          <span></span>
        </button>
        <nav id="site-nav" class="site-nav">
          <a href="index.html">Inicio</a>
          <a href="servicios.html">Servicios</a>
          <a href="control-miopia.html">Control de miopía</a>
          <a href="tecnologia.html">Tecnología</a>
          <a href="audiologia.html">Audiología</a>
          <a href="centros.html">Centros</a>
          <a class="cta" href="cita.html">Cita previa</a>
          <a class="active" href="blog.html">Blog</a>
        </nav>
      </div>
    </header>

    <main>
      <section class="hero blog-hero">
        <div class="container hero-grid">
          <div class="hero-copy reveal">
            <p class="eyebrow">Blog Todo Óptica</p>
            <h1>Calendario editorial 2026</h1>
            <p class="lead">
              24 artículos largos (SEO) alineados con fechas clave: educación, pantallas, glaucoma, lectura, verano,
              sostenibilidad, visión infantil y más.
            </p>
            <div class="search-bar">
              <label class="sr-only" for="blog-search">Buscar</label>
              <input id="blog-search" type="search" placeholder="Buscar por tema: miopía, lentillas, pantallas..." />
              <span id="search-count">{len(posts)} artículos</span>
            </div>
            <div class="hero-actions" style="margin-top: 18px">
              <a class="btn primary" href="cita.html">Pedir cita</a>
              <a class="btn ghost" href="servicios.html">Ver servicios</a>
            </div>
          </div>

          <div class="hero-media reveal" aria-hidden="true">
            <div class="media-card media-card--main blog-hero-media">
              <img
                src="assets/ai-hero-eyeglasses.webp"
                alt=""
                width="1024"
                height="768"
                loading="eager"
                decoding="async"
              />
            </div>
          </div>
        </div>
      </section>

      <section class="section">
        <div class="container">
          <div class="section-heading reveal">
            <p class="eyebrow">Entradas</p>
            <h2>Guías 2026 (optimizadas para SEO)</h2>
          </div>
          <div class="blog-grid" id="blog-grid">
{chr(10).join(cards)}
          </div>
        </div>
      </section>
    </main>

    <footer class="site-footer">
      <div class="container footer-grid">
        <div>
          <img class="footer-logo" src="assets/logo.svg" alt="Todo Óptica" width="180" height="39" loading="lazy" />
          <p>Óptica y audiología con tres centros en Valladolid y Madrid.</p>
          <div class="footer-social">
            <a href="https://es-es.facebook.com/TodoOpticaLabradores/" target="_blank" rel="noreferrer">Facebook</a>
            <a href="https://www.instagram.com/todooptica.va/" target="_blank" rel="noreferrer">Instagram</a>
          </div>
        </div>
        <div>
          <h4>Enlaces</h4>
          <p><a href="servicios.html">Servicios</a></p>
          <p><a href="centros.html">Centros</a></p>
          <p><a href="cita.html">Cita previa</a></p>
          <p><a href="preguntas-frecuentes.html">Preguntas frecuentes</a></p>
        </div>
        <div>
          <h4>Datos legales</h4>
          <p>TODO ÓPTICA, S.L. · CIF B47245063</p>
          <p>Domicilio: Paseo de Zorrilla 62, 47008 Valladolid</p>
          <p>Email legal: todooptica.zo@gmail.com</p>
        </div>
      </div>
      <div class="footer-bottom">
        <p>© 2026 Todo Óptica. Todos los derechos reservados.</p>
        <p><a href="blog.html">Blog</a></p>
      </div>
    </footer>

    <script src="script.js"></script>
  </body>
</html>
"""


def main() -> None:
    root = Path(".")
    blog_dir = root / "blog"
    blog_dir.mkdir(parents=True, exist_ok=True)

    # Sort chronologically for prev/next.
    posts = sorted(POSTS, key=lambda p: p.date)

    # Generate posts.
    for idx, post in enumerate(posts):
        out_path = blog_dir / post.slug
        if out_path.exists():
            print(f"skip {out_path}")
            continue

        print(f"draft {post.slug} ({post.date}) ...")
        body = _draft_post_body(post)
        words = _word_count(body)
        read_min = _read_time_minutes(words)

        extra_blocks = 0
        extra_angles = [
            "Checklist accionable",
            "Errores comunes y como evitarlos",
            "Rutina paso a paso",
            "Senales de alerta y cuando pedir cita",
            "Mitos y verdades",
        ]

        while words < TARGET_WORDS and extra_blocks < MAX_EXTRA_BLOCKS:
            extra_blocks += 1
            angle = extra_angles[(extra_blocks - 1) % len(extra_angles)]
            print(f"  -> expanding ({words} words) [extra {extra_blocks}/{MAX_EXTRA_BLOCKS}: {angle}] ...")

            extra_prompt = (
                f"TITULO: {post.title}\n"
                f"CONTEXTO/FECHA: {post.date}\n"
                f"TEMA: {post.tag}\n\n"
                "Anade un BLOQUE EXTRA para ampliar el articulo (sin repetir contenido).\n"
                f"- Enfoque del bloque: {angle}.\n"
                "- Devuelve SOLO HTML.\n"
                "- Usa <h2>, <h3>, <p>, <ul>, <li>, <strong>, <em>, <a>.\n"
                "- No uses porcentajes ni el simbolo %.\n"
                "- No inventes estadisticas.\n"
                "- Incluye 2 o 3 secciones <h2> nuevas, con listas y ejemplos practicos.\n"
                "- Incluye 1 enlace interno: <a href=\"../cita.html\">pedir cita</a>.\n"
            )

            extra = _api_call(
                [
                    {"role": "system", "content": SYSTEM_PROMPT},
                    {"role": "user", "content": extra_prompt},
                ],
                max_tokens=2200,
            )
            extra = _strip_unsafe_html(extra)
            extra = re.sub(
                r"<\s*/?\s*h1\b",
                lambda m: m.group(0).replace("h1", "h2"),
                extra,
                flags=re.I,
            )
            body = (body + "\n\n" + extra).strip()
            words = _word_count(body)
            read_min = _read_time_minutes(words)

        prev_slug = posts[idx - 1].slug if idx > 0 else None
        next_slug = posts[idx + 1].slug if idx + 1 < len(posts) else None
        html = _render_post(
            post,
            prev_slug=prev_slug,
            next_slug=next_slug,
            body_html=body,
            read_minutes=read_min,
        )
        out_path.write_text(html, encoding="utf-8")

        print(f"  wrote {out_path} ({words} words, ~{read_min} min)")

    # Rewrite blog.html index every time (cheap and deterministic).
    (root / "blog.html").write_text(_render_blog_index(posts), encoding="utf-8")
    print("wrote blog.html")


if __name__ == "__main__":
    main()
