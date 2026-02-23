# Aplicación SPA de Assets Personalizados para XiaoZhi AI

## Propósito

Generar y exportar archivos `assets.bin` personalizados para las cajas de diálogo de voz XiaoZhi AI (incluye modelos de palabra de activación, paquetes de emojis, fuentes de texto y fondos de chat).

## Diseño funcional

El usuario crea un `assets.bin` en 3 pasos:
- Paso 1: Seleccionar modelo de chip, tipo de pantalla y resolución.
- Paso 2: Diseñar el tema (configurar cada recurso en pestañas).
- Paso 3: Revisar la lista de contenido y generar.

## Funciones por página

### Selección de chip, pantalla y resolución

Atajos para placas comunes:
- Lichuang Práctico ESP32-S3 → esp32s3, LCD 320×240, RGB565  
- ESP-BOX-3 → esp32s3, LCD 320×240, RGB565  
- Wuming Xingzhi 1.54 TFT → esp32s3, LCD 240×240, RGB565  
- Surfer C3 1.14 TFT → esp32c3, LCD 240×135, RGB565  

También se permiten configuraciones manuales de chip (esp32s3, esp32c3, esp32p4, esp32c6) y resolución. Color: solo RGB565 16‑bit.

### Diseño del tema

#### Pestaña 1: Palabra de activación
- **Preajustes (WakeNet)**:  
  - C3/C6: WakeNet9s.  
  - S3/P4: WakeNet9.  
  Ejemplos: Hi, Espressif (wn9s_hilexin / wn9_hilexin), Hi ESP, Hola Xiaozhi, Hi Jason, etc.  
  Los modelos se empacan desde `public/static/wakenet_model/` en `srmodels.bin`.
- **Personalizada (MultiNet, solo ESP32-S3)**:  
  - Modelos `mn6_cn` / `mn7_cn` (chino, pinyin) y `mn6_en` / `mn7_en` (inglés).  
  - Umbral (0‑100) y duración configurables.  
  - Se genera la configuración y se incluye en `assets.bin`.

#### Pestaña 2: Fuentes
- Preajustes en `share/fonts` (ej.: `font_puhui_14_1`, `font_puhui_16_4`, `font_puhui_20_4`, `font_puhui_30_4`).  
- Personalizadas: subir TTF/WOFF, tamaño 8‑80, bpp 1/2/4, charset DeepSeek R1 o GB2312.  
  Conversión a cbin con `lv_font_conv/lib/convert.js`, nombrado `font_[nombre]_[size]_[bpp].bin`.

#### Pestaña 3: Colección de emojis
- Preajustes (tamaño y cantidad reales, se empaquetan automáticamente):  
  - Twemoji 32×32 PNG / 64×64 PNG  
  - Noto Emoji 64×64 GIF / 128×128 GIF (21 emojis)  
  - Kotty 64×64 GIF (5 emojis), 128×128 GIF (4 emojis), 240×240 GIF (3 emojis)  
- Vista previa adaptativa: >128px muestra 4 muestras; 240px muestra 2.  
- Empaquetado usa la lista declarada de cada preset (extensión correcta GIF/PNG).  
- Personalizados: tamaño uniforme ≤ resolución; GIF animado o PNG transparente; neutral obligatorio, el resto opcional (si falta, se usa neutral).

#### Pestaña 4: Fondo de chat
- Modos claro y oscuro, por defecto #ffffff y #121212.  
- Se pueden usar colores o imágenes (RGB565 con cabecera de 64B). Las imágenes se adaptan a la resolución.

### Generación de assets.bin
- Botón “Generar” muestra la lista de recursos.  
- Al confirmar, se procesan fuentes, modelos, emojis, fondos y se produce `index.json`; luego se empaqueta en SPIFFS como `assets.bin`.  
- Todo corre en el navegador, sin API backend. Resultados se pueden cachear para regeneraciones rápidas.

## Implementación técnica

### Generación en navegador
1. `WakenetModelPacker.js` – empaqueta modelos de palabra de activación.  
2. `SpiffsGenerator.js` – genera el SPIFFS final.  
3. `AssetsBuilder.js` – orquesta el flujo y conversión de recursos (incluye conversión de fuentes en navegador).

### Flujo
1. Cargar configuración.  
2. Procesar fuentes (preajuste o conversión).  
3. Procesar wakeword (preajuste o MultiNet).  
4. Procesar emojis (preajuste o custom, con deduplicación y escalado GIF/PNG).  
5. Procesar fondos (convertir a RGB565).  
6. Generar `index.json`.  
7. Empaquetar todo en SPIFFS → `assets.bin`.

### Estructura del índice (ejemplo)
```json
{
  "version": 1,
  "chip_model": "esp32s3",
  "display_config": { "width": 320, "height": 240, "monochrome": false, "color": "RGB565" },
  "srmodels": "srmodels.bin",
  "text_font": "font_puhui_common_30_4.bin",
  "skin": {
    "light": { "text_color": "#000000", "background_color": "#FFFFFF", "background_image": "background_light.raw" },
    "dark":  { "text_color": "#FFFFFF", "background_color": "#121212", "background_image": "background_dark.raw" }
  },
  "emoji_collection": [
    { "name": "sleepy", "file": "sleepy.png" }
  ],
  "multinet": { "model": "mn6_cn", "command": "ni hao xiao zhi", "threshold": 20, "duration": 3000 }
}
```

