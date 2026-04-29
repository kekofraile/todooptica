# Roadmap de mejora

## Criterio

- **P0**: alto impacto, bajo o medio riesgo, aplicable sin reescribir el stack.
- **P1**: mejora estructural clara con algo más de coordinación.
- **P2**: optimización o endurecimiento posterior.

## P0

### 1. Mantener `dist/` como salida generada

- Estado: parcialmente resuelto documentalmente.
- Acción:
  - no editar `dist/` a mano.
  - reconstruir siempre con `npm run publish`.
  - validar fuente y snapshot por separado.
- Archivos:
  - `scripts/publish.py`
  - `README.md`

### 2. Consolidar reglas del explorador del ojo

- Estado: aplicado en esta pasada.
- Acción:
  - seguir usando `script-eye-explorer-shared.js` como fuente única de metadata y strings.
  - evitar nueva duplicación entre `script-servicios.js` y `script-eye-explorer-3d.js`.
- Archivos:
  - `script-eye-explorer-shared.js`
  - `script-eye-explorer-core.js`
  - `script-servicios.js`
  - `script-eye-explorer-3d.js`

### 3. Blindar el pipeline editorial

- Estado: aplicado en esta pasada.
- Acción:
  - mantener `scripts/validate-editorial-surface.py` dentro de `npm run check` y `npm run publish`.
  - revisar manualmente posts e imágenes antes de publicar.
  - conservar el saneamiento defensivo en `generate-blog-2026-posts.py`.
- Archivos:
  - `scripts/validate-editorial-surface.py`
  - `scripts/generate-blog-2026-posts.py`
  - `package.json`
  - `scripts/publish.py`

### 4. Limpiar la superficie pública y artefactos locales

- Estado: pendiente operativo.
- Acción:
  - eliminar `.DS_Store`, `output/`, `.playwright/`, `scripts/__pycache__/`.
  - revisar y mover el ZIP pesado no usado fuera de `assets/`.
- Archivos/directorios:
  - `assets/models/bodyparts3d/BodyParts3D_3.0_obj_99.zip`
  - `references/`

## P1

### 5. Extraer la config de cita a un módulo dedicado

- Problema:
  - `script-base.js` mezcla shell global con `appointmentProfiles`, horarios y festivos por año.
- Recomendación:
  - crear un módulo tipo `script-appointments-config.js` o `data/appointments.js`.
  - dividir por centro y por año.
  - exponer solo helpers públicos consumidos por `script-cita.js` y el sticky CTA.
- Beneficio:
  - reduce acoplamiento.
  - facilita mantenimiento anual.

### 6. Modularizar CSS por capas

- Estado actual:
  - `styles-servicios.css` ya separa una porción de Servicios.
- Próxima división realista:
  - `styles/base.css`
  - `styles/layout.css`
  - `styles/components.css`
  - `styles/pages/servicios.css`
  - `styles/pages/cita.css`
  - `styles/pages/blog.css`
- Criterio:
  - mover primero páginas con más densidad de reglas específicas.

### 7. Endurecer QA visual del explorador

- Acción:
  - añadir smoke test explícito del modo 3D bajo flag.
  - añadir comprobación del modo 2D por defecto.
  - considerar un screenshot golden solo del área del explorador si el entorno se estabiliza.
- Archivos:
  - `tests/e2e/games.spec.js`

### 8. Documentar layout shared y shells repetidos

- Acción:
  - crear checklist de cambios transversales para header/footer/meta.
  - si se quiere reducir repetición sin framework, valorar generación mínima con Python/Jinja o includes pre-publicación.
- Restricción:
  - no migrar a framework SPA sin necesidad fuerte.

## P2

### 9. Mejorar publicación incremental y limpieza automática

- Acción:
  - script de limpieza explícita para artefactos locales.
  - comprobación automática de archivos pesados en superficie pública.

### 10. Ampliar cobertura E2E del shell global

- Acción:
  - command palette.
  - navegación móvil.
  - sticky CTA por centro.
  - reading progress y TOC en posts largos.

### 11. Evaluar prebuild ligero para HTML repetido

- Solo si la repetición manual empieza a provocar errores frecuentes.
- Recomendación por defecto:
  - mantener vanilla MPA.
  - introducir solo generación estática ligera, no framework cliente.

## Secuencia recomendada

1. Completar limpieza de artefactos y mover assets pesados no usados.
2. Extraer config de agenda/festivos fuera de `script-base.js`.
3. Seguir separando CSS por páginas de alta complejidad.
4. Ampliar Playwright sobre shell global y publicación.

## No recomendado en esta fase

- Migrar a React, Next, Vite o cualquier framework SPA.
- Convertir el explorador del ojo a WebGL por defecto.
- Introducir bundler solo para resolver problemas que hoy no existen.
