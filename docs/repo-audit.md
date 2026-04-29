# Auditoría técnica del repositorio

## Resumen verificado

- Sitio: **Todo Óptica**.
- Stack de ejecución: **HTML + CSS + JavaScript vanilla** en una **MPA**.
- Tooling editorial/publicación: **Python**.
- Tests E2E: **Playwright**.
- Vendor local: `vendor/flatpickr/` y `vendor/three.module.min.js`.
- Inventario actual verificado:
  - `22` páginas HTML en raíz.
  - `24` posts HTML en `blog/`.

## Mapa funcional por bloque

| Bloque                             | HTML principal                                         | Hooks/DOM                                                             | JS responsable                                                                                                                                                                                                              | Dependencias/runtime                                          | Cobertura E2E actual                                   | Observaciones                                                                                             |
| ---------------------------------- | ------------------------------------------------------ | --------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------- | ------------------------------------------------------ | --------------------------------------------------------------------------------------------------------- |
| Shell global del sitio             | Todas las páginas con `script.js`                      | navegación, menú móvil, command palette, sticky CTA, reveal, footer   | `script.js` -> `script-base.js`                                                                                                                                                                                             | `window.TodoOptica`, `window.TodoOpticaUi`, `data-*` globales | parcial vía `smoke.spec.js` y flujos de página         | El shell es shared runtime real del sitio. También contiene config de centros y agenda.                   |
| UX shared / scrolly / tabs / rails | `index.html` y otras páginas con bloques interactivos  | tabs, scrolly steps, rails horizontales                               | `script.js` -> `script-ui.js`                                                                                                                                                                                               | DOM por `data-*` y patrones CSS existentes                    | indirecta                                              | No es framework-level; son mejoras progresivas por selector.                                              |
| Inicio                             | `index.html`                                           | hero, rail horizontal, reveal, CTA                                    | `script-ui.js` + shell global                                                                                                                                                                                               | navegación, view transitions, UX base                         | `smoke.spec.js` indirecta                              | Página de marketing principal; no usa módulo propio exclusivo.                                            |
| Servicios                          | `servicios.html`                                       | grid de servicios, `data-eye-*`, `data-lens-*`                        | `script.js` -> `script-eye-explorer-shared.js` -> `script-servicios.js`                                                                                                                                                     | canvas 2D, import dinámico 3D, controlador compartido         | `tests/e2e/games.spec.js`                              | Esta pasada consolida la metadata del explorador en `script-eye-explorer-shared.js`.                      |
| Lens Lab                           | `servicios.html#lens-lab`                              | `data-lens-lab`, score, hints, answer                                 | `script-servicios.js`                                                                                                                                                                                                       | canvas 2D, estado local por root                              | `tests/e2e/games.spec.js`                              | Minijuego embebido en Servicios.                                                                          |
| Explorador anatómico del ojo       | `servicios.html#ojo-explorador`                        | `data-eye-explorer`, `data-eye-canvas`, hotspots, panel derecho, quiz | `script-servicios.js` + `script-eye-explorer-shared.js` + `script-eye-explorer-core.js` + opt-in `script-eye-explorer-3d.js`                                                                                                | SVG clínico, canvas 2D/2.5D por defecto, WebGL bajo flag      | `tests/e2e/games.spec.js`                              | El modo por defecto sigue siendo 2D salvo `data-eye-use3d="true"` o `window.__eyeExplorerUse3D === true`. |
| Control de miopía                  | `control-miopia.html`                                  | simulador y predictor                                                 | `script.js` -> `script-miopia.js`                                                                                                                                                                                           | SVG chart, canvas/DOM state                                   | `myopia-simulator.spec.js`, `myopia-predictor.spec.js` | Dos experiencias distintas en la misma página.                                                            |
| Tecnología                         | `tecnologia.html`                                      | desafío de enfoque                                                    | `script.js` -> `script-tech.js`                                                                                                                                                                                             | estado global de minijuego, temporizador, blur                | `games.spec.js`                                        | Se prueba la captura y el modo temporizado.                                                               |
| Cita                               | `cita.html`                                            | selector de centro, wizard, calendario, horarios                      | `script.js` -> `script-cita.js` + datos en `script-base.js`                                                                                                                                                                 | `flatpickr`, perfiles de agenda, festivos por año, centros    | `appointment-wizard.spec.js`, `service-finder.spec.js` | La lógica de agenda depende hoy de config embebida en `script-base.js`.                                   |
| Catálogo                           | `catalogo.html`                                        | filtros, contador, chips                                              | `script.js` -> `script-catalogo.js`                                                                                                                                                                                         | filtros por dataset                                           | `catalogo.spec.js`                                     | Lógica simple y acoplada a markup del catálogo.                                                           |
| Blog índice y posts                | `blog.html` + `blog/*.html`                            | buscador, TOC, reading progress                                       | `script.js` -> `script-blog.js`                                                                                                                                                                                             | `search-index.json`, headings del post                        | `blog-search.spec.js`                                  | La búsqueda depende del índice generado por Python.                                                       |
| Juegos hub                         | `juegos.html`                                          | cards/hub                                                             | shell global                                                                                                                                                                                                                | navegación normal                                             | cobertura indirecta                                    | Hub estático.                                                                                             |
| Prisma Rush standalone             | `game.html` + `game.js`                                | canvas del juego standalone                                           | `game.js`                                                                                                                                                                                                                   | runtime propio, aislado del loader condicional                | `games.spec.js` parcial por suite de juegos            | Es la única app no cargada por `script.js`.                                                               |
| SEO / publicación / validación     | `search-index.json`, `rss.xml`, `sitemap.xml`, `dist/` | N/A                                                                   | `scripts/generate-search-index.py`, `scripts/generate-rss.py`, `scripts/generate-sitemap.py`, `scripts/check-links.py`, `scripts/validate-public-surface.py`, `scripts/validate-editorial-surface.py`, `scripts/publish.py` | Python 3, árbol fuente, snapshot `dist/`                      | cubierto por `npm run check` / `npm run publish`       | `dist/` es generado, no debe editarse a mano.                                                             |

