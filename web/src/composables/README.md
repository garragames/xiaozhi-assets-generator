# Instrucciones de uso de Composables

## useDeviceStatus

Un Composable para compartir el estado y la información del dispositivo en toda la aplicación.

### Características

- 🔄 **Compartido globalmente**: Todos los componentes pueden acceder al mismo estado del dispositivo.
- 📡 **Detección automática**: Detecta automáticamente el estado en línea del dispositivo y reintenta periódicamente.
- 📊 **Información detallada**: Proporciona información sobre el chip, la placa, el firmware, las particiones, la red, la pantalla, etc.
- 🛠️ **Herramienta MCP**: Proporciona un método conveniente para llamar a la herramienta MCP.

### Uso básico

```javascript
import { useDeviceStatus } from '@/composables/useDeviceStatus'

export default {
  setup() {
    const {
      deviceStatus,      // Estado en línea del dispositivo
      deviceInfo,        // Información detallada del dispositivo
      isDeviceOnline,    // Si está en línea (propiedad computada)
      hasToken,          // Si hay un token (propiedad computada)
      refreshDeviceStatus,  // Actualizar estado manualmente
      callMcpTool        // Llamar a la herramienta MCP
    } = useDeviceStatus()
    
    return {
      deviceStatus,
      deviceInfo,
      isDeviceOnline,
      hasToken
    }
  }
}
```

### Ejemplo de uso en HomePage.vue

```vue
<template>
  <div>
    <!-- Mostrar información del dispositivo -->
    <div v-if="isDeviceOnline">
      <h2>Dispositivo conectado</h2>
      <p>Modelo de chip: {{ deviceInfo.chip?.model }}</p>
      <p>Placa: {{ deviceInfo.board?.model }}</p>
      <p>Tamaño del flash: {{ deviceInfo.flash?.size }}</p>
      <p>Partición de activos: {{ deviceInfo.assetsPartition?.sizeFormatted }}</p>
      <p>Resolución de pantalla: {{ deviceInfo.screen?.resolution }}</p>
    </div>
    
    <div v-else>
      <p>Dispositivo sin conexión</p>
    </div>
    
    <!-- Botón de actualización manual -->
    <button @click="refreshDeviceStatus">Actualizar estado del dispositivo</button>
  </div>
</template>

<script setup>
import { useDeviceStatus } from '@/composables/useDeviceStatus'

const {
  deviceStatus,
  deviceInfo,
  isDeviceOnline,
  refreshDeviceStatus
} = useDeviceStatus()
</script>
```

### Uso en cualquier componente

```vue
<script setup>
import { useDeviceStatus } from '@/composables/useDeviceStatus'

const { deviceInfo, isDeviceOnline } = useDeviceStatus()

// Ajustar la interfaz de usuario según la información del dispositivo
const displaySize = computed(() => {
  if (!deviceInfo.value.screen) return { width: 320, height: 240 }
  const [width, height] = deviceInfo.value.screen.resolution.split('x')
  return { width: parseInt(width), height: parseInt(height) }
})
</script>
```

### Llamar a la herramienta MCP

```javascript
import { useDeviceStatus } from '@/composables/useDeviceStatus'

const { callMcpTool } = useDeviceStatus()

// Llamar a una herramienta sin parámetros
const systemInfo = await callMcpTool('self.get_system_info')

// Llamar a una herramienta con parámetros
const result = await callMcpTool('self.assets.set_download_url', {
  url: 'https://example.com/download'
})
```

### Estados y métodos disponibles

#### Estados (Refs)

- `deviceStatus`: Objeto de estado del dispositivo
  - `isOnline`: Si está en línea
  - `error`: Mensaje de error
  - `lastCheck`: Última comprobación

- `deviceInfo`: Objeto de información del dispositivo
  - `chip`: { model: string }
  - `board`: { model: string }
  - `firmware`: { version: string }
  - `flash`: { size: string }  // Tamaño total del flash
  - `assetsPartition`: { size: number, sizeFormatted: string }  // Tamaño de la partición de activos (número de bytes y texto formateado)
  - `network`: { type: string, signal: string }
  - `screen`: { resolution: string }

- `isChecking`: Si se está comprobando el estado del dispositivo

#### Propiedades computadas (Computed)

- `hasToken`: Si existe un token de autenticación
- `isDeviceOnline`: Si el dispositivo está en línea

#### Métodos (Methods)

- `initializeDeviceStatus()`: Inicializa el monitoreo del estado del dispositivo
- `cleanupDeviceStatus()`: Limpia los recursos
- `refreshDeviceStatus()`: Actualiza manualmente el estado del dispositivo
- `checkDeviceStatus()`: Comprueba el estado del dispositivo
- `callMcpTool(toolName, params)`: Llama a la herramienta MCP
- `getSignalDisplayText(signal)`: Formatea el texto de visualización de la intensidad de la señal

### Notas

1. El estado del dispositivo se detecta automáticamente y se reintenta cada 30 segundos cuando está sin conexión.
2. Todos los componentes comparten el mismo estado del dispositivo, las modificaciones afectarán a todos los componentes que usan ese estado.
3. En un componente, solo necesita llamar a `useDeviceStatus()` para acceder al estado global, no es necesario inicializarlo manualmente.
4. El componente `DeviceStatus.vue` se encargará automáticamente de la inicialización y la limpieza.

