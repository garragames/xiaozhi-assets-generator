<template>
  <div>
    <!-- Mensaje de estado de configuración (notificación flotante en la esquina inferior derecha) -->
    <div
      v-if="hasStoredConfig"
      class="fixed bottom-4 right-4 z-50 bg-blue-50 border border-blue-200 rounded-lg p-4 shadow-lg transition-opacity duration-300 min-w-[300px]"
      @mouseenter="resetAutoHideTimer"
    >
      <div class="flex items-center justify-between mb-2">
        <div class="flex items-center">
          <svg class="w-5 h-5 text-blue-500 mr-2" fill="currentColor" viewBox="0 0 20 20">
            <path fill-rule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clip-rule="evenodd"></path>
          </svg>
          <span class="text-blue-800 font-medium">{{ $t('configNotice.title') }}</span>
        </div>
        <button 
          @click="closeConfigNotice"
          class="text-gray-500 hover:text-gray-700"
        >
          <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path>
          </svg>
        </button>
      </div>
      <p class="text-blue-600 text-sm mb-3">
        {{ $t('configNotice.message') }}
      </p>
      <div class="flex justify-end space-x-2">
        <button 
          @click="confirmReset"
          class="px-3 py-1 text-sm text-red-600 hover:text-red-800 font-medium"
        >
          {{ $t('configNotice.restart') }}
        </button>
      </div>
    </div>

    <!-- Step Indicator -->
    <div class="flex items-center justify-center mb-8">
      <div v-for="(step, index) in steps" :key="index" class="flex items-center">
        <div class="flex flex-col items-center">
          <div :class="getStepClass(index)">
            {{ index + 1 }}
          </div>
          <span class="text-sm mt-2 text-gray-600">{{ $t(step.titleKey) }}</span>
        </div>
        <div v-if="index < steps.length - 1" class="w-16 h-0.5 bg-gray-300 mx-4"></div>
      </div>
    </div>

    <!-- Step Content -->
    <div class="bg-white rounded-lg shadow-sm border p-6">
      <ChipConfig 
        v-if="currentStep === 0"
        v-model="config.chip"
        @next="nextStep"
      />
      
      <ThemeDesign 
        v-if="currentStep === 1"
        v-model="config.theme"
        :chipModel="config.chip.model"
        :activeTab="activeThemeTab"
        @next="nextStep"
        @prev="prevStep"
        @tabChange="handleThemeTabChange"
      />
      
      <GenerateSummary 
        v-if="currentStep === 2"
        :config="config"
        @generate="handleGenerate"
        @prev="prevStep"
      />
    </div>

    <!-- Generate Modal -->
    <GenerateModal
      v-if="showGenerateModal"
      :config="config"
      @close="showGenerateModal = false"
      @generate="handleModalGenerate"
      @startFlash="handleStartFlash"
      @cancelFlash="handleCancelFlash"
    />

    <!-- Reset Confirmation Modal -->
    <!-- Eliminar el cuadro de diálogo de confirmación de reinicio -->
  </div>
</template>

<script setup>
import { ref, computed, watch, onMounted, onUnmounted } from 'vue'
import { useI18n } from 'vue-i18n'
import ChipConfig from '@/components/ChipConfig.vue'
import ThemeDesign from '@/components/ThemeDesign.vue'
import GenerateSummary from '@/components/GenerateSummary.vue'
import GenerateModal from '@/components/GenerateModal.vue'
import configStorage from '@/utils/ConfigStorage.js'
import AssetsBuilder from '@/utils/AssetsBuilder.js'
import WebSocketTransfer from '@/utils/WebSocketTransfer.js'
import { useDeviceStatus } from '@/composables/useDeviceStatus.js'

// Usar el estado del dispositivo compartido
const {
  callMcpTool: callDeviceMcpTool
} = useDeviceStatus()

// Usar internacionalización
const { t } = useI18n()

const currentStep = ref(0)
const showGenerateModal = ref(false)
const activeThemeTab = ref('wakeword') // Mantener el estado de la pestaña de diseño del tema

// Estado relacionado con el almacenamiento
const hasStoredConfig = ref(false) // Si se ha restaurado la configuración desde el almacenamiento
const isAutoSaveEnabled = ref(false) // Si el guardado automático está habilitado
const isResetting = ref(false)
const isLoading = ref(true)
const assetsBuilder = new AssetsBuilder()
const autoHideTimer = ref(null) // Nuevo: temporizador para ocultar automáticamente
const webSocketTransfer = ref(null) // Instancia de transferencia WebSocket

