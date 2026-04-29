# Rediseño del explorador anatómico del ojo

## Objetivo

Reorientar `servicios.html#ojo-explorador` desde una ilustración demasiado infográfica hacia una **lámina anatómica lateral más clínica**, manteniendo intacta la UI funcional existente:

- canvas principal
- hotspots
- ficha lateral
- mapa anatómico
- quiz
- CTA
- botón `Ver cómo entra la luz`
- rotación
- `data-*` ya consumidos por JS y tests

## Restricciones cerradas

- No romper `servicios.html#ojo-explorador`.
- No renombrar ni eliminar selectores `data-eye-*`.
- No convertir la experiencia principal en una esfera frontal genérica.
- Mantener accesibilidad básica y activación por botón/hotspot.
- El 3D real no puede imponerse si se aleja del objetivo anatómico.

## Opciones evaluadas

### Opción A - mejora realista del SVG/Canvas 2D

**Pros**

- más rápida de producir
- menor riesgo técnico
- completamente alineada con el modo por defecto ya existente
- mejor estabilidad para Playwright

**Contras**

- profundidad limitada
- sensación de volumen más contenida

### Opción B - 2.5D / parallax sutil

**Pros**

- conserva el corte lateral
- permite añadir profundidad, luz y desplazamiento sin romper anatomía
- reutiliza el runtime actual del explorador
- mantiene excelente fallback y coste moderado

**Contras**

- exige afinar mejor anclajes y capas visuales
- puede quedar decorativo si el arte base no acompaña

### Opción C - full 3D WebGL como experiencia principal

**Pros**

- máxima libertad espacial
- posibilidad de materiales complejos

**Contras**

- mayor riesgo de alejarse del objetivo visual clínico
- más carga técnica y de mantenimiento
- más puntos de fallo en móviles o entornos limitados
- peor estabilidad para una experiencia que hoy necesita legibilidad anatómica, no exhibición técnica

## Recomendación final

**Opción B** como dirección principal.

- Base anatómica en SVG clínico lateral.
- Render 2D/2.5D en canvas por defecto.
- Parallax, halo, haz de luz y microdesplazamiento para sugerir volumen.
- `script-eye-explorer-3d.js` queda como experiencia opt-in bajo flag.

## Implementación de esta pasada

- `assets/eye-anatomy-explorer.svg`
  - nueva lámina con:
    - córnea más transparente
    - cámara anterior más legible
    - iris menos flat
    - cristalino más orgánico
    - capas posteriores mejor separadas
    - disco óptico y nervio mejor definidos
    - vasos retinianos suaves
- `script-eye-explorer-shared.js`
  - fuente única de:
    - partes anatómicas
    - textos
    - colorimetría de interacción
    - anclajes/hotspots
    - controlador DOM compartido
- `script-servicios.js`
  - fallback 2D reescrito como presentación principal clínica/2.5D
- `script-eye-explorer-3d.js`
  - mantiene integración con el controlador compartido
- `styles-servicios.css`
  - hoja de estilos específica del bloque

## Criterios de aceptación visual

- La lectura dominante debe seguir siendo **lateral/sagital**.
- La córnea debe percibirse como estructura transparente anterior.
- El iris y la pupila no deben verse como un bloque plano de color.
- El cristalino debe sentirse como lente interna separada.
- Retina, coroides y esclerótica deben leerse como capas distintas.
- El nervio óptico debe resolverse como salida posterior, no como adorno lateral.
- La UI derecha debe seguir funcionando sin rediseño estructural.

## Criterios de aceptación funcional

- El modo por defecto sigue siendo 2D si no hay flag.
- Los hotspots siguen activando la ficha correcta.
- El quiz sigue actualizando prompt y score.
- El botón `Ver cómo entra la luz` sigue disparando la animación.
- La rotación sigue existiendo por botones y drag.
- Los tests siguen pudiendo localizar el explorador por los mismos selectores.

## Pendientes recomendados

- Refinar aún más el arte anatómico si se dispone de una referencia clínica licenciada.
- Añadir smoke E2E específico del modo 3D bajo flag.
- Valorar una versión de screenshot golden del explorador si se estabiliza el entorno visual.
