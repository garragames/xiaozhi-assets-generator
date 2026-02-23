# Descripción de la función de almacenamiento persistente de configuración

## Resumen de funciones

Este proyecto agrega una función de almacenamiento persistente de configuración y archivos basada en IndexedDB, que permite a los usuarios mantener su estado de configuración anterior y los archivos cargados después de actualizar la página.

## Características principales

### 1. Guardado automático de la configuración
- **Guardado en tiempo real**: Guarda automáticamente la configuración en IndexedDB cuando el usuario la modifica.
- **Detección inteligente**: Detecta automáticamente si hay una configuración guardada al cargar la página.
- **Recuperación de estado**: Restaura la posición de progreso del usuario y el estado de la pestaña del tema.

### 2. Almacenamiento automático de archivos
- **Archivos de fuentes**: Guarda automáticamente los archivos de fuentes personalizados, incluidos los datos de las fuentes convertidas.
- **Imágenes de emojis**: Guarda automáticamente las imágenes de emojis personalizadas en el almacenamiento.
- **Imágenes de fondo**: Guarda automáticamente las imágenes de fondo de los modos claro/oscuro.

### 3. Función de empezar de nuevo
- **Limpieza con un solo clic**: Proporciona un botón para empezar de nuevo que, tras la confirmación, borra todos los datos almacenados.
- **Confirmación de seguridad**: Incluye un cuadro de diálogo de confirmación detallado para evitar operaciones accidentales.
- **Restablecimiento completo**: Limpia la configuración, los archivos y los datos temporales.

## Implementación técnica

### Componentes principales

#### ConfigStorage.js
- Gestión de la base de datos IndexedDB
- Almacenamiento y recuperación de la configuración
- Almacenamiento binario de archivos
- Gestión de datos temporales

#### StorageHelper.js
- Proporciona una API de almacenamiento conveniente para varios componentes.
- Interfaz unificada para guardar y eliminar archivos.
- Gestiona por categorías los diferentes tipos de archivos de recursos.

#### Integración de AssetsBuilder.js
- Integración profunda con el sistema de almacenamiento.
- Guardado automático de los datos de las fuentes convertidas.
- Recuperación inteligente de archivos de recursos.

### Estructura de almacenamiento

```javascript
// Base de datos: XiaozhiConfigDB
{
  configs: {      // Tabla de configuraciones
    key: 'current_config',
    config: { ... },           // Objeto de configuración completo
    currentStep: 1,           // Paso actual
    activeThemeTab: 'font',   // Pestaña activa
    timestamp: 1234567890     // Hora de guardado
  },
  
  files: {        // Tabla de archivos
    id: 'custom_font',
    type: 'font',             // Tipo de archivo
    name: 'MyFont.ttf',       // Nombre del archivo
    size: 1024,               // Tamaño del archivo
    mimeType: 'font/ttf',     // Tipo MIME
    data: ArrayBuffer,        // Datos binarios del archivo
    metadata: { ... },        // Metadatos
    timestamp: 1234567890     // Hora de guardado
  },
  
  temp_data: {    // Tabla de datos temporales
    key: 'converted_font_xxx',
    type: 'converted_font',   // Tipo de datos
    data: ArrayBuffer,        // Datos convertidos
    metadata: { ... },        // Metadatos
    timestamp: 1234567890     // Hora de guardado
  }
}
```

## Experiencia de usuario

### Primer uso
1. El usuario configura normalmente el chip, el tema, etc.
2. Cada modificación se guarda automáticamente en el almacenamiento local.
3. Los archivos cargados se guardan sincrónicamente.

### Después de actualizar la página
1. Se muestra el mensaje "Se detectó una configuración guardada".
2. Se restaura automáticamente al último estado de configuración.
3. Se restauran los archivos cargados y los datos de conversión.
4. Se proporciona la opción "Empezar de nuevo".

### Empezar de nuevo
1. Haga clic en el botón "Empezar de nuevo".
2. Se muestra un cuadro de diálogo de confirmación detallado.
3. Se enumeran los tipos de datos que se borrarán.
4. Tras la confirmación, se restablece completamente al estado inicial.

## Referencia de la API

### Métodos principales de ConfigStorage

```javascript
// Guardar configuración
await configStorage.saveConfig(config, currentStep, activeThemeTab)

// Cargar configuración
const data = await configStorage.loadConfig()

// Guardar archivo
await configStorage.saveFile(id, file, type, metadata)

// Cargar archivo
const file = await configStorage.loadFile(id)

// Borrar todos los datos
await configStorage.clearAll()
```

### Métodos de conveniencia de StorageHelper

```javascript
// Guardar archivo de fuente
await StorageHelper.saveFontFile(file, config)

// Guardar archivo de emoji
await StorageHelper.saveEmojiFile(emojiName, file, config)

// Guardar archivo de fondo
await StorageHelper.saveBackgroundFile(mode, file, config)

// Eliminar archivo
await StorageHelper.deleteFontFile()
await StorageHelper.deleteEmojiFile(emojiName)
await StorageHelper.deleteBackgroundFile(mode)
```

## Notas

### Compatibilidad con navegadores
- Requiere un navegador moderno compatible con IndexedDB.
- Se recomienda usar Chrome 58+, Firefox 55+, Safari 10.1+.

### Límites de almacenamiento
- El espacio de almacenamiento de IndexedDB está limitado por el navegador.
- Los archivos grandes pueden afectar el rendimiento del almacenamiento.
- Se recomienda limpiar periódicamente los datos innecesarios.

### Consideraciones de privacidad
- Los datos solo se almacenan en el navegador local del usuario.
- No se subirán al servidor.
- Borrar los datos del navegador provocará la pérdida de la configuración almacenada.

## Solución de problemas

### Fallo de almacenamiento
- Compruebe si el navegador es compatible con IndexedDB.
- Confirme que el espacio de almacenamiento del navegador es suficiente.
- Compruebe si el modo de navegación privada está habilitado.

### Pérdida de configuración
- Borrar los datos del navegador provocará la pérdida de la configuración.
- Las actualizaciones del navegador pueden afectar la compatibilidad del almacenamiento.
- Se recomienda hacer una copia de seguridad manual de las configuraciones importantes.

### Problemas de rendimiento
- El almacenamiento de una gran cantidad de archivos puede afectar el rendimiento.
- Utilice periódicamente la función "Empezar de nuevo" para limpiar los datos.
- Evite las operaciones frecuentes de carga de archivos grandes.
