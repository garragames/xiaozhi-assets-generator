# Convertidor de fuentes - Convertidor de fuentes del lado del navegador

Este es un convertidor de fuentes del lado del navegador basado en la lógica principal de lv_font_conv, que admite la conversión de archivos de fuentes TTF/WOFF al formato CBIN compatible con LVGL.

## 📁 Estructura del módulo

```
font_conv/
├── AppError.js              # Clase de manejo de errores
├── Ranger.js                # Gestor de rango de caracteres
├── Utils.js                 # Colección de funciones de utilidad
├── FreeType.js              # Interfaz de FreeType (versión ES6)
├── CollectFontData.js       # Módulo principal de recopilación de datos de fuentes
├── BrowserFontConverter.js  # Interfaz principal del convertidor
├── TestConverter.js         # Módulo de prueba
├── freetype_build/          # Módulo WebAssembly de FreeType
└── writers/
    ├── CBinWriter.js        # Escritor de formato CBIN
    └── CBinFont.js          # Clase de fuente CBIN
```

## 🚀 Uso

### Uso básico

```javascript
import browserFontConverter from './font_conv/BrowserFontConverter.js'

// Inicializar el convertidor
await browserFontConverter.initialize()

// Convertir fuente
const result = await browserFontConverter.convertToCBIN({
  fontFile: fontFile,          // Objeto de archivo
  fontName: 'my_font',
  fontSize: 20,
  bpp: 4,
  charset: 'deepseek',
  progressCallback: (progress, message) => {
    console.log(`${progress}% - ${message}`)
  }
})

// el resultado es un ArrayBuffer, que contiene los datos de la fuente en formato CBIN
```

### Obtener información de la fuente

```javascript
const fontInfo = await browserFontConverter.getFontInfo(fontFile)
console.log('Información de la fuente:', fontInfo)
/*
{
  familyName: "Arial",
  fullName: "Arial Regular", 
  postScriptName: "ArialMT",
  version: "1.0",
  unitsPerEm: 2048,
  ascender: 1854,
  descender: -434,
  numGlyphs: 3200,
  supported: true
}
*/
```

### Estimación de tamaño

```javascript
const estimate = browserFontConverter.estimateSize({
  fontSize: 20,
  bpp: 4,
  charset: 'deepseek'
})

console.log('Resultado de la estimación:', estimate)
/*
{
  characterCount: 7405,
  avgBytesPerChar: 65,
  estimatedSize: 481325,
  formattedSize: "470 KB"
}
*/
```

## ⚙️ Opciones de configuración

### Parámetros de conversión

| Parámetro | Tipo | Valor predeterminado | Descripción |
|---|---|---|---|
| `fontFile` | File/ArrayBuffer | - | Archivo de fuente |
| `fontName` | string | 'font' | Nombre de la fuente de salida |
| `fontSize` | number | 20 | Tamaño de la fuente (8-80) |
| `bpp` | number | 4 | Profundidad de bits (1,2,4,8) |
| `charset` | string | 'basic' | Juego de caracteres preestablecido |
| `symbols` | string | '' | Caracteres personalizados |
| `range` | string | '' | Rango Unicode |
| `compression` | boolean | true | Habilitar compresión |
| `lcd` | boolean | false | Representación de subpíxeles horizontales |
| `lcd_v` | boolean | false | Representación de subpíxeles verticales |

### Juegos de caracteres compatibles

- `basic`: Juego de caracteres ASCII básico (95 caracteres)
- `deepseek`: Caracteres chinos de uso común de DeepSeek R1 (7405 caracteres)
- `gb2312`: Juego de caracteres chinos GB2312 (7445 caracteres)

### Formatos de fuente compatibles

- TTF (TrueType Font)
- WOFF (Web Open Font Format)
- WOFF2 (Web Open Font Format 2.0)
- OTF (OpenType Font)

## 🔧 Implementación técnica

### Dependencias principales

1. **opentype.js**: Se utiliza para analizar la estructura del archivo de fuente.
2. **WebAssembly FreeType**: Se utiliza para la representación de fuentes y la generación de glifos.
3. **Escritor CBIN personalizado**: Genera un formato compatible con LVGL.

### Flujo de conversión

1. **Análisis de fuentes**: Usa opentype.js para analizar el archivo de fuente.
2. **Representación de glifos**: Renderiza los glifos a través de FreeType WebAssembly.
3. **Recopilación de datos**: Recopila datos de glifos, información de métricas y ajustes de kerning.
4. **Conversión de formato**: Convierte los datos al formato CBIN.
5. **Generación de salida**: Genera el archivo binario final.

### Diferencias con la versión original

| Característica | lv_font_conv original | Versión del navegador |
|---|---|---|
| Entorno de ejecución | Node.js | Navegador |
| Sistema de módulos | CommonJS | Módulos ES6 |
| Sistema de archivos | Módulo fs | API de archivos |
| Búfer | Búfer | ArrayBuffer/Uint8Array |
| Línea de comandos | Interfaz CLI | API de JavaScript |

## 🧪 Pruebas

```javascript
import { testFontConverter, testWithSampleFont } from './font_conv/TestConverter.js'

// Prueba de funcionalidad básica
await testFontConverter()

// Prueba de archivo de fuente
const result = await testWithSampleFont(fontFile)
console.log('Resultado de la prueba:', result)
```

## ⚠️ Notas

1. **Soporte de WebAssembly**: Requiere un navegador compatible con WebAssembly.
2. **Límite de memoria**: Los archivos de fuentes grandes pueden consumir más memoria.
3. **Tiempo de procesamiento**: La conversión de fuentes complejas y juegos de caracteres grandes requiere más tiempo.
4. **Tamaño del archivo**: El archivo ft_render.wasm es grande (~2 MB).
5. **Compatibilidad**: Requiere un navegador moderno.

## 📊 Métricas de rendimiento

| Tamaño del juego de caracteres | Tamaño de la fuente | BPP | Tiempo de conversión estimado | Tamaño de salida |
|---|---|---|---|---|
| 100 caracteres | 16px | 4 | < 1 segundo | ~10KB |
| 1000 caracteres | 20px | 4 | 2-5 segundos | ~100KB |
| 7000 caracteres | 20px | 4 | 10-30 segundos | ~500KB |

## 🐛 Problemas conocidos

1. **Validación de fuentes**: Algunos archivos de fuentes dañados pueden provocar un bloqueo.
2. **Gestión de memoria**: El uso prolongado puede provocar pérdidas de memoria.
3. **Manejo de errores**: Los errores de WebAssembly son difíciles de depurar.
4. **Juego de caracteres**: Es posible que algunos caracteres especiales no se representen correctamente.

## 🔮 Mejoras futuras

- [ ] Admitir más formatos de fuente
- [ ] Optimizar el uso de la memoria
- [ ] Agregar función de vista previa de fuentes
- [ ] Admitir la creación de subconjuntos de fuentes
- [ ] Agregar más opciones de compresión
- [ ] Admitir fuentes de colores

---

*Adaptado del proyecto lv_font_conv para el entorno del navegador*