// Nota: como está fuera de la función de configuración, necesitamos definir una función aquí para obtener la traducción
// o podemos mover esto dentro de la función de configuración
const steps = [
  { titleKey: 'steps.chip', key: 'chip' },
  { titleKey: 'steps.theme', key: 'theme' },
  { titleKey: 'steps.generate', key: 'generate' }
]

const config = ref({
  chip: {
    model: '',
    display: {
      width: 320,
      height: 240,
      color: 'RGB565'
    }
  },
  theme: {
    wakeword: {
      type: 'none',
      preset: '',
      custom: {
        name: '',
        command: '',
        threshold: 20,
        duration: 3000,
        model: 'mn6_cn'
      }
    },
    font: {
      type: 'none',
      preset: '',
      hide_subtitle: false,
      custom: {
        file: null,
        size: 20,
        bpp: 4,
        charset: 'deepseek'
      }
    },
    emoji: {
      type: 'none',
      preset: '',
      custom: {
        size: { width: 160, height: 120 },
        images: {}
      }
    },
    state: {
      type: 'none',
      custom: {
        size: { width: 160, height: 120 },
        images: {},
        fileMap: {},
        stateMap: {},
        order: ['standby', 'listening', 'thinking', 'speaking']
      }
    },
    skin: {
      light: {
        backgroundType: 'color',
        backgroundColor: '#ffffff',
        textColor: '#000000',
        backgroundImage: null
      },
      dark: {
        backgroundType: 'color', 
        backgroundColor: '#121212',
        textColor: '#ffffff',
        backgroundImage: null
      }
    }
  }
})

const canGenerate = computed(() => {
  return config.value.chip.model && 
         (config.value.theme.font.type === 'none' || config.value.theme.font.preset || config.value.theme.font.custom.file)
})

const getStepClass = (index) => {
  if (index < currentStep.value) return 'step-indicator completed'
  if (index === currentStep.value) return 'step-indicator active'
  return 'step-indicator inactive'
}

const nextStep = async () => {
  if (currentStep.value < steps.length - 1) {
    currentStep.value++
    
    // Habilitar el guardado automático (si aún no está habilitado)
    if (!isAutoSaveEnabled.value) {
      isAutoSaveEnabled.value = true
      await saveConfigToStorage()
    }
  }
}

const prevStep = () => {
  if (currentStep.value > 0) {
    currentStep.value--
  }
}

const handleGenerate = () => {
  showGenerateModal.value = true
}

const handleModalGenerate = async (selectedItems) => {
  // TODO: Implementar la lógica de generación real
}

// Obtener el token de los parámetros de la URL
const getToken = () => {
  const urlParams = new URLSearchParams(window.location.search)
  return urlParams.get('token')
}

// Llamar a la herramienta MCP (usando el método compartido)
const callMcpTool = async (toolName, params = {}) => {
  return await callDeviceMcpTool(toolName, params)
}

