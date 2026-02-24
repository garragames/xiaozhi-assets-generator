# Guía rápida: agregar colecciones o emojis nuevos

## 1) Estructura de archivos
- Coloca los assets en `web/public/static/<nombre_preset>/`.
- Nombra cada archivo como `<emotion>.<ext>` (extensión según formato real, ej. `gif` o `png`).
- Usa dimensiones consistentes para el preset (ej.: 64×64, 128×128, 240×240). El escalado se hace en el navegador si se excede el tamaño configurado.

## 2) Declarar el preset (si es nuevo)
Edita `web/src/utils/AssetsBuilder.js`:
- En `presetMeta`, añade una entrada:
  ```js
  <id>: { size: <px>, ext: 'gif' | 'png', emojis: ['neutral', ...] }
  ```
- Si cambia la extensión, asegúrate de que `loadPresetEmoji` tenga el `presetName` con su `ext`.

Actualiza las vistas/UI:
- `web/src/components/tabs/EmojiConfig.vue`: agrega el preset al array `presetEmojis` con `id`, `size`, `description`, `preview` (lista corta para la tarjeta) y asegúrate de que `getPresetEmojiUrl` reconozca el nuevo `id`.
- `web/src/components/GenerateModal.vue`: añade el `id` al mapa `presetEmotionMap`, tamaños/estimaciones y texto del nombre (usa `t('emojiConfig...')` cuando exista).
- `web/src/components/GenerateSummary.vue`: agrega el `id` al `presetEmotionMap`, estilos de tamaño e imagen.
- Traducciones: añade `emojiConfig.<tuPreset>Name/Description` y, si introduces emociones nuevas, define sus etiquetas en `emojiConfig.emotions.*` y `generateSummary.emotions.*` en todos los `locales/*.json`.

## 3) Agregar un nuevo emoji a un preset existente
- Copia el archivo al directorio del preset en `public/static`.
- Incluye la clave de emoción en la lista `emojis` del preset dentro de `presetMeta` (AssetsBuilder) y en `presetEmotionMap` (GenerateModal/GenerateSummary) si debe aparecer en UI.
- Si la emoción es nueva (p.ej., `eyes`), añade la clave a `emotionList` en `EmojiConfig.vue` y `GenerateSummary.vue`, y tradúcela en los archivos de locales.
- Actualiza la lista `preview` del preset en `EmojiConfig.vue` para que la tarjeta de selección muestre la nueva emoción (se recortará automáticamente según el tamaño).

## 4) Convenciones de previsualización
- En la tarjeta de selección:  
  - `size > 128` → muestra 4 previews.  
  - `size >= 240` → muestra 2 previews.  
  - `size <= 64` → grilla de 7 columnas.
- El empaquetado siempre usa la lista `emojis` declarada en `presetMeta`, no el recorte de preview.

## 5) Verificación
- Ejecuta `npm run build` desde `web/` para asegurarte de que las rutas/ids estén correctas.
- Revisa en el navegador que la ruta `./static/<preset>/<emotion>.<ext>` cargue.

## 6) Resumen mínimo de archivos a tocar (nuevo preset)
- Assets: `web/public/static/<preset>/`
- Lógica: `src/utils/AssetsBuilder.js`
- UI: `src/components/tabs/EmojiConfig.vue`
- Modal: `src/components/GenerateModal.vue`
- Preview: `src/components/GenerateSummary.vue`
- i18n: `src/locales/*.json`

Con estos pasos podrás añadir nuevas colecciones o ampliar las existentes sin romper la generación de `assets.bin`.
