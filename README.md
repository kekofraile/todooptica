# Todo Optica - Web

Sitio estatico multipagina (MPA) para Todo Optica, optimizado para SEO y con mejoras de UX (buscador global tipo command palette, TOC y progreso de lectura en el blog, y transiciones entre paginas en navegadores compatibles).

## Desarrollo

- Instalar dependencias:
  - `npm install`
- Servidor local:
  - `npm run dev`
  - Abrir `http://localhost:5173/`
  - Incluye la sección `Juegos` y la landing `simulador-optica.html`
  - `Lumen Optical: Store Rush` vive en `games/lumen-optical-store-rush/app/` y se publica en `/games/lumen-optical-store-rush/`
  - Para recompilar el juego: `npm run build:store-rush`
- Formatear codigo:
  - `npm run format`
- Regenerar indices (busqueda, RSS, sitemap):
  - `npm run generate`
- Verificacion rapida (links internos y recursos):
  - `npm run check`
  - Incluye validacion de residuos editoriales en HTML publico
- Preparar publicación para `dist/`:
  - `npm run publish`
- Ejecutar E2E:
  - `npx playwright test`
  - Si faltan navegadores: `npx playwright install chromium`

## Paginas

- Inicio: `index.html`
- Servicios: `servicios.html`
- Control de miopia: `control-miopia.html`
- Tecnologia: `tecnologia.html`
- Audiologia: `audiologia.html`
- Centros: `centros.html`
- Cita previa: `cita.html`
- Preguntas frecuentes: `preguntas-frecuentes.html`
- Blog (indice): `blog.html`
- Blog (posts): `blog/*.html`
- Juego standalone: `games/lumen-optical-store-rush/`

## SEO

- Sitemap: `sitemap.xml`
- Robots: `robots.txt`
- RSS: `rss.xml`
- JSON-LD:
  - Blog index: `Blog`
  - Posts: `BlogPosting`

## Política de legado público

- El contenido histórico se conserva en `legacy_archive/` únicamente para consulta interna.
- Nunca debe exponerse en enlaces públicos, `sitemap.xml`, `rss.xml` o builds de publicación.

## Fuente vs artefactos

- El codigo fuente vive en la raiz, `assets/`, `vendor/`, `blog/`, `scripts/` y `games/lumen-optical-store-rush/app/`.
- `dist/` es una snapshot generada para publicación. No se edita manualmente.
- `games/lumen-optical-store-rush/` contiene la salida estática publicada del juego y su `app/` fuente.
- `output/` contiene capturas y artefactos locales de QA/iteración. No forma parte de la base fuente.
- `.playwright/`, `playwright-report/`, `test-results/`, `.DS_Store` y `__pycache__/` son artefactos locales y deben permanecer fuera de la superficie fuente/publica.
- `references/` contiene material de apoyo no publico.

## Validación y publicación

- `npm run check` valida solo la fuente actual y regenera `search-index.json`, `rss.xml` y `sitemap.xml`.
- `npm run publish` valida la fuente, reconstruye `dist/` desde cero y luego valida la superficie publicada resultante.

## Pipeline editorial con IA

- `npm run generate:content` puede reescribir `blog.html` y generar contenido publico en `blog/` y `assets/blog/`.
- Requiere conectividad de red y herramientas del entorno:
  - `curl`
  - `magick` (ImageMagick)
- Flujo recomendado:
  1. Generar borradores.
  2. Revisar factual y editorialmente cada post e imagen.
  3. Ejecutar `npm run check`.
  4. Publicar solo despues de la validación manual.

## UX / Performance

- Buscador global (Ctrl+K / Cmd+K) con indice: `search-index.json`
- Progreso de lectura y tabla de contenidos en posts del blog (auto-generado por JS)
- View Transitions (cross-document) en navegadores compatibles via meta `view-transition`
- Prefetch (Speculation Rules) en `index.html`