// Manejar el inicio del flasheo en línea
const handleStartFlash = async (flashData) => {
  const { blob, onProgress, onComplete, onError } = flashData

  try {
    const token = getToken()
    if (!token) {
      throw new Error(t('flashProgress.authTokenMissing'))
    }

    // Paso 1: Comprobar el estado del dispositivo
    onProgress(5, t('flashProgress.checkingDeviceStatus'))
    try {
      const deviceStatus = await callMcpTool('self.get_device_status')
      if (!deviceStatus) {
        throw new Error(t('flashProgress.deviceOfflineOrUnresponsive', { error: t('flashProgress.unableToGetDeviceStatus') }))
      }
    } catch (error) {
      console.error('Error al comprobar el estado del dispositivo:', error)
      onError(t('flashProgress.deviceOfflineOrUnresponsive', { error: error.message }))
      return
    }

    // Paso 2: Inicializar la transferencia WebSocket y obtener la URL de descarga
    onProgress(15, t('flashProgress.initializingTransferService'))
    webSocketTransfer.value = new WebSocketTransfer(token)

    // Crear una Promesa para esperar a que la URL de descarga esté lista
    let downloadUrlReady = null
    const downloadUrlPromise = new Promise((resolve, reject) => {
      downloadUrlReady = resolve
    })

    // Crear una Promesa para esperar el evento transfer_started
    let transferStartedResolver = null
    const transferStartedPromise = new Promise((resolve, reject) => {
      transferStartedResolver = resolve
    })

    // Inicializar la sesión WebSocket (solo establece la conexión y obtiene la URL)
    webSocketTransfer.value.onTransferStarted = () => {
      // Cuando se recibe el evento transfer_started, resuelve la Promesa pendiente
      if (transferStartedResolver) {
        transferStartedResolver()
        transferStartedResolver = null
      }
    }

    await webSocketTransfer.value.initializeSession(
      blob,
      (progress, step) => {
        // Progreso de inicialización: 15-30
        onProgress(15 + progress * 0.75, step)
      },
      (error) => {
        console.error('Error de inicialización de WebSocket:', error)
        onError(t('flashProgress.initializeTransferFailed', { error: error.message }))
      },
      (downloadUrl) => {
        downloadUrlReady(downloadUrl)
      }
    )

    // Esperar a que la URL de descarga esté lista
    const downloadUrl = await downloadUrlPromise

    // Paso 3: Establecer la URL de descarga del dispositivo
    onProgress(30, t('flashProgress.settingDeviceDownloadUrl'))
    try {
      await callMcpTool('self.assets.set_download_url', {
        url: downloadUrl
      })
    } catch (error) {
      console.error('Error al establecer la URL de descarga:', error)
      onError(t('flashProgress.setDownloadUrlFailed', { error: error.message }))
      return
    }

    // Paso 4: Reiniciar el dispositivo
    onProgress(40, t('flashProgress.rebootingDevice'))
    // El comando de reinicio no devuelve ningún valor, no es necesario esperar, llamar directamente
    callMcpTool('self.reboot').catch(error => {
      console.warn('Advertencia de llamada al comando de reinicio (el dispositivo puede haberse reiniciado):', error)
      // Incluso si el reinicio falla, continuar con el proceso, ya que el dispositivo puede haberse reiniciado
    })

    // Paso 5: Esperar a que el dispositivo se reinicie y establezca una conexión HTTP (a través del evento transfer_started)
    onProgress(50, t('flashProgress.waitingForDeviceReboot'))

    // Esperar el evento transfer_started, establecer un tiempo de espera de 60 segundos
    const timeoutPromise = new Promise((_, reject) => {
      setTimeout(() => reject(new Error(t('flashProgress.deviceRebootTimeout'))), 60000)
    })

    await Promise.race([transferStartedPromise, timeoutPromise])

    // Paso 6: Iniciar la transferencia de archivos real
    onProgress(60, t('flashProgress.startingFileTransfer'))

    // El dispositivo está listo, iniciar la transferencia directamente (ya se recibió transfer_started, sendFileData se ejecutará de inmediato)
    await webSocketTransfer.value.startTransfer(
      (progress, step) => {
        // Progreso de la transferencia de archivos: 60-100
        const adjustedProgress = 60 + (progress * 0.4)
        onProgress(Math.round(adjustedProgress), step)
      },
      (error) => {
        onError(t('flashProgress.onlineFlashFailed', { error: error.message }))
      },
      () => {
        onComplete()
      }
    )

    // Limpiar la referencia de devolución de llamada
    webSocketTransfer.value.onTransferStarted = null

  } catch (error) {
    console.error('Error en el flasheo en línea:', error)
    onError(t('flashProgress.onlineFlashFailed', { error: error.message }))
  }
}

// Manejar la cancelación del flasheo
const handleCancelFlash = () => {
  if (webSocketTransfer.value) {
    webSocketTransfer.value.cancel()
    webSocketTransfer.value.destroy()
    webSocketTransfer.value = null
  }
}

const handleThemeTabChange = (tabId) => {
  activeThemeTab.value = tabId
}