## Funcionamiento real por tecnología

### HTML

- La estructura es **multipágina** y el layout se repite entre archivos raíz y posts del blog.
- El `<head>` suele incluir SEO básico consistente: `title`, `description`, `canonical`, Open Graph y JSON-LD.
- No existe un sistema de plantillas en build; la repetición de header/footer/layout es literal en HTML.
- Consecuencia práctica:
  - Cambios transversales de layout exigen tocar muchas páginas.
  - El SEO es explícito y controlable archivo a archivo.
  - La regresión más probable es la deriva entre páginas similares.

### CSS

- El repo venía con un `styles.css` muy centralizado; en esta pasada se extrajeron los bloques de `ojo-explorador` y `lens-lab` a `styles-servicios.css`.
- Aun así, la mayor parte del sistema visual sigue concentrada en `styles.css`.
- Organización real observada:
  - base/layout global mezclado con componentes.
  - reglas de páginas específicas mezcladas con componentes reutilizables.
  - estilos vendor override de `flatpickr` dentro del mismo archivo global.
- Puntos de acoplamiento:
  - nombres de clase largos y estables.
  - algunos efectos dependen de jerarquía exacta del DOM.
  - hay media queries embebidas junto al componente original.

### JavaScript vanilla

- `script.js` es el **loader condicional** real del sitio.
- Patrón dominante:
  - detectar páginas o bloques por selector.
  - cargar solo el módulo necesario.
  - mantener el shell global en `script-base.js`.
- `script-base.js` concentra demasiado:
  - navegación y command palette.
  - sticky CTA.
  - helpers shared.
  - centros y reglas de agenda.
- `script-servicios.js` mezcla dos apps distintas en una misma página:
  - Lens Lab.
  - explorador anatómico.
- El explorador del ojo ahora queda partido así:
  - `script-eye-explorer-shared.js`: fuente única de partes, strings, anclajes y controlador DOM.
  - `script-eye-explorer-core.js`: wrapper ESM para el runtime 3D.
  - `script-servicios.js`: presentación 2D/2.5D por defecto.
  - `script-eye-explorer-3d.js`: experiencia WebGL opt-in.
- El sitio usa **progressive enhancement** real:
  - si no procede una página, el módulo no se carga.
  - el explorador 3D no es obligatorio.
  - la experiencia sigue siendo funcional con el fallback 2D.

### Python

