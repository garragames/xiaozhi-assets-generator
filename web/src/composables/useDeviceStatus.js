import { ref, computed, onMounted, onUnmounted } from 'vue'

// Estado del dispositivo compartido globalmente
const deviceStatus = ref({
  isOnline: false,
  error: '',
  lastCheck: null
})

const deviceInfo = ref({
  chip: null,
  board: null,
  firmware: null,
  flash: null,
  assetsPartition: null,
  network: null,
  screen: null
})

const token = ref('')
const isChecking = ref(false)
const retryTimer = ref(null)

// Obtener parámetros de la URL
const getUrlParameter = (name) => {
  const urlParams = new URLSearchParams(window.location.search)
  return urlParams.get(name)
}

// Llamar a la herramienta MCP
const callMcpTool = async (toolName, params = {}) => {
  if (!token.value) {
    throw new Error('Authentication token not found')
  }

  const response = await fetch('/api/messaging/device/tools/call', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token.value}`
    },
    body: JSON.stringify({
      name: toolName,
      arguments: params
    })
  })

  if (response.ok) {
    const result = await response.json()
    return result
  } else {
    const errorText = await response.text()
    console.error(`MCP tool ${toolName} failed:`, response.status, errorText)
    
    // Analizar el mensaje de error
    let errorMessage = `Failed to call ${toolName}`
    try {
      const errorData = JSON.parse(errorText)
      if (errorData.message) {
        errorMessage = errorData.message
      }
    } catch (e) {
      // Si el análisis falla, usar el código de estado HTTP
      errorMessage = `${errorMessage}: HTTP ${response.status}`
    }
    
    throw new Error(errorMessage)
  }
}

// Obtener información detallada del dispositivo
const fetchDeviceInfo = async () => {
  try {
    // Obtener toda la información del dispositivo de forma concurrente
    const [systemInfoResponse, deviceStateResponse, screenInfoResponse] = await Promise.allSettled([
      callMcpTool('self.get_system_info'),
      callMcpTool('self.get_device_status'),
      callMcpTool('self.screen.get_info')
    ])

    // Procesar la información del sistema
    if (systemInfoResponse.status === 'fulfilled' && systemInfoResponse.value) {
      const data = systemInfoResponse.value.data || systemInfoResponse.value

      deviceInfo.value.chip = { model: data.chip_model_name || 'Unknown' }
      deviceInfo.value.board = { model: data.board?.name || 'Unknown' }
      deviceInfo.value.firmware = { version: data.application?.version || 'Unknown' }

      // Obtener el tamaño del flash
      if (data.flash_size) {
        const sizeInMB = Math.round(data.flash_size / 1024 / 1024)
        deviceInfo.value.flash = { size: `${sizeInMB}MB` }
      } else {
        deviceInfo.value.flash = { size: 'Unknown' }
      }

      // Obtener el tamaño de la partición de activos
      if (data.partition_table) {
        const assetsPartition = data.partition_table.find(p => p.label === 'assets')
        if (assetsPartition) {
          deviceInfo.value.assetsPartition = { 
            size: assetsPartition.size,
            sizeFormatted: `${Math.round(assetsPartition.size / 1024 / 1024)}MB`
          }
        } else {
          deviceInfo.value.assetsPartition = null
        }
      } else {
        deviceInfo.value.assetsPartition = null
      }
    } else {
      console.warn('Error al obtener la información del sistema:', systemInfoResponse.reason || systemInfoResponse.value)
      deviceInfo.value.chip = { model: 'Unknown' }
      deviceInfo.value.board = { model: 'Unknown' }
      deviceInfo.value.firmware = { version: 'Unknown' }
      deviceInfo.value.flash = { size: 'Unknown' }
      deviceInfo.value.assetsPartition = null
    }

    // Procesar la información del estado del dispositivo
    if (deviceStateResponse.status === 'fulfilled' && deviceStateResponse.value) {
      const data = deviceStateResponse.value.data || deviceStateResponse.value

      deviceInfo.value.network = {
        type: data.network?.type || 'unknown',
        signal: data.network?.signal || 'Unknown'
      }
    } else {
      console.warn('Error al obtener el estado del dispositivo:', deviceStateResponse.reason || deviceStateResponse.value)
      deviceInfo.value.network = { type: 'unknown', signal: 'Unknown' }
    }

    // Procesar la información de la pantalla
    if (screenInfoResponse.status === 'fulfilled' && screenInfoResponse.value) {
      const data = screenInfoResponse.value.data || screenInfoResponse.value

      deviceInfo.value.screen = {
        resolution: `${data.width || 0}x${data.height || 0}`
      }
    } else {
      console.warn('Error al obtener la información de la pantalla:', screenInfoResponse.reason || screenInfoResponse.value)
      deviceInfo.value.screen = { resolution: 'Unknown' }
    }
  } catch (error) {
    console.error('Se produjo un error al obtener la información del dispositivo:', error)
  }
}

// Comprobar si el dispositivo está en línea
const checkDeviceStatus = async () => {
  if (isChecking.value || !token.value) return

  isChecking.value = true
  try {
    const response = await fetch('/api/messaging/device/tools/list', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token.value}`
      }
    })

    if (response.ok) {
      deviceStatus.value.isOnline = true
      deviceStatus.value.error = ''
      deviceStatus.value.lastCheck = new Date()

      // Obtener información detallada del dispositivo
      await fetchDeviceInfo()
    } else {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`)
    }
  } catch (error) {
    deviceStatus.value.isOnline = false
    deviceStatus.value.error = ''
    deviceStatus.value.lastCheck = new Date()

    // Reintentar después de 30 segundos
    if (retryTimer.value) {
      clearTimeout(retryTimer.value)
    }
    retryTimer.value = setTimeout(checkDeviceStatus, 30000)
  } finally {
    isChecking.value = false
  }
}

// Formatear el texto de visualización de la intensidad de la señal (movido al componente para implementar la internacionalización)
const getSignalDisplayText = (signal, t) => {
  if (!signal) return t('device.signal.unknown')

  switch (signal.toLowerCase()) {
    case 'strong':
      return t('device.signal.strong')
    case 'medium':
      return t('device.signal.medium')
    case 'weak':
      return t('device.signal.weak')
    case 'none':
      return t('device.signal.none')
    default:
      return signal
  }
}

// Inicializar el monitoreo del estado del dispositivo
const initializeDeviceStatus = () => {
  token.value = getUrlParameter('token')
  if (token.value) {
    checkDeviceStatus()
  }
}

// Limpiar recursos
const cleanupDeviceStatus = () => {
  if (retryTimer.value) {
    clearTimeout(retryTimer.value)
    retryTimer.value = null
  }
}

// Actualizar manualmente el estado del dispositivo
const refreshDeviceStatus = async () => {
  await checkDeviceStatus()
}

/**
 * Composable de estado del dispositivo
 * Se utiliza para compartir el estado y la información del dispositivo en toda la aplicación
 */
export function useDeviceStatus() {
  // Propiedades computadas
  const hasToken = computed(() => !!token.value)
  const isDeviceOnline = computed(() => deviceStatus.value.isOnline)

  return {
    // Estado
    deviceStatus,
    deviceInfo,
    isChecking,
    hasToken,
    isDeviceOnline,
    
    // Métodos
    initializeDeviceStatus,
    cleanupDeviceStatus,
    refreshDeviceStatus,
    checkDeviceStatus,
    callMcpTool,
    getSignalDisplayText
  }
}