// Cargar la configuración desde el almacenamiento
const loadConfigFromStorage = async () => {
  try {
    isLoading.value = true
    const storedData = await configStorage.loadConfig()
    
    if (storedData) {
      // Restaurar la configuración (pero no restaurar el paso y la pestaña, siempre comenzar desde el primer paso)
      config.value = storedData.config
      // Asegurar estructura de paquete de estados
      if (!config.value.theme.state) {
        config.value.theme.state = {
          type: 'none',
          custom: {
            size: { width: 160, height: 120 },
            images: {},
            fileMap: {},
            stateMap: {},
            order: ['standby', 'listening', 'thinking', 'speaking']
          }
        }
      } else {
        // Garantizar subcampos
        const st = config.value.theme.state
        if (!st.custom) st.custom = {}
        st.custom.size = st.custom.size || { width: 160, height: 120 }
        st.custom.images = st.custom.images || {}
        st.custom.fileMap = st.custom.fileMap || {}
        st.custom.stateMap = st.custom.stateMap || {}
        st.custom.order = st.custom.order || ['standby', 'listening', 'thinking', 'speaking']
      }
      // Siempre comenzar desde el primer paso
      currentStep.value = 0
      activeThemeTab.value = 'wakeword'
      hasStoredConfig.value = true // Mostrar el mensaje "Se detectó una configuración guardada"
      isAutoSaveEnabled.value = true // Habilitar el guardado automático
      
      // Comprobar y limpiar la estructura de datos de emojis antiguos (incompatible con la versión anterior)
      await cleanupLegacyEmojiData()
      
      // Limpiar el temporizador anterior
      if (autoHideTimer.value) {
        clearTimeout(autoHideTimer.value)
      }
      
      // Establecer un temporizador de 5 segundos para ocultar automáticamente el mensaje
      autoHideTimer.value = setTimeout(() => {
        hasStoredConfig.value = false
      }, 5000)
      
      // Establecer la configuración de AssetsBuilder (modo no estricto, permite restaurar archivos antes de validar)
      assetsBuilder.setConfig(config.value, { strict: false })
      await assetsBuilder.restoreAllResourcesFromStorage(config.value)
      
      // Activar una copia superficial para actualizar la referencia, evitar que createObjectURL se ejecute en valores de marcador de posición durante el renderizado
      try {
        const emojiCustom = config.value?.theme?.emoji?.custom || {}
        const images = emojiCustom.images || {}
        const fileMap = emojiCustom.fileMap || {}
        const emotionMap = emojiCustom.emotionMap || {}
        
        config.value = {
          ...config.value,
          theme: {
            ...config.value.theme,
            emoji: {
              ...config.value.theme.emoji,
              custom: {
                ...emojiCustom,
                images: { ...images },
                fileMap: { ...fileMap },
                emotionMap: { ...emotionMap }
              }
            }
          }
        }
      } catch (e) {
        console.error('Error al actualizar la referencia de configuración de emoji:', e)
      }

      // Actualizar referencias de estado para evitar proxies
      try {
        const stateCustom = config.value?.theme?.state?.custom || {}
        const images = stateCustom.images || {}
        const fileMap = stateCustom.fileMap || {}
        const stateMap = stateCustom.stateMap || {}
        const order = stateCustom.order || []

        config.value = {
          ...config.value,
          theme: {
            ...config.value.theme,
            state: {
              ...config.value.theme.state,
              custom: {
                ...stateCustom,
                images: { ...images },
                fileMap: { ...fileMap },
                stateMap: { ...stateMap },
                order: [...order]
              }
            }
          }
        }
      } catch (e) {
        console.error('Error al actualizar la referencia de configuración de estados:', e)
      }
      
    } else {
      hasStoredConfig.value = false
      isAutoSaveEnabled.value = false
    }
  } catch (error) {
    console.error('Error al cargar la configuración:', error)
    hasStoredConfig.value = false
    isAutoSaveEnabled.value = false
  } finally {
    isLoading.value = false
  }
}