- Los scripts Python no son secundarios; son parte del producto publicado.
- Roles actuales:
  - `generate-search-index.py`: crea el índice para búsqueda del blog.
  - `generate-rss.py`: construye `rss.xml`.
  - `generate-sitemap.py`: construye `sitemap.xml`.
  - `check-links.py`: valida referencias locales.
  - `validate-public-surface.py`: bloquea rutas legacy/no públicas.
  - `validate-editorial-surface.py`: bloquea residuos editoriales y de proveedor.
  - `publish.py`: genera `dist/` desde cero y valida fuente + snapshot.
- Dependencia editorial:
  - `generate-blog-2026-posts.py` e `generate-blog-images.py` forman parte del flujo de contenido.
  - requieren revisión manual previa a publicación.

### Playwright

- Cobertura actual real:
  - `appointment-wizard.spec.js`
  - `blog-search.spec.js`
  - `catalogo.spec.js`
  - `games.spec.js`
  - `myopia-predictor.spec.js`
  - `myopia-simulator.spec.js`
  - `service-finder.spec.js`
  - `smoke.spec.js`
- Qué comprueba de verdad:
  - rutas principales cargan.
  - wizard de cita y calendario funcionan.
  - minijuegos / experiencias embebidas responden.
  - búsqueda del blog y filtros del catálogo no están rotos.
- Carencias:
  - no hay cobertura profunda del shell global.
  - no hay snapshot visual estable del explorador del ojo.
  - no hay test específico de publicación `dist/`.

### Vendor

- `flatpickr`
  - cargado de forma clásica en `cita.html`.
  - usado desde `script-cita.js`.
  - parte del styling se sobreescribe desde CSS del proyecto.
- `three.module.min.js`
  - usado solo por `script-eye-explorer-3d.js`.
  - no debe condicionar la experiencia principal porque el default sigue siendo 2D.

## Hallazgos de higiene y publicación

- `dist/` debe tratarse como **snapshot generada**.
- `node_modules/`, `output/`, `.playwright/`, `.DS_Store` y `scripts/__pycache__/` son artefactos locales o de entorno.
- Se detectó un asset pesado no referenciado:
  - `assets/models/bodyparts3d/BodyParts3D_3.0_obj_99.zip`
- Riesgo:
  - ocupa superficie innecesaria.
  - si se publica por error, añade peso y ruido operativo.
- Esta auditoría asume que el repo puede estar fuera de git o en un árbol no inicializado; por tanto no depende de estado de worktree para distinguir fuente vs artefacto.

## Hallazgos de arquitectura

### 1. Agenda y festivos demasiado acoplados

- `script-base.js` contiene `appointmentProfiles`, `holidaysByYear`, centros y helpers de agenda.
- `script-cita.js` consume esa config indirectamente.
- Problema:
  - reglas de negocio y shell global viven mezclados.
  - añadir un año o variar horarios por centro obliga a tocar un runtime global.

### 2. Repetición estructural en HTML

- Header, footer y parte del shell están duplicados en múltiples HTML.
- No es un bug por sí mismo, pero sí una fuente clara de deriva.

### 3. CSS todavía monolítico

- El split de `styles-servicios.css` reduce riesgo local en Servicios.
- El resto del sistema sigue necesitando una división real por capas/dominios.

### 4. Pipeline editorial con riesgo de publicación accidental

- El generador de posts y el proveedor externo pueden introducir residuos no deseados.
- Esta pasada añade validación explícita y saneamiento defensivo, pero la revisión humana sigue siendo obligatoria.

## Cambios ya aplicados en esta pasada

- Nuevo shared runtime del explorador:
  - `script-eye-explorer-shared.js`
  - `script-eye-explorer-core.js`
- Refactor del explorador 2D/2.5D:
  - `script-servicios.js`
- Ajuste del 3D al controlador compartido:
  - `script-eye-explorer-3d.js`
- Nuevo arte anatómico base:
  - `assets/eye-anatomy-explorer.svg`
- Split CSS local de Servicios:
  - `styles-servicios.css`
- `servicios.html` actualizado para cargar la hoja específica y corregir copy/ARIA.
- Nueva validación editorial:
  - `scripts/validate-editorial-surface.py`
- `npm run check` y `scripts/publish.py` endurecidos con la validación editorial.

## Riesgos residuales

- El explorador 3D sigue siendo una ruta separada con coste de mantenimiento propio.
- La agenda sigue apoyándose en config embebida en `script-base.js`.
- El sistema de layouts HTML sigue siendo manual.
- Falta una política más estricta para artefactos pesados y limpieza automática del workspace.