// Limpiar los datos de emojis de la versión anterior (forzar el uso de la nueva estructura de hash)
const cleanupLegacyEmojiData = async () => {
  try {
    const emojiCustom = config.value?.theme?.emoji?.custom
    if (!emojiCustom) return
    
    // Comprobar si se está utilizando la estructura antigua (hay imágenes pero no fileMap ni emotionMap)
    const hasImages = Object.keys(emojiCustom.images || {}).length > 0
    const hasFileMap = emojiCustom.fileMap && Object.keys(emojiCustom.fileMap).length > 0
    const hasEmotionMap = emojiCustom.emotionMap && Object.keys(emojiCustom.emotionMap).length > 0
    const hasOldStructure = hasImages && (!hasFileMap || !hasEmotionMap)
    
    if (hasOldStructure) {
      console.warn('⚠️ Se detectó una estructura de datos de emojis de una versión anterior (incompatible)')
      console.log('Limpiando datos antiguos...')
      
      // Limpiar los archivos de emojis antiguos del almacenamiento
      try {
        const oldEmotions = Object.keys(emojiCustom.images || {})
        for (const emotion of oldEmotions) {
          await configStorage.deleteFile(`emoji_${emotion}`)
        }
        console.log(`Se eliminaron ${oldEmotions.length} archivos de emojis antiguos`)
      } catch (error) {
        console.warn('Error al limpiar los archivos de emojis antiguos:', error)
      }
      
      // Restablecer a la nueva estructura vacía
      config.value.theme.emoji.custom = {
        size: emojiCustom.size || { width: 64, height: 64 },
        images: {},
        fileMap: {},
        emotionMap: {}
      }
      
      // Si actualmente se usan emojis personalizados, restablecer al estado no seleccionado
      if (config.value.theme.emoji.type === 'custom') {
        config.value.theme.emoji.type = ''
        console.log('Se restableció el tipo de emoji, por favor seleccione de nuevo')
      }
      
      // Guardar inmediatamente la configuración limpiada
      await saveConfigToStorage()
      
      console.log('✅ Los datos de emojis antiguos se han limpiado por completo')
      
      // Mensaje amigable para el usuario
      setTimeout(() => {
        alert('Se detectó y eliminó una estructura de datos de emoji de una versión anterior.\n\nLa nueva versión utiliza una técnica de deduplicación de archivos para ahorrar espacio de almacenamiento.\n\nVuelva a cargar sus imágenes de emoji personalizadas.')
      }, 500)
    }
  } catch (error) {
    console.error('Error al limpiar los datos de emojis antiguos:', error)
  }
}

// Guardar la configuración en el almacenamiento
const saveConfigToStorage = async () => {
  try {
    await configStorage.saveConfig(config.value)
  } catch (error) {
    console.error('Error al guardar la configuración:', error)
  }
}

// Confirmar para empezar de nuevo
const confirmReset = async () => {
  try {
    isResetting.value = true
    
    // Limpiar los datos almacenados de AssetsBuilder
    await assetsBuilder.clearAllStoredData()
    
    // Guardar la configuración actual del chip
    const currentChipConfig = {
      model: config.value.chip.model,
      display: { ...config.value.chip.display }
    }
    
    // Restablecer la configuración a los valores predeterminados, pero conservar la configuración del chip
    config.value = {
      chip: currentChipConfig,
      theme: {
        wakeword: {
          type: 'none',
          preset: '',
          custom: {
            name: '',
            command: '',
            threshold: 20,
            model: 'mn6_cn'
          }
        },
        font: {
          type: 'none',
          preset: '',
          hide_subtitle: false,
          custom: {
            file: null,
            size: 20,
            bpp: 4,
            charset: 'deepseek'
          }
        },
        emoji: {
          type: 'none',
          preset: '',
          custom: {
            size: { width: 64, height: 64 },
            images: {}
          }
        },
        skin: {
          light: {
            backgroundType: 'color',
            backgroundColor: '#ffffff',
            textColor: '#000000',
            backgroundImage: null
          },
          dark: {
            backgroundType: 'color', 
            backgroundColor: '#121212',
            textColor: '#ffffff',
            backgroundImage: null
          }
        }
      }
    }
    
    // Restablecer pasos y estado
    currentStep.value = 0
    activeThemeTab.value = 'wakeword'
    hasStoredConfig.value = false
    isAutoSaveEnabled.value = false
    
  } catch (error) {
    console.error('Error al restablecer la configuración:', error)
    alert(t('errors.resetFailed'))
  } finally {
    isResetting.value = false
  }
}

// Observar los cambios en la configuración y guardar automáticamente
watch(config, async (newConfig) => {
  if (!isLoading.value && isAutoSaveEnabled.value) {
    await saveConfigToStorage()
  }
}, { deep: true })

// Inicializar al cargar la página
onMounted(async () => {
  await configStorage.initialize()
  await loadConfigFromStorage()
})

// Limpiar el temporizador al desmontar el componente
onUnmounted(() => {
  if (autoHideTimer.value) {
    clearTimeout(autoHideTimer.value)
  }
})

// Modificar la lógica del botón de cerrar
const closeConfigNotice = () => {
  hasStoredConfig.value = false
  if (autoHideTimer.value) {
    clearTimeout(autoHideTimer.value)
  }
}

// Restablecer el temporizador de ocultación automática (se llama al pasar el ratón por encima)
const resetAutoHideTimer = () => {
  // Limpiar el temporizador anterior
  if (autoHideTimer.value) {
    clearTimeout(autoHideTimer.value)
  }

  // Establecer un nuevo temporizador de 5 segundos
  autoHideTimer.value = setTimeout(() => {
    hasStoredConfig.value = false
  }, 5000)
}
</script>
